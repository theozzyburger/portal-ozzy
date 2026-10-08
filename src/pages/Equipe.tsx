import { useState } from 'react'
import { Avatar, Botao, Cartao, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import FormFuncionario from '../components/FormFuncionario'
import AdmissoesAndamento from '../components/AdmissoesAndamento'
import { useApp } from '../lib/contexto'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import { SETORES, apelidoUnidade, nomeNivel, type Funcionario } from '../lib/types'

const casaSetor = (f: Funcionario, setor: string) => !setor || (setor === '__sem' ? !f.setor : f.setor === setor)

export default function Equipe() {
  const { eu, equipe, unidades, nomeUnidade } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [busca, setBusca] = useState('')
  const [unidade, setUnidade] = useState('')
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo')
  const [visao, setVisao] = useState<'lista' | 'organograma'>('lista')
  const [novo, setNovo] = useState(false)
  const [setor, setSetor] = useState('')

  const filtrados = equipe
    .filter((f) => f.status === status)
    .filter((f) => !unidade || f.unidadeId === unidade)
    .filter((f) => casaSetor(f, setor))
    .filter((f) => !busca || `${f.nome} ${f.cargo}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div>
      <Titulo acao={gestao && <Botao onClick={() => setNovo(true)}>+ Cadastrar</Botao>}>Equipe</Titulo>

      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${estiloEntrada} min-w-48 flex-1`} placeholder="Buscar por nome ou cargo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {unidades.length > 1 && gestao && (
          <select className={`${estiloEntrada} w-auto!`} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        )}
        <div className="flex rounded-xl bg-stone-200 p-1 text-sm font-semibold">
          {(['ativo', 'inativo'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 ${status === s ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
              {s === 'ativo' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl bg-stone-200 p-1 text-sm font-semibold">
          {(['lista', 'organograma'] as const).map((v) => (
            <button key={v} onClick={() => setVisao(v)} className={`rounded-lg px-3 py-1.5 ${visao === v ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
              {v === 'lista' ? 'Lista' : 'Organograma'}
            </button>
          ))}
        </div>
      </div>

      {gestao && status === 'ativo' && <AdmissoesAndamento />}

      <ContagemSetores pessoas={equipe.filter((f) => f.status === status && (!unidade || f.unidadeId === unidade))} setor={setor} escolher={setSetor} />

      {visao === 'organograma' ? (
        <Organograma pessoas={equipe.filter((f) => f.status === 'ativo' && (!unidade || f.unidadeId === unidade) && casaSetor(f, setor))} />
      ) : filtrados.length === 0 ? (
        <Vazio>Ninguém encontrado.</Vazio>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtrados.map((f) => (
            <Cartao key={f.id} className="min-w-0" onClick={() => ir('rh/equipe/' + f.id)}>
              <div className="flex items-center gap-3">
                <Avatar nome={f.nome} foto={f.fotoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{f.nome}</div>
                  <div className="truncate text-sm text-stone-500">{f.cargo}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Selo cor="azul">{apelidoUnidade(nomeUnidade(f.unidadeId))}</Selo>
                  {f.nivel !== 'funcionario' && <Selo>{nomeNivel(f.nivel)}</Selo>}
                </div>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {gestao && novo && <FormFuncionario aberto aoFechar={() => setNovo(false)} />}
    </div>
  )
}

// Organograma de cima para baixo, como o modelo que o Heitor mandou: cada pessoa numa caixa, ligada a quem
// ela responde. Quem tem muita gente direta (mais de 3 sem equipe própria) mostra essa turma numa coluna só,
// para o desenho não ficar largo demais.
function Organograma({ pessoas }: { pessoas: Funcionario[] }) {
  const ids = new Set(pessoas.map((p) => p.id))
  const raizes = pessoas.filter((p) => !p.respondePara || !ids.has(p.respondePara)).sort((a, b) => a.nome.localeCompare(b.nome))
  const filhos = (id: string) => pessoas.filter((p) => p.respondePara === id).sort((a, b) => a.nome.localeCompare(b.nome))
  const curto = (nome: string) => {
    const p = nome.split(' ')
    return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : nome
  }

  const Caixa = ({ p, escura }: { p: Funcionario; escura: boolean }) => (
    <button
      onClick={() => ir('rh/equipe/' + p.id)}
      className={`flex w-36 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center shadow-sm ring-1 transition hover:-translate-y-0.5 ${
        escura ? 'bg-carvao text-white ring-carvao' : 'bg-white ring-stone-200 hover:ring-carvao'
      }`}
    >
      <Avatar nome={p.nome} foto={p.fotoUrl} tamanho={36} />
      <span className="w-full truncate text-sm font-bold">{curto(p.nome)}</span>
      <span className={`w-full truncate text-[11px] font-semibold tracking-wide uppercase ${escura ? 'text-ozzy-400' : 'text-stone-500'}`}>{p.cargo}</span>
    </button>
  )

  const No = ({ p }: { p: Funcionario }) => {
    const fs = filhos(p.id)
    const folhas = fs.filter((c) => !filhos(c.id).length)
    const comEquipe = fs.filter((c) => filhos(c.id).length)
    const empilhar = folhas.length > 3
    return (
      <li>
        <Caixa p={p} escura={fs.length > 0} />
        {fs.length > 0 && (
          <ul>
            {comEquipe.map((c) => <No key={c.id} p={c} />)}
            {empilhar ? (
              <li>
                <div className="w-44 space-y-1 rounded-xl bg-stone-100 p-1.5 ring-1 ring-stone-200">
                  {folhas.map((c) => (
                    <button key={c.id} onClick={() => ir('rh/equipe/' + c.id)} className="flex w-full items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-left hover:ring-1 hover:ring-carvao">
                      <Avatar nome={c.nome} foto={c.fotoUrl} tamanho={24} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{curto(c.nome)}</span>
                        <span className="block truncate text-[10px] text-stone-500 uppercase">{c.cargo}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </li>
            ) : (
              folhas.map((c) => <No key={c.id} p={c} />)
            )}
          </ul>
        )}
      </li>
    )
  }

  if (pessoas.length === 0) return <Vazio>Ninguém para mostrar.</Vazio>
  return (
    <div className="overflow-x-auto rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="org mx-auto w-max min-w-full">
        <ul>
          {raizes.map((r) => <No key={r.id} p={r} />)}
        </ul>
      </div>
    </div>
  )
}

// Quantas pessoas por setor (pedido de 08/10), seguindo o filtro de loja e de ativos/inativos. Tocar filtra a lista.
function ContagemSetores({ pessoas, setor, escolher }: { pessoas: Funcionario[]; setor: string; escolher: (s: string) => void }) {
  const contagem = [
    ...SETORES.map((s) => ({ valor: s.valor as string, nome: s.nome, n: pessoas.filter((p) => p.setor === s.valor).length })),
    { valor: '__sem', nome: 'Sem setor', n: pessoas.filter((p) => !p.setor).length },
  ].filter((c) => c.n > 0)
  const chip = (ativo: boolean) =>
    `flex shrink-0 items-baseline gap-1.5 rounded-xl px-3 py-2 text-sm ring-1 ${ativo ? 'bg-carvao text-white ring-carvao' : 'bg-white ring-stone-200 hover:ring-carvao'}`
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      <button onClick={() => escolher('')} className={chip(!setor)}>
        <b className="text-lg tabular-nums">{pessoas.length}</b> no total
      </button>
      {contagem.map((c) => (
        <button key={c.valor} onClick={() => escolher(setor === c.valor ? '' : c.valor)} className={chip(setor === c.valor)}>
          <b className="text-lg tabular-nums">{c.n}</b> {c.nome}
        </button>
      ))}
    </div>
  )
}
