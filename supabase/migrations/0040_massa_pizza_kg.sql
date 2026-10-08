-- Massa de pizza por quilo (Heitor, 08/10: "se for 0,200 está por quilo"). As fichas das pizzas usam 0,2 de massa,
-- então a unidade é kg. A ficha da massa (125 g de farinha, fermento, óleo e sal) é de uma bolinha, que pesa
-- por volta de 0,2 kg com a água: a nova versão diz que a receita rende 0,2 kg, com os mesmos itens.
-- Assim o custo da massa por pizza fica o de uma bolinha (antes saía 1/5 disso). Versão nova: a anterior fica guardada.
do $$
declare
  r receitas;
  v receita_versoes;
  n int;
  novo uuid;
begin
  select * into r from receitas where nome = 'Massa de pizza' and tipo = 'preparo';
  if r.id is null or r.unidade = 'kg' then return; end if;
  select * into v from receita_versoes where receita_id = r.id and numero = r.versao_atual;
  n := r.versao_atual + 1;
  insert into receita_versoes (receita_id, numero, rendimento, custo_total, nota)
  values (r.id, n, 0.2, v.custo_total, 'Unidade passou a kg: a receita é de uma bolinha de cerca de 0,2 kg (as pizzas usam 0,2 kg de massa).')
  returning id into novo;
  insert into receita_itens (versao_id, ordem, insumo_id, sub_receita_id, quantidade, aproveitamento)
  select novo, ordem, insumo_id, sub_receita_id, quantidade, aproveitamento from receita_itens where versao_id = v.id;
  update receitas set unidade = 'kg', versao_atual = n, atualizado_em = now() where id = r.id;
end $$;
