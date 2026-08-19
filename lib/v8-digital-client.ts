import type { ApiResponse } from './api-client'
import { createLogger } from './logger'

const log = createLogger('V8')

/**
 * registro para a API V8 Digital
 * Documentação: http://docs.v8sistema.com/
 */
export class V8DigitalClient {
  private baseUrl: string
  private authUrl: string
  private username: string
  private password: string
  private clientId: string
  private clientSecret?: string
  private audience: string // OBRIGATÓRIO para V8 Digital
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private readonly timeout = 30000 // 30 segundos
  private loginInProgress: boolean = false // Flag para evitar múltiplas tentativas de login simultâneas
  private loginPromise: Promise<ApiResponse<string>> | null = null // Promise compartilhada para login em progresso
  private lastLoginAttempt: Date | null = null // Última tentativa de login
  private minLoginInterval: number = 60000 // Intervalo mínimo entre tentativas de login (60 segundos, pode aumentar se bloqueado)
  private consecutiveLoginFailures: number = 0 // Contador de falhas consecutivas de login
  
  // Rate limiting: ~180 requisições por hora (config conservadora para evitar 429)
  private requestCount: number = 0 // Contador de requisições na última hora
  private requestWindowStart: Date = new Date() // Início da janela de 1 hora
  private readonly MAX_REQUESTS_PER_HOUR = 180 // Limite interno (abaixo do teto oficial da V8)
  private lastRequestTime: Date | null = null // Timestamp da última requisição bem-sucedida
  private readonly V8_RATE_LIMIT_BACKOFF_MS = [5000, 10000, 20000] // 5s, 10s, 20s para 429
  private readonly V8_MAX_RATE_LIMIT_RETRIES = 3
  
  // Cache para resultados de busca de termos (evita requisições redundantes)
  private termoCache: Map<string, { data: ApiResponse; timestamp: Date }> = new Map()
  private readonly TERMO_CACHE_TTL_MS = 30000 // 30 segundos para erros (404)
  private readonly TERMO_CACHE_SUCCESS_TTL_MS = 300000 // 5 minutos para sucessos
  private readonly TERMO_CACHE_MAX_SIZE = 100 // Limite máximo de itens no cache

  constructor(baseUrl?: string, authUrl?: string) {
    // Tenta obter variáveis de ambiente com e sem prefixo NEXT_PUBLIC_
    const getEnv = (key: string, defaultValue: string = ''): string => {
      if (typeof window === 'undefined') {
        return process.env[key] || defaultValue
      } else {
        return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
    }
    
    this.baseUrl = baseUrl || getEnv('V8_API_BASE_URL', 'https://bff.v8sistema.com')
    this.authUrl = authUrl || getEnv('V8_API_AUTH_URL', 'https://auth.v8sistema.com/oauth/token')
    this.username = getEnv('V8_API_USERNAME', '')
    this.password = getEnv('V8_API_PASSWORD', '')
    this.clientId = getEnv('V8_API_CLIENT_ID', '')
    this.clientSecret = getEnv('V8_API_CLIENT_SECRET', '')
    this.audience = getEnv('V8_API_AUDIENCE', 'https://bff.v8sistema.com') || 'https://bff.v8sistema.com' // OBRIGATÓRIO
    
    // Remove trailing slash se houver
    this.baseUrl = this.baseUrl.replace(/\/$/, '')
    this.authUrl = this.authUrl.replace(/\/$/, '')
  }

  /**
   * Atualiza credenciais e URLs
   */
  updateCredentials(
    username?: string, 
    password?: string, 
    baseUrl?: string, 
    authUrl?: string, 
    clientId?: string,
    clientSecret?: string,
    audience?: string
  ) {
    if (username) this.username = username
    if (password) this.password = password
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '')
    }
    if (authUrl) {
      this.authUrl = authUrl.replace(/\/$/, '')
    }
    if (clientId) this.clientId = clientId
    if (clientSecret !== undefined) this.clientSecret = clientSecret
    if (audience !== undefined && audience !== '') this.audience = audience // OBRIGATÓRIO
    // Limpa token ao atualizar credenciais
    this.accessToken = null
    this.tokenExpiration = null
    // Reseta flags de controle para evitar bloqueios
    this.consecutiveLoginFailures = 0
    this.loginInProgress = false
    this.lastLoginAttempt = null
    this.minLoginInterval = 60000 // Restaura intervalo padrão
    // Reseta rate limiting ao atualizar credenciais
    this.requestCount = 0
    this.requestWindowStart = new Date()
    // Reseta rate limiting ao atualizar credenciais
    this.requestCount = 0
    this.requestWindowStart = new Date()
  }

  /**
   * Verifica se o token ainda é válido (com margem de 30 minutos para evitar renovações desnecessárias)
   * Margem maior para reduzir tentativas de autenticação e evitar bloqueios
   */
  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) {
      return false
    }
    const now = new Date()
    const margin = 30 * 60 * 1000 // 30 minutos em milissegundos (margem maior para evitar renovações frequentes)
    return this.tokenExpiration.getTime() - now.getTime() > margin
  }

  /**
   * Faz login na API usando OAuth
   * 
   * IMPORTANTE: O endpoint de autenticação (authUrl) APENAS aceita
   * requisições HTTP POST. Não tente usar GET.
   */
  private async login(): Promise<ApiResponse<string>> {
    // CRÍTICO: Se já existe um login em progresso, todas as requisições simultâneas aguardam a mesma Promise
    // Isso evita múltiplas tentativas de login simultâneas que causam "Too many logins"
    if (this.loginPromise) {
      log.debug('Login já em progresso, aguardando...')
      try {
        const result = await this.loginPromise
        // Se o login foi bem-sucedido e o token ainda é válido, retorna
        if (result.success && this.isTokenValid() && this.accessToken) {
          return { success: true, data: this.accessToken }
        }
        // Se falhou, permite tentar novamente (mas respeitando intervalo mínimo)
        return result
      } catch (error) {
        // Se a Promise falhou, permite tentar novamente
        log.error('Erro ao aguardar login anterior', error)
      }
    }
    
    // Verifica se token ainda é válido ANTES de tentar fazer login
    // Isso evita login desnecessário se o token foi obtido enquanto aguardávamos
    if (this.isTokenValid() && this.accessToken) {
      log.debug('Token válido, reutilizando')
      return { success: true, data: this.accessToken }
    }
    
    // Verifica intervalo mínimo entre tentativas de login
    // Se houve falhas consecutivas, aumenta o intervalo progressivamente
    // IMPORTANTE: Se minLoginInterval está muito alto (bloqueio ativo), sempre respeita mesmo sem lastLoginAttempt
    if (this.minLoginInterval >= 900000 && !this.lastLoginAttempt) {
      // Bloqueio crítico detectado mas sem timestamp - define agora para evitar tentativas imediatas
      this.lastLoginAttempt = new Date()
    }
    
    if (this.lastLoginAttempt) {
      const timeSinceLastAttempt = Date.now() - this.lastLoginAttempt.getTime()
      // Limita o multiplicador para evitar intervalos absurdos (máximo 2x o intervalo base)
      const multiplier = Math.min(1 + this.consecutiveLoginFailures, 2)
      const intervalToUse = this.consecutiveLoginFailures > 0 
        ? this.minLoginInterval * multiplier
        : this.minLoginInterval
      
      if (timeSinceLastAttempt < intervalToUse) {
        const waitTime = Math.ceil((intervalToUse - timeSinceLastAttempt) / 1000)
        log.warn(`Muitas tentativas de login. Aguarde ${waitTime}s`, { waitTime })
        return {
          success: false,
          error: `Aguarde ${waitTime} segundos antes de tentar fazer login novamente`
        }
      }
    }
    
    // Cria Promise compartilhada para login - todas as requisições simultâneas aguardarão esta mesma Promise
    this.loginInProgress = true
    this.loginPromise = (async (): Promise<ApiResponse<string>> => {
      try {
        this.lastLoginAttempt = new Date()
      
        if (!this.username || !this.password || !this.clientId) {
          return {
            success: false,
            error: 'Credenciais não configuradas. Configure username, password e client_id da API V8 Digital'
          }
        }

      // OAuth 2.0 password Grant
      // IMPORTANTE: audience é OBRIGATÓRIO para a API V8 Digital
      if (!this.audience || this.audience.trim() === '') {
        return {
          success: false,
          error: 'O parâmetro audience é obrigatório para autenticação na API V8 Digital. Configure V8_API_AUDIENCE nas variáveis de ambiente ou na configuração da API.'
        }
      }

      const formData = new URLSearchParams()
      formData.append('grant_type', 'password')
      formData.append('username', this.username)
      formData.append('password', this.password)
      formData.append('client_id', this.clientId)
      formData.append('audience', this.audience) // OBRIGATÓRIO
      formData.append('scope', 'offline_access') // Scope padrão
      
      // Parâmetros opcionais
      if (this.clientSecret) {
        formData.append('client_secret', this.clientSecret)
      }

      log.info('Login OAuth', { authUrl: this.authUrl })

      // Se estiver no registro (browser), usa endpoint de API do Next.js para evitar CORS
      // Se estiver no servidor, faz requisição direta
      const isClient = typeof window !== 'undefined'
      let response: Response

      if (isClient) {
        // No registro, usa endpoint de API do Next.js
        log.debug('Login via API route (registro)')
        const apiResponse = await fetch('/api/produto/v8/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: this.username,
            password: this.password,
            clientId: this.clientId,
            authUrl: this.authUrl,
            scope: 'offline_access', // Scope padrão conforme documentação V8 Digital
            clientSecret: this.clientSecret, // Se disponível
            audience: this.audience, // OBRIGATÓRIO
          }),
        })

        if (!apiResponse.ok) {
          this.consecutiveLoginFailures += 1 // Incrementa contador de falhas
          const errorData = await apiResponse.json().catch(() => ({ error: 'Erro ao autenticar' }))
          const errorMsg = errorData.error || `Erro ${apiResponse.status}: ${apiResponse.statusText}`
          
          // Detecta especificamente o erro "Too many logins"
          const errorMsgLower = errorMsg.toLowerCase()
          if (errorMsgLower.includes('too many logins') || errorMsgLower.includes('many logins')) {
            log.error('Too many logins (API route). Bloqueio 15 min.')
            this.minLoginInterval = 900000 // 15 minutos após bloqueio por muitos logins
            this.consecutiveLoginFailures = 10 // Força intervalo muito maior
            this.accessToken = null // Limpa token para evitar tentativas imediatas
            this.tokenExpiration = null
            this.lastLoginAttempt = new Date() // CRÍTICO: Define timestamp para próxima verificação respeitar intervalo
            
            return {
              success: false,
              error: 'Muitas tentativas de login detectadas. Aguarde 15 minutos antes de tentar novamente.',
            }
          }
          
          // Se for erro de bloqueio, aumenta o intervalo mínimo
          if (errorMsgLower.includes('suspicious') || errorMsgLower.includes('blocked')) {
            log.warn('Bloqueio detectado (API route). Intervalo 5 min.')
            this.minLoginInterval = 300000 // 5 minutos após bloqueio
            this.consecutiveLoginFailures = 5 // Força intervalo maior
          }
          
          // Se houve muitas falhas consecutivas, aumenta o intervalo
          if (this.consecutiveLoginFailures >= 3 && this.minLoginInterval < 180000) {
            log.warn('Muitas falhas consecutivas. Intervalo 3 min.')
            this.minLoginInterval = 180000 // 3 minutos após 3 falhas
          }
          
          return {
            success: false,
            error: errorMsg,
          }
        }

        const tokenData = await apiResponse.json()
        if (!tokenData.success || !tokenData.data?.access_token) {
          this.consecutiveLoginFailures += 1 // Incrementa contador de falhas
          return {
            success: false,
            error: tokenData.error || 'Token de acesso não encontrado na resposta',
          }
        }

        // Calcula expiração
        const expiresIn = tokenData.data.expires_in || 3600
        this.tokenExpiration = new Date(Date.now() + (expiresIn * 1000))
        this.accessToken = tokenData.data.access_token
        this.consecutiveLoginFailures = 0 // Reseta contador de falhas após sucesso
        log.info('Login OK (API route)', { expira: this.tokenExpiration?.toISOString() })

        return {
          success: true,
          data: this.accessToken || '',
        }
      }

      // No servidor, faz requisição direta
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      log.debug('Request OAuth', { grant_type: 'password', audience: this.audience })

      response = await fetch(this.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: formData.toString(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      log.debug('Login response', { status: response.status })

      if (!response.ok) {
        let errorData: any
        try {
          const responseText = await response.text()
          try {
            errorData = JSON.parse(responseText)
          } catch {
            errorData = { message: responseText || response.statusText }
          }
        } catch (error) {
          errorData = { message: response.statusText }
        }
        log.error('Login falhou', { status: response.status, error: errorData })
        
        const errorMsg = errorData.error_description || errorData.error || errorData.message || `Erro ${response.status}: ${response.statusText}`
        const errorMsgLower = errorMsg.toLowerCase()
        
        // Detecta especificamente o erro "Too many logins"
        if (errorMsgLower.includes('too many logins') || errorMsgLower.includes('many logins')) {
          log.error('Too many logins. Bloqueio 15 min.')
          this.minLoginInterval = 900000 // 15 minutos após bloqueio por muitos logins
          this.consecutiveLoginFailures = 10 // Força intervalo muito maior
          this.accessToken = null // Limpa token para evitar tentativas imediatas
          this.tokenExpiration = null
          this.lastLoginAttempt = new Date() // CRÍTICO: Define timestamp para próxima verificação respeitar intervalo
          
          return {
            success: false,
            error: 'Muitas tentativas de login detectadas. Aguarde 15 minutos antes de tentar novamente.',
          }
        }
        
        return {
          success: false,
          error: errorMsg,
        }
      }

      const data = await response.json()
      log.debug('Login response body', { hasToken: !!(data.access_token || data.token) })

      // OAuth retorna access_token
      const token = data.access_token || data.token || data.accessToken
      if (!token) {
        log.error('Token não encontrado na resposta', data)
        return {
          success: false,
          error: 'Token de acesso não encontrado na resposta da API',
        }
      }

      // Calcula expiração (padrão OAuth: expires_in em segundos)
      const expiresIn = data.expires_in || 3600 // Default: 1 hora
      this.tokenExpiration = new Date(Date.now() + (expiresIn * 1000))

      this.accessToken = token
      this.consecutiveLoginFailures = 0 // Reseta contador de falhas após sucesso
      log.info('Login OK', { expira: this.tokenExpiration?.toISOString() })

      return {
        success: true,
        data: token,
      }
    } catch (error: any) {
      this.consecutiveLoginFailures += 1 // Incrementa contador de falhas
      log.error('Erro ao fazer login', { error, falhas: this.consecutiveLoginFailures })
      
      // Detecta especificamente o erro "Too many logins"
      const errorMsg = error.message || error.toString() || ''
      const errorMsgLower = errorMsg.toLowerCase()
      
      if (errorMsgLower.includes('too many logins') || errorMsgLower.includes('many logins')) {
        log.error('Too many logins (catch). Bloqueio 15 min.')
        this.minLoginInterval = 900000 // 15 minutos após bloqueio por muitos logins
        this.consecutiveLoginFailures = 10 // Força intervalo muito maior
        this.accessToken = null // Limpa token para evitar tentativas imediatas
        this.tokenExpiration = null
        this.lastLoginAttempt = new Date() // CRÍTICO: Define timestamp para próxima verificação respeitar intervalo
        
        return {
          success: false,
          error: 'Muitas tentativas de login detectadas. Aguarde 15 minutos antes de tentar novamente.',
        }
      }
      
      // Se for erro de bloqueio, aumenta o intervalo mínimo
      if (errorMsgLower.includes('suspicious') || errorMsgLower.includes('blocked')) {
        log.warn('Bloqueio detectado. Intervalo 5 min.')
        this.minLoginInterval = 300000 // 5 minutos após bloqueio
        this.consecutiveLoginFailures = 5 // Força intervalo maior
      }
      
      // Se houve muitas falhas consecutivas, aumenta o intervalo
      if (this.consecutiveLoginFailures >= 3 && this.minLoginInterval < 180000) {
        log.warn('Muitas falhas consecutivas. Intervalo 3 min.')
        this.minLoginInterval = 180000 // 3 minutos após 3 falhas
      }
      
      return {
        success: false,
        error: error.message || 'Erro ao fazer login na API V8 Digital',
      }
    } finally {
      // CRÍTICO: Sempre limpa a Promise compartilhada e flag ao finalizar (sucesso ou erro)
      // Isso permite que novas tentativas sejam feitas após o intervalo mínimo
      this.loginInProgress = false
      this.loginPromise = null
    }
    })()
    
    // Aguarda a Promise compartilhada e retorna o resultado
    return await this.loginPromise
  }

  /**
   * Obtém ou renova o token de autenticação
   * IMPORTANTE: Todas as proteções contra bloqueio estão no método login()
   * - Intervalo mínimo entre tentativas
   * - Controle de login simultâneo via Promise compartilhada
   * - Contador de falhas consecutivas
   * - Detecção de bloqueio
   * 
   * CRÍTICO: Este método garante que apenas um token seja gerado por vez,
   * mesmo com múltiplas requisições simultâneas. Todas aguardam a mesma Promise de login.
   */
  private async getAuthToken(): Promise<string | null> {
    // CRÍTICO: Verifica se token ainda é válido ANTES de tentar fazer login
    // Isso evita login desnecessário se o token foi obtido por outra requisição simultânea
    if (this.isTokenValid() && this.accessToken) {
      log.debug('Token válido, reutilizando')
      return this.accessToken
    }

    // Chama login() que já tem TODAS as proteções implementadas:
    // - Verifica se já está fazendo login (aguarda Promise compartilhada)
    // - Verifica intervalo mínimo entre tentativas (60s padrão, aumenta após falhas)
    // - Contador de falhas consecutivas
    // - Detecção de bloqueio
    // - Promise compartilhada para evitar múltiplos logins simultâneos
    log.debug('Token expirado, solicitando login...')
    const loginResult = await this.login()
    
    // Após o login, verifica novamente se o token é válido
    // (pode ter sido obtido enquanto aguardávamos a Promise compartilhada)
    if (this.isTokenValid() && this.accessToken) {
      log.debug('Token válido após login')
      return this.accessToken
    }
    
    if (!loginResult.success) {
      log.error('Falha ao obter token', { error: loginResult.error })
      if (loginResult.error?.includes('Aguarde')) {
        log.debug('Respeitando intervalo mínimo entre tentativas')
      }
      return null
    }

    log.debug('Token obtido')
    return this.accessToken
  }

  /**
   * Verifica rate limiting (250 requisições/hora)
   * IMPORTANTE: Este método apenas VERIFICA, não incrementa o contador
   * O contador só é incrementado após a requisição ser bem-sucedida
   */
  private checkRateLimit(): { allowed: boolean; waitTime?: number } {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000) // 1 hora atrás
    
    // Se passou mais de 1 hora desde o início da janela, reseta contador
    if (this.requestWindowStart < oneHourAgo) {
      log.debug('Rate limit: janela resetada (1h)')
      this.requestCount = 0
      this.requestWindowStart = new Date()
      this.lastRequestTime = null
    }
    
    // Verifica se atingiu o limite (verifica ANTES de incrementar)
    if (this.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
      const timeUntilReset = this.requestWindowStart.getTime() + (60 * 60 * 1000) - now.getTime()
      const waitTimeSeconds = Math.ceil(timeUntilReset / 1000)
      log.warn(`Limite ${this.MAX_REQUESTS_PER_HOUR}/h atingido. Aguarde ${waitTimeSeconds}s`, { waitTimeSeconds })
      return {
        allowed: false,
        waitTime: waitTimeSeconds
      }
    }
    // Throttling: distribui as requisições ao longo da hora para garantir que durem 1 hora
    // Aplica throttling apenas quando estamos usando mais de 50% das requisições OU quando há menos de 50 restantes
    if (this.requestCount > 0 && this.lastRequestTime) {
      const timeElapsed = now.getTime() - this.requestWindowStart.getTime() // Tempo decorrido desde o início da janela
      const timeRemaining = (60 * 60 * 1000) - timeElapsed // Tempo restante na janela (em ms)
      const requestsRemaining = this.MAX_REQUESTS_PER_HOUR - this.requestCount // Requisições restantes
      
      // Aplica throttling apenas quando necessário (mais de 50% usado OU menos de 50 restantes)
      const usagePercentage = (this.requestCount / this.MAX_REQUESTS_PER_HOUR) * 100
      const shouldThrottle = usagePercentage > 50 || requestsRemaining < 50
      
      if (shouldThrottle && requestsRemaining > 0 && timeRemaining > 0) {
        const minIntervalBetweenRequests = Math.ceil(timeRemaining / requestsRemaining)
        const timeSinceLastRequest = now.getTime() - this.lastRequestTime.getTime()
        
        // Limita o intervalo máximo a 3 segundos quando há muitas requisições restantes
        const maxInterval = requestsRemaining > 100 ? 3000 : minIntervalBetweenRequests
        const effectiveInterval = Math.min(minIntervalBetweenRequests, maxInterval)
        
        // Se a última requisição foi muito recente, calcula quanto tempo aguardar
        if (timeSinceLastRequest < effectiveInterval) {
          const waitTime = effectiveInterval - timeSinceLastRequest
          const waitTimeSeconds = Math.ceil(waitTime / 1000)
          
          // Log apenas se o wait time for significativo (> 1 segundo)
          if (waitTimeSeconds > 1) {
            log.debug(`Throttling: aguardando ${waitTimeSeconds}s`, { usadas: this.requestCount, restantes: requestsRemaining })
          }
          
          return {
            allowed: false,
            waitTime: waitTimeSeconds
          }
        }
      }
    }
    
    // NÃO incrementa aqui - será incrementado apenas após requisição bem-sucedida
    const remaining = this.MAX_REQUESTS_PER_HOUR - this.requestCount
    if (remaining <= 10) {
      log.warn(`Poucas requisições restantes nesta hora`, { remaining, limite: this.MAX_REQUESTS_PER_HOUR })
    } else if (this.requestCount > 0 && this.requestCount % 50 === 0) {
      log.debug('Rate limit', { usadas: this.requestCount, restantes: remaining })
    }
    
    return { allowed: true }
  }
  
  /**
   * Incrementa o contador de rate limiting após uma requisição bem-sucedida
   */
  private incrementRequestCount(): void {
    this.requestCount++
    this.lastRequestTime = new Date() // Atualiza timestamp da última requisição
    const remaining = this.MAX_REQUESTS_PER_HOUR - this.requestCount
    if (remaining <= 10) {
      log.warn('Poucas requisições restantes', { remaining, limite: this.MAX_REQUESTS_PER_HOUR })
    } else if (this.requestCount % 50 === 0) {
      log.debug('Rate limit', { usadas: this.requestCount, restantes: remaining })
    }
  }

  /**
   * Faz uma requisição autenticada
   * Implementa rate limiting de 250 requisições por hora
   * IMPORTANTE: O contador só é incrementado após a requisição ser bem-sucedida
   */
  private async authenticatedRequest(
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 0
  ): Promise<ApiResponse> {
    // Verifica rate limiting ANTES de fazer qualquer coisa
    const rateLimitCheck = this.checkRateLimit()
    if (!rateLimitCheck.allowed) {
      // Se há um tempo de espera definido (throttling), aguarda antes de retornar erro
      if (rateLimitCheck.waitTime && rateLimitCheck.waitTime > 0) {
        // Aguarda o tempo necessário para distribuir requisições ao longo da hora
        await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime! * 1000))
        
        // Verifica novamente após aguardar
        const retryCheck = this.checkRateLimit()
        if (!retryCheck.allowed) {
          return {
            success: false,
            error: `Limite de ${this.MAX_REQUESTS_PER_HOUR} requisições por hora atingido. Aguarde ${retryCheck.waitTime} segundos antes de tentar novamente.`,
          }
        }
      } else {
        return {
          success: false,
          error: `Limite de ${this.MAX_REQUESTS_PER_HOUR} requisições por hora atingido. Aguarde ${rateLimitCheck.waitTime} segundos antes de tentar novamente.`,
        }
      }
    }
    
    const token = await this.getAuthToken()
    
    if (!token) {
      // Se não conseguiu token, não conta como requisição (já que não foi feita)
      // O contador ainda não foi incrementado, então não precisa decrementar
      return {
        success: false,
        error: 'Não foi possível obter token de autenticação',
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`
    
    log.debug('Request', { method: options.method || 'GET', url })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Se receber 401 (Unauthorized), não tenta fazer login novamente imediatamente
      // Isso evita loops infinitos de autenticação que podem causar bloqueio
      // IMPORTANTE: Não incrementa contador de rate limiting para erros 401
      if (response.status === 401) {
        log.warn('401 Unauthorized - token inválido ou expirado')
        // Limpa token para forçar novo login na próxima requisição (respeitando intervalo mínimo)
        this.accessToken = null
        this.tokenExpiration = null
        
        try {
          const responseText = await response.text()
          let errorData: any
          try {
            errorData = JSON.parse(responseText)
          } catch {
            errorData = { message: responseText || 'Token inválido ou expirado' }
          }
          
          // Não incrementa contador - requisição falhou
          return {
            success: false,
            error: errorData.message || errorData.error || 'Token de autenticação inválido ou expirado. Aguarde alguns instantes antes de tentar novamente.',
          }
        } catch {
          // Não incrementa contador - requisição falhou
          return {
            success: false,
            error: 'Token de autenticação inválido ou expirado. Aguarde alguns instantes antes de tentar novamente.',
          }
        }
      }

      // IMPORTANTE: Erros HTTP (4xx, 5xx) não contam como requisições bem-sucedidas
      // Apenas status 200-299 incrementam o contador de rate limiting
      if (!response.ok) {
        let errorData: any
        let errorMessage = `Erro ${response.status}: ${response.statusText}`
        
        try {
          const responseText = await response.text()
          log.error('Resposta com erro', { status: response.status, body: responseText })
          
          try {
            errorData = JSON.parse(responseText)
            
            // Tenta extrair mensagem mais detalhada
            if (errorData.message) {
              errorMessage = errorData.message
            } else if (errorData.error) {
              errorMessage = errorData.error
            } else if (errorData.errors && Array.isArray(errorData.errors)) {
              errorMessage = errorData.errors.map((e: any) => {
                if (typeof e === 'string') return e
                return e.message || e.field || JSON.stringify(e)
              }).join(', ')
            } else if (errorData.detail) {
              errorMessage = errorData.detail
            } else if (typeof errorData === 'object') {
              // Tenta encontrar qualquer campo de mensagem
              const possibleFields = ['message', 'error', 'detail', 'description', 'reason', 'title']
              for (const field of possibleFields) {
                if (errorData[field]) {
                  errorMessage = errorData[field]
                  break
                }
              }
            }
          } catch {
            // Se não conseguir parsear JSON, usa o texto da resposta
            if (responseText) {
              errorMessage = responseText
            }
          }
        } catch (error) {
          log.error('Erro ao processar resposta', error)
        }

        // Trata especificamente 429 (rate limit) com backoff e retry
        const lowerMsg = (errorMessage || '').toLowerCase()
        const isRateLimit =
          response.status === 429 ||
          lowerMsg.includes('limite de requisições') ||
          lowerMsg.includes('limite de requisicoes') ||
          lowerMsg.includes('rate limit')

        if (isRateLimit && attempt < this.V8_MAX_RATE_LIMIT_RETRIES) {
          const waitMs = this.V8_RATE_LIMIT_BACKOFF_MS[attempt] ?? this.V8_RATE_LIMIT_BACKOFF_MS[this.V8_RATE_LIMIT_BACKOFF_MS.length - 1]
          log.warn(`V8 Digital 429 (rate limit). Aguardando ${waitMs}ms antes da tentativa ${attempt + 2}/${this.V8_MAX_RATE_LIMIT_RETRIES + 1}`, {
            attempt: attempt + 1,
            waitMs,
          })
          await new Promise(resolve => setTimeout(resolve, waitMs))
          return this.authenticatedRequest(endpoint, options, attempt + 1)
        }

        // Não incrementa contador - requisição falhou (erro HTTP)
        return {
          success: false,
          error: errorMessage,
          data: errorData,
        }
      }

      // Requisição bem-sucedida (status 200-299)
      const responseText = await response.text()
      let data: any
      const trimmed = responseText?.trim() ?? ""
      if (trimmed === "") {
        data = {}
      } else {
        try {
          data = JSON.parse(responseText)
        } catch {
          return {
            success: false,
            error: "Resposta vazia ou inválida da API (não é JSON válido)",
            data: { raw: responseText },
          }
        }
      }

      // CRÍTICO: Incrementa contador APENAS após requisição bem-sucedida (status 200-299)
      // Erros (4xx, 5xx) e falhas de autenticação não contam para o rate limiting
      this.incrementRequestCount()

      return {
        success: true,
        data,
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      log.error('Erro na requisição', { endpoint, error })
      // Não incrementa contador em caso de erro - a requisição não foi bem-sucedida
      return {
        success: false,
        error: error.message || 'Erro ao fazer requisição à API V8 Digital',
      }
    }
  }

  /**
   * Consulta saldo FGTS
   */
  async consultarSaldoFGTS(cpf: string): Promise<ApiResponse> {
    if (!cpf || cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')
    const endpoint = `/fgts/saldo`
    
    return this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        cpf: cpfLimpo,
      }),
    })
  }

  /**
   * Consulta vínculos CLT
   * 
   * NOTA: Na V8 Digital, a consulta de vínculos é feita através da criação do termo de consentimento.
   * Use o método criarTermoConsentimentoCLT() que retorna informações sobre margem disponível.
   * 
   * Este método foi mantido para compatibilidade, mas redireciona para listar termos existentes.
   */
  async consultarVinculosCLT(cpf: string): Promise<ApiResponse> {
    if (!cpf || cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')
    
    // Na V8 Digital, a consulta é feita listando os termos de consentimento
    // com filtro por CPF. O termo de consentimento já contém informações de margem.
    const endpoint = `/private-consignment/consult`
    
    // Calcula datas para os últimos 30 dias
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)
    
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: '50',
      page: '1',
      search: cpfLimpo,
      provider: 'QI'
    })
    
    log.info('Consultando vínculos CLT (listagem termos)', { cpf: cpfLimpo })
    
    return this.authenticatedRequest(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Cria termo de consentimento CLT
   * 
   * Endpoint correto: POST /private-consignment/consult
   * Documentação: https://docs.v8sistema.com/guide/credito-privato-clt/termo-de-consentimento
   */
  async criarTermoConsentimentoCLT(params: {
    cpf: string
    nome?: string
    telefone?: string
    email?: string
    gender?: 'male' | 'female'
    birthDate?: string
    [key: string]: any
  }): Promise<ApiResponse> {
    if (!params.cpf || params.cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    const cpfLimpo = params.cpf.replace(/\D/g, '').padStart(11, '0')
    const endpoint = `/private-consignment/consult`
    
    // Prepara payload conforme documentação oficial
    const payload: any = {
      borrowerDocumentNumber: cpfLimpo,
      provider: 'QI', // Obrigatório, deve ser "QI"
    }

    // Gênero (obrigatório)
    if (params.gender) {
      payload.gender = params.gender
    } else {
      // Se não fornecido, tenta inferir ou usa padrão
      payload.gender = 'male' // Padrão, mas idealmente deve ser fornecido
    }

    // Data de nascimento (obrigatória)
    if (params.birthDate) {
      payload.birthDate = params.birthDate
    } else {
      return {
        success: false,
        error: 'Data de nascimento (birthDate) é obrigatória no formato YYYY-MM-DD',
      }
    }

    // Nome do signatário (obrigatório)
    if (params.nome) {
      payload.signerName = params.nome
    } else {
      return {
        success: false,
        error: 'Nome do registro (nome) é obrigatório',
      }
    }

    // Email do signatário (obrigatório)
    if (params.email) {
      payload.signerEmail = params.email
    } else {
      return {
        success: false,
        error: 'Email do registro (email) é obrigatório',
      }
    }

    // Telefone do signatário (obrigatório)
    if (params.telefone) {
      const telefoneLimpo = params.telefone.replace(/\D/g, '')
      
      // Valida se tem pelo menos 10 dígitos (DDD + número)
      if (telefoneLimpo.length < 10) {
        return {
          success: false,
          error: 'Telefone deve conter pelo menos 10 dígitos (DDD + número)',
        }
      }
      
      // Extrai código de área (2 primeiros dígitos) e número (resto)
      // Remove código do país se presente (55 no início)
      let telefoneProcessado = telefoneLimpo
      if (telefoneProcessado.startsWith('55') && telefoneProcessado.length > 10) {
        telefoneProcessado = telefoneProcessado.substring(2)
      }
      
      const areaCode = telefoneProcessado.substring(0, 2)
      const phoneNumber = telefoneProcessado.substring(2)
      
      // Valida código de área (deve ter 2 dígitos)
      if (areaCode.length !== 2) {
        return {
          success: false,
          error: 'Código de área inválido. O telefone deve estar no formato (DDD) Número',
        }
      }
      
      payload.signerPhone = {
        phoneNumber: phoneNumber,
        countryCode: '55', // Brasil
        areaCode: areaCode,
      }
      
      log.debug('Telefone processado', { areaCode, phoneNumber })
    } else {
      return {
        success: false,
        error: 'Telefone do registro (telefone) é obrigatório',
      }
    }

    // Adiciona outros parâmetros se fornecidos
    Object.keys(params).forEach(key => {
      if (!['cpf', 'nome', 'telefone', 'email', 'gender', 'birthDate'].includes(key) && 
          params[key] !== undefined && params[key] !== null) {
        payload[key] = params[key]
      }
    })

    log.info('Criando termo consentimento', { endpoint })
    log.debug('Payload termo', payload)

    const response = await this.authenticatedRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.success && response.data) {
      const linkTermo = response.data?.consentUrl ||
                       response.data?.url ||
                       response.data?.link ||
                       response.data?.consent_url ||
                       response.data?.signUrl ||
                       response.data?.sign_url ||
                       response.data?.consentLink ||
                       response.data?.consent_link
      if (linkTermo) {
        log.debug('Link consentimento encontrado', { link: linkTermo })
      } else {
        log.debug('Link consentimento não encontrado', { keys: Object.keys(response.data || {}) })
      }
    }

    return response
  }

  /**
   * Busca detalhes de um termo de consentimento específico pelo ID
   * 
   * Tenta buscar o termo na listagem para obter informações completas, incluindo possível link
   */
  async buscarDetalhesTermoCLT(consultId: string): Promise<ApiResponse> {
    if (!consultId || consultId.trim() === '') {
      return {
        success: false,
        error: 'ID do termo de consentimento (consult_id) é obrigatório',
      }
    }

    // Verifica o cache primeiro
    const cached = this.termoCache.get(consultId)
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime()
      const ttl = cached.data.success ? this.TERMO_CACHE_SUCCESS_TTL_MS : this.TERMO_CACHE_TTL_MS
      
      if (age < ttl) {
        log.debug('Cache hit termo', { consultId, idadeSec: Math.round(age / 1000) })
        return cached.data
      } else {
        // Cache expirado, remove
        this.termoCache.delete(consultId)
      }
    }

    // Busca o termo na listagem usando o ID como filtro
    const endpoint = `/private-consignment/consult`
    
    // Calcula datas para os últimos 90 dias para garantir que encontre o termo
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)
    
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: '100',
      page: '1',
      provider: 'QI'
    })
    
    log.info('Buscando detalhes termo', { consultId })
    
    const response = await this.authenticatedRequest(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Processa a resposta e prepara o resultado final
    let finalResponse: ApiResponse

    // Se a busca foi bem-sucedida, procura o termo específico pelo ID
    if (response.success && response.data?.data) {
      const termoEncontrado = Array.isArray(response.data.data) 
        ? response.data.data.find((termo: any) => termo.id === consultId)
        : null

      if (termoEncontrado) {
        log.debug('Termo encontrado', { consultId })
        finalResponse = {
          success: true,
          data: termoEncontrado,
        }
      } else {
        log.debug('Termo não encontrado na listagem', { consultId })
        finalResponse = {
          success: false,
          error: 'Termo não encontrado',
        }
      }
    } else {
      finalResponse = response
    }

    // Armazena no cache (limpa cache antigo se necessário)
    if (this.termoCache.size >= this.TERMO_CACHE_MAX_SIZE) {
      // Remove o item mais antigo (primeiro inserido)
      const firstKey = this.termoCache.keys().next().value
      if (firstKey) {
        this.termoCache.delete(firstKey)
      }
    }
    
    this.termoCache.set(consultId, {
      data: finalResponse,
      timestamp: new Date(),
    })

    return finalResponse
  }

  /**
   * Autoriza termo de consentimento CLT
   * 
   * Endpoint: POST /private-consignment/consult/{consult_id}/authorize
   * Documentação: https://docs.v8sistema.com/guide/credito-privato-clt/termo-de-consentimento
   */
  async autorizarTermoConsentimentoCLT(consultId: string): Promise<ApiResponse> {
    if (!consultId || consultId.trim() === '') {
      return {
        success: false,
        error: 'ID do termo de consentimento (consult_id) é obrigatório',
      }
    }

    const endpoint = `/private-consignment/consult/${consultId}/authorize`
    
    log.info('Autorizando termo', { consultId })

    const response = await this.authenticatedRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Body vazio mas válido para JSON
    })

    if (!response.success) {
      log.error('Erro ao autorizar termo', { consultId, error: response.error })
    } else {
      log.info('Termo autorizado', { consultId })
    }

    return response
  }

  /**
   * Consulta taxas disponíveis para simulação CLT
   * 
   * Endpoint: GET /private-consignment/simulation/configs
   * Documentação: https://docs.v8sistema.com/guide/credito-privato-clt/simula%C3%A7%C3%A3o-cr%C3%A9dito-clt
   */
  async consultarTaxasSimulacaoCLT(): Promise<ApiResponse> {
    const endpoint = `/private-consignment/simulation/configs`
    
    log.info('Consultando taxas simulação CLT')
    
    return this.authenticatedRequest(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Simula crédito CLT
   * 
   * Endpoint: POST /private-consignment/simulation
   * Documentação: https://docs.v8sistema.com/guide/credito-privato-clt/simula%C3%A7%C3%A3o-cr%C3%A9dito-clt
   * 
   * IMPORTANTE: Requer consult_id do termo de consentimento e config_id das taxas
   */
  async simularCreditoCLT(params: {
    consultId: string // ID do termo de consentimento (obtido ao criar o termo)
    configId: string // ID da tabela de taxas (obtido ao consultar taxas)
    valorSolicitado?: number // Valor desejado para desembolso (disbursed_amount)
    numeroParcelas?: number | 0 // Número de parcelas (number_of_installments) - se não informado, usa 0
    valorParcela?: number // Valor da parcela desejada (installment_face_value)
    [key: string]: any
  }): Promise<ApiResponse> {
    if (!params.consultId || params.consultId.trim() === '') {
      return {
        success: false,
        error: 'ID do termo de consentimento (consultId) é obrigatório. Crie o termo de consentimento primeiro.',
      }
    }

    if (!params.configId || params.configId.trim() === '') {
      return {
        success: false,
        error: 'ID da tabela de taxas (configId) é obrigatório. Consulte as taxas disponíveis primeiro.',
      }
    }

    const endpoint = `/private-consignment/simulation`
    
    // Prepara payload conforme documentação oficial
    // IMPORTANTE: number_of_installments é obrigatório na API, mesmo que seja 0
    const payload: any = {
      consult_id: params.consultId,
      config_id: params.configId,
      provider: 'QI', // Obrigatório, deve ser "QI"
    }

    // Número de parcelas - OBRIGATÓRIO (sempre deve estar presente)
    // Se informado e maior que 0, usa o valor informado
    // Se não informado ou 0, envia 0 (a API usa valor máximo disponível)
    payload.number_of_installments = (params.numeroParcelas !== undefined && params.numeroParcelas !== null && params.numeroParcelas > 0)
      ? Number(params.numeroParcelas)
      : 0

    // Valor desejado para desembolso (opcional)
    if (params.valorSolicitado && params.valorSolicitado > 0) {
      payload.disbursed_amount = Number(params.valorSolicitado)
    }

    // Valor da parcela desejada (opcional)
    // IMPORTANTE: Se disbursed_amount não for enviado, installment_face_value é obrigatório
    if (params.valorParcela && params.valorParcela > 0) {
      payload.installment_face_value = Number(params.valorParcela)
    } else if (!payload.disbursed_amount) {
      // Se não informou valor solicitado nem valor da parcela, 
      // a API exige installment_face_value quando disbursed_amount não é enviado
      // Enviando 0 para que a API calcule automaticamente baseado na margem disponível
      payload.installment_face_value = 0
    }

    // Adiciona outros parâmetros se fornecidos
    Object.keys(params).forEach(key => {
      if (!['consultId', 'configId', 'valorSolicitado', 'numeroParcelas', 'valorParcela'].includes(key) && 
          params[key] !== undefined && params[key] !== null) {
        payload[key] = params[key]
      }
    })

    // Garante que number_of_installments sempre está presente
    if (!('number_of_installments' in payload)) {
      payload.number_of_installments = 0
    }

    log.info('Criando simulação CLT', { endpoint })
    log.debug('Payload simulação', payload)

    return this.authenticatedRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  }

  /**
   * Cria proposta de crédito CLT
   */
  async criarPropostaCLT(params: {
    cpf: string
    valorSolicitado: number
    numeroParcelas: number
    [key: string]: any
  }): Promise<ApiResponse> {
    if (!params.cpf || params.cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    if (!params.valorSolicitado || params.valorSolicitado <= 0) {
      return {
        success: false,
        error: 'Valor solicitado é obrigatório e deve ser maior que zero',
      }
    }

    const cpfLimpo = params.cpf.replace(/\D/g, '').padStart(11, '0')
    const endpoint = `/clt/proposta`
    
    const payload: any = {
      cpf: cpfLimpo,
      valorSolicitado: params.valorSolicitado,
      numeroParcelas: params.numeroParcelas || 0,
    }

    // Adiciona outros parâmetros se fornecidos
    Object.keys(params).forEach(key => {
      if (!['cpf', 'valorSolicitado', 'numeroParcelas'].includes(key) && params[key] !== undefined && params[key] !== null) {
        payload[key] = params[key]
      }
    })

    return this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  /**
   * Lista operações de crédito CLT
   */
  async listarOperacoesCLT(cpf?: string): Promise<ApiResponse> {
    const endpoint = `/clt/operacoes`
    
    const params: any = {}
    if (cpf) {
      params.cpf = cpf.replace(/\D/g, '').padStart(11, '0')
    }

    const queryString = new URLSearchParams(params).toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint

    return this.authenticatedRequest(url, {
      method: 'GET',
    })
  }

  /**
   * Simula saque FGTS
   */
  async simularSaqueFGTS(params: {
    cpf: string
    valorSaque?: number
    [key: string]: any
  }): Promise<ApiResponse> {
    if (!params.cpf || params.cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    const cpfLimpo = params.cpf.replace(/\D/g, '').padStart(11, '0')
    const endpoint = `/fgts/simular`
    
    const payload: any = {
      cpf: cpfLimpo,
    }

    if (params.valorSaque) {
      payload.valorSaque = params.valorSaque
    }

    // Adiciona outros parâmetros se fornecidos
    Object.keys(params).forEach(key => {
      if (key !== 'cpf' && params[key] !== undefined && params[key] !== null) {
        payload[key] = params[key]
      }
    })

    return this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  /**
   * Cria proposta de saque FGTS
   */
  async criarPropostaFGTS(params: {
    cpf: string
    valorSaque: number
    [key: string]: any
  }): Promise<ApiResponse> {
    if (!params.cpf || params.cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    if (!params.valorSaque || params.valorSaque <= 0) {
      return {
        success: false,
        error: 'Valor do saque é obrigatório e deve ser maior que zero',
      }
    }

    const cpfLimpo = params.cpf.replace(/\D/g, '').padStart(11, '0')
    const endpoint = `/fgts/proposta`
    
    const payload: any = {
      cpf: cpfLimpo,
      valorSaque: params.valorSaque,
    }

    // Adiciona outros parâmetros se fornecidos
    Object.keys(params).forEach(key => {
      if (!['cpf', 'valorSaque'].includes(key) && params[key] !== undefined && params[key] !== null) {
        payload[key] = params[key]
      }
    })

    return this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  /**
   * Testa a conexão com a API V8 Digital
   */
  async testConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    try {
      // Tenta fazer login para testar a conexão
      const loginResult = await this.login()
      
      if (loginResult.success) {
        return {
          success: true,
          data: {
            connected: true,
            message: 'Conexão com a API V8 Digital estabelecida com sucesso',
          },
        }
      } else {
        return {
          success: false,
          data: {
            connected: false,
            message: loginResult.error || 'Não foi possível conectar à API V8 Digital',
          },
          error: loginResult.error,
        }
      }
    } catch (error: any) {
      log.error('Erro ao testar conexão', error)
      return {
        success: false,
        data: {
          connected: false,
          message: error.message || 'Erro ao testar conexão com a API V8 Digital',
        },
        error: error.message,
      }
    }
  }
}
