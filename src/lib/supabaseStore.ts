import { createClient } from '@supabase/supabase-js'
import { soDigitos, type Store } from './store'
import type { DiariaFreela, Freelancer, Avaliacao, Chamado, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, Folga, Funcionario, Ocorrencia, VendaDia } from './types'

// O login é celular + senha. Internamente o Supabase usa um e-mail derivado do celular,
// assim não dependemos de SMS (que é pago).
const emailDoCelular = (celular: string) => `${soDigitos(celular)}@portal.theozzy`

const paraFuncionario = (r: any): Funcionario => ({
  id: r.id, nome: r.nome, celular: r.celular, cargo: r.cargo, unidadeId: r.unidade_id, nivel: r.nivel,
  status: r.status, dataAdmissao: r.data_admissao, dataDesligamento: r.data_desligamento, respondePara: r.responde_para, setor: r.setor, turnoId: r.turno_id, pix: r.pix,
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
  registradoPor: r.registrado_por, criadoEm: r.criado_em,
})

const deFuncionario = (f: Partial<Funcionario>) => ({
  nome: f.nome, celular: f.celular ? soDigitos(f.celular) : undefined, cargo: f.cargo, unidade_id: f.unidadeId,
  nivel: f.nivel, status: f.status, data_admissao: f.dataAdmissao, data_desligamento: f.dataDesligamento || null,
  responde_para: f.respondePara || null, setor: f.setor || null, pix: f.pix?.trim() || null,
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
    async caixinhaTotais(mes) {
      const linhas = ok(await sb.from('caixinha_mensal').select('*').eq('mes', mes)) ?? []
      return Object.fromEntries(linhas.map((r: any) => [r.unidade_id, Number(r.total)]))
    },
    async salvarCaixinhaTotal(mes, unidadeId, valor) {
      ok(await sb.from('caixinha_mensal').upsert({ mes, unidade_id: unidadeId, total: valor }))
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
      const linha = { nome: f.nome.trim(), cpf: soDigitos(f.cpf), pix: f.pix.trim(), celular: f.celular ? soDigitos(f.celular) : null, ativo: f.ativo }
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

const paraFreelancer = (r: any): Freelancer => ({ id: r.id, nome: r.nome, cpf: r.cpf, pix: r.pix, celular: r.celular, ativo: r.ativo })

const paraDiaria = (r: any): DiariaFreela => ({
  id: r.id, freelancerId: r.freelancer_id, data: r.data, turno: r.turno, unidadeId: r.unidade_id, funcao: r.funcao,
  valor: Number(r.valor), observacao: r.observacao, lancadoPor: r.lancado_por,
})
