import { createClient } from '@supabase/supabase-js'
import { soDigitos, type Store } from './store'
import type { Avaliacao, Comunicado, Documento, Folga, Funcionario, Ocorrencia, VendaDia } from './types'

// O login é celular + senha. Internamente o Supabase usa um e-mail derivado do celular,
// assim não dependemos de SMS (que é pago).
const emailDoCelular = (celular: string) => `${soDigitos(celular)}@portal.theozzy`

const paraFuncionario = (r: any): Funcionario => ({
  id: r.id, nome: r.nome, celular: r.celular, cargo: r.cargo, unidadeId: r.unidade_id, nivel: r.nivel,
  status: r.status, dataAdmissao: r.data_admissao, dataDesligamento: r.data_desligamento, respondePara: r.responde_para,
})

const paraDocumento = (r: any): Documento & { caminho: string } => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, nomeArquivo: r.nome_arquivo, observacao: r.observacao,
  inicio: r.inicio, fim: r.fim, enviadoPor: r.enviado_por, criadoEm: r.criado_em, caminho: r.caminho,
})

const paraOcorrencia = (r: any): Ocorrencia => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, data: r.data, descricao: r.descricao,
  registradoPor: r.registrado_por, criadoEm: r.criado_em,
})

const deFuncionario = (f: Partial<Funcionario>) => ({
  nome: f.nome, celular: f.celular ? soDigitos(f.celular) : undefined, cargo: f.cargo, unidade_id: f.unidadeId,
  nivel: f.nivel, status: f.status, data_admissao: f.dataAdmissao, data_desligamento: f.dataDesligamento || null,
  responde_para: f.respondePara || null,
})

const ok = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message)
  return data
}

export function criarSupabaseStore(url: string, chave: string): Store {
  const sb = createClient(url, chave)
  let eu: Funcionario | null = null

  const carregarEu = async () => {
    const { data } = await sb.auth.getUser()
    if (!data.user) return (eu = null)
    const r = ok(await sb.from('funcionarios').select('*').eq('auth_user_id', data.user.id).eq('status', 'ativo').maybeSingle())
    return (eu = r ? paraFuncionario(r) : null)
  }
  const exigeEu = () => {
    if (!eu) throw new Error('Sessão expirada')
    return eu
  }

  return {
    modo: 'supabase',
    sessaoAtual: carregarEu,
    async entrar(celular, senha) {
      const { error } = await sb.auth.signInWithPassword({ email: emailDoCelular(celular), password: senha })
      if (error) throw new Error('Celular ou senha incorretos.')
      const f = await carregarEu()
      if (!f) {
        await sb.auth.signOut()
        throw new Error('Este acesso não está ativo. Fale com o administrativo.')
      }
      return f
    },
    async sair() {
      await sb.auth.signOut()
      eu = null
    },
    async unidades() {
      return ok(await sb.from('unidades').select('id, nome').order('nome')) ?? []
    },
    async nomes() {
      return ok(await sb.rpc('nomes_funcionarios')) ?? []
    },
    async funcionarios() {
      return (ok(await sb.from('funcionarios').select('*').order('nome')) ?? []).map(paraFuncionario)
    },
    async salvarFuncionario(f, senhaInicial) {
      const linha = f.id
        ? ok(await sb.from('funcionarios').update(deFuncionario(f)).eq('id', f.id).select().single())
        : ok(await sb.from('funcionarios').insert(deFuncionario(f)).select().single())
      const salvo = paraFuncionario(linha)
      if (senhaInicial) {
        const { error } = await sb.functions.invoke('criar-acesso', { body: { funcionarioId: salvo.id, senha: senhaInicial } })
        if (error) throw new Error('Funcionário salvo, mas o login não foi criado: ' + error.message)
      }
      return salvo
    },
    async documentos(fid) {
      return (ok(await sb.from('documentos').select('*').eq('funcionario_id', fid).order('criado_em', { ascending: false })) ?? []).map(paraDocumento)
    },
    async enviarDocumento(d) {
      const u = exigeEu()
      const caminho = `${d.funcionarioId}/${Date.now()}-${d.arquivo.name.replace(/[^\w.-]/g, '_')}`
      ok(await sb.storage.from('documentos').upload(caminho, d.arquivo))
      const r = ok(
        await sb.from('documentos').insert({
          funcionario_id: d.funcionarioId, tipo: d.tipo, nome_arquivo: d.arquivo.name, caminho,
          observacao: d.observacao || null, inicio: d.inicio || null, fim: d.fim || null, enviado_por: u.id,
        }).select().single(),
      )
      return paraDocumento(r)
    },
    async abrirDocumento(d) {
      const caminho = (d as Documento & { caminho?: string }).caminho
      if (!caminho) return null
      const { data } = await sb.storage.from('documentos').createSignedUrl(caminho, 60)
      return data?.signedUrl ?? null
    },
    async ocorrencias(fid) {
      return (ok(await sb.from('ocorrencias').select('*').eq('funcionario_id', fid).order('data', { ascending: false })) ?? []).map(paraOcorrencia)
    },
    async ocorrenciasEntre(inicio, fim) {
      return (ok(await sb.from('ocorrencias').select('*').gte('data', inicio).lte('data', fim)) ?? []).map(paraOcorrencia)
    },
    async atestadosEntre(inicio, fim) {
      return (ok(await sb.from('documentos').select('*').eq('tipo', 'atestado').gte('inicio', inicio).lte('inicio', fim)) ?? []).map(paraDocumento)
    },
    async registrarOcorrencia(o) {
      const u = exigeEu()
      const r = ok(
        await sb.from('ocorrencias').insert({
          funcionario_id: o.funcionarioId, tipo: o.tipo, data: o.data, descricao: o.descricao, registrado_por: u.id,
        }).select().single(),
      )
      return paraOcorrencia(r)
    },
    async comunicados() {
      const linhas = ok(await sb.from('comunicados').select('*, comunicado_leituras(funcionario_id)').order('criado_em', { ascending: false })) ?? []
      return linhas.map((r: any): Comunicado => ({
        id: r.id, titulo: r.titulo, corpo: r.corpo, unidadeId: r.unidade_id, autorId: r.autor_id, criadoEm: r.criado_em,
        lidoPor: (r.comunicado_leituras ?? []).map((l: any) => l.funcionario_id),
      }))
    },
    async publicarComunicado(c) {
      const u = exigeEu()
      const r = ok(await sb.from('comunicados').insert({ titulo: c.titulo, corpo: c.corpo, unidade_id: c.unidadeId, autor_id: u.id }).select().single())
      await sb.from('comunicado_leituras').insert({ comunicado_id: r.id, funcionario_id: u.id })
      return { id: r.id, titulo: r.titulo, corpo: r.corpo, unidadeId: r.unidade_id, autorId: r.autor_id, criadoEm: r.criado_em, lidoPor: [u.id] }
    },
    async marcarLido(id) {
      const u = exigeEu()
      await sb.from('comunicado_leituras').upsert({ comunicado_id: id, funcionario_id: u.id }, { ignoreDuplicates: true })
    },
    async folgas(inicio, fim) {
      const linhas = ok(await sb.from('folgas').select('*').gte('data', inicio).lte('data', fim)) ?? []
      return linhas.map((r: any): Folga => ({ id: r.id, funcionarioId: r.funcionario_id, data: r.data }))
    },
    async alternarFolga(fid, data) {
      const existente = ok(await sb.from('folgas').select('id').eq('funcionario_id', fid).eq('data', data).maybeSingle())
      if (existente) ok(await sb.from('folgas').delete().eq('id', (existente as any).id))
      else ok(await sb.from('folgas').insert({ funcionario_id: fid, data }))
    },
    async vendasEntre(inicio, fim) {
      const linhas = ok(await sb.from('vendas_diarias').select('*').gte('data', inicio).lte('data', fim)) ?? []
      return linhas.map((r: any): VendaDia => ({
        unidadeId: r.unidade_id, data: r.data, canal: r.canal, pedidos: r.pedidos, faturamento: Number(r.faturamento),
      }))
    },
    async avaliacoes() {
      const linhas = ok(await sb.from('avaliacoes').select('*')) ?? []
      return linhas.map((r: any): Avaliacao => ({
        unidadeId: r.unidade_id, plataforma: r.plataforma, nota: Number(r.nota), totalAvaliacoes: r.total_avaliacoes,
        notaHa30Dias: r.nota_ha_30_dias === null ? null : Number(r.nota_ha_30_dias), atualizadoEm: r.atualizado_em,
      }))
    },
  }
}
