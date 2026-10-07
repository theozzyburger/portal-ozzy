-- Pagamento pelo banco (pedido de 07/10): o portal gera o arquivo do Itaú (SISPAG, Pix em lote) com os
-- salários do dia 05/20 e as diárias de freelancer da semana. Guarda a conta que paga e o que já foi gerado,
-- para não repetir lote e para, quando a API do Itaú estiver liberada, enviar os mesmos pagamentos por lá.

-- Conta da empresa que paga. Uma linha por conta; "padrao" é a que vem escolhida.
create table contas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0), -- como a gestão chama ("Itaú matriz")
  banco text not null default '341' check (banco ~ '^\d{3}$'),
  empresa_cnpj text not null check (empresa_cnpj ~ '^\d{14}$'),
  empresa_nome text not null check (length(trim(empresa_nome)) > 0),
  agencia text not null check (agencia ~ '^\d{1,5}$'),
  conta text not null check (conta ~ '^\d{1,12}$'),
  dac text not null check (dac ~ '^\d$'), -- dígito da agência/conta
  endereco text,
  numero text,
  cidade text,
  cep text check (cep is null or cep ~ '^\d{8}$'),
  estado text check (estado is null or estado ~ '^[A-Z]{2}$'),
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index on contas_pagamento (padrao) where padrao;

grant all on contas_pagamento to authenticated;
alter table contas_pagamento enable row level security;
create policy "gestao ve contas" on contas_pagamento for select using (sou_gestao());
create policy "gestao mantem contas" on contas_pagamento for all using (sou_gestao()) with check (sou_gestao());

-- Cada arquivo (ou envio por API) gerado, para conferência e para numerar os lotes sem repetir.
create table remessas_pagamento (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity, -- nosso número do arquivo
  conta_id uuid not null references contas_pagamento (id),
  tipo text not null check (tipo in ('salario', 'adiantamento', 'freelancer')),
  referencia text not null, -- mês (AAAA-MM) do salário, ou a semana (AAAA-MM-DD da segunda) das diárias
  data_pagamento date not null,
  quantidade int not null check (quantidade > 0),
  valor_total numeric(14, 2) not null check (valor_total > 0),
  via text not null default 'arquivo' check (via in ('arquivo', 'api')),
  arquivo text, -- nome do arquivo gerado, para a gestão achar no computador
  gerado_por uuid references funcionarios (id),
  criado_em timestamptz not null default now()
);
create index on remessas_pagamento (tipo, referencia);

grant all on remessas_pagamento to authenticated;
alter table remessas_pagamento enable row level security;
create policy "gestao ve remessas" on remessas_pagamento for select using (sou_gestao());
create policy "gestao registra remessas" on remessas_pagamento for insert with check (sou_gestao());
create policy "gestao apaga remessas" on remessas_pagamento for delete using (sou_gestao());
