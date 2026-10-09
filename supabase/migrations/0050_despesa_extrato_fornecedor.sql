-- "Lançar como despesa" na conciliação pede o fornecedor (Heitor, 09/10). A regra do extrato lembra o fornecedor para a próxima vez.
alter table extrato_regras add column fornecedor_id uuid references fornecedores (id);

drop function registrar_movimento(uuid, text, uuid, text, text, text);
create function registrar_movimento(p_mov uuid, p_centro text, p_conta uuid, p_favorecido text, p_descricao text, p_chave text, p_fornecedor uuid default null)
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
  insert into contas_pagar (centro_custo_id, conta_id, fornecedor_id, favorecido, descricao, competencia, vencimento, valor, forma, documento,
    pago_em, valor_pago, pago_por, conciliado, observacao)
  values (p_centro, p_conta, p_fornecedor, case when p_fornecedor is null then nullif(trim(p_favorecido), '') end,
    coalesce(nullif(trim(p_descricao), ''), m.descricao),
    date_trunc('month', m.data)::date, m.data, abs(m.valor), 'transferencia', m.documento,
    m.data, abs(m.valor), (eu()).id, true, 'Lançada pela conciliação bancária')
  returning id into v_id;
  update extrato_movimentos set status = 'conciliado', conta_pagar_id = v_id, conciliado_em = now(), conciliado_por = (eu()).id where id = p_mov;
  if coalesce(p_chave, '') <> '' then
    insert into extrato_regras (chave, centro_custo_id, conta_id, favorecido, fornecedor_id, ignorar)
    values (p_chave, p_centro, p_conta, coalesce((select nome from fornecedores where id = p_fornecedor), nullif(trim(p_favorecido), '')), p_fornecedor, false)
    on conflict (chave) do update set centro_custo_id = excluded.centro_custo_id, conta_id = excluded.conta_id,
      favorecido = excluded.favorecido, fornecedor_id = excluded.fornecedor_id, ignorar = false, atualizado_em = now();
  end if;
  return v_id;
end $$;
grant execute on function registrar_movimento(uuid, text, uuid, text, text, text, uuid) to authenticated;
