-- CPF e sexo no cadastro; tipo de documento para os termos de exame de gravidez no desligamento (pedido de 07/10).
alter table funcionarios add column cpf text check (cpf ~ '^\d{11}$');
create unique index funcionarios_cpf on funcionarios (cpf) where cpf is not null;
alter table funcionarios add column sexo text check (sexo in ('feminino', 'masculino'));
alter type tipo_documento add value if not exists 'termo_gravidez';
