-- Data de nascimento (mensagem de aniversário), contrato de experiência e checklist de desligamento (pedido de 07/10).

alter table funcionarios add column data_nascimento date;
-- Contrato de experiência: dias do 1º e do 2º período, contados da admissão. Nulo = sem contrato de experiência.
-- Padrão da casa: 10 + 80 (90 dias no total), mas cada cadastro pode ter o seu.
alter table funcionarios add column experiencia_dias1 int check (experiencia_dias1 between 1 and 90);
alter table funcionarios add column experiencia_dias2 int check (experiencia_dias2 between 0 and 89);
alter table funcionarios add constraint experiencia_ate_90 check (coalesce(experiencia_dias1, 0) + coalesce(experiencia_dias2, 0) <= 90);

-- Checklist de desligamento: uma linha por desligamento; os itens marcados ficam em "itens" ({chave: {por, em}}).
create table desligamentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('sem_justa_causa', 'justa_causa', 'pedido', 'acordo', 'fim_experiencia', 'antecipacao_experiencia')),
  itens jsonb not null default '{}',
  observacao text,
  concluido boolean not null default false,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on desligamentos (funcionario_id);

alter table desligamentos enable row level security;
create policy "gestao ve desligamentos" on desligamentos for select using (sou_gestao());
create policy "gestao abre desligamento" on desligamentos for insert with check (posso_alterar(funcionario_id));
create policy "gestao atualiza desligamento" on desligamentos for update using (posso_alterar(funcionario_id)) with check (posso_alterar(funcionario_id));
create policy "gestao apaga desligamento" on desligamentos for delete using (posso_alterar(funcionario_id));
