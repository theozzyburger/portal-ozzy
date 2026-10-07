-- Turnos-padrão (horários do Cronograma 2026) e assinatura do regulamento interno.

-- dias: 7 posições, de segunda a domingo. Cada uma é null (folga) ou
-- {"inicio": "HH:MM", "fim": "HH:MM", "pausaMin": 60}. Fim menor que o início = vira a noite.
create table turnos (
  id text primary key,
  local text not null, -- id da loja, 'producao' ou 'escritorio'
  nome text not null,
  dias jsonb not null check (jsonb_typeof(dias) = 'array' and jsonb_array_length(dias) = 7),
  ordem int not null default 0
);

alter table turnos enable row level security;
create policy "todos veem turnos" on turnos for select using ((eu()).id is not null);
create policy "gestao cria turnos" on turnos for insert with check (sou_gestao());
create policy "gestao edita turnos" on turnos for update using (sou_gestao()) with check (sou_gestao());

alter table funcionarios add column turno_id text references turnos (id) on delete set null;

insert into turnos (id, local, nome, ordem, dias) values
  ('t-psd-manha', 'burger-psd', 'Manhã', 1, '[null, null, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"09:00","fim":"18:45","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}]'),
  ('t-psd-cozinha', 'burger-psd', 'Cozinha (noite)', 2, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}]'),
  ('t-psd-atendimento', 'burger-psd', 'Atendimento (noite)', 3, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"14:45","fim":"00:30","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}]'),
  ('t-va-cozinha', 'burger-va', 'Cozinha', 4, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:00","fim":"23:45","pausaMin":120}, {"inicio":"14:00","fim":"23:45","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}]'),
  ('t-va-atendimento', 'burger-va', 'Atendimento', 5, '[null, null, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}, {"inicio":"14:00","fim":"23:45","pausaMin":120}, {"inicio":"11:30","fim":"22:15","pausaMin":60}, {"inicio":"13:30","fim":"23:15","pausaMin":60}]'),
  ('t-pizza-cozinha', 'pizza', 'Cozinha', 6, '[null, null, {"inicio":"13:15","fim":"23:00","pausaMin":60}, {"inicio":"13:15","fim":"23:00","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}, {"inicio":"13:45","fim":"23:30","pausaMin":60}, {"inicio":"13:15","fim":"23:00","pausaMin":60}]'),
  ('t-producao', 'producao', 'Produção', 7, '[null, null, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}, {"inicio":"08:00","fim":"17:45","pausaMin":60}]'),
  ('t-escritorio', 'escritorio', 'Escritório', 8, '[{"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, {"inicio":"08:30","fim":"17:45","pausaMin":30}, null, null]'),
  ('t-manutencao', 'escritorio', 'Manutenção', 9, '[{"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, {"inicio":"10:00","fim":"19:45","pausaMin":60}, null, null]');

-- Regulamento: uma assinatura por pessoa e versão. Ninguém edita nem apaga.
create table regulamento_leituras (
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  versao text not null,
  assinatura text not null, -- PNG em base64
  assinado_em timestamptz not null default now(),
  primary key (funcionario_id, versao)
);

alter table regulamento_leituras enable row level security;
create policy "ver assinaturas do regulamento" on regulamento_leituras for select
  using (funcionario_id = (eu()).id or sou_gestao());
create policy "assino o regulamento" on regulamento_leituras for insert
  with check (funcionario_id = (eu()).id);
