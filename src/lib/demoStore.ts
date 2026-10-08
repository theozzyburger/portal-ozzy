import { degrau, possoAlterar, atendeChamados, vejoResultado, podeGerenciar, podeVerPainel, podeVerDocumentosDe, podeVerFuncionario } from './permissoes'
import { soDigitos, type Store } from './store'
import { cpfValido } from './cpf'
import type { EnvioFreela, ContaPagamento, RemessaPagamento, VinculoAnterior, SolicitacaoUniforme, PedidoUniforme, ItemPedidoUniforme, Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, Salario, DiariaFreela, Freelancer, PagamentoFreela, Chamado, Comunicado, LeituraRegulamento, VersaoRegulamento, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, Unidade } from './types'
import { addDias, hoje, inicioDaSemana } from './datas'
import { avaliacoesDemo, vendasDemo } from './demoVendas'
import { fichasDemo, resultadosDemo } from './demoLucro'
import { addMesesData } from './vencimentos'
import { TURNOS_PADRAO } from './turnos'
import { sha256 } from './regulamento'
import REGULAMENTO_2025 from './regulamento-2025.md?raw'

export const SENHA_DEMO = '1234'

const unidades: Unidade[] = [
  { id: 'burger-psd', nome: 'The Ozzy Burger Parque São Domingos' },
  { id: 'burger-va', nome: 'The Ozzy Burger Vila Anastácio' },
  { id: 'pizza', nome: 'The Ozzy Pizza' },
]

const f = (
  id: string, nome: string, celular: string, cargo: string, unidadeId: string,
  nivel: Funcionario['nivel'], dataAdmissao: string, respondePara: string | null = null,
  status: Funcionario['status'] = 'ativo', dataDesligamento: string | null = null, setor: Funcionario['setor'] = null,
): Funcionario => ({
  id, nome, celular, cargo, unidadeId, nivel, status, dataAdmissao, respondePara, dataDesligamento, setor,
  // Na demonstração a chave Pix é o celular (fictício) e o CPF é inventado, só para dar para testar o arquivo do banco.
  pix: celular, cpf: cpfDeExemplo(celular),
})

// CPF fictício com dígito verificador certo, a partir do celular de exemplo.
function cpfDeExemplo(celular: string): string {
  const base = celular.slice(-9)
  const digito = (n: number) => {
    const s = [...base.slice(0, n - 1)].reduce((t, d, i) => t + Number(d) * (n + 1 - i), 0)
    const r = 11 - (s % 11)
    return r >= 10 ? 0 : r
  }
  const d1 = digito(10)
  const s2 = [...(base + d1)].reduce((t, d, i) => t + Number(d) * (11 - i), 0)
  const r2 = 11 - (s2 % 11)
  return base + d1 + (r2 >= 10 ? 0 : r2)
}

// Equipe real, da planilha de caixinha (06/10/2026). Celulares são fictícios.
// A planilha não tem data de admissão; as de desligamento são a última ocorrência de cada um.
const ADMISSAO_A_CONFIRMAR = '2026-01-05'

const funcionarios: Funcionario[] = [
  f('f1', 'Heitor', '11999990001', 'Proprietário', 'burger-psd', 'proprietario', '2019-03-01'),
  f('p-maria-costa', 'Maria Josélia de Jesus da Costa', '11999990021', 'Gerente', 'burger-psd', 'gerente', ADMISSAO_A_CONFIRMAR, 'f1', 'ativo', null, 'geral'),
  f('p-queli-souza', 'Queli da Silva Souza', '11999990022', 'Supervisor', 'burger-psd', 'supervisor', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'cozinha'),
  f('p-arlene-santos', 'Arlene Aquino dos Santos', '11999990011', 'Supervisor', 'burger-va', 'supervisor', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'unidade'),
  f('p-cibeli-costa', 'Cibeli Alves da Costa', '11999990012', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  f('p-dora-ramos', 'Dora Alice Miranda Ramos', '11999990013', 'Atendente', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-arlene-santos', 'ativo', null, 'atendimento'),
  f('p-gustavo-lima', 'Gustavo Almeida Lima', '11999990014', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  f('p-julia-silva', 'Júlia Vitória Muniz da Silva', '11999990015', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-kaua-silva', 'Kauã de Oliveira da Silva', '11999990016', 'Auxiliar', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-arlene-santos', 'ativo', null, 'cozinha'),
  f('p-kaue-oliveira', 'Kaue Oliveira', '11999990017', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-larissa-porto', 'Larissa Nunes de Oliveira Porto', '11999990018', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-laura-costa', 'Laura Sofia Alves da Costa', '11999990019', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'atendimento'),
  f('p-lucas-torres', 'Lucas Vidal Moreira Torres', '11999990020', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  f('p-victor-correa', 'Victor Hugo da Silva Correa', '11999990023', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'ativo', null, 'cozinha'),
  // Não está na planilha de caixinha. Heitor confirmou em 07/10: Produção, loja Vila Anastácio, fora da caixinha.
  f('p-julia-bernardo', 'Julia Motta Bernardo', '11999990031', 'Colaboradora de produção', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'ativo', null, 'producao'),
  // Manutencista, cadastrado em 07/10. Atende as três lojas; celular fictício.
  f('p-vanderlei', 'Vanderlei Aparecido', '11999990032', 'Manutencista', 'burger-psd', 'manutencao', ADMISSAO_A_CONFIRMAR, 'f1', 'ativo', null, 'manutencao'),
  f('p-caciano-souza', 'Caciano Ribeiro Silva Souza', '11999990024', 'Atendente', 'burger-va', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-arlene-santos', 'inativo', '2026-07-28', 'atendimento'),
  f('p-gilson-silva', 'Gilson Bento Silva', '11999990025', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'inativo', '2026-07-23', 'cozinha'),
  f('p-joao-costa', 'João Victor Alves da Costa', '11999990026', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'inativo', '2026-07-09', 'atendimento'),
  f('p-lucas-oliveira', 'Lucas Jean de Oliveira', '11999990027', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'inativo', '2026-06-30', 'cozinha'),
  f('p-lucilene-mathias', 'Lucilene Aparecida Mathias', '11999990028', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'inativo', '2026-07-03', 'atendimento'),
  f('p-natalia-silva', 'Natália dos Santos Silva', '11999990029', 'Atendente', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-maria-costa', 'inativo', '2026-08-02', 'atendimento'),
  f('p-richard-alexandre', 'Richard Aparecido Fernandes Alexandre', '11999990030', 'Auxiliar', 'burger-psd', 'funcionario', ADMISSAO_A_CONFIRMAR, 'p-queli-souza', 'inativo', '2026-07-12', 'cozinha'),
]

// Turnos começam vazios: a gestão coloca cada pessoa (pedido do Heitor em 07/10).
const turnos = TURNOS_PADRAO.map((t) => ({ ...t }))
const leituras: LeituraRegulamento[] = []
// Versão 1 = arquivo "Regulamento_Interno_Revisado-2025.docx". O hash é calculado na primeira leitura.
const versoes: VersaoRegulamento[] = [
  { id: 'r1', numero: 1, texto: REGULAMENTO_2025, nota: 'Regulamento revisado 2025.', publicadoEm: '2026-10-07T12:00:00Z', publicadoPor: 'f1', hash: '' },
]

const agora = () => new Date().toISOString()
const haHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

// Chamados de EXEMPLO, só para a demonstração.
const chamados: Chamado[] = [
  {
    id: 'ch1', numero: 1, unidadeId: 'burger-va', categoria: 'refrigeracao', gravidade: 'urgente', titulo: 'Freezer de carnes não está gelando',
    descricao: 'O freezer horizontal está em -5 °C desde a abertura. Passei as carnes para o outro freezer, mas ele está cheio.', local: 'Cozinha',
    foto: null, status: 'aberto', abertoPor: 'p-arlene-santos', abertoEm: haHoras(2), responsavelId: null, fechadoEm: null, eventos: [],
  },
  {
    id: 'ch2', numero: 2, unidadeId: 'burger-psd', categoria: 'equipamento', gravidade: 'importante', titulo: 'Chapa esquentando só de um lado',
    descricao: 'O lado direito da chapa demora muito para esquentar. Dá para trabalhar, mas atrasa os pedidos no pico.', local: 'Cozinha',
    foto: null, status: 'andamento', abertoPor: 'p-queli-souza', abertoEm: haHoras(26), responsavelId: 'p-vanderlei', fechadoEm: null,
    eventos: [{ id: 'e1', autorId: 'p-vanderlei', em: haHoras(20), texto: 'Vou passar amanhã cedo para ver o queimador.', status: 'andamento' }],
  },
  {
    id: 'ch3', numero: 3, unidadeId: 'pizza', categoria: 'computador', gravidade: 'importante', titulo: 'Impressora de pedidos falhando',
    descricao: 'A impressora térmica para de imprimir no meio do pedido. Desligar e ligar resolve por um tempo.', local: 'Balcão',
    foto: null, status: 'aguardando', abertoPor: 'p-maria-costa', abertoEm: haHoras(70), responsavelId: 'p-vanderlei', fechadoEm: null,
    eventos: [{ id: 'e2', autorId: 'p-vanderlei', em: haHoras(50), texto: 'Cabo com mau contato. Pedi um cabo novo, chega quinta.', status: 'aguardando' }],
  },
  {
    id: 'ch4', numero: 4, unidadeId: 'burger-psd', categoria: 'reforma', gravidade: 'simples', titulo: 'Pintura descascando no banheiro dos clientes',
    descricao: 'Parede atrás da pia com a pintura soltando.', local: 'Banheiro do salão',
    foto: null, status: 'aberto', abertoPor: 'p-larissa-porto', abertoEm: haHoras(120), responsavelId: null, fechadoEm: null, eventos: [],
  },
  {
    id: 'ch5', numero: 5, unidadeId: 'burger-va', categoria: 'hidraulica', gravidade: 'urgente', titulo: 'Pia da cozinha entupida',
    descricao: 'Água não desce na pia de lavar louça.', local: 'Cozinha',
    foto: null, status: 'resolvido', abertoPor: 'p-dora-ramos', abertoEm: haHoras(170), responsavelId: 'p-vanderlei', fechadoEm: haHoras(165),
    eventos: [{ id: 'e3', autorId: 'p-vanderlei', em: haHoras(165), texto: 'Desentupido e caixa de gordura limpa.', status: 'resolvido' }],
  },
]
let seq = 100
const novoId = (p: string) => `${p}${++seq}`

// Documentos e exames são EXEMPLO (não vieram da planilha).
const documentos: Documento[] = [
  { id: 'd1', funcionarioId: 'p-cibeli-costa', tipo: 'atestado', nomeArquivo: 'atestado.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -9), fim: addDias(hoje(), -8), enviadoPor: 'p-cibeli-costa', criadoEm: addDias(hoje(), -9) + 'T10:12:00Z' },
  { id: 'd2', funcionarioId: 'p-cibeli-costa', tipo: 'documento_pessoal', nomeArquivo: 'rg.jpg', enviadoPor: 'p-maria-costa', criadoEm: '2026-01-05T14:00:00Z' },
  // Dois atestados que somam 18 dias em 60: o portal avisa do INSS.
  { id: 'd3', funcionarioId: 'p-dora-ramos', tipo: 'atestado', nomeArquivo: 'atestado-1.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -40), fim: addDias(hoje(), -31), enviadoPor: 'p-dora-ramos', criadoEm: addDias(hoje(), -40) + 'T09:00:00Z' },
  { id: 'd4', funcionarioId: 'p-dora-ramos', tipo: 'atestado', nomeArquivo: 'atestado-2.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -12), fim: addDias(hoje(), -5), enviadoPor: 'p-dora-ramos', criadoEm: addDias(hoje(), -12) + 'T09:00:00Z' },
]

// [funcionário, dias desde o exame, faltando coprocultura?]
const situacoesExame: [string, number, boolean?][] = [
  ['f1', 120], ['p-maria-costa', 200], ['p-queli-souza', 352], ['p-arlene-santos', 90], ['p-cibeli-costa', 345],
  ['p-dora-ramos', 380], ['p-gustavo-lima', 60], ['p-julia-silva', 250, true], ['p-kaue-oliveira', 30],
  ['p-larissa-porto', 300], ['p-laura-costa', 180], ['p-lucas-torres', 400], ['p-victor-correa', 20],
]
documentos.push(
  ...situacoesExame.flatMap(([fid, dias, semCopro], i): Documento[] => {
    const feito = addDias(hoje(), -dias)
    const vence = addMesesData(feito, 12)
    const base = { funcionarioId: fid, enviadoPor: 'p-maria-costa', realizadoEm: feito, vence, criadoEm: feito + 'T15:00:00Z' }
    return [
      { ...base, id: `ds${i}a`, tipo: 'aso_periodico', nomeArquivo: `aso-${fid}.pdf`, observacao: 'Exemplo · clínica de segurança do trabalho' },
      ...(semCopro ? [] : [{ ...base, id: `ds${i}b`, tipo: 'coprocultura' as const, nomeArquivo: `coprocultura-${fid}.pdf` }]),
      { ...base, id: `ds${i}c`, tipo: 'coproparasitologico', nomeArquivo: `parasitologico-${fid}.pdf` },
    ]
  }),
)

// Assinatura de exemplo (um rabisco em SVG).
const ASSINATURA_DEMO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><path d="M10 70 C30 20 50 20 55 60 S80 90 95 50 S120 20 130 55 S160 80 175 45 S210 30 230 60 S270 70 290 40" fill="none" stroke="#0b0b0c" stroke-width="3" stroke-linecap="round"/></svg>')

const uniformes: EntregaUniforme[] = [
  {
    id: 'u1', funcionarioId: 'p-dora-ramos', data: '2026-01-05', entreguePor: 'p-arlene-santos', observacao: 'Exemplo', criadoEm: '2026-01-05T10:00:00Z',
    itens: [{ item: 'Camiseta', tamanho: 'M', quantidade: 2 }, { item: 'Avental', quantidade: 1 }, { item: 'Boné', quantidade: 1 }],
    assinatura: ASSINATURA_DEMO, assinadoEm: '2026-01-05T10:02:00Z', assinadoVia: 'presencial',
  },
  {
    id: 'u2', funcionarioId: 'p-cibeli-costa', data: '2026-01-05', entreguePor: 'p-queli-souza', observacao: 'Exemplo', criadoEm: '2026-01-05T10:00:00Z',
    itens: [{ item: 'Dólmã', tamanho: 'M', quantidade: 2 }, { item: 'Touca', quantidade: 2 }, { item: 'Luva térmica (EPI)', quantidade: 1 }],
    assinatura: ASSINATURA_DEMO, assinadoEm: '2026-01-05T10:05:00Z', assinadoVia: 'presencial',
  },
  {
    id: 'u3', funcionarioId: 'p-cibeli-costa', data: addDias(hoje(), -1), entreguePor: 'p-maria-costa', observacao: 'Exemplo · troca do dólmã gasto', criadoEm: addDias(hoje(), -1) + 'T16:00:00Z',
    itens: [{ item: 'Dólmã', tamanho: 'M', quantidade: 1 }, { item: 'Avental', quantidade: 1 }],
    assinatura: null, assinadoEm: null, assinadoVia: null,
  },
]
const arquivosDemo = new Map<string, string>()

// Valores reais de setembro/2026, da planilha.
// Freelancers de exemplo (nomes, CPFs e Pix fictícios), com diárias nesta semana e na anterior.
const freelas: Freelancer[] = [
  { id: 'fl1', nome: 'Rafael Mendes Teixeira', cpf: '52998224725', pix: '11988887777', celular: '11988887777', ativo: true, funcionarioId: null },
  { id: 'fl2', nome: 'Bruna Carvalho Lopes', cpf: '11144477735', pix: 'bruna.lopes@email.com', celular: null, ativo: true, funcionarioId: null },
  { id: 'fl3', nome: 'Diego Ferreira Santos', cpf: '39053344705', pix: '39053344705', celular: '11977776666', ativo: true, funcionarioId: null },
]
const diarias: DiariaFreela[] = (() => {
  const seg = inicioDaSemana(hoje())
  const d = (dia: number, fl: string, turno: 'manha' | 'noite', unidadeId: string, funcao: string, valor: number, semana = 0): DiariaFreela => ({
    id: `dd-${semana}-${dia}-${fl}-${turno}`, freelancerId: fl, data: addDias(seg, dia + semana * 7), turno, unidadeId, funcao, valor, observacao: null, lancadoPor: 'p-maria-costa',
  })
  return [
    d(4, 'fl1', 'noite', 'burger-psd', 'Chapeiro', 130, -1), d(5, 'fl1', 'noite', 'burger-psd', 'Chapeiro', 130, -1),
    d(6, 'fl2', 'noite', 'pizza', 'Atendente', 110, -1), d(5, 'fl3', 'noite', 'burger-va', 'Entregador', 100, -1),
    d(0, 'fl1', 'noite', 'burger-psd', 'Chapeiro', 130), d(1, 'fl2', 'manha', 'burger-va', 'Atendente', 100),
  ].filter((x) => x.data <= hoje())
})()
const pagamentos: PagamentoFreela[] = []
// Diárias mandadas pelo link (freelancer) e pelo login (funcionário), esperando a gestão aprovar.
const envios: EnvioFreela[] = (() => {
  const e = (id: string, dias: number, turno: 'manha' | 'noite', x: Partial<EnvioFreela>): EnvioFreela => ({
    id, cpf: null, celular: null, nome: '', pix: '', freelancerId: null, funcionarioId: null, data: addDias(hoje(), -dias), turno,
    unidadeId: 'burger-psd', funcao: 'Chapeiro', observacao: null, status: 'pendente', motivo: null, enviadoEm: new Date().toISOString(), ...x,
  })
  return [
    e('env1', 1, 'noite', { cpf: '52998224725', celular: '11988887777', nome: 'Rafael Mendes Teixeira', pix: '11988887777', freelancerId: 'fl1' }),
    e('env2', 2, 'noite', { cpf: '86288366757', celular: '11966665555', nome: 'Lucas Almeida Rocha', pix: 'lucas.rocha@email.com', unidadeId: 'burger-va', funcao: 'Entregador' }),
    e('env3', 1, 'noite', { cpf: '86288366757', celular: '11966665555', nome: 'Lucas Almeida Rocha', pix: 'lucas.rocha@email.com', unidadeId: 'burger-va', funcao: 'Entregador', observacao: 'Fiquei até 0h30' }),
    e('env4', 1, 'manha', { cpf: '39053344705', celular: '11955554444', nome: 'Diego Ferreira Santos', pix: '11955554444', freelancerId: 'fl3', unidadeId: 'pizza', funcao: 'Atendente' }),
    e('env5', 2, 'noite', { nome: 'Cibeli Alves da Costa', pix: '11999990012', funcionarioId: 'p-cibeli-costa', unidadeId: 'burger-va', funcao: 'Auxiliar de cozinha' }),
  ].filter((x) => x.data >= inicioDaSemana(addDias(hoje(), -7)))
})()

const caixinhas: Record<string, Record<string, number>> = {
  '2026-09': { 'burger-psd': 3616.18, 'burger-va': 1118.34 },
}

// Faltas e advertências reais, da aba Ocorrências da planilha (jun a set/2026).
const ocorrencias: Ocorrencia[] = ([
  ['2026-06-25', 'p-cibeli-costa', 'advertencia'],
  ['2026-06-25', 'p-dora-ramos', 'advertencia'],
  ['2026-06-25', 'p-gilson-silva', 'advertencia'],
  ['2026-06-25', 'p-gilson-silva', 'falta'],
  ['2026-06-25', 'p-joao-costa', 'advertencia'],
  ['2026-06-25', 'p-kaua-silva', 'advertencia'],
  ['2026-06-25', 'p-kaua-silva', 'falta'],
  ['2026-06-25', 'p-laura-costa', 'advertencia'],
  ['2026-06-25', 'p-lucilene-mathias', 'advertencia'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-lucilene-mathias', 'falta'],
  ['2026-06-25', 'p-natalia-silva', 'advertencia'],
  ['2026-06-25', 'p-natalia-silva', 'falta'],
  ['2026-06-25', 'p-richard-alexandre', 'advertencia'],
  ['2026-07-03', 'p-cibeli-costa', 'advertencia'],
  ['2026-07-03', 'p-dora-ramos', 'advertencia'],
  ['2026-07-03', 'p-gilson-silva', 'advertencia'],
  ['2026-07-03', 'p-gilson-silva', 'falta'],
  ['2026-07-03', 'p-joao-costa', 'advertencia'],
  ['2026-07-03', 'p-kaua-silva', 'advertencia'],
  ['2026-07-03', 'p-kaua-silva', 'falta'],
  ['2026-07-03', 'p-laura-costa', 'advertencia'],
  ['2026-07-03', 'p-lucilene-mathias', 'advertencia'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-lucilene-mathias', 'falta'],
  ['2026-07-03', 'p-natalia-silva', 'advertencia'],
  ['2026-07-03', 'p-natalia-silva', 'falta'],
  ['2026-07-03', 'p-richard-alexandre', 'advertencia'],
  ['2026-07-08', 'p-kaua-silva', 'falta'],
  ['2026-07-09', 'p-joao-costa', 'falta'],
  ['2026-07-09', 'p-kaua-silva', 'advertencia'],
  ['2026-07-12', 'p-richard-alexandre', 'falta'],
  ['2026-07-23', 'p-gilson-silva', 'falta'],
  ['2026-07-23', 'p-gilson-silva', 'falta'],
  ['2026-07-25', 'p-julia-silva', 'falta'],
  ['2026-07-26', 'p-julia-silva', 'falta'],
  ['2026-07-27', 'p-julia-silva', 'falta'],
  ['2026-07-28', 'p-caciano-souza', 'advertencia'],
  ['2026-08-02', 'p-natalia-silva', 'advertencia'],
  ['2026-08-11', 'p-cibeli-costa', 'falta'],
  ['2026-08-13', 'p-larissa-porto', 'falta'],
  ['2026-08-13', 'p-lucas-torres', 'advertencia'],
  ['2026-08-25', 'p-julia-bernardo', 'advertencia'],
  ['2026-09-09', 'p-kaua-silva', 'advertencia'],
  ['2026-09-12', 'p-larissa-porto', 'falta'],
  ['2026-09-13', 'p-gustavo-lima', 'falta'],
  ['2026-09-13', 'p-larissa-porto', 'falta'],
  ['2026-09-18', 'p-larissa-porto', 'advertencia'],
  ['2026-09-18', 'p-laura-costa', 'advertencia'],
  ['2026-09-19', 'p-victor-correa', 'falta'],
  ['2026-09-20', 'p-lucas-torres', 'falta'],
  ['2026-09-20', 'p-victor-correa', 'falta'],
  ['2026-09-21', 'p-lucas-torres', 'falta'],
  ['2026-09-21', 'p-victor-correa', 'falta'],
  ['2026-09-22', 'p-victor-correa', 'advertencia'],
  ['2026-09-22', 'p-victor-correa', 'advertencia'],
] as const).map(([data, fid, tipo], i): Ocorrencia => ({
  id: `oc${i}`, funcionarioId: fid, tipo, data,
  descricao: tipo === 'falta' ? 'Falta (importada da planilha de caixinha).' : 'Advertência (importada da planilha de caixinha).',
  registradoPor: 'p-maria-costa', criadoEm: data + 'T12:00:00Z',
}))

const comunicados: Comunicado[] = [
  { id: 'c1', titulo: 'Bem-vindos ao Portal do Time The Ozzy', corpo: 'A partir de agora, comunicados, folgas e documentos ficam aqui. Atestados devem ser enviados pelo portal no mesmo dia, com foto legível.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -2) + 'T12:00:00Z', lidoPor: ['p-maria-costa'] },
  { id: 'c2', titulo: 'Reunião de alinhamento de regras', corpo: 'Gerente e supervisoras: reunião na quinta às 15h para revisar regras e processos. Tragam as dúvidas da equipe.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -1) + 'T09:30:00Z', lidoPor: [] },
  { id: 'c3', titulo: 'Limpeza da chapa no fechamento', corpo: 'A partir de hoje a chapa é limpa no fechamento com o produto indicado no POP. A supervisora confere antes de sair.', unidadeId: 'burger-va', autorId: 'p-arlene-santos', criadoEm: addDias(hoje(), -4) + 'T16:00:00Z', lidoPor: ['p-dora-ramos'] },
]

const semana = inicioDaSemana(hoje())
const folgas: Folga[] = [
  ['p-cibeli-costa', 1], ['p-gustavo-lima', 2], ['p-julia-silva', 3], ['p-kaue-oliveira', 0], ['p-larissa-porto', 1],
  ['p-laura-costa', 2], ['p-lucas-torres', 3], ['p-victor-correa', 0], ['p-dora-ramos', 1], ['p-kaua-silva', 2], ['p-queli-souza', 0],
].flatMap(([fid, d], i) =>
  // Mesmo dia de folga por 5 semanas, para o calendário de 30 dias ter o que mostrar.
  [0, 7, 14, 21, 28].map((s): Folga => ({ id: `g${i}-${s}`, funcionarioId: fid as string, data: addDias(semana, (d as number) + s), tipo: 'normal' })),
)
// Folga de feriado (12/10, Nossa Senhora Aparecida) para mostrar a outra cor.
for (const fid of ['p-larissa-porto', 'p-dora-ramos']) folgas.push({ id: 'gf-' + fid, funcionarioId: fid, data: '2026-10-12', tipo: 'feriado' })

// Admissões de exemplo para a aba Férias mostrar períodos (as demais seguem "a confirmar").
const ADMISSOES_DEMO: Record<string, string> = {
  'p-maria-costa': '2023-03-01', 'p-queli-souza': '2024-11-18', 'p-arlene-santos': '2025-03-10', 'p-vanderlei': '2023-08-01',
}
for (const p of funcionarios) if (ADMISSOES_DEMO[p.id]) p.dataAdmissao = ADMISSOES_DEMO[p.id]
// Sexo de exemplo (no portal de verdade a gestão preenche no cadastro).
const MULHERES = ['p-maria-costa', 'p-queli-souza', 'p-arlene-santos', 'p-cibeli-costa', 'p-dora-ramos', 'p-julia-silva', 'p-larissa-porto', 'p-laura-costa', 'p-julia-bernardo', 'p-lucilene-mathias', 'p-natalia-silva']
for (const p of funcionarios) if (p.nivel !== 'proprietario') p.sexo = MULHERES.includes(p.id) ? 'feminino' : 'masculino'
// Datas de nascimento e contratos de experiência de exemplo (aniversários perto de hoje, para a demonstração mostrar).
{
  const ano = Number(hoje().slice(0, 4))
  const nasc = (fid: string, idade: number, deslocamento: number) => {
    const p = funcionarios.find((x) => x.id === fid)
    if (p) p.dataNascimento = `${ano - idade}${addDias(hoje(), deslocamento).slice(4)}`
  }
  nasc('p-cibeli-costa', 24, 0)
  nasc('p-lucas-torres', 31, 2)
  nasc('p-maria-costa', 38, 40)
  // Admitidos há pouco: um no 1º período (vence em 3 dias) e um no 2º.
  const exp = (fid: string, diasAtras: number) => {
    const p = funcionarios.find((x) => x.id === fid)
    if (p) Object.assign(p, { dataAdmissao: addDias(hoje(), -diasAtras), experienciaDias1: 10, experienciaDias2: 80 })
  }
  exp('p-victor-correa', 6)
  exp('p-kaua-silva', 85)
}
const desligamentosDemo: Desligamento[] = []

// Tamanhos de exemplo para os pedidos de uniforme.
{
  const camisetas = ['P', 'M', 'G', 'M', 'GG', 'P', 'M', 'G']
  funcionarios.filter((p) => p.nivel !== 'proprietario').forEach((p, i) => {
    const mulher = p.sexo === 'feminino'
    p.tamCamiseta = camisetas[i % camisetas.length]
    p.tamCalca = String((mulher ? 36 : 40) + (i % 3) * 2)
    p.tamCalcado = (mulher ? 35 : 39) + (i % 4)
  })
}
const solicitacoesDemo: SolicitacaoUniforme[] = [
  { id: 'su1', funcionarioId: 'p-lucas-torres', itens: ['Sapato'], motivo: 'Sapato gasto, a sola está descolando.', foto: null, status: 'aberta', resposta: null, respondidoPor: null, respondidoEm: null, criadoEm: addDias(hoje(), -2) + 'T15:20:00Z' },
  { id: 'su2', funcionarioId: 'p-dora-ramos', itens: ['Camiseta', 'Avental'], motivo: 'Camiseta manchada de óleo e avental rasgado.', foto: null, status: 'aberta', resposta: null, respondidoPor: null, respondidoEm: null, criadoEm: addDias(hoje(), -1) + 'T11:05:00Z' },
  { id: 'su3', funcionarioId: 'p-cibeli-costa', itens: ['Calça'], motivo: 'Calça ficou pequena.', foto: null, status: 'atendida', resposta: 'Entregue calça 40.', respondidoPor: 'p-maria-costa', respondidoEm: addDias(hoje(), -20) + 'T10:00:00Z', criadoEm: addDias(hoje(), -25) + 'T10:00:00Z' },
]
const pedidosUniformeDemo: PedidoUniforme[] = []
const vinculosDemo: VinculoAnterior[] = [
  { id: 'va1', funcionarioId: 'p-dora-ramos', admissao: '2023-02-01', desligamento: '2023-11-20', tipoDesligamento: 'pedido', cargo: 'Atendente', observacao: null },
]
const itensPedidoDemo: ItemPedidoUniforme[] = []
// Conta de EXEMPLO (a de verdade a gestão cadastra no portal).
const contasDemo: ContaPagamento[] = [
  {
    id: 'cp1', nome: 'Itaú · Parque São Domingos', banco: '341', empresaCnpj: '34533354000113',
    empresaNome: 'The Ozzy Burger Alimentacao Ltda', agencia: '1234', conta: '567890', dac: '1',
    endereco: 'Rua Brigadeiro Henrique Fontenelle', numero: '601', cidade: 'Sao Paulo', cep: '05125000', estado: 'SP', padrao: true,
  },
]
const remessasDemo: RemessaPagamento[] = []

// Equipamentos e preventiva de EXEMPLO (a lista real o Heitor vai passar e a manutenção preenche no portal).
const equipamentosDemo: Equipamento[] = [
  { id: 'eq1', unidadeId: 'burger-va', nome: 'Liquidificador industrial 1', marcaModelo: 'Skymsen LS-04', numeroSerie: null, local: 'Cozinha', dataCompra: '2024-03-15', valorCompra: 1290, valorAtual: 800, foto: null, observacao: null, ativo: true },
  { id: 'eq2', unidadeId: 'burger-va', nome: 'Liquidificador industrial 2', marcaModelo: 'Skymsen LS-04', numeroSerie: null, local: 'Cozinha', dataCompra: '2025-01-10', valorCompra: 1390, valorAtual: 1000, foto: null, observacao: null, ativo: true },
  { id: 'eq3', unidadeId: 'burger-psd', nome: 'Chapa a gás', marcaModelo: 'Venâncio', numeroSerie: null, local: 'Cozinha', dataCompra: '2022-06-01', valorCompra: 3200, valorAtual: 2000, foto: null, observacao: null, ativo: true },
  { id: 'eq4', unidadeId: 'burger-psd', nome: 'Freezer horizontal', marcaModelo: 'Metalfrio 500 L', numeroSerie: null, local: 'Estoque', dataCompra: '2023-02-20', valorCompra: 4100, valorAtual: 2800, foto: null, observacao: null, ativo: true },
  { id: 'eq5', unidadeId: 'pizza', nome: 'Forno de pizza', marcaModelo: null, numeroSerie: null, local: 'Cozinha', dataCompra: null, valorCompra: null, valorAtual: null, foto: null, observacao: 'Data de compra a confirmar', ativo: true },
]
const manutencoesDemo: ManutencaoEquipamento[] = [
  { id: 'me1', equipamentoId: 'eq1', data: '2025-08-12', tipo: 'corretiva', descricao: 'Troca do acoplamento (copo travando).', prestador: 'Assistência Skymsen', custo: 180, chamadoId: null, registradoPor: 'p-vanderlei' },
  { id: 'me2', equipamentoId: 'eq1', data: addDias(hoje(), -20), tipo: 'corretiva', descricao: 'Motor esquentando: troca das escovas.', prestador: 'Vanderlei', custo: 60, chamadoId: null, registradoPor: 'p-vanderlei' },
  { id: 'me3', equipamentoId: 'eq4', data: addDias(hoje(), -95), tipo: 'preventiva', descricao: 'Limpeza do condensador e troca da borracha da tampa.', prestador: 'Vanderlei', custo: 90, chamadoId: null, registradoPor: 'p-vanderlei' },
]
const preventivasDemo: Preventiva[] = [
  { id: 'pv1', unidadeId: null, equipamentoId: null, titulo: 'Limpeza da coifa e dutos', descricao: 'Exemplo. Desengordurar coifa, filtros e dutos.', frequenciaDias: 90, primeiraEm: '2026-01-01', ativo: true },
  { id: 'pv2', unidadeId: null, equipamentoId: null, titulo: "Limpeza da caixa d'água", descricao: 'Exemplo. Guardar o certificado da empresa.', frequenciaDias: 180, primeiraEm: '2026-01-01', ativo: true },
  { id: 'pv3', unidadeId: null, equipamentoId: null, titulo: 'Limpeza do ar-condicionado', descricao: 'Exemplo. Filtros e bandeja.', frequenciaDias: 30, primeiraEm: '2026-01-01', ativo: true },
  { id: 'pv4', unidadeId: 'burger-psd', equipamentoId: 'eq4', titulo: 'Condensador do freezer', descricao: 'Exemplo. Limpar e conferir a borracha.', frequenciaDias: 90, primeiraEm: '2026-01-01', ativo: true },
]
const execucoesDemo: ExecucaoPreventiva[] = [
  { id: 'ex1', preventivaId: 'pv1', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -85), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex2', preventivaId: 'pv1', unidadeId: 'burger-va', feitoEm: addDias(hoje(), -100), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex3', preventivaId: 'pv1', unidadeId: 'pizza', feitoEm: addDias(hoje(), -30), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex4', preventivaId: 'pv2', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -60), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex5', preventivaId: 'pv2', unidadeId: 'burger-va', feitoEm: addDias(hoje(), -60), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex6', preventivaId: 'pv2', unidadeId: 'pizza', feitoEm: addDias(hoje(), -60), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex7', preventivaId: 'pv3', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -10), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex8', preventivaId: 'pv3', unidadeId: 'burger-va', feitoEm: addDias(hoje(), -27), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex9', preventivaId: 'pv3', unidadeId: 'pizza', feitoEm: addDias(hoje(), -12), observacao: null, feitoPor: 'p-vanderlei' },
  { id: 'ex10', preventivaId: 'pv4', unidadeId: 'burger-psd', feitoEm: addDias(hoje(), -95), observacao: null, feitoPor: 'p-vanderlei' },
]
const feriasDemo: Ferias[] = [
  { id: 'fe1', funcionarioId: 'p-maria-costa', aquisitivoInicio: '2023-03-01', inicio: '2024-07-01', dias: 30, abonoDias: 0, observacao: null },
  { id: 'fe2', funcionarioId: 'p-maria-costa', aquisitivoInicio: '2024-03-01', inicio: '2025-09-01', dias: 20, abonoDias: 10, observacao: 'Vendeu 10 dias' },
  { id: 'fe3', funcionarioId: 'p-arlene-santos', aquisitivoInicio: '2025-03-10', inicio: '2026-07-06', dias: 15, abonoDias: 0, observacao: null },
  { id: 'fe4', funcionarioId: 'p-vanderlei', aquisitivoInicio: '2023-08-01', inicio: '2024-12-02', dias: 30, abonoDias: 0, observacao: null },
  { id: 'fe5', funcionarioId: 'p-vanderlei', aquisitivoInicio: '2024-08-01', inicio: '2026-01-12', dias: 20, abonoDias: 0, observacao: null },
]
const decimoDemo: DecimoTerceiro[] = [
  { id: 'dt1', funcionarioId: 'p-maria-costa', ano: 2026, parcela: 1, valor: 2100, pagoEm: '2026-07-10', observacao: 'Adiantada junto com as férias' },
]

// Salários de exemplo do mês passado, já liberados (valores fictícios).
const SALARIO_CARGO: Record<string, number> = { Auxiliar: 1850, Atendente: 1950, Supervisor: 2500, Gerente: 4200 }
const vazio = (funcionarioId: string, mes: string, tipo: Salario['tipo']): Salario => ({
  funcionarioId, mes, tipo, salario: 0, caixinha: 0, bonusCaixinha: 0, bonusConclui: 0, descAdiantamento: 0, descFaltas: 0, descAtrasos: 0, inss: 0, descVt: 0, outrosCreditos: 0, outrosDescontos: 0, observacao: null, liberado: false,
})
const salariosDemo: Salario[] = (() => {
  const d = new Date(hoje() + 'T12:00:00'); d.setMonth(d.getMonth() - 1)
  const mes = d.toISOString().slice(0, 7)
  return funcionarios
    .filter((p) => p.status === 'ativo' && p.nivel !== 'proprietario')
    .map((p, i) => {
      const salario = SALARIO_CARGO[p.cargo] ?? 1900
      const vt = i % 3 !== 0
      const adiantamento = Math.round(salario * 0.4)
      return [{ ...vazio(p.id, mes, 'adiantamento'), salario: adiantamento, liberado: true }, {
        funcionarioId: p.id, mes, tipo: 'salario' as const, descAdiantamento: adiantamento, salario, caixinha: 380 + (i % 4) * 45, bonusCaixinha: i % 5 === 0 ? 120 : 0, bonusConclui: i % 4 === 0 ? 100 : 0,
        descFaltas: i % 6 === 1 ? Math.round(salario / 30) : 0, descAtrasos: i % 7 === 2 ? 25 : 0,
        inss: Math.round(salario * 0.08 * 100) / 100, descVt: vt ? Math.round(salario * 0.06 * 100) / 100 : 0, outrosCreditos: 0, outrosDescontos: 0, observacao: null, liberado: true,
      }]
    }).flat()
})()
for (const s of salariosDemo.filter((x) => x.tipo === 'salario')) { const p = funcionarios.find((x) => x.id === s.funcionarioId); if (p) p.optaVt = s.descVt > 0 }

const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 80))

export function criarDemoStore(): Store & { entrarComo(id: string): Promise<Funcionario>; perfisDemo(): Funcionario[] } {
  let eu: Funcionario | null = null
  const exigeEu = () => {
    if (!eu) throw new Error('Sessão expirada')
    return eu
  }
  const exigeGestao = () => {
    const u = exigeEu()
    if (!podeGerenciar(u.nivel)) throw new Error('Seu nível de acesso não permite esta ação.')
    return u
  }
  const exigePainel = () => {
    const u = exigeEu()
    if (!podeVerPainel(u.nivel)) throw new Error('Seu nível de acesso não permite ver o painel.')
    return u
  }
  const porId = (id: string) => funcionarios.find((x) => x.id === id)!
  const exigeManutencao = () => {
    const u = exigeEu()
    if (!atendeChamados(u.nivel)) throw new Error('Só a manutenção e a gestão.')
    return u
  }
  const tira = <T extends { id: string }>(lista: T[], id: string) => {
    const i = lista.findIndex((x) => x.id === id)
    if (i >= 0) lista.splice(i, 1)
  }

  const gravarEnvios = (dias: { data: string; turno: 'manha' | 'noite'; observacao?: string }[], base: Omit<EnvioFreela, 'id' | 'data' | 'turno' | 'observacao' | 'status' | 'motivo' | 'enviadoEm'>) => {
    if (!dias.length) throw new Error('Escolha pelo menos um dia.')
    if (!base.funcao.trim()) throw new Error('Diga a função que você fez.')
    if (!base.pix.trim()) throw new Error('Coloque a chave Pix.')
    if (dias.some((d) => d.data > hoje() || d.data < addDias(hoje(), -13))) throw new Error('Só dá para mandar diárias dos últimos 14 dias.')
    let n = 0
    for (const d of dias) {
      const quem = base.funcionarioId ?? base.cpf
      if (envios.some((x) => x.status !== 'recusado' && (x.funcionarioId ?? x.cpf) === quem && x.data === d.data && x.turno === d.turno)) continue
      envios.push({ ...base, id: novoId('env'), data: d.data, turno: d.turno, observacao: d.observacao?.trim() || null, status: 'pendente', motivo: null, enviadoEm: agora() })
      n++
    }
    return espera(n)
  }

  return {
    modo: 'demo',
    perfisDemo: () => funcionarios.filter((x) => x.status === 'ativo'),
    async entrarComo(id) {
      eu = porId(id)
      return espera(eu)
    },
    sessaoAtual: () => espera(eu),
    async entrar(celular, senha) {
      const alvo = funcionarios.find((x) => x.celular === soDigitos(celular) && x.status === 'ativo')
      if (!alvo || senha !== SENHA_DEMO) throw new Error('Celular ou senha incorretos.')
      eu = alvo
      return espera(eu)
    },
    async sair() {
      eu = null
    },
    unidades: () => espera(unidades),
    nomes: () => espera(funcionarios.map(({ id, nome }) => ({ id, nome }))),
    async funcionarios() {
      const u = exigeEu()
      return espera(funcionarios.filter((x) => podeVerFuncionario(u, x)))
    },
    async salvarFuncionario(dados) {
      const u = exigeGestao()
      const alvo = dados.id ? porId(dados.id) : null
      if ((alvo && !possoAlterar(u, alvo)) || degrau(dados.nivel) > degrau(u.nivel)) throw new Error('Você não pode alterar quem está acima de você')
      if (dados.id) {
        const i = funcionarios.findIndex((x) => x.id === dados.id)
        funcionarios[i] = { ...funcionarios[i], ...dados, id: dados.id }
        return espera(funcionarios[i])
      }
      const novo = { ...dados, id: novoId('f') } as Funcionario
      funcionarios.push(novo)
      return espera(novo)
    },
    async documentos(fid) {
      const u = exigeEu()
      if (!podeVerDocumentosDe(u, porId(fid))) return espera([])
      return espera(documentos.filter((d) => d.funcionarioId === fid).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
    },
    async enviarDocumento(d) {
      const u = exigeEu()
      if (u.id !== d.funcionarioId && !podeGerenciar(u.nivel)) throw new Error('Você só pode enviar os seus documentos.')
      const doc: Documento = {
        id: novoId('d'), funcionarioId: d.funcionarioId, tipo: d.tipo, nomeArquivo: d.arquivo.name,
        observacao: d.observacao || null, inicio: d.inicio || null, fim: d.fim || null,
        realizadoEm: d.realizadoEm || null, vence: d.vence || null, enviadoPor: u.id, criadoEm: agora(),
      }
      arquivosDemo.set(doc.id, URL.createObjectURL(d.arquivo))
      documentos.push(doc)
      return espera(doc)
    },
    async abrirDocumento(d) {
      return arquivosDemo.get(d.id) ?? null
    },
    async documentosTodos() {
      const u = exigeEu()
      return espera(documentos.filter((d) => podeVerDocumentosDe(u, porId(d.funcionarioId))))
    },
    async uniformes(fid) {
      const u = exigeEu()
      if (!podeVerFuncionario(u, porId(fid))) return espera([])
      return espera(uniformes.filter((x) => x.funcionarioId === fid).sort((a, b) => b.data.localeCompare(a.data)))
    },
    async registrarUniforme(e) {
      const u = exigeGestao()
      const nova: EntregaUniforme = {
        id: novoId('u'), funcionarioId: e.funcionarioId, data: e.data, itens: e.itens, observacao: e.observacao || null,
        entreguePor: u.id, criadoEm: agora(),
        assinatura: e.assinatura ?? null, assinadoEm: e.assinatura ? agora() : null, assinadoVia: e.assinatura ? 'presencial' : null,
      }
      uniformes.push(nova)
      return espera(nova)
    },
    async assinarUniforme(id, assinatura) {
      const u = exigeEu()
      const x = uniformes.find((y) => y.id === id)
      if (!x || x.funcionarioId !== u.id) throw new Error('Só a própria pessoa pode assinar este termo.')
      if (x.assinatura) throw new Error('Este termo já foi assinado.')
      Object.assign(x, { assinatura, assinadoEm: agora(), assinadoVia: 'portal' })
    },
    async ocorrencias(fid) {
      const u = exigeEu()
      if (!podeVerFuncionario(u, porId(fid))) return espera([])
      return espera(ocorrencias.filter((o) => o.funcionarioId === fid).sort((a, b) => b.data.localeCompare(a.data)))
    },
    async ocorrenciasEntre(inicio, fim) {
      const u = exigeEu()
      return espera(ocorrencias.filter((o) => o.data >= inicio && o.data <= fim && podeVerFuncionario(u, porId(o.funcionarioId))))
    },
    async atestadosEntre(inicio, fim) {
      const u = exigeEu()
      return espera(
        documentos.filter((d) => {
          const dia = d.inicio ?? d.criadoEm.slice(0, 10)
          return d.tipo === 'atestado' && dia >= inicio && dia <= fim && podeVerDocumentosDe(u, porId(d.funcionarioId))
        }),
      )
    },
    async registrarOcorrencia(o) {
      const u = exigeGestao()
      const nova = { ...o, id: novoId('o'), registradoPor: u.id, criadoEm: agora() }
      ocorrencias.push(nova)
      return espera(nova)
    },
    async comunicados() {
      const u = exigeEu()
      const visiveis = comunicados.filter((c) =>
        podeGerenciar(u.nivel) || c.autorId === u.id ||
        (c.destinatarios?.length
          ? c.destinatarios.includes(u.id)
          : (c.unidadeId === null || c.unidadeId === u.unidadeId) && (!c.setores?.length || (!!u.setor && c.setores.includes(u.setor)))))
      return espera([...visiveis].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
    },
    async publicarComunicado(c) {
      const u = exigeGestao()
      const novo: Comunicado = { ...c, id: novoId('c'), autorId: u.id, criadoEm: agora(), lidoPor: [u.id] }
      comunicados.push(novo)
      return espera(novo)
    },
    async marcarLido(id) {
      const u = exigeEu()
      const c = comunicados.find((x) => x.id === id)
      if (c && !c.lidoPor.includes(u.id)) c.lidoPor.push(u.id)
    },
    async folgas(inicio, fim) {
      const u = exigeEu()
      return espera(
        folgas.filter((g) => g.data >= inicio && g.data <= fim && podeVerFuncionario(u, porId(g.funcionarioId))),
      )
    },
    async alternarFolga(fid, data) {
      exigeGestao()
      const i = folgas.findIndex((g) => g.funcionarioId === fid && g.data === data)
      if (i >= 0) folgas.splice(i, 1)
      else folgas.push({ id: novoId('g'), funcionarioId: fid, data, tipo: 'normal' })
    },
    async definirFolga(fid, data, tipo) {
      exigeGestao()
      const i = folgas.findIndex((g) => g.funcionarioId === fid && g.data === data)
      if (i >= 0) folgas.splice(i, 1)
      if (tipo) folgas.push({ id: novoId('g'), funcionarioId: fid, data, tipo })
    },
    async ferias(fid) {
      exigeGestao()
      return espera(feriasDemo.filter((f) => !fid || f.funcionarioId === fid).sort((a, b) => b.inicio.localeCompare(a.inicio)).map((f) => ({ ...f })))
    },
    async registrarFerias(f) {
      const u = exigeGestao()
      if (!possoAlterar(u, porId(f.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      feriasDemo.push({ ...f, id: novoId('fe') })
    },
    async excluirFerias(id) {
      exigeGestao()
      const i = feriasDemo.findIndex((f) => f.id === id)
      if (i >= 0) feriasDemo.splice(i, 1)
    },
    async decimoTerceiro(fid) {
      exigeGestao()
      return espera(decimoDemo.filter((d) => d.funcionarioId === fid).sort((a, b) => b.ano - a.ano || a.parcela - b.parcela).map((d) => ({ ...d })))
    },
    async registrarDecimoTerceiro(d) {
      const u = exigeGestao()
      if (!possoAlterar(u, porId(d.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      if (decimoDemo.some((x) => x.funcionarioId === d.funcionarioId && x.ano === d.ano && x.parcela === d.parcela)) throw new Error('Essa parcela já foi registrada')
      decimoDemo.push({ ...d, id: novoId('dt') })
    },
    async excluirDecimoTerceiro(id) {
      exigeGestao()
      const i = decimoDemo.findIndex((d) => d.id === id)
      if (i >= 0) decimoDemo.splice(i, 1)
    },
    async desligamentos(fid) {
      exigeGestao()
      return espera(desligamentosDemo.filter((d) => !fid || d.funcionarioId === fid).sort((a, b) => b.data.localeCompare(a.data)).map((d) => ({ ...d, itens: { ...d.itens } })))
    },
    async abrirDesligamento(d) {
      const u = exigeGestao()
      if (!possoAlterar(u, porId(d.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      const novo: Desligamento = { ...d, id: novoId('dl'), itens: {}, observacao: d.observacao?.trim() || null, concluido: false }
      desligamentosDemo.push(novo)
      return espera({ ...novo })
    },
    async excluirDesligamento(id) {
      exigeGestao()
      tira(desligamentosDemo, id)
    },
    async atualizarDesligamento(id, m) {
      const u = exigeGestao()
      const d = desligamentosDemo.find((x) => x.id === id)
      if (!d) throw new Error('Desligamento não encontrado')
      if (!possoAlterar(u, porId(d.funcionarioId))) throw new Error('Você não pode alterar quem está acima de você')
      Object.assign(d, m)
    },
    async vendasEntre(inicio, fim) {
      exigePainel()
      return espera(vendasDemo(inicio, fim))
    },
    async caixinhaTotais(mes) {
      exigeGestao()
      return espera({ ...(caixinhas[mes] ?? {}) })
    },
    async salvarCaixinhaTotal(mes, unidadeId, valor) {
      exigeGestao()
      caixinhas[mes] = { ...(caixinhas[mes] ?? {}), [unidadeId]: valor }
    },
    async salarios(mes) {
      exigeGestao()
      return espera(salariosDemo.filter((s) => s.mes === mes).map((s) => ({ ...s })))
    },
    async salariosDe(funcionarioId) {
      const gestao = eu && podeGerenciar(eu.nivel)
      if (!gestao && eu?.id !== funcionarioId) return espera([])
      return espera(salariosDemo.filter((s) => s.funcionarioId === funcionarioId && (gestao || s.liberado)).sort((a, b) => b.mes.localeCompare(a.mes)).map((s) => ({ ...s })))
    },
    async enviarHolerite(s, pdf) {
      exigeGestao()
      const x = salariosDemo.find((y) => y.funcionarioId === s.funcionarioId && y.mes === s.mes && y.tipo === s.tipo)
      const caminho = `${s.funcionarioId}/${s.mes}-${s.tipo}.pdf`
      arquivosDemo.set('holerite:' + caminho, URL.createObjectURL(pdf))
      if (x) x.holerite = caminho
    },
    async abrirHolerite(s) {
      return s.holerite ? arquivosDemo.get('holerite:' + s.holerite) ?? null : null
    },
    async vinculosAnteriores(fid) {
      exigeGestao()
      return espera(vinculosDemo.filter((v) => v.funcionarioId === fid).sort((a, b) => b.admissao.localeCompare(a.admissao)).map((v) => ({ ...v })))
    },
    async readmitir(f, novaAdmissao, tipo) {
      const u = exigeGestao()
      const p = porId(f.id)
      if (!possoAlterar(u, p)) throw new Error('Você não pode alterar quem está acima de você')
      if (p.dataDesligamento) vinculosDemo.push({ id: novoId('va'), funcionarioId: p.id, admissao: p.dataAdmissao, desligamento: p.dataDesligamento, tipoDesligamento: tipo, cargo: p.cargo, observacao: null })
      Object.assign(p, { status: 'ativo', dataAdmissao: novaAdmissao, dataDesligamento: null, experienciaDias1: null, experienciaDias2: null })
    },
    async salvarSalario(s) {
      exigeGestao()
      const i = salariosDemo.findIndex((x) => x.funcionarioId === s.funcionarioId && x.mes === s.mes && x.tipo === s.tipo)
      if (i >= 0) salariosDemo[i] = { ...s }
      else salariosDemo.push({ ...s })
    },
    async liberarSalarios(mes, tipo, liberado) {
      exigeGestao()
      salariosDemo.filter((s) => s.mes === mes && s.tipo === tipo).forEach((s) => (s.liberado = liberado))
    },
    async avaliacoes() {
      exigePainel()
      return espera(avaliacoesDemo())
    },
    turnos: () => espera(turnos),
    async atribuirTurno(fid, turnoId) {
      exigeGestao()
      porId(fid).turnoId = turnoId
    },
    async salvarTurno(t, novo) {
      exigeGestao()
      const i = turnos.findIndex((x) => x.id === t.id)
      if (novo || i < 0) turnos.push({ ...t })
      else turnos[i] = { ...t }
    },
    async excluirTurno(id) {
      exigeGestao()
      turnos.splice(turnos.findIndex((x) => x.id === id), 1)
      for (const f of funcionarios) if (f.turnoId === id) f.turnoId = null
    },
    async chamados() {
      const u = exigeEu()
      const ver = (c: Chamado) => atendeChamados(u.nivel) || c.abertoPor === u.id || c.unidadeId === u.unidadeId
      return espera(chamados.filter(ver).map((c) => ({ ...c, eventos: [...c.eventos] })).sort((a, b) => b.abertoEm.localeCompare(a.abertoEm)))
    },
    async abrirChamado(n) {
      const u = exigeEu()
      const c: Chamado = {
        id: novoId('ch'), numero: Math.max(0, ...chamados.map((x) => x.numero)) + 1, unidadeId: n.unidadeId, categoria: n.categoria,
        gravidade: n.gravidade, titulo: n.titulo, descricao: n.descricao, local: n.local || null, foto: n.foto?.name ?? null,
        status: 'aberto', abertoPor: u.id, abertoEm: agora(), responsavelId: null, fechadoEm: null, eventos: [],
      }
      if (n.foto) arquivosDemo.set(c.id, URL.createObjectURL(n.foto))
      chamados.push(c)
      return espera(c)
    },
    async atualizarChamado(id, m) {
      const u = exigeEu()
      const c = chamados.find((x) => x.id === id)
      if (!c) throw new Error('Chamado não encontrado.')
      if (m.status && !atendeChamados(u.nivel)) throw new Error('Só a manutenção e a gestão mudam o andamento.')
      if (m.status) {
        c.status = m.status
        if (!c.responsavelId && u.nivel === 'manutencao') c.responsavelId = u.id
        c.fechadoEm = m.status === 'resolvido' || m.status === 'cancelado' ? agora() : null
      }
      c.eventos.push({ id: novoId('e'), autorId: u.id, em: agora(), texto: m.texto?.trim() || null, status: m.status ?? null })
    },
    async solicitacoesUniforme(fid) {
      const u = exigeEu()
      return espera(solicitacoesDemo.filter((x) => (fid ? x.funcionarioId === fid : true) && (x.funcionarioId === u.id || podeGerenciar(u.nivel))).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((x) => ({ ...x })))
    },
    async pedirTrocaUniforme(n) {
      const u = exigeEu()
      if (n.funcionarioId !== u.id) throw new Error('Cada pessoa pede a própria troca')
      const id = novoId('su')
      if (n.foto) arquivosDemo.set(id, URL.createObjectURL(n.foto))
      solicitacoesDemo.push({ id, funcionarioId: u.id, itens: n.itens, motivo: n.motivo.trim(), foto: n.foto ? 'demo' : null, status: 'aberta', resposta: null, respondidoPor: null, respondidoEm: null, criadoEm: new Date().toISOString() })
    },
    async responderTrocaUniforme(id, status, resposta) {
      const u = exigeGestao()
      const x = solicitacoesDemo.find((y) => y.id === id)
      if (x) Object.assign(x, { status, resposta: resposta.trim() || null, respondidoPor: status === 'aberta' ? null : u.id, respondidoEm: status === 'aberta' ? null : new Date().toISOString() })
    },
    async fotoSolicitacao(x) {
      return arquivosDemo.get(x.id) ?? null
    },
    async contasPagamento() {
      exigeGestao()
      return espera(contasDemo.map((c) => ({ ...c })))
    },
    async salvarContaPagamento(c) {
      exigeGestao()
      if (c.padrao) contasDemo.forEach((x) => (x.padrao = false))
      const nova: ContaPagamento = { ...c, id: c.id ?? 'cp' + (contasDemo.length + 1) }
      const i = contasDemo.findIndex((x) => x.id === nova.id)
      if (i >= 0) contasDemo[i] = nova
      else contasDemo.push(nova)
      return espera({ ...nova })
    },
    async remessasPagamento(tipo, referencia) {
      exigeGestao()
      return espera(remessasDemo.filter((r) => r.tipo === tipo && r.referencia === referencia).map((r) => ({ ...r })))
    },
    async registrarRemessa(r) {
      exigeGestao()
      const nova: RemessaPagamento = { ...r, id: 'rm' + (remessasDemo.length + 1), numero: remessasDemo.length + 1, criadoEm: new Date().toISOString() }
      remessasDemo.unshift(nova)
      return espera({ ...nova })
    },
    async pedidosUniforme() {
      exigeGestao()
      return espera([...pedidosUniformeDemo].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((p) => ({ ...p })))
    },
    async salvarPedidoUniforme(p) {
      exigeGestao()
      const atual = p.id ? pedidosUniformeDemo.find((x) => x.id === p.id) : undefined
      if (atual) {
        Object.assign(atual, p)
        return { ...atual }
      }
      const novo: PedidoUniforme = { ...p, id: novoId('pu'), numero: pedidosUniformeDemo.length + 1, criadoEm: new Date().toISOString() }
      pedidosUniformeDemo.push(novo)
      return { ...novo }
    },
    async excluirPedidoUniforme(id) {
      exigeGestao()
      tira(pedidosUniformeDemo, id)
      for (const i of itensPedidoDemo.filter((x) => x.pedidoId === id)) tira(itensPedidoDemo, i.id)
    },
    async itensPedidoUniforme(pid) {
      exigeGestao()
      return espera(itensPedidoDemo.filter((i) => i.pedidoId === pid).map((i) => ({ ...i })))
    },
    async definirItensPedido(pid, fid, itens) {
      exigeGestao()
      for (const i of itensPedidoDemo.filter((x) => x.pedidoId === pid && x.funcionarioId === fid)) tira(itensPedidoDemo, i.id)
      for (const i of itens) itensPedidoDemo.push({ ...i, id: novoId('ip'), pedidoId: pid, funcionarioId: fid })
    },
    async equipamentos() {
      exigeManutencao()
      return espera(equipamentosDemo.map((e) => ({ ...e })).sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarEquipamento(e, foto) {
      exigeManutencao()
      const atual = e.id ? equipamentosDemo.find((x) => x.id === e.id) : undefined
      const salvo: Equipamento = { ...e, id: atual?.id ?? novoId('eq'), foto: atual?.foto ?? null }
      if (foto) {
        salvo.foto = 'demo'
        arquivosDemo.set(salvo.id, URL.createObjectURL(foto))
      }
      if (atual) Object.assign(atual, salvo)
      else equipamentosDemo.push(salvo)
      return espera({ ...salvo })
    },
    async fotoEquipamento(e) {
      return arquivosDemo.get(e.id) ?? null
    },
    async manutencoesEquipamento(eid) {
      exigeManutencao()
      return espera(manutencoesDemo.filter((m) => !eid || m.equipamentoId === eid).sort((a, b) => b.data.localeCompare(a.data)).map((m) => ({ ...m })))
    },
    async registrarManutencaoEquipamento(m) {
      const u = exigeManutencao()
      manutencoesDemo.push({ ...m, id: novoId('me'), registradoPor: u.id })
    },
    async excluirManutencaoEquipamento(id) {
      exigeManutencao()
      tira(manutencoesDemo, id)
    },
    async preventivas() {
      exigeManutencao()
      return espera(preventivasDemo.map((p) => ({ ...p })))
    },
    async salvarPreventiva(p) {
      exigeManutencao()
      const atual = p.id ? preventivasDemo.find((x) => x.id === p.id) : undefined
      if (atual) Object.assign(atual, p)
      else preventivasDemo.push({ ...p, id: novoId('pv') })
    },
    async excluirPreventiva(id) {
      exigeManutencao()
      tira(preventivasDemo, id)
      for (const x of execucoesDemo.filter((x) => x.preventivaId === id)) tira(execucoesDemo, x.id)
    },
    async execucoesPreventiva() {
      exigeManutencao()
      return espera(execucoesDemo.map((x) => ({ ...x })))
    },
    async registrarExecucao(x) {
      const u = exigeManutencao()
      execucoesDemo.push({ ...x, id: novoId('ex'), feitoPor: u.id })
    },
    async excluirExecucao(id) {
      exigeManutencao()
      tira(execucoesDemo, id)
    },
    async fotoChamado(c) {
      return arquivosDemo.get(c.id) ?? null
    },
    async versoesRegulamento() {
      exigeEu()
      for (const v of versoes) if (!v.hash) v.hash = await sha256(v.texto)
      return espera([...versoes].sort((a, b) => b.numero - a.numero))
    },
    async publicarRegulamento(texto, nota) {
      const u = exigeGestao()
      const v: VersaoRegulamento = {
        id: novoId('r'), numero: Math.max(...versoes.map((x) => x.numero)) + 1, texto, nota: nota || null,
        publicadoEm: agora(), publicadoPor: u.id, hash: await sha256(texto),
      }
      versoes.push(v)
      return espera(v)
    },
    async leiturasRegulamento() {
      const u = exigeEu()
      return espera(leituras.filter((l) => l.funcionarioId === u.id || podeGerenciar(u.nivel)))
    },
    async assinarRegulamento(versaoId, assinatura) {
      const u = exigeEu()
      const v = versoes.find((x) => x.id === versaoId)
      if (!v) throw new Error('Versão não encontrada.')
      if (leituras.some((l) => l.funcionarioId === u.id && l.versaoId === versaoId)) throw new Error('Você já assinou esta versão.')
      leituras.push({ funcionarioId: u.id, versaoId, assinatura, assinadoEm: agora(), hash: v.hash || (await sha256(v.texto)), dispositivo: navigator.userAgent, ip: null })
    },
    async fichas() {
      const u = exigeEu()
      const fichas = fichasDemo().map((f) => (podeGerenciar(u.nivel) ? f : { ...f, custo: undefined }))
      return espera({ fichas, atualizadoEm: agora() })
    },
    async resultados() {
      const u = exigeEu()
      if (!vejoResultado(u.nivel)) throw new Error('Só Proprietário e Administrativo veem o resultado.')
      return espera({ linhas: resultadosDemo(), atualizadoEm: agora() })
    },
    async definirFoto(fid, imagem) {
      const u = exigeEu()
      if (fid !== u.id && !podeGerenciar(u.nivel)) throw new Error('Sem permissão para trocar esta foto.')
      const p = porId(fid)
      p.foto = `${fid}/${Date.now()}.jpg`
      p.fotoUrl = URL.createObjectURL(imagem)
    },
    async freelancers() {
      exigeGestao()
      return espera([...freelas].sort((a, b) => a.nome.localeCompare(b.nome)))
    },
    async salvarFreelancer(f) {
      exigeGestao()
      const cpf = f.cpf ? soDigitos(f.cpf) : null
      if (cpf && freelas.some((x) => x.cpf === cpf && x.id !== f.id)) throw new Error('Já existe freelancer com esse CPF.')
      if (f.funcionarioId && freelas.some((x) => x.funcionarioId === f.funcionarioId && x.id !== f.id)) throw new Error('Esse funcionário já está cadastrado como freelancer.')
      const novo: Freelancer = { ...f, id: f.id ?? novoId('fl'), cpf, celular: f.celular ? soDigitos(f.celular) : null }
      const i = freelas.findIndex((x) => x.id === novo.id)
      if (i >= 0) freelas[i] = novo
      else freelas.push(novo)
      return espera(novo)
    },
    async excluirFreelancer(id) {
      exigeGestao()
      if (pagamentos.some((p) => p.freelancerId === id)) throw new Error('Esse freelancer já tem pagamento marcado. Desmarque os pagamentos ou deixe o cadastro inativo.')
      for (const lista of [diarias, envios] as { freelancerId: string | null }[][])
        for (let i = lista.length - 1; i >= 0; i--) if (lista[i].freelancerId === id) lista.splice(i, 1)
      freelas.splice(freelas.findIndex((f) => f.id === id), 1)
    },
    async diariasFreela(inicio, fim) {
      exigeGestao()
      return espera(diarias.filter((d) => d.data >= inicio && d.data <= fim).map((d) => ({ ...d })))
    },
    async lancarDiaria(d) {
      const u = exigeGestao()
      if (diarias.some((x) => x.freelancerId === d.freelancerId && x.data === d.data && x.turno === d.turno))
        throw new Error('Esse freelancer já tem diária lançada nesse dia e turno.')
      const nova: DiariaFreela = { ...d, id: novoId('d'), lancadoPor: u.id }
      diarias.push(nova)
      return espera(nova)
    },
    async excluirDiaria(id) {
      exigeGestao()
      diarias.splice(diarias.findIndex((d) => d.id === id), 1)
    },
    async pagamentosFreela(semana) {
      exigeGestao()
      return espera(pagamentos.filter((p) => p.semana === semana))
    },
    async marcarPagoFreela(freelancerId, semana, valor) {
      const u = exigeGestao()
      pagamentos.push({ freelancerId, semana, valor, pagoEm: agora(), pagoPor: u.id })
    },
    async desfazerPagoFreela(freelancerId, semana) {
      exigeGestao()
      pagamentos.splice(pagamentos.findIndex((p) => p.freelancerId === freelancerId && p.semana === semana), 1)
    },
    async lojasParaDiaria() {
      return espera(unidades.map((u) => ({ ...u })))
    },
    async freelaQuemSou(cpf, celular) {
      const c = soDigitos(cpf)
      if (!cpfValido(c)) return espera({ tipo: 'invalido' as const })
      if (funcionarios.some((f) => f.status === 'ativo' && f.cpf === c)) return espera({ tipo: 'funcionario' as const })
      const f = freelas.find((x) => x.cpf === c)
      if (!f || (f.celular && f.celular.slice(-11) !== soDigitos(celular).slice(-11))) return espera({ tipo: 'novo' as const })
      return espera({ tipo: 'freelancer' as const, nome: f.nome.split(' ')[0], pixFinal: f.pix.slice(-4) })
    },
    async enviarDiarias(e) {
      const quem = await this.freelaQuemSou(e.cpf, e.celular)
      if (quem.tipo === 'invalido') throw new Error('CPF inválido. Confira os números.')
      if (quem.tipo === 'funcionario') throw new Error('Esse CPF é de alguém do time. Mande a diária pelo Portal do Time, com o seu login.')
      const cpf = soDigitos(e.cpf)
      const f = freelas.find((x) => x.cpf === cpf)
      const nome = e.nome.trim() || (quem.tipo === 'freelancer' ? f?.nome : '') || ''
      const pix = e.pix.trim() || (quem.tipo === 'freelancer' ? f?.pix : '') || ''
      if (nome.split(/\s+/).length < 2) throw new Error('Coloque o nome completo.')
      return gravarEnvios(e.dias, { cpf, celular: soDigitos(e.celular).slice(-11), nome, pix, freelancerId: f?.id ?? null, funcionarioId: null, unidadeId: e.unidadeId, funcao: e.funcao })
    },
    async enviarMinhasDiarias(e) {
      const u = exigeEu()
      return gravarEnvios(e.dias, {
        cpf: u.cpf ?? null, celular: u.celular, nome: u.nome, pix: e.pix.trim() || u.pix || '', unidadeId: e.unidadeId, funcao: e.funcao,
        freelancerId: freelas.find((x) => x.funcionarioId === u.id)?.id ?? null, funcionarioId: u.id,
      })
    },
    async enviosFreela(status) {
      if (status === 'meus') {
        const u = exigeEu()
        return espera(envios.filter((x) => x.funcionarioId === u.id).sort((a, b) => b.data.localeCompare(a.data)).map((x) => ({ ...x })))
      }
      exigeGestao()
      return espera(envios.filter((x) => x.status === status).sort((a, b) => a.data.localeCompare(b.data)).map((x) => ({ ...x })))
    },
    async aprovarEnvioFreela(id, valor, funcao, usarPixNovo) {
      const u = exigeGestao()
      const e = envios.find((x) => x.id === id && x.status === 'pendente')
      if (!e) throw new Error('Esse envio já foi resolvido.')
      let f = freelas.find((x) => (e.freelancerId && x.id === e.freelancerId) || (e.funcionarioId && x.funcionarioId === e.funcionarioId) || (e.cpf && x.cpf === e.cpf))
      if (!f) {
        f = { id: novoId('fl'), nome: e.nome, cpf: e.cpf, pix: e.pix, celular: e.celular, ativo: true, funcionarioId: e.funcionarioId }
        freelas.push(f)
      } else {
        f.ativo = true
        if (usarPixNovo) Object.assign(f, { pix: e.pix, celular: e.celular ?? f.celular })
      }
      if (!diarias.some((x) => x.freelancerId === f.id && x.data === e.data && x.turno === e.turno))
        diarias.push({ id: novoId('d'), freelancerId: f.id, data: e.data, turno: e.turno, unidadeId: e.unidadeId, funcao: funcao.trim() || e.funcao, valor, observacao: e.observacao, lancadoPor: u.id })
      Object.assign(e, { status: 'aprovado', freelancerId: f.id })
    },
    async recusarEnvioFreela(id, motivo) {
      exigeGestao()
      const e = envios.find((x) => x.id === id && x.status === 'pendente')
      if (e) Object.assign(e, { status: 'recusado', motivo: motivo.trim() || null })
    },
  }
}
