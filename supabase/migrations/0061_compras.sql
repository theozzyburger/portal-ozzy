-- Compras (Heitor, 09/10): pedidos de compra aos fornecedores (insumos, embalagens, limpeza), com a previsão
-- de entrega, e o relatório da semana por dia de entrega para a equipe saber o que chega e quando.
-- A compra é feita às segundas; embalagem costuma demorar mais (prazo de entrega do fornecedor).

alter table fornecedores add column prazo_entrega_dias int check (prazo_entrega_dias >= 0);

create table compras_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  fornecedor_id uuid not null references fornecedores (id),
  centro_custo_id text not null default 'central' references centros_custo (id), -- para onde vai
  categoria text not null default 'insumos' check (categoria in ('insumos', 'embalagens', 'limpeza', 'outros')),
  status text not null default 'pedido' check (status in ('rascunho', 'pedido', 'recebido', 'cancelado')),
  data_pedido date not null default current_date,
  previsao_entrega date not null,
  -- [{insumo_id, quantidade, unidade, preco}] (preço por unidade do item)
  itens jsonb not null default '[]',
  total numeric(14, 2) not null default 0,
  forma_pagamento text,
  observacao text,
  recebido_em date,
  criado_em timestamptz not null default now(),
  criado_por uuid default (eu()).id references funcionarios (id),
  atualizado_em timestamptz not null default now()
);
create index on compras_pedidos (previsao_entrega);
create index on compras_pedidos (fornecedor_id);
alter table compras_pedidos enable row level security;
create policy "gestao ve pedidos de compra" on compras_pedidos for select using (sou_gestao());
create policy "gestao cria pedidos de compra" on compras_pedidos for insert with check (sou_gestao());
create policy "gestao edita pedidos de compra" on compras_pedidos for update using (sou_gestao());
grant select, insert, update on compras_pedidos to authenticated;
grant usage on sequence compras_pedidos_numero_seq to authenticated;

-- Último preço de cada item com este fornecedor: o do último pedido de compra ou, se for mais novo, o da última nota.
create function precos_fornecedor(p_fornecedor uuid)
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
  ) t
  where sou_gestao()
  order by t.insumo_id, t.em desc, t.quando desc
$$;
grant execute on function precos_fornecedor(uuid) to authenticated;
