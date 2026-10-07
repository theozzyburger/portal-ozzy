import { useState } from 'react'
import { Botao, Campo, Modal, estiloEntrada } from './ui'
import { CARGOS } from '../lib/cargos'
import { cpfValido, formatarCpf } from '../lib/cpf'
import { soDigitos } from '../lib/store'
import { niveisQuePossoDar } from '../lib/permissoes'
import { useApp } from '../lib/contexto'
import { hoje } from '../lib/datas'
import { ir } from '../lib/rota'
import { NIVEIS, SETORES, type Funcionario, type Nivel } from '../lib/types'

export default function FormFuncionario({ aberto, aoFechar, existente }: { aberto: boolean; aoFechar: () => void; existente?: Funcionario }) {
  const { eu, store, unidades, equipe, recarregarEquipe, avisar } = useApp()
  const [f, setF] = useState(() => ({
    nome: existente?.nome ?? '',
    celular: existente?.celular ?? '',
    cargo: existente?.cargo ?? '',
    unidadeId: existente?.unidadeId ?? unidades[0]?.id ?? '',
    nivel: existente?.nivel ?? ('funcionario' as Nivel),
    dataAdmissao: existente?.dataAdmissao ?? hoje(),
    respondePara: existente?.respondePara ?? '',
    setor: existente?.setor ?? '',
    pix: existente?.pix ?? '',
    cpf: existente?.cpf ? formatarCpf(existente.cpf) : '',
    sexo: existente?.sexo ?? '',
  }))
  const [optaVt, setOptaVt] = useState(existente?.optaVt ?? false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [campo]: e.target.value })

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (f.cpf && !cpfValido(f.cpf)) return setErro('CPF inválido. Confira os números.')
    setSalvando(true)
    try {
      const salvo = await store.salvarFuncionario(
        {
          ...f,
          optaVt,
          cpf: f.cpf ? soDigitos(f.cpf) : null,
          sexo: (f.sexo || null) as Funcionario['sexo'],
          id: existente?.id,
          respondePara: f.respondePara || null,
          setor: (f.setor || null) as Funcionario['setor'],
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
          <Campo rotulo="CPF">
            <input className={estiloEntrada} inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={mudar('cpf')} onBlur={() => cpfValido(f.cpf) && setF({ ...f, cpf: formatarCpf(f.cpf) })} />
          </Campo>
          <Campo rotulo="Sexo">
            <select className={estiloEntrada} value={f.sexo} onChange={mudar('sexo')}>
              <option value="">—</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          </Campo>
        </div>
        <Campo rotulo="Chave Pix" dica="CPF, celular, e-mail ou chave aleatória. Só a pessoa e a gestão veem.">
          <input className={estiloEntrada} value={f.pix} onChange={mudar('pix')} />
        </Campo>
        <label className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm ring-1 ring-stone-200">
          <input type="checkbox" className="size-5 accent-carvao" checked={optaVt} onChange={(e) => setOptaVt(e.target.checked)} />
          <span>
            <span className="font-medium">Optou pelo vale-transporte</span>
            <span className="block text-xs text-stone-500">Desconta 6% do salário no mês.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Cargo" dica="Escolha da lista ou digite outro.">
            <input className={estiloEntrada} placeholder="Ex.: Atendente" value={f.cargo} onChange={mudar('cargo')} required list="cargos" />
            <datalist id="cargos">
              {CARGOS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Admissão">
            <input className={estiloEntrada} type="date" value={f.dataAdmissao} onChange={mudar('dataAdmissao')} required />
          </Campo>
        </div>
        <Campo rotulo="Setor" dica="Define o grupo do bônus da caixinha.">
          <select className={estiloEntrada} value={f.setor} onChange={mudar('setor')}>
            <option value="">—</option>
            {SETORES.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.nome}
              </option>
            ))}
          </select>
        </Campo>
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
              {NIVEIS.filter((n) => niveisQuePossoDar(eu)(n.valor)).map((n) => (
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
