import { useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, estiloEntrada } from './ui'
import { useApp } from '../lib/contexto'
import { baixarRemessa, chaveFormatada, conferir, montarRemessa, tipoDaChave, type PagamentoBanco, type TipoRemessa } from '../lib/sispag'
import { dataLonga } from '../lib/datas'
import { reais } from '../pages/Fichas'
import type { ContaPagamento, RemessaPagamento } from '../lib/types'

const NOME_CHAVE = { telefone: 'celular', email: 'e-mail', cpfCnpj: 'CPF/CNPJ', aleatoria: 'chave aleatória' } as const

const NOME_TIPO: Record<TipoRemessa, string> = { salario: 'salários', adiantamento: 'adiantamentos', freelancer: 'diárias de freelancer' }

// Gera o arquivo de Pix em lote do banco (hoje o layout SISPAG do Itaú) com os pagamentos da tela.
// Quando a API do Itaú estiver liberada, é daqui que sai o envio: os pagamentos já vão no formato dela.
export default function ArquivoBanco({ tipo, referencia, dataPagamento, historico, pagamentos, aoFechar }: {
  tipo: TipoRemessa
  referencia: string
  dataPagamento: string
  historico: string
  pagamentos: PagamentoBanco[]
  aoFechar: () => void
}) {
  const { store, avisar } = useApp()
  const [contas, setContas] = useState<ContaPagamento[] | null>(null)
  const [contaId, setContaId] = useState('')
  const [anteriores, setAnteriores] = useState<RemessaPagamento[]>([])
  const [editandoConta, setEditandoConta] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = async () => {
    const [cs, rs] = await Promise.all([store.contasPagamento(), store.remessasPagamento(tipo, referencia)])
    setContas(cs)
    setContaId((atual) => atual || cs.find((c) => c.padrao)?.id || cs[0]?.id || '')
    setAnteriores(rs)
    if (!cs.length) setEditandoConta(true)
  }
  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const problemas = conferir(pagamentos)
  const bloqueados = new Set(problemas.map((p) => p.nome))
  const prontos = pagamentos.filter((p) => !bloqueados.has(p.nome))
  const total = prontos.reduce((t, p) => t + p.valor, 0)
  const conta = contas?.find((c) => c.id === contaId)

  const gerar = async () => {
    if (!conta) return setErro('Escolha a conta que vai pagar.')
    setGerando(true)
    setErro('')
    try {
      const remessa = montarRemessa({
        conta, tipo, pagamentos: prontos, dataPagamento, historico, sequencial: anteriores.length + 1,
      })
      baixarRemessa(remessa)
      await store.registrarRemessa({
        contaId: conta.id, tipo, referencia, dataPagamento, quantidade: remessa.quantidade,
        valorTotal: remessa.valorTotal, via: 'arquivo', arquivo: remessa.nomeArquivo,
      })
      avisar('Arquivo gerado. Agora é subir no Itaú, em pagamentos por arquivo.')
      aoFechar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setGerando(false)
    }
  }

  if (editandoConta) {
    return (
      <FormConta
        conta={conta && contas?.length ? conta : null}
        aoFechar={() => (contas?.length ? setEditandoConta(false) : aoFechar())}
        aoSalvar={async (c) => {
          const salva = await store.salvarContaPagamento(c)
          setContaId(salva.id)
          setEditandoConta(false)
          await carregar()
        }}
      />
    )
  }

  return (
    <Modal titulo={`Pix em lote · ${NOME_TIPO[tipo]}`} aberto aoFechar={aoFechar}>
      {!contas ? (
        <p className="py-6 text-center text-stone-500">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-stone-600">{prontos.length} {prontos.length === 1 ? 'pagamento' : 'pagamentos'} em {dataLonga(dataPagamento)}</span>
              <b className="text-lg tabular-nums">{reais(total)}</b>
            </div>
          </div>

          <Campo rotulo="Conta que vai pagar">
            <div className="flex gap-2">
              <select className={estiloEntrada} value={contaId} onChange={(e) => setContaId(e.target.value)}>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <Botao type="button" variante="secundario" onClick={() => setEditandoConta(true)}>Editar</Botao>
            </div>
          </Campo>
          {conta && (
            <p className="text-xs text-stone-500">
              Agência {conta.agencia} · conta {conta.conta}-{conta.dac} · CNPJ {conta.empresaCnpj}
            </p>
          )}

          {prontos.length > 0 && (
            <details className="rounded-xl p-3 ring-1 ring-stone-200">
              <summary className="cursor-pointer text-sm font-semibold">Conferir as chaves Pix</summary>
              <div className="mt-2 space-y-1">
                {prontos.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                    <span className="text-stone-600">{p.nome}</span>
                    <span>
                      <span className="text-xs text-stone-500">{NOME_CHAVE[tipoDaChave(p.chavePix)!]} </span>
                      <span className="break-all">{chaveFormatada(p.chavePix)}</span>
                      <b className="ml-2 tabular-nums">{reais(p.valor)}</b>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {problemas.length > 0 && (
            <div className="space-y-1 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300">
              <p className="text-sm font-semibold text-amber-900">Fora do arquivo, resolva no cadastro:</p>
              {problemas.slice(0, 6).map((p, i) => (
                <p key={i} className="text-sm text-amber-900">{p.nome}: {p.motivo}</p>
              ))}
              {problemas.length > 6 && <p className="text-sm text-amber-900">e mais {problemas.length - 6} pessoa{problemas.length - 6 === 1 ? '' : 's'}.</p>}
            </div>
          )}

          {anteriores.length > 0 && (
            <div className="space-y-1 rounded-xl p-3 ring-1 ring-stone-200">
              <p className="text-sm font-semibold">Já gerado antes</p>
              {anteriores.map((r) => (
                <p key={r.id} className="text-xs text-stone-500">
                  #{r.numero} · {r.quantidade} {r.quantidade === 1 ? 'pagamento' : 'pagamentos'} · {reais(r.valorTotal)} · {r.via === 'api' ? 'enviado pela API' : r.arquivo}
                </p>
              ))}
              <p className="text-xs font-semibold text-amber-700">Confira no banco antes de gerar de novo, para ninguém receber duas vezes.</p>
            </div>
          )}

          <p className="text-xs text-stone-500">
            O arquivo sai no layout SISPAG do Itaú (Pix em lote). Baixe aqui e suba no Itaú Empresas, em pagamentos por arquivo.
            Quando a API do Itaú estiver liberada na conta, o envio passa a ser direto do portal, com estes mesmos pagamentos.
          </p>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Botao className="w-full" disabled={gerando || !prontos.length || !conta} onClick={gerar}>
            {gerando ? 'Gerando…' : 'Gerar arquivo do banco'}
          </Botao>
          {!prontos.length && <Selo cor="ambar">Nenhum pagamento pronto</Selo>}
        </div>
      )}
    </Modal>
  )
}

function FormConta({ conta, aoFechar, aoSalvar }: {
  conta: ContaPagamento | null
  aoFechar: () => void
  aoSalvar: (c: Omit<ContaPagamento, 'id'> & { id?: string }) => Promise<void>
}) {
  const [v, setV] = useState({
    nome: conta?.nome ?? 'Itaú', empresaCnpj: conta?.empresaCnpj ?? '', empresaNome: conta?.empresaNome ?? '',
    agencia: conta?.agencia ?? '', conta: conta?.conta ?? '', dac: conta?.dac ?? '',
    endereco: conta?.endereco ?? '', numero: conta?.numero ?? '', cidade: conta?.cidade ?? '', cep: conta?.cep ?? '', estado: conta?.estado ?? 'SP',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const mudar = (k: keyof typeof v, t: string) => setV({ ...v, [k]: t })
  const campo = (k: keyof typeof v, rotulo: string, dica?: string) => (
    <Campo rotulo={rotulo} dica={dica}>
      <input className={estiloEntrada} value={v[k]} onChange={(e) => mudar(k, e.target.value)} />
    </Campo>
  )

  return (
    <Modal titulo={conta ? 'Conta que paga' : 'Cadastre a conta que paga'} aberto aoFechar={aoFechar}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const cnpj = v.empresaCnpj.replace(/\D/g, '')
          if (cnpj.length !== 14) return setErro('CNPJ da empresa tem 14 dígitos.')
          if (!v.agencia.replace(/\D/g, '') || !v.conta.replace(/\D/g, '') || !v.dac.replace(/\D/g, '')) return setErro('Preencha agência, conta e dígito.')
          setSalvando(true)
          setErro('')
          try {
            await aoSalvar({
              id: conta?.id, nome: v.nome, banco: '341', empresaCnpj: cnpj, empresaNome: v.empresaNome,
              agencia: v.agencia.replace(/\D/g, ''), conta: v.conta.replace(/\D/g, ''), dac: v.dac.replace(/\D/g, '').slice(-1),
              endereco: v.endereco || null, numero: v.numero || null, cidade: v.cidade || null,
              cep: v.cep.replace(/\D/g, '') || null, estado: v.estado || null, padrao: true,
            })
          } catch (err) {
            setErro((err as Error).message)
          } finally {
            setSalvando(false)
          }
        }}
      >
        <p className="text-sm text-stone-600">Esses dados vão no cabeçalho do arquivo, e o banco confere com a conta que você abre no Itaú Empresas.</p>
        {campo('nome', 'Nome que você dá a esta conta', 'Só para você achar aqui')}
        <div className="grid grid-cols-2 gap-3">
          {campo('empresaCnpj', 'CNPJ da empresa')}
          {campo('empresaNome', 'Razão social')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {campo('agencia', 'Agência')}
          {campo('conta', 'Conta')}
          {campo('dac', 'Dígito')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {campo('endereco', 'Endereço')}
          {campo('numero', 'Número')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {campo('cidade', 'Cidade')}
          {campo('cep', 'CEP')}
          {campo('estado', 'UF')}
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar conta'}</Botao>
      </form>
    </Modal>
  )
}
