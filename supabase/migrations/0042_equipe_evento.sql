-- Equipe do evento (Heitor, 09/10): quem trabalha em cada evento, com a função e o lugar dentro da barraca.
-- A barraca é uma grade 3x3 (posição 0 a 8, linha de cima = frente, onde ficam os clientes).
-- A pessoa pode ser da equipe (funcionário), da base de freelas de eventos ou alguém sem cadastro (só o nome).
-- Só acrescenta tabela e coluna: nada do que já existe muda.

create table evento_equipe (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  funcionario_id uuid references funcionarios (id),
  freela_id uuid references freelas_evento (id),
  nome text, -- só para quem não tem cadastro
  funcao text,
  barraca int not null default 1 check (barraca between 1 and 20),
  posicao int check (posicao between 0 and 8), -- vazio = ainda sem lugar
  observacao text,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  check (num_nonnulls(funcionario_id, freela_id, nullif(trim(nome), '')) = 1)
);
create unique index on evento_equipe (evento_id, funcionario_id) where funcionario_id is not null;
create unique index on evento_equipe (evento_id, freela_id) where freela_id is not null;
create index on evento_equipe (evento_id);

-- Nome de cada quadrado da barraca (ex.: "Caixa", "Forno"), por barraca: {"1": {"0": "Caixa", ...}}.
alter table eventos add column layout_barracas jsonb not null default '{}';

alter table evento_equipe enable row level security;
create policy "gestao edita equipe do evento" on evento_equipe for all using (sou_gestao()) with check (sou_gestao());
create policy "escalados veem a equipe do evento" on evento_equipe for select using (sou_responsavel_evento(evento_id));
