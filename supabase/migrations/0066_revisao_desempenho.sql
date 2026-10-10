-- Revisão noturna (10/10): índices que faltavam nas tabelas que mais crescem e regras de acesso que chamavam
-- sou_gestao()/eu() uma vez por linha. Com "(select sou_gestao())" o Postgres calcula uma vez por consulta.
-- As regras continuam dizendo exatamente o mesmo (posso_ver_funcionario já incluía gestão e a própria pessoa).

-- Índices (chaves usadas em filtros, apagamentos em cascata e buscas de preço).
create index if not exists estoque_movimentos_nota_item_idx on estoque_movimentos (nota_item_id) where nota_item_id is not null;
create index if not exists estoque_movimentos_insumo_idx on estoque_movimentos (insumo_id);
create index if not exists contas_pagar_nota_idx on contas_pagar (nota_id) where nota_id is not null;
create index if not exists contas_pagar_extrato_mov_idx on contas_pagar (extrato_movimento_id) where extrato_movimento_id is not null;
create index if not exists contas_pagar_fornecedor_idx on contas_pagar (fornecedor_id) where fornecedor_id is not null;
create index if not exists nota_itens_insumo_idx on nota_itens (insumo_id) where insumo_id is not null;
create index if not exists notas_fiscais_fornecedor_idx on notas_fiscais (fornecedor_id);
create index if not exists folgas_data_idx on folgas (data);
create index if not exists ocorrencias_func_data_idx on ocorrencias (funcionario_id, data);
create index if not exists ocorrencias_data_idx on ocorrencias (data);
create index if not exists documentos_func_idx on documentos (funcionario_id);
create index if not exists fechamentos_para_idx on fechamentos (para);
create index if not exists fechamento_contagens_item_idx on fechamento_contagens (item_id);
create index if not exists fechamento_itens_insumo_idx on fechamento_itens (insumo_id);
create index if not exists producoes_data_idx on producoes (data);

-- Regras de acesso: mesma lógica, calculada uma vez por consulta.
alter policy "gestao edita estoque" on estoque_movimentos using ((select sou_gestao())) with check ((select sou_gestao()));
alter policy "financeiro edita contas a pagar" on contas_pagar using ((select vejo_resultado())) with check ((select vejo_resultado()));
alter policy "financeiro edita extrato" on extrato_movimentos using ((select vejo_resultado())) with check ((select vejo_resultado()));
alter policy "gestao edita notas" on notas_fiscais using ((select sou_gestao())) with check ((select sou_gestao()));
alter policy "gestao edita itens de nota" on nota_itens using ((select sou_gestao())) with check ((select sou_gestao()));
alter policy "ver folgas" on folgas using ((select sou_gestao()) or funcionario_id = (select (eu()).id) or posso_ver_funcionario(funcionario_id));
alter policy "gestao marca folga" on folgas with check ((select sou_gestao()));
alter policy "gestao muda folga" on folgas using ((select sou_gestao())) with check ((select sou_gestao()));
alter policy "ver ocorrencias" on ocorrencias using ((select sou_gestao()) or funcionario_id = (select (eu()).id) or posso_ver_funcionario(funcionario_id));
alter policy "ver documentos" on documentos using (funcionario_id = (select (eu()).id) or (select sou_gestao()));
alter policy "ver funcionarios" on funcionarios using (
  id = (select (eu()).id) or (select sou_gestao())
  or ((select (eu()).nivel) = 'supervisor' and unidade_id = (select (eu()).unidade_id)));
alter policy "gestao ve historico de compras" on compras_historico using ((select sou_gestao()));
alter policy "gestao ve insumos" on insumos using ((select sou_gestao()));
alter policy "gestao edita insumos" on insumos using ((select sou_gestao())) with check ((select sou_gestao()));
alter policy "ve listas de fechamento" on fechamento_itens using ((select sou_gestao()) or (select sou_producao()) or unidade_id = (select (eu()).unidade_id));
alter policy "gestao edita itens de fechamento" on fechamento_itens using ((select sou_gestao()));
alter policy "ve fechamentos" on fechamentos using ((select sou_gestao()) or (select sou_producao()) or unidade_id = (select (eu()).unidade_id));
alter policy "gestao ve salarios, pessoa ve o seu liberado" on salarios using ((select sou_gestao()) or (funcionario_id = (select (eu()).id) and liberado));

-- Funções sem search_path fixo (aviso de segurança do Supabase).
do $$
declare r record;
begin
  for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proconfig is null and p.prokind = 'f'
      and p.proname in ('acerta_nome', 'chamado_fechou_limpa_aguardando', 'contas_pagar_lote_cartao', 'cpf_valido', 'degrau', 'dia_do_mes',
        'distancia_m', 'eventos_carimbo', 'insumos_carimbo', 'nome_proprio', 'preparar_chamado', 'preparar_versao_regulamento')
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
