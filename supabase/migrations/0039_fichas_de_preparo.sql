-- Fichas de preparo (planilha "Fichas de preparo.xlsx", enviada pelo Heitor em 08/10).
-- Gerado por scripts/importar_fichas_preparo.py. Só acrescenta a coluna modo_preparo, preenche texto e
-- cria preparos novos sem ficha (versão 0): os insumos e custos que já existem não mudam.

alter table receitas add column modo_preparo text;

update receitas set modo_preparo = coalesce(modo_preparo, '1. Adicione os dois ingredientes no processador e misture bem até atingir cremosidade desejada'),
  conservacao = coalesce(conservacao, 'Mangas de confeiteiro refrigerado'), validade_dias = coalesce(validade_dias, null)
where lower(nome) = lower('Prato de pizza') and tipo = 'preparo';
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Molho de tomate', 'preparo', 'propria', 'kg', 'Refrigerada', 5, '1. Coloque a cenoura ralada por poucos minutos na panela até caramelizar
2. Entre com a cebola o azeite e o alho até douras
3. Entre com o tomate com pele cortado em pedaços menores e deixe no fogo até reduzir bem
4. Depois de cerca de 1 hora retire o molho e bata no processador por pouco tempo mantendo o aspecto rústico do molho, sem deixar liso demais

Insumos na planilha (para 1 receita, rende 1): Tomate Italiano 1,5; Cebola 0,12; Alho em pó 0,02; Azeite 0,03; Cenoura 0,03; Sal Refinado 0,001.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Molho de tomate') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Fettuccine pré-cozido', 'preparo', 'propria', 'kg', 'Saquinhos de bobina picotados', null, '1. Ferva a água com sal, tire o macarrão cru da embalagem e regue ele com óleo, coloque ele na água fervendo e mexa constantemente pra não grudar. Retirar em 7 minutos antes de chegar no ponto de comer e armazene em pacotes de 100g

Insumos na planilha (para 1 receita): Fettuccine 0,5.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Fettuccine pré-cozido') and tipo = 'preparo');
update receitas set modo_preparo = coalesce(modo_preparo, '1. Acrescente a farinha e a manteiga na panela e derreta até ficar levemente dourada e com cheiro de pipoca
2. Acrescente o leite aos poucos e mexa com o pão duro deixando sempre liso antes de acrescentar mais leite
3. Faça uma cebola brulle colocando ela na frigideira ou na chapa até ela queimar
4. Acrescente a cebola no molho e deixe cozinhar até chegar no ponto e retire a cebola'),
  conservacao = coalesce(conservacao, 'Refrigerada'), validade_dias = coalesce(validade_dias, 3)
where lower(nome) = lower('Molho Branco') and tipo = 'preparo';
update receitas set modo_preparo = coalesce(modo_preparo, null),
  conservacao = coalesce(conservacao, null), validade_dias = coalesce(validade_dias, null)
where lower(nome) = lower('Polpettone') and tipo = 'preparo';
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Mortadela fatiada', 'preparo', 'propria', 'kg', 'Armazene em saquinhos individuais de 500g.', null, '1. No fatiador, fatie a mortadela na menor espessura possível que não quebre a fatia.

Insumos na planilha (para 1 receita, rende 1): Mortadela 1.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Mortadela fatiada') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Mussarela ralada', 'preparo', 'propria', 'kg', 'Armazene em saquinhos individuais de 1kg.', null, '1. No processador rale as 2 mussarelas, misture tudo e porcione.

Insumos na planilha (para 1 receita, rende 1): Queijo mussarela Monte Castelo 0,5; Queijo mussarela marca intermediária 0,5.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Mussarela ralada') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Mussarela fatiada', 'preparo', 'propria', 'kg', 'Armazene em saquinhos individuais de 500g.', null, '1. No fatiador, fatie a mussarela em espessura que cada fatia pese em média 20g

Insumos na planilha (para 1 receita, rende 1): Queijo mussarela 1.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Mussarela fatiada') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Bacon em cubos na chapa', 'preparo', 'propria', 'kg', null, null, '1. Coloque o bacon na chapa e após começar a soltar óleo adicionar a farinha panko até obter crocância sem queimar

Insumos na planilha (para 1 receita): Bacon em Cubos 0,666; Farinha Panko 0,333.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Bacon em cubos na chapa') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Parma em pacote', 'preparo', 'propria', 'kg', 'Caixa de massa de pizza', null, '1. Retire cada fatia do pacote individualmente colocando em uma caixa para facilitar a utilização no evento.

Insumos na planilha (para 1 receita, rende 1): Presunto Parma 0,5.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Parma em pacote') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Parma e copa', 'preparo', 'propria', 'kg', 'Saquinhos indiividuais', null, '1. Junte 1 fatia de presunto parma com 1 fatia da copa em um saquinho individual.

Insumos na planilha (para 1 receita, rende 1): Presunto Parma 0,015; Copa Lombo 0,05.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Parma e copa') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Purê de batata pronto', 'preparo', 'propria', 'kg', null, null, 'Insumos na planilha (para 1 receita, rende 5): Purê de batata saquinho 0,8.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Purê de batata pronto') and tipo = 'preparo');
update receitas set modo_preparo = coalesce(modo_preparo, '1. Cortar o repolho verde, repolho roxo no fatiador
2. Ralar a cenoura no processador PA7
3. Misture todos os ingredientes em uma caixa bem grande'),
  conservacao = coalesce(conservacao, 'Refrigerada'), validade_dias = coalesce(validade_dias, 2)
where lower(nome) = lower('Coleslaw') and tipo = 'preparo';
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Focaccia em forma', 'preparo', 'propria', 'un', 'Em caixas brancas e congeladas', null, '1. Autólise Refrigerada misturar a farinha total com a ÁGUA GELADA 1 até tirar todos os pontos secos (NÃO SOVAR) Cobrir e levar a câmara fria por 2 a 6 horas.
2. Retirar a massa autolisada, adicionar a batedeira junto com o fermento, o sal e o azeite.
3. Iniciar com velocidade baixa e aumentar para velocidade média no fim adicione o GELO e bata até que o gelo se dissolva completamente
4. Retirar a massa batida e realizar uma dobra e repetir o processo de dobras mais 2 vezes a cada 30-45 minutos em temperatura ambiente
5. Distribuir o peso total em formas de 1,250g com fundo removível, cobrir e armazenar a 4ºC por 12 a 24 horas.
6. Após o período retire as formas deixe em temperatura ambiente de 2 a 5 horas antes de assar.
7. Pré aqueça o forno em temperatura máxima por 10 minutos, e em cada massa regue a superfície com jatos de água e azeite e com os dedos pressione a massa antes de coloca-la no forno. Mão molhada ajuda a não grudar.
8. Assar as focaccias por 35-40 minutos em temperatura máxima. Retirar do formo, remover laterais da forma e fundo imediatamente.
9. Deixar esfriar completamente para cortar, retire as bordas e corte no formato dos pães,cada forma entregará 8 pães, que devem ser cortados ao meio.

Insumos na planilha (para 1 receita, rende 5): Farinha de Trigo Italiana 2,61; Azeite 0,117; Sal 0,047; Fermento Biológico Seco 0,033; Água gelada 1 2; Gelo 0,22.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Focaccia em forma') and tipo = 'preparo');
update receitas set modo_preparo = coalesce(modo_preparo, '1. No processador, coloque o sal, as castanhas e o queijo, processe até formar uma farofa grossa
2. Acrescente o manjericão aos poucos processando até triturar tudo
3. Adicione o azeite em fio enquanto continua processando, até formar um molho homogêneo
4. Ajuste o sal se necessário'),
  conservacao = coalesce(conservacao, 'Mangas de confeiteiro refrigerado'), validade_dias = coalesce(validade_dias, null)
where lower(nome) = lower('Pesto de manjericão') and tipo = 'preparo';
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Stracciatella', 'preparo', 'propria', 'kg', 'Mangas de confeiteiro refrigerado', null, '1. Retire toda a mussarela de búfala dos pacotes e coloque em uma GN
2. Esmague as mussarelas no espremedor de batata
3. Acrescente o creme de queijo minas
4. Misture tudo até homegenizar
5. Porcione em mangas de confeiteiro e etiquete

Insumos na planilha (para 1 receita, rende 1): Mussarela de búfala 0,666; Creme de queijo minas 0,333.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Stracciatella') and tipo = 'preparo');
update receitas set modo_preparo = coalesce(modo_preparo, '1. Coloque as frutas vermelhas e o açucar e deixe reduzir
2. Quando as frutas estiverem bem dessolvidas desligue o fogo esprema o limão e aguarde esfriar
3. Finalize colocando em potinhos individuais de 30ml'),
  conservacao = coalesce(conservacao, 'Potinhos de maionese 30ml'), validade_dias = coalesce(validade_dias, null)
where lower(nome) = lower('Calda de Frutas vermelhas caseira') and tipo = 'preparo';
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Recheio árabe (kafta e molho)', 'preparo', 'propria', 'un', 'Refrigerada', 4, '1. Dobre no meio e esmague na chapa
2. Misture todos os ingredientes até homogenizar

Insumos na planilha (para 1 receita, rende 30): Kafta de Cordeiro 30; Molho de tahine apimentado 0,163; Iogurte 0,815; Pimenta do Reino 0,005; Sal 0,005; Zattar 0,005; Alho em pó 0,005.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Recheio árabe (kafta e molho)') and tipo = 'preparo');
update receitas set modo_preparo = coalesce(modo_preparo, '1. Adicione os dois ingredientes no processador e misture bem até atingir cremosidade desejada'),
  conservacao = coalesce(conservacao, 'Mangas de confeiteiro refrigerado'), validade_dias = coalesce(validade_dias, null)
where lower(nome) = lower('Crema de Queijo') and tipo = 'preparo';
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Pastrami fatiado', 'preparo', 'propria', 'kg', 'Refrigerada', 7, '1. Coloque agua em uma panela grande no fogão e aqueça até ferver
2. Adicione o Pastrami dentro do pacote com o fogo DESLIGADO e aguarde 30 minutos
3. Tire do pacote e coloque no desfiador com a LAMINA CEGA
4. Retire e porcione em 85g em saquinhos individuais

Insumos na planilha (para 1 receita, rende 1): Pastrami 1.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Pastrami fatiado') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Sal de alecrim', 'preparo', 'propria', 'kg', 'Refrigerada', 90, '1. Misture todos os ingredientes e mexa bem

Insumos na planilha (para 1 receita, rende 1): Alecrim em pó 0,05; Sal 0,9; Alecrim folhas 0,05.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Sal de alecrim') and tipo = 'preparo');
insert into receitas (nome, tipo, origem, unidade, conservacao, validade_dias, modo_preparo, versao_atual)
select 'Mostarda da casa', 'preparo', 'propria', 'kg', null, null, '1. Misture tudo e envaze

Insumos na planilha (para 1 receita, rende 1): Mostarda Cêpera 0,79; Mostarda Anciene 0,21.', 0
where not exists (select 1 from receitas where lower(nome) = lower('Mostarda da casa') and tipo = 'preparo');
update receitas set modo_preparo = coalesce(modo_preparo, null),
  conservacao = coalesce(conservacao, 'Armazenar em GN em ambiente seco Sem refrigerar'), validade_dias = coalesce(validade_dias, 15)
where lower(nome) = lower('Massa de Cheesecake') and tipo = 'preparo';
update receitas set modo_preparo = coalesce(modo_preparo, null),
  conservacao = coalesce(conservacao, 'Armazenar em GN em ambiente seco Sem refrigerar'), validade_dias = coalesce(validade_dias, 15)
where lower(nome) = lower('Base Amenteigada de Cheesecake') and tipo = 'preparo';
