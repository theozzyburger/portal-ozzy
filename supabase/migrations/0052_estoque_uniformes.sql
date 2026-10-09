-- Estoque de uniformes (Heitor, 09/10): quanto tem de cada peça, cor, modelagem e tamanho.
-- Cada linha é um movimento. Contagem diz quanto tem (zera a conta daquela peça); os outros somam ou tiram:
-- entrada (chegou do fornecedor), entrega (saiu para alguém, negativo), devolucao (voltou), baixa (perdeu/estragou, negativo).
-- Movimentos feitos juntos têm a mesma referencia (entrega:<id>, pedido:<id>, manual:<uuid>) e podem ser desfeitos juntos.
create table uniforme_estoque (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  item text not null check (length(trim(item)) > 0),
  cor text,
  modelagem text check (modelagem in ('feminina', 'masculina', 'unissex')),
  tamanho text not null default 'Único',
  tipo text not null check (tipo in ('contagem', 'entrada', 'entrega', 'devolucao', 'baixa')),
  quantidade int not null,
  referencia text not null,
  observacao text,
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now(),
  check (tipo <> 'contagem' or quantidade >= 0),
  check (tipo not in ('entrada', 'devolucao') or quantidade > 0),
  check (tipo not in ('entrega', 'baixa') or quantidade < 0)
);
create index on uniforme_estoque (referencia);
create index on uniforme_estoque (criado_em);

alter table uniforme_estoque enable row level security;
create policy "gestao ve estoque de uniformes" on uniforme_estoque for select using (sou_gestao());
create policy "gestao movimenta estoque de uniformes" on uniforme_estoque for insert with check (sou_gestao());
create policy "gestao desfaz movimento de uniforme" on uniforme_estoque for delete using (sou_gestao());
