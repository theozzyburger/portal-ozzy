import { podeGerenciar, podeVerPainel, podeVerDocumentosDe, podeVerFuncionario } from './permissoes'
import { soDigitos, type Store } from './store'
import type { Comunicado, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, Unidade } from './types'
import { addDias, diaNoMes, hoje, inicioDaSemana } from './datas'
import { avaliacoesDemo, vendasDemo } from './demoVendas'
import { addMesesData } from './vencimentos'

export const SENHA_DEMO = '1234'

const unidades: Unidade[] = [
  { id: 'burger-psd', nome: 'The Ozzy Burger Parque São Domingos' },
  { id: 'burger-va', nome: 'The Ozzy Burger Vila Anastácio' },
  { id: 'pizza', nome: 'The Ozzy Pizza' },
]

const f = (
  id: string, nome: string, celular: string, cargo: string, unidadeId: string,
  nivel: Funcionario['nivel'], dataAdmissao: string, respondePara: string | null = null,
  status: Funcionario['status'] = 'ativo', dataDesligamento: string | null = null,
): Funcionario => ({ id, nome, celular, cargo, unidadeId, nivel, status, dataAdmissao, respondePara, dataDesligamento })

const funcionarios: Funcionario[] = [
  f('f1', 'Heitor', '11999990001', 'Proprietário', 'burger-psd', 'proprietario', '2019-03-01'),
  f('f2', 'Marina Costa', '11999990002', 'Assistente administrativo/financeiro', 'burger-psd', 'administrativo', '2022-02-14', 'f1'),
  f('f3', 'Rafael Lima', '11999990003', 'Gerente de unidade', 'burger-psd', 'gerente', '2021-06-01', 'f1'),
  f('f4', 'Juliana Souza', '11999990004', 'Gerente de unidade', 'pizza', 'gerente', '2022-09-12', 'f1'),
  f('f5', 'Bruno Alves', '11999990005', 'Supervisor de cozinha', 'burger-psd', 'supervisor', '2023-01-09', 'f3'),
  f('f6', 'Carla Mendes', '11999990006', 'Supervisora de salão', 'pizza', 'supervisor', '2023-04-17', 'f4'),
  f('f7', 'Diego Rocha', '11999990007', 'Chapeiro', 'burger-psd', 'funcionario', '2024-02-05', 'f5'),
  f('f8', 'Patrícia Gomes', '11999990008', 'Atendente', 'burger-psd', 'funcionario', '2024-07-22', 'f5'),
  f('f9', 'Lucas Ferreira', '11999990009', 'Auxiliar de cozinha', 'burger-va', 'funcionario', '2025-01-13', 'f22'),
  f('f10', 'Thiago Martins', '11999990010', 'Pizzaiolo', 'pizza', 'funcionario', '2023-08-01', 'f6'),
  f('f11', 'Aline Ribeiro', '11999990011', 'Atendente', 'pizza', 'funcionario', '2024-11-04', 'f6'),
  f('f12', 'Gustavo Pereira', '11999990012', 'Entregador', 'pizza', 'funcionario', '2025-03-10', 'f6'),
  f('f13', 'Fernanda Dias', '11999990013', 'Caixa', 'burger-psd', 'funcionario', '2023-05-02', 'f5', 'inativo', diaNoMes(1, 29)),
  f('f14', 'Vitor Santos', '11999990014', 'Atendente', 'pizza', 'funcionario', diaNoMes(0, 1), 'f6'),
  f('f15', 'Camila Rocha', '11999990015', 'Auxiliar de cozinha', 'burger-va', 'funcionario', diaNoMes(0, 2), 'f22'),
  f('f16', 'Rodrigo Nunes', '11999990016', 'Entregador', 'burger-psd', 'funcionario', diaNoMes(1, 15), 'f5'),
  f('f17', 'Bianca Lopes', '11999990017', 'Atendente', 'pizza', 'funcionario', '2024-06-03', 'f6', 'inativo', diaNoMes(0, 3)),
  f('f18', 'Felipe Araújo', '11999990018', 'Chapeiro', 'burger-va', 'funcionario', '2024-09-16', 'f22', 'inativo', diaNoMes(1, 20)),
  f('f19', 'Sabrina Melo', '11999990019', 'Atendente', 'burger-va', 'funcionario', diaNoMes(2, 8), 'f22'),
  f('f21', 'Renata Prado', '11999990021', 'Gerente de unidade', 'burger-va', 'gerente', '2023-10-02', 'f1'),
  f('f22', 'Marcos Silva', '11999990022', 'Supervisor de cozinha', 'burger-va', 'supervisor', '2024-03-11', 'f21'),
  f('f20', 'Eduardo Pinto', '11999990020', 'Pizzaiolo', 'pizza', 'funcionario', '2023-02-13', 'f6', 'inativo', diaNoMes(2, 25)),
]

const agora = () => new Date().toISOString()
const porIdSeed = (id: string) => funcionarios.find((x) => x.id === id)
let seq = 100
const novoId = (p: string) => `${p}${++seq}`

const documentos: Documento[] = [
  { id: 'd1', funcionarioId: 'f7', tipo: 'atestado', nomeArquivo: 'atestado-diego.pdf', observacao: 'Gripe', inicio: addDias(hoje(), -9), fim: addDias(hoje(), -8), enviadoPor: 'f7', criadoEm: addDias(hoje(), -9) + 'T10:12:00Z' },
  { id: 'd2', funcionarioId: 'f7', tipo: 'documento_pessoal', nomeArquivo: 'rg-diego.jpg', enviadoPor: 'f2', criadoEm: '2024-02-05T14:00:00Z' },
  { id: 'd4', funcionarioId: 'f12', tipo: 'atestado', nomeArquivo: 'atestado-gustavo.jpg', observacao: 'Consulta', inicio: diaNoMes(1, 21), fim: diaNoMes(1, 21), enviadoPor: 'f12', criadoEm: diaNoMes(1, 21) + 'T18:00:00Z' },
  { id: 'd5', funcionarioId: 'f11', tipo: 'atestado', nomeArquivo: 'atestado-aline.pdf', inicio: diaNoMes(1, 12), fim: diaNoMes(1, 13), enviadoPor: 'f11', criadoEm: diaNoMes(1, 12) + 'T11:00:00Z' },
  { id: 'd3', funcionarioId: 'f10', tipo: 'exame', nomeArquivo: 'aso-admissional.pdf', observacao: 'Exame admissional', enviadoPor: 'f2', criadoEm: '2023-08-01T09:00:00Z' },
]

// Exames de saúde de exemplo, com situações variadas (em dia, vencendo, vencido, faltando).
// [funcionário, dias desde o exame, faltando coprocultura?]
const situacoesExame: [string, number, boolean?][] = [
  ['f1', 120], ['f2', 200], ['f3', 300], ['f4', 90], ['f5', 352], ['f6', 400], ['f7', 345], ['f8', 60],
  ['f9', 180], ['f10', 380], ['f11', 30], ['f12', 250, true], ['f16', 20], ['f19', 50], ['f21', 160], ['f22', 340],
]
documentos.push(
  ...situacoesExame.flatMap(([fid, dias, semCopro], i): Documento[] => {
    const feito = addDias(hoje(), -dias)
    const vence = addMesesData(feito, 12)
    const p = porIdSeed(fid)
    const asoTipo = p && p.dataAdmissao >= addDias(feito, -30) ? 'aso_admissional' : 'aso_periodico'
    const base = { funcionarioId: fid, enviadoPor: 'f2', realizadoEm: feito, vence, criadoEm: feito + 'T15:00:00Z' }
    return [
      { ...base, id: `ds${i}a`, tipo: asoTipo, nomeArquivo: `aso-${fid}.pdf`, observacao: 'Clínica de segurança do trabalho' },
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
    id: 'u1', funcionarioId: 'f8', data: '2024-07-22', entreguePor: 'f5', observacao: null, criadoEm: '2024-07-22T10:00:00Z',
    itens: [{ item: 'Camiseta', tamanho: 'M', quantidade: 2 }, { item: 'Avental', quantidade: 1 }, { item: 'Boné', quantidade: 1 }],
    assinatura: ASSINATURA_DEMO, assinadoEm: '2024-07-22T10:02:00Z', assinadoVia: 'presencial',
  },
  {
    id: 'u2', funcionarioId: 'f7', data: '2024-02-05', entreguePor: 'f5', observacao: null, criadoEm: '2024-02-05T10:00:00Z',
    itens: [{ item: 'Dólmã', tamanho: 'G', quantidade: 2 }, { item: 'Touca', quantidade: 2 }, { item: 'Luva térmica (EPI)', quantidade: 1 }],
    assinatura: ASSINATURA_DEMO, assinadoEm: '2024-02-05T10:05:00Z', assinadoVia: 'presencial',
  },
  {
    id: 'u3', funcionarioId: 'f7', data: addDias(hoje(), -1), entreguePor: 'f3', observacao: 'Troca do dólmã gasto', criadoEm: addDias(hoje(), -1) + 'T16:00:00Z',
    itens: [{ item: 'Dólmã', tamanho: 'G', quantidade: 1 }, { item: 'Avental', quantidade: 1 }],
    assinatura: null, assinadoEm: null, assinadoVia: null,
  },
]
const arquivosDemo = new Map<string, string>()

const ocorrencias: Ocorrencia[] = [
  { id: 'o1', funcionarioId: 'f7', tipo: 'falta', data: addDias(hoje(), -9), descricao: 'Faltou com atestado (gripe).', registradoPor: 'f3', criadoEm: agora() },
  { id: 'o2', funcionarioId: 'f8', tipo: 'atraso', data: addDias(hoje(), -3), descricao: 'Chegou 25 min atrasada, avisou pelo WhatsApp.', registradoPor: 'f5', criadoEm: agora() },
  { id: 'o3', funcionarioId: 'f10', tipo: 'elogio', data: addDias(hoje(), -5), descricao: 'Cliente elogiou a pizza no iFood citando o atendimento.', registradoPor: 'f4', criadoEm: agora() },
  // Histórico de exemplo dos últimos meses, para o painel ter comparação.
  ...([
    ['f8', 0, 2, 'falta'], ['f12', 0, 4, 'falta'], ['f11', 0, 5, 'atraso'],
    ['f9', 1, 3, 'falta'], ['f12', 1, 9, 'falta'], ['f12', 1, 21, 'falta'], ['f11', 1, 12, 'falta'], ['f18', 1, 6, 'falta'],
    ['f18', 1, 13, 'falta'], ['f8', 1, 17, 'atraso'], ['f10', 1, 24, 'atraso'], ['f9', 1, 27, 'advertencia'],
    ['f7', 2, 5, 'falta'], ['f11', 2, 18, 'falta'], ['f20', 2, 11, 'falta'], ['f8', 2, 22, 'atraso'],
  ] as const).map(([fid, m, d, tipo], i): Ocorrencia => ({
    id: `oh${i}`, funcionarioId: fid, tipo, data: diaNoMes(m, d),
    descricao: tipo === 'falta' ? 'Faltou sem aviso prévio.' : tipo === 'atraso' ? 'Chegou atrasado ao turno.' : 'Advertência por faltas repetidas.',
    registradoPor: 'f3', criadoEm: agora(),
  })),
]

const comunicados: Comunicado[] = [
  { id: 'c1', titulo: 'Bem-vindos ao Portal The Ozzy', corpo: 'A partir de agora, comunicados, folgas e documentos ficam aqui. Atestados devem ser enviados pelo portal no mesmo dia, com foto legível.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -2) + 'T12:00:00Z', lidoPor: ['f2', 'f3'] },
  { id: 'c2', titulo: 'Reunião de alinhamento de regras', corpo: 'Gerentes, supervisores e escritório: reunião na quinta às 15h para revisar regras e processos. Tragam as dúvidas da equipe.', unidadeId: null, autorId: 'f1', criadoEm: addDias(hoje(), -1) + 'T09:30:00Z', lidoPor: [] },
  { id: 'c3', titulo: 'Novo forno: cuidado na limpeza', corpo: 'O forno novo não pode ser lavado com água corrente. Usar somente o produto indicado no POP de limpeza.', unidadeId: 'pizza', autorId: 'f4', criadoEm: addDias(hoje(), -4) + 'T16:00:00Z', lidoPor: ['f10'] },
]

const semana = inicioDaSemana(hoje())
const folgas: Folga[] = [
  ['f7', 1], ['f8', 2], ['f9', 3], ['f5', 0], ['f10', 1], ['f11', 2], ['f12', 0], ['f6', 3], ['f3', 0], ['f4', 1],
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
    async avaliacoes() {
      exigePainel()
      return espera(avaliacoesDemo())
    },
  }
}
