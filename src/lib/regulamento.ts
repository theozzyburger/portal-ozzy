// Regulamento Interno The Ozzy, revisado 2025 (arquivo enviado pelo Heitor em 07/10/2026).
// Texto igual ao do documento; só foram corrigidos erros de digitação.
// Ao mudar o texto, troque a VERSAO: todo mundo precisa assinar de novo.
export const VERSAO_REGULAMENTO = '2025-revisado'

export interface SecaoRegulamento {
  id: string
  titulo: string
  paragrafos?: string[]
  itens?: string[]
}

export const SECOES_REGULAMENTO: SecaoRegulamento[] = [
  {
    id: 'introducao', titulo: 'Introdução',
    paragrafos: ['O regulamento interno tem como objetivo orientar todos os colaboradores sobre as normas da empresa, estabelecendo direitos e deveres, garantindo organização, segurança, qualidade de vida e produtividade no ambiente de trabalho. O cumprimento dessas normas é obrigatório e o descumprimento poderá gerar medidas disciplinares.'],
  },
  {
    id: 'contratacao', titulo: 'Contratação e transferência',
    paragrafos: ['A empresa poderá realizar transferências de equipe entre unidades sempre que houver necessidade operacional, podendo ocorrer de forma diária, semanal, mensal ou anual. Em caso de mudança de unidade durante o turno, poderá ser concedido adicional de deslocamento equivalente a uma passagem de ônibus ou transporte por aplicativo.'],
  },
  {
    id: 'armarios', titulo: 'Armários, vestiários e pertences pessoais',
    paragrafos: ["Os armários são de uso individual e fornecidos ao colaborador no início de suas atividades. O colaborador receberá um cadeado com senha, cujo uso é obrigatório. Em caso de perda, o valor de reposição será descontado em folha (R$ 20). Pertences deixados fora dos armários poderão ser recolhidos e armazenados no setor de 'Achados e Perdidos' pelo prazo de 30 dias, após o qual poderão ser descartados ou doados."],
  },
  {
    id: 'epis', titulo: 'EPIs e higiene',
    paragrafos: ['A empresa fornecerá gratuitamente todos os Equipamentos de Proteção Individual (EPIs), que são de uso obrigatório. O não uso ou uso incorreto poderá gerar medidas disciplinares. Colaboradores que manipulam alimentos devem seguir todas as normas de higiene e asseio pessoal, incluindo: unhas curtas e limpas, cabelos protegidos, ausência de barba e bigode, e uso de uniforme limpo e completo.'],
  },
  {
    id: 'uniformes', titulo: 'Uniformes',
    paragrafos: ['Os uniformes devem ser utilizados durante a jornada de trabalho e mantidos limpos e em bom estado de conservação. A substituição por desgaste natural será responsabilidade da empresa. Em casos de mau uso, perda ou extravio, o custo poderá ser repassado ao colaborador. O uniforme não deve ser utilizado fora das dependências da empresa.'],
  },
  {
    id: 'celular', titulo: 'Uso de celular',
    paragrafos: ['Durante o expediente, é proibido o uso de celular pessoal, exceto em pausas. Aos líderes, a empresa poderá fornecer celular corporativo, de uso exclusivo para fins profissionais. Não é permitido utilizar celular pessoal na presença de clientes ou em áreas de atendimento.'],
  },
  {
    id: 'pausas', titulo: 'Pausas e intervalos',
    itens: [
      'Cada colaborador terá 1 hora de intervalo por turno, destinada a refeição e descanso.',
      'O intervalo é parte da jornada de trabalho.',
      'O horário será definido pela gerência no início do turno, de acordo com a necessidade operacional.',
      'Refeições devem ser feitas exclusivamente na sala de descanso. É proibido consumir alimentos na cozinha ou em áreas de atendimento.',
      'Pausas adicionais para fumo ou celular devem ocorrer apenas no período de intervalo.',
      'Fumantes não devem fumar utilizando o uniforme da empresa.',
      'Pausas devem ocorrer até as 19h.',
      'É proibido o consumo de bebidas alcoólicas ou substâncias alucinógenas durante o expediente.',
    ],
  },
  {
    id: 'ponto', titulo: 'Registro de ponto',
    itens: [
      'O registro de ponto é obrigatório na entrada, início e fim do intervalo, e saída do expediente.',
      'O ponto deve ser registrado imediatamente, sem atrasos.',
      'O colaborador é responsável por seus registros.',
      'Esquecimentos devem ser comunicados no mesmo dia à gerência, com justificativa válida.',
      'Atrasos ou saídas antecipadas poderão gerar descontos e medidas disciplinares.',
    ],
  },
  {
    id: 'oleo', titulo: 'Coleta de óleo',
    paragrafos: ['A coleta de óleo é responsabilidade de quem recebe a empresa responsável. O líder deverá comunicar a empresa responsável via WhatsApp, agendando a coleta.'],
  },
  {
    id: 'disciplina', titulo: 'Medidas disciplinares',
    paragrafos: ['O descumprimento das normas poderá resultar em medidas disciplinares progressivas:'],
    itens: ['1ª ocorrência: advertência escrita;', '2ª ocorrência: advertência escrita;', '3ª ocorrência: suspensão;', 'Reincidência grave ou fraude: desligamento por justa causa.'],
  },
  { id: 'infracoes', titulo: 'Infrações e sanções' },
  {
    id: 'ferias', titulo: 'Férias e folgas',
    paragrafos: ['As férias devem ser solicitadas com antecedência para organização da equipe. Cada colaborador tem direito a 1 folga semanal às segundas-feiras, e um domingo de folga por mês, definido pela gerência. Os feriados são trabalhados, e é concedido ao empregador o direito de optar pelo pagamento ou concessão de folga futura, sendo avisado previamente aos colaboradores.'],
  },
  {
    id: 'atestados', titulo: 'Atestados e licenças',
    paragrafos: ['Atestados médicos devem ser apresentados em até 4 dias após a ausência, salvo internação. Atestados de acompanhamento de filhos são reconhecidos uma vez por ano, até os 6 anos de idade da criança. Gravidez deve ser comunicada à empresa para organização da licença-maternidade. Em caso de falecimento de parentes próximos (pais, filhos, cônjuge, avós, netos, irmãos), será concedida licença de acordo com a legislação vigente.'],
  },
  {
    id: 'salario', titulo: 'Salário',
    paragrafos: ['O salário é contabilizado do dia 01 ao dia 30/31 de cada mês e pago no dia 05 do mês subsequente. A empresa antecipa 40% do salário em torno do dia 20. O pagamento inclui salário base, vale-transporte e demais benefícios previstos.'],
  },
  {
    id: 'refeicoes', titulo: 'Refeições',
    paragrafos: [
      'O cardápio pré-definido pelos supervisores deverá ser seguido, respeitando os ingredientes permitidos para aquela refeição.',
      'A quantidade deverá ser preparada de acordo com a equipe em expediente e, caso sobre, sob hipótese nenhuma poderá ser levada para casa.',
    ],
    itens: [
      'De terça a sábado, o cardápio de refeições inclui opções com proteína, carboidratos e legumes suficientes para uma alimentação saudável dentro do ambiente de trabalho.',
      'Aos domingos fica estabelecido o cardápio de burgers do cardápio com até 2 carnes, ou uma pizza broto por pessoa.',
      'Lanche do mês apenas no último domingo do mês.',
      'As carnes são de cada indivíduo e não podem ser transferidas para outra pessoa.',
      'Adicional de alface e tomate é livre.',
      'Todos os outros adicionais não estão liberados.',
      'É extremamente proibida a venda de lanches ou pizzas para outros funcionários, sendo cabível pena de suspensão.',
      'É obrigatório que a comanda de cada pedido seja lançada com o nome do colaborador correspondente. Cozinha não faz pedido sem comanda.',
      'O lanche deverá ser consumido em loja, fazendo parte da pausa na jornada de trabalho.',
      'Não poderão ser substituídos por porções, bebidas ou outros pratos do cardápio.',
    ],
  },
  {
    id: 'descontos', titulo: 'Descontos para colaboradores',
    paragrafos: [
      'Para todos os colaboradores dentro do expediente, a empresa fornece 15% de desconto para consumo dos itens da loja.',
      'Para bebidas, exceto bebidas alcoólicas, fica estabelecido o desconto de 30%.',
      'Esse desconto é pessoal e intransferível, limitado apenas aos colaboradores.',
    ],
  },
  {
    id: 'aniversario', titulo: 'Folga de aniversário',
    itens: [
      'Cada colaborador terá direito a 1 (um) dia de folga remunerada no mês do seu aniversário.',
      'A data da folga deverá ser definida em conjunto com a gerência, considerando a escala e as necessidades operacionais.',
      'Caso o aniversário coincida com um dia de folga regular, o colaborador poderá escolher outro dia dentro do mesmo mês.',
      'A folga de aniversário é pessoal e intransferível, não podendo ser convertida em pagamento adicional ou acumulada para meses posteriores.',
      'O pedido deve ser feito com antecedência mínima de 15 dias, para que a escala de trabalho seja ajustada.',
    ],
  },
]

export const GRAUS = [
  { grau: 1, medida: 'Advertência verbal' },
  { grau: 2, medida: 'Advertência escrita' },
  { grau: 3, medida: 'Suspensão' },
  { grau: 4, medida: 'Demissão por justa causa' },
]

export const INFRACOES: { exemplo: string; grau: 1 | 2 | 3 | 4 }[] = [
  { exemplo: 'Uso de celular pessoal em horário de produção', grau: 1 },
  { exemplo: 'Descumprimento do horário de pausa', grau: 1 },
  { exemplo: 'Falta de higiene pessoal (unhas, cabelos soltos, sem touca)', grau: 1 },
  { exemplo: 'Não higienizar corretamente a estação de trabalho', grau: 1 },
  { exemplo: 'Desperdício de insumos por descuido (deixar queimar, cortar errado)', grau: 1 },
  { exemplo: 'Não seguir corretamente receitas e padrões da casa', grau: 2 },
  { exemplo: 'Não comunicar problemas com equipamentos ou insumos', grau: 2 },
  { exemplo: 'Uso indevido de equipamentos (facas, fritadeiras, forno etc.)', grau: 2 },
  { exemplo: 'Desrespeito ao uso de EPIs (luvas, avental, protetores)', grau: 2 },
  { exemplo: 'Não respeitar a ordem de limpeza definida pela equipe', grau: 2 },
  { exemplo: 'Discussões e desentendimentos na cozinha', grau: 2 },
  { exemplo: 'Saída não autorizada do posto de trabalho', grau: 2 },
  { exemplo: 'Manipular alimentos sem higienização correta', grau: 2 },
  { exemplo: 'Desrespeito a colegas, superiores ou clientes', grau: 2 },
  { exemplo: 'Linguagem ofensiva ou comportamento agressivo', grau: 2 },
  { exemplo: 'Não registrar corretamente a saída de mercadorias', grau: 2 },
  { exemplo: 'Faltas ou atrasos reincidentes', grau: 3 },
  { exemplo: 'Consumo inadequado de itens da casa (sem autorização)', grau: 3 },
  { exemplo: 'Roubo ou furto de insumos, bebidas ou equipamentos', grau: 4 },
  { exemplo: 'Consumo de bebidas alcoólicas ou drogas no trabalho', grau: 4 },
  { exemplo: 'Agressão física ou ameaça a colegas/superiores', grau: 4 },
  { exemplo: 'Fraude em registros de ponto ou documentos internos', grau: 4 },
  { exemplo: 'Quebra intencional de equipamentos', grau: 4 },
]

export const termoRegulamento = (nome: string) =>
  `Eu, ${nome}, declaro que li o Regulamento Interno da The Ozzy (revisado 2025), entendi as normas e me comprometo a cumpri-las.`
