-- Avisos com público escolhido (loja, setores ou pessoas) e holerite da contabilidade anexado ao salário (pedidos de 07/10).

-- Público do aviso: unidade (já existia), setores e pessoas. Nulo = sem filtro.
-- Com pessoas escolhidas, só elas veem (além da gestão).
alter table comunicados add column setores text[];
alter table comunicados add column destinatarios uuid[];

drop policy "ver comunicados" on comunicados;
create policy "ver comunicados" on comunicados for select using (
  sou_gestao()
  or autor_id = (eu()).id
  or case
    when destinatarios is not null then (eu()).id = any (destinatarios)
    else (unidade_id is null or unidade_id = (eu()).unidade_id)
      and (setores is null or (eu()).setor::text = any (setores))
  end
);

-- Holerite (PDF da contabilidade) de cada pagamento. A pessoa baixa o seu quando o mês é liberado.
alter table salarios add column holerite text; -- caminho no bucket "holerites": <funcionario_id>/<mes>-<tipo>.pdf

insert into storage.buckets (id, name, public) values ('holerites', 'holerites', false);
create policy "gestao envia holerites" on storage.objects for insert with check (bucket_id = 'holerites' and sou_gestao());
create policy "gestao troca holerites" on storage.objects for update using (bucket_id = 'holerites' and sou_gestao());
create policy "ver holerites" on storage.objects for select using (
  bucket_id = 'holerites'
  and (
    sou_gestao()
    or exists (select 1 from salarios s where s.holerite = name and s.funcionario_id = (eu()).id and s.liberado)
  )
);

-- Readmissão: quem sai e volta mantém o histórico. Cada período encerrado fica aqui;
-- o cadastro (funcionarios.data_admissao) passa a ser o da volta.
create table vinculos_anteriores (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  admissao date not null,
  desligamento date not null,
  tipo_desligamento text,
  cargo text,
  observacao text,
  registrado_por uuid default (eu()).id references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on vinculos_anteriores (funcionario_id);
alter table vinculos_anteriores enable row level security;
create policy "gestao ve vinculos" on vinculos_anteriores for select using (sou_gestao());
create policy "gestao registra vinculo" on vinculos_anteriores for insert with check (posso_alterar(funcionario_id));
create policy "gestao apaga vinculo" on vinculos_anteriores for delete using (posso_alterar(funcionario_id));

-- Pedido de uniformes: valor fechado com o fornecedor, data do fechamento e previsão de entrega.
alter table uniforme_pedidos add column valor_total numeric(12, 2) check (valor_total >= 0);
alter table uniforme_pedidos add column fechado_em date;
alter table uniforme_pedidos add column previsao_entrega date;
