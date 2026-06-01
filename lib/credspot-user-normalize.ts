/**
 * Normalização de CPF e data de nascimento para POST /entidade e fluxo CLT CredSpot.
 */

/** CPF apenas dígitos; ajusta tamanho 10→11; se > 11, mantém últimos 11. */
export function normalizeCpfDigits(raw: string): string {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.length > 11) {
    d = d.slice(-11)
  }
  if (d.length === 11) {
    return d
  }
  // 10 dígitos: costuma faltar o zero inicial (223…) ou o final (…454 sem o 0 do dígito)
  if (d.length === 10) {
    return d.startsWith('0') ? d.padEnd(11, '0') : d.padStart(11, '0')
  }
  if (d.length > 0 && d.length < 10) {
    return d.padStart(11, '0')
  }
  return d
}

/**
 * Aceita YYYY-MM-DD (HTML date) ou DD/MM/AAAA e DD-MM-AAAA (comum em cópia/colar).
 * Retorna YYYY-MM-DD ou null se inválido.
 */
export function birthToIsoDate(raw: string): string | null {
  const s = String(raw || '').trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10))
    if (!isReasonableYmd(y, m, d)) return null
    return s
  }

  const br = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s)
  if (br) {
    const day = parseInt(br[1], 10)
    const month = parseInt(br[2], 10)
    const year = parseInt(br[3], 10)
    if (!isReasonableYmd(year, month, day)) return null
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

function isReasonableYmd(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

/** Telefone apenas dígitos (CredSpot costuma esperar DDD+número, 10 ou 11 dígitos). */
export function normalizePhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '')
}
