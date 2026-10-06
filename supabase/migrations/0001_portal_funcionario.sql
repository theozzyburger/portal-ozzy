-- Portal The Ozzy: RH, documentos, ocorrências, comunicados e folgas.
-- As regras de acesso ficam no banco (RLS), então valem mesmo se alguém tentar burlar o app.
-- Funcionário e Supervisor só visualizam; Gerente, Administrativo e Proprietário gerenciam.

create type nivel_acesso as enum ('funcionario', 'supervisor', 'gerente', 'administrativo', 'proprietario');
create type status_funcionario as enum ('ativo', 'inativo');
create type tipo_documento as enum ('atestado', 'contrato', 'documento_pessoal', 'exame', 'outro');
create type tipo_ocorrencia as enum ('falta', 'atraso', 'advertencia', 'orientacao', 'elogio', 'outro');

create table unidades (
  id text primary key,
  nome text not null
);

insert into unidades (id, nome) values
  ('burger-psd', 'The Ozzy Burger Parque São Domingos'),
  ('burger-va', 'The Ozzy Burger Vila Anastácio'),
  ('pizza', 'The Ozzy Pizza');

create table funcionarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  nome text not null,
  celular text not null unique,
  cargo text not null,
  unidade_id text not null references unidades (id),
  nivel nivel_acesso not null default 'funcionario',
  status status_funcionario not null default 'ativo',
  data_admissao date not null,
  data_desligamento date,
  responde_para uuid references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipo tipo_documento not null,
  nome_arquivo text not null,
  caminho text not null,
  observacao text,
  inicio date,
  fim date,
  enviado_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table ocorrencias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  tipo tipo_ocorrencia not null,
  data date not null,
  descricao text not null,
  registrado_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo text not null,
  unidade_id text references unidades (id), -- null = todas as unidades
  autor_id uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);

create table comunicado_leituras (
  comunicado_id uuid not null references comunicados (id) on delete cascade,
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (comunicado_id, funcionario_id)
);

create table folgas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  unique (funcionario_id, data)
);

-- Quem está logado. security definer para não cair em recursão nas políticas.
create function eu() returns funcionarios
language sql stable security definer set search_path = public as $$
  select * from funcionarios where auth_user_id = auth.uid() and status = 'ativo'
$$;

create function sou_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel in ('gerente', 'administrativo', 'proprietario') from eu()), false)
$$;

create function posso_ver_funcionario(alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from funcionarios f, eu() e
    where f.id = alvo
      and (f.id = e.id
        or e.nivel in ('gerente', 'administrativo', 'proprietario')
        or (e.nivel = 'supervisor' and e.unidade_id = f.unidade_id))
  )
$$;

-- Nomes de todos (sem outros dados), para qualquer logado ver quem publicou um aviso.
create function nomes_funcionarios() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select f.id, f.nome from funcionarios f where (eu()).id is not null
$$;

alter table unidades enable row level security;
alter table funcionarios enable row level security;
alter table documentos enable row level security;
alter table ocorrencias enable row level security;
alter table comunicados enable row level security;
alter table comunicado_leituras enable row level security;
alter table folgas enable row level security;

create policy "logados veem unidades" on unidades for select using ((eu()).id is not null);

create policy "ver funcionarios" on funcionarios for select using (posso_ver_funcionario(id));
create policy "gestao cadastra" on funcionarios for insert with check (sou_gestao());
create policy "gestao edita" on funcionarios for update using (sou_gestao()) with check (sou_gestao());

-- Documentos: só o próprio funcionário e a gestão (dados sensíveis, LGPD).
create policy "ver documentos" on documentos for select
  using (funcionario_id = (eu()).id or sou_gestao());
create policy "enviar documentos" on documentos for insert
  with check (enviado_por = (eu()).id and (funcionario_id = (eu()).id or sou_gestao()));

create policy "ver ocorrencias" on ocorrencias for select using (posso_ver_funcionario(funcionario_id));
create policy "gestao registra ocorrencias" on ocorrencias for insert
  with check (sou_gestao() and registrado_por = (eu()).id);

create policy "ver comunicados" on comunicados for select
  using (unidade_id is null or unidade_id = (eu()).unidade_id or sou_gestao());
create policy "gestao publica" on comunicados for insert with check (sou_gestao() and autor_id = (eu()).id);

create policy "ver leituras" on comunicado_leituras for select
  using (funcionario_id = (eu()).id or sou_gestao());
create policy "marcar lido" on comunicado_leituras for insert with check (funcionario_id = (eu()).id);

create policy "ver folgas" on folgas for select using (posso_ver_funcionario(funcionario_id));
create policy "gestao marca folga" on folgas for insert with check (sou_gestao());
create policy "gestao remove folga" on folgas for delete using (sou_gestao());

-- Arquivos ficam num bucket privado, numa pasta por funcionário: documentos/<funcionario_id>/<arquivo>.
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);

create policy "ler arquivos" on storage.objects for select using (
  bucket_id = 'documentos'
  and ((storage.foldername(name))[1] = (eu()).id::text or sou_gestao())
);
create policy "enviar arquivos" on storage.objects for insert with check (
  bucket_id = 'documentos'
  and ((storage.foldername(name))[1] = (eu()).id::text or sou_gestao())
);
