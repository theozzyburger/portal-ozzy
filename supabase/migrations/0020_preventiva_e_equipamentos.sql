-- Manutenção preventiva (itens com periodicidade) e cadastro de equipamentos com histórico (pedidos de 07/10).
-- Manutenção e gestão (atendo_chamados) veem e editam tudo; a lista de itens é preenchida pelo próprio portal.

create table equipamentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references unidades (id),
  nome text not null check (length(trim(nome)) > 0),
  marca_modelo text,
  numero_serie text,
  local text,
  data_compra date,
  valor_compra numeric(12, 2) check (valor_compra >= 0),
  valor_atual numeric(12, 2) check (valor_atual >= 0),
  foto text, -- caminho no bucket "chamados", pasta equipamentos/
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on equipamentos (unidade_id);

-- Histórico de manutenções de cada equipamento (o que aconteceu, quem fez, quanto custou).
create table equipamento_manutencoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references equipamentos (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('corretiva', 'preventiva')),
  descricao text not null check (length(trim(descricao)) > 0),
  prestador text,
  custo numeric(12, 2) check (custo >= 0),
  chamado_id uuid references chamados (id) on delete set null,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on equipamento_manutencoes (equipamento_id);

-- Itens de manutenção preventiva: o que verificar e a cada quantos dias (ex.: limpar coifa a cada 90).
-- unidade_id nulo = vale para todas as lojas; equipamento_id opcional.
create table preventivas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text references unidades (id),
  equipamento_id uuid references equipamentos (id) on delete set null,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  frequencia_dias int not null check (frequencia_dias between 1 and 3650),
  -- Primeira vez que vence (se ainda não foi feita nenhuma vez).
  primeira_em date not null default current_date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cada vez que o item foi feito. O próximo vencimento = última execução + frequência.
create table preventiva_execucoes (
  id uuid primary key default gen_random_uuid(),
  preventiva_id uuid not null references preventivas (id) on delete cascade,
  unidade_id text references unidades (id), -- em qual loja foi feito (itens que valem para todas)
  feito_em date not null,
  observacao text,
  feito_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on preventiva_execucoes (preventiva_id);

alter table equipamentos enable row level security;
alter table equipamento_manutencoes enable row level security;
alter table preventivas enable row level security;
alter table preventiva_execucoes enable row level security;
create policy "manutencao ve equipamentos" on equipamentos for select using (atendo_chamados());
create policy "manutencao edita equipamentos" on equipamentos for all using (atendo_chamados()) with check (atendo_chamados());
create policy "manutencao ve historico" on equipamento_manutencoes for select using (atendo_chamados());
create policy "manutencao edita historico" on equipamento_manutencoes for all using (atendo_chamados()) with check (atendo_chamados());
create policy "manutencao ve preventivas" on preventivas for select using (atendo_chamados());
create policy "manutencao edita preventivas" on preventivas for all using (atendo_chamados()) with check (atendo_chamados());
create policy "manutencao ve execucoes" on preventiva_execucoes for select using (atendo_chamados());
create policy "manutencao edita execucoes" on preventiva_execucoes for all using (atendo_chamados()) with check (atendo_chamados());
