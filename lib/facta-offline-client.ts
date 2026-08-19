import type { ApiResponse } from "./api-client"

/**
 * registro para a API FACTA Offline (Consulta Dados CLT - BASE OFFLINE).
 * Usa hosts cltoff-homol.facta.com.br / cltoff.facta.com.br, com token próprio.
 *
 * Endpoints principais:
 * - GET /gera-token
 * - GET /clt/base-offline?cpf=00000000000
 */

interface FactaOfflineTokenResponse {
  erro?: boolean
  mensagem?: string
  token?: string
  expira?: string
}

interface FactaOfflineDadosTrabalhador {
  [key: string]: unknown
}

export class FactaOfflineClient {
  private baseUrl: string
  private username: string
  private password: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private readonly timeout: number
  private readonly logEnabled: boolean

  constructor(baseUrl?: string, options?: { timeout?: number; log?: boolean }) {
    const getEnv = (key: string, defaultValue = ""): string => {
      if (typeof window === "undefined") {
        return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
      return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
    }
    const getEnvNum = (key: string, defaultVal: number): number => {
      const v = getEnv(key, "")
      if (v === "") return defaultVal
      const n = parseInt(v, 10)
      return Number.isNaN(n) ? defaultVal : n
    }

    this.baseUrl = (baseUrl || getEnv("FACTA_OFFLINE_API_BASE_URL", "")).replace(/\/$/, "")
    this.username = getEnv("FACTA_OFFLINE_API_USERNAME", "") || getEnv("FACTA_API_USERNAME", "")
    this.password = getEnv("FACTA_OFFLINE_API_PASSWORD", "") || getEnv("FACTA_API_PASSWORD", "")
    this.timeout = options?.timeout ?? getEnvNum("FACTA_OFFLINE_API_TIMEOUT_MS", 30000)
    this.logEnabled = options?.log ?? getEnv("FACTA_OFFLINE_API_LOG", "") === "1"
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.logEnabled) {
      console.log("[FactaOfflineClient]", message, ...args)
    }
  }

  /**
   * Converte resposta de erro (incluindo HTML 403) em mensagem amigável.
   */
  private normalizeErrorResponse(status: number, body: string, contexto: "token" | "consulta"): string {
    const isHtml = /<\s*!?DOCTYPE|<\s*html\s|<\s*body\s/i.test(body)
    const is403 = status === 403 || (body.includes("403") && /forbidden|proibido|permission/i.test(body))
    if (is403 || (isHtml && body.includes("Forbidden"))) {
      return "Acesso negado (403) pela API Facta Offline. Verifique no .env: FACTA_OFFLINE_API_BASE_URL e as credenciais (FACTA_OFFLINE_API_USERNAME/password ou, se for o mesmo usuário, FACTA_API_USERNAME/password). Confirme também se o usuário tem permissão para a base offline."
    }
    if (isHtml && body.trim()) {
      return `Resposta inválida da API (HTTP ${status}). O servidor retornou HTML em vez de JSON — verifique a URL e as credenciais.`
    }
    try {
      const json = JSON.parse(body) as { mensagem?: string; message?: string; error?: string }
      return json.mensagem || json.message || json.error || body || `HTTP ${status}`
    } catch {
      return body && body.trim() && !body.trimStart().startsWith("<") ? body : `HTTP ${status}`
    }
  }

  updateCredentials(username?: string, password?: string, baseUrl?: string) {
    if (username) this.username = username
    if (password) this.password = password
    if (baseUrl) this.baseUrl = baseUrl.replace(/\/$/, "")
    this.accessToken = null
    this.tokenExpiration = null
  }

  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) return false
    return this.tokenExpiration.getTime() > Date.now() + 5 * 60 * 1000
  }

  /**
   * Obtém token via GET /gera-token com Basic Auth na base OFFLINE.
   */
  private async getToken(): Promise<ApiResponse<string>> {
    if (!this.username || !this.password) {
      return {
        success: false,
        error: "Credenciais Facta Offline não configuradas. Configure FACTA_OFFLINE_API_USERNAME e FACTA_OFFLINE_API_PASSWORD no .env — ou use o mesmo usuário da Facta com FACTA_API_USERNAME e FACTA_API_PASSWORD.",
      }
    }
    if (!this.baseUrl) {
      return {
        success: false,
        error: "FACTA_OFFLINE_API_BASE_URL não configurada.",
      }
    }

    try {
      const url = `${this.baseUrl}/gera-token`
      const basic = Buffer.from(`${this.username}:${this.password}`).toString("base64")

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${basic}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const text = await response.text()

      if (!response.ok) {
        const errMsg = this.normalizeErrorResponse(response.status, text, "token")
        return { success: false, error: errMsg }
      }

      let data: FactaOfflineTokenResponse | null = null
      let token: string | undefined

      try {
        data = JSON.parse(text) as FactaOfflineTokenResponse
        if (data.erro === true) {
          return {
            success: false,
            error: data.mensagem || "Erro ao gerar token na API Facta Offline.",
          }
        }
        token = data.token
      } catch {
        const trimmed = text.trim()
        if (trimmed && !trimmed.startsWith("<")) {
          token = trimmed
        } else {
          return { success: false, error: text || `Resposta inválida (${response.status}).` }
        }
      }

      if (!token) {
        return { success: false, error: data?.mensagem || "Token não retornado pela API Facta Offline." }
      }
      this.accessToken = token
      this.log("Token OFFLINE obtido com sucesso")

      if (data?.expira && typeof data.expira === "string") {
        const expiraStr = data.expira.trim()
        const [datePart, timePart] = expiraStr.split(/\s+/)
        if (datePart && timePart) {
          const [d, m, y] = datePart.split("/")
          const [h, min, s] = timePart.split(":")
          if (d && m && y && h !== undefined) {
            const expiraDate = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min || 0), Number(s || 0))
            if (!isNaN(expiraDate.getTime())) {
              this.tokenExpiration = expiraDate
            }
          }
        }
      }
      if (!this.tokenExpiration) {
        this.tokenExpiration = new Date(Date.now() + 60 * 60 * 1000)
      }

      return { success: true, data: token }
    } catch (e: any) {
      if (e.name === "AbortError") {
        return { success: false, error: `Timeout ao obter token Facta Offline (${this.timeout}ms).` }
      }
      return {
        success: false,
        error: e?.message || "Erro ao obter token da API Facta Offline.",
      }
    }
  }

  private async ensureAuthenticated(): Promise<{ success: boolean; error?: string }> {
    if (this.isTokenValid()) return { success: true }
    const result = await this.getToken()
    if (!result.success) {
      return { success: false, error: result.error || "Falha ao autenticar na Facta Offline." }
    }
    return { success: true }
  }

  /**
   * Consulta base offline /clt/base-offline?cpf=
   * Retorna dados normalizados em formato similar ao FactaClient.consultarVinculosCLT
   */
  async consultarBaseOffline(cpf: string): Promise<ApiResponse<{ vinculos: FactaOfflineDadosTrabalhador[]; total: number; dados: FactaOfflineDadosTrabalhador[] }>> {
    const cpfLimpo = cpf.replace(/\D/g, "").padStart(11, "0")
    if (cpfLimpo.length !== 11) {
      return { success: false, error: "CPF deve ter 11 dígitos." }
    }

    const auth = await this.ensureAuthenticated()
    if (!auth.success) {
      return { success: false, error: auth.error }
    }

    const url = `${this.baseUrl}/clt/base-offline?cpf=${encodeURIComponent(cpfLimpo)}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const raw = await response.text()
      let data: any
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        const errMsg = this.normalizeErrorResponse(response.status, raw, "consulta")
        return { success: false, error: errMsg }
      }

      if (!response.ok) {
        const msg = this.normalizeErrorResponse(
          response.status,
          data.mensagem || data.message || data.error || raw,
          "consulta"
        )
        return { success: false, error: msg, data }
      }

      if (data.erro === true) {
        return {
          success: false,
          error: data.mensagem || "Erro na consulta de base offline (Facta).",
          data,
        }
      }

      const dados: any[] = Array.isArray(data.dados) ? data.dados : []

      const parseNumero = (v: any): number | undefined => {
        if (v === null || v === undefined || v === "") return undefined
        if (typeof v === "number") return Number.isNaN(v) ? undefined : v
        const s = String(v).trim().replace(/\./g, "").replace(/,/g, ".")
        const n = Number(s)
        return Number.isNaN(n) ? undefined : n
      }

      const vinculos = dados.map((item: any) => {
        const valorTotalVencimentos = parseNumero(item.valorTotalVencimentos)
        const valorBaseMargem = parseNumero(item.valorBaseMargem)
        const valorMargemDisponivel = parseNumero(item.valorMargemDisponivel)
        const valorDisponivel = valorMargemDisponivel ?? valorBaseMargem ?? valorTotalVencimentos

        return {
          ...item,
          valorTotalVencimentos,
          valorBaseMargem,
          valorMargemDisponivel,
          valorDisponivel,
          nomeEmpregador: item.nomeEmpregador ?? item.inscricaoEmpregador_descricao,
          cpfTrabalhador: item.cpf,
          nomeTrabalhador: item.nome,
          elegivel: item.elegivel === "S" || item.elegivel === true,
        }
      })

      return {
        success: true,
        data: {
          vinculos,
          total: vinculos.length,
          dados,
        },
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        return { success: false, error: `Timeout na consulta Facta Offline (${this.timeout}ms).` }
      }
      return {
        success: false,
        error: e?.message || "Erro ao consultar base offline na API Facta.",
      }
    }
  }
}

