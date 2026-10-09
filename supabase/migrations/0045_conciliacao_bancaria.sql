-- Conciliação bancária, parte 1 (Heitor, 09/10): importar o extrato OFX do Itaú e casar cada saída com o contas a pagar.
-- O que não casar fica como "não identificado" para o escritório classificar (vira conta paga) ou ignorar
-- (transferência entre contas, aplicação…). O portal lembra a classificação pelo texto do extrato.
-- Só quem vê o financeiro (administrativo e proprietário). Só acrescenta: nada do que já existe muda.

create table extrato_movimentos (
  id uuid primary key default gen_random_uuid(),
  banco text not null, -- código do banco (341 = Itaú)
  agencia text not null,
  conta text not null,
  fitid text not null, -- identificador do lançamento no OFX (não repete na mesma conta)
  data date not null,
  valor numeric(14, 2) not null, -- saída é negativa
  descricao text not null default '',
  documento text,
  tipo text, -- TRNTYPE do OFX (DEBIT, CREDIT, PAYMENT…)
  status text not null default 'pendente' check (status in ('pendente', 'conciliado', 'ignorado')),
  conta_pagar_id uuid references contas_pagar (id) on delete set null,
  observacao text,
  conciliado_em timestamptz,
  conciliado_por uuid references funcionarios (id),
  importado_em timestamptz not null default now(),
  importado_por uuid default (eu()).id references funcionarios (id),
  unique (banco, agencia, conta, fitid)
);
create index on extrato_movimentos (data);
create unique index on extrato_movimentos (conta_pagar_id) where conta_pagar_id is not null;

-- Memória: texto do extrato (normalizado) → loja e conta contábil usadas da última vez.
create table extrato_regras (
  chave text primary key,
  centro_custo_id text references centros_custo (id),
  conta_id uuid references plano_contas (id),
  favorecido text,
  ignorar boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- Saldo informado no fim de cada arquivo (para conferir com o banco).
create table extrato_saldos (
  banco text not null,
  agencia text not null,
  conta text not null,
  data date not null,
  saldo numeric(14, 2) not null,
  primary key (banco, agencia, conta, data)
);

alter table extrato_movimentos enable row level security;
alter table extrato_regras enable row level security;
alter table extrato_saldos enable row level security;
create policy "financeiro edita extrato" on extrato_movimentos for all using (vejo_resultado()) with check (vejo_resultado());
create policy "financeiro edita regras do extrato" on extrato_regras for all using (vejo_resultado()) with check (vejo_resultado());
create policy "financeiro edita saldos" on extrato_saldos for all using (vejo_resultado()) with check (vejo_resultado());

-- Concilia um movimento com uma conta a pagar (marca a conta como paga na data do extrato, se ainda não estava).
create function conciliar_movimento(p_mov uuid, p_conta uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Movimento não encontrado.'; end if;
  if m.status = 'conciliado' then raise exception 'Este movimento já foi conciliado.'; end if;
  if exists (select 1 from extrato_movimentos where conta_pagar_id = p_conta) then
    raise exception 'Esta conta já está ligada a outro movimento do extrato.';
  end if;
  update contas_pagar set conciliado = true,
    pago_em = coalesce(pago_em, m.data), valor_pago = coalesce(valor_pago, abs(m.valor)), pago_por = coalesce(pago_por, (eu()).id)
  where id = p_conta;
  if not found then raise exception 'Conta a pagar não encontrada.'; end if;
  update extrato_movimentos set status = 'conciliado', conta_pagar_id = p_conta, conciliado_em = now(), conciliado_por = (eu()).id
  where id = p_mov;
end $$;

-- Desfaz: o movimento volta a pendente e a conta deixa de estar conciliada (o pagamento continua registrado).
create function desconciliar_movimento(p_mov uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.conta_pagar_id is not null then
    update contas_pagar set conciliado = false where id = m.conta_pagar_id;
  end if;
  update extrato_movimentos set status = 'pendente', conta_pagar_id = null, conciliado_em = null, conciliado_por = null where id = p_mov;
end $$;

-- Saída que não estava no contas a pagar: vira uma conta já paga e conciliada. Guarda a regra para a próxima vez.
create function registrar_movimento(p_mov uuid, p_centro text, p_conta uuid, p_favorecido text, p_descricao text, p_chave text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
  v_id uuid;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Movimento não encontrado.'; end if;
  if m.status <> 'pendente' then raise exception 'Este movimento já foi resolvido.'; end if;
  if m.valor >= 0 then raise exception 'Só saídas viram conta a pagar.'; end if;
  if not exists (select 1 from centros_custo where id = p_centro) then raise exception 'Escolha a loja.'; end if;
  insert into contas_pagar (centro_custo_id, conta_id, favorecido, descricao, competencia, vencimento, valor, forma, documento,
    pago_em, valor_pago, pago_por, conciliado, observacao)
  values (p_centro, p_conta, nullif(trim(p_favorecido), ''), coalesce(nullif(trim(p_descricao), ''), m.descricao),
    date_trunc('month', m.data)::date, m.data, abs(m.valor), 'transferencia', m.documento,
    m.data, abs(m.valor), (eu()).id, true, 'Lançada pela conciliação bancária')
  returning id into v_id;
  update extrato_movimentos set status = 'conciliado', conta_pagar_id = v_id, conciliado_em = now(), conciliado_por = (eu()).id where id = p_mov;
  if coalesce(p_chave, '') <> '' then
    insert into extrato_regras (chave, centro_custo_id, conta_id, favorecido, ignorar)
    values (p_chave, p_centro, p_conta, nullif(trim(p_favorecido), ''), false)
    on conflict (chave) do update set centro_custo_id = excluded.centro_custo_id, conta_id = excluded.conta_id,
      favorecido = excluded.favorecido, ignorar = false, atualizado_em = now();
  end if;
  return v_id;
end $$;

grant execute on function registrar_movimento(uuid, text, uuid, text, text, text) to authenticated;
grant execute on function conciliar_movimento(uuid, uuid) to authenticated;
grant execute on function desconciliar_movimento(uuid) to authenticated;
