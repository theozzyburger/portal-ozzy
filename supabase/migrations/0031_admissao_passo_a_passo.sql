-- 0031: passo a passo da admissão (pedido de 08/10). Guarda as etapas marcadas à mão (quem e quando);
-- as automáticas (cadastro completo, exame anexado, uniforme, turno, regulamento) o portal calcula sozinho.
create table admissoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data_admissao date not null,
  itens jsonb not null default '{}',     -- { chave: { por, em } }
  concluido boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (funcionario_id, data_admissao)
);
alter table admissoes enable row level security;
create policy "gestao ve admissoes" on admissoes for select using (sou_gestao());
create policy "gestao cria admissao" on admissoes for insert with check (sou_gestao());
create policy "gestao marca admissao" on admissoes for update using (sou_gestao()) with check (sou_gestao());
