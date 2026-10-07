-- Primeiro acesso: cria o Proprietário e liga ao login dele.
-- Antes de rodar:
--   1. Em Authentication > Users > Add user > Create new user, crie o login com
--      e-mail = <seu celular só com números>@portal.theozzy (ex.: 11987654321@portal.theozzy),
--      a senha que você quiser, e marque "Auto Confirm User".
--   2. Troque abaixo 11900000000 pelo mesmo celular (só números) e confira o nome.
-- Depois é só rodar (Run). A senha nunca passa por aqui.

insert into funcionarios (nome, celular, cargo, unidade_id, nivel, status, data_admissao, auth_user_id)
select 'Heitor', '11900000000', 'Proprietário', 'burger-psd', 'proprietario', 'ativo', current_date, u.id
from auth.users u
where u.email = '11900000000@portal.theozzy';

-- Deve mostrar 1 linha com o seu nome. Se não mostrar nada, o e-mail do passo 1 não bate com o celular.
select nome, celular, nivel, auth_user_id is not null as login_ligado from funcionarios;
