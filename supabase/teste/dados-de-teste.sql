-- Dados de teste (fictícios) do ambiente de testes. Só roda no banco de TESTE, nunca no real:
-- a rotina de migrations chama este arquivo apenas no branch "teste".
-- Pode rodar quantas vezes quiser: não duplica nada.

-- Pessoas de exemplo, uma de cada nível, nas três lojas. Celulares 1190000xxxx não existem.
insert into funcionarios (nome, celular, cargo, unidade_id, nivel, setor, turno_id, data_admissao, sexo, cpf)
values
  ('Teste Proprietário', '11900000000', 'Proprietário', 'burger-psd', 'proprietario', 'geral', null, '2020-01-01', 'masculino', null),
  ('Teste Administrativo', '11900000001', 'Assistente administrativa', 'burger-psd', 'administrativo', 'escritorio', 't-escritorio', '2024-03-01', 'feminino', null),
  ('Teste Gerente', '11900000002', 'Gerente', 'burger-va', 'gerente', 'unidade', null, '2023-06-01', 'feminino', null),
  ('Teste Supervisor', '11900000003', 'Supervisor de cozinha', 'burger-psd', 'supervisor', 'cozinha', 't-psd-cozinha', '2024-08-01', 'masculino', null),
  ('Teste Atendente', '11900000004', 'Atendente', 'burger-psd', 'funcionario', 'atendimento', 't-psd-atendimento', '2025-02-10', 'feminino', null),
  ('Teste Cozinheiro', '11900000005', 'Cozinheiro', 'burger-va', 'funcionario', 'cozinha', 't-va-cozinha', '2025-05-05', 'masculino', null),
  ('Teste Pizzaiolo', '11900000006', 'Pizzaiolo', 'pizza', 'funcionario', 'pizzaria', 't-pizza-cozinha', '2025-09-01', 'masculino', null),
  ('Teste Manutenção', '11900000007', 'Manutenção', 'burger-psd', 'manutencao', 'manutencao', 't-manutencao', '2022-01-10', 'masculino', null)
on conflict (celular) do nothing;

-- Liga cada pessoa de teste ao login dela, se o login já foi criado no Supabase de teste
-- (Authentication > Users > Add user, e-mail = <celular>@portal.theozzy).
update funcionarios f set auth_user_id = u.id
from auth.users u
where f.auth_user_id is null and u.email = f.celular || '@portal.theozzy';

select nome, celular, nivel, auth_user_id is not null as login_ligado from funcionarios where celular like '1190000000%' order by celular;
