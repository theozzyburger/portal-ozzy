import { createClient } from '@supabase/supabase-js'
import { codigoAleatorio, linkDaGuia, nomeProprio, soDigitos, type Store } from './store'
import type { Admissao, AjustePonto, DevolucaoUniforme, EnvioFreela, ContaPagamento, RemessaPagamento, VinculoAnterior, SolicitacaoUniforme, PedidoUniforme, ItemPedidoUniforme, Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, Salario, DiariaFreela, Freelancer, Avaliacao, Chamado, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, VendaDia } from './types'

// O login é celular + senha. Internamente o Supabase usa um e-mail derivado do celular,
// assim não dependemos de SMS (que é pago).
const emailDoCelular = (celular: string) => `${soDigitos(celular)}@portal.theozzy`

const paraFuncionario = (r: any): Funcionario => ({
  id: r.id, nome: r.nome, celular: r.celular, cargo: r.cargo, unidadeId: r.unidade_id, nivel: r.nivel,
  status: r.status, dataAdmissao: r.data_admissao, dataDesligamento: r.data_desligamento, respondePara: r.responde_para, setor: r.setor, turnoId: r.turno_id, pix: r.pix, foto: r.foto, optaVt: r.opta_vt ?? false, cpf: r.cpf ?? null, sexo: r.sexo ?? null,
  rg: r.rg ?? null, ctps: r.ctps ?? null, endereco: r.endereco ?? null,
  tamCamiseta: r.tam_camiseta ?? null, tamCalca: r.tam_calca ?? null, tamCalcado: r.tam_calcado ?? null,
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
const so = (v: string) => v.replace(/\D/g, '')

const paraSolicitacao = (r: any): SolicitacaoUniforme => ({
  id: r.id, funcionarioId: r.funcionario_id, itens: r.itens ?? [], motivo: r.motivo, foto: r.foto, status: r.status, resposta: r.resposta,
  respondidoPor: r.respondido_por, respondidoEm: r.respondido_em, criadoEm: r.criado_em,
})
const paraPedidoUniforme = (r: any): PedidoUniforme => ({
  id: r.id, numero: r.numero, titulo: r.titulo, status: r.status, fornecedor: r.fornecedor, observacao: r.observacao, criadoEm: r.criado_em,
  valorTotal: r.valor_total === null || r.valor_total === undefined ? null : Number(r.valor_total), fechadoEm: r.fechado_em ?? null, previsaoEntrega: r.previsao_entrega ?? null,
})

const paraDesligamento = (r: any): Desligamento => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo, itens: r.itens ?? {}, observacao: r.observacao, concluido: r.concluido,
})

const paraDocumento = (r: any): Documento & { caminho: string } => ({
  id: r.id, funcionarioId: r.funcionario_id, tipo: r.tipo, nomeArquivo: r.nome_arquivo, observacao: r.observacao,
  inicio: r.inicio, fim: r.fim, realizadoEm: r.realizado_em, vence: r.vence, enviadoPor: r.enviado_por, criadoEm: r.criado_em, caminho: r.caminho,
})

const paraDevolucao = (r: any): DevolucaoUniforme => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, itens: r.itens ?? [], totalDesconto: Number(r.total_desconto),
  observacao: r.observacao, conferidoPor: r.conferido_por, criadoEm: r.criado_em,
})

const paraAjuste = (r: any): AjustePonto => ({
  id: r.id, funcionarioId: r.funcionario_id, data: r.data, tipo: r.tipo, horario: r.horario, motivo: r.motivo, status: r.status,
  resposta: r.resposta, criadoEm: r.criado_em, resolvidoPor: r.resolvido_por, resolvidoEm: r.resolvido_em,
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
  nome: f.nome === undefined ? undefined : nomeProprio(f.nome), celular: f.celular ? soDigitos(f.celular) : undefined, cargo: f.cargo, unidade_id: f.unidadeId,
  nivel: f.nivel, status: f.status, data_admissao: f.dataAdmissao, data_desligamento: f.dataDesligamento || null,
  responde_para: f.respondePara || null, setor: f.setor || null, pix: f.pix?.trim() || null,
  opta_vt: f.optaVt ?? false,
  cpf: f.cpf ? soDigitos(f.cpf) : null, sexo: f.sexo || null,
  rg: f.rg?.trim() || null, ctps: f.ctps?.trim() || null, endereco: f.endereco?.trim() || null,
  data_nascimento: f.dataNascimento || null,
  tam_camiseta: f.tamCamiseta || null, tam_calca: f.tamCalca || null, tam_calcado: f.tamCalcado || null,
  experiencia_dias1: f.experienciaDias1 || null, experiencia_dias2: f.experienciaDias1 ? f.experienciaDias2 ?? 0 : null,
})

const ok = <T,>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) {
    // Erro de regra de acesso do banco vem em inglês; a gestão precisa entender o que houve.
    if (/row-level security/.test(error.message)) throw new Error('O banco não deixou salvar: sem permissão para esta alteração. Se você é da gestão, avise o Heitor.')
    throw new Error(error.message)
  }
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
    async trocarSenha(atual, nova) {
      const { data } = await sb.auth.getUser()
      const email = data.user?.email
      if (!email) throw new Error('Sessão expirada. Entre de novo.')
      const { error: erroAtual } = await sb.auth.signInWithPassword({ email, password: atual })
      if (erroAtual) throw new Error('A senha atual não confere.')
      const { error } = await sb.auth.updateUser({ password: nova })
      if (error) throw new Error(error.message.includes('different') ? 'A nova senha precisa ser diferente da atual.' : 'Não deu para trocar a senha. Tente de novo.')
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
    async abrirDocumento(d, segundos = 60) {
      const caminho = (d as Documento & { caminho?: string }).caminho
      if (!caminho) return null
      const { data } = await sb.storage.from('documentos').createSignedUrl(caminho, segundos)
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
    async valoresUniforme() {
      const rs = ok(await sb.from('uniforme_valores').select('item, valor')) ?? []
      return Object.fromEntries(rs.map((r: any) => [r.item, Number(r.valor)]))
    },
    async salvarValoresUniforme(valores) {
      const salvar = Object.entries(valores).filter(([, v]) => v !== null).map(([item, valor]) => ({ item, valor, atualizado_em: new Date().toISOString() }))
      const apagar = Object.entries(valores).filter(([, v]) => v === null).map(([item]) => item)
      if (salvar.length) ok(await sb.from('uniforme_valores').upsert(salvar))
      if (apagar.length) ok(await sb.from('uniforme_valores').delete().in('item', apagar))
    },
    async devolucoesUniforme(fid) {
      return (ok(await sb.from('uniforme_devolucoes').select('*').eq('funcionario_id', fid).order('criado_em', { ascending: false })) ?? []).map(paraDevolucao)
    },
    async registrarDevolucao(d) {
      const u = exigeEu()
      const total = d.itens.reduce((t, i) => t + Math.max(0, i.entregue - i.devolvido) * i.valor, 0)
      const r = ok(
        await sb.from('uniforme_devolucoes').insert({
          funcionario_id: d.funcionarioId, data: d.data, itens: d.itens, total_desconto: Math.round(total * 100) / 100,
          observacao: d.observacao?.trim() || null, conferido_por: u.id,
        }).select().single(),
      )
      return paraDevolucao(r)
    },
    async excluirDevolucao(id) {
      ok(await sb.from('uniforme_devolucoes').delete().eq('id', id))
    },
    async ajustesPonto(filtro) {
      let q = sb.from('ponto_ajustes').select('*').order('criado_em', { ascending: false }).limit(300)
      if (filtro === 'meus') q = q.eq('funcionario_id', exigeEu().id)
      if (filtro === 'pendente') q = q.eq('status', 'pendente')
      return (ok(await q) ?? []).map(paraAjuste)
    },
    async pedirAjustePonto(a) {
      const u = exigeEu()
      ok(await sb.from('ponto_ajustes').insert({ funcionario_id: u.id, data: a.data, tipo: a.tipo, horario: a.horario || null, motivo: a.motivo.trim() || null }))
    },
    async resolverAjustePonto(id, status, resposta) {
      const u = exigeEu()
      ok(await sb.from('ponto_ajustes').update({ status, resposta: resposta.trim() || null, resolvido_por: u.id, resolvido_em: new Date().toISOString() }).eq('id', id))
    },
    async excluirAjustePonto(id) {
      ok(await sb.from('ponto_ajustes').delete().eq('id', id))
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
        id: r.id, titulo: r.titulo, corpo: r.corpo, unidadeId: r.unidade_id, setores: r.setores ?? null, destinatarios: r.destinatarios ?? null, autorId: r.autor_id, criadoEm: r.criado_em,
        lidoPor: (r.comunicado_leituras ?? []).map((l: any) => l.funcionario_id),
      }))
    },
    async publicarComunicado(c) {
      const u = exigeEu()
      const r = ok(await sb.from('comunicados').insert({
        titulo: c.titulo, corpo: c.corpo, unidade_id: c.unidadeId, autor_id: u.id,
        setores: c.setores?.length ? c.setores : null, destinatarios: c.destinatarios?.length ? c.destinatarios : null,
      }).select().single())
      await sb.from('comunicado_leituras').insert({ comunicado_id: r.id, funcionario_id: u.id })
      return { id: r.id, titulo: r.titulo, corpo: r.corpo, unidadeId: r.unidade_id, setores: r.setores, destinatarios: r.destinatarios, autorId: r.autor_id, criadoEm: r.criado_em, lidoPor: [u.id] }
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
    async solicitacoesUniforme(fid) {
      let q = sb.from('uniforme_solicitacoes').select('*').order('criado_em', { ascending: false })
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map(paraSolicitacao)
    },
    async pedirTrocaUniforme(n) {
      let foto: string | null = null
      if (n.foto) {
        foto = `${n.funcionarioId}/uniforme-${Date.now()}.jpg`
        ok(await sb.storage.from('fotos').upload(foto, n.foto, { contentType: n.foto.type || 'image/jpeg' }))
      }
      ok(await sb.from('uniforme_solicitacoes').insert({ funcionario_id: n.funcionarioId, itens: n.itens, motivo: n.motivo.trim(), foto }))
    },
    async responderTrocaUniforme(id, status, resposta) {
      ok(await sb.from('uniforme_solicitacoes').update({
        status, resposta: texto(resposta), respondido_por: status === 'aberta' ? null : exigeEu().id, respondido_em: status === 'aberta' ? null : new Date().toISOString(),
      }).eq('id', id))
    },
    async fotoSolicitacao(x) {
      if (!x.foto) return null
      const { data } = await sb.storage.from('fotos').createSignedUrl(x.foto, 300)
      return data?.signedUrl ?? null
    },
    async contasPagamento() {
      return (ok(await sb.from('contas_pagamento').select('*').order('padrao', { ascending: false }).order('nome')) ?? []).map(paraConta)
    },
    async salvarContaPagamento(c) {
      const linha = {
        nome: c.nome.trim(), banco: c.banco, empresa_cnpj: so(c.empresaCnpj), empresa_nome: c.empresaNome.trim(),
        agencia: so(c.agencia), conta: so(c.conta), dac: so(c.dac), endereco: texto(c.endereco), numero: texto(c.numero),
        cidade: texto(c.cidade), cep: c.cep ? so(c.cep) : null, estado: c.estado?.toUpperCase() || null, padrao: c.padrao,
      }
      // Só uma conta fica marcada como padrão.
      if (c.padrao) ok(await sb.from('contas_pagamento').update({ padrao: false }).eq('padrao', true))
      return paraConta(c.id
        ? ok(await sb.from('contas_pagamento').update(linha).eq('id', c.id).select().single())
        : ok(await sb.from('contas_pagamento').insert(linha).select().single()))
    },
    async remessasPagamento(tipo, referencia) {
      return (ok(await sb.from('remessas_pagamento').select('*').eq('tipo', tipo).eq('referencia', referencia).order('criado_em', { ascending: false })) ?? []).map(paraRemessa)
    },
    async registrarRemessa(r) {
      return paraRemessa(ok(await sb.from('remessas_pagamento').insert({
        conta_id: r.contaId, tipo: r.tipo, referencia: r.referencia, data_pagamento: r.dataPagamento,
        quantidade: r.quantidade, valor_total: r.valorTotal, via: r.via, arquivo: r.arquivo, gerado_por: exigeEu().id,
      }).select().single()))
    },
    async pedidosUniforme() {
      return (ok(await sb.from('uniforme_pedidos').select('*').order('criado_em', { ascending: false })) ?? []).map(paraPedidoUniforme)
    },
    async salvarPedidoUniforme(p) {
      const linha = {
        titulo: p.titulo.trim(), status: p.status, fornecedor: texto(p.fornecedor), observacao: texto(p.observacao),
        valor_total: p.valorTotal ?? null, fechado_em: p.fechadoEm || null, previsao_entrega: p.previsaoEntrega || null,
      }
      return paraPedidoUniforme(p.id
        ? ok(await sb.from('uniforme_pedidos').update(linha).eq('id', p.id).select().single())
        : ok(await sb.from('uniforme_pedidos').insert(linha).select().single()))
    },
    async excluirPedidoUniforme(id) {
      ok(await sb.from('uniforme_pedidos').delete().eq('id', id))
    },
    async itensPedidoUniforme(pid) {
      return (ok(await sb.from('uniforme_pedido_itens').select('*').eq('pedido_id', pid)) ?? []).map((r: any): ItemPedidoUniforme => ({
        id: r.id, pedidoId: r.pedido_id, funcionarioId: r.funcionario_id, item: r.item, cor: r.cor, modelagem: r.modelagem, tamanho: r.tamanho, quantidade: r.quantidade,
      }))
    },
    async definirItensPedido(pid, fid, itens) {
      let del = sb.from('uniforme_pedido_itens').delete().eq('pedido_id', pid)
      del = fid ? del.eq('funcionario_id', fid) : del.is('funcionario_id', null)
      ok(await del)
      if (itens.length)
        ok(await sb.from('uniforme_pedido_itens').insert(itens.map((i) => ({
          pedido_id: pid, funcionario_id: fid, item: i.item, cor: i.cor, modelagem: i.modelagem, tamanho: i.tamanho, quantidade: i.quantidade,
        }))))
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
    async admissoes(fid) {
      let q = sb.from('admissoes').select('*')
      if (fid) q = q.eq('funcionario_id', fid)
      return (ok(await q) ?? []).map((r: any): Admissao => ({ funcionarioId: r.funcionario_id, dataAdmissao: r.data_admissao, itens: r.itens ?? {}, concluido: r.concluido }))
    },
    async salvarAdmissao(a) {
      ok(await sb.from('admissoes').upsert(
        { funcionario_id: a.funcionarioId, data_admissao: a.dataAdmissao, itens: a.itens, concluido: a.concluido },
        { onConflict: 'funcionario_id,data_admissao' },
      ))
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
    async excluirDesligamento(id) {
      ok(await sb.from('desligamentos').delete().eq('id', id))
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
    async enviarHolerite(s, pdf) {
      const caminho = `${s.funcionarioId}/${s.mes}-${s.tipo}.pdf`
      ok(await sb.storage.from('holerites').upload(caminho, pdf, { contentType: 'application/pdf', upsert: true }))
      ok(await sb.from('salarios').update({ holerite: caminho }).eq('funcionario_id', s.funcionarioId).eq('mes', s.mes).eq('tipo', s.tipo))
    },
    async abrirHolerite(s) {
      if (!s.holerite) return null
      const { data } = await sb.storage.from('holerites').createSignedUrl(s.holerite, 300)
      return data?.signedUrl ?? null
    },
    async vinculosAnteriores(fid) {
      return (ok(await sb.from('vinculos_anteriores').select('*').eq('funcionario_id', fid).order('admissao', { ascending: false })) ?? []).map((r: any): VinculoAnterior => ({
        id: r.id, funcionarioId: r.funcionario_id, admissao: r.admissao, desligamento: r.desligamento, tipoDesligamento: r.tipo_desligamento, cargo: r.cargo, observacao: r.observacao,
      }))
    },
    async readmitir(f, novaAdmissao, tipo) {
      if (f.dataDesligamento) {
        ok(await sb.from('vinculos_anteriores').insert({
          funcionario_id: f.id, admissao: f.dataAdmissao, desligamento: f.dataDesligamento, tipo_desligamento: tipo, cargo: f.cargo,
        }))
      }
      ok(await sb.from('funcionarios').update({
        status: 'ativo', data_admissao: novaAdmissao, data_desligamento: null, experiencia_dias1: null, experiencia_dias2: null,
      }).eq('id', f.id))
    },
    async salvarSalario(s) {
      ok(await sb.from('salarios').upsert({
        funcionario_id: s.funcionarioId, mes: s.mes, tipo: s.tipo, desc_adiantamento: s.descAdiantamento, salario: s.salario, caixinha: s.caixinha, bonus_caixinha: s.bonusCaixinha,
        bonus_conclui: s.bonusConclui, desc_faltas: s.descFaltas, desc_atrasos: s.descAtrasos, inss: s.inss, desc_vt: s.descVt,
        outros_creditos: s.outrosCreditos, outros_descontos: s.outrosDescontos, rubricas: s.rubricas ?? null,
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
        nome: nomeProprio(f.nome), cpf: f.cpf ? soDigitos(f.cpf) : null, pix: f.pix.trim(), celular: f.celular ? soDigitos(f.celular) : null,
        ativo: f.ativo, funcionario_id: f.funcionarioId,
      }
      const r = f.id
        ? ok(await sb.from('freelancers').update(linha).eq('id', f.id).select().single())
        : ok(await sb.from('freelancers').insert({ ...linha, criado_por: exigeEu().id }).select().single())
      return paraFreelancer(r)
    },
    async excluirFreelancer(id) {
      ok(await sb.rpc('freela_excluir', { p_freelancer: id }))
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
    async publicarGuia(funcionarioId, arquivo) {
      const u = exigeEu()
      const codigo = codigoAleatorio()
      ok(await sb.storage.from('guias').upload(`${codigo}.pdf`, arquivo, { contentType: 'application/pdf' }))
      ok(await sb.from('links_guia').insert({ codigo, funcionario_id: funcionarioId, expira_em: new Date(Date.now() + 7 * 86400_000).toISOString(), criado_por: u.id }))
      return linkDaGuia(codigo)
    },
    async abrirGuia(codigo) {
      const vale = ok(await sb.rpc('guia_valida', { p_codigo: codigo }))
      return vale ? sb.storage.from('guias').getPublicUrl(`${codigo}.pdf`).data.publicUrl : null
    },
    async lojasParaDiaria() {
      return ok(await sb.rpc('freela_lojas')) ?? []
    },
    async freelaQuemSou(cpf, celular) {
      return ok(await sb.rpc('freela_quem_sou', { p_cpf: cpf, p_celular: celular }))
    },
    async enviarDiarias(e) {
      return ok(await sb.rpc('freela_enviar_diarias', {
        p_cpf: e.cpf, p_celular: e.celular, p_nome: nomeProprio(e.nome), p_pix: e.pix, p_unidade: e.unidadeId, p_funcao: e.funcao, p_dias: e.dias, p_local: e.local,
      }))
    },
    async enviarMinhasDiarias(e) {
      return ok(await sb.rpc('freela_enviar_minhas_diarias', { p_pix: e.pix, p_unidade: e.unidadeId, p_funcao: e.funcao, p_dias: e.dias, p_local: e.local }))
    },
    async locaisLojas() {
      return (ok(await sb.from('unidades').select('id, nome, latitude, longitude').order('nome')) ?? []) as any
    },
    async definirLocalLoja(unidadeId, lat, lng) {
      ok(await sb.rpc('definir_local_loja', { p_unidade: unidadeId, p_lat: lat, p_lng: lng }))
    },
    async enviosFreela(status) {
      let q = sb.from('freela_envios').select('*')
      q = status === 'meus' ? q.eq('funcionario_id', exigeEu().id).order('data', { ascending: false }).limit(30) : q.eq('status', status).order('data')
      return (ok(await q) ?? []).map(paraEnvio)
    },
    async aprovarEnvioFreela(id, valor, funcao, usarPixNovo) {
      ok(await sb.rpc('freela_aprovar_envio', { p_envio: id, p_valor: valor, p_funcao: funcao, p_usar_pix: usarPixNovo }))
    },
    async recusarEnvioFreela(id, motivo) {
      ok(await sb.from('freela_envios').update({
        status: 'recusado', motivo: motivo.trim() || null, resolvido_por: exigeEu().id, resolvido_em: new Date().toISOString(),
      }).eq('id', id).eq('status', 'pendente'))
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

const paraEnvio = (r: any): EnvioFreela => ({
  id: r.id, cpf: r.cpf, celular: r.celular, nome: r.nome, pix: r.pix, freelancerId: r.freelancer_id, funcionarioId: r.funcionario_id,
  data: r.data, turno: r.turno, unidadeId: r.unidade_id, funcao: r.funcao, observacao: r.observacao, status: r.status,
  motivo: r.motivo, enviadoEm: r.enviado_em, naLoja: !!r.na_loja, distanciaLojaM: r.distancia_loja_m ?? null,
})

const paraConta = (r: any): ContaPagamento => ({
  id: r.id, nome: r.nome, banco: r.banco, empresaCnpj: r.empresa_cnpj, empresaNome: r.empresa_nome, agencia: r.agencia,
  conta: r.conta, dac: r.dac, endereco: r.endereco, numero: r.numero, cidade: r.cidade, cep: r.cep, estado: r.estado, padrao: r.padrao,
})

const paraRemessa = (r: any): RemessaPagamento => ({
  id: r.id, numero: r.numero, contaId: r.conta_id, tipo: r.tipo, referencia: r.referencia, dataPagamento: r.data_pagamento,
  quantidade: r.quantidade, valorTotal: Number(r.valor_total), via: r.via, arquivo: r.arquivo, criadoEm: r.criado_em,
})

const paraSalario = (r: any): Salario => ({
  funcionarioId: r.funcionario_id, mes: r.mes, tipo: r.tipo ?? 'salario', descAdiantamento: Number(r.desc_adiantamento ?? 0), salario: Number(r.salario), caixinha: Number(r.caixinha), bonusCaixinha: Number(r.bonus_caixinha),
  bonusConclui: Number(r.bonus_conclui), descFaltas: Number(r.desc_faltas), descAtrasos: Number(r.desc_atrasos), inss: Number(r.inss),
  descVt: Number(r.desc_vt), outrosCreditos: Number(r.outros_creditos ?? 0), outrosDescontos: Number(r.outros_descontos ?? 0), rubricas: r.rubricas ?? null, observacao: r.observacao, liberado: r.liberado, holerite: r.holerite ?? null,
})
