import type { ApiResponse } from './api-client'

/**
 * registro para a API CredSpot
 * Documentação: https://api.credspot.net/api/v1/docs
 */
export class CredSpotClient {
  private baseUrl: string
  private authUrl: string
  private audience: string
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private readonly timeout = 30000 // 30 segundos

  constructor(baseUrl?: string, clientId?: string, clientSecret?: string, authUrl?: string, audience?: string) {
    // Tenta obter variáveis de ambiente com e sem prefixo NEXT_PUBLIC_
    const getEnv = (key: string, defaultValue: string = ''): string => {
      if (typeof window === 'undefined') {
        return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      } else {
        return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
    }
    
    this.baseUrl = baseUrl || getEnv('CREDSPOT_API_BASE_URL', 'https://api.credspot.net/api/v1')
    this.authUrl = authUrl || getEnv('CREDSPOT_AUTH_URL', 'https://auth.credspot.net/oauth/token')
    // Audience conforme documentação oficial: https://api.credspot.net/api/v1/docs
    this.audience = audience || getEnv('CREDSPOT_AUDIENCE', 'https://api.credspot.net/')
    this.clientId = clientId || getEnv('CREDSPOT_CLIENT_ID', '')
    this.clientSecret = clientSecret || getEnv('CREDSPOT_CLIENT_SECRET', '')
    
    // Remove trailing slash da baseUrl e authUrl, mas mantém no audience (conforme documentação)
    this.baseUrl = this.baseUrl.replace(/\/$/, '')
    this.authUrl = this.authUrl.replace(/\/$/, '')
    // Audience deve ter barra final conforme documentação: https://api.credspot.net/
    if (!this.audience.endsWith('/')) {
      this.audience = this.audience + '/'
    }
  }

  /**
   * Atualiza credenciais e URL base
   */
  updateCredentials(
    clientId?: string,
    clientSecret?: string,
    baseUrl?: string,
    authUrl?: string,
    audience?: string
  ) {
    if (clientId) this.clientId = clientId
    if (clientSecret !== undefined) this.clientSecret = clientSecret
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '')
    }
    if (authUrl) {
      this.authUrl = authUrl.replace(/\/$/, '')
    }
    if (audience !== undefined && audience !== '') {
      // Audience deve ter barra final conforme documentação
      this.audience = audience.endsWith('/') ? audience : audience + '/'
    }
    // Limpa token ao atualizar credenciais
    this.accessToken = null
    this.tokenExpiration = null
  }

  /**
   * Verifica se o token ainda é válido (com margem de 5 minutos)
   */
  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) {
      return false
    }
    const now = new Date()
    const margin = 5 * 60 * 1000 // 5 minutos em milissegundos
    return this.tokenExpiration.getTime() - now.getTime() > margin
  }

  /**
   * Cria um AbortController com timeout (compatível com navegadores mais antigos)
   */
  private createTimeoutSignal(): AbortSignal {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    
    // Limpa o timeout se o signal for abortado manualmente
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
    })
    
    return controller.signal
  }

  /**
   * Autentica e obtém token de acesso usando Client Credentials
   */
  private async authenticate(): Promise<void> {
    try {
      console.log('[CredSpotClient] 🔐 Autenticando...')
      console.log('[CredSpotClient] Auth URL:', this.authUrl)
      console.log('[CredSpotClient] Audience:', this.audience)
      
      // Se estiver no registro (browser), usa endpoint de API do Next.js para evitar CORS
      // Se estiver no servidor, faz requisição direta
      const isClient = typeof window !== 'undefined'
      let response: Response

      if (isClient) {
        // No registro, usa endpoint de API do Next.js
        console.log('[CredSpotClient] Executando no registro, usando endpoint de API do Next.js')
        response = await fetch('/api/produto/credspot/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            authUrl: this.authUrl,
            audience: this.audience,
          }),
          signal: this.createTimeoutSignal(),
        })

        const apiData = await response.json()

        if (!response.ok || !apiData.success) {
          const errorMsg = apiData.error || apiData.details || `Erro ${response.status}: ${response.statusText}`
          const details = apiData.details || apiData.rawResponse || ''
          console.error('[CredSpotClient] ❌ Erro na autenticação:', response.status)
          console.error('[CredSpotClient] ❌ Mensagem de erro:', errorMsg)
          if (details) {
            console.error('[CredSpotClient] ❌ Detalhes:', details)
          }
          throw new Error(errorMsg)
        }

        const data = apiData.data

        if (!data.access_token) {
          throw new Error('Token de acesso não retornado na resposta')
        }

        this.accessToken = data.access_token
        const expiresIn = data.expires_in || 3600 // Padrão: 1 hora
        this.tokenExpiration = new Date(Date.now() + expiresIn * 1000)
        
        console.log('[CredSpotClient] ✅ Autenticação bem-sucedida. Token expira em:', expiresIn, 'segundos')
      } else {
        // No servidor, faz requisição direta
        console.log('[CredSpotClient] Executando no servidor, fazendo requisição direta')
        response = await fetch(this.authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            audience: this.audience,
            grant_type: 'client_credentials',
          }),
          signal: this.createTimeoutSignal(),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[CredSpotClient] ❌ Erro na autenticação:', response.status, errorText)
          throw new Error(`Erro ao autenticar: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        
        if (!data.access_token) {
          throw new Error('Token de acesso não retornado na resposta')
        }

        this.accessToken = data.access_token
        const expiresIn = data.expires_in || 3600 // Padrão: 1 hora
        this.tokenExpiration = new Date(Date.now() + expiresIn * 1000)
        
        console.log('[CredSpotClient] ✅ Autenticação bem-sucedida. Token expira em:', expiresIn, 'segundos')
      }
    } catch (error: any) {
      console.error('[CredSpotClient] ❌ Erro ao autenticar:', error)
      this.accessToken = null
      this.tokenExpiration = null
      throw error
    }
  }

  /**
   * Garante que há um token válido antes de fazer requisições
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.isTokenValid()) {
      await this.authenticate()
    }
  }

  /**
   * Faz uma requisição autenticada à API
   */
  async authenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse> {
    await this.ensureAuthenticated()

    if (!this.accessToken) {
      return {
        success: false,
        error: 'Não foi possível obter token de acesso',
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: this.createTimeoutSignal(),
      })

      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        const nestedMsg =
          typeof responseData === 'object' && responseData !== null
            ? (responseData as { message?: string }).message ||
              (Array.isArray((responseData as { errors?: unknown }).errors)
                ? JSON.stringify((responseData as { errors: unknown }).errors).slice(0, 800)
                : undefined)
            : undefined
        return {
          success: false,
          error:
            nestedMsg ||
            (typeof responseData.error === 'string' ? responseData.error : undefined) ||
            responseData.message ||
            responseData.error ||
            `Erro ${response.status}: ${response.statusText}`,
          data: responseData,
        }
      }

      return {
        success: true,
        data: responseData,
      }
    } catch (error: any) {
      console.error('[CredSpotClient] Erro na requisição:', error)
      return {
        success: false,
        error: error.message || 'Erro ao fazer requisição',
      }
    }
  }

  /**
   * Obtém informações do usuário autenticado
   * GET /entidade/me
   */
  async obterUsuario(): Promise<ApiResponse> {
    return await this.authenticatedRequest('/entidade/me')
  }

  /**
   * Lista transações
   * GET /transactions
   */
  async listarTransacoes(params?: {
    page?: number
    limit?: number
    status?: string
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams()
    if (params) {
      if (params.page) queryParams.append('page', params.page.toString())
      if (params.limit) queryParams.append('limit', params.limit.toString())
      if (params.status) queryParams.append('status', params.status)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
    }
    const query = queryParams.toString()
    return await this.authenticatedRequest(`/transactions${query ? `?${query}` : ''}`)
  }

  /**
   * Cria uma nova transação
   * POST /transactions
   */
  async criarTransacao(dados: {
    amount: number
    description?: string
    cpf?: string
    [key: string]: any
  }): Promise<ApiResponse> {
    return await this.authenticatedRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  }

  /**
   * Consulta pontuação de crédito por CPF
   * GET /credit-scores?cpf={cpf}
   */
  async consultarCreditScore(cpf: string): Promise<ApiResponse> {
    // Remove formatação do CPF
    const cpfLimpo = cpf.replace(/\D/g, '')
    
    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    return await this.authenticatedRequest(`/credit-scores?cpf=${cpfLimpo}`)
  }

  /**
   * Cria uma avaliação de risco
   * POST /risk-evaluations
   */
  async criarAvaliacaoRisco(dados: {
    cpf: string
    income?: number
    loan_amount?: number
    [key: string]: any
  }): Promise<ApiResponse> {
    // Remove formatação do CPF
    const cpfLimpo = dados.cpf.replace(/\D/g, '')
    
    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    const dadosLimpos = {
      ...dados,
      cpf: cpfLimpo,
    }

    return await this.authenticatedRequest('/risk-evaluations', {
      method: 'POST',
      body: JSON.stringify(dadosLimpos),
    })
  }

  /**
   * Lista relatórios disponíveis
   * GET /reports
   */
  async listarRelatorios(params?: {
    page?: number
    limit?: number
    type?: string
  }): Promise<ApiResponse> {
    const queryParams = new URLSearchParams()
    if (params) {
      if (params.page) queryParams.append('page', params.page.toString())
      if (params.limit) queryParams.append('limit', params.limit.toString())
      if (params.type) queryParams.append('type', params.type)
    }
    const query = queryParams.toString()
    return await this.authenticatedRequest(`/reports${query ? `?${query}` : ''}`)
  }

  /**
   * Obtém um relatório específico
   * GET /reports/{id}
   */
  async obterRelatorio(reportId: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/reports/${reportId}`)
  }

  // Métodos específicos para CLT (Consignado Privado)
  
  /**
   * Cria um novo usuário
   * POST /entidade
   */
  async criarUsuario(dados: {
    document: string // CPF (11 dígitos)
    name: string // Nome completo (nome + sobrenome)
    mail: string // Email
    phone: string // Telefone com DDD (11 dígitos)
    birth: string // Data de nascimento (YYYY-MM-DD)
    gender?: string // M ou F (opcional)
  }): Promise<ApiResponse> {
    // Remove formatação
    const documentLimpo = dados.document.replace(/\D/g, '')
    const phoneLimpo = dados.phone.replace(/\D/g, '')
    
    if (documentLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    if (phoneLimpo.length !== 11) {
      return {
        success: false,
        error: 'Telefone deve ter 11 dígitos (DDD + número)',
      }
    }

    const body = {
      document: documentLimpo,
      name: dados.name,
      mail: dados.mail,
      phone: phoneLimpo,
      birth: dados.birth,
      ...(dados.gender && { gender: dados.gender }),
    }

    return await this.authenticatedRequest('/entidade', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Busca usuário por UUID
   * GET /entidade/{uuid}
   */
  async buscarUsuario(uuid: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/entidade/${uuid}`)
  }

  /**
   * Atualiza usuário
   * PATCH /entidade/{uuid}
   */
  async atualizarUsuario(uuid: string, dados: Partial<{
    name: string
    mail: string
    phone: string
    birth: string
    gender: string
    [key: string]: any
  }>): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/entidade/${uuid}`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    })
  }

  /**
   * Gera link de consentimento CLT
   * POST /clt/consent — OpenAPI: obrigatório `userUuid`; opcional `skipSms`
   * @see https://api.credspot.net/api/v1/docs
   */
  async gerarConsentimentoCLT(params: { userUuid: string; skipSms?: boolean }): Promise<ApiResponse> {
    if (!params.userUuid) {
      return { success: false, error: 'userUuid é obrigatório (cadastre o usuário com POST /entidade antes)' }
    }
    const body: Record<string, unknown> = { userUuid: params.userUuid }
    if (params.skipSms !== undefined) body.skipSms = params.skipSms
    return await this.authenticatedRequest('/clt/consent', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Consulta margem consignável (inicia processamento assíncrono; preferir webhook `margin.completed`)
   * POST /clt/margin — body: `userUuid`, `eligibilityUuid` (uuid do contrato elegível em consent.completed)
   */
  async consultarMargemCLT(userUuid: string, eligibilityUuid: string): Promise<ApiResponse> {
    return await this.authenticatedRequest('/clt/margin', {
      method: 'POST',
      body: JSON.stringify({ userUuid, eligibilityUuid }),
    })
  }

  /**
   * Simula oferta de empréstimo CLT (primeira chamada sem disbursementValue/installments)
   * POST /clt/offer — body: `userUuid`, `balanceInquiryUuid` (retorno de /clt/margin ou webhook margin.completed)
   */
  async simularOfertasCLT(
    userUuid: string,
    balanceInquiryUuid: string,
    opts?: {
      installments?: number
      disbursementValue?: number
      withInsurance?: boolean
      selectedTable?: string
    }
  ): Promise<ApiResponse> {
    const body: Record<string, unknown> = { userUuid, balanceInquiryUuid }
    if (opts?.installments != null) body.installments = opts.installments
    if (opts?.disbursementValue != null) body.disbursementValue = opts.disbursementValue
    if (opts?.withInsurance !== undefined) body.withInsurance = opts.withInsurance
    if (opts?.selectedTable) body.selectedTable = opts.selectedTable
    return await this.authenticatedRequest('/clt/offer', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Cria contrato CLT
   * POST /clt/contract
   */
  async criarContratoCLT(dados: {
    userUuid: string
    selectedOptionUuid: string
    bankAccountUuid: string
  }): Promise<ApiResponse> {
    return await this.authenticatedRequest('/clt/contract', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  }

  /**
   * Cancela contrato CLT (apenas pending ou waiting_signature)
   * DELETE /clt/contract/{uuid}
   */
  async cancelarContratoCLT(contractUuid: string, userUuid: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/clt/contract/${contractUuid}`, {
      method: 'DELETE',
      body: JSON.stringify({ userUuid }),
    })
  }

  /**
   * Reapresenta pagamento (contrato em payment_failed, etc.)
   * PUT /clt/contract/{uuid}/payment
   */
  async reapresentarPagamentoCLT(
    contractUuid: string,
    body: {
      userUuid: string
      disbursementDate: string
      bankAccountUuid?: string
      disbursementBankAccounts?: unknown[]
      reason?: string
    }
  ): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/clt/contract/${contractUuid}/payment`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  /** GET /contracts */
  async listarContratosCLT(params?: {
    status?: string
    user_uuid?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse> {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.user_uuid) q.set('user_uuid', params.user_uuid)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    const qs = q.toString()
    return await this.authenticatedRequest(`/contracts${qs ? `?${qs}` : ''}`)
  }

  /** GET /contracts/{uuid} */
  async obterContratoCLT(contractUuid: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/contracts/${contractUuid}`)
  }

  /** GET /contracts/document/{document} */
  async contratosPorDocumento(document: string, type: 'clt' | 'fgts' | 'all' = 'clt'): Promise<ApiResponse> {
    const doc = document.replace(/\D/g, '')
    if (doc.length !== 11) return { success: false, error: 'CPF deve ter 11 dígitos' }
    return await this.authenticatedRequest(`/contracts/document/${doc}?type=${encodeURIComponent(type)}`)
  }

  /** GET /banks */
  async listarBancos(): Promise<ApiResponse> {
    return await this.authenticatedRequest('/banks')
  }

  /** POST /bank-accounts */
  async criarContaBancaria(dados: {
    user_uuid: string
    bank_code: string
    branch: string
    account_number: string
    account_type: string
    account_digit?: string
  }): Promise<ApiResponse> {
    return await this.authenticatedRequest('/bank-accounts', {
      method: 'POST',
      body: JSON.stringify(dados),
    })
  }

  /** POST /webhooks/endpoints */
  async cadastrarWebhookEndpoint(url: string, description?: string): Promise<ApiResponse> {
    return await this.authenticatedRequest('/webhooks/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url, ...(description ? { description } : {}) }),
    })
  }

  /** GET /webhooks/endpoints */
  async listarWebhookEndpoints(): Promise<ApiResponse> {
    return await this.authenticatedRequest('/webhooks/endpoints')
  }

  /** DELETE /webhooks/endpoints/{endpointId} */
  async removerWebhookEndpoint(endpointId: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/webhooks/endpoints/${endpointId}`, {
      method: 'DELETE',
    })
  }

  /** GET /webhooks/endpoints/{endpointId}/secret */
  async obterSecretWebhookEndpoint(endpointId: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/webhooks/endpoints/${endpointId}/secret`)
  }

  /**
   * Verifica status do consentimento CLT
   * GET /clt/consent-status?inquiryUuid={uuid}
   * Nota: A API CredSpot espera "inquiryUuid" e não "relationshipInquiryUuid"
   */
  async verificarStatusConsentimentoCLT(relationshipInquiryUuid: string): Promise<ApiResponse> {
    return await this.authenticatedRequest(`/clt/consent-status?inquiryUuid=${relationshipInquiryUuid}`)
  }

  /**
   * Aceita/autoriza o consentimento CLT automaticamente
   * Tenta diferentes formatos de endpoint que a API pode aceitar
   */
  async aceitarConsentimentoCLT(relationshipInquiryUuid: string): Promise<ApiResponse> {
    console.log('[CredSpotClient] Tentando aceitar consentimento:', relationshipInquiryUuid)
    
    // Formato 1: POST /clt/consent/accept com inquiryUuid no body
    console.log('[CredSpotClient] Tentativa 1: POST /clt/consent/accept com inquiryUuid')
    let response = await this.authenticatedRequest('/clt/consent/accept', {
      method: 'POST',
      body: JSON.stringify({ inquiryUuid: relationshipInquiryUuid }),
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 1 (POST /clt/consent/accept)')
      return response
    }

    // Formato 2: POST /clt/consent/accept com relationshipInquiryUuid no body
    console.log('[CredSpotClient] Tentativa 2: POST /clt/consent/accept com relationshipInquiryUuid')
    response = await this.authenticatedRequest('/clt/consent/accept', {
      method: 'POST',
      body: JSON.stringify({ relationshipInquiryUuid }),
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 2 (POST /clt/consent/accept com relationshipInquiryUuid)')
      return response
    }

    // Formato 3: POST /clt/consent/{uuid}/accept
    console.log('[CredSpotClient] Tentativa 3: POST /clt/consent/{uuid}/accept')
    response = await this.authenticatedRequest(`/clt/consent/${relationshipInquiryUuid}/accept`, {
      method: 'POST',
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 3 (POST /clt/consent/{uuid}/accept)')
      return response
    }

    // Formato 4: PUT /clt/consent/{uuid}/accept
    console.log('[CredSpotClient] Tentativa 4: PUT /clt/consent/{uuid}/accept')
    response = await this.authenticatedRequest(`/clt/consent/${relationshipInquiryUuid}/accept`, {
      method: 'PUT',
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 4 (PUT /clt/consent/{uuid}/accept)')
      return response
    }

    // Formato 5: POST /clt/consent/{uuid}/authorize
    console.log('[CredSpotClient] Tentativa 5: POST /clt/consent/{uuid}/authorize')
    response = await this.authenticatedRequest(`/clt/consent/${relationshipInquiryUuid}/authorize`, {
      method: 'POST',
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 5 (POST /clt/consent/{uuid}/authorize)')
      return response
    }

    // Formato 6: PUT /clt/consent-status com inquiryUuid
    console.log('[CredSpotClient] Tentativa 6: PUT /clt/consent-status com inquiryUuid')
    response = await this.authenticatedRequest('/clt/consent-status', {
      method: 'PUT',
      body: JSON.stringify({ inquiryUuid: relationshipInquiryUuid, status: 'accepted' }),
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 6 (PUT /clt/consent-status)')
      return response
    }

    // Formato 7: PATCH /clt/consent-status
    console.log('[CredSpotClient] Tentativa 7: PATCH /clt/consent-status com inquiryUuid')
    response = await this.authenticatedRequest('/clt/consent-status', {
      method: 'PATCH',
      body: JSON.stringify({ inquiryUuid: relationshipInquiryUuid, hasConsent: true, status: 'accepted' }),
    })
    if (response.success) {
      console.log('[CredSpotClient] ✅ Aceito com formato 7 (PATCH /clt/consent-status)')
      return response
    }

    console.warn('[CredSpotClient] ⚠️ Nenhum formato de aceitação via API funcionou. Último erro:', response.error)
    return response
  }

  /**
   * Tenta aceitar o consentimento acessando o link: carrega a página, extrai
   * o formulário de aceite e envia o POST para simular o clique em "Aceitar".
   */
  async aceitarConsentimentoViaLink(consentLink: string): Promise<ApiResponse> {
    if (!consentLink || typeof consentLink !== 'string') {
      return { success: false, error: 'Link de consentimento inválido' }
    }
    const url = consentLink.trim()
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const baseHeaders = { 'entidade-Agent': ua, 'Accept': 'text/html,application/json' }

    console.log('[CredSpotClient] Aceitar via link: carregando página...', url.substring(0, 70) + '...')

    try {
      const getRes = await fetch(url, { method: 'GET', redirect: 'follow', headers: baseHeaders })
      const html = await getRes.text()
      const baseUrl = new URL(url)
      const origin = baseUrl.origin

      if (!getRes.ok) {
        console.warn('[CredSpotClient] GET no link retornou', getRes.status)
        return { success: false, error: `GET retornou ${getRes.status}`, data: { status: getRes.status } }
      }

      if (process.env.REDACTED === 'development') {
        const snippet = html.replace(/\s+/g, ' ').substring(0, 2500)
        console.log('[CredSpotClient] HTML (dev, 2500 chars):', snippet)
      }

      // Cookies: em Node fetch, get('set-cookie') costuma ser null; usar getSetCookie() se existir
      let cookieHeader: Record<string, string> = {}
      const h = getRes.headers as unknown as { getSetCookie?: () => string[] }
      if (typeof h?.getSetCookie === 'function') {
        const cookies = h.getSetCookie()
        if (cookies.length) {
          cookieHeader = { Cookie: cookies.map(c => c.split(';')[0]).join('; ') }
          console.log('[CredSpotClient] Cookies capturados:', cookies.length)
        }
      } else {
        const setCookie = getRes.headers.get('set-cookie')
        if (setCookie) {
          cookieHeader = { Cookie: setCookie }
          console.log('[CredSpotClient] Cookie (set-cookie) capturado')
        }
      }

      // 1) Procura action do form
      const formActionMatch = html.match(/<form[^>]*action=["']([^"']*)["']/i) || html.match(/action=["']([^"']*)["'][^>]*>/i)
      const formAction = formActionMatch ? formActionMatch[1].trim() : ''
      const formMethod = /<form[^>]*method=["'](get|post)["']/i.exec(html)?.[1]?.toLowerCase() || 'post'

      // 2) Extrai hidden inputs
      const hiddenPairs: [string, string][] = []
      const hiddenRe = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']*)["'][^>]*value=["']([^"']*)["'][^>]*>/gi
      let m: RegExpExecArray | null
      while ((m = hiddenRe.exec(html)) !== null) hiddenPairs.push([m[1], m[2]])
      const altRe = /<input[^>]*name=["']([^"']*)["'][^>]*value=["']([^"']*)["'][^>]*type=["']hidden["'][^>]*>/gi
      while ((m = altRe.exec(html)) !== null) {
        if (!hiddenPairs.some(([n]) => n === m![1])) hiddenPairs.push([m[1], m[2]])
      }

      // 2b) Extrai checkboxes (ex.: "Li e autorizo...") – ao submeter, enviamos name=value como se estivesse marcado
      const checkboxNames: string[] = []
      const checkboxValueMap: Record<string, string> = {}
      const cbTagRe = /<input[^>]*type=["']checkbox["'][^>]*>/gi
      while ((m = cbTagRe.exec(html)) !== null) {
        const tag = m[0]
        const n = /name=["']([^"']*)["']/.exec(tag)?.[1]
        const v = /value=["']([^"']*)["']/.exec(tag)?.[1]
        if (n && !checkboxNames.includes(n)) {
          checkboxNames.push(n)
          checkboxValueMap[n] = v || 'on'
        }
      }

      // 2c) Botão submit "Aceitar e Continuar" – preferir o que tiver aceitar/continuar no value
      let submitName: string | undefined
      let submitValue: string | undefined
      const submitRegex = /<(?:button|input)[^>]*(?:type=["']submit["'])[^>]*name=["']([^"']*)["'][^>]*value=["']([^"']*)["'][^>]*>/gi
      const altSubmitRegex = /<(?:button|input)[^>]*name=["']([^"']*)["'][^>]*value=["']([^"']*)["'][^>]*(?:type=["']submit["'])[^>]*>/gi
      const allSubmits: [string, string][] = []
      while ((m = submitRegex.exec(html)) !== null) allSubmits.push([m[1], m[2]])
      while ((m = altSubmitRegex.exec(html)) !== null) {
        if (!allSubmits.some(([n]) => n === m![1])) allSubmits.push([m[1], m[2]])
      }
      const aceitarMatch = allSubmits.find(([, val]) => /aceitar|continuar|accept/i.test(val))
      const pick = aceitarMatch || allSubmits[0]
      if (pick) {
        submitName = pick[0]
        submitValue = pick[1]
      }

      // 3) Tenta POST em /{uuid}/accept (ex.: consent.credspot.net/xxx -> consent.credspot.net/xxx/accept)
      const pathAccept = url.replace(/\/?$/, '') + '/accept'
      console.log('[CredSpotClient] Tentando POST', pathAccept.substring(0, 80) + '...')
      const pathAcceptRes = await fetch(pathAccept, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          ...baseHeaders,
          ...cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': url,
        },
        body: 'accept=1&confirmed=1',
      })
      if (pathAcceptRes.ok) {
        console.log('[CredSpotClient] ✅ POST em /accept retornou', pathAcceptRes.status)
        return { success: true, data: { via: 'path_accept', status: pathAcceptRes.status } }
      }

      // 4) Procura link de aceite (accept, confirm, autorizar, etc.)
      const acceptLinkRe = /<a[^>]*href=["']([^"']*(?:accept|confirm|autoriz|consent|concordar|sim|authorize)[^"']*)["'][^>]*>/gi
      const acceptLinkMatch = acceptLinkRe.exec(html)
      const acceptHref = acceptLinkMatch ? acceptLinkMatch[1].trim() : ''

      if (acceptHref) {
        const fullHref = acceptHref.startsWith('http') ? acceptHref : new URL(acceptHref, origin).href
        console.log('[CredSpotClient] Link de aceite encontrado, GET:', fullHref.substring(0, 80) + '...')
        const linkRes = await fetch(fullHref, {
          method: 'GET',
          redirect: 'follow',
          headers: { ...baseHeaders, ...cookieHeader },
        })
        if (linkRes.ok) {
          console.log('[CredSpotClient] ✅ GET no link de aceite retornou', linkRes.status)
          return { success: true, data: { via: 'accept_link', status: linkRes.status } }
        }
      }

      // 5) POST no form (action ou própria URL)
      let postUrl = url
      if (formAction) {
        postUrl = formAction.startsWith('http') ? formAction : new URL(formAction, origin).href
      }

      const formData = new URLSearchParams()
      const appended = new Set<string>()
      for (const [name, val] of hiddenPairs) {
        formData.append(name, val)
        appended.add(name.toLowerCase())
      }
      for (const name of checkboxNames) {
        const val = checkboxValueMap[name] || 'on'
        formData.append(name, val)
        appended.add(name.toLowerCase())
      }
      if (submitName && submitValue) formData.append(submitName, submitValue)
      if (!appended.has('accept')) formData.append('accept', '1')
      if (!appended.has('confirmed')) formData.append('confirmed', '1')
      if (!appended.has('consent')) formData.append('consent', '1')

      const bodyKeys = [...formData.keys()]
      console.log('[CredSpotClient] Form parseado:', {
        formAction: formAction || '(mesma URL)',
        hiddens: hiddenPairs.length,
        checkboxes: checkboxNames,
        submit: submitName ? `${submitName}=${submitValue}` : null,
        bodyKeys,
      })
      console.log('[CredSpotClient] POST no form de consentimento...', postUrl.substring(0, 70) + '...')
      const postRes = await fetch(postUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          ...baseHeaders,
          ...cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': url,
          'Origin': origin,
        },
        body: formData.toString(),
      })

      const postText = await postRes.text()
      const postOk = postRes.ok
      console.log('[CredSpotClient] Resposta POST form:', {
        status: postRes.status,
        ok: postOk,
        url: postRes.url?.substring(0, 90),
        bodyPreview: postText.substring(0, 200).replace(/\s+/g, ' '),
      })

      if (postOk) {
        const looksSuccess = /obrigado|sucesso|consentimento.*aceito|authorized|confirmado|concluído/i.test(postText)
        if (looksSuccess) {
          console.log('[CredSpotClient] ✅ POST form retornou 200 e página de sucesso detectada')
        } else {
          console.log('[CredSpotClient] ✅ POST form retornou 200 (conteúdo pode ser o form novamente)')
        }
        return { success: true, data: { via: 'form_post', status: postRes.status } }
      }

      // 6) Fallback: POST simples no link
      const fallbackRes = await fetch(url, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          ...baseHeaders,
          ...cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': url,
        },
        body: 'accept=1&confirmed=1&consent=1',
      })
      if (fallbackRes.ok) {
        console.log('[CredSpotClient] ✅ POST fallback retornou', fallbackRes.status)
        return { success: true, data: { via: 'fallback_post', status: fallbackRes.status } }
      }

      return { success: false, error: `Form POST retornou ${postRes.status}`, data: { status: postRes.status } }
    } catch (e: any) {
      console.warn('[CredSpotClient] Erro ao aceitar via link:', e?.message)
      return { success: false, error: e?.message || 'Erro ao acessar link' }
    }
  }

  // Métodos de compatibilidade mantidos para não quebrar código existente
  
  /**
   * Consulta informações de um CPF (alias para consultarCreditScore)
   */
  async consultarCPF(cpf: string): Promise<ApiResponse> {
    return await this.consultarCreditScore(cpf)
  }

  /**
   * Consulta margem disponível para um CPF
   * Pode ser implementado através de avaliação de risco ou outro endpoint específico
   */
  async consultarMargem(cpf: string): Promise<ApiResponse> {
    // Remove formatação do CPF
    const cpfLimpo = cpf.replace(/\D/g, '')
    
    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    // Tenta obter margem através de avaliação de risco ou credit score
    // Pode precisar ser ajustado conforme a documentação real da API
    const creditScore = await this.consultarCreditScore(cpfLimpo)
    
    if (creditScore.success && creditScore.data) {
      // Extrai margem se disponível nos dados do credit score
      return {
        success: true,
        data: {
          cpf: cpfLimpo,
          margem: (creditScore.data as any).availableMargin || (creditScore.data as any).margin || 0,
          ...creditScore.data,
        },
      }
    }

    return creditScore
  }

  /**
   * Lista todas as consultas realizadas (alias para listarTransacoes)
   */
  async listarConsultas(): Promise<ApiResponse> {
    return await this.listarTransacoes()
  }

  /**
   * Obtém detalhes de uma consulta específica (alias para obter relatório ou transação)
   */
  async obterDetalhesConsulta(consultaId: string): Promise<ApiResponse> {
    // Tenta como transação primeiro
    const transacao = await this.authenticatedRequest(`/transactions/${consultaId}`)
    if (transacao.success) {
      return transacao
    }
    
    // Se não for transação, tenta como relatório
    return await this.obterRelatorio(consultaId)
  }

  /**
   * Testa a conexão com a API CredSpot
   */
  async testConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    try {
      // Tenta autenticar para testar a conexão
      await this.ensureAuthenticated()
      
      if (this.accessToken) {
        return {
          success: true,
          data: {
            connected: true,
            message: 'Conexão com a API CredSpot estabelecida com sucesso',
          },
        }
      } else {
        return {
          success: false,
          data: {
            connected: false,
            message: 'Não foi possível obter token de acesso',
          },
          error: 'Não foi possível obter token de acesso',
        }
      }
    } catch (error: any) {
      console.error('[CredSpotClient] Erro ao testar conexão:', error)
      return {
        success: false,
        data: {
          connected: false,
          message: error.message || 'Erro ao testar conexão com a API CredSpot',
        },
        error: error.message || 'Erro ao testar conexão',
      }
    }
  }
}
