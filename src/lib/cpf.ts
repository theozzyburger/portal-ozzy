import { soDigitos } from './store'

export const formatarCpf = (cpf: string | null) => soDigitos(cpf ?? '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')

// Confere os dígitos verificadores do CPF.
export function cpfValido(cpf: string) {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
