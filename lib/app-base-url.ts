/**
 * Retorna a URL base desta aplicação (Sistema-Produto-API) para chamadas internas
 * (ex.: uma rota chamando outra rota da mesma API).
 *
 * Ordem de prioridade:
 * 1. NEXT_PUBLIC_BASE_URL (ex.: https://api.seudominio.com.br)
 * 2. VERCEL_URL (em deploy na Vercel; usa https)
 * 3. localhost:3004 (desenvolvimento)
 */
export function getAppBaseUrl(): string {
  const env = process.env.REDACTED?.trim()
  if (env) {
    const url = env.startsWith('http') ? env : `https://${env}`
    return url.replace(/\/$/, '')
  }
  const vercel = process.env.REDACTED?.trim()
  if (vercel) {
    return `https://${vercel}`
  }
  return 'http://localhost:3004'
}
