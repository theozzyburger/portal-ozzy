// Grupos por categoria do material (a da Eclética), em ordem alfabética; sem categoria no fim.
export function agruparPorCategoria<T extends { categoria?: string | null }>(itens: T[]): [string, T[]][] {
  const m = new Map<string, T[]>()
  for (const i of itens) {
    const c = i.categoria || 'Outros'
    m.set(c, [...(m.get(c) ?? []), i])
  }
  return [...m].sort(([a], [b]) => (a === 'Outros' ? 1 : b === 'Outros' ? -1 : a.localeCompare(b)))
}
