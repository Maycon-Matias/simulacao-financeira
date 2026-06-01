import { getApiManager } from '@/lib/api-manager'
import type { CredSpotInlineCredentials } from '@/lib/credspot-resolve-client'

/**
 * Monta o objeto enviado nas rotas /api/produto/credspot/* para o servidor
 * reproduzir o mesmo registro que o usuário configurou no navegador.
 */
export function getCredSpotCredentialsForRequest(apiId: string): CredSpotInlineCredentials | undefined {
  if (typeof window === 'undefined') return undefined
  const c = getApiManager().getConfigs().find((x) => x.id === apiId && x.type === 'credspot')
  if (!c) return undefined
  const clientId = String((c as { clientId?: string }).clientId ?? '').trim()
  const clientSecret = String((c as { clientSecret?: string }).clientSecret ?? '').trim()
  if (!clientId || !clientSecret) return undefined
  const authUrl = (c as { authUrl?: string }).authUrl
  const audience = (c as { audience?: string }).audience
  return {
    clientId,
    clientSecret,
    baseUrl: c.baseUrl,
    ...(authUrl ? { authUrl } : {}),
    ...(audience ? { audience } : {}),
  }
}
