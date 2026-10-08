-- Eventos, Entregas 2 e 3 (08/10): cadastro único de fornecedores, insumos e fichas técnicas de eventos.
-- Fichas têm versões: salvar uma alteração cria uma versão nova e as antigas ficam como estavam,
-- para os eventos que já usaram uma versão. Item de ficha pode ser um insumo ou outra ficha (pré-preparo).
-- Só a gestão vê e edita. Só cria tabelas novas: nada do que já existe muda.

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  contato text,
  telefone text,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index on fornecedores (lower(nome));

create table insumos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  categoria text,
  -- Unidade em que a ficha usa e em que o preço é dado (o preço é sempre por 1 unidade desta).
  unidade text not null default 'kg' check (unidade in ('kg', 'l', 'un')),
  -- Como se compra: nome da embalagem e quantas unidades vêm nela (ex.: fardo com 12 un).
  embalagem text,
  embalagem_qtd numeric(12, 3) check (embalagem_qtd > 0),
  preco numeric(12, 4) check (preco >= 0),
  preco_em timestamptz,
  fornecedor_id uuid references fornecedores (id),
  lf_ingrediente_id int, -- ingrediente equivalente no Lucro Fácil, para comparar preço
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index on insumos (lower(nome));

-- Histórico de preços (escrito pelo gatilho a cada mudança de preço).
create table insumo_precos (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references insumos (id) on delete cascade,
  preco numeric(12, 4),
  em timestamptz not null default now(),
  por uuid references funcionarios (id),
  origem text
);
create index on insumo_precos (insumo_id, em);

create or replace function insumos_preco() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.preco is distinct from old.preco then
    insert into insumo_precos (insumo_id, preco, por, origem)
    values (new.id, new.preco, (eu()).id, coalesce(nullif(current_setting('portal.origem_preco', true), ''), 'manual'));
  end if;
  return null;
end $$;

create or replace function insumos_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' or new.preco is distinct from old.preco then new.preco_em := now(); end if;
  return new;
end $$;

create trigger insumos_carimbo before insert or update on insumos for each row execute function insumos_carimbo();
create trigger insumos_preco after insert or update on insumos for each row execute function insumos_preco();

create table receitas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  -- produto = vendido no evento; preparo = usado dentro de outras fichas (molho, massa, recheio).
  tipo text not null check (tipo in ('produto', 'preparo')),
  linha text, -- Foca, Pizza, Romana, Bebidas…
  operacao_id text references operacoes (id),
  -- própria = fabricação nossa; revenda = compra pronta; terceirizada = alguém produz para nós.
  origem text not null default 'propria' check (origem in ('propria', 'revenda', 'terceirizada')),
  -- Unidade do que a ficha rende (o produto é sempre 'un').
  unidade text not null default 'un' check (unidade in ('kg', 'l', 'un')),
  preco_venda numeric(12, 2) check (preco_venda >= 0), -- preço padrão; cada evento pode ter o seu
  tempo_preparo_min int check (tempo_preparo_min >= 0),
  tempo_finalizacao_min int check (tempo_finalizacao_min >= 0),
  capacidade_hora int check (capacidade_hora >= 0),
  equipamentos text,
  conservacao text,
  validade_dias int check (validade_dias >= 0),
  ativo boolean not null default true,
  versao_atual int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index on receitas (lower(nome), tipo);

create table receita_versoes (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references receitas (id) on delete cascade,
  numero int not null,
  -- Quanto uma receita desta versão rende, na unidade da ficha.
  rendimento numeric(12, 4) not null default 1 check (rendimento > 0),
  -- Custo calculado quando a versão foi salva (os preços mudam; isto é a foto do dia).
  custo_total numeric(12, 4),
  nota text,
  criada_em timestamptz not null default now(),
  criada_por uuid default (eu()).id references funcionarios (id),
  unique (receita_id, numero)
);

create table receita_itens (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references receita_versoes (id) on delete cascade,
  ordem int not null default 0,
  insumo_id uuid references insumos (id),
  sub_receita_id uuid references receitas (id),
  -- Quantidade líquida usada, na unidade do insumo ou da ficha usada.
  quantidade numeric(12, 4) not null check (quantidade > 0),
  -- Aproveitamento (ex.: cenoura 0,85 = 15% vira casca). Comprar = quantidade ÷ aproveitamento.
  aproveitamento numeric(5, 4) not null default 1 check (aproveitamento > 0 and aproveitamento <= 1),
  check (num_nonnulls(insumo_id, sub_receita_id) = 1)
);
create index on receita_itens (versao_id);
create index on receita_itens (insumo_id);
create index on receita_itens (sub_receita_id);

-- Salva uma versão nova da ficha (itens em JSON) e passa a usá-la. Versões antigas não mudam.
create or replace function salvar_versao_receita(p_receita uuid, p_rendimento numeric, p_custo numeric, p_nota text, p_itens jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_num int;
  v_id uuid;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if exists (select 1 from jsonb_array_elements(p_itens) i where (i ->> 'sub_receita_id')::uuid = p_receita) then
    raise exception 'Uma ficha não pode usar ela mesma.';
  end if;
  select versao_atual + 1 into v_num from receitas where id = p_receita for update;
  if v_num is null then raise exception 'Ficha não encontrada.'; end if;
  insert into receita_versoes (receita_id, numero, rendimento, custo_total, nota)
  values (p_receita, v_num, p_rendimento, p_custo, nullif(trim(p_nota), '')) returning id into v_id;
  insert into receita_itens (versao_id, ordem, insumo_id, sub_receita_id, quantidade, aproveitamento)
  select v_id, ord, (i ->> 'insumo_id')::uuid, (i ->> 'sub_receita_id')::uuid, (i ->> 'quantidade')::numeric,
         coalesce((i ->> 'aproveitamento')::numeric, 1)
  from jsonb_array_elements(p_itens) with ordinality as t (i, ord);
  update receitas set versao_atual = v_num, atualizado_em = now() where id = p_receita;
  return v_num;
end $$;

alter table fornecedores enable row level security;
alter table insumos enable row level security;
alter table insumo_precos enable row level security;
alter table receitas enable row level security;
alter table receita_versoes enable row level security;
alter table receita_itens enable row level security;

create policy "gestao ve fornecedores" on fornecedores for select using (sou_gestao());
create policy "gestao edita fornecedores" on fornecedores for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve insumos" on insumos for select using (sou_gestao());
create policy "gestao edita insumos" on insumos for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao ve precos de insumos" on insumo_precos for select using (sou_gestao());
create policy "gestao ve receitas" on receitas for select using (sou_gestao());
create policy "gestao edita receitas" on receitas for all using (sou_gestao()) with check (sou_gestao());
-- Versões e itens só entram pela função salvar_versao_receita (nunca são alterados).
create policy "gestao ve versoes de receita" on receita_versoes for select using (sou_gestao());
create policy "gestao ve itens de receita" on receita_itens for select using (sou_gestao());
