import { useState } from 'react'
import { Avatar, Botao, Cartao, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import FormFuncionario from '../components/FormFuncionario'
import { useApp } from '../lib/contexto'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import { apelidoUnidade, nomeNivel, type Funcionario } from '../lib/types'

export default function Equipe() {
  const { eu, equipe, unidades, nomeUnidade } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [busca, setBusca] = useState('')
  const [unidade, setUnidade] = useState('')
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo')
  const [visao, setVisao] = useState<'lista' | 'organograma'>('lista')
  const [novo, setNovo] = useState(false)

  const filtrados = equipe
    .filter((f) => f.status === status)
    .filter((f) => !unidade || f.unidadeId === unidade)
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

      {visao === 'organograma' ? (
        <Organograma pessoas={equipe.filter((f) => f.status === 'ativo' && (!unidade || f.unidadeId === unidade))} />
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

function Organograma({ pessoas }: { pessoas: Funcionario[] }) {
  const ids = new Set(pessoas.map((p) => p.id))
  // Topo: quem não responde a ninguém visível.
  const raizes = pessoas.filter((p) => !p.respondePara || !ids.has(p.respondePara))
  const filhos = (id: string) => pessoas.filter((p) => p.respondePara === id).sort((a, b) => a.nome.localeCompare(b.nome))

  const No = ({ p, nivel }: { p: Funcionario; nivel: number }) => (
    <div className={nivel > 0 ? 'ml-4 border-l-2 border-stone-200 pl-4 sm:ml-6 sm:pl-6' : ''}>
      <button onClick={() => ir('rh/equipe/' + p.id)} className="my-1.5 flex w-full max-w-sm items-center gap-3 rounded-xl bg-white p-2.5 text-left ring-1 ring-stone-200 hover:ring-carvao">
        <Avatar nome={p.nome} foto={p.fotoUrl} tamanho={32} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{p.nome}</div>
          <div className="truncate text-xs text-stone-500">{p.cargo}</div>
        </div>
      </button>
      {filhos(p.id).map((c) => (
        <No key={c.id} p={c} nivel={nivel + 1} />
      ))}
    </div>
  )

  if (pessoas.length === 0) return <Vazio>Ninguém para mostrar.</Vazio>
  return (
    <div className="overflow-x-auto">
      {raizes.map((r) => (
        <No key={r.id} p={r} nivel={0} />
      ))}
    </div>
  )
}
