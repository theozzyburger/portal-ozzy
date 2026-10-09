-- Conciliação (Heitor, 09/10): um débito sem conta (compra no débito, Pix) pode virar nota ou recibo na hora.
-- A nota guarda o débito do extrato; ao lançar, as contas já entram pagas e o débito fica conciliado.
-- Recibo (nota sem XML) agora pode ter itens: entram no estoque e atualizam o preço do insumo como uma NF-e.
alter table notas_fiscais add column extrato_movimento_id uuid unique references extrato_movimentos (id);

create or replace function lancar_nota(p_nota uuid, p_centro text, p_conta uuid, p_competencia date, p_itens jsonb, p_parcelas jsonb, p_atualizar_preco boolean)
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
  mov extrato_movimentos;
  v_conta uuid;
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
  -- Nota que veio da conciliação: o débito do extrato já pagou (à vista).
  if nf.extrato_movimento_id is not null then
    select * into mov from extrato_movimentos where id = nf.extrato_movimento_id for update;
    if mov.status <> 'pendente' then raise exception 'O débito do extrato ligado a esta nota já foi conciliado. Desligue a nota ou desfaça a conciliação.'; end if;
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
      coalesce(nullif(par ->> 'forma', ''), 'boleto'), case when n > 1 then i end, case when n > 1 then n end, nullif(par ->> 'documento', ''), p_nota)
    returning id into v_conta;
    if mov.id is not null then
      update contas_pagar set pago_em = mov.data, valor_pago = valor, pago_por = (eu()).id, conciliado = true,
        extrato_movimento_id = case when n > 1 then mov.id end
      where id = v_conta;
    end if;
  end loop;
  if mov.id is not null then
    update extrato_movimentos set status = 'conciliado', conta_pagar_id = case when n = 1 then v_conta end, conciliado_em = now(), conciliado_por = (eu()).id
    where id = mov.id;
  end if;
  if p_conta is not null and nf.fornecedor_id is not null then
    update fornecedores set conta_padrao_id = p_conta where id = nf.fornecedor_id;
  end if;
  update notas_fiscais set status = 'lancada', lancada_em = now(), lancada_por = (eu()).id where id = p_nota;
end $$;
