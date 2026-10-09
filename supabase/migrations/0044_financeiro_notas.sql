-- Financeiro e estoque, parte 1 (Heitor, 09/10): tudo começa pela nota fiscal.
-- A nota entra (XML da NF-e ou lançada à mão), os itens são conciliados com os insumos do cadastro e, ao lançar,
-- geram a entrada no estoque da loja e as contas a pagar (boletos/parcelas da nota, Pix, cartão…).
-- Contas a pagar têm conta contábil (plano de contas igual ao do Lucro Fácil) e centro de custo (loja),
-- para montar a DRE por loja. Só acrescenta tabelas, colunas e funções: nada do que já existe muda.

-- Onde o custo cai: as três lojas, a Central de Produção e a The Ozzy Eventos (as 5 empresas do Lucro Fácil).
create table centros_custo (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  nome text not null,
  cnpj text, -- só dígitos; a nota de entrada acha a loja pelo CNPJ do destinatário
  lf_empresa_id int,
  ordem int not null default 0,
  ativo boolean not null default true
);
insert into centros_custo (id, nome, cnpj, lf_empresa_id, ordem) values
  ('burger-psd', 'The Ozzy Burger Parque São Domingos', '34533354000113', 410, 1),
  ('burger-va', 'The Ozzy Burger Vila Anastácio', '34533354000202', 411, 2),
  ('pizza', 'The Ozzy Pizza', '61514304000124', 412, 3),
  ('central', 'Central de Produção', null, 413, 4),
  ('eventos', 'The Ozzy Eventos', null, 414, 5);

-- Plano de contas (conta contábil). Começa igual às categorias de despesa do Lucro Fácil (lidas em 09/10).
-- operacional = entra no resultado operacional da DRE (empréstimos, investimentos e distribuição ficam abaixo).
create table plano_contas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null check (length(trim(nome)) > 0),
  pai_codigo text references plano_contas (codigo) on update cascade,
  operacional boolean not null default true,
  lf_categoria_id int,
  ordem int not null default 0,
  ativo boolean not null default true
);
insert into plano_contas (codigo, nome, pai_codigo, operacional, lf_categoria_id, ordem) values
  ('1', 'CMC - Custo de Mercadoria Comprada', null, true, 25929, 100),
  ('1.1', 'Insumos', '1', true, 25932, 101),
  ('1.2', 'Hortifruti', '1', true, 25933, 102),
  ('1.3', 'Carnes', '1', true, 34450, 103),
  ('1.4', 'Laticínios', '1', true, 35210, 104),
  ('1.5', 'Bebidas', '1', true, 25930, 105),
  ('1.6', 'Alcoólicos', '1', true, 25935, 106),
  ('1.7', 'Produtos para Revenda', '1', true, 25931, 107),
  ('1.8', 'Embalagem', '1', true, 25934, 108),
  ('2', 'CMO - Custo de Mão de Obra', null, true, 25936, 200),
  ('2.1', 'Salários e Ordenados', '2', true, 25937, 201),
  ('2.2', 'Encargos Trabalhistas', '2', true, 25938, 202),
  ('2.3', 'Pró-labore', '2', true, 25939, 203),
  ('2.4', 'Freelancers e Terceirizados', '2', true, 25940, 204),
  ('2.5', 'Benefícios', '2', true, 25941, 205),
  ('3', 'Taxa de Entrega', null, true, 25955, 300),
  ('4', 'Despesas e Utilidades Prediais', null, true, 25978, 400),
  ('4.1', 'Aluguel', '4', true, 25980, 401),
  ('4.2', 'Água', '4', true, 25979, 402),
  ('4.3', 'Energia Elétrica', '4', true, 25981, 403),
  ('4.4', 'Gás Encanado', '4', true, 25982, 404),
  ('4.5', 'Internet', '4', true, 25983, 405),
  ('4.6', 'IPTU', '4', true, 25985, 406),
  ('4.7', 'Telefone Fixo', '4', true, 25992, 407),
  ('4.8', 'Telefone Celular Empresarial', '4', true, 25991, 408),
  ('4.9', 'Manutenção Predial', '4', true, 25987, 409),
  ('4.10', 'Manutenção Computadores', '4', true, 25986, 410),
  ('4.11', 'Seguro Predial', '4', true, 25988, 411),
  ('4.12', 'Serviço de Limpeza', '4', true, 25989, 412),
  ('4.13', 'Taxa Franquia', '4', true, 25990, 413),
  ('4.14', 'Investimento Estrutura', '4', true, 25984, 414),
  ('5', 'Administrativo Geral', null, true, 25958, 500),
  ('5.1', 'Assessorias', '5', true, 25959, 501),
  ('5.2', 'Brindes e Confraternizações', '5', true, 25960, 502),
  ('5.3', 'Combustível', '5', true, 25961, 503),
  ('5.4', 'Consultoria e Mentoria', '5', true, 25962, 504),
  ('5.5', 'Contabilidade', '5', true, 25963, 505),
  ('5.6', 'CRM', '5', true, 25964, 506),
  ('5.7', 'Entregas APP', '5', true, 25965, 507),
  ('5.8', 'ERP', '5', true, 25966, 508),
  ('5.9', 'Estornos e Devoluções', '5', true, 25967, 509),
  ('5.10', 'Financeiro', '5', true, 25968, 510),
  ('5.11', 'Fretes', '5', true, 25969, 511),
  ('5.12', 'Gestão de Entregas', '5', true, 25970, 512),
  ('5.13', 'Gestão de Equipe', '5', true, 25971, 513),
  ('5.14', 'IA', '5', true, 25972, 514),
  ('5.15', 'Jurídico', '5', true, 25973, 515),
  ('5.16', 'Marketing', '5', true, 25974, 516),
  ('5.17', 'PDV', '5', true, 25975, 517),
  ('5.18', 'Publicidade', '5', true, 25976, 518),
  ('5.19', 'Sistemas', '5', true, 25977, 519),
  ('5.20', 'Serviços Terceirizados - Vigilância e Segurança', '5', true, 29092, 520),
  ('5.21', 'Tributos e Impostos', '5', true, 34676, 521),
  ('5.22', 'Tarifas Bancárias', '5', true, 34677, 522),
  ('5.23', 'Manutenção e Conservação', '5', true, 34963, 523),
  ('6', 'Material de Consumo', null, true, 25993, 600),
  ('6.1', 'Limpeza e Conservação', '6', true, 25994, 601),
  ('6.2', 'Material de Escritório', '6', true, 25995, 602),
  ('6.3', 'Utensílio de Cozinha', '6', true, 25996, 603),
  ('7', 'Juros', null, true, 25956, 700),
  ('8', 'Multas', null, true, 25957, 800),
  ('9', 'Empréstimos e Financiamentos', null, false, 25948, 900),
  ('9.1', 'Empréstimo de Capital de Giro', '9', false, 25949, 901),
  ('9.2', 'Financiamentos', '9', false, 25950, 902),
  ('9.3', 'Empréstimo LJ-1 Ozzy Burger', '9', false, 33672, 903),
  ('9.4', 'Empréstimo LJ-2 Ozzy Burger', '9', false, 33673, 904),
  ('10', 'Investimentos (Capex)', null, false, 25942, 1000),
  ('10.1', 'Instalações Gerais', '10', false, 25943, 1001),
  ('10.2', 'Equipamentos de Cozinha', '10', false, 25944, 1002),
  ('10.3', 'Mobiliário', '10', false, 25946, 1003),
  ('10.4', 'Outros Equipamentos', '10', false, 25947, 1004),
  ('10.5', 'Mão de Obra (implantação/obra)', '10', false, 25945, 1005),
  ('11', 'Distribuição de Resultados', null, false, 25951, 1100),
  ('11.1', 'Distribuição de Lucros', '11', false, 25952, 1101),
  ('11.2', 'Retirada de Sócios (pró-labore ou extra)', '11', false, 25953, 1102),
  ('11.3', 'Antecipação de Lucros', '11', false, 25954, 1103);

alter table fornecedores add column cnpj text check (cnpj ~ '^\d{11}(\d{3})?$');
create unique index on fornecedores (cnpj) where cnpj is not null;
-- Conta contábil que costuma ir nas notas deste fornecedor (sugestão ao lançar).
alter table fornecedores add column conta_padrao_id uuid references plano_contas (id);

-- Nota fiscal de entrada.
create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  chave text unique check (chave ~ '^\d{44}$'), -- vazia nas notas lançadas sem XML
  numero text,
  serie text,
  emissao date not null,
  fornecedor_id uuid references fornecedores (id),
  emitente_cnpj text,
  emitente_nome text,
  destinatario_cnpj text,
  centro_custo_id text references centros_custo (id),
  valor_produtos numeric(14, 2),
  frete numeric(14, 2),
  desconto numeric(14, 2),
  outras numeric(14, 2),
  valor_total numeric(14, 2) not null check (valor_total >= 0),
  -- Como a nota diz que foi paga (tPag da NF-e) e as duplicatas (boletos) que vieram nela.
  pagamento_xml jsonb not null default '[]',
  duplicatas jsonb not null default '[]',
  xml text,
  arquivo text, -- caminho do PDF/foto da nota (bucket documentos), quando não tem XML
  observacao text,
  status text not null default 'conferir' check (status in ('conferir', 'lancada')),
  lancada_em timestamptz,
  lancada_por uuid references funcionarios (id),
  criado_em timestamptz not null default now(),
  criado_por uuid default (eu()).id references funcionarios (id)
);
create index on notas_fiscais (emissao);

create table nota_itens (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references notas_fiscais (id) on delete cascade,
  ordem int not null default 0,
  codigo text, -- código do produto no fornecedor (cProd)
  ean text,
  descricao text not null,
  ncm text,
  cfop text,
  unidade text, -- unidade da nota (CX, KG, UN…)
  quantidade numeric(14, 4) not null,
  valor_unit numeric(14, 6),
  valor_total numeric(14, 2) not null, -- já com o desconto do item
  -- Conciliação: qual insumo é e quantas unidades do insumo vêm em 1 unidade da nota (ex.: 1 CX = 12 un).
  insumo_id uuid references insumos (id),
  fator numeric(14, 4) check (fator > 0),
  fora_estoque boolean not null default false -- serviço, limpeza, item que não se controla
);
create index on nota_itens (nota_id);

-- Memória da conciliação: o mesmo código do mesmo fornecedor já vem conciliado na próxima nota.
create table fornecedor_produtos (
  fornecedor_cnpj text not null,
  codigo text not null,
  insumo_id uuid references insumos (id),
  fator numeric(14, 4) check (fator > 0),
  fora_estoque boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (fornecedor_cnpj, codigo)
);

-- Estoque por loja: cada entrada (nota), ajuste, perda ou saída. Saldo = soma das quantidades.
create table estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  centro_custo_id text not null references centros_custo (id),
  insumo_id uuid not null references insumos (id),
  data date not null,
  tipo text not null check (tipo in ('entrada_nf', 'entrada', 'saida', 'perda', 'ajuste', 'transferencia')),
  quantidade numeric(14, 4) not null, -- na unidade do insumo; saída é negativa
  custo_unit numeric(14, 6),
  nota_item_id uuid references nota_itens (id) on delete cascade,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid default (eu()).id references funcionarios (id)
);
create index on estoque_movimentos (centro_custo_id, insumo_id);

-- Contas a pagar.
create table contas_pagar (
  id uuid primary key default gen_random_uuid(),
  centro_custo_id text not null references centros_custo (id),
  conta_id uuid references plano_contas (id), -- conta contábil (vazia = falta classificar)
  fornecedor_id uuid references fornecedores (id),
  favorecido text, -- quando não é um fornecedor cadastrado
  descricao text not null check (length(trim(descricao)) > 0),
  competencia date not null, -- mês da DRE (dia 1)
  vencimento date not null,
  valor numeric(14, 2) not null check (valor > 0),
  forma text not null default 'boleto' check (forma in ('boleto', 'pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia', 'debito_automatico', 'outro')),
  parcela int,
  parcelas int,
  documento text, -- nº do boleto, linha digitável, chave Pix…
  nota_id uuid references notas_fiscais (id) on delete cascade,
  observacao text,
  pago_em date,
  valor_pago numeric(14, 2),
  pago_por uuid references funcionarios (id),
  conciliado boolean not null default false, -- conferido no extrato do banco
  criado_em timestamptz not null default now(),
  criado_por uuid default (eu()).id references funcionarios (id)
);
create index on contas_pagar (vencimento);
create index on contas_pagar (centro_custo_id, competencia);

alter table centros_custo enable row level security;
alter table plano_contas enable row level security;
alter table notas_fiscais enable row level security;
alter table nota_itens enable row level security;
alter table fornecedor_produtos enable row level security;
alter table estoque_movimentos enable row level security;
alter table contas_pagar enable row level security;
create policy "gestao ve centros de custo" on centros_custo for select using (sou_gestao());
create policy "financeiro edita centros de custo" on centros_custo for all using (vejo_resultado()) with check (vejo_resultado());
create policy "gestao ve plano de contas" on plano_contas for select using (sou_gestao());
create policy "financeiro edita plano de contas" on plano_contas for all using (vejo_resultado()) with check (vejo_resultado());
-- Notas e estoque: a gestão toda (a gerente recebe e confere a nota). Contas a pagar: só quem vê o financeiro.
create policy "gestao edita notas" on notas_fiscais for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita itens de nota" on nota_itens for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita conciliacao" on fornecedor_produtos for all using (sou_gestao()) with check (sou_gestao());
create policy "gestao edita estoque" on estoque_movimentos for all using (sou_gestao()) with check (sou_gestao());
create policy "financeiro edita contas a pagar" on contas_pagar for all using (vejo_resultado()) with check (vejo_resultado());

-- Importa uma nota (o XML é lido no navegador). Cria o fornecedor pelo CNPJ se ainda não existir e já traz a
-- conciliação que o mesmo fornecedor teve antes. p: {chave, numero, serie, emissao, emitente:{cnpj,nome,fantasia},
-- destinatario_cnpj, totais:{produtos,frete,desconto,outras,total}, pagamento:[...], duplicatas:[...], xml, itens:[...]}
create function importar_nota(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_forn uuid;
  v_nota uuid;
  v_cnpj text := regexp_replace(coalesce(p #>> '{emitente,cnpj}', ''), '\D', '', 'g');
  v_dest text := regexp_replace(coalesce(p ->> 'destinatario_cnpj', ''), '\D', '', 'g');
  it jsonb;
  m fornecedor_produtos;
  n int := 0;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if p ->> 'chave' is not null and exists (select 1 from notas_fiscais where chave = p ->> 'chave') then
    raise exception 'Esta nota já foi importada (nº %).', p ->> 'numero';
  end if;
  if length(v_cnpj) in (11, 14) then
    select id into v_forn from fornecedores where cnpj = v_cnpj;
    if v_forn is null then
      select id into v_forn from fornecedores where cnpj is null and lower(nome) = lower(coalesce(nullif(p #>> '{emitente,fantasia}', ''), p #>> '{emitente,nome}'));
      if v_forn is not null then
        update fornecedores set cnpj = v_cnpj where id = v_forn;
      else
        insert into fornecedores (nome, cnpj, observacao)
        values (coalesce(nullif(trim(p #>> '{emitente,fantasia}'), ''), trim(p #>> '{emitente,nome}')), v_cnpj, nullif(p #>> '{emitente,nome}', ''))
        on conflict do nothing returning id into v_forn;
        if v_forn is null then -- nome repetido com outro CNPJ
          insert into fornecedores (nome, cnpj) values (trim(p #>> '{emitente,nome}') || ' (' || v_cnpj || ')', v_cnpj) returning id into v_forn;
        end if;
      end if;
    end if;
  end if;
  insert into notas_fiscais (chave, numero, serie, emissao, fornecedor_id, emitente_cnpj, emitente_nome, destinatario_cnpj, centro_custo_id,
    valor_produtos, frete, desconto, outras, valor_total, pagamento_xml, duplicatas, xml)
  values (p ->> 'chave', p ->> 'numero', p ->> 'serie', (p ->> 'emissao')::date, v_forn, nullif(v_cnpj, ''), p #>> '{emitente,nome}', nullif(v_dest, ''),
    (select id from centros_custo where cnpj = v_dest),
    (p #>> '{totais,produtos}')::numeric, (p #>> '{totais,frete}')::numeric, (p #>> '{totais,desconto}')::numeric, (p #>> '{totais,outras}')::numeric,
    (p #>> '{totais,total}')::numeric, coalesce(p -> 'pagamento', '[]'), coalesce(p -> 'duplicatas', '[]'), p ->> 'xml')
  returning id into v_nota;
  for it in select * from jsonb_array_elements(coalesce(p -> 'itens', '[]')) loop
    n := n + 1;
    select * into m from fornecedor_produtos where fornecedor_cnpj = v_cnpj and codigo = it ->> 'codigo';
    insert into nota_itens (nota_id, ordem, codigo, ean, descricao, ncm, cfop, unidade, quantidade, valor_unit, valor_total, insumo_id, fator, fora_estoque)
    values (v_nota, n, it ->> 'codigo', nullif(it ->> 'ean', ''), it ->> 'descricao', it ->> 'ncm', it ->> 'cfop', it ->> 'unidade',
      (it ->> 'quantidade')::numeric, (it ->> 'valor_unit')::numeric, (it ->> 'valor_total')::numeric, m.insumo_id, m.fator, coalesce(m.fora_estoque, false));
  end loop;
  return v_nota;
end $$;

-- Lança a nota: conciliação dos itens, entrada no estoque da loja, contas a pagar e (se pedir) preço dos insumos.
-- p_itens: [{id, insumo_id, fator, fora_estoque}]; p_parcelas: [{vencimento, valor, forma, documento}].
create function lancar_nota(p_nota uuid, p_centro text, p_conta uuid, p_competencia date, p_itens jsonb, p_parcelas jsonb, p_atualizar_preco boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  nf notas_fiscais;
  it jsonb;
  x nota_itens;
  par jsonb;
  qtd numeric;
  total numeric := 0;
  n int;
  i int := 0;
  forn text;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into nf from notas_fiscais where id = p_nota for update;
  if nf.id is null then raise exception 'Nota não encontrada.'; end if;
  if nf.status = 'lancada' then raise exception 'Esta nota já foi lançada.'; end if;
  if not exists (select 1 from centros_custo where id = p_centro) then raise exception 'Escolha a loja da nota.'; end if;
  if jsonb_array_length(coalesce(p_parcelas, '[]')) = 0 then raise exception 'Coloque pelo menos um pagamento.'; end if;
  select sum((v ->> 'valor')::numeric) into total from jsonb_array_elements(p_parcelas) v;
  if abs(total - nf.valor_total) > 0.05 then
    raise exception 'Os pagamentos somam % e a nota é de %. Confira as parcelas.', replace(to_char(total, 'FM999999990.00'), '.', ','), replace(to_char(nf.valor_total, 'FM999999990.00'), '.', ',');
  end if;
  update notas_fiscais set centro_custo_id = p_centro where id = p_nota;

  -- Conciliação dos itens e entrada no estoque.
  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    update nota_itens set insumo_id = nullif(it ->> 'insumo_id', '')::uuid, fator = nullif(it ->> 'fator', '')::numeric,
      fora_estoque = coalesce((it ->> 'fora_estoque')::boolean, false)
    where id = (it ->> 'id')::uuid and nota_id = p_nota
    returning * into x;
    if x.id is null then continue; end if;
    if nf.emitente_cnpj is not null and x.codigo is not null then
      insert into fornecedor_produtos (fornecedor_cnpj, codigo, insumo_id, fator, fora_estoque)
      values (nf.emitente_cnpj, x.codigo, x.insumo_id, x.fator, x.fora_estoque)
      on conflict (fornecedor_cnpj, codigo) do update set insumo_id = excluded.insumo_id, fator = excluded.fator,
        fora_estoque = excluded.fora_estoque, atualizado_em = now();
    end if;
    if x.insumo_id is not null and not x.fora_estoque then
      qtd := x.quantidade * coalesce(x.fator, 1);
      insert into estoque_movimentos (centro_custo_id, insumo_id, data, tipo, quantidade, custo_unit, nota_item_id, observacao)
      values (p_centro, x.insumo_id, nf.emissao, 'entrada_nf', qtd, case when qtd > 0 then x.valor_total / qtd end, x.id,
        'NF ' || coalesce(nf.numero, '') || ' · ' || coalesce(nf.emitente_nome, ''));
      if p_atualizar_preco and qtd > 0 then
        update insumos set preco = round(x.valor_total / qtd, 4), preco_em = now() where id = x.insumo_id;
      end if;
    end if;
  end loop;

  -- Contas a pagar (uma por parcela).
  n := jsonb_array_length(p_parcelas);
  select nome into forn from fornecedores where id = nf.fornecedor_id;
  for par in select * from jsonb_array_elements(p_parcelas) loop
    i := i + 1;
    insert into contas_pagar (centro_custo_id, conta_id, fornecedor_id, favorecido, descricao, competencia, vencimento, valor, forma, parcela, parcelas, documento, nota_id)
    values (p_centro, p_conta, nf.fornecedor_id, case when nf.fornecedor_id is null then nf.emitente_nome end,
      'NF ' || coalesce(nf.numero, 's/n') || ' · ' || coalesce(forn, nf.emitente_nome, 'fornecedor'),
      date_trunc('month', coalesce(p_competencia, nf.emissao))::date, (par ->> 'vencimento')::date, (par ->> 'valor')::numeric,
      coalesce(nullif(par ->> 'forma', ''), 'boleto'), case when n > 1 then i end, case when n > 1 then n end, nullif(par ->> 'documento', ''), p_nota);
  end loop;
  if p_conta is not null and nf.fornecedor_id is not null then
    update fornecedores set conta_padrao_id = p_conta where id = nf.fornecedor_id;
  end if;
  update notas_fiscais set status = 'lancada', lancada_em = now(), lancada_por = (eu()).id where id = p_nota;
end $$;

-- Desfaz o lançamento (para corrigir): tira a entrada do estoque e as contas a pagar, se nenhuma foi paga.
create function estornar_nota(p_nota uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if exists (select 1 from contas_pagar where nota_id = p_nota and pago_em is not null) then
    raise exception 'Esta nota já tem pagamento registrado. Desfaça o pagamento antes.';
  end if;
  delete from contas_pagar where nota_id = p_nota;
  delete from estoque_movimentos where nota_item_id in (select id from nota_itens where nota_id = p_nota);
  update notas_fiscais set status = 'conferir', lancada_em = null, lancada_por = null where id = p_nota;
end $$;

grant execute on function importar_nota(jsonb) to authenticated;
grant execute on function lancar_nota(uuid, text, uuid, date, jsonb, jsonb, boolean) to authenticated;
grant execute on function estornar_nota(uuid) to authenticated;
