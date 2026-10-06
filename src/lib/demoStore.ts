import { podeGerenciar, podeVerDocumentosDe, podeVerFuncionario } from './permissoes'
import { soDigitos, type Store } from './store'
import type { Comunicado, Documento, Folga, Funcionario, Ocorrencia, Unidade } from './types'
import { addDias, diaNoMes, hoje, inicioDaSemana } from './datas'

export const SENHA_DEMO = '1234'

const unidades: Unidade[] = [
  { id: 'burger', nome: 'The Ozzy Burger' },
  { id: 'pizza', nome: 'The Ozzy Pizza' },
]

const f = (
  id: string, nome: string, celular: string, cargo: string, unidadeId: string,
  nivel: Funcionario['nivel'], dataAdmissao: string, respondePara: string | null = null,
  status: Funcionario['status'] = 'ativo', dataDesligamento: string | null = null,
): Funcionario => ({ id, nome, celular, cargo, unidadeId, nivel, status, dataAdmissao, respondePara, dataDesligamento })

const funcionarios: Funcionario[] = [
  f('f1', 'Heitor', '11999990001', 'Proprietário', 'burger', 'proprietario', '2019-03-01'),
  f('f2', 'Marina Costa', '11999990002', 'Assistente administrativo/financeiro', 'burger', 'administrativo', '2022-02-14', 'f1'),
  f('f3', 'Rafael Lima', '11999990003', 'Gerente de unidade', 'burger', 'gerente', '2021-06-01', 'f1'),
  f('f4', 'Juliana Souza', '11999990004', 'Gerente de unidade', 'pizza', 'gerente', '2022-09-12', 'f1'),
  f('f5', 'Bruno Alves', '11999990005', 'Supervisor de cozinha', 'burger', 'supervisor', '2023-01-09', 'f3'),
  f('f6', 'Carla Mendes', '11999990006', 'Supervisora de salão', 'pizza', 'supervisor', '2023-04-17', 'f4'),
  f('f7', 'Diego Rocha', '11999990007', 'Chapeiro', 'burger', 'funcionario', '2024-02-05', 'f5'),
  f('f8', 'Patrícia Gomes', '11999990008', 'Atendente', 'burger', 'funcionario', '2024-07-22', 'f5'),
  f('f9', 'Lucas Ferreira', '11999990009', 'Auxiliar de cozinha', 'burger', 'funcionario', '2025-01-13', 'f5'),
  f('f10', 'Thiago Martins', '11999990010', 'Pizzaiolo', 'pizza', 'funcionario', '2023-08-01', 'f6'),
  f('f11', 'Aline Ribeiro', '11999990011', 'Atendente', 'pizza', 'funcionario', '2024-11-04', 'f6'),
  f('f12', 'Gustavo Pereira', '11999990012', 'Entregador', 'pizza', 'funcionario', '2025-03-10', 'f6'),
  f('f13', 'Fernanda Dias', '11999990013', 'Caixa', 'burger', 'funcionario', '2023-05-02', 'f5', 'inativo', diaNoMes(1, 29)),
  f('f14', 'Vitor Santos', '11999990014', 'Atendente', 'pizza', 'funcionario', diaNoMes(0, 1), 'f6'),
  f('f15', 'Camila Rocha', '11999990015', 'Auxiliar de cozinha', 'burger', 'funcionario', diaNoMes(0, 2), 'f5'),
  f('f16', 'Rodrigo Nunes', '11999990016', 'Entregador', 'burger', 'funcionario', diaNoMes(1, 15), 'f5'),
  f('f17', 'Bianca Lopes', '11999990017', 'Atendente', 'pizza', 'funcionario', '2024-06-03', 'f6', 'inativo', diaNoMes(0, 3)),
  f('f18', 'Felipe Araújo', '11999990018', 'Chapeiro', 'burger', 'funcionario', '2024-09-16', 'f5', 'inativo', diaNoMes(1, 20)),
  f('f19', 'Sabrina Melo', '11999990019', 'Atendente', 'burger', 'funcionario', diaNoMes(2, 8), 'f5'),
  f('f20', 'Eduardo Pinto', '11999990020', 'Pizzaiolo', 'pizza', 'funcionario', '2023-02-13', 'f6', 'inativo', diaNoMes(2, 25)),
]

const agora = () => new Date().toISOString()
let seq = 100
const novoId = (p: string) => `${p}${++seq}`

const documentos: Documento[] = [
  { id: 'd1', funcionarioId: 'f7', tipo: 'atestado', nomeArquivo: 'atestado-diego.pdf', observacao: 'Gripe', inicio: addDias(hoje(), -9), fim: addDias(hoje(), -8), enviadoPor: 'f7', criadoEm: addDias(hoje(), -9) + 'T10:12:00Z' },
  { id: 'd2', funcionarioId: 'f7', tipo: 'documento_pessoal', nomeArquivo: 'rg-diego.jpg', enviadoPor: 'f2', criadoEm: '2024-02-05T14:00:00Z' },
  { id: 'd4', funcionarioId: 'f12', tipo: 'atestado', nomeArquivo: 'atestado-gustavo.jpg', observacao: 'Consulta', inicio: diaNoMes(1, 21), fim: diaNoMes(1, 21), enviadoPor: 'f12', criadoEm: diaNoMes(1, 21) + 'T18:00:00Z' },
  { id: 'd5', funcionarioId: 'f11', tipo: 'atestado', nomeArquivo: 'atestado-aline.pdf', inicio: diaNoMes(1, 12), fim: diaNoMes(1, 13), enviadoPor: 'f11', criadoEm: diaNoMes(1, 12) + 'T11:00:00Z' },
  { id: 'd3', funcionarioId: 'f10', tipo: 'exame', nomeArquivo: 'aso-admissional.pdf', observacao: 'Exame admissional', enviadoPor: 'f2', criadoEm: '2023-08-01T09:00:00Z' },
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
        observacao: d.observacao || null, inicio: d.inicio || null, fim: d.fim || null, enviadoPor: u.id, criadoEm: agora(),
      }
      arquivosDemo.set(doc.id, URL.createObjectURL(d.arquivo))
      documentos.push(doc)
      return espera(doc)
    },
    async abrirDocumento(d) {
      return arquivosDemo.get(d.id) ?? null
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
  }
}
