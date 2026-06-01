import { CredSpotClient } from '@/lib/credspot-client'
import { getApiManager } from '@/lib/api-manager'

/** Credenciais enviadas pelo navegador (localStorage não existe no servidor Next.js). */
export type CredSpotInlineCredentials = {
  clientId: string
  clientSecret: string
  baseUrl?: string
  authUrl?: string
  audience?: string
}

export function pickCredSpotInlineFromUnknown(input: unknown): CredSpotInlineCredentials | undefined {
  if (!input || typeof input !== 'object') return undefined
  const o = input as Record<string, unknown>
  const clientId = String(o.clientId ?? '').trim()
  const clientSecret = String(o.clientSecret ?? '').trim()
  if (!clientId || !clientSecret) return undefined
  return {
    clientId,
    clientSecret,
    ...(typeof o.baseUrl === 'string' && o.baseUrl ? { baseUrl: o.baseUrl } : {}),
    ...(typeof o.authUrl === 'string' && o.authUrl ? { authUrl: o.authUrl } : {}),
    ...(typeof o.audience === 'string' && o.audience ? { audience: o.audience } : {}),
  }
}

export function extractCredSpotInlineFromBody(body: Record<string, unknown> | undefined | null): CredSpotInlineCredentials | undefined {
  if (!body) return undefined
  const nested = pickCredSpotInlineFromUnknown(body.credspotCredentials)
  if (nested) return nested
  return pickCredSpotInlineFromUnknown({
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    baseUrl: body.baseUrl,
    authUrl: body.authUrl,
    audience: body.audience,
  })
}

export function extractCredSpotInlineFromSearchParams(sp: URLSearchParams): CredSpotInlineCredentials | undefined {
  const raw = sp.get('credspotCredentials')
  if (!raw) return undefined
  try {
    return pickCredSpotInlineFromUnknown(JSON.parse(raw))
  } catch {
    return undefined
  }
}

/**
 * registro CredSpot para a rota: prioriza credenciais inline (browser);
 * senão usa ApiManager (env / defaults no servidor).
 */
export function resolveCredSpotClient(apiId: string, inline?: CredSpotInlineCredentials | null): CredSpotClient | null {
  if (inline?.clientId && inline?.clientSecret) {
    return new CredSpotClient(inline.baseUrl, inline.clientId, inline.clientSecret, inline.authUrl, inline.audience)
  }
  const c = getApiManager().getClientById(apiId)
  return c instanceof CredSpotClient ? c : null
}

export const CREDSPOT_CLIENT_RESOLVE_ERROR =
  'API CredSpot não encontrada ou credenciais ausentes. Configure CREDSPOT_CLIENT_ID e CREDSPOT_CLIENT_SECRET no servidor (.env) ou informe credspotCredentials no corpo da requisição (credenciais salvas na tela de Configuração).'
