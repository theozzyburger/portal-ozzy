-- Vale-transporte no cadastro e salário do mês detalhado (pedido de 07/10).
-- A gestão lança os valores que a contabilidade manda; quando libera o mês, cada pessoa vê o seu.

alter table funcionarios add column opta_vt boolean not null default false;

create table salarios (
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  salario numeric(12, 2) not null default 0 check (salario >= 0),
  caixinha numeric(12, 2) not null default 0 check (caixinha >= 0),
  bonus_caixinha numeric(12, 2) not null default 0 check (bonus_caixinha >= 0),
  bonus_conclui numeric(12, 2) not null default 0 check (bonus_conclui >= 0),
  desc_faltas numeric(12, 2) not null default 0 check (desc_faltas >= 0),
  desc_atrasos numeric(12, 2) not null default 0 check (desc_atrasos >= 0),
  inss numeric(12, 2) not null default 0 check (inss >= 0),
  desc_vt numeric(12, 2) not null default 0 check (desc_vt >= 0),
  observacao text,
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default (eu()).id references funcionarios (id),
  primary key (funcionario_id, mes)
);

alter table salarios enable row level security;
create policy "gestao ve salarios, pessoa ve o seu liberado" on salarios for select
  using (sou_gestao() or (funcionario_id = (eu()).id and liberado));
create policy "gestao lanca salarios" on salarios for insert with check (sou_gestao());
create policy "gestao corrige salarios" on salarios for update using (sou_gestao()) with check (sou_gestao());
create policy "gestao apaga salarios" on salarios for delete using (sou_gestao());
