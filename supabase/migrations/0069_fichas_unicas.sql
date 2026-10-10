-- Fichas técnicas num lugar só (Heitor, 10/10): as fichas da Eclética (pré-preparos e produtos das lojas) entram
-- nas mesmas fichas dos eventos, com versões e custo pelo preço dos insumos. Substitui a cópia das fichas do Lucro Fácil.

-- area: de quem é a ficha de produto (os pré-preparos servem para todos).
alter table receitas add column area text not null default 'eventos' check (area in ('eventos', 'lojas'));
alter table receitas add column ecletica_codigo text unique;
-- Para a ficha impressa da produção.
alter table receitas add column observacoes text;
alter table receitas add column responsavel text;
alter table receitas add column porcao_nome text; -- potinhos, seringas, porções…
alter table receitas add column porcao_qtd numeric(12, 4) check (porcao_qtd > 0); -- quanto vai em cada porção, na unidade da ficha
alter table receitas add column lotes numeric[]; -- quanto imprimir em cada coluna (na unidade da ficha); vazio = 1 a 4 receitas

-- Mesmo nome pode existir nas lojas e nos eventos (o Foca na Mortadela do evento não é o da loja).
drop index receitas_lower_tipo_idx;
create unique index receitas_nome_unico on receitas (lower(nome), tipo, area);

-- Item que só vai no delivery (embalagem): marcado com * na Eclética.
alter table receita_itens add column so_delivery boolean not null default false;

create or replace function salvar_versao_receita(p_receita uuid, p_rendimento numeric, p_custo numeric, p_nota text, p_itens jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_num int;
  v_id uuid;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if exists (select 1 from jsonb_array_elements(p_itens) i where (i ->> 'sub_receita_id')::uuid = p_receita) then
    raise exception 'Uma ficha não pode usar ela mesma.';
  end if;
  select versao_atual + 1 into v_num from receitas where id = p_receita for update;
  if v_num is null then raise exception 'Ficha não encontrada.'; end if;
  insert into receita_versoes (receita_id, numero, rendimento, custo_total, nota)
  values (p_receita, v_num, p_rendimento, p_custo, nullif(trim(p_nota), '')) returning id into v_id;
  insert into receita_itens (versao_id, ordem, insumo_id, sub_receita_id, quantidade, aproveitamento, so_delivery)
  select v_id, ord, (i ->> 'insumo_id')::uuid, (i ->> 'sub_receita_id')::uuid, (i ->> 'quantidade')::numeric,
         coalesce((i ->> 'aproveitamento')::numeric, 1), coalesce((i ->> 'so_delivery')::boolean, false)
  from jsonb_array_elements(p_itens) with ordinality as t (i, ord);
  update receitas set versao_atual = v_num, atualizado_em = now() where id = p_receita;
  return v_num;
end $$;

-- A produção (setor Produção) lança o que preparou no computador de lá: vê as fichas e os itens, e lança.
create policy "producao ve receitas" on receitas for select using ((select sou_producao()));
create policy "producao ve versoes de receita" on receita_versoes for select using ((select sou_producao()));
create policy "producao ve itens de receita" on receita_itens for select using ((select sou_producao()));
create policy "producao ve insumos" on insumos for select using ((select sou_producao()));
create policy "producao ve producoes" on producoes for select using ((select sou_producao()));
create policy "producao ve centros de custo" on centros_custo for select using ((select sou_producao()));

create or replace function lancar_producao(p_centro text, p_data date, p_receita uuid, p_insumo uuid, p_quantidade numeric, p_saidas jsonb, p_obs text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r receitas;
  v_insumo uuid := p_insumo;
  v_custo numeric := 0;
  v_id uuid;
  v_nome text;
  s jsonb;
begin
  if not (sou_gestao() or sou_producao()) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if not exists (select 1 from centros_custo where id = p_centro) then raise exception 'Escolha a loja.'; end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Diga quanto foi produzido.'; end if;
  if p_receita is not null then
    select * into r from receitas where id = p_receita;
    if r.id is null then raise exception 'Ficha não encontrada.'; end if;
    -- O item de estoque do preparo: o já ligado, um insumo com o mesmo nome, ou um novo.
    v_insumo := coalesce(r.insumo_id, (select id from insumos where lower(nome) = lower(r.nome) limit 1));
    if v_insumo is null then
      insert into insumos (nome, categoria, unidade, observacao, ativo)
      values (r.nome, 'Preparos', r.unidade, 'Produção própria (criado ao lançar a produção).', true)
      returning id into v_insumo;
    end if;
    if r.insumo_id is distinct from v_insumo then update receitas set insumo_id = v_insumo where id = r.id; end if;
  end if;
  if v_insumo is null then raise exception 'Escolha o que foi produzido.'; end if;
  select nome into v_nome from insumos where id = v_insumo;

  for s in select * from jsonb_array_elements(coalesce(p_saidas, '[]')) loop
    if (s->>'insumo_id')::uuid = v_insumo then raise exception 'O preparo não pode ser ingrediente dele mesmo.'; end if;
    if coalesce((s->>'quantidade')::numeric, 0) > 0 then
      v_custo := v_custo + (s->>'quantidade')::numeric * coalesce((select preco from insumos where id = (s->>'insumo_id')::uuid), 0);
    end if;
  end loop;

  insert into producoes (centro_custo_id, data, receita_id, versao, insumo_id, quantidade, custo_total, observacao)
  values (p_centro, p_data, p_receita, r.versao_atual, v_insumo, p_quantidade, round(v_custo, 4), nullif(trim(p_obs), ''))
  returning id into v_id;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, producao_id)
  select p_centro, (x->>'insumo_id')::uuid, p_data, 'saida', -(x->>'quantidade')::numeric, null, 'Produção de ' || v_nome, v_id
  from jsonb_array_elements(coalesce(p_saidas, '[]')) x
  where coalesce((x->>'quantidade')::numeric, 0) > 0;

  insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, observacao, producao_id)
  values (p_centro, v_insumo, p_data, 'entrada', p_quantidade, case when v_custo > 0 then round(v_custo / p_quantidade, 6) end,
    'Produção' || coalesce(' · ' || nullif(trim(p_obs), ''), ''), v_id);

  -- Custo do preparo atualizado pela última produção (é o preço que as outras fichas usam).
  if v_custo > 0 then
    update insumos set preco = round(v_custo / p_quantidade, 4), preco_em = now(), ativo = true where id = v_insumo;
  else
    update insumos set ativo = true where id = v_insumo and not ativo;
  end if;
  return v_id;
end $$;
