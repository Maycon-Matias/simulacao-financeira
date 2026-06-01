/**
 * registro para comunicação com API externa de consultas e simulações
 */

interface ApiConfig {
  baseUrl: string
  apiKey?: string
  apiToken?: string
  timeout?: number
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: any
  message?: string
  rateLimit?: boolean
}

class ApiClient {
  private config: ApiConfig

  constructor() {
    this.config = {
      baseUrl: process.env.REDACTED || '',
      apiKey: process.env.REDACTED,
      apiToken: process.env.REDACTED,
      timeout: 30000,
    }
  }

  updateConfig(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config }
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey
    }

    if (this.config.apiToken) {
      headers['Authorization'] = `Bearer ${this.config.apiToken}`
    }

    return headers
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    try {
      let url = `${this.config.baseUrl}${endpoint}`
      
      if (params) {
        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
        url += `?${searchParams.toString()}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        return {
          success: false,
          error: errorData.message || `Erro ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('Erro na requisição GET:', error)
      return {
        success: false,
        error: error.message || 'Erro ao fazer requisição à API',
      }
    }
  }

  async post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    try {
      const url = `${this.config.baseUrl}${endpoint}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        return {
          success: false,
          error: errorData.message || `Erro ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('Erro na requisição POST:', error)
      return {
        success: false,
        error: error.message || 'Erro ao fazer requisição à API',
      }
    }
  }

  async testConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    // Tenta endpoints comuns de teste
    const testEndpoints = ['/health', '/ping', '/status', '/']
    
    for (const testEndpoint of testEndpoints) {
      const response = await this.get(testEndpoint)
      if (response.success) {
        return {
          success: true,
          data: {
            connected: true,
            message: 'Conexão com a API estabelecida com sucesso',
          },
        }
      }
    }
    
    // Se nenhum endpoint funcionou, retorna erro
    const response = await this.get('/')
    
    if (response.success) {
      return {
        success: true,
        data: {
          connected: true,
          message: 'Conexão com a API estabelecida com sucesso',
        },
      }
    }

    return {
      success: false,
      data: {
        connected: false,
        message: response.error || 'Não foi possível conectar à API',
      },
    }
  }
}

export const apiClient = new ApiClient()
export type { ApiConfig, ApiResponse }

