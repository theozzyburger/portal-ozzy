-- Férias por período aquisitivo, 13º, folga de feriado e advertência/suspensão com documento para imprimir (pedido de 07/10).
-- Os períodos (aquisitivo e concessivo) são calculados no app a partir da admissão; aqui ficam só os gozos.

create table ferias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  aquisitivo_inicio date not null,
  inicio date not null,
  dias int not null check (dias between 1 and 30),
  abono_dias int not null default 0 check (abono_dias between 0 and 10),
  observacao text,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on ferias (funcionario_id);

alter table ferias enable row level security;
create policy "gestao ve ferias" on ferias for select using (sou_gestao());
create policy "gestao registra ferias" on ferias for insert with check (posso_alterar(funcionario_id));
create policy "gestao apaga ferias" on ferias for delete using (posso_alterar(funcionario_id));

alter type tipo_ocorrencia add value if not exists 'suspensao';
alter table ocorrencias add column natureza text;
alter table ocorrencias add column suspensao_inicio date;
alter table ocorrencias add column suspensao_dias int check (suspensao_dias between 1 and 30);

-- 13º salário: registro de cada parcela paga (a 1ª pode ser adiantada).
create table decimo_terceiro (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  ano int not null check (ano between 2020 and 2100),
  parcela int not null check (parcela in (1, 2)),
  valor numeric(12, 2) not null check (valor >= 0),
  pago_em date not null,
  observacao text,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now(),
  unique (funcionario_id, ano, parcela)
);

alter table decimo_terceiro enable row level security;
create policy "gestao ve 13" on decimo_terceiro for select using (sou_gestao());
create policy "gestao registra 13" on decimo_terceiro for insert with check (posso_alterar(funcionario_id));
create policy "gestao apaga 13" on decimo_terceiro for delete using (posso_alterar(funcionario_id));

-- Folga normal ou folga de feriado (aparece com outra cor no calendário).
alter table folgas add column tipo text not null default 'normal' check (tipo in ('normal', 'feriado'));
create policy "gestao muda folga" on folgas for update using (sou_gestao()) with check (sou_gestao());
