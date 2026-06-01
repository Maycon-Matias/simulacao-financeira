/**
 * Modelo padronizado de resposta dos bancos para o fluxo WhatsApp.
 */

export type BancoResultadoStatus = 'APROVADO' | 'REPROVADO' | 'PENDENTE_TERMO' | 'ERRO'

export interface BancoResultado {
  banco: 'V8' | 'C6'
  margem: number
  status: BancoResultadoStatus
  motivo?: string
  raw?: Record<string, unknown>
}

export function normalizarMargem(value: unknown): number {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function statusFromMargem(margem: number, motivo?: string): BancoResultadoStatus {
  if (motivo && String(motivo).trim().length > 0) return 'REPROVADO'
  return margem > 0 ? 'APROVADO' : 'REPROVADO'
}
