import { addDias, hoje } from './datas'
import type { Avaliacao, Canal, VendaDia } from './types'

// Dados de EXEMPLO para o painel de pedidos. Os reais vão vir do PDV e das plataformas.

// Pedidos num dia típico, de domingo a sábado.
const BASE: Record<string, number[]> = {
  'burger-psd': [150, 70, 72, 80, 95, 160, 175],
  'burger-va': [115, 55, 58, 62, 74, 125, 135],
  pizza: [140, 38, 44, 55, 70, 150, 165],
}

const MIX: Record<string, Record<Canal, number>> = {
  'burger-psd': { salao: 0.3, ifood: 0.42, proprio: 0.13, '99food': 0.15 },
  'burger-va': { salao: 0.18, ifood: 0.5, proprio: 0.12, '99food': 0.2 },
  pizza: { salao: 0.22, ifood: 0.38, proprio: 0.3, '99food': 0.1 },
}

const TICKET: Record<Canal, number> = { salao: 72, ifood: 61, proprio: 64, '99food': 57 }

// Ruído estável: o mesmo dia sempre gera os mesmos números.
const ruido = (chave: string) => {
  let h = 2166136261
  for (const c of chave) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

export function vendasDemo(inicio: string, fim: string): VendaDia[] {
  const linhas: VendaDia[] = []
  const ultimo = fim < hoje() ? fim : hoje()
  for (let d = inicio; d <= ultimo; d = addDias(d, 1)) {
    const dia = new Date(d + 'T12:00:00').getDay()
    // Crescimento leve ao longo das semanas.
    const semanas = (new Date(d + 'T12:00:00').getTime() - new Date('2026-01-01T12:00:00').getTime()) / 6048e5
    for (const [unidadeId, base] of Object.entries(BASE)) {
      const total = base[dia] * (1 + 0.008 * semanas) * (1 + 0.24 * ruido(unidadeId + d))
      for (const [canal, parte] of Object.entries(MIX[unidadeId]) as [Canal, number][]) {
        const pedidos = Math.max(0, Math.round(total * parte * (1 + 0.3 * ruido(unidadeId + d + canal))))
        const ticket = TICKET[canal] * (unidadeId === 'pizza' ? 1.45 : 1) * (1 + 0.12 * ruido(d + canal + unidadeId))
        linhas.push({ unidadeId, data: d, canal, pedidos, faturamento: Math.round(pedidos * ticket * 100) / 100 })
      }
    }
  }
  return linhas
}

export function avaliacoesDemo(): Avaliacao[] {
  const em = hoje() + 'T08:00:00'
  const a = (unidadeId: string, plataforma: Avaliacao['plataforma'], nota: number, totalAvaliacoes: number, notaHa30Dias: number) => ({
    unidadeId, plataforma, nota, totalAvaliacoes, notaHa30Dias, atualizadoEm: em,
  })
  return [
    a('burger-psd', 'ifood', 4.8, 3214, 4.7),
    a('burger-psd', '99food', 4.7, 812, 4.7),
    a('burger-va', 'ifood', 4.6, 1987, 4.7),
    a('burger-va', '99food', 4.9, 640, 4.8),
    a('pizza', 'ifood', 4.7, 2450, 4.6),
    a('pizza', '99food', 4.4, 395, 4.6),
  ]
}
