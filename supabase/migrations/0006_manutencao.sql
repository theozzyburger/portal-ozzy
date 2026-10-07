-- Chamados de manutenção e o acesso "Manutenção" (manutencista), pedidos em 07/10.
-- Qualquer pessoa abre chamado; o manutencista e a gestão veem os de todas as lojas e mudam o andamento.

alter type nivel_acesso add value if not exists 'manutencao';
alter type setor_trabalho add value if not exists 'manutencao';

create function atendo_chamados() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel::text in ('manutencao', 'gerente', 'administrativo', 'proprietario') from eu()), false)
$$;

create type gravidade_chamado as enum ('urgente', 'importante', 'simples');
create type categoria_chamado as enum
  ('equipamento', 'refrigeracao', 'eletrica', 'hidraulica', 'gas', 'reforma', 'computador', 'internet', 'moveis', 'outro');
create type status_chamado as enum ('aberto', 'andamento', 'aguardando', 'resolvido', 'cancelado');

create table chamados (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  unidade_id text not null references unidades (id),
  categoria categoria_chamado not null,
  gravidade gravidade_chamado not null,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text not null default '',
  local text,
  foto text, -- caminho no bucket "chamados"
  status status_chamado not null default 'aberto',
  aberto_por uuid not null references funcionarios (id),
  aberto_em timestamptz not null default now(),
  responsavel_id uuid references funcionarios (id),
  fechado_em timestamptz
);

-- Quem abriu, data e hora vêm do login e do relógio do servidor, nunca do formulário.
create function preparar_chamado() returns trigger
language plpgsql as $$
begin
  new.aberto_por := (eu()).id;
  new.aberto_em := now();
  new.status := 'aberto';
  new.responsavel_id := null;
  new.fechado_em := null;
  return new;
end $$;
create trigger antes_de_abrir before insert on chamados for each row execute function preparar_chamado();

create table chamado_eventos (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references chamados (id) on delete cascade,
  autor_id uuid not null references funcionarios (id),
  em timestamptz not null default now(),
  texto text,
  status status_chamado -- preenchido quando o evento mudou o andamento
);

create function vejo_chamado(c chamados) returns boolean
language sql stable security definer set search_path = public as $$
  select atendo_chamados() or c.aberto_por = (eu()).id or c.unidade_id = (eu()).unidade_id
$$;

alter table chamados enable row level security;
create policy "ver chamados" on chamados for select using (vejo_chamado(chamados));
create policy "abrir chamado" on chamados for insert with check ((eu()).id is not null);
-- Sem update/delete direto: o andamento muda só pela função abaixo, que deixa histórico.

alter table chamado_eventos enable row level security;
create policy "ver historico" on chamado_eventos for select
  using (exists (select 1 from chamados c where c.id = chamado_id and vejo_chamado(c)));

-- Comentar (qualquer um que vê o chamado) e mudar o andamento (manutenção e gestão).
create function atualizar_chamado(chamado uuid, novo_status status_chamado, comentario text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c chamados;
  quem funcionarios := eu();
begin
  select * into c from chamados where id = chamado;
  if c.id is null or quem.id is null or not vejo_chamado(c) then
    raise exception 'Chamado não encontrado.';
  end if;
  if novo_status is not null then
    if not atendo_chamados() then
      raise exception 'Só a manutenção e a gestão mudam o andamento.';
    end if;
    update chamados set
      status = novo_status,
      responsavel_id = coalesce(responsavel_id, case when quem.nivel::text = 'manutencao' then quem.id end),
      fechado_em = case when novo_status in ('resolvido', 'cancelado') then now() end
    where id = chamado;
  elsif coalesce(trim(comentario), '') = '' then
    return;
  end if;
  insert into chamado_eventos (chamado_id, autor_id, texto, status)
    values (chamado, quem.id, nullif(trim(comentario), ''), novo_status);
end $$;

-- Fotos dos chamados: bucket privado, uma pasta por loja.
insert into storage.buckets (id, name, public) values ('chamados', 'chamados', false);
create policy "ver fotos de chamados" on storage.objects for select using (bucket_id = 'chamados' and (eu()).id is not null);
create policy "enviar fotos de chamados" on storage.objects for insert with check (bucket_id = 'chamados' and (eu()).id is not null);
