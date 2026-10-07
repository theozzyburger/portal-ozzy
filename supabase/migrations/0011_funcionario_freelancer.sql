-- Funcionário também pode fazer diária como freelancer na folga (pedido de 07/10).
-- O cadastro de freelancer fica ligado ao funcionário; nesse caso o CPF é opcional.
alter table freelancers add column funcionario_id uuid unique references funcionarios (id);
alter table freelancers alter column cpf drop not null;
alter table freelancers add constraint freelancers_cpf_ou_funcionario check (cpf is not null or funcionario_id is not null);
