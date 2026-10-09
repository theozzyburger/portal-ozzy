-- Fechamento das lojas e pedido para a Central (Heitor, 09/10). No fim do turno a cozinha e o atendimento
-- da PSD e da Vila contam o estoque (pela lista da Eclética), o portal sugere o pedido pelo estoque ideal do dia
-- seguinte, a pessoa confirma ou ajusta e envia. De manhã a produção vê os pedidos somados e o que precisa preparar
-- (pedido menos o que já tem na Central).

-- Código do material na Eclética e se é preparado na Central.
alter table insumos add column ecletica_codigo text;
create unique index on insumos (ecletica_codigo) where ecletica_codigo is not null;
alter table insumos add column pre_preparo boolean not null default false;

-- Quem é da produção (setor do cadastro).
create function sou_producao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((eu()).setor::text = 'producao', false)
$$;

-- Lista de cada loja e setor. ideal: estoque ideal de cada dia da semana (0 = segunda), na unidade de contagem.
create table fechamento_itens (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references unidades (id),
  setor text not null check (setor in ('cozinha', 'atendimento')),
  insumo_id uuid not null references insumos (id),
  unidade_contagem text not null default 'Uni', -- como contam: Kg, Uni, Lts, Pct, Cxs, GL…
  ordem int not null default 0,
  ideal numeric[],
  ativo boolean not null default true,
  unique (unidade_id, setor, insumo_id)
);
alter table fechamento_itens enable row level security;
create policy "ve listas de fechamento" on fechamento_itens for select
  using (sou_gestao() or sou_producao() or unidade_id = (eu()).unidade_id);
create policy "gestao cadastra itens de fechamento" on fechamento_itens for insert with check (sou_gestao());
create policy "gestao edita itens de fechamento" on fechamento_itens for update using (sou_gestao());
grant select, insert, update on fechamento_itens to authenticated;

-- Um fechamento por loja, setor e dia (enviar de novo substitui). para = dia do pedido (o seguinte).
create table fechamentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references unidades (id),
  setor text not null check (setor in ('cozinha', 'atendimento')),
  data date not null,
  para date not null,
  responsavel text,
  observacao text,
  fala text,
  enviado_em timestamptz not null default now(),
  enviado_por uuid references funcionarios (id),
  unique (unidade_id, setor, data)
);
alter table fechamentos enable row level security;
create policy "ve fechamentos" on fechamentos for select
  using (sou_gestao() or sou_producao() or unidade_id = (eu()).unidade_id);
grant select on fechamentos to authenticated;

create table fechamento_contagens (
  fechamento_id uuid not null references fechamentos (id),
  item_id uuid not null references fechamento_itens (id),
  insumo_id uuid not null references insumos (id),
  contagem numeric(12, 3),
  sugestao numeric(12, 3),
  pedido numeric(12, 3),
  primary key (fechamento_id, item_id)
);
alter table fechamento_contagens enable row level security;
create policy "ve contagens do fechamento" on fechamento_contagens for select
  using (exists (select 1 from fechamentos f where f.id = fechamento_id));
grant select on fechamento_contagens to authenticated;

-- A lista para contar (com o ideal do dia seguinte e o que já foi enviado nesse dia).
-- Quem não é da gestão não lê o cadastro de insumos; o nome vem por aqui.
create function lista_fechamento(p_unidade text, p_setor text, p_data date)
returns table (item_id uuid, insumo_id uuid, nome text, unidade_contagem text, ordem int, pre_preparo boolean,
  ideal numeric, contagem numeric, sugestao numeric, pedido numeric)
language sql stable security definer set search_path = public as $$
  select fi.id, fi.insumo_id, i.nome, fi.unidade_contagem, fi.ordem, i.pre_preparo,
    fi.ideal[extract(isodow from p_data + 1)::int], c.contagem, c.sugestao, c.pedido
  from fechamento_itens fi
  join insumos i on i.id = fi.insumo_id
  left join fechamentos f on f.unidade_id = fi.unidade_id and f.setor = fi.setor and f.data = p_data
  left join fechamento_contagens c on c.fechamento_id = f.id and c.item_id = fi.id
  where fi.unidade_id = p_unidade and fi.setor = p_setor and (fi.ativo or c.item_id is not null)
    and (sou_gestao() or sou_producao() or p_unidade = (eu()).unidade_id)
  order by fi.ordem, i.nome
$$;
grant execute on function lista_fechamento(text, text, date) to authenticated;

-- Enviar (ou reenviar) o fechamento. p_itens: [{item_id, contagem, sugestao, pedido}].
create function enviar_fechamento(p_unidade text, p_setor text, p_data date, p_responsavel text, p_obs text, p_fala text, p_itens jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  x jsonb;
  fi fechamento_itens;
begin
  if (eu()).id is null or not (sou_gestao() or p_unidade = (eu()).unidade_id) then
    raise exception 'Só quem é desta loja (ou a gestão) envia o fechamento.';
  end if;
  if p_setor not in ('cozinha', 'atendimento') then raise exception 'Escolha cozinha ou atendimento.'; end if;
  if p_data > current_date + 1 then raise exception 'Confira a data do fechamento.'; end if;
  insert into fechamentos (unidade_id, setor, data, para, responsavel, observacao, fala, enviado_por)
  values (p_unidade, p_setor, p_data, p_data + 1, nullif(trim(p_responsavel), ''), nullif(trim(p_obs), ''), nullif(trim(p_fala), ''), (eu()).id)
  on conflict (unidade_id, setor, data) do update set responsavel = excluded.responsavel, observacao = excluded.observacao,
    fala = excluded.fala, enviado_em = now(), enviado_por = excluded.enviado_por
  returning id into v_id;
  -- Reenvio: o que não veio desta vez fica em branco.
  update fechamento_contagens set contagem = null, sugestao = null, pedido = null where fechamento_id = v_id;
  for x in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    select * into fi from fechamento_itens where id = (x->>'item_id')::uuid;
    if fi.id is null or fi.unidade_id <> p_unidade or fi.setor <> p_setor then raise exception 'Item fora da lista desta loja.'; end if;
    insert into fechamento_contagens (fechamento_id, item_id, insumo_id, contagem, sugestao, pedido)
    values (v_id, fi.id, fi.insumo_id, (x->>'contagem')::numeric, (x->>'sugestao')::numeric, nullif((x->>'pedido')::numeric, 0))
    on conflict (fechamento_id, item_id) do update set contagem = excluded.contagem, sugestao = excluded.sugestao, pedido = excluded.pedido;
  end loop;
  return v_id;
end $$;
grant execute on function enviar_fechamento(text, text, date, text, text, text, jsonb) to authenticated;

-- Painel da produção: pedidos de cada loja para o dia (somados por item) e o que tem na Central.
create function pedidos_producao(p_para date)
returns table (insumo_id uuid, nome text, setor text, unidade_contagem text, unidade text, pre_preparo boolean,
  psd numeric, va numeric, total numeric, central numeric)
language sql stable security definer set search_path = public as $$
  with p as (
    select c.insumo_id, f.setor, f.unidade_id, max(fi.unidade_contagem) un, sum(c.pedido) q
    from fechamentos f
    join fechamento_contagens c on c.fechamento_id = f.id
    join fechamento_itens fi on fi.id = c.item_id
    where f.para = p_para and coalesce(c.pedido, 0) > 0
    group by 1, 2, 3
  )
  select i.id, i.nome, min(p.setor), max(p.un), i.unidade, i.pre_preparo,
    sum(p.q) filter (where p.unidade_id = 'burger-psd'), sum(p.q) filter (where p.unidade_id = 'burger-va'), sum(p.q),
    (select coalesce(sum(m.quantidade), 0) from estoque_movimentos m where m.centro_custo_id = 'central' and m.insumo_id = i.id)
  from p join insumos i on i.id = p.insumo_id
  where sou_gestao() or sou_producao()
  group by i.id
  order by i.pre_preparo desc, min(p.setor), i.nome
$$;
grant execute on function pedidos_producao(date) to authenticated;

-- A produção conta o que tem na Central (só os itens informados): o portal lança a diferença como ajuste.
create function contar_central(p_data date, p_itens jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  v_saldo numeric;
  v_dif numeric;
  n int := 0;
begin
  if not (sou_gestao() or sou_producao()) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    if (x->>'quantidade') is null then continue; end if;
    select coalesce(sum(quantidade), 0) into v_saldo from estoque_movimentos
      where centro_custo_id = 'central' and insumo_id = (x->>'insumo_id')::uuid;
    v_dif := (x->>'quantidade')::numeric - v_saldo;
    if abs(v_dif) > 0.0001 then
      insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, observacao)
      values ('central', (x->>'insumo_id')::uuid, p_data, 'ajuste', v_dif, 'Contagem da produção: ' || (x->>'quantidade'));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
grant execute on function contar_central(date, jsonb) to authenticated;
