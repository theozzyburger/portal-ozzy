-- Atualização de 07/10: Lucro Fácil (0009) + Pix e freelancers (0010).
-- Rode uma vez: SQL Editor > New query > colar tudo > Run.

-- Dados copiados do Lucro Fácil por uma rotina automática (fichas técnicas e resultado do mês).
-- Quem escreve é a importação (.github/workflows/importar-lucro.yml), conectada como dona do banco;
-- pelo portal estas tabelas são só leitura.

-- Fichas técnicas: todos veem os insumos e quantidades.
create table lf_fichas (
  produto_id integer primary key,
  nome text not null,
  categoria text,
  -- Preparo = base usada dentro de outras fichas (molhos, massas, bases de pizza).
  preparo boolean not null default false,
  -- [{nome, unidade, qtd, tamanho, preparoId}]
  itens jsonb not null default '[]'
);

-- Custos das fichas: só a gestão (Gerente para cima).
create table lf_fichas_custo (
  produto_id integer primary key references lf_fichas on delete cascade,
  custo numeric(12, 4) not null default 0,
  preco numeric(12, 2) not null default 0,
  -- [{custoUnit, total}] na mesma ordem dos itens da ficha.
  itens jsonb not null default '[]'
);

-- Resultado (DRE) do mês por loja: só Proprietário e Administrativo.
create table lf_resultados (
  unidade_id text not null references unidades (id),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  pedidos integer not null default 0,
  faturamento numeric(14, 2) not null default 0,
  cmv numeric(14, 2) not null default 0,
  impostos numeric(14, 2) not null default 0,
  comissoes numeric(14, 2) not null default 0,
  taxas_pagamento numeric(14, 2) not null default 0,
  custos_operacionais numeric(14, 2) not null default 0,
  lucro_operacional numeric(14, 2) not null default 0,
  ticket_medio numeric(10, 2) not null default 0,
  primary key (unidade_id, mes)
);

-- Quando cada conjunto de dados foi copiado pela última vez.
create table lf_sincronizacao (
  dado text primary key,
  em timestamptz not null default now()
);

create function vejo_resultado() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select nivel::text in ('administrativo', 'proprietario') from eu()), false)
$$;

alter table lf_fichas enable row level security;
alter table lf_fichas_custo enable row level security;
alter table lf_resultados enable row level security;
alter table lf_sincronizacao enable row level security;

create policy "todos leem fichas" on lf_fichas for select using ((eu()).id is not null);
create policy "gestao le custos" on lf_fichas_custo for select using (sou_gestao());
create policy "direcao le resultados" on lf_resultados for select using (vejo_resultado());
create policy "todos leem sincronizacao" on lf_sincronizacao for select using ((eu()).id is not null);

-- Recebe o arquivo gerado pela rotina. Cada parte presente substitui a anterior:
--   fichas: [{id, nome, categoria, preparo, custo, preco, itens: [{nome, unidade, qtd, tamanho, preparoId, custoUnit}]}]
--   resultados: [{unidade, mes, pedidos, faturamento, cmv, impostos, comissoes, taxasPagamento, custosOperacionais, lucroOperacional, ticketMedio}]
create function lf_importar(dados jsonb) returns text
language plpgsql set search_path = public as $$
declare
  n_fichas integer := 0;
  n_resultados integer := 0;
begin
  if jsonb_typeof(dados -> 'fichas') = 'array' and jsonb_array_length(dados -> 'fichas') > 0 then
    delete from lf_fichas;
    insert into lf_fichas (produto_id, nome, categoria, preparo, itens)
    select (f ->> 'id')::integer, f ->> 'nome', nullif(f ->> 'categoria', ''), coalesce((f ->> 'preparo')::boolean, false),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'nome', i ->> 'nome', 'unidade', i ->> 'unidade', 'qtd', (i ->> 'qtd')::numeric,
          'tamanho', nullif(i ->> 'tamanho', ''), 'preparoId', (i ->> 'preparoId')::integer) order by o)
        from jsonb_array_elements(f -> 'itens') with ordinality as x (i, o)
      ), '[]')
    from jsonb_array_elements(dados -> 'fichas') f;
    get diagnostics n_fichas = row_count;

    insert into lf_fichas_custo (produto_id, custo, preco, itens)
    select (f ->> 'id')::integer, coalesce((f ->> 'custo')::numeric, 0), coalesce((f ->> 'preco')::numeric, 0),
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'custoUnit', coalesce((i ->> 'custoUnit')::numeric, 0),
          'total', round(coalesce((i ->> 'custoUnit')::numeric, 0) * coalesce((i ->> 'qtd')::numeric, 0), 4)) order by o)
        from jsonb_array_elements(f -> 'itens') with ordinality as x (i, o)
      ), '[]')
    from jsonb_array_elements(dados -> 'fichas') f;

    insert into lf_sincronizacao (dado, em) values ('fichas', now())
    on conflict (dado) do update set em = excluded.em;
  end if;

  if jsonb_typeof(dados -> 'resultados') = 'array' and jsonb_array_length(dados -> 'resultados') > 0 then
    insert into lf_resultados (unidade_id, mes, pedidos, faturamento, cmv, impostos, comissoes, taxas_pagamento,
      custos_operacionais, lucro_operacional, ticket_medio)
    select r ->> 'unidade', r ->> 'mes', coalesce((r ->> 'pedidos')::integer, 0),
      coalesce((r ->> 'faturamento')::numeric, 0), coalesce((r ->> 'cmv')::numeric, 0), coalesce((r ->> 'impostos')::numeric, 0),
      coalesce((r ->> 'comissoes')::numeric, 0), coalesce((r ->> 'taxasPagamento')::numeric, 0),
      coalesce((r ->> 'custosOperacionais')::numeric, 0), coalesce((r ->> 'lucroOperacional')::numeric, 0),
      coalesce((r ->> 'ticketMedio')::numeric, 0)
    from jsonb_array_elements(dados -> 'resultados') r
    on conflict (unidade_id, mes) do update set
      pedidos = excluded.pedidos, faturamento = excluded.faturamento, cmv = excluded.cmv, impostos = excluded.impostos,
      comissoes = excluded.comissoes, taxas_pagamento = excluded.taxas_pagamento,
      custos_operacionais = excluded.custos_operacionais, lucro_operacional = excluded.lucro_operacional,
      ticket_medio = excluded.ticket_medio;
    get diagnostics n_resultados = row_count;

    insert into lf_sincronizacao (dado, em) values ('resultados', now())
    on conflict (dado) do update set em = excluded.em;
  end if;

  return format('%s fichas, %s resultados', n_fichas, n_resultados);
end;
$$;

revoke execute on function lf_importar(jsonb) from public, anon, authenticated;

-- Pix de cada funcionário e controle de freelancers (pedido de 07/10).

alter table funcionarios add column pix text;

-- Freelancers: cadastro e diárias. Só a gestão (Gerente, Administrativo, Proprietário) vê e lança:
-- CPF e Pix são dados pessoais.
create table freelancers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  pix text not null,
  celular text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references funcionarios (id)
);

create unique index freelancers_cpf on freelancers (cpf);

-- Cada dia trabalhado. Semana de segunda a domingo, paga na segunda seguinte.
create table freela_diarias (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references freelancers (id),
  data date not null,
  turno text not null check (turno in ('manha', 'noite')),
  unidade_id text not null references unidades (id),
  funcao text not null,
  valor numeric(10, 2) not null check (valor >= 0),
  observacao text,
  lancado_por uuid references funcionarios (id) default (eu()).id,
  lancado_em timestamptz not null default now(),
  unique (freelancer_id, data, turno)
);

create index freela_diarias_data on freela_diarias (data);

-- Pagamento da semana: quem marcou e quando (uma linha por freelancer por semana).
create table freela_pagamentos (
  freelancer_id uuid not null references freelancers (id),
  semana date not null check (extract(isodow from semana) = 1),
  valor numeric(10, 2) not null,
  pago_em timestamptz not null default now(),
  pago_por uuid references funcionarios (id) default (eu()).id,
  primary key (freelancer_id, semana)
);

alter table freelancers enable row level security;
alter table freela_diarias enable row level security;
alter table freela_pagamentos enable row level security;

create policy "gestao le freelancers" on freelancers for select using (sou_gestao());
create policy "gestao cadastra freelancers" on freelancers for insert with check (sou_gestao());
create policy "gestao altera freelancers" on freelancers for update using (sou_gestao());

create policy "gestao le diarias" on freela_diarias for select using (sou_gestao());
create policy "gestao lanca diarias" on freela_diarias for insert with check (sou_gestao());
create policy "gestao altera diarias" on freela_diarias for update using (sou_gestao());
create policy "gestao apaga diarias" on freela_diarias for delete using (sou_gestao());

create policy "gestao le pagamentos" on freela_pagamentos for select using (sou_gestao());
create policy "gestao marca pagamentos" on freela_pagamentos for insert with check (sou_gestao());
create policy "gestao desfaz pagamentos" on freela_pagamentos for delete using (sou_gestao());
