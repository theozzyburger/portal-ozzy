-- Uniformes (pedido de 07/10): tamanhos no cadastro, pedido de troca feito pelo próprio funcionário
-- e pedidos de compra de uniformes por leva (para orçamento com o fornecedor).

alter table funcionarios add column tam_camiseta text check (tam_camiseta in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'));
alter table funcionarios add column tam_calca text check (tam_calca ~ '^\d{2}$');
alter table funcionarios add column tam_calcado int check (tam_calcado between 30 and 50);

-- Pedido de troca: a pessoa diz o que precisa, por quê, e pode mandar foto. Vai para a gestão.
create table uniforme_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  itens text[] not null check (cardinality(itens) > 0),
  motivo text not null check (length(trim(motivo)) > 0),
  foto text, -- caminho no bucket "fotos", na pasta da pessoa
  status text not null default 'aberta' check (status in ('aberta', 'atendida', 'recusada')),
  resposta text,
  respondido_por uuid references funcionarios (id),
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on uniforme_solicitacoes (funcionario_id);

alter table uniforme_solicitacoes enable row level security;
create policy "ver pedidos de troca" on uniforme_solicitacoes for select using (funcionario_id = (eu()).id or sou_gestao());
create policy "pedir troca" on uniforme_solicitacoes for insert with check (funcionario_id = (eu()).id and status = 'aberta');
create policy "gestao responde troca" on uniforme_solicitacoes for update using (sou_gestao()) with check (sou_gestao());

-- Pedido de compra de uniformes, organizado por leva.
create table uniforme_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  titulo text not null check (length(trim(titulo)) > 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'orcamento', 'pedido', 'recebido')),
  fornecedor text,
  observacao text,
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);

-- Cada linha: uma peça para uma pessoa (cor e modelagem definidas na hora, a partir do nível e do sexo).
create table uniforme_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references uniforme_pedidos (id) on delete cascade,
  funcionario_id uuid references funcionarios (id) on delete set null,
  item text not null,
  cor text,
  modelagem text check (modelagem in ('feminina', 'masculina', 'unissex')),
  tamanho text,
  quantidade int not null check (quantidade between 1 and 99)
);
create index on uniforme_pedido_itens (pedido_id);

alter table uniforme_pedidos enable row level security;
alter table uniforme_pedido_itens enable row level security;
create policy "gestao ve pedidos de uniforme" on uniforme_pedidos for select using (sou_gestao());
create policy "gestao edita pedidos de uniforme" on uniforme_pedidos for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve itens do pedido" on uniforme_pedido_itens for select using (sou_gestao());
create policy "gestao edita itens do pedido" on uniforme_pedido_itens for all using (sou_gestao()) with check (sou_gestao());
