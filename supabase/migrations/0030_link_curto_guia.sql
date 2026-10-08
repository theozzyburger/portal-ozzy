-- 0030: link curto para a guia de exame mandada no WhatsApp (pedido de 08/10).
-- O PDF vai para um bucket público com nome aleatório de 12 letras (ninguém consegue listar o bucket, só abre
-- quem tem o link). O portal só redireciona enquanto o link vale (7 dias).
insert into storage.buckets (id, name, public) values ('guias', 'guias', true) on conflict (id) do nothing;
create policy "gestao publica guia" on storage.objects for insert to authenticated
  with check (bucket_id = 'guias' and sou_gestao());

create table links_guia (
  codigo text primary key check (codigo ~ '^[A-Za-z0-9]{12}$'),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  expira_em timestamptz not null,
  criado_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);
alter table links_guia enable row level security;
create policy "gestao cria link de guia" on links_guia for insert with check (sou_gestao() and criado_por = (eu()).id);
create policy "gestao ve links de guia" on links_guia for select using (sou_gestao());

-- Página pública do link: só diz se ainda vale.
create function guia_valida(p_codigo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from links_guia where codigo = p_codigo and expira_em > now())
$$;
grant execute on function guia_valida(text) to anon, authenticated;
