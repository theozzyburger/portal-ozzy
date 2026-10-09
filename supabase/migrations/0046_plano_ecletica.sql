-- Plano de contas da Eclética dentro dos grupos da DRE (Heitor, 09/10). Gerado por scripts/plano_ecletica.py.
-- Contas do Lucro Fácil com equivalente na Eclética são renomeadas (mesmo id: o que já foi lançado continua certo);
-- as que não têm equivalente ficam inativas; as que faltavam entram como novas no grupo certo.

alter table plano_contas add column ecletica_codigo text unique;

update plano_contas p set nome = v.nome, ecletica_codigo = v.ecl, ativo = true from (values
  ('1.1', 'Mercado', '02001001008'),
  ('1.2', 'Hortifruti', '02001001005'),
  ('1.3', 'Proteínas e Ovos', '02001001002'),
  ('1.4', 'Laticínios', '02001001012'),
  ('1.5', 'Bebidas', '02001001004'),
  ('1.8', 'Embalagens', '02001001006'),
  ('2.1', 'Salários Geral', '02001003001'),
  ('2.2', 'INSS', '02001003006'),
  ('2.3', 'Pró-labore', '02001003002'),
  ('2.4', 'Freelancers Cozinha', '02001003021'),
  ('2.5', 'Refeição / Cesta', '02001003004'),
  ('4.1', 'Aluguel', '02001004001'),
  ('4.2', 'Água e Esgoto', '02001004005'),
  ('4.3', 'Energia Elétrica', '02001004004'),
  ('4.4', 'Gás', '02001001014'),
  ('4.5', 'Telefone e Internet', '02001004006'),
  ('4.9', 'Manutenção e Conservação', '02001004003'),
  ('5.3', 'Transportes', '02001004008'),
  ('5.4', 'Consultoria', '02001006004'),
  ('5.5', 'Contador', '02001006002'),
  ('5.9', 'Estorno Clientes', '02001003010'),
  ('5.15', 'Jurídico', '02001004015'),
  ('5.16', 'Material Gráfico, Divulgação e Marketing', '02001006006'),
  ('5.19', 'Sistema', '02001006005'),
  ('5.20', 'Segurança', '02001004011'),
  ('5.21', 'Impostos', '02001004007'),
  ('5.22', 'Taxas Bancárias', '02001007001'),
  ('6.1', 'Produtos de Limpeza', '02001001013'),
  ('6.2', 'Material de Escritório', '02001006001'),
  ('6.3', 'Utensílios e Descartáveis', '02001001028'),
  ('9.1', 'Dívidas e Empréstimos', '02001007002')
) as v (codigo, nome, ecl) where p.codigo = v.codigo;

insert into plano_contas (codigo, nome, pai_codigo, operacional, ordem, ecletica_codigo) values
  ('1.9', 'Temperos', '1', true, 109, '02001001007'),
  ('1.10', 'Pão', '1', true, 110, '02001001009'),
  ('1.11', 'Doces e Confeitaria', '1', true, 111, '02001001010'),
  ('1.12', 'Picles', '1', true, 112, '02001001011'),
  ('1.13', 'Farinhas, Fermentos e Massas', '1', true, 113, '02001001022'),
  ('1.14', 'Grãos, Cereais e Derivados', '1', true, 114, '02001001024'),
  ('1.15', 'Molhos e Condimentos', '1', true, 115, '02001001025'),
  ('1.16', 'Batata-frita', '1', true, 116, '02001001018'),
  ('1.17', 'Compras Emergenciais', '1', true, 117, '02001001001'),
  ('1.18', 'Compras Não Registradas', '1', true, 118, '02001001020'),
  ('2.6', 'Salários Cozinha', '2', true, 206, '02001003016'),
  ('2.7', 'Salários Atendimento', '2', true, 207, '02001003017'),
  ('2.8', 'Salários Produção', '2', true, 208, '02001003018'),
  ('2.9', 'Salários Adm', '2', true, 209, '02001003019'),
  ('2.10', 'Freelancers Atendimento', '2', true, 210, '02001003020'),
  ('2.11', 'Freelancers Produção', '2', true, 211, '02001003022'),
  ('2.12', 'Freelancers Evento', '2', true, 212, '02001003023'),
  ('2.13', 'FGTS', '2', true, 213, '02001003007'),
  ('2.14', 'Rescisão', '2', true, 214, '02001003003'),
  ('2.15', 'Ações Trabalhistas', '2', true, 215, '02001003013'),
  ('2.16', 'Custo Admissional', '2', true, 216, '02001003014'),
  ('2.17', 'Vale-transporte', '2', true, 217, '02001003005'),
  ('2.18', 'Convênio Médico', '2', true, 218, '02001002004'),
  ('2.19', 'Bonificações', '2', true, 219, '02001002001'),
  ('2.20', 'Uniformes', '2', true, 220, '02001003009'),
  ('3.1', 'Motoboys', '3', true, 301, '02001005002'),
  ('4.15', 'Reformas', '4', true, 415, '02001004002'),
  ('4.16', 'Melhorias', '4', true, 416, '02001004009'),
  ('5.24', 'Nutricionista', '5', true, 524, '02001006010'),
  ('5.25', 'Taxas Amex', '5', true, 525, '02001007015'),
  ('5.26', 'Associações e Entidades de Classe', '5', true, 526, '02001001016'),
  ('5.27', 'Adesivos', '5', true, 527, '02001001019'),
  ('6.4', 'Compra de Equipamentos e Utensílios', '6', true, 604, '02001004014');

update plano_contas set ordem = (split_part(codigo, '.', 1)::int * 100 + coalesce(nullif(split_part(codigo, '.', 2), '')::int, 0));
update plano_contas set ativo = false where ecletica_codigo is null and codigo not in ('1', '10', '10.1', '10.2', '10.3', '10.4', '10.5', '11', '11.1', '11.2', '11.3', '2', '3', '4', '5', '6', '7', '8', '9', '9.2', '9.3', '9.4');
