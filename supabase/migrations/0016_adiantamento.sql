-- Dois pagamentos por mês (pedido de 07/10): adiantamento no dia 20 e salário no dia 05 do mês seguinte.
-- "mes" é o mês de referência: o adiantamento de outubro sai em 20/10 e o salário de outubro em 05/11.

alter table salarios add column tipo text not null default 'salario' check (tipo in ('salario', 'adiantamento'));
alter table salarios add column desc_adiantamento numeric(12, 2) not null default 0 check (desc_adiantamento >= 0);
alter table salarios drop constraint salarios_pkey;
alter table salarios add primary key (funcionario_id, mes, tipo);
