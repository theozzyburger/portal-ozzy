-- 0029 (reunião de RH de 08/10): tabela de descontos de uniforme, conferência da devolução no desligamento
-- e pedido de ajuste do ponto pelo portal (antes era pelo WhatsApp do escritório).

-- Valor de cada peça, descontado se não for devolvida.
create table uniforme_valores (
  item text primary key,
  valor numeric(10,2) not null check (valor >= 0),
  atualizado_em timestamptz not null default now()
);
alter table uniforme_valores enable row level security;
create policy "ver valores de uniforme" on uniforme_valores for select using ((eu()).id is not null);
create policy "gestao muda valores" on uniforme_valores for all using (sou_gestao()) with check (sou_gestao());

-- Conferência do que voltou: cada linha tem o que foi entregue, o que voltou e o valor da peça.
create table uniforme_devolucoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  itens jsonb not null,                 -- [{ item, tamanho, entregue, devolvido, valor }]
  total_desconto numeric(10,2) not null default 0 check (total_desconto >= 0),
  observacao text,
  conferido_por uuid not null references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on uniforme_devolucoes (funcionario_id);
alter table uniforme_devolucoes enable row level security;
create policy "ver devolucoes" on uniforme_devolucoes for select using (funcionario_id = (eu()).id or sou_gestao());
create policy "gestao confere devolucao" on uniforme_devolucoes for insert with check (sou_gestao() and conferido_por = (eu()).id);
create policy "gestao apaga devolucao" on uniforme_devolucoes for delete using (sou_gestao());

-- Pedido de ajuste do ponto: a pessoa pede, o escritório ajusta no Control iD e marca como feito.
create table ponto_ajustes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('esqueci_entrada', 'esqueci_saida', 'horario_errado', 'equipamento', 'outro')),
  horario text check (horario is null or horario ~ '^\d{2}:\d{2}$'),
  motivo text check (char_length(motivo) <= 500),
  status text not null default 'pendente' check (status in ('pendente', 'feito', 'recusado')),
  resposta text,
  criado_em timestamptz not null default now(),
  resolvido_por uuid references funcionarios (id),
  resolvido_em timestamptz
);
create index on ponto_ajustes (status, criado_em);
create index on ponto_ajustes (funcionario_id);
alter table ponto_ajustes enable row level security;
create policy "ver ajustes de ponto" on ponto_ajustes for select using (funcionario_id = (eu()).id or sou_gestao());
create policy "pedir ajuste de ponto" on ponto_ajustes for insert
  with check (funcionario_id = (eu()).id and status = 'pendente' and resolvido_por is null and data <= current_date);
create policy "gestao resolve ajuste" on ponto_ajustes for update using (sou_gestao()) with check (sou_gestao());
create policy "apagar pedido pendente" on ponto_ajustes for delete using (funcionario_id = (eu()).id and status = 'pendente');
