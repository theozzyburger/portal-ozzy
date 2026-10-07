-- Caixinha: setor de cada funcionário (grupos de bônus) e total arrecadado por mês e loja.
-- As regras de divisão ficam no app (src/lib/caixinha.ts), iguais às da planilha.

create type setor_trabalho as enum ('cozinha', 'atendimento', 'producao', 'unidade', 'geral');
alter table funcionarios add column setor setor_trabalho;

create table caixinha_mensal (
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  unidade_id text not null references unidades (id),
  total numeric(12, 2) not null default 0,
  primary key (mes, unidade_id)
);

alter table caixinha_mensal enable row level security;
create policy "gestao ve caixinha" on caixinha_mensal for select using (sou_gestao());
create policy "gestao lanca caixinha" on caixinha_mensal for insert with check (sou_gestao());
create policy "gestao corrige caixinha" on caixinha_mensal for update using (sou_gestao()) with check (sou_gestao());
