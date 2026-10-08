-- 0028: dados que saem no contrato de experiência e na guia de exame (pedido de 08/10).
alter table funcionarios add column if not exists rg text;
alter table funcionarios add column if not exists ctps text;
alter table funcionarios add column if not exists endereco text;
