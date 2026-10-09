-- Contas recorrentes, pessoal no contas a pagar e conciliação de um débito com várias contas (Heitor, 09/10).
--
-- 1. Recorrentes: aluguel, sistemas, nutricionista… viram contas do mês sozinhas depois de confirmadas.
-- 2. Salários (quando liberados) e diárias de freelancer (lojas e eventos) entram no contas a pagar,
--    esperando só a conciliação do extrato.
-- 3. Lote: contas que saem do banco num débito só (fatura do cartão, Pix em lote do SISPAG) conciliam juntas.
-- Só quem vê o financeiro (administrativo e proprietário).

create table contas_recorrentes (
  id uuid primary key default gen_random_uuid(),
  descricao text not null check (length(trim(descricao)) > 0),
  fornecedor_id uuid references fornecedores (id),
  fornecedor_nome text, -- vindo da análise das despesas, até virar fornecedor cadastrado
  centro_custo_id text not null references centros_custo (id),
  conta_id uuid references plano_contas (id),
  valor numeric(14, 2) not null check (valor > 0),
  variavel boolean not null default false, -- o valor muda todo mês (energia, água): o lançado é uma previsão
  dia int not null check (dia between 1 and 31),
  forma text not null default 'boleto' check (forma in ('boleto', 'pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia', 'debito_automatico', 'outro')),
  inicio text not null check (inicio ~ '^\d{4}-\d{2}$'), -- primeiro mês (AAAA-MM)
  fim text check (fim ~ '^\d{4}-\d{2}$'), -- último mês (parcelado); vazio = sem fim
  situacao text not null default 'a_confirmar' check (situacao in ('a_confirmar', 'ativa', 'pausada', 'encerrada')),
  observacao text,
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
alter table contas_recorrentes enable row level security;
create policy "financeiro edita recorrentes" on contas_recorrentes for all using (vejo_resultado()) with check (vejo_resultado());
grant all on contas_recorrentes to authenticated;

alter table contas_pagar add column recorrente_id uuid references contas_recorrentes (id) on delete set null;
-- De onde a conta veio, para não lançar duas vezes: rec:<id>:<mês>, sal:<pessoa>:<mês>:<tipo>, freela:<id>:<semana>:<loja>, freelaev:<evento>:<freela>.
alter table contas_pagar add column origem text unique;
-- Contas que saem num débito só no banco: cartao:<vencimento>, sal:<mês>:<tipo>, freela:<semana>, freelaev:<evento>.
alter table contas_pagar add column lote text;
-- Movimento do extrato que pagou esta conta quando um débito pagou várias.
alter table contas_pagar add column extrato_movimento_id uuid references extrato_movimentos (id) on delete set null;
create index on contas_pagar (lote) where lote is not null;
create index on contas_pagar (recorrente_id);

-- Cartão de crédito: tudo que vence no mesmo dia é a mesma fatura.
create function contas_pagar_lote_cartao() returns trigger
language plpgsql as $$
begin
  if new.forma = 'cartao_credito' and (new.lote is null or new.lote like 'cartao:%') then
    new.lote := 'cartao:' || new.vencimento;
  elsif new.forma <> 'cartao_credito' and new.lote like 'cartao:%' then
    new.lote := null;
  end if;
  return new;
end $$;
create trigger contas_pagar_lote_cartao before insert or update of forma, vencimento, lote on contas_pagar
  for each row execute function contas_pagar_lote_cartao();
update contas_pagar set lote = 'cartao:' || vencimento where forma = 'cartao_credito';

-- Dia do mês sem passar do último dia (dia 31 em fevereiro vira 28/29).
create function dia_do_mes(p_mes text, p_dia int) returns date
language sql immutable as $$
  select least(to_date(p_mes || '-01', 'YYYY-MM-DD') + (p_dia - 1),
               (to_date(p_mes || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date)
$$;

-- Lança as contas das recorrentes ativas do mês atual até p_ate (AAAA-MM). Não mexe no que já foi lançado.
create function gerar_contas_recorrentes(p_ate text) returns int
language plpgsql security definer set search_path = public as $$
declare
  r contas_recorrentes;
  m text;
  v date;
  n int := 0;
  k int;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  for r in select * from contas_recorrentes where situacao = 'ativa' loop
    m := greatest(r.inicio, to_char(current_date, 'YYYY-MM'));
    while m <= least(p_ate, coalesce(r.fim, p_ate)) loop
      v := dia_do_mes(m, r.dia);
      insert into contas_pagar (centro_custo_id, conta_id, fornecedor_id, favorecido, descricao, competencia, vencimento, valor, forma,
        observacao, recorrente_id, origem)
      values (r.centro_custo_id, r.conta_id, r.fornecedor_id, case when r.fornecedor_id is null then r.fornecedor_nome end, r.descricao,
        date_trunc('month', v)::date, v, r.valor, r.forma, case when r.variavel then 'Valor previsto (muda todo mês)' end, r.id,
        'rec:' || r.id || ':' || m)
      on conflict (origem) do nothing;
      get diagnostics k = row_count;
      n := n + k;
      m := to_char(to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month', 'YYYY-MM');
    end loop;
  end loop;
  return n;
end $$;

-- Conta contábil pelo código da Eclética (plano de 0046).
create function conta_ecletica(p_codigo text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from plano_contas where ecletica_codigo = p_codigo
$$;

-- Salários liberados e diárias de freelancer viram contas a pagar (atualiza o valor enquanto não foi paga).
-- Vale para pagamentos a partir de 10/10/2026: o que é anterior já foi pago e lançado fora do portal.
create function sincronizar_pessoal() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  k int;
  corte constant date := date '2026-10-10';
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;

  -- Salário (dia 05 do mês seguinte) e adiantamento (dia 20).
  insert into contas_pagar (centro_custo_id, conta_id, favorecido, descricao, competencia, vencimento, valor, forma, origem, lote, observacao)
  select
    case when f.setor in ('producao', 'escritorio') then 'central' else f.unidade_id end,
    conta_ecletica(case f.setor when 'cozinha' then '02001003016' when 'pizzaria' then '02001003016' when 'atendimento' then '02001003017'
      when 'producao' then '02001003018' when 'escritorio' then '02001003019' else '02001003001' end),
    f.nome,
    (case s.tipo when 'adiantamento' then 'Adiantamento ' else 'Salário ' end) || to_char(to_date(s.mes || '-01', 'YYYY-MM-DD'), 'MM/YYYY') || ' · ' || f.nome,
    to_date(s.mes || '-01', 'YYYY-MM-DD'),
    x.venc, x.liq, 'pix', 'sal:' || s.funcionario_id || ':' || s.mes || ':' || s.tipo, 'sal:' || s.mes || ':' || s.tipo, 'Lançada pelo DP (salários liberados)'
  from salarios s
  join funcionarios f on f.id = s.funcionario_id
  cross join lateral (select
    case s.tipo when 'adiantamento' then to_date(s.mes || '-20', 'YYYY-MM-DD') else to_date(s.mes || '-05', 'YYYY-MM-DD') + interval '1 month' end::date as venc,
    case s.tipo when 'adiantamento' then s.salario
      else s.salario + s.caixinha + s.bonus_caixinha + s.bonus_conclui + s.outros_creditos
        - s.desc_adiantamento - s.desc_faltas - s.desc_atrasos - s.inss - s.desc_vt - s.outros_descontos end as liq) x
  where s.liberado and x.liq > 0 and x.venc >= corte
  on conflict (origem) do update set valor = excluded.valor, vencimento = excluded.vencimento, centro_custo_id = excluded.centro_custo_id,
    descricao = excluded.descricao
  where contas_pagar.pago_em is null and not contas_pagar.conciliado
    and (contas_pagar.valor, contas_pagar.vencimento, contas_pagar.centro_custo_id, contas_pagar.descricao)
      is distinct from (excluded.valor, excluded.vencimento, excluded.centro_custo_id, excluded.descricao);
  get diagnostics k = row_count; n := n + k;
  -- Salário que deixou de estar liberado (ou zerou) sai, se ainda não foi pago.
  delete from contas_pagar c where c.origem like 'sal:%' and c.pago_em is null and not c.conciliado
    and not exists (select 1 from salarios s where c.origem = 'sal:' || s.funcionario_id || ':' || s.mes || ':' || s.tipo and s.liberado);

  -- Diárias dos freelancers das lojas: uma conta por pessoa, semana e loja, paga na segunda seguinte.
  insert into contas_pagar (centro_custo_id, conta_id, favorecido, descricao, competencia, vencimento, valor, forma, origem, lote, observacao,
    pago_em, valor_pago)
  select d.unidade_id,
    conta_ecletica(case when bool_or(d.funcao ~* 'atend|gar[cç]|caixa|sal[aã]o|delivery|balc') and not bool_or(d.funcao ~* 'cozinh|chapa|pizza|prep|lanch')
      then '02001003020' else '02001003021' end),
    fl.nome,
    'Diárias ' || to_char(w.semana, 'DD/MM') || ' a ' || to_char(w.semana + 6, 'DD/MM') || ' · ' || fl.nome,
    date_trunc('month', w.semana + 7)::date, w.semana + 7, sum(d.valor), 'pix',
    'freela:' || d.freelancer_id || ':' || w.semana || ':' || d.unidade_id, 'freela:' || w.semana, 'Lançada pelas diárias de freelancer',
    max(p.pago_em)::date, case when max(p.pago_em) is not null then sum(d.valor) end
  from freela_diarias d
  join freelancers fl on fl.id = d.freelancer_id
  cross join lateral (select (d.data - (extract(isodow from d.data)::int - 1))::date as semana) w
  left join freela_pagamentos p on p.freelancer_id = d.freelancer_id and p.semana = w.semana
  where w.semana + 7 >= corte and d.valor > 0
  group by d.freelancer_id, fl.nome, w.semana, d.unidade_id
  on conflict (origem) do update set valor = excluded.valor, descricao = excluded.descricao, pago_em = coalesce(contas_pagar.pago_em, excluded.pago_em),
    valor_pago = coalesce(contas_pagar.valor_pago, excluded.valor_pago)
  where not contas_pagar.conciliado and (contas_pagar.pago_em is null or contas_pagar.valor_pago is null)
    and (contas_pagar.valor, contas_pagar.pago_em) is distinct from (excluded.valor, coalesce(contas_pagar.pago_em, excluded.pago_em));
  get diagnostics k = row_count; n := n + k;

  -- Freelas de evento: uma conta por pessoa por evento, na segunda depois do último dia dela no evento.
  insert into contas_pagar (centro_custo_id, conta_id, favorecido, descricao, competencia, vencimento, valor, forma, origem, lote, observacao,
    pago_em, valor_pago)
  select 'eventos', conta_ecletica('02001003023'), fe.nome,
    'Diárias ' || e.nome || ' · ' || fe.nome,
    date_trunc('month', x.venc)::date, x.venc, g.valor, 'pix',
    'freelaev:' || g.evento_id || ':' || g.freela_id, 'freelaev:' || g.evento_id, 'Lançada pelas diárias do evento',
    case when g.pago then g.pago_em::date end, case when g.pago then g.valor end
  from (select d.evento_id, d.freela_id, max(d.data) as ultimo, sum(d.valor) as valor, bool_and(d.pago_em is not null) as pago, max(d.pago_em) as pago_em
        from evento_freela_diarias d where d.status = 'aprovado' and d.valor > 0 group by d.evento_id, d.freela_id) g
  join freelas_evento fe on fe.id = g.freela_id
  join eventos e on e.id = g.evento_id
  cross join lateral (select (g.ultimo + (8 - extract(isodow from g.ultimo)::int))::date as venc) x
  where x.venc >= corte
  on conflict (origem) do update set valor = excluded.valor, vencimento = excluded.vencimento, descricao = excluded.descricao,
    pago_em = coalesce(contas_pagar.pago_em, excluded.pago_em), valor_pago = coalesce(contas_pagar.valor_pago, excluded.valor_pago)
  where not contas_pagar.conciliado and (contas_pagar.pago_em is null or contas_pagar.valor_pago is null)
    and (contas_pagar.valor, contas_pagar.vencimento, contas_pagar.pago_em)
      is distinct from (excluded.valor, excluded.vencimento, coalesce(contas_pagar.pago_em, excluded.pago_em));
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- Um débito do extrato paga várias contas (fatura do cartão, Pix em lote). Se a soma não bate,
-- a diferença (juros, IOF, anuidade…) vira uma conta paga na conta contábil escolhida.
create function conciliar_lote(p_mov uuid, p_contas uuid[], p_conta_diferenca uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
  soma numeric;
  dif numeric;
  centro text;
  v_id uuid;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.id is null then raise exception 'Movimento não encontrado.'; end if;
  if m.status <> 'pendente' then raise exception 'Este movimento já foi resolvido.'; end if;
  if m.valor >= 0 then raise exception 'Só saídas pagam contas.'; end if;
  if coalesce(array_length(p_contas, 1), 0) = 0 then raise exception 'Escolha as contas.'; end if;
  if exists (select 1 from contas_pagar where id = any (p_contas) and (conciliado or extrato_movimento_id is not null)) then
    raise exception 'Alguma dessas contas já foi conciliada.';
  end if;
  select sum(coalesce(valor_pago, valor)), min(centro_custo_id) into soma, centro from contas_pagar where id = any (p_contas);
  if soma is null or (select count(*) from contas_pagar where id = any (p_contas)) <> array_length(p_contas, 1) then
    raise exception 'Conta a pagar não encontrada.';
  end if;
  dif := round(abs(m.valor) - soma, 2);
  if dif <> 0 and p_conta_diferenca is null then
    raise exception 'As contas somam % e o débito é de %. Escolha onde lançar a diferença.', soma, abs(m.valor);
  end if;
  if dif < 0 then raise exception 'As contas somam mais que o débito do banco. Tire alguma conta da seleção.'; end if;
  update contas_pagar set conciliado = true, extrato_movimento_id = p_mov,
    pago_em = coalesce(pago_em, m.data), valor_pago = coalesce(valor_pago, valor), pago_por = coalesce(pago_por, (eu()).id)
  where id = any (p_contas);
  if dif > 0 then
    insert into contas_pagar (centro_custo_id, conta_id, descricao, competencia, vencimento, valor, forma, pago_em, valor_pago, pago_por,
      conciliado, extrato_movimento_id, observacao)
    values (centro, p_conta_diferenca, 'Diferença · ' || m.descricao, date_trunc('month', m.data)::date, m.data, dif, 'transferencia',
      m.data, dif, (eu()).id, true, p_mov, 'Diferença lançada na conciliação')
    returning id into v_id;
  end if;
  update extrato_movimentos set status = 'conciliado', conciliado_em = now(), conciliado_por = (eu()).id where id = p_mov;
end $$;

-- Desfazer também solta as contas de um lote (e apaga a diferença lançada).
create or replace function desconciliar_movimento(p_mov uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m extrato_movimentos;
begin
  if not vejo_resultado() then raise exception 'Seu nível de acesso não permite esta ação.'; end if;
  select * into m from extrato_movimentos where id = p_mov for update;
  if m.conta_pagar_id is not null then
    update contas_pagar set conciliado = false where id = m.conta_pagar_id;
  end if;
  delete from contas_pagar where extrato_movimento_id = p_mov and observacao = 'Diferença lançada na conciliação';
  update contas_pagar set conciliado = false, extrato_movimento_id = null where extrato_movimento_id = p_mov;
  update extrato_movimentos set status = 'pendente', conta_pagar_id = null, conciliado_em = null, conciliado_por = null where id = p_mov;
end $$;

grant execute on function gerar_contas_recorrentes(text) to authenticated;
grant execute on function sincronizar_pessoal() to authenticated;
grant execute on function conciliar_lote(uuid, uuid[], uuid) to authenticated;
grant execute on function conta_ecletica(text) to authenticated;
