import { useState } from 'react'
import { Botao, Campo, Modal, estiloEntrada } from './ui'
import { useApp } from '../lib/contexto'
import { hoje } from '../lib/datas'
import { ir } from '../lib/rota'
import { NIVEIS, type Funcionario, type Nivel } from '../lib/types'

export default function FormFuncionario({ aberto, aoFechar, existente }: { aberto: boolean; aoFechar: () => void; existente?: Funcionario }) {
  const { store, unidades, equipe, recarregarEquipe, avisar } = useApp()
  const [f, setF] = useState(() => ({
    nome: existente?.nome ?? '',
    celular: existente?.celular ?? '',
    cargo: existente?.cargo ?? '',
    unidadeId: existente?.unidadeId ?? unidades[0]?.id ?? 'burger',
    nivel: existente?.nivel ?? ('funcionario' as Nivel),
    dataAdmissao: existente?.dataAdmissao ?? hoje(),
    respondePara: existente?.respondePara ?? '',
  }))
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [campo]: e.target.value })

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const salvo = await store.salvarFuncionario(
        {
          ...f,
          id: existente?.id,
          respondePara: f.respondePara || null,
          status: existente?.status ?? 'ativo',
          dataDesligamento: existente?.dataDesligamento ?? null,
        },
        senha || undefined,
      )
      await recarregarEquipe()
      avisar(existente ? 'Cadastro atualizado' : 'Funcionário cadastrado')
      aoFechar()
      if (!existente) ir('rh/equipe/' + salvo.id)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const chefes = equipe.filter((x) => x.status === 'ativo' && x.nivel !== 'funcionario' && x.id !== existente?.id)

  return (
    <Modal titulo={existente ? 'Editar cadastro' : 'Cadastrar funcionário'} aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome completo">
          <input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} required />
        </Campo>
        <Campo rotulo="Celular (é o login)">
          <input className={estiloEntrada} inputMode="tel" value={f.celular} onChange={mudar('celular')} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Cargo">
            <input className={estiloEntrada} placeholder="Ex.: Chapeiro" value={f.cargo} onChange={mudar('cargo')} required />
          </Campo>
          <Campo rotulo="Admissão">
            <input className={estiloEntrada} type="date" value={f.dataAdmissao} onChange={mudar('dataAdmissao')} required />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Unidade">
            <select className={estiloEntrada} value={f.unidadeId} onChange={mudar('unidadeId')}>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Nível de acesso">
            <select className={estiloEntrada} value={f.nivel} onChange={mudar('nivel')}>
              {NIVEIS.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Responde para">
          <select className={estiloEntrada} value={f.respondePara} onChange={mudar('respondePara')}>
            <option value="">Ninguém (topo)</option>
            {chefes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {c.cargo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo={existente ? 'Nova senha (opcional)' : 'Senha inicial'}
          dica="Mínimo de 6 caracteres. Passe para a pessoa pessoalmente, não por grupo."
        >
          <input className={estiloEntrada} type="text" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required={!existente && store.modo === 'supabase'} />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Botao>
      </form>
    </Modal>
  )
}
