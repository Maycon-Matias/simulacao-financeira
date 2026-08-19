import type { ApiResponse } from './api-client'
import { createLogger } from './logger'

const log = createLogger('Presença')

/**
 * registro específico para API Banco Presença
 * Gerencia autenticação automática e endpoints específicos
 */

/** Path base para operações consignado privado CLT (evita typo/duplicação na URL) */
const PATH_CONSIGNADO_PRIVADO = '/v3/operacoes/consignado-privado'

/** Backoff em ms para retry em 429 (rate limit). Máximo 3 tentativas. */
const RATE_LIMIT_BACKOFF_MS = [4000, 8000, 16000]
const MAX_RATE_LIMIT_RETRIES = 3

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface LoginResponse {
  token?: string
  accessToken?: string
  expiration?: string
  expiresIn?: number
  success?: boolean
  error?: string
  message?: string
}

export class PresencaBankClient {
  private baseUrl: string
  private username: string
  private password: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private timeout: number

  constructor(baseUrl?: string) {
    // Tenta variáveis de ambiente com e sem NEXT_PUBLIC_ prefix
    const getEnv = (key: string, defaultValue?: string): string => {
      if (typeof window === 'undefined') {
        // Servidor: tenta com e sem NEXT_PUBLIC_
        return process.env[key] || defaultValue || ''
      } else {
        // registro: apenas NEXT_PUBLIC_
        return process.env[`NEXT_PUBLIC_${key}`] || defaultValue || ''
      }
    }
    const getEnvNum = (key: string, defaultValue: number): number => {
      const v = typeof window === 'undefined'
        ? (process.env[key] || process.env[`NEXT_PUBLIC_${key}`])
        : process.env[`NEXT_PUBLIC_${key}`]
      if (v === undefined || v === '') return defaultValue
      const n = parseInt(v, 10)
      return Number.isNaN(n) ? defaultValue : n
    }

    const raw = baseUrl || getEnv('PRESENCA_API_BASE_URL', 'https://presenca-bank-api.azurewebsites.net')
    // Garante que baseUrl é só origem (sem path), para não duplicar segmentos ao montar a URL
    try {
      const u = new URL(raw)
      this.baseUrl = u.origin
    } catch {
      this.baseUrl = raw.replace(/\/v3\/.*$/i, '').replace(/\/+$/, '') || raw
    }
    this.username = getEnv('PRESENCA_API_USERNAME', '')
    this.password = getEnv('PRESENCA_API_PASSWORD', '')
    // Timeout em ms; padrão 120s (consultar-vinculos pode demorar). Override: PRESENCA_API_TIMEOUT_MS
    this.timeout = getEnvNum('PRESENCA_API_TIMEOUT_MS', 120000)
  }

  /**
   * Atualiza credenciais e URL base
   */
  updateCredentials(username?: string, password?: string, baseUrl?: string) {
    if (username) this.username = username
    if (password) this.password = password
    if (baseUrl) {
      try {
        const u = new URL(baseUrl)
        this.baseUrl = u.origin
      } catch {
        this.baseUrl = baseUrl.replace(/\/v3\/.*$/i, '').replace(/\/+$/, '') || baseUrl
      }
    }
    // Limpa token para forçar novo login
    this.accessToken = null
    this.tokenExpiration = null
  }

  /**
   * Verifica se o token está válido
   */
  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) {
      return false
    }
    // Verifica se o token expira em pelo menos 5 minutos
    return this.tokenExpiration.getTime() > Date.now() + 5 * 60 * 1000
  }

  /**
   * Faz login e obtém o Bearer REDACTED
   */
  private async login(): Promise<ApiResponse<string>> {
    try {
      if (!this.username || !this.password) {
        return {
          success: false,
          error: 'Credenciais não configuradas. Configure as credenciais da API Banco Presença'
        }
      }

      log.debug('Login iniciando', { baseUrl: this.baseUrl })
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      try {
        const loginUrl = `${this.baseUrl}/login`
        log.debug('Requisição de login', { url: loginUrl })
        const response = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json'
          },
          body: JSON.stringify({
            login: this.username,
            password: this.password
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        log.debug('Login response', { status: response.status })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          log.error('Login falhou', errorData)
          return {
            success: false,
            error: errorData.message || errorData.error || `Erro ao fazer login: ${response.status} ${response.statusText}`
          }
        }

        const data: LoginResponse = await response.json()
        log.info('Login OK')
        
        // A API pode retornar o token em diferentes campos
        const token = data.token || data.accessToken
        
        if (!token) {
          log.error('Token não encontrado na resposta', data)
          return {
            success: false,
            error: 'Token não encontrado na resposta da API'
          }
        }

        this.accessToken = token
        
        // Calcula expiração (assume 1 hora se não especificado)
        if (data.expiration) {
          this.tokenExpiration = new Date(data.expiration)
        } else if (data.expiresIn) {
          this.tokenExpiration = new Date(Date.now() + data.expiresIn * 1000)
        } else {
          // Default: 1 hora
          this.tokenExpiration = new Date(Date.now() + 60 * 60 * 1000)
        }

        return {
          success: true,
          data: token
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        log.error('Erro no fetch do login', { name: fetchError.name, message: fetchError.message })
        if (fetchError.name === 'AbortError') {
          return {
            success: false,
            error: `Timeout ao fazer login na API Banco Presença (${this.timeout}ms). Verifique a URL base: ${this.baseUrl}`
          }
        }
        // Captura erros de rede/CORS
        if (fetchError.message && (fetchError.message.includes('fetch') || fetchError.message.includes('Failed to fetch'))) {
          return {
            success: false,
            error: `Erro de conexão: Não foi possível conectar à API Banco Presença. Verifique a URL base: ${this.baseUrl}`
          }
        }
        throw fetchError
      }
    } catch (error: any) {
      log.error('Erro ao fazer login', error)
      // Captura erros de rede genéricos
      if (error.message && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        return {
          success: false,
          error: `Erro de conexão: Não foi possível conectar à API Banco Presença em ${this.baseUrl}. Verifique se a URL está correta e se o servidor está acessível.`
        }
      }
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao fazer login'
      }
    }
  }

  /**
   * Garante que há um token válido antes de fazer requisições
   */
  private async ensureAuthenticated(): Promise<{ success: boolean; error?: string }> {
    if (this.isTokenValid()) {
      return { success: true }
    }

    const loginResult = await this.login()
    if (!loginResult.success) {
      return {
        success: false,
        error: loginResult.error || 'Não foi possível autenticar na API Banco Presença'
      }
    }
    return { success: true }
  }

  /**
   * Faz uma requisição autenticada para a API.
   * Em 429 (rate limit), aguarda backoff e repete até MAX_RATE_LIMIT_RETRIES vezes.
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      log.debug('Requisição autenticada', { endpoint })
      const authResult = await this.ensureAuthenticated()
      if (!authResult.success) {
        log.error('Falha na autenticação', { error: authResult.error })
        return {
          success: false,
          error: authResult.error || 'Não foi possível autenticar na API Banco Presença'
        }
      }

      let lastResult: ApiResponse<T> | null = null
      for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
        if (attempt > 0) {
          const waitMs = RATE_LIMIT_BACKOFF_MS[attempt - 1] ?? 16000
          log.info(`Presença 429: aguardando ${waitMs}ms antes da tentativa ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES + 1}`)
          await delay(waitMs)
        }

        const result = await this.doOneAuthenticatedRequest<T>(endpoint, options)
        lastResult = result

        if (!result.success && (result as any).rateLimit === true && attempt < MAX_RATE_LIMIT_RETRIES) {
          continue
        }
        return result
      }
      return lastResult ?? { success: false, error: 'Rate limit após várias tentativas' }
    } catch (error: any) {
      log.error(`Requisição falhou: ${endpoint}`, error)
      return {
        success: false,
        error: error.message || 'Erro desconhecido na requisição'
      }
    }
  }

  /**
   * Executa uma única tentativa de requisição autenticada (sem retry).
   */
  private async doOneAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
      log.debug('Request', { method: options.method || 'GET', url })

      const hasBody = options.body !== undefined && options.body !== null && options.body !== ''
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(hasBody && { 'Content-Type': 'application/json' }),
          'accept': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
          ...options.headers
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const method = options.method || 'GET'
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const isSimulacaoDisponiveis = endpoint.includes('simulacao/disponiveis')
        const is5xx = response.status >= 500
        if (isSimulacaoDisponiveis && is5xx) {
          log.warn(`${method} ${endpoint} → ${response.status}`, errorData)
        } else {
          log.error(`${method} ${endpoint} → ${response.status}`, errorData)
        }
        const isRateLimit = response.status === 429 ||
          (errorData.message && errorData.message.toLowerCase().includes('rate limit')) ||
          (errorData.error && errorData.error.toLowerCase().includes('rate limit'))
        const errMsg = errorData.message || errorData.error ||
          (Array.isArray(errorData.messages) && errorData.messages[0]) ||
          `Erro na requisição: ${response.status} ${response.statusText}`
        return {
          success: false,
          error: errMsg,
          rateLimit: isRateLimit
        } as ApiResponse<T>
      }

      const responseText = await response.text()
      const trimmed = responseText?.trim() ?? ''
      let data: any
      if (trimmed === '') {
        data = {}
      } else {
        try {
          data = JSON.parse(responseText)
        } catch {
          log.error('Resposta não é JSON válido', { endpoint })
          return {
            success: false,
            error: 'Resposta inválida da API (não é JSON)'
          }
        }
      }
      log.info(`${method} ${endpoint} → ${response.status}`)
      return {
        success: true,
        data
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      log.error('Erro no fetch', { endpoint, name: fetchError.name, message: fetchError.message })
      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          error: `Timeout na requisição à API Banco Presença para ${endpoint} (${this.timeout}ms). A requisição demorou mais que o tempo limite.`
        }
      }
      throw fetchError
    }
  }

  /**
   * Verifica disponibilidade de login
   */
  async verificarDisponibilidadeLogin(login: string): Promise<ApiResponse<any>> {
    return this.authenticatedRequest(`/disponibilidade-login?login=${encodeURIComponent(login)}`, {
      method: 'GET'
    })
  }

  /**
   * Consulta margem (método genérico)
   */
  async consultarMargem(cpf: string, outrosParametros?: any): Promise<ApiResponse<any>> {
    // Banco Presença usa o endpoint /gooroo/margins/{cpf} como GET
    return this.authenticatedRequest(`/gooroo/margins/${cpf}`, {
      method: 'GET'
    })
  }

  // Métodos específicos para CLT (Consignado Privado)
  // Referência: collection Postman ConsignadoPrivado; docs/API_PRESENCA_CONSIGNADO_PRIVADO.md

  /**
   * Solicita autorização para consulta CLT (gerar termo). Path configurável via PRESENCA_AUTORIZACAO_PATH.
   * Na collection ConsignadoPrivado o endpoint é POST /consultas/termo-inss (nome histórico; usado para CLT também).
   * Body conforme Postman: cpf, nome, telefone, produtoId: 28; opcional: cpfRepresentante, nomeRepresentante.
   */
  async solicitarAutorizacaoConsulta(cpf: string, dados?: { nome?: string; email?: string; telefone?: string; dataNascimento?: string; cpfRepresentante?: string; nomeRepresentante?: string; [k: string]: any }): Promise<ApiResponse<any>> {
    const getEnv = (key: string): string => (typeof process !== 'undefined' && process.env?.[key]) || ''
    const path = getEnv('PRESENCA_AUTORIZACAO_PATH') || getEnv('NEXT_PUBLIC_PRESENCA_AUTORIZACAO_PATH')
    if (!path) {
      return {
        success: false,
        error: 'Endpoint de autorização Presença não configurado. Defina PRESENCA_AUTORIZACAO_PATH (ex.: /consultas/termo-inss).',
        data: { required: true }
      }
    }
    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')
    if (cpfLimpo.length !== 11) {
      return { success: false, error: 'CPF deve ter 11 dígitos' }
    }
    const body: Record<string, unknown> = { cpf: cpfLimpo }
    if (dados?.nome) body.nome = dados.nome
    if (dados?.email) body.email = dados.email
    const tel = dados?.telefone != null ? String(dados.telefone).replace(/\D/g, '') : ''
    if (tel) body.telefone = tel
    if (dados?.dataNascimento) body.dataNascimento = dados.dataNascimento
    if (dados?.cpfRepresentante) body.cpfRepresentante = String(dados.cpfRepresentante).replace(/\D/g, '')
    if (dados?.nomeRepresentante) body.nomeRepresentante = dados.nomeRepresentante
    if (path.includes('termo-inss')) body.produtoId = 28
    log.info('Solicitando autorização CLT', { cpf: cpfLimpo })
    return this.authenticatedRequest(path, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * Assina o termo de autorização (PUT /consultas/termo-inss/{termoId}).
   * Na collection ConsignadoPrivado é obrigatório assinar antes de consultar vínculos.
   * Header tenant-id configurável via PRESENCA_TERMO_TENANT_ID (padrão: superuser).
   * A API exige body não vazio no formato DeviceInfoDto (Swagger).
   */
  async assinarTermoAutorizacao(termoId: string): Promise<ApiResponse<any>> {
    const getEnv = (key: string): string => (typeof process !== 'undefined' && process.env?.[key]) || ''
    const pathBase = getEnv('PRESENCA_AUTORIZACAO_PATH') || getEnv('NEXT_PUBLIC_PRESENCA_AUTORIZACAO_PATH')
    if (!pathBase || !termoId?.trim()) {
      return {
        success: false,
        error: 'TermoId ou PRESENCA_AUTORIZACAO_PATH não informado.',
        data: undefined
      }
    }
    const path = `${pathBase.replace(/\/+$/, '')}/${termoId.trim()}`
    const tenantId = getEnv('PRESENCA_TERMO_TENANT_ID') || getEnv('NEXT_PUBLIC_PRESENCA_TERMO_TENANT_ID') || 'superuser'
    log.info('Assinando termo', { termoId })
    // Body no formato indicado pelo suporte Presença: PascalCase + GeoLocation (Latitude/Longitude)
    const deviceInfoBody = {
      UserAgent: 'SistemaProdutoAPI/1.0',
      OperationalSystem: 'Node',
      DeviceModel: 'API',
      DeviceName: 'sistema-produto-api',
      DeviceType: 'server',
      GeoLocation: {
        Latitude: '-1.0',
        Longitude: '-5.0'
      }
    }
    return this.authenticatedRequest(path, {
      method: 'PUT',
      headers: { 'tenant-id': tenantId, 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceInfoBody)
    })
  }

  /**
   * Consulta vínculos empregatícios para CLT
   * POST /v3/operacoes/consignado-privado/consultar-vinculos
   * Body: { cpf } — Retorna lista de vínculos (campos ex.: registroEmpregaticio, cnpjEmpregador)
   * Opcional: opts.autorizacaoId ou opts.idAutorizacao (e outros campos) são enviados no body quando a API exige "autorização válida".
   */
  async consultarVinculosCLT(cpf: string, opts?: { autorizacaoId?: string; idAutorizacao?: string; [k: string]: any }): Promise<ApiResponse<any>> {
    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')
    log.info('Consultando vínculos CLT', { cpf: cpfLimpo })
    
    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    const body: Record<string, unknown> = { cpf: cpfLimpo }
    if (opts?.autorizacaoId) body.autorizacaoId = opts.autorizacaoId
    if (opts?.idAutorizacao) body.idAutorizacao = opts.idAutorizacao
    if (opts?.id) body.id = opts.id
    if (opts?.consentId) body.consentId = opts.consentId
    if (opts?.nome) body.nome = opts.nome
    if (opts?.dataNascimento) body.dataNascimento = opts.dataNascimento

    return this.authenticatedRequest(`${PATH_CONSIGNADO_PRIVADO}/consultar-vinculos`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * Consulta margem disponível para CLT
   * POST /v3/operacoes/consignado-privado/consultar-margem
   * Body: { cpf, matricula, cnpj } — matricula e cnpj vêm do vínculo (registroEmpregaticio, cnpjEmpregador)
   */
  async consultarMargemCLT(params: {
    cpf: string
    matricula: string
    cnpj: string
  }): Promise<ApiResponse<any>> {
    const cpfLimpo = params.cpf.replace(/\D/g, '').padStart(11, '0')
    const matriculaLimpa = params.matricula.replace(/\D/g, '')
    const cnpjLimpo = params.cnpj.replace(/\D/g, '')
    
    log.info('Consultando margem CLT', { cpf: cpfLimpo, matricula: matriculaLimpa, cnpj: cnpjLimpo })
    
    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    if (!matriculaLimpa || matriculaLimpa.trim() === '') {
      return {
        success: false,
        error: 'Matrícula é obrigatória',
      }
    }

    if (!cnpjLimpo || cnpjLimpo.length < 14) {
      return {
        success: false,
        error: 'CNPJ é obrigatório e deve ter pelo menos 14 dígitos',
      }
    }
    if (cnpjLimpo === '00000000000000') {
      return {
        success: false,
        error: 'CNPJ inválido: valor não pode ser apenas zeros. Use o CNPJ real do empregador do vínculo.',
      }
    }

    // Normaliza matrícula: API pode rejeitar > 15 dígitos ou muitos zeros à esquerda (ex.: 00000000000000004789 -> 4789)
    let matriculaEnviar = matriculaLimpa
    if (matriculaLimpa.length > 15) {
      const semZeros = matriculaLimpa.replace(/^0+/, '')
      matriculaEnviar = semZeros ? semZeros.slice(-15) : matriculaLimpa.slice(-15)
    }

    return this.authenticatedRequest(`${PATH_CONSIGNADO_PRIVADO}/consultar-margem`, {
      method: 'POST',
      body: JSON.stringify({
        cpf: cpfLimpo,
        matricula: matriculaEnviar,
        cnpj: cnpjLimpo
      })
    })
  }

  /**
   * Cria termo de consentimento para consulta CLT
   * NOTA: Este método foi mantido para compatibilidade, mas o fluxo correto é:
   * 1. consultarVinculosCLT() - retorna vínculos com matrícula e CNPJ
   * 2. consultarMargemCLT() - usa os dados do vínculo para consultar margem
   * 
   * Se ainda for necessário criar um termo específico, este método pode ser usado,
   * mas normalmente a consulta de vínculos já faz isso automaticamente.
   */
  async criarTermoConsentimentoCLT(params: {
    cpf: string
    nome?: string
    telefone?: string
    email?: string
    dataNascimento?: string
    [key: string]: any
  }): Promise<ApiResponse<any>> {
    // Por enquanto, apenas retorna sucesso pois a consulta de vínculos já cria o termo
    // Se necessário criar termo explicitamente, usar endpoint específico quando disponível
    return {
      success: true,
      data: {
        message: 'Termo de consentimento será criado automaticamente na consulta de vínculos'
      }
    }
  }

  /**
   * Consulta tabelas disponíveis para simulação CLT (Consignado Privado)
   * POST /v5/operacoes/simulacao/disponiveis
   * Body: tomador.vinculoEmpregaticio com cnpjEmpregador e registroEmpregaticio
   */
  async consultarTabelasDisponiveisCLT(params: {
    cpf: string
    registroEmpregaticio: string
    cnpjEmpregador: string
    [key: string]: any
  }): Promise<ApiResponse<any>> {
    const cpfLimpo = (params.cpf || '').replace(/\D/g, '').padStart(11, '0')
    const registro = (params.registroEmpregaticio || '').replace(/\D/g, '').trim()
    const cnpjLimpo = (params.cnpjEmpregador || '').replace(/\D/g, '').padStart(14, '0')

    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }
    if (!registro) {
      return {
        success: false,
        error: 'registroEmpregaticio (matrícula) é obrigatório',
      }
    }
    if (cnpjLimpo.length !== 14) {
      return {
        success: false,
        error: 'cnpjEmpregador (CNPJ) deve ter 14 dígitos',
      }
    }

    const body: any = {
      tomador: {
        cpf: cpfLimpo,
        vinculoEmpregaticio: {
          cnpjEmpregador: cnpjLimpo,
          registroEmpregaticio: registro,
        },
      },
    }
    Object.keys(params).forEach(key => {
      if (!['cpf', 'registroEmpregaticio', 'cnpjEmpregador'].includes(key) && params[key] !== undefined && params[key] !== null) {
        if (!body.tomador) body.tomador = {}
        if (key === 'tomador' && typeof params[key] === 'object') {
          Object.assign(body.tomador, params[key])
        } else if (key !== 'tomador') {
          body[key] = params[key]
        }
      }
    })

    log.info('Consultando tabelas simulação CLT')
    return this.authenticatedRequest('/v5/operacoes/simulacao/disponiveis', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Simula crédito CLT
   * POST /operacoes/realizar-simulacao
   * Baseado na documentação: 16.6. Operação Realizar Simulação
   * Para fluxo completo, pode-se chamar antes consultarTabelasDisponiveisCLT().
   */
  async simularCreditoCLT(params: {
    operacaoId?: string
    cpf: string
    valorSolicitado?: number
    numeroParcelas?: number
    valorParcela?: number
    /** Matrícula do vínculo (ou use registroEmpregaticio) */
    matricula?: string
    /** CNPJ do empregador (ou use cnpjEmpregador) */
    cnpj?: string
    /** Registro empregatício (matrícula) */
    registroEmpregaticio?: string
    /** CNPJ do empregador */
    cnpjEmpregador?: string
    [key: string]: any
  }): Promise<ApiResponse<any>> {
    if (!params.cpf || params.cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    const cpfLimpo = params.cpf.replace(/\D/g, '').padStart(11, '0')
    
    if (cpfLimpo.length !== 11) {
      return {
        success: false,
        error: 'CPF deve ter 11 dígitos',
      }
    }

    const payload: any = {
      cpf: cpfLimpo,
      tipoProduto: 'CLT', // Consignado Privado
    }

    if (params.operacaoId) payload.operacaoId = params.operacaoId
    if (params.valorSolicitado && params.valorSolicitado > 0) {
      payload.valorSolicitado = Number(params.valorSolicitado)
    }
    if (params.numeroParcelas && params.numeroParcelas > 0) {
      payload.numeroParcelas = Number(params.numeroParcelas)
    }
    if (params.valorParcela && params.valorParcela > 0) {
      payload.valorParcela = Number(params.valorParcela)
    }

    const matricula = (params.matricula ?? params.registroEmpregaticio ?? '').replace(/\D/g, '').trim()
    const cnpj = (params.cnpj ?? params.cnpjEmpregador ?? '').replace(/\D/g, '').padStart(14, '0')
    if (matricula) payload.matricula = matricula
    if (cnpj.length === 14) payload.cnpj = cnpj
    if (params.registroEmpregaticio !== undefined) payload.registroEmpregaticio = params.registroEmpregaticio
    if (params.cnpjEmpregador !== undefined) payload.cnpjEmpregador = (params.cnpjEmpregador || '').replace(/\D/g, '').padStart(14, '0') || undefined

    // Adiciona outros parâmetros se fornecidos
    const excludeKeys = ['cpf', 'operacaoId', 'valorSolicitado', 'numeroParcelas', 'valorParcela', 'matricula', 'cnpj', 'registroEmpregaticio', 'cnpjEmpregador']
    Object.keys(params).forEach(key => {
      if (!excludeKeys.includes(key) && params[key] !== undefined && params[key] !== null) {
        payload[key] = params[key]
      }
    })

    log.info('Simulando crédito CLT')
    log.debug('Payload simulação', payload)

    return this.authenticatedRequest('/operacoes/realizar-simulacao', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  /**
   * Consulta operação CLT por ID
   * GET /v3/operacoes/{id}
   */
  async consultarOperacaoCLT(operacaoId: string): Promise<ApiResponse<any>> {
    if (!operacaoId || operacaoId.trim() === '') {
      return {
        success: false,
        error: 'ID da operação é obrigatório',
      }
    }

    return this.authenticatedRequest(`/v3/operacoes/${operacaoId}`, {
      method: 'GET'
    })
  }

  /**
   * Realiza simulação
   */
  async realizarSimulacao(dadosSimulacao: any): Promise<ApiResponse<any>> {
    return this.authenticatedRequest('/operacoes/realizar-simulacao', {
      method: 'POST',
      body: JSON.stringify(dadosSimulacao)
    })
  }

  /**
   * Consulta operações
   */
  async consultarOperacoes(filtros?: any): Promise<ApiResponse<any>> {
    const queryParams = filtros ? new URLSearchParams(filtros).toString() : ''
    return this.authenticatedRequest(`/operacoes${queryParams ? `?${queryParams}` : ''}`, {
      method: 'GET'
    })
  }

  /**
   * Consulta operação por ID
   */
  async consultarOperacaoPorId(id: string): Promise<ApiResponse<any>> {
    return this.authenticatedRequest(`/operacoes/${id}`, {
      method: 'GET'
    })
  }

  /**
   * Cria operação (POST /v3/operacoes)
   */
  async criarOperacao(dadosOperacao: any): Promise<ApiResponse<any>> {
    return this.authenticatedRequest('/v3/operacoes', {
      method: 'POST',
      body: JSON.stringify(dadosOperacao)
    })
  }

  /**
   * Cria operação CLT (Consignado Privado)
   * POST /v3/operacoes com type: "credito-privado-bpn" e tomador.vinculoEmpregaticio
   */
  async criarOperacaoCLT(params: {
    tipo?: string
    cpf: string
    registroEmpregaticio: string
    cnpjEmpregador: string
    [key: string]: any
  }): Promise<ApiResponse<any>> {
    const cpfLimpo = (params.cpf || '').replace(/\D/g, '').padStart(11, '0')
    const registro = (params.registroEmpregaticio || '').replace(/\D/g, '').trim()
    const cnpjLimpo = (params.cnpjEmpregador || '').replace(/\D/g, '').padStart(14, '0')

    if (cpfLimpo.length !== 11) {
      return { success: false, error: 'CPF deve ter 11 dígitos' }
    }
    if (!registro) {
      return { success: false, error: 'registroEmpregaticio (matrícula) é obrigatório' }
    }
    if (cnpjLimpo.length !== 14) {
      return { success: false, error: 'cnpjEmpregador (CNPJ) deve ter 14 dígitos' }
    }

    const body: any = {
      type: params.tipo ?? 'credito-privado-bpn',
      tomador: {
        cpf: cpfLimpo,
        vinculoEmpregaticio: {
          cnpjEmpregador: cnpjLimpo,
          registroEmpregaticio: registro,
        },
      },
    }
    Object.keys(params).forEach(key => {
      if (!['cpf', 'registroEmpregaticio', 'cnpjEmpregador', 'tipo'].includes(key) &&
          params[key] !== undefined && params[key] !== null) {
        body[key] = params[key]
      }
    })

    log.info('Criando operação CLT')
    return this.authenticatedRequest('/v3/operacoes', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Cancela operação
   */
  async cancelarOperacao(id: string, motivo?: string): Promise<ApiResponse<any>> {
    return this.authenticatedRequest(`/operacoes/${id}/cancelar`, {
      method: 'PUT',
      body: JSON.stringify({ motivo })
    })
  }

  /**
   * Testa a conexão com a API
   */
  async testConnection(): Promise<ApiResponse<boolean>> {
    const result = await this.login()
    return {
      success: result.success,
      data: result.success,
      error: result.error
    }
  }
}

