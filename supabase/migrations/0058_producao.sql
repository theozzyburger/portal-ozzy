-- Produção de pré-preparos (Heitor, 09/10): todo dia a produção transforma insumos em preparo
-- (ex.: óleo + cheiro verde viram maionese verde). Lançar a produção dá entrada no preparo e baixa
-- nos ingredientes, no mesmo estoque, e o custo do preparo sai do preço dos ingredientes.

-- O preparo da ficha vira um item de estoque (insumo) com o mesmo nome. Fica ligado aqui.
alter table receitas add column insumo_id uuid references insumos (id);

create table producoes (
  id uuid primary key default gen_random_uuid(),
  centro_custo_id text not null references centros_custo (id),
  data date not null,
  receita_id uuid references receitas (id),
  versao int,
  insumo_id uuid not null references insumos (id), -- o que foi produzido
  quantidade numeric(14, 4) not null check (quantidade > 0),
  custo_total numeric(14, 4),
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid default (eu()).id references funcionarios (id)
);
alter table producoes enable row level security;
create policy "gestao ve producoes" on producoes for select using (sou_gestao());
grant select on producoes to authenticated;

-- Os movimentos da produção (entrada do preparo e saídas dos ingredientes) apontam para ela; desfazer apaga tudo junto.
alter table estoque_movimentos add column producao_id uuid references producoes (id) on delete cascade;
create index on estoque_movimentos (producao_id) where producao_id is not null;

-- p_saidas: [{insumo_id, quantidade}] já na unidade de cada insumo (a tela calcula pela ficha e deixa ajustar).
create function lancar_producao(p_centro text, p_data date, p_receita uuid, p_insumo uuid, p_quantidade numeric, p_saidas jsonb, p_obs text)
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
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
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
grant execute on function lancar_producao(text, date, uuid, uuid, numeric, jsonb, text) to authenticated;

create function desfazer_producao(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  delete from producoes where id = p_id;
end $$;
grant execute on function desfazer_producao(uuid) to authenticated;
