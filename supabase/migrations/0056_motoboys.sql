-- Motoboys (Heitor, 09/10): não são da equipe (não registrados), mas têm cadastro com nome, Pix e o básico.
-- Todo domingo a gestão lança a semana de cada um (diárias, entregas com taxas e extras como adiantamento e
-- supervisão); vira conta a pagar na segunda, que entra na conciliação (uma por pessoa ou o lote da semana).
create table motoboys (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade_id text references unidades (id),
  pix text,
  telefone text,
  cpf text,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid references funcionarios (id)
);
alter table motoboys enable row level security;
create policy "gestao ve motoboys" on motoboys for select using (sou_gestao());
create policy "gestao cadastra motoboys" on motoboys for insert with check (sou_gestao());
create policy "gestao edita motoboys" on motoboys for update using (sou_gestao());
grant all on motoboys to authenticated;

-- Uma linha por motoboy, loja e dia de pagamento (a segunda). Extras: [{descricao, valor}] (valor negativo é desconto).
create table motoboy_semanas (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references motoboys (id),
  unidade_id text not null references unidades (id),
  pagamento date not null,
  diarias numeric(10, 2) not null default 0,
  entregas numeric(10, 2) not null default 0,
  extras jsonb not null default '[]',
  total numeric(10, 2) not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references funcionarios (id),
  unique (motoboy_id, unidade_id, pagamento)
);
alter table motoboy_semanas enable row level security;
create policy "gestao ve semanas de motoboy" on motoboy_semanas for select using (sou_gestao());
grant select on motoboy_semanas to authenticated;

alter table contas_pagar add column motoboy_id uuid references motoboys (id);
create index on contas_pagar (motoboy_id) where motoboy_id is not null;
alter table extrato_regras add column motoboy_id uuid references motoboys (id);

-- Salva a semana de uma loja. Linha com total zero sai (se a conta ainda não foi conciliada).
-- Conta conciliada não muda: a linha fica como estava.
create function salvar_motoboys_semana(p_pagamento date, p_unidade text, p_linhas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  l jsonb;
  v_moto motoboys;
  v_diarias numeric;
  v_entregas numeric;
  v_extras jsonb;
  v_total numeric;
  v_pago boolean;
  v_origem text;
  v_conc boolean;
  v_desc text;
  n int := 0;
begin
  if not sou_gestao() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  if not exists (select 1 from unidades where id = p_unidade) then raise exception 'Escolha a loja.'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_linhas, '[]')) loop
    select * into v_moto from motoboys where id = (l->>'motoboy_id')::uuid;
    if v_moto.id is null then raise exception 'Motoboy não encontrado.'; end if;
    v_diarias := round(coalesce((l->>'diarias')::numeric, 0), 2);
    v_entregas := round(coalesce((l->>'entregas')::numeric, 0), 2);
    select coalesce(jsonb_agg(jsonb_build_object('descricao', trim(e->>'descricao'), 'valor', round((e->>'valor')::numeric, 2))), '[]')
      into v_extras
      from jsonb_array_elements(case when jsonb_typeof(l->'extras') = 'array' then l->'extras' else '[]' end) e
      where coalesce((e->>'valor')::numeric, 0) <> 0;
    v_total := v_diarias + v_entregas + coalesce((select sum((e->>'valor')::numeric) from jsonb_array_elements(v_extras) e), 0);
    v_pago := coalesce((l->>'ja_pago')::boolean, false);
    v_origem := 'moto:' || v_moto.id || ':' || p_pagamento || ':' || p_unidade;
    select conciliado into v_conc from contas_pagar where origem = v_origem;
    if coalesce(v_conc, false) then continue; end if;

    if v_total <= 0 then
      delete from motoboy_semanas where motoboy_id = v_moto.id and unidade_id = p_unidade and pagamento = p_pagamento;
      delete from contas_pagar where origem = v_origem and not conciliado;
      continue;
    end if;

    insert into motoboy_semanas (motoboy_id, unidade_id, pagamento, diarias, entregas, extras, total, atualizado_por)
    values (v_moto.id, p_unidade, p_pagamento, v_diarias, v_entregas, v_extras, v_total, (eu()).id)
    on conflict (motoboy_id, unidade_id, pagamento) do update set diarias = excluded.diarias, entregas = excluded.entregas,
      extras = excluded.extras, total = excluded.total, atualizado_em = now(), atualizado_por = excluded.atualizado_por;

    v_desc := 'Motoboy ' || to_char(p_pagamento - 7, 'DD/MM') || ' a ' || to_char(p_pagamento - 1, 'DD/MM') || ' · ' || v_moto.nome;
    insert into contas_pagar (centro_custo_id, conta_id, motoboy_id, favorecido, descricao, competencia, vencimento, valor, forma, origem, lote,
      observacao, pago_em, valor_pago)
    values (p_unidade, conta_ecletica('02001005002'), v_moto.id, v_moto.nome, v_desc, date_trunc('month', p_pagamento - 1)::date, p_pagamento,
      v_total, 'pix', v_origem, 'moto:' || p_pagamento, 'Lançada pela semana dos motoboys',
      case when v_pago then least(current_date, p_pagamento) end, case when v_pago then v_total end)
    on conflict (origem) do update set valor = excluded.valor, descricao = excluded.descricao, vencimento = excluded.vencimento,
      pago_em = case when v_pago then coalesce(contas_pagar.pago_em, excluded.pago_em) end,
      valor_pago = case when v_pago then excluded.valor end
    where not contas_pagar.conciliado;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function salvar_motoboys_semana(date, text, jsonb) to authenticated;

-- Semanas lançadas com a situação da conta (paga, conciliada). Gerente também vê, mesmo sem o financeiro.
create function semanas_motoboys(p_de date, p_ate date)
returns table (id uuid, motoboy_id uuid, unidade_id text, pagamento date, diarias numeric, entregas numeric, extras jsonb, total numeric,
  pago_em date, conciliado boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.motoboy_id, s.unidade_id, s.pagamento, s.diarias, s.entregas, s.extras, s.total, c.pago_em, coalesce(c.conciliado, false)
  from motoboy_semanas s
  left join contas_pagar c on c.origem = 'moto:' || s.motoboy_id || ':' || s.pagamento || ':' || s.unidade_id
  where sou_gestao() and s.pagamento between p_de and p_ate
  order by s.pagamento desc
$$;
grant execute on function semanas_motoboys(date, date) to authenticated;

-- Lançar como despesa na conciliação: também para um motoboy.
drop function registrar_movimento(uuid, text, uuid, text, text, text, uuid, uuid);
create function registrar_movimento(p_mov uuid, p_centro text, p_conta uuid, p_favorecido text, p_descricao text, p_chave text,
  p_fornecedor uuid default null, p_funcionario uuid default null, p_motoboy uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
  v_id uuid;
  v_nome text;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Movimento não encontrado.'; end if;
  if m.status <> 'pendente' then raise exception 'Este movimento já foi resolvido.'; end if;
  if m.valor >= 0 then raise exception 'Só saídas viram conta a pagar.'; end if;
  if not exists (select 1 from centros_custo where id = p_centro) then raise exception 'Escolha a loja.'; end if;
  if p_funcionario is not null then
    select nome into v_nome from funcionarios where id = p_funcionario;
    if v_nome is null then raise exception 'Funcionário não encontrado.'; end if;
  elsif p_motoboy is not null then
    select nome into v_nome from motoboys where id = p_motoboy;
    if v_nome is null then raise exception 'Motoboy não encontrado.'; end if;
  end if;
  insert into contas_pagar (centro_custo_id, conta_id, fornecedor_id, funcionario_id, motoboy_id, favorecido, descricao, competencia, vencimento, valor, forma, documento,
    pago_em, valor_pago, pago_por, conciliado, observacao)
  values (p_centro, p_conta, p_fornecedor, p_funcionario, p_motoboy,
    case when p_fornecedor is null then coalesce(v_nome, nullif(trim(p_favorecido), '')) end,
    coalesce(nullif(trim(p_descricao), ''), m.descricao),
    date_trunc('month', m.data)::date, m.data, abs(m.valor), 'transferencia', m.documento,
    m.data, abs(m.valor), (eu()).id, true, 'Lançada pela conciliação bancária')
  returning id into v_id;
  update extrato_movimentos set status = 'conciliado', conta_pagar_id = v_id, conciliado_em = now(), conciliado_por = (eu()).id where id = p_mov;
  if coalesce(p_chave, '') <> '' then
    insert into extrato_regras (chave, centro_custo_id, conta_id, favorecido, fornecedor_id, funcionario_id, motoboy_id, ignorar)
    values (p_chave, p_centro, p_conta, coalesce((select nome from fornecedores where id = p_fornecedor), v_nome, nullif(trim(p_favorecido), '')),
      p_fornecedor, p_funcionario, p_motoboy, false)
    on conflict (chave) do update set centro_custo_id = excluded.centro_custo_id, conta_id = excluded.conta_id,
      favorecido = excluded.favorecido, fornecedor_id = excluded.fornecedor_id, funcionario_id = excluded.funcionario_id,
      motoboy_id = excluded.motoboy_id, ignorar = false, atualizado_em = now();
  end if;
  return v_id;
end $$;
grant execute on function registrar_movimento(uuid, text, uuid, text, text, text, uuid, uuid, uuid) to authenticated;
