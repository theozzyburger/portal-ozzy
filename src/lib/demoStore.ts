import { podeGerenciar, podeVerPainel, podeVerDocumentosDe, podeVerFuncionario } from './permissoes'
import { soDigitos, type Store } from './store'
import type { Comunicado, LeituraRegulamento, VersaoRegulamento, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, Unidade } from './types'
import { addDias, hoje, inicioDaSemana } from './datas'
import { avaliacoesDemo, vendasDemo } from './demoVendas'
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
): Funcionario => ({ id, nome, celular, cargo, unidadeId, nivel, status, dataAdmissao, respondePara, dataDesligamento, setor })

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
let seq = 100
const novoId = (p: string) => `${p}${++seq}`

// Documentos e exames são EXEMPLO (não vieram da planilha).
const documentos: Documento[] = [
  { id: 'd1', funcionarioId: 'p-cibeli-costa', tipo: 'atestado', nomeArquivo: 'atestado.pdf', observacao: 'Exemplo', inicio: addDias(hoje(), -9), fim: addDias(hoje(), -8), enviadoPor: 'p-cibeli-costa', criadoEm: addDias(hoje(), -9) + 'T10:12:00Z' },
  { id: 'd2', funcionarioId: 'p-cibeli-costa', tipo: 'documento_pessoal', nomeArquivo: 'rg.jpg', enviadoPor: 'p-maria-costa', criadoEm: '2026-01-05T14:00:00Z' },
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
  { id: 'c1', titulo: 'Bem-vindos ao Portal The Ozzy', corpo: 'A partir de agora, comunicados, folgas e documentos ficam aqui. Atestados devem ser enviados pelo portal no mesmo dia, com foto legível.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -2) + 'T12:00:00Z', lidoPor: ['p-maria-costa'] },
  { id: 'c2', titulo: 'Reunião de alinhamento de regras', corpo: 'Gerente e supervisoras: reunião na quinta às 15h para revisar regras e processos. Tragam as dúvidas da equipe.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -1) + 'T09:30:00Z', lidoPor: [] },
  { id: 'c3', titulo: 'Limpeza da chapa no fechamento', corpo: 'A partir de hoje a chapa é limpa no fechamento com o produto indicado no POP. A supervisora confere antes de sair.', unidadeId: 'burger-va', autorId: 'p-arlene-santos', criadoEm: addDias(hoje(), -4) + 'T16:00:00Z', lidoPor: ['p-dora-ramos'] },
]

const semana = inicioDaSemana(hoje())
const folgas: Folga[] = [
  ['p-cibeli-costa', 1], ['p-gustavo-lima', 2], ['p-julia-silva', 3], ['p-kaue-oliveira', 0], ['p-larissa-porto', 1],
  ['p-laura-costa', 2], ['p-lucas-torres', 3], ['p-victor-correa', 0], ['p-dora-ramos', 1], ['p-kaua-silva', 2], ['p-queli-souza', 0],
].map(([fid, d], i) => ({ id: `g${i}`, funcionarioId: fid as string, data: addDias(semana, d as number) }))

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
      exigeGestao()
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
      const visiveis = comunicados.filter((c) => c.unidadeId === null || c.unidadeId === u.unidadeId || podeGerenciar(u.nivel))
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
      else folgas.push({ id: novoId('g'), funcionarioId: fid, data })
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
    async avaliacoes() {
      exigePainel()
      return espera(avaliacoesDemo())
    },
    turnos: () => espera(turnos),
    async atribuirTurno(fid, turnoId) {
      exigeGestao()
      porId(fid).turnoId = turnoId
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
  }
}
