-- Eventos, Entrega 1 (pedido de 08/10): cadastro de eventos com status, dias de funcionamento,
-- operações participantes, responsáveis, condições comerciais, repasse e histórico de mudanças.
-- Só a gestão vê e edita. Só cria tabelas novas: nada do que já existe muda.

-- Operações gastronômicas que vão aos eventos (marcas). Não são as lojas.
create table operacoes (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  nome text not null check (length(trim(nome)) > 0),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
insert into operacoes (id, nome) values ('burger', 'The Ozzy Burger'), ('pizza', 'The Ozzy Pizza');

create table eventos (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  nome text not null check (length(trim(nome)) > 0),
  status text not null default 'negociacao'
    check (status in ('negociacao', 'planejamento', 'aprovado', 'preparacao', 'execucao', 'finalizado', 'cancelado')),
  -- Motivo da última troca de status (obrigatório para cancelar; vai para o histórico).
  status_motivo text,
  tipo text,
  organizador text,
  organizador_contato text,
  local text,
  endereco text,
  publico_estimado int check (publico_estimado >= 0),
  -- Horário local de São Paulo, sem fuso.
  montagem_inicio timestamp,
  montagem_fim timestamp,
  desmontagem_inicio timestamp,
  desmontagem_fim timestamp,
  -- Condições comerciais. A taxa do organizador é descontada antes do repasse e NÃO é imposto:
  -- tributos terão regra própria, configurável (Entrega 6).
  taxa_organizador_pct numeric(5, 2) check (taxa_organizador_pct between 0 and 100),
  valor_fixo numeric(12, 2) check (valor_fixo >= 0), -- cota, aluguel do espaço ou taxa de inscrição
  condicoes text,
  -- Quem recebe as vendas: o organizador (e repassa o líquido) ou a própria The Ozzy (e paga a taxa).
  quem_recebe text check (quem_recebe in ('organizador', 'the_ozzy')),
  repasse_prazo_dias int check (repasse_prazo_dias between 0 and 365),
  repasse_obs text,
  infraestrutura text,
  observacao text,
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now(),
  atualizado_por uuid references funcionarios (id),
  atualizado_em timestamptz not null default now(),
  check (montagem_fim is null or montagem_inicio is null or montagem_fim >= montagem_inicio),
  check (desmontagem_fim is null or desmontagem_inicio is null or desmontagem_fim >= desmontagem_inicio)
);

-- Dias de funcionamento (a previsão de vendas vai ser por dia).
create table evento_dias (
  evento_id uuid not null references eventos (id) on delete cascade,
  data date not null,
  abre time,
  fecha time, -- pode ser antes de "abre" quando passa da meia-noite
  primary key (evento_id, data)
);

create table evento_operacoes (
  evento_id uuid not null references eventos (id) on delete cascade,
  operacao_id text not null references operacoes (id),
  primary key (evento_id, operacao_id)
);

create table evento_responsaveis (
  evento_id uuid not null references eventos (id) on delete cascade,
  funcionario_id uuid not null references funcionarios (id),
  papel text,
  primary key (evento_id, funcionario_id)
);
create index on evento_responsaveis (funcionario_id);

-- Histórico (auditoria): criação, troca de status e quais dados mudaram, com quem e quando.
create table evento_historico (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  em timestamptz not null default now(),
  por uuid references funcionarios (id),
  tipo text not null check (tipo in ('criado', 'status', 'dados')),
  de text,
  para text,
  campos text[],
  motivo text
);
create index on evento_historico (evento_id, em);

create or replace function eventos_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := (eu()).id;
  return new;
end $$;

create trigger eventos_carimbo before insert or update on eventos
  for each row execute function eventos_carimbo();

create or replace function eventos_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mudou text[];
begin
  if tg_op = 'INSERT' then
    insert into evento_historico (evento_id, por, tipo, para) values (new.id, (eu()).id, 'criado', new.status);
    return null;
  end if;
  if new.status is distinct from old.status then
    insert into evento_historico (evento_id, por, tipo, de, para, motivo)
    values (new.id, (eu()).id, 'status', old.status, new.status, new.status_motivo);
  end if;
  select array_agg(n.key order by n.key) into mudou
  from jsonb_each(to_jsonb(new)) n
  where n.value is distinct from (to_jsonb(old) -> n.key)
    and n.key not in ('status', 'status_motivo', 'atualizado_em', 'atualizado_por');
  if mudou is not null then
    insert into evento_historico (evento_id, por, tipo, campos) values (new.id, (eu()).id, 'dados', mudou);
  end if;
  return null;
end $$;

create trigger eventos_historico after insert or update on eventos
  for each row execute function eventos_historico();

alter table operacoes enable row level security;
alter table eventos enable row level security;
alter table evento_dias enable row level security;
alter table evento_operacoes enable row level security;
alter table evento_responsaveis enable row level security;
alter table evento_historico enable row level security;

create policy "gestao ve operacoes" on operacoes for select using (sou_gestao());
create policy "gestao edita operacoes" on operacoes for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve eventos" on eventos for select using (sou_gestao());
create policy "gestao edita eventos" on eventos for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve dias do evento" on evento_dias for select using (sou_gestao());
create policy "gestao edita dias do evento" on evento_dias for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve operacoes do evento" on evento_operacoes for select using (sou_gestao());
create policy "gestao edita operacoes do evento" on evento_operacoes for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve responsaveis do evento" on evento_responsaveis for select using (sou_gestao());
create policy "gestao edita responsaveis do evento" on evento_responsaveis for all using (sou_gestao()) with check (sou_gestao());
-- O histórico só é escrito pelo gatilho; ninguém altera pela tela.
create policy "gestao ve historico do evento" on evento_historico for select using (sou_gestao());
