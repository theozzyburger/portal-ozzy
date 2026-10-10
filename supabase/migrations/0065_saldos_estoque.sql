-- Revisão (10/10): o saldo do estoque era somado no navegador com todos os movimentos de todas as lojas, e a busca
-- parava em 1.000 linhas (o saldo e a contagem ficavam errados quando passasse disso). Agora o banco soma.
-- security invoker: vale a mesma regra de acesso da tabela (só a gestão).
create function saldos_estoque(p_centro text)
returns table (insumo_id uuid, quantidade numeric, custo numeric, ultima date)
language sql stable security invoker set search_path = public as $$
  select m.insumo_id, sum(m.quantidade),
    (array_agg(m.custo_unit order by m.data desc, m.criado_em desc) filter (where m.quantidade > 0 and m.custo_unit is not null))[1],
    max(m.data)
  from estoque_movimentos m
  where m.centro_custo_id = p_centro
  group by m.insumo_id
$$;
grant execute on function saldos_estoque(text) to authenticated;
create index if not exists estoque_movimentos_data on estoque_movimentos (data);
