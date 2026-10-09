-- Revisão do Heitor (09/10) na planilha pagamentos-recorrentes.xlsx:
-- "Fixo sem fim" vira ativa sem data de fim (só para quando ele encerrar o serviço); "Eventual" sai dos recorrentes.
-- Os de cartão continuam a confirmar até sabermos quantas parcelas faltam.

update contas_recorrentes r set situacao = 'ativa', fim = null, variavel = v.variavel,
  observacao = case when v.variavel then 'Valor muda todo mês: lançado pela média, acerte quando a conta chegar.' end
from (values
  ('CONSULTORIA HENRIQUE', 'central', false),
  ('ALUGUEL VILA ANASTACIO', 'central', false),
  ('MKT NAVEGANDO', 'central', false),
  ('NUTRI ANASTACIO', 'central', false),
  ('DARF', 'central', true),
  ('LUIZ HELENO', 'central', false),
  ('ECLETICA MASTER', 'central', false),
  ('ALUGUEL PARQUE SAO DOMINGOS', 'burger-psd', false),
  ('SEGURANCA', 'burger-psd', false),
  ('NUTRI PARQUE', 'burger-psd', false),
  ('ASSOCIACAO BRASILEIRA DE BARES', 'burger-psd', false),
  ('ECLETICA LOJA PARQUE', 'burger-psd', false),
  ('ECLETICA LOJA PIZZA', 'pizza', false),
  ('ABRASEL', 'burger-va', false),
  ('ECLETICA LOJA VILA', 'burger-va', false),
  ('CONTROL ID PONTO', 'central', true),
  ('CHAT GPT', 'central', false),
  ('GOOMER', 'pizza', false),
  ('GOOMER PARQUE', 'burger-psd', false)
) as v (descricao, centro, variavel)
where upper(r.descricao) = v.descricao and r.centro_custo_id = v.centro and r.situacao = 'a_confirmar';

update contas_recorrentes r set situacao = 'encerrada', observacao = 'Eventual (revisão do Heitor em 09/10)'
from (values
  ('FLAVOR HOUSE'), ('MARCELO EMABALAGENS'), ('DESTAQUE MAIS EMBALAGENS'), ('DOCESLANDIA DOCES VAZ'), ('MONITOR ESCRITORIO'),
  ('PIRAPACK'), ('TERPELL EMBALAGENS'), ('NEW PLAST'), ('ANASTACIO COM PROD HORTG LTDA'), ('LAVAGEM DE UNIFORMES'),
  ('DANCHA EIRELI - SP'), ('JET GELO'), ('PANIFICADORA CITY PAO'), ('FREXCO'), ('BENEDITA ANTONIA RUBIO')
) as v (descricao)
where upper(r.descricao) = v.descricao and r.situacao = 'a_confirmar';

update contas_recorrentes set observacao = 'Quantas parcelas faltam? Diga o mês da última.'
where upper(descricao) = 'GIRO PRONAMPE' and situacao = 'a_confirmar';

-- Cartão que apareceu em julho e agosto e não veio na fatura de setembro: a última parcela já foi.
update contas_recorrentes set situacao = 'encerrada', observacao = 'Não veio na fatura de setembro: parcelas terminaram em agosto.'
where upper(descricao) in ('COSME MEIRA DOS SANTOS ANDRAD', 'FURADEIRA', 'MANTEGUEIRA', 'MICROONDAS MANUTENCAO') and situacao = 'a_confirmar';
