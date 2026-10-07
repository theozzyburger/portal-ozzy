-- Pix de cada funcionário e controle de freelancers (pedido de 07/10).

alter table funcionarios add column pix text;

-- Freelancers: cadastro e diárias. Só a gestão (Gerente, Administrativo, Proprietário) vê e lança:
-- CPF e Pix são dados pessoais.
create table freelancers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  pix text not null,
  celular text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references funcionarios (id)
);

create unique index freelancers_cpf on freelancers (cpf);

-- Cada dia trabalhado. Semana de segunda a domingo, paga na segunda seguinte.
create table freela_diarias (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references freelancers (id),
  data date not null,
  turno text not null check (turno in ('manha', 'noite')),
  unidade_id text not null references unidades (id),
  funcao text not null,
  valor numeric(10, 2) not null check (valor >= 0),
  observacao text,
  lancado_por uuid references funcionarios (id) default (eu()).id,
  lancado_em timestamptz not null default now(),
  unique (freelancer_id, data, turno)
);

create index freela_diarias_data on freela_diarias (data);

-- Pagamento da semana: quem marcou e quando (uma linha por freelancer por semana).
create table freela_pagamentos (
  freelancer_id uuid not null references freelancers (id),
  semana date not null check (extract(isodow from semana) = 1),
  valor numeric(10, 2) not null,
  pago_em timestamptz not null default now(),
  pago_por uuid references funcionarios (id) default (eu()).id,
  primary key (freelancer_id, semana)
);

alter table freelancers enable row level security;
alter table freela_diarias enable row level security;
alter table freela_pagamentos enable row level security;

create policy "gestao le freelancers" on freelancers for select using (sou_gestao());
create policy "gestao cadastra freelancers" on freelancers for insert with check (sou_gestao());
create policy "gestao altera freelancers" on freelancers for update using (sou_gestao());

create policy "gestao le diarias" on freela_diarias for select using (sou_gestao());
create policy "gestao lanca diarias" on freela_diarias for insert with check (sou_gestao());
create policy "gestao altera diarias" on freela_diarias for update using (sou_gestao());
create policy "gestao apaga diarias" on freela_diarias for delete using (sou_gestao());

create policy "gestao le pagamentos" on freela_pagamentos for select using (sou_gestao());
create policy "gestao marca pagamentos" on freela_pagamentos for insert with check (sou_gestao());
create policy "gestao desfaz pagamentos" on freela_pagamentos for delete using (sou_gestao());
