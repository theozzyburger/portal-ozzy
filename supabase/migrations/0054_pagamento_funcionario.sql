-- Pagamento para funcionário (Heitor, 09/10): a conta a pagar pode ser de um funcionário (salário, vale, reembolso…)
-- e o perfil dele mostra tudo o que já recebeu. Só a gestão (gerente, administrativo, proprietário) vê.
alter table contas_pagar add column funcionario_id uuid references funcionarios (id) on delete set null;
create index on contas_pagar (funcionario_id) where funcionario_id is not null;
alter table extrato_regras add column funcionario_id uuid references funcionarios (id) on delete set null;

-- Contas que vêm do DP (salários) e das diárias de quem também é funcionário já entram ligadas à pessoa.
create function contas_pagar_liga_funcionario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.funcionario_id is null and new.origem is not null then
    if new.origem like 'sal:%' then
      new.funcionario_id := nullif(split_part(new.origem, ':', 2), '')::uuid;
    elsif new.origem like 'freela:%' then
      select funcionario_id into new.funcionario_id from freelancers where id::text = split_part(new.origem, ':', 2);
    end if;
  end if;
  return new;
end $$;
create trigger contas_pagar_liga_funcionario before insert on contas_pagar
  for each row execute function contas_pagar_liga_funcionario();

update contas_pagar set funcionario_id = nullif(split_part(origem, ':', 2), '')::uuid
where funcionario_id is null and origem like 'sal:%' and exists (select 1 from funcionarios f where f.id::text = split_part(origem, ':', 2));
update contas_pagar c set funcionario_id = fl.funcionario_id
from freelancers fl
where c.funcionario_id is null and c.origem like 'freela:%' and fl.id::text = split_part(c.origem, ':', 2) and fl.funcionario_id is not null;

-- Lançar como despesa: agora também para um funcionário.
drop function registrar_movimento(uuid, text, uuid, text, text, text, uuid);
create function registrar_movimento(p_mov uuid, p_centro text, p_conta uuid, p_favorecido text, p_descricao text, p_chave text,
  p_fornecedor uuid default null, p_funcionario uuid default null)
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
  end if;
  insert into contas_pagar (centro_custo_id, conta_id, fornecedor_id, funcionario_id, favorecido, descricao, competencia, vencimento, valor, forma, documento,
    pago_em, valor_pago, pago_por, conciliado, observacao)
  values (p_centro, p_conta, p_fornecedor, p_funcionario,
    case when p_fornecedor is null then coalesce(v_nome, nullif(trim(p_favorecido), '')) end,
    coalesce(nullif(trim(p_descricao), ''), m.descricao),
    date_trunc('month', m.data)::date, m.data, abs(m.valor), 'transferencia', m.documento,
    m.data, abs(m.valor), (eu()).id, true, 'Lançada pela conciliação bancária')
  returning id into v_id;
  update extrato_movimentos set status = 'conciliado', conta_pagar_id = v_id, conciliado_em = now(), conciliado_por = (eu()).id where id = p_mov;
  if coalesce(p_chave, '') <> '' then
    insert into extrato_regras (chave, centro_custo_id, conta_id, favorecido, fornecedor_id, funcionario_id, ignorar)
    values (p_chave, p_centro, p_conta, coalesce((select nome from fornecedores where id = p_fornecedor), v_nome, nullif(trim(p_favorecido), '')), p_fornecedor, p_funcionario, false)
    on conflict (chave) do update set centro_custo_id = excluded.centro_custo_id, conta_id = excluded.conta_id,
      favorecido = excluded.favorecido, fornecedor_id = excluded.fornecedor_id, funcionario_id = excluded.funcionario_id, ignorar = false, atualizado_em = now();
  end if;
  return v_id;
end $$;
grant execute on function registrar_movimento(uuid, text, uuid, text, text, text, uuid, uuid) to authenticated;

-- O que a pessoa já recebeu (contas pagas ou a pagar ligadas a ela). Gerente também vê, mesmo sem ver o financeiro.
create function pagamentos_funcionario(p_func uuid)
returns table (id uuid, descricao text, vencimento date, pago_em date, valor numeric, forma text, conta text, conciliado boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.descricao, c.vencimento, c.pago_em, coalesce(c.valor_pago, c.valor), c.forma, pc.nome, c.conciliado
  from contas_pagar c
  left join plano_contas pc on pc.id = c.conta_id
  where sou_gestao() and c.funcionario_id = p_func
  order by coalesce(c.pago_em, c.vencimento) desc
  limit 300
$$;
grant execute on function pagamentos_funcionario(uuid) to authenticated;
