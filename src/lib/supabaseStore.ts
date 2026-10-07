import { createClient } from '@supabase/supabase-js'
import { soDigitos, type Store } from './store'
import type { Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, Salario, DiariaFreela, Freelancer, Avaliacao, Chamado, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, VendaDia } from './types'

// O login é celular + senha. Internamente o Supabase usa um e-mail derivado do celular,
// assim não dependemos de SMS (que é pago).
const emailDoCelular = (celular: string) => `${soDigitos(celular)}@portal.theozzy`

const paraFuncionario = (r: any): Funcionario => ({
  id: r.id, nome: r.nome, celular: r.celular, cargo: r.cargo, unidadeId: r.unidade_id, nivel: r.nivel,
  status: r.status, dataAdmissao: r.data_admissao, dataDesligamento: r.data_desligamento, respondePara: r.responde_para, setor: r.setor, turnoId: r.turno_id, pix: r.pix, foto: r.foto, optaVt: r.opta_vt ?? false, cpf: r.cpf ?? null, sexo: r.sexo ?? null,
  dataNascimento: r.data_nascimento ?? null, experienciaDias1: r.experiencia_dias1 ?? null, experienciaDias2: r.experiencia_dias2 ?? null,
})

const paraEquipamento = (r: any): Equipamento => ({
  id: r.id, unidadeId: r.unidade_id, nome: r.nome, marcaModelo: r.marca_modelo, numeroSerie: r.numero_serie, local: r.local, dataCompra: r.data_compra,
  valorCompra: r.valor_compra === null ? null : Number(r.valor_compra), valorAtual: r.valor_atual === null ? null : Number(r.valor_atual),
  foto: r.foto, observacao: r.observacao, ativo: r.ativo,
})
const paraPreventiva = (r: any): Preventiva => ({
  id: r.id, unidadeId: r.unidade_id, equipamentoId: r.equipamento_id, titulo: r.titulo, descricao: r.descricao, frequenciaDias: r.frequencia_dias, primeiraEm: r.primeira_em, ativo: r.ativo,
})
const texto = (v: string | null | undefined) => v?.trim() || null

const paraDesligamento = (r: any): Desligamento => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo, itens: r.itens ?? {}, observacao: r.observacao, concluido: r.concluido,
})

const paraDocumento = (r: any): Documento & { caminho: string } => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, nomeArquivo: r.nome_arquivo, observacao: r.observacao,
  inicio: r.inicio, fim: r.fim, realizadoEm: r.realizado_em, vence: r.vence, enviadoPor: r.enviado_por, criadoEm: r.criado_em, caminho: r.caminho,
})

const paraUniforme = (r: any): EntregaUniforme => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, itens: r.itens, observacao: r.observacao, entreguePor: r.entregue_por,
  assinatura: r.assinatura, assinadoEm: r.assinado_em, assinadoVia: r.assinado_via, criadoEm: r.criado_em,
})

const paraVersao = (r: any): VersaoRegulamento => ({
  id: r.id, numero: r.numero, texto: r.texto, nota: r.nota, publicadoEm: r.publicado_em, publicadoPor: r.publicado_por, hash: r.hash,
})

const paraChamado = (r: any): Chamado => ({
  id: r.id, numero: r.numero, unidadeId: r.unidade_id, categoria: r.categoria, gravidade: r.gravidade, titulo: r.titulo,
  descricao: r.descricao, local: r.local, foto: r.foto, status: r.status, abertoPor: r.aberto_por, abertoEm: r.aberto_em,
  responsavelId: r.responsavel_id, fechadoEm: r.fechado_em,
  eventos: (r.chamado_eventos ?? [])
    .map((e: any) => ({ id: e.id, autorId: e.autor_id, em: e.em, texto: e.texto, status: e.status }))
    .sort((a: any, b: any) => a.em.localeCompare(b.em)),
})

const paraOcorrencia = (r: any): Ocorrencia => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, data: r.data, descricao: r.descricao,
  natureza: r.natureza, suspensaoInicio: r.suspensao_inicio, suspensaoDias: r.suspensao_dias,
  registradoPor: r.registrado_por, criadoEm: r.criado_em,
})

const deFuncionario = (f: Partial<Funcionario>) => ({
  nome: f.nome, celular: f.celular ? soDigitos(f.celular) : undefined, cargo: f.cargo, unidade_id: f.unidadeId,
  nivel: f.nivel, status: f.status, data_admissao: f.dataAdmissao, data_desligamento: f.dataDesligamento || null,
  responde_para: f.respondePara || null, setor: f.setor || null, pix: f.pix?.trim() || null,
  opta_vt: f.optaVt ?? false,
  cpf: f.cpf ? soDigitos(f.cpf) : null, sexo: f.sexo || null,
  data_nascimento: f.dataNascimento || null,
  experiencia_dias1: f.experienciaDias1 || null, experiencia_dias2: f.experienciaDias1 ? f.experienciaDias2 ?? 0 : null,
})

const ok = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message)
  return data
}

// "Lembrar meu acesso": com a opção marcada, a sessão fica guardada no aparelho (localStorage);
// sem ela, some quando o navegador fecha (sessionStorage).
const CHAVE_LEMBRAR = 'ozzy-lembrar'
const tentar = <T,>(f: () => T, padrao: T) => {
  try { return f() } catch { return padrao }
}
const lembrar = () => tentar(() => localStorage.getItem(CHAVE_LEMBRAR) !== 'nao', true)
const guarda = () => (lembrar() ? localStorage : sessionStorage)
const armazenamento = {
  getItem: (k: string) => tentar(() => guarda().getItem(k), null),
  setItem: (k: string, v: string) => tentar(() => guarda().setItem(k, v), undefined),
  removeItem: (k: string) => tentar(() => { localStorage.removeItem(k); sessionStorage.removeItem(k) }, undefined),
}

export function criarSupabaseStore(url: string, chave: string): Store {
  const sb = createClient(url, chave, { auth: { storage: armazenamento, persistSession: true, autoRefreshToken: true } })
  let eu: Funcionario | null = null

  // Fotos ficam em armazenamento privado: gera endereços temporários de uma vez para a lista toda.
  const comFotos = async (pessoas: Funcionario[]) => {
    const caminhos = pessoas.map((p) => p.foto).filter((c): c is string => !!c)
    if (!caminhos.length) return pessoas
    const { data } = await sb.storage.from('fotos').createSignedUrls(caminhos, 60 * 60 * 24)
    const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
    return pessoas.map((p) => ({ ...p, fotoUrl: p.foto ? url.get(p.foto) ?? null : null }))
  }

  const carregarEu = async () => {
    const { data } = await sb.auth.getUser()
    if (!data.user) return (eu = null)
    const r = ok(await sb.from('funcionarios').select('*').eq('auth_user_id', data.user.id).eq('status', 'ativo').maybeSingle())
    return (eu = r ? (await comFotos([paraFuncionario(r)]))[0] : null)
  }
  const exigeEu = () => {
    if (!eu) throw new Error('Sessão expirada')
    return eu
  }

  return {
    modo: 'supabase',
    sessaoAtual: carregarEu,
    async entrar(celular, senha, lembrarAcesso = true) {
      tentar(() => localStorage.setItem(CHAVE_LEMBRAR, lembrarAcesso ? 'sim' : 'nao'), undefined)
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
      return comFotos((ok(await sb.from('funcionarios').select('*').order('nome')) ?? []).map(paraFuncionario))
    },
    async definirFoto(funcionarioId, imagem) {
      const caminho = `${funcionarioId}/${Date.now()}.jpg`
      ok(await sb.storage.from('fotos').upload(caminho, imagem, { contentType: 'image/jpeg' }))
      ok(await sb.rpc('definir_foto', { alvo: funcionarioId, caminho }))
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
          observacao: d.observacao || null, inicio: d.inicio || null, fim: d.fim || null,
          realizado_em: d.realizadoEm || null, vence: d.vence || null, enviado_por: u.id,
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
    async documentosTodos() {
      return (ok(await sb.from('documentos').select('*')) ?? []).map(paraDocumento)
    },
    async uniformes(fid) {
      return (ok(await sb.from('uniforme_entregas').select('*').eq('funcionario_id', fid).order('data', { ascending: false })) ?? []).map(paraUniforme)
    },
    async registrarUniforme(e) {
      const u = exigeEu()
      const r = ok(
        await sb.from('uniforme_entregas').insert({
          funcionario_id: e.funcionarioId, data: e.data, itens: e.itens, observacao: e.observacao || null, entregue_por: u.id,
          assinatura: e.assinatura ?? null, assinado_em: e.assinatura ? new Date().toISOString() : null, assinado_via: e.assinatura ? 'presencial' : null,
        }).select().single(),
      )
      return paraUniforme(r)
    },
    async assinarUniforme(id, assinatura) {
      ok(await sb.rpc('assinar_uniforme', { entrega: id, imagem: assinatura }))
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
          natureza: o.natureza || null, suspensao_inicio: o.suspensaoInicio || null, suspensao_dias: o.suspensaoDias || null,
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
      return linhas.map((r: any): Folga => ({ id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo ?? 'normal' }))
    },
    async definirFolga(fid, data, tipo) {
      if (!tipo) ok(await sb.from('folgas').delete().eq('funcionario_id', fid).eq('data', data))
      else ok(await sb.from('folgas').upsert({ funcionario_id: fid, data, tipo }, { onConflict: 'funcionario_id,data' }))
    },
    async ferias(fid) {
      let q = sb.from('ferias').select('*').order('inicio', { ascending: false })
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map((r: any): Ferias => ({
        id: r.id, funcionarioId: r.funcionario_id, aquisitivoInicio: r.aquisitivo_inicio, inicio: r.inicio, dias: r.dias, abonoDias: r.abono_dias, observacao: r.observacao,
      }))
    },
    async registrarFerias(f) {
      ok(await sb.from('ferias').insert({
        funcionario_id: f.funcionarioId, aquisitivo_inicio: f.aquisitivoInicio, inicio: f.inicio, dias: f.dias, abono_dias: f.abonoDias, observacao: f.observacao?.trim() || null,
      }))
    },
    async excluirFerias(id) {
      ok(await sb.from('ferias').delete().eq('id', id))
    },
    async decimoTerceiro(fid) {
      return (ok(await sb.from('decimo_terceiro').select('*').eq('funcionario_id', fid).order('ano', { ascending: false })) ?? []).map((r: any): DecimoTerceiro => ({
        id: r.id, funcionarioId: r.funcionario_id, ano: r.ano, parcela: r.parcela, valor: Number(r.valor), pagoEm: r.pago_em, observacao: r.observacao,
      }))
    },
    async registrarDecimoTerceiro(d) {
      ok(await sb.from('decimo_terceiro').insert({
        funcionario_id: d.funcionarioId, ano: d.ano, parcela: d.parcela, valor: d.valor, pago_em: d.pagoEm, observacao: d.observacao?.trim() || null,
      }))
    },
    async excluirDecimoTerceiro(id) {
      ok(await sb.from('decimo_terceiro').delete().eq('id', id))
    },
    async equipamentos() {
      return (ok(await sb.from('equipamentos').select('*').order('nome')) ?? []).map(paraEquipamento)
    },
    async salvarEquipamento(e, foto) {
      let caminho: string | undefined
      if (foto) {
        caminho = `equipamentos/${e.unidadeId}/${crypto.randomUUID()}.jpg`
        ok(await sb.storage.from('chamados').upload(caminho, foto, { contentType: foto.type || 'image/jpeg' }))
      }
      const linha = {
        unidade_id: e.unidadeId, nome: e.nome.trim(), marca_modelo: texto(e.marcaModelo), numero_serie: texto(e.numeroSerie), local: texto(e.local),
        data_compra: e.dataCompra || null, valor_compra: e.valorCompra, valor_atual: e.valorAtual, observacao: texto(e.observacao), ativo: e.ativo,
        ...(caminho ? { foto: caminho } : {}),
      }
      const r = e.id
        ? ok(await sb.from('equipamentos').update(linha).eq('id', e.id).select().single())
        : ok(await sb.from('equipamentos').insert(linha).select().single())
      return paraEquipamento(r)
    },
    async fotoEquipamento(e) {
      if (!e.foto) return null
      const { data } = await sb.storage.from('chamados').createSignedUrl(e.foto, 300)
      return data?.signedUrl ?? null
    },
    async manutencoesEquipamento(eid) {
      let q = sb.from('equipamento_manutencoes').select('*').order('data', { ascending: false })
      if (eid) q = q.eq('equipamento_id', eid)
      return (ok(await q) ?? []).map((r: any): ManutencaoEquipamento => ({
        id: r.id, equipamentoId: r.equipamento_id, data: r.data, tipo: r.tipo, descricao: r.descricao, prestador: r.prestador,
        custo: r.custo === null ? null : Number(r.custo), chamadoId: r.chamado_id, registradoPor: r.registrado_por,
      }))
    },
    async registrarManutencaoEquipamento(m) {
      ok(await sb.from('equipamento_manutencoes').insert({
        equipamento_id: m.equipamentoId, data: m.data, tipo: m.tipo, descricao: m.descricao.trim(), prestador: texto(m.prestador), custo: m.custo, chamado_id: m.chamadoId,
      }))
    },
    async excluirManutencaoEquipamento(id) {
      ok(await sb.from('equipamento_manutencoes').delete().eq('id', id))
    },
    async preventivas() {
      return (ok(await sb.from('preventivas').select('*').order('titulo')) ?? []).map(paraPreventiva)
    },
    async salvarPreventiva(p) {
      const linha = {
        unidade_id: p.unidadeId || null, equipamento_id: p.equipamentoId || null, titulo: p.titulo.trim(), descricao: texto(p.descricao),
        frequencia_dias: p.frequenciaDias, primeira_em: p.primeiraEm, ativo: p.ativo,
      }
      if (p.id) ok(await sb.from('preventivas').update(linha).eq('id', p.id))
      else ok(await sb.from('preventivas').insert(linha))
    },
    async excluirPreventiva(id) {
      ok(await sb.from('preventivas').delete().eq('id', id))
    },
    async execucoesPreventiva() {
      return (ok(await sb.from('preventiva_execucoes').select('*').order('feito_em', { ascending: false })) ?? []).map((r: any): ExecucaoPreventiva => ({
        id: r.id, preventivaId: r.preventiva_id, unidadeId: r.unidade_id, feitoEm: r.feito_em, observacao: r.observacao, feitoPor: r.feito_por,
      }))
    },
    async registrarExecucao(x) {
      ok(await sb.from('preventiva_execucoes').insert({ preventiva_id: x.preventivaId, unidade_id: x.unidadeId, feito_em: x.feitoEm, observacao: texto(x.observacao) }))
    },
    async excluirExecucao(id) {
      ok(await sb.from('preventiva_execucoes').delete().eq('id', id))
    },
    async desligamentos(fid) {
      let q = sb.from('desligamentos').select('*').order('data', { ascending: false })
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map(paraDesligamento)
    },
    async abrirDesligamento(d) {
      return paraDesligamento(ok(await sb.from('desligamentos').insert({
        funcionario_id: d.funcionarioId, data: d.data, tipo: d.tipo, observacao: d.observacao?.trim() || null,
      }).select().single()))
    },
    async atualizarDesligamento(id, m) {
      const linha: Record<string, unknown> = {}
      if (m.itens) linha.itens = m.itens
      if (m.concluido !== undefined) linha.concluido = m.concluido
      if (m.observacao !== undefined) linha.observacao = m.observacao?.trim() || null
      if (m.data) linha.data = m.data
      if (m.tipo) linha.tipo = m.tipo
      ok(await sb.from('desligamentos').update(linha).eq('id', id))
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
    async caixinhaTotais(mes) {
      const linhas = ok(await sb.from('caixinha_mensal').select('*').eq('mes', mes)) ?? []
      return Object.fromEntries(linhas.map((r: any) => [r.unidade_id, Number(r.total)]))
    },
    async salvarCaixinhaTotal(mes, unidadeId, valor) {
      ok(await sb.from('caixinha_mensal').upsert({ mes, unidade_id: unidadeId, total: valor }))
    },
    async salarios(mes) {
      return (ok(await sb.from('salarios').select('*').eq('mes', mes)) ?? []).map(paraSalario)
    },
    async salariosDe(funcionarioId) {
      return (ok(await sb.from('salarios').select('*').eq('funcionario_id', funcionarioId).order('mes', { ascending: false })) ?? []).map(paraSalario)
    },
    async salvarSalario(s) {
      ok(await sb.from('salarios').upsert({
        funcionario_id: s.funcionarioId, mes: s.mes, tipo: s.tipo, desc_adiantamento: s.descAdiantamento, salario: s.salario, caixinha: s.caixinha, bonus_caixinha: s.bonusCaixinha,
        bonus_conclui: s.bonusConclui, desc_faltas: s.descFaltas, desc_atrasos: s.descAtrasos, inss: s.inss, desc_vt: s.descVt,
        observacao: s.observacao?.trim() || null, liberado: s.liberado, atualizado_em: new Date().toISOString(),
      }))
    },
    async liberarSalarios(mes, tipo, liberado) {
      ok(await sb.from('salarios').update({ liberado }).eq('mes', mes).eq('tipo', tipo))
    },
    async turnos() {
      const linhas = ok(await sb.from('turnos').select('*').order('ordem')) ?? []
      return linhas.map((r: any) => ({ id: r.id, local: r.local, nome: r.nome, dias: r.dias }))
    },
    async atribuirTurno(fid, turnoId) {
      ok(await sb.from('funcionarios').update({ turno_id: turnoId }).eq('id', fid))
    },
    async salvarTurno(t, novo) {
      const dados = { local: t.local, nome: t.nome, dias: t.dias }
      if (!novo) return void ok(await sb.from('turnos').update(dados).eq('id', t.id))
      const ultimo = ok(await sb.from('turnos').select('ordem').order('ordem', { ascending: false }).limit(1))
      ok(await sb.from('turnos').insert({ ...dados, id: t.id, ordem: (ultimo?.[0]?.ordem ?? 0) + 1 }))
    },
    async excluirTurno(id) {
      // Quem estava no turno fica sem turno (turno_id vira nulo pelo banco).
      ok(await sb.from('turnos').delete().eq('id', id))
    },
    async chamados() {
      const linhas = ok(await sb.from('chamados').select('*, chamado_eventos(*)').order('aberto_em', { ascending: false })) ?? []
      return linhas.map(paraChamado)
    },
    async abrirChamado(n) {
      let foto: string | null = null
      if (n.foto) {
        foto = `${n.unidadeId}/${crypto.randomUUID()}-${n.foto.name}`
        ok(await sb.storage.from('chamados').upload(foto, n.foto))
      }
      // Quem abriu, data e hora são preenchidos pelo banco.
      const r = ok(await sb.from('chamados').insert({
        unidade_id: n.unidadeId, categoria: n.categoria, gravidade: n.gravidade, titulo: n.titulo,
        descricao: n.descricao, local: n.local || null, foto,
      }).select().single())
      return paraChamado(r)
    },
    async atualizarChamado(id, m) {
      ok(await sb.rpc('atualizar_chamado', { chamado: id, novo_status: m.status ?? null, comentario: m.texto?.trim() || null }))
    },
    async fotoChamado(c) {
      if (!c.foto) return null
      const { data } = await sb.storage.from('chamados').createSignedUrl(c.foto, 300)
      return data?.signedUrl ?? null
    },
    async versoesRegulamento() {
      const linhas = ok(await sb.from('regulamento_versoes').select('*').order('numero', { ascending: false })) ?? []
      return linhas.map(paraVersao)
    },
    async publicarRegulamento(texto, nota) {
      return paraVersao(ok(await sb.from('regulamento_versoes').insert({ texto, nota: nota || null, publicado_por: exigeEu().id }).select().single()))
    },
    async leiturasRegulamento() {
      const linhas = ok(await sb.from('regulamento_leituras').select('*')) ?? []
      return linhas.map((r: any) => ({
        funcionarioId: r.funcionario_id, versaoId: r.versao_id, assinatura: r.assinatura, assinadoEm: r.assinado_em,
        hash: r.hash, dispositivo: r.dispositivo, ip: r.ip,
      }))
    },
    async assinarRegulamento(versaoId, assinatura) {
      // Data, hash do texto e IP são gravados pelo banco, não pelo aparelho.
      ok(await sb.from('regulamento_leituras').insert({ funcionario_id: exigeEu().id, versao_id: versaoId, assinatura, dispositivo: navigator.userAgent }))
    },
    async avaliacoes() {
      const linhas = ok(await sb.from('avaliacoes').select('*')) ?? []
      return linhas.map((r: any): Avaliacao => ({
        unidadeId: r.unidade_id, plataforma: r.plataforma, nota: Number(r.nota), totalAvaliacoes: r.total_avaliacoes,
        notaHa30Dias: r.nota_ha_30_dias === null ? null : Number(r.nota_ha_30_dias), atualizadoEm: r.atualizado_em,
      }))
    },
    async fichas() {
      const [fichas, custos, sinc] = await Promise.all([
        sb.from('lf_fichas').select('*'),
        // Para quem não é da gestão o banco devolve vazio (regra de acesso).
        sb.from('lf_fichas_custo').select('*'),
        sb.from('lf_sincronizacao').select('em').eq('dado', 'fichas').maybeSingle(),
      ])
      const porId = new Map((ok(custos) ?? []).map((c: any) => [c.produto_id, c]))
      return {
        atualizadoEm: ok(sinc)?.em ?? null,
        fichas: (ok(fichas) ?? []).map((r: any) => {
          const c: any = porId.get(r.produto_id)
          return {
            produtoId: r.produto_id, nome: r.nome, categoria: r.categoria, preparo: r.preparo,
            itens: (r.itens ?? []).map((i: any) => ({ ...i, qtd: Number(i.qtd) })),
            custo: c && {
              total: Number(c.custo), preco: Number(c.preco),
              itens: (c.itens ?? []).map((i: any) => ({ custoUnit: Number(i.custoUnit), total: Number(i.total) })),
            },
          }
        }),
      }
    },
    async resultados() {
      const [linhas, sinc] = await Promise.all([
        sb.from('lf_resultados').select('*'),
        sb.from('lf_sincronizacao').select('em').eq('dado', 'resultados').maybeSingle(),
      ])
      return {
        atualizadoEm: ok(sinc)?.em ?? null,
        linhas: (ok(linhas) ?? []).map((r: any) => ({
          unidadeId: r.unidade_id, mes: r.mes, pedidos: r.pedidos, faturamento: Number(r.faturamento), cmv: Number(r.cmv),
          impostos: Number(r.impostos), comissoes: Number(r.comissoes), taxasPagamento: Number(r.taxas_pagamento),
          custosOperacionais: Number(r.custos_operacionais), lucroOperacional: Number(r.lucro_operacional), ticketMedio: Number(r.ticket_medio),
        })),
      }
    },
    async freelancers() {
      return (ok(await sb.from('freelancers').select('*').order('nome')) ?? []).map(paraFreelancer)
    },
    async salvarFreelancer(f) {
      const linha = {
        nome: f.nome.trim(), cpf: f.cpf ? soDigitos(f.cpf) : null, pix: f.pix.trim(), celular: f.celular ? soDigitos(f.celular) : null,
        ativo: f.ativo, funcionario_id: f.funcionarioId,
      }
      const r = f.id
        ? ok(await sb.from('freelancers').update(linha).eq('id', f.id).select().single())
        : ok(await sb.from('freelancers').insert({ ...linha, criado_por: exigeEu().id }).select().single())
      return paraFreelancer(r)
    },
    async diariasFreela(inicio, fim) {
      return (ok(await sb.from('freela_diarias').select('*').gte('data', inicio).lte('data', fim).order('data')) ?? []).map(paraDiaria)
    },
    async lancarDiaria(d) {
      const { data, error } = await sb.from('freela_diarias').insert({
        freelancer_id: d.freelancerId, data: d.data, turno: d.turno, unidade_id: d.unidadeId, funcao: d.funcao.trim(),
        valor: d.valor, observacao: d.observacao?.trim() || null,
      }).select().single()
      if (error?.code === '23505') throw new Error('Esse freelancer já tem diária lançada nesse dia e turno.')
      return paraDiaria(ok({ data, error }))
    },
    async excluirDiaria(id) {
      ok(await sb.from('freela_diarias').delete().eq('id', id))
    },
    async pagamentosFreela(semana) {
      return (ok(await sb.from('freela_pagamentos').select('*').eq('semana', semana)) ?? []).map((r: any) => ({
        freelancerId: r.freelancer_id, semana: r.semana, valor: Number(r.valor), pagoEm: r.pago_em, pagoPor: r.pago_por,
      }))
    },
    async marcarPagoFreela(freelancerId, semana, valor) {
      ok(await sb.from('freela_pagamentos').insert({ freelancer_id: freelancerId, semana, valor }))
    },
    async desfazerPagoFreela(freelancerId, semana) {
      ok(await sb.from('freela_pagamentos').delete().eq('freelancer_id', freelancerId).eq('semana', semana))
    },
  }
}

const paraFreelancer = (r: any): Freelancer => ({
  id: r.id, nome: r.nome, cpf: r.cpf, pix: r.pix, celular: r.celular, ativo: r.ativo, funcionarioId: r.funcionario_id,
})

const paraDiaria = (r: any): DiariaFreela => ({
  id: r.id, freelancerId: r.freelancer_id, data: r.data, turno: r.turno, unidadeId: r.unidade_id, funcao: r.funcao,
  valor: Number(r.valor), observacao: r.observacao, lancadoPor: r.lancado_por,
})

const paraSalario = (r: any): Salario => ({
  funcionarioId: r.funcionario_id, mes: r.mes, tipo: r.tipo ?? 'salario', descAdiantamento: Number(r.desc_adiantamento ?? 0), salario: Number(r.salario), caixinha: Number(r.caixinha), bonusCaixinha: Number(r.bonus_caixinha),
  bonusConclui: Number(r.bonus_conclui), descFaltas: Number(r.desc_faltas), descAtrasos: Number(r.desc_atrasos), inss: Number(r.inss),
  descVt: Number(r.desc_vt), observacao: r.observacao, liberado: r.liberado,
})
