-- Eventos, Entrega 4 e logística (08/10): cardápio, previsão e vendas por dia; checklist de separação
-- (o que sai da base para o evento), inventário diário de sobras (no evento) e contagem do estoque da base.
-- Quem está escalado como responsável do evento confere a separação e conta as sobras, mesmo sem ser da gestão.
-- Só acrescenta colunas e tabelas: nada do que já existe muda.

alter table eventos
  add column cidade text,
  add column gastronomia text, -- Italiano, Árabe, Coreano, Junina, Geral… (para comparar eventos parecidos)
  add column barracas numeric(4, 1) check (barracas >= 0),
  -- Folga que a sugestão de "quanto levar" põe em cima da previsão.
  add column margem_seguranca_pct numeric(5, 2) not null default 10 check (margem_seguranca_pct >= 0),
  add column dpen_nome text; -- nome do evento no sistema de caixa (DPEN), para importar vendas

-- Cardápio do evento: produtos e preço praticado neste evento.
create table evento_produtos (
  evento_id uuid not null references eventos (id) on delete cascade,
  receita_id uuid not null references receitas (id),
  preco numeric(12, 2) check (preco >= 0),
  ordem int not null default 0,
  primary key (evento_id, receita_id)
);

-- Previsão de vendas por dia e produto (planejado). Fica separada das vendas reais.
create table evento_previsao (
  evento_id uuid not null references eventos (id) on delete cascade,
  data date not null,
  receita_id uuid not null references receitas (id),
  quantidade numeric(12, 2) not null check (quantidade >= 0),
  primary key (evento_id, data, receita_id)
);

-- Vendas reais por dia e produto (importadas do DPEN ou lançadas). Produto sem ficha fica só com o nome.
create table evento_vendas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  data date not null,
  receita_id uuid references receitas (id),
  produto text not null,
  quantidade numeric(12, 2) not null check (quantidade >= 0),
  total numeric(12, 2),
  origem text not null default 'manual',
  unique (evento_id, data, produto)
);
create index on evento_vendas (receita_id);

-- Itens que vão em todo evento e não saem da ficha técnica (equipamentos, utensílios, embalagens, limpeza…).
-- Lista inicial = checklist do evento de São José dos Campos (planilha do Heitor, 08/10).
create table checklist_evento_modelo (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  item text not null check (length(trim(item)) > 0),
  -- Praça/linha que usa o item (Foca, Pizza, Romana…). Vazio = vai sempre.
  operacao text,
  quantidade text, -- livre: "2", "3 caixas", "Todas"
  ordem int not null default 0,
  ativo boolean not null default true
);

-- Cada separação (carga que sai da base para um dia do evento) é um checklist.
create table evento_envios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos (id) on delete cascade,
  data date not null, -- dia do evento que esta carga abastece
  tipo text not null check (tipo in ('separacao', 'reposicao')),
  observacao text,
  criado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on evento_envios (evento_id, data);

create table evento_envio_itens (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references evento_envios (id) on delete cascade,
  ordem int not null default 0,
  categoria text,
  operacao text,
  insumo_id uuid references insumos (id),
  receita_id uuid references receitas (id), -- pré-preparo feito na base (molho, massa, recheio)
  item text, -- nome do item quando não é insumo nem pré-preparo (equipamento, utensílio…)
  previsto numeric(12, 3), -- quanto a conta sugeriu
  quantidade numeric(12, 3), -- quanto foi separado de fato
  quantidade_texto text, -- quantidade livre dos itens fixos ("3 caixas", "Todas")
  unidade text,
  conferido boolean not null default false, -- conferência de saída
  conferido_por uuid references funcionarios (id),
  conferido_em timestamptz,
  retornou boolean not null default false, -- conferência de retorno (equipamentos e utensílios voltaram)
  retorno_por uuid references funcionarios (id),
  retorno_em timestamptz,
  check (num_nonnulls(insumo_id, receita_id) <= 1),
  check (insumo_id is not null or receita_id is not null or length(trim(item)) > 0)
);
create index on evento_envio_itens (envio_id);

-- Contagens: sobra no fim de cada dia de evento, ou estoque da base.
create table inventarios (
  id uuid primary key default gen_random_uuid(),
  local text not null check (local in ('base', 'evento')),
  evento_id uuid references eventos (id) on delete cascade,
  data date not null,
  contado_por uuid default (eu()).id references funcionarios (id),
  contado_em timestamptz not null default now(),
  observacao text,
  fala text, -- o que a pessoa ditou, quando contou por voz
  check ((local = 'evento') = (evento_id is not null))
);
-- Uma contagem de sobra por dia de evento (contar de novo substitui).
create unique index on inventarios (evento_id, data) where local = 'evento';
create index on inventarios (local, contado_em);

create table inventario_itens (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references inventarios (id) on delete cascade,
  insumo_id uuid references insumos (id),
  receita_id uuid references receitas (id), -- pré-preparo
  quantidade numeric(12, 3) not null check (quantidade >= 0),
  check (num_nonnulls(insumo_id, receita_id) = 1)
);
create unique index on inventario_itens (inventario_id, insumo_id) where insumo_id is not null;
create unique index on inventario_itens (inventario_id, receita_id) where receita_id is not null;

create or replace function sou_responsavel_evento(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from evento_responsaveis where evento_id = p_evento and funcionario_id = (eu()).id)
$$;

-- Eventos em que estou escalado (para quem não é da gestão e não vê o módulo Eventos).
create or replace function meus_eventos_escalados()
returns table (id uuid, nome text, status text, papel text, dias jsonb)
language sql stable security definer set search_path = public as $$
  select e.id, e.nome, e.status, r.papel,
         coalesce((select jsonb_agg(jsonb_build_object('data', d.data, 'abre', d.abre, 'fecha', d.fecha) order by d.data) from evento_dias d where d.evento_id = e.id), '[]')
  from eventos e join evento_responsaveis r on r.evento_id = e.id and r.funcionario_id = (eu()).id
  where e.status in ('aprovado', 'preparacao', 'execucao')
$$;

-- O que se conta (sem preço): insumos e pré-preparos ativos. Para a gestão e para quem está escalado em algum evento.
create or replace function itens_contagem()
returns table (tipo text, id uuid, nome text, categoria text, unidade text, embalagem text, embalagem_qtd numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (sou_gestao() or exists (select 1 from evento_responsaveis where funcionario_id = (eu()).id)) then
    raise exception 'Seu nível de acesso não permite esta ação.';
  end if;
  return query
    select 'insumo', i.id, i.nome, i.categoria, i.unidade, i.embalagem, i.embalagem_qtd from insumos i where i.ativo
    union all
    select 'preparo', r.id, r.nome, 'Pré-preparos', r.unidade, null::text, null::numeric from receitas r where r.ativo and r.tipo = 'preparo'
    order by 3;
end $$;

-- Conferir um item da separação na saída ou no retorno (gestão ou responsável do evento).
create or replace function conferir_item_envio(p_item uuid, p_etapa text, p_quantidade numeric, p_ok boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_evento uuid;
begin
  select e.evento_id into v_evento from evento_envio_itens i join evento_envios e on e.id = i.envio_id where i.id = p_item;
  if v_evento is null then raise exception 'Item não encontrado.'; end if;
  if not (sou_gestao() or sou_responsavel_evento(v_evento)) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if p_etapa = 'saida' then
    update evento_envio_itens set quantidade = p_quantidade, conferido = p_ok,
      conferido_por = case when p_ok then (eu()).id end, conferido_em = case when p_ok then now() end
    where id = p_item;
  elsif p_etapa = 'retorno' then
    update evento_envio_itens set retornou = p_ok,
      retorno_por = case when p_ok then (eu()).id end, retorno_em = case when p_ok then now() end
    where id = p_item;
  else
    raise exception 'Etapa inválida.';
  end if;
end $$;

-- Grava uma contagem. Sobra de evento: uma por dia (contar de novo substitui). Base: cada contagem fica no histórico.
create or replace function salvar_inventario(p_local text, p_evento uuid, p_data date, p_itens jsonb, p_fala text, p_obs text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_local = 'base' then
    if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
    insert into inventarios (local, data, fala, observacao) values ('base', p_data, nullif(trim(p_fala), ''), nullif(trim(p_obs), '')) returning id into v_id;
  elsif p_local = 'evento' then
    if not (sou_gestao() or sou_responsavel_evento(p_evento)) then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
    select id into v_id from inventarios where local = 'evento' and evento_id = p_evento and data = p_data for update;
    if v_id is null then
      insert into inventarios (local, evento_id, data, fala, observacao) values ('evento', p_evento, p_data, nullif(trim(p_fala), ''), nullif(trim(p_obs), '')) returning id into v_id;
    else
      update inventarios set contado_por = (eu()).id, contado_em = now(), fala = nullif(trim(p_fala), ''), observacao = nullif(trim(p_obs), '') where id = v_id;
      delete from inventario_itens where inventario_id = v_id;
    end if;
  else
    raise exception 'Local inválido.';
  end if;
  insert into inventario_itens (inventario_id, insumo_id, receita_id, quantidade)
  select v_id, (i ->> 'insumo_id')::uuid, (i ->> 'receita_id')::uuid, (i ->> 'quantidade')::numeric from jsonb_array_elements(p_itens) i;
  return v_id;
end $$;

alter table evento_produtos enable row level security;
alter table evento_previsao enable row level security;
alter table evento_vendas enable row level security;
alter table checklist_evento_modelo enable row level security;
alter table evento_envios enable row level security;
alter table evento_envio_itens enable row level security;
alter table inventarios enable row level security;
alter table inventario_itens enable row level security;

create policy "gestao edita cardapio" on evento_produtos for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita previsao" on evento_previsao for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita vendas" on evento_vendas for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita modelo de checklist" on checklist_evento_modelo for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita envios" on evento_envios for all using (sou_gestao()) with check (sou_gestao());
create policy "escalado ve envios" on evento_envios for select using (sou_responsavel_evento(evento_id));
create policy "gestao edita itens de envio" on evento_envio_itens for all using (sou_gestao()) with check (sou_gestao());
create policy "escalado ve itens de envio" on evento_envio_itens for select
  using (exists (select 1 from evento_envios e where e.id = envio_id and sou_responsavel_evento(e.evento_id)));
-- Contagens só entram pela função salvar_inventario; a gestão pode apagar.
create policy "gestao ve contagens" on inventarios for select using (sou_gestao());
create policy "gestao apaga contagens" on inventarios for delete using (sou_gestao());
create policy "escalado ve contagens do evento" on inventarios for select using (local = 'evento' and sou_responsavel_evento(evento_id));
create policy "ve itens de contagem" on inventario_itens for select
  using (exists (select 1 from inventarios v where v.id = inventario_id and (sou_gestao() or (v.local = 'evento' and sou_responsavel_evento(v.evento_id)))));

-- Lista inicial: checklist de São José dos Campos sem alimentos e bebidas (esses saem da previsão × fichas).
insert into checklist_evento_modelo (categoria, item, operacao, quantidade, ordem) values
  ('Decoração', 'Cardápios', 'Foca', 'Todos', 1),
  ('Decoração', 'Toalha Focaccia (Azul)', 'Foca', '1', 2),
  ('Decoração', 'Toalha Quadriculada (2un)', 'Pizza', '2', 3),
  ('Decoração', 'Varal de Luzes', 'Foca', '1', 4),
  ('Embalagens', 'Adesivos', 'Foca', 'Todos os tipos', 5),
  ('Embalagens', 'Bisnaga', 'Foca', 'Todas', 6),
  ('Embalagens', 'Guardanapos', 'Pizza', '2 caixas', 7),
  ('Embalagens', 'Papel acoplado térmico', 'Foca', '1000', 8),
  ('Embalagens', 'Pratos pizza', 'Pizza', '1000', 9),
  ('Equipamentos', 'Chapa de pão', 'Foca', '2', 10),
  ('Equipamentos', 'Extensão', 'Pizza', 'Todas', 11),
  ('Equipamentos', 'Extintor', 'Pizza', '2', 12),
  ('Equipamentos', 'Fornos', 'Pizza', 'Grande Paulistano e médio', 13),
  ('Equipamentos', 'Freezer Horizontal', 'Foca', '1', 14),
  ('Equipamentos', 'Freezer horizontal 2', 'Pizza', '1', 15),
  ('Equipamentos', 'Freezer Vertical', 'Foca', '1', 16),
  ('Equipamentos', 'Gás', 'Pizza', '5', 17),
  ('Equipamentos', 'Holofotes', 'Pizza', '1', 18),
  ('Equipamentos', 'Iluminação da Tenda - 2 bocal e lâmpadas', 'Foca', '2', 19),
  ('Equipamentos', 'Lixeira', 'Pizza', '2', 20),
  ('Equipamentos', 'Luzes da pista quente', 'Foca', '3', 21),
  ('Equipamentos', 'Mesa de plástico', 'Pizza', '3', 22),
  ('Equipamentos', 'Mesas', 'Foca', 'Todas', 23),
  ('Equipamentos', 'Pá de Pizza napolitana', 'Pizza', '2', 24),
  ('Equipamentos', 'Pá redonda pizza', 'Pizza', '1', 25),
  ('Equipamentos', 'Pista quente', 'Foca', '1', 26),
  ('Equipamentos', 'Transformador', 'Foca', '1', 27),
  ('Escritório', 'Canetas', 'Foca', null, 28),
  ('Escritório', 'Pump agua', 'Foca', null, 29),
  ('Escritório', 'Rádio', 'Foca', null, 30),
  ('Escritório', 'Troco', 'Pizza', null, 31),
  ('Prod. Limpeza', 'Água para limpeza', 'Foca', null, 32),
  ('Prod. Limpeza', 'Álcool borrifador', 'Pizza', '3', 33),
  ('Prod. Limpeza', 'Álcool gel', 'Foca', '3', 34),
  ('Prod. Limpeza', 'Bucha de louça', 'Pizza', '6', 35),
  ('Prod. Limpeza', 'Luvas', 'Foca', '3 caixas', 36),
  ('Prod. Limpeza', 'Pá de Lixo', 'Foca', '1', 37),
  ('Prod. Limpeza', 'Perflex', 'Foca', null, 38),
  ('Prod. Limpeza', 'Sacos lixos 100l', 'Foca', null, 39),
  ('Prod. Limpeza', 'Toucas', 'Pizza', null, 40),
  ('Prod. Limpeza', 'Vassoura', 'Foca', null, 41),
  ('Uniformes', 'Aventais', 'Pizza', null, 42),
  ('Utensílios', 'Bobina Picotada', 'Pizza', null, 43),
  ('Utensílios', 'Bobina pra fechamento', 'Foca', null, 44),
  ('Utensílios', 'Caixas de pizza pra decoração', 'Pizza', null, 45),
  ('Utensílios', 'Colher', 'Pizza', null, 46),
  ('Utensílios', 'Comandeira', 'Foca', 'Todas', 47),
  ('Utensílios', 'Concha pizza', 'Pizza', null, 48),
  ('Utensílios', 'Cooler Azul', 'Pizza', '1', 49),
  ('Utensílios', 'Cortador de pizza', 'Pizza', '4', 50),
  ('Utensílios', 'Detergente', 'Pizza', '3', 51),
  ('Utensílios', 'Enforca Gato', 'Foca', null, 52),
  ('Utensílios', 'Escova pizza', 'Pizza', null, 53),
  ('Utensílios', 'Espátula chapa', 'Foca', '3', 54),
  ('Utensílios', 'Espeto de comanda', 'Foca', '5', 55),
  ('Utensílios', 'Etiquetas validade', 'Pizza', null, 56),
  ('Utensílios', 'Faca', 'Foca', '4', 57),
  ('Utensílios', 'Filme PVC', 'Foca', '1', 58),
  ('Utensílios', 'GNs', 'Foca', 'Todas', 59),
  ('Utensílios', 'Kit primeiros socorros', 'Foca', null, 60),
  ('Utensílios', 'Papel Filme', 'Pizza', null, 61),
  ('Utensílios', 'Papel Toalha', 'Foca', null, 62),
  ('Utensílios', 'Prancheta', 'Pizza', null, 63),
  ('Utensílios', 'Tábuas', 'Foca', '4', 64),
  ('Utensílios', 'Termômetro infravermelho', 'Pizza', '1', 65),
  ('Utensílios', 'Tesoura', 'Foca', '1', 66);
