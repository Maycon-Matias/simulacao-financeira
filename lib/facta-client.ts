import type { ApiResponse } from './api-client'

/**
 * registro para a API Facta.
 * Autenticação: GET gera-token com Basic Auth (usuário/******).
 * Variáveis: FACTA_API_BASE_URL, FACTA_API_USERNAME, FACTA_API_PASSWORD,
 * FACTA_API_TIMEOUT_MS (opcional), FACTA_API_LOG (opcional, '1' para ativar logs).
 */

/** Resposta do endpoint GET /gera-token (Manual v2.0: erro, mensagem, token, expira) */
export interface FactaTokenResponse {
  erro?: boolean
  mensagem?: string
  token?: string
  expira?: string
  accessToken?: string
  access_token?: string
  expiresIn?: number
  expiration?: string
}

/** Resposta da consulta de dados do trabalhador (vínculos CLT) */
export interface FactaConsultaResponse {
  [key: string]: unknown
}

/** Resposta da solicitação de autorização de consulta */
export interface FactaAutorizacaoResponse {
  [key: string]: unknown
}

/** Parâmetros para solicitar autorização de consulta (envio do link por SMS ou WhatsApp). */
export interface FactaSolicitarAutorizacaoParams {
  /**
   * Código do averbador na FACTA.
   * Quando não informado, será usado FACTA_AVERBADOR_ID (ou NEXT_PUBLIC_FACTA_AVERBADOR_ID), padrão 10010.
   */
  averbador?: string
  nome: string
  cpf: string
  celular: string
  tipo_envio: 'SMS' | 'WHATSAPP'
}

/** Resultado padronizado para consultarComFallback (multi-bank) */
export interface FactaConsultarFallbackResult {
  banco: string
  success: boolean
  data?: unknown
  error?: string
}

/** Headers que parecem um registro legítimo, para reduzir bloqueio por Cloudflare/WAF. */
const FACTA_DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'entidade-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

export class FactaClient {
  private baseUrl: string
  private username: string
  private ******: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private readonly timeout: number
  private readonly logEnabled: boolean
  /** Caminho do endpoint de consulta de vínculos CLT (pode ser sobrescrito por env). */
  private consultarVinculosPath: string

  constructor(baseUrl?: string, consultarVinculosPath?: string, options?: { timeout?: number; log?: boolean }) {
    const getEnv = (key: string, defaultValue = ''): string => {
      if (typeof window === 'undefined') {
        return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
      return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
    }
    const getEnvNum = (key: string, defaultVal: number): number => {
      const v = getEnv(key, '')
      if (v === '') return defaultVal
      const n = parseInt(v, 10)
      return Number.isNaN(n) ? defaultVal : n
    }

    this.baseUrl = (baseUrl || getEnv('FACTA_API_BASE_URL', '')).replace(/\/$/, '')
    this.username = getEnv('FACTA_API_USERNAME', '')
    this.****** = getEnv('FACTA_API_PASSWORD', '')
    this.timeout = options?.timeout ?? getEnvNum('FACTA_API_TIMEOUT_MS', 30000)
    this.logEnabled = options?.log ?? getEnv('FACTA_API_LOG', '') === '1'
    this.consultarVinculosPath =
      consultarVinculosPath ||
      getEnv('FACTA_CONSULTAR_VINCULOS_PATH', '/consignado-trabalhador/autoriza-consulta')
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.logEnabled) {
      console.log('[FactaClient]', message, ...args)
    }
  }

  updateCredentials(username?: string, ******?: string, baseUrl?: string) {
    if (username) this.username = username
    if (******) this.****** = ******
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/$/, '')
    this.accessToken = null
    this.tokenExpiration = null
  }

  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) return false
    return this.tokenExpiration.getTime() > Date.now() + 5 * 60 * 1000
  }

  /**
   * Obtém token via GET gera-token com Basic Auth.
   */
  private async getToken(): Promise<ApiResponse<string>> {
    if (!this.username || !this.******) {
      return {
        success: false,
        error: 'Credenciais Facta não configuradas (usuário e ******).',
      }
    }

    try {
      const url = `${this.baseUrl}/gera-token`
      const basic = Buffer.from(`${this.username}:${this.******}`).toString('base64')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...FACTA_DEFAULT_HEADERS,
          Authorization: `Basic ${basic}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const text = await response.text()
      if (text && (text.includes('Cloudflare') || text.includes('cf-wrapper'))) {
        return {
          success: false,
          error:
            'Acesso bloqueado pelo Cloudflare (facta.com.br). Peça à Facta para liberar seu IP ou use rede/VPN aprovada.',
        }
      }

      if (!response.ok) {
        let errMsg: string
        try {
          const json = JSON.parse(text)
          errMsg = json.message || json.error || text
        } catch {
          errMsg = text || `HTTP ${response.status}`
        }
        return { success: false, error: errMsg }
      }

      let data: FactaTokenResponse | null = null
      let token: string | undefined

      try {
        data = JSON.parse(text) as FactaTokenResponse
        if (data.erro === true) {
          return {
            success: false,
            error: data.mensagem || 'Erro ao gerar token na API Facta.',
          }
        }
        token = data.token || data.accessToken || data.access_token
      } catch {
        const trimmed = text.trim()
        if (trimmed && !trimmed.startsWith('<')) {
          token = trimmed
        } else {
          return { success: false, error: text || `Resposta inválida (${response.status}).` }
        }
      }

      if (!token) {
        return { success: false, error: data?.mensagem || 'Token não retornado pela API Facta.' }
      }
      this.accessToken = token
      this.log('Token obtido com sucesso')

      if (data?.expira && typeof data.expira === 'string') {
        const expiraStr = data.expira.trim()
        const [datePart, timePart] = expiraStr.split(/\s+/)
        if (datePart && timePart) {
          const [d, m, y] = datePart.split('/')
          const [h, min, s] = timePart.split(':')
          if (d && m && y && h !== undefined) {
            const expiraDate = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min || 0), Number(s || 0))
            if (!isNaN(expiraDate.getTime())) {
              this.tokenExpiration = expiraDate
            }
          }
        }
      }
      if (!this.tokenExpiration) {
        this.tokenExpiration =
          data && data.expiresIn
            ? new Date(Date.now() + data.expiresIn * 1000)
            : new Date(Date.now() + 60 * 60 * 1000)
      }

      return { success: true, data: token }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { success: false, error: `Timeout ao obter token Facta (${this.timeout}ms).` }
      }
      return {
        success: false,
        error: e?.message || 'Erro ao obter token da API Facta.',
      }
    }
  }

  private async ensureAuthenticated(): Promise<{ success: boolean; error?: string }> {
    if (this.isTokenValid()) return { success: true }
    const result = await this.getToken()
    if (!result.success) {
      return { success: false, error: result.error || 'Falha ao autenticar na Facta.' }
    }
    return { success: true }
  }

  /**
   * Gera/renova o token de autenticação (público para uso externo ou retry manual).
   * GET /gera-token com Basic Auth.
   */
  async gerarToken(): Promise<ApiResponse<string>> {
    return this.getToken()
  }

  /**
   * Consulta dados do trabalhador por CPF (alias para consultarVinculosCLT).
   */
  async consultarDadosTrabalhador(cpf: string): Promise<ApiResponse<FactaConsultaResponse>> {
    return this.consultarVinculosCLT(cpf) as Promise<ApiResponse<FactaConsultaResponse>>
  }

  /**
   * Consulta com fallback entre bancos. Por enquanto só FACTA é suportado.
   * Tenta cada banco da lista em ordem; retorna o primeiro resultado com sucesso ou o último erro.
   * Preparado para multi-bank no futuro (ex.: bancos = ['FACTA', 'V8', 'C6']).
   */
  async consultarComFallback(
    cpf: string,
    bancos: string[] = ['FACTA']
  ): Promise<FactaConsultarFallbackResult> {
    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')
    if (cpfLimpo.length !== 11) {
      return { banco: 'FACTA', success: false, error: 'CPF deve ter 11 dígitos.' }
    }
    let lastError: string | undefined
    for (const banco of bancos) {
      if (banco.toUpperCase() === 'FACTA') {
        this.log('consultarComFallback: tentando FACTA para CPF', cpfLimpo)
        const result = await this.consultarVinculosCLT(cpf)
        if (result.success) {
          return { banco: 'FACTA', success: true, data: result.data }
        }
        lastError = result.error
        this.log('consultarComFallback: FACTA falhou', result.error)
      }
      // Futuro: else if (banco === 'V8') { ... }
    }
    return {
      banco: bancos[bancos.length - 1] ?? 'FACTA',
      success: false,
      error: lastError || 'Nenhum banco retornou sucesso.',
    }
  }

  /**
   * Consulta vínculos CLT por CPF.
   * Endpoint configurável via FACTA_CONSULTAR_VINCULOS_PATH (padrão: /consultar-vinculos-clt).
   */
  async consultarVinculosCLT(cpf: string): Promise<ApiResponse<any>> {
    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')
    if (cpfLimpo.length !== 11) {
      return { success: false, error: 'CPF deve ter 11 dígitos.' }
    }

    const auth = await this.ensureAuthenticated()
    if (!auth.success) {
      return { success: false, error: auth.error }
    }

    const path = this.consultarVinculosPath.startsWith('/')
      ? this.consultarVinculosPath
      : `/${this.consultarVinculosPath}`
    const url = `${this.baseUrl}${path}?cpf=${encodeURIComponent(cpfLimpo)}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...FACTA_DEFAULT_HEADERS,
          Authorization: `Bearer ${this.accessToken}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const raw = await response.text()
      if (raw && (raw.includes('Cloudflare') || raw.includes('cf-wrapper'))) {
        return {
          success: false,
          error:
            'Acesso bloqueado pelo Cloudflare (facta.com.br). Peça à Facta para liberar seu IP ou use rede/VPN aprovada.',
        }
      }
      let data: any
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        return {
          success: false,
          error: raw || `Resposta inválida da API Facta (${response.status}).`,
        }
      }

      if (!response.ok) {
        const msg = data.message || data.error || data.mensagem || raw || `HTTP ${response.status}`
        return { success: false, error: msg, data }
      }

      if (data.erro === true) {
        return {
          success: false,
          error: data.mensagem || 'Erro na consulta de dados do trabalhador (Facta).',
          data,
        }
      }

      const dadosTrabalhador = data.dados_trabalhador
      const dados = dadosTrabalhador?.dados ?? (Array.isArray(dadosTrabalhador) ? dadosTrabalhador : [])

      const parseNumero = (v: any): number | undefined => {
        if (v === null || v === undefined || v === '') return undefined
        if (typeof v === 'number') return Number.isNaN(v) ? undefined : v
        const s = String(v).trim().replace(/\./g, '').replace(/,/g, '.')
        const n = Number(s)
        return Number.isNaN(n) ? undefined : n
      }

      const vinculos = Array.isArray(dados)
        ? dados.map((item: any) => {
            const valorMargemDisponivel = parseNumero((item as any).valorMargemDisponivel)
            const valorBaseMargem = parseNumero((item as any).valorBaseMargem)
            const valorTotalVencimentos = parseNumero((item as any).valorTotalVencimentos)
            const valorDisponivel = valorMargemDisponivel ?? valorBaseMargem ?? valorTotalVencimentos

            return {
              ...item,
              valorMargemDisponivel,
              valorDisponivel,
              nomeEmpregador: item.nomeEmpregador ?? item.inscricaoEmpregador_descricao,
              cpfTrabalhador: item.cpf,
              nomeTrabalhador: item.nome,
              elegivel: item.elegivel === 'S' || item.elegivel === true,
            }
          })
        : []

      const vinculosElegiveis = vinculos.filter((v) => v.elegivel && (v.valorDisponivel ?? 0) > 0)
      const temSimulacaoDisponivel = vinculosElegiveis.length > 0
      const valorMaximoSimulacao = vinculosElegiveis.length
        ? Math.max(...vinculosElegiveis.map((v) => v.valorDisponivel ?? 0))
        : 0

      const payload = {
        total: dadosTrabalhador?.total ?? vinculos.length,
        dados_trabalhador: dadosTrabalhador,
        vinculos,
        temSimulacaoDisponivel,
        valorMaximoSimulacao,
      }
      return { success: true, data: payload }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { success: false, error: `Timeout na consulta Facta (${this.timeout}ms).` }
      }
      return {
        success: false,
        error: e?.message || 'Erro ao consultar vínculos na API Facta.',
      }
    }
  }

  /**
   * Solicita autorização de consulta ao trabalhador (Facta envia link por SMS ou WhatsApp).
   * POST /solicita-autorizacao-consulta (Bearer REDACTED, form-urlencoded).
   */
  async solicitarAutorizacaoConsulta(params: FactaSolicitarAutorizacaoParams): Promise<ApiResponse<any>> {
    const cpfLimpo = (params.cpf || '').replace(/\D/g, '').padStart(11, '0')
    if (cpfLimpo.length !== 11) {
      return { success: false, error: 'CPF deve ter 11 dígitos.' }
    }
    const celularLimpo = (params.celular || '').replace(/\D/g, '')
    if (!celularLimpo.length) {
      return { success: false, error: 'Celular é obrigatório.' }
    }

    // Define o averbador padrão conforme configuração/FACTA Crédito do Trabalhador
    let averbador =
      (params.averbador && String(params.averbador).trim()) ||
      (typeof window === 'undefined'
        ? (process.env.REDACTED || process.env.REDACTED || '10010')
        : (process.env.REDACTED || '10010'))

    averbador = String(averbador).trim()
    if (!averbador) {
      return {
        success: false,
        error:
          'Código do averbador FACTA não configurado. Defina FACTA_AVERBADOR_ID (padrão recomendado: 10010, conforme manual Crédito do Trabalhador).',
      }
    }

    const auth = await this.ensureAuthenticated()
    if (!auth.success) {
      return { success: false, error: auth.error }
    }

    const url = `${this.baseUrl}/solicita-autorizacao-consulta`
    const body = new URLSearchParams()
    body.set('averbador', averbador)
    body.set('nome', String(params.nome).trim())
    body.set('cpf', cpfLimpo)
    body.set('celular', celularLimpo)
    body.set('tipo_envio', params.tipo_envio)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...FACTA_DEFAULT_HEADERS,
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: body.toString(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const raw = await response.text()
      if (raw && (raw.includes('Cloudflare') || raw.includes('cf-wrapper'))) {
        return {
          success: false,
          error:
            'Acesso bloqueado pelo Cloudflare (facta.com.br). Peça à Facta para liberar seu IP ou use rede/VPN aprovada.',
        }
      }
      let data: any
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        return {
          success: false,
          error: raw || `Resposta inválida da API Facta (${response.status}).`,
        }
      }

      if (!response.ok) {
        const msg = data.mensagem || data.message || data.error || raw || `HTTP ${response.status}`
        return { success: false, error: msg, data }
      }

      if (data.erro === true) {
        return { success: false, error: data.mensagem || 'Erro ao solicitar autorização.', data }
      }

      return { success: true, data }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return { success: false, error: `Timeout ao solicitar autorização Facta (${this.timeout}ms).` }
      }
      return {
        success: false,
        error: e?.message || 'Erro ao solicitar autorização na API Facta.',
      }
    }
  }

  /**
   * Testa a conexão com a API Facta tentando obter um token.
   * Usado pela tela de configuração de APIs (freshClient.testConnection()).
   */
  async testConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    const result = await this.getToken()

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Falha ao testar conexão com a API Facta',
        data: {
          connected: false,
          message: result.error || 'Falha ao autenticar na Facta',
        },
      }
    }

    return {
      success: true,
      data: {
        connected: true,
        message: 'Conexão com a API Facta bem-sucedida (token obtido).',
      },
    }
  }
}
