-- Painel da gestão: pedidos/faturamento por dia, loja e canal, e notas no iFood e 99Food.
-- Estas tabelas vão ser preenchidas pela integração com o PDV e com as plataformas.
-- Só Proprietário e Gerente leem (decisão de 06/10); a escrita é feita pela integração (service role).

create type canal_venda as enum ('salao', 'ifood', 'proprio', '99food');
create type plataforma_delivery as enum ('ifood', '99food');

create table vendas_diarias (
  unidade_id text not null references unidades (id),
  data date not null,
  canal canal_venda not null,
  pedidos integer not null default 0,
  faturamento numeric(12, 2) not null default 0,
  primary key (unidade_id, data, canal)
);

create table avaliacoes (
  unidade_id text not null references unidades (id),
  plataforma plataforma_delivery not null,
  nota numeric(2, 1) not null,
  total_avaliacoes integer not null default 0,
  nota_ha_30_dias numeric(2, 1),
  atualizado_em timestamptz not null default now(),
  primary key (unidade_id, plataforma)
);

create function vejo_painel() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel in ('gerente', 'proprietario') from eu()), false)
$$;

alter table vendas_diarias enable row level security;
alter table avaliacoes enable row level security;

create policy "painel le vendas" on vendas_diarias for select using (vejo_painel());
create policy "painel le avaliacoes" on avaliacoes for select using (vejo_painel());
