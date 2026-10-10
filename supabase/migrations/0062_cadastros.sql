-- Cadastros da Eclética (Heitor, 09/10): materiais (insumos), produtos de venda com as tabelas de preço e o
-- histórico de compras por fornecedor (base para sugerir o que e quanto comprar). Os dados vêm na 0063.
-- Quando a integração com a Eclética sair, estes cadastros passam a vir dela pelo mesmo código.

-- Material: para onde vai (lista de envio da Eclética), conta contábil e estoque mínimo.
alter table insumos add column setor_envio text check (setor_envio in ('cozinha', 'atendimento', 'eventos'));
alter table insumos add column conta_id uuid references plano_contas (id);
alter table insumos add column estoque_minimo numeric(12, 3) check (estoque_minimo >= 0);

-- Produtos de venda (cardápio da Eclética). preco = tabela padrão (Burger), preco_pizza = tabela The Ozzy Pizza.
-- tipo: normal (aparece no PDV), escondido, vinculo (parte de combo ou pergunta).
create table produtos_venda (
  id uuid primary key default gen_random_uuid(),
  ecletica_codigo text unique,
  nome text not null check (length(trim(nome)) > 0),
  grupo text,
  subgrupo text,
  tipo text not null default 'normal' check (tipo in ('normal', 'escondido', 'vinculo')),
  unidade text not null default 'un' check (unidade in ('kg', 'l', 'un')),
  preco numeric(12, 2) check (preco >= 0),
  preco_pizza numeric(12, 2) check (preco_pizza >= 0),
  receita_id uuid references receitas (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table produtos_venda enable row level security;
create policy "gestao ve produtos de venda" on produtos_venda for select using (sou_gestao());
create policy "gestao cadastra produtos de venda" on produtos_venda for insert with check (sou_gestao());
create policy "gestao edita produtos de venda" on produtos_venda for update using (sou_gestao());
grant select, insert, update on produtos_venda to authenticated;

-- Compras já feitas (histórico da Eclética; quantidade e preço na unidade de estoque do material).
create table compras_historico (
  id uuid primary key default gen_random_uuid(),
  data timestamptz not null,
  insumo_id uuid references insumos (id),
  ecletica_codigo text,
  descricao text,
  fornecedor_id uuid references fornecedores (id),
  fornecedor_nome text, -- como veio na Eclética
  quantidade numeric(14, 3) not null,
  unidade text,
  preco numeric(14, 5),
  total numeric(14, 2),
  centro_custo_id text not null default 'central' references centros_custo (id),
  origem text not null default 'ecletica'
);
create index on compras_historico (fornecedor_id, data);
create index on compras_historico (insumo_id, data);
alter table compras_historico enable row level security;
create policy "gestao ve historico de compras" on compras_historico for select using (sou_gestao());
grant select on compras_historico to authenticated;

-- Último preço de cada item com este fornecedor: pedido de compra, nota ou histórico da Eclética (o mais novo).
create or replace function precos_fornecedor(p_fornecedor uuid)
returns table (insumo_id uuid, preco numeric, em date, origem text)
language sql stable security definer set search_path = public as $$
  select distinct on (t.insumo_id) t.insumo_id, round(t.preco, 4), t.em, t.origem
  from (
    select (x->>'insumo_id')::uuid insumo_id, (x->>'preco')::numeric preco, p.data_pedido em, 'pedido' origem, p.criado_em quando
    from compras_pedidos p, jsonb_array_elements(p.itens) x
    where p.fornecedor_id = p_fornecedor and p.status <> 'cancelado' and coalesce((x->>'preco')::numeric, 0) > 0
    union all
    select ni.insumo_id, ni.valor_total / ni.quantidade / coalesce(ni.fator, 1), n.emissao, 'nota', n.criado_em
    from nota_itens ni join notas_fiscais n on n.id = ni.nota_id
    where n.fornecedor_id = p_fornecedor and ni.insumo_id is not null and ni.quantidade > 0
    union all
    select h.insumo_id, h.preco, h.data::date, 'historico', h.data
    from compras_historico h
    where h.fornecedor_id = p_fornecedor and h.insumo_id is not null and h.preco > 0
  ) t
  where sou_gestao()
  order by t.insumo_id, t.em desc, t.quando desc
$$;

-- O que costuma ser comprado deste fornecedor e quanto (últimas p_semanas semanas), pelo histórico e pelos
-- pedidos do portal. A tela sugere a quantidade: média por semana, ou a média por compra se compra a cada 10+ dias.
create function compras_do_fornecedor(p_fornecedor uuid, p_semanas int default 12)
returns table (insumo_id uuid, compras int, quantidade numeric, por_semana numeric, por_compra numeric,
  intervalo_dias numeric, ultima date, ultima_qtd numeric)
language sql stable security definer set search_path = public as $$
  with c as (
    select h.insumo_id, h.data::date dia, h.quantidade q
    from compras_historico h
    where h.fornecedor_id = p_fornecedor and h.insumo_id is not null and h.quantidade > 0
    union all
    select (x->>'insumo_id')::uuid, coalesce(p.recebido_em, p.previsao_entrega), (x->>'quantidade')::numeric
    from compras_pedidos p, jsonb_array_elements(p.itens) x
    where p.fornecedor_id = p_fornecedor and p.status in ('pedido', 'recebido') and coalesce((x->>'quantidade')::numeric, 0) > 0
  ), d as (
    -- Mais de uma linha no mesmo dia conta como uma compra.
    select insumo_id, dia, sum(q) q from c group by 1, 2
  )
  select d.insumo_id,
    count(*) filter (where d.dia >= current_date - p_semanas * 7)::int,
    round(sum(d.q) filter (where d.dia >= current_date - p_semanas * 7), 3),
    round(coalesce(sum(d.q) filter (where d.dia >= current_date - p_semanas * 7), 0) / p_semanas, 3),
    round(avg(d.q) filter (where d.dia >= current_date - p_semanas * 7), 3),
    case when count(*) > 1 then round((max(d.dia) - min(d.dia))::numeric / (count(*) - 1), 1) end,
    max(d.dia),
    (array_agg(d.q order by d.dia desc))[1]
  from d
  where sou_gestao()
  group by d.insumo_id
  order by count(*) filter (where d.dia >= current_date - p_semanas * 7) desc, max(d.dia) desc
$$;
grant execute on function compras_do_fornecedor(uuid, int) to authenticated;
