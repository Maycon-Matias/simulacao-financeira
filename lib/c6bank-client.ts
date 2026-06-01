import type { ApiResponse } from './api-client'

/**
 * registro para a API C6 Bank (Marketplace Proposal Service)
 * Manual V29.1: integração simulação/contratação FGTS, Margem Livre e Consignado Trabalhador (CLT).
 * Domínio: https://marketplace-proposal-service-api-p.c6bank.info
 */

const DEFAULT_BASE_URL = 'https://marketplace-proposal-service-api-p.c6bank.info'

interface AuthTokenResponse {
  access_token: string
  expires_in_seconds: number
}

/** Promoter code = parte após o "_" no username. */
function extractPromoterCode(username: string): string {
  const idx = username.indexOf('_')
  return idx >= 0 ? username.slice(idx + 1).trim() : username.trim()
}

export interface C6SimulacaoMargemLivreClient {
  tax_identifier: string
  enrollment: string
  birth_date: string
  income_amount: number
}

export interface C6SimulacaoMargemLivreParams {
  /** 0001 = Margem Livre (padrão), 0007 = Aumento Margem Livre */
  product_type_code?: string
  /** POR_VALOR_SOLICITADO | POR_VALOR_PARCELA */
  simulation_type: 'POR_VALOR_SOLICITADO' | 'POR_VALOR_PARCELA'
  /** DIGITAL | DIGITAL_WEB | PLUS */
  formalization_subtype?: string
  /** PRIVADO (padrão) | INSS | SIAPE_SERVIDOR | SIAPE_PENSIONISTA | AUXILIO_BRASIL */
  covenant_group?: string
  /** Empregador/Órgão: 000007 = CONSIG TRAB (padrão). Consultar via /marketplace/covenant-companies/public-agencies se necessário */
  public_agency?: string
  /** Para simulation_type POR_VALOR_SOLICITADO */
  request_amount?: number
  /** Para simulation_type POR_VALOR_PARCELA */
  installment_amount?: number
  installment_quantity: number
  client: C6SimulacaoMargemLivreClient
  /** NOVA | REFINANCIAMENTO */
  operation_type?: string
}

/**
 * Parâmetros para geração de oferta de Consignado Trabalhador (CLT)
 * Manual V29.1 - Seção "Geração de oferta - Consignado Trabalhador". Campo cpf_cliente corrigido na V29.1.
 */
export interface C6GerarOfertaConsignadoTrabalhadorParams {
  /** CPF do registro (obrigatório) */
  cpf_cliente: string
  /** CPF do representante legal (opcional) */
  cpf_representante_legal?: string
}

/**
 * Parâmetros para simulação de propostas - Consignado Trabalhador (CLT)
 * Manual V29.1 - Seção "Simulação de Propostas - Consignado Trabalhador"
 */
export interface C6SimulacaoConsignadoTrabalhadorParams {
  /** CPF do registro (obrigatório) */
  cpf: string
  /** POR_VALOR_MAXIMO | POR_VALOR_SOLICITADO | POR_VALOR_PARCELA */
  tipo_simulacao: 'POR_VALOR_MAXIMO' | 'POR_VALOR_SOLICITADO' | 'POR_VALOR_PARCELA'
  /** Obrigatório se tipo_simulacao for POR_VALOR_SOLICITADO ou POR_VALOR_PARCELA */
  prazo?: number
  /** Obrigatório se tipo_simulacao for POR_VALOR_SOLICITADO */
  valor_solicitado?: number
  /** Obrigatório se tipo_simulacao for POR_VALOR_PARCELA */
  valor_parcela?: number
}

/**
 * Parâmetros para inclusão de proposta - Consignado Trabalhador (CLT)
 * Manual V29.1 - Seção "Inclusão de Propostas - Consignado Trabalhador"
 */
export interface C6IncluirPropostaConsignadoTrabalhadorParams {
  /** ID da simulação retornado em worker-payroll-loan-offers/simulation */
  id_simulacao: string
  cpf: string
  ddd: string
  numero_telefone: string
  logradouro: string
  numero: string
  cep: string
  bairro: string
  cidade: string
  uf: string
  dados_bancarios: {
    tipo_conta: string
    numero_banco: string
    numero_agencia: string
    digito_agencia: string
    numero_conta: string
    digito_conta: string
  }
  codigo_origem_6: string
  numero_cpf_certificado: string
}

/**
 * Parâmetros para geração de link de autorização de consulta de dados
 * Manual V29.1 - Seção "Geração de Link para Autorização de Consulta de Dados - Emprestimo do Trabalhador"
 */
export interface C6GerarLinkAutorizacaoParams {
  /** Nome do registro (obrigatório) */
  nome: string
  /** CPF do registro (obrigatório) */
  cpf: string
  /** Data de nascimento do registro no formato YYYY-MM-DD (obrigatório) */
  data_nascimento: string
  /** Telefone do registro (opcional) */
  telefone?: {
    numero: string
    codigo_area: string
  }
}

/**
 * Parâmetros para consulta de status da autorização
 * Manual V29.1 - Seção "Consulta de status da autorização do registro"
 */
export interface C6ConsultarStatusAutorizacaoParams {
  /** CPF do registro (obrigatório) */
  cpf: string
}

export class C6BankClient {
  private baseUrl: string
  private authUrl: string
  private username: string
  private ******: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private readonly timeout = 30000

  constructor(baseUrl?: string, authUrl?: string) {
    const getEnv = (key: string, defaultValue: string = ''): string => {
      if (typeof window === 'undefined') {
        return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
      return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
    }
    this.baseUrl = baseUrl || getEnv('C6BANK_API_BASE_URL', DEFAULT_BASE_URL).replace(/\/$/, '')
    this.authUrl = authUrl || getEnv('C6BANK_AUTH_URL', '').replace(/\/$/, '') || `${this.baseUrl}/auth/token`
    this.username = getEnv('C6BANK_USERNAME', '')
    this.****** = getEnv('C6BANK_PASSWORD', '')
  }

  updateCredentials(username?: string, ******?: string, baseUrl?: string, authUrl?: string) {
    if (username !== undefined) this.username = username
    if (****** !== undefined) this.****** = ******
    if (baseUrl !== undefined) this.baseUrl = baseUrl.replace(/\/$/, '')
    if (authUrl !== undefined) this.authUrl = authUrl.replace(/\/$/, '')
    else if (baseUrl !== undefined) this.authUrl = `${this.baseUrl}/auth/token`
    this.accessToken = null
    this.tokenExpiration = null
  }

  private isTokenValid(): boolean {
    if (!this.accessToken || !this.tokenExpiration) return false
    return this.tokenExpiration.getTime() > Date.now() + 60 * 1000
  }

  /**
   * Login: POST application/x-www-form-urlencoded.
   * Retorno: access_token e expires_in_seconds.
   * Uso do token: header Authorization com apenas o valor do token (sem Bearer).
   */
  private async login(): Promise<ApiResponse<string>> {
    try {
      if (!this.username || !this.******) {
        return { success: false, error: 'C6 Bank: usuário e ****** não configurados.' }
      }
      const body = new URLSearchParams({ username: this.username, ******: this.****** }).toString()
      const res = await fetch(this.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return {
          success: false,
          error: (err.message || err.error || res.statusText) || `Erro ${res.status} no login C6 Bank.`
        }
      }
      const data: AuthTokenResponse = await res.json()
      if (!data.access_token) {
        return { success: false, error: 'C6 Bank: access_token não retornado.' }
      }
      this.accessToken = data.access_token
      const sec = data.expires_in_seconds ?? 7200
      this.tokenExpiration = new Date(Date.now() + sec * 1000)
      return { success: true, data: data.access_token }
    } catch (e: any) {
      console.error('[C6BankClient] Erro no login:', e)
      return { success: false, error: e.message || 'Erro ao autenticar no C6 Bank.' }
    }
  }

  private async getAuthToken(): Promise<string | null> {
    if (this.isTokenValid()) return this.accessToken
    const result = await this.login()
    return result.success ? (result.data ?? null) : null
  }

  /**
   * Requisição autenticada. Header Authorization = apenas o token (sem Bearer).
   */
  private async authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = await this.getAuthToken()
    if (!token) {
      return { success: false, error: 'C6 Bank: não foi possível obter token.' }
    }
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.c6bank_error_data_v2+json',
          'Authorization': token,
          ...(options.headers as Record<string, string>)
        }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.message ?? data.error ?? res.statusText
        return { success: false, error: msg || `Erro ${res.status} C6 Bank.`, data }
      }
      return { success: true, data: data as T }
    } catch (e: any) {
      console.error('[C6BankClient] Erro na requisição:', e)
      return { success: false, error: e.message || 'Erro na requisição C6 Bank.' }
    }
  }

  /**
   * Simulação de Margem Livre (ou Aumento Margem Livre).
   * product_type_code: 0001 = Margem Livre (padrão), 0007 = Aumento Margem Livre.
   * covenant_group: PRIVADO (padrão) | INSS | SIAPE_* | AUXILIO_BRASIL.
   */
  async simularMargemLivre(params: C6SimulacaoMargemLivreParams): Promise<ApiResponse<any>> {
    const promoterCode = extractPromoterCode(this.username)
    const productTypeCode = params.product_type_code ?? '0001'
    const body = {
      operation_type: params.operation_type ?? 'NOVA',
      simulation_type: params.simulation_type,
      formalization_subtype: params.formalization_subtype ?? 'DIGITAL_WEB',
      promoter_code: promoterCode,
      product_type_code: productTypeCode,
      covenant_group: params.covenant_group ?? 'PRIVADO',
      public_agency: params.public_agency ?? '000007',
      request_amount: params.simulation_type === 'POR_VALOR_SOLICITADO' ? params.request_amount : null,
      installment_amount: params.simulation_type === 'POR_VALOR_PARCELA' ? params.installment_amount : null,
      installment_quantity: params.installment_quantity,
      client: {
        tax_identifier: params.client.tax_identifier.replace(/\D/g, ''),
        enrollment: params.client.enrollment,
        birth_date: params.client.birth_date,
        income_amount: params.client.income_amount
      }
    }
    return this.authenticatedRequest<any>('/marketplace/proposal/simulation', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * Geração de link para autorização de consulta de dados - Empréstimo do Trabalhador
   * Manual V29.1 - POST /marketplace/authorization/generate-liveness
   * Accept: application/vnd.c6bank_authorization_generate_liveness_v1+json
   */
  async gerarLinkAutorizacao(params: C6GerarLinkAutorizacaoParams): Promise<ApiResponse<{ link: string; data_expiracao: string }>> {
    const body: any = {
      nome: params.nome,
      cpf: params.cpf.replace(/\D/g, ''),
      data_nascimento: params.data_nascimento
    }
    if (params.telefone) {
      body.telefone = {
        numero: params.telefone.numero.replace(/\D/g, ''),
        codigo_area: params.telefone.codigo_area.replace(/\D/g, '')
      }
    }
    
    const token = await this.getAuthToken()
    if (!token) {
      return { success: false, error: 'C6 Bank: não foi possível obter token.' }
    }
    
    const url = `${this.baseUrl}/marketplace/authorization/generate-liveness`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.c6bank_authorization_generate_liveness_v1+json',
          'Authorization': token
        },
        body: JSON.stringify(body)
      })
      
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.message ?? data.error ?? res.statusText
        console.error('[C6BankClient] Erro ao gerar link de autorização:', { status: res.status, data })
        return { success: false, error: msg || `Erro ${res.status} C6 Bank.`, data }
      }
      return { success: true, data: data as { link: string; data_expiracao: string } }
    } catch (e: any) {
      console.error('[C6BankClient] Erro ao gerar link de autorização:', e)
      return { success: false, error: e.message || 'Erro ao gerar link de autorização.' }
    }
  }

  /**
   * Consulta de status da autorização do registro
   * Manual V29.1 - POST /marketplace/authorization/status
   * Accept: application/vnd.c6bank_authorization_status_v1+json
   */
  async consultarStatusAutorizacao(params: C6ConsultarStatusAutorizacaoParams): Promise<ApiResponse<{ status: string; observacao?: string }>> {
    const body = {
      cpf: params.cpf.replace(/\D/g, '')
    }
    
    const token = await this.getAuthToken()
    if (!token) {
      return { success: false, error: 'C6 Bank: não foi possível obter token.' }
    }
    
    const url = `${this.baseUrl}/marketplace/authorization/status`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.c6bank_authorization_status_v1+json',
          'Authorization': token
        },
        body: JSON.stringify(body)
      })
      
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.message ?? data.error ?? res.statusText
        console.error('[C6BankClient] Erro ao consultar status de autorização:', { status: res.status, data })
        return { success: false, error: msg || `Erro ${res.status} C6 Bank.`, data }
      }
      return { success: true, data: data as { status: string; observacao?: string } }
    } catch (e: any) {
      console.error('[C6BankClient] Erro ao consultar status de autorização:', e)
      return { success: false, error: e.message || 'Erro ao consultar status de autorização.' }
    }
  }

  /**
   * Geração de oferta - Consignado Trabalhador (CLT)
   * Manual V29.1 - POST /marketplace/worker-payroll-loan-offers
   * Body: { cpf_cliente } (V29.1: correção do campo cpf_cliente)
   * Accept: application/vnd.c6bank_generate_offer_v1+json
   * Verifica autorização antes de gerar; retorna requiresAuthorization se necessário.
   */
  async gerarOfertaConsignadoTrabalhador(params: C6GerarOfertaConsignadoTrabalhadorParams): Promise<ApiResponse<any>> {
    // Primeiro, verifica se há autorização
    const statusAuth = await this.consultarStatusAutorizacao({ cpf: params.cpf_cliente })
    
    if (statusAuth.success && statusAuth.data) {
      const status = statusAuth.data.status
      if (status === 'NAO_AUTORIZADO' || status === 'AGUARDANDO_AUTORIZACAO') {
        return {
          success: false,
          error: `registro precisa autorizar a consulta de dados primeiro. Status: ${status}`,
          data: {
            requiresAuthorization: true,
            authorizationStatus: status,
            message: status === 'AGUARDANDO_AUTORIZACAO' 
              ? 'Autorização está aguardando aprovação do registro.' 
              : 'registro não autorizou a consulta de dados.'
          }
        }
      }
      // Se status for 'AUTORIZADO', continua com a geração da oferta
    } else {
      // Se não conseguir consultar o status, tenta gerar a oferta mesmo assim
      // (pode ser que a autorização não seja obrigatória em alguns casos)
      console.warn('[C6BankClient] Não foi possível verificar status de autorização, tentando gerar oferta mesmo assim')
    }
    
    const body: any = {
      cpf_cliente: params.cpf_cliente.replace(/\D/g, '')
    }
    if (params.cpf_representante_legal) {
      body.cpf_representante_legal = params.cpf_representante_legal.replace(/\D/g, '')
    }
    
    console.log('[C6BankClient] gerarOfertaConsignadoTrabalhador - Body:', JSON.stringify(body, null, 2))
    
    const token = await this.getAuthToken()
    if (!token) {
      return { success: false, error: 'C6 Bank: não foi possível obter token.' }
    }
    
    const url = `${this.baseUrl}/marketplace/worker-payroll-loan-offers`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.c6bank_generate_offer_v1+json',
          'Authorization': token
        },
        body: JSON.stringify(body)
      })
      
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.message ?? data.error ?? res.statusText
        console.error('[C6BankClient] Erro na resposta C6 Bank:', { status: res.status, data })
        
        // Detecta erro de autorização do DataPrev (status 422 com mensagem específica)
        if (res.status === 422 && msg && (
          msg.toLowerCase().includes('data query not authorized') ||
          msg.toLowerCase().includes('dataprev') ||
          msg.toLowerCase().includes('not authorized')
        )) {
          return {
            success: false,
            error: msg || 'Consulta de dados não autorizada pelo DataPrev',
            data: {
              requiresAuthorization: true,
              authorizationStatus: 'NAO_AUTORIZADO',
              message: 'É necessário autorizar a consulta de dados no DataPrev antes de gerar a oferta.',
              originalError: data
            }
          }
        }
        
        return { success: false, error: msg || `Erro ${res.status} C6 Bank.`, data }
      }
      return { success: true, data: data as any }
    } catch (e: any) {
      console.error('[C6BankClient] Erro ao gerar oferta Consignado Trabalhador:', e)
      return { success: false, error: e.message || 'Erro ao gerar oferta Consignado Trabalhador.' }
    }
  }

  /**
   * CLT: Gera link de autorização (prova de vida).
   * Alias para fluxo Link → Status → Oferta. Aceita telefone como string (digitos) ou objeto { numero, codigo_area }.
   */
  async cltGenerateAuthorizationLink(payload: {
    cpf: string
    nome: string
    data_nascimento: string
    telefone?: string | { numero: string; codigo_area: string }
  }): Promise<ApiResponse<any>> {
    let telefoneObj: { numero: string; codigo_area: string } | undefined
    if (payload.telefone) {
      if (typeof payload.telefone === 'object' && payload.telefone.numero && payload.telefone.codigo_area) {
        telefoneObj = {
          numero: String(payload.telefone.numero).replace(/\D/g, ''),
          codigo_area: String(payload.telefone.codigo_area).replace(/\D/g, '')
        }
      } else if (typeof payload.telefone === 'string') {
        const digits = payload.telefone.replace(/\D/g, '')
        if (digits.length >= 10) {
          telefoneObj = { codigo_area: digits.slice(0, 2), numero: digits.slice(2) }
        } else if (digits.length >= 8) {
          telefoneObj = { codigo_area: '11', numero: digits }
        }
      }
    }
    return this.gerarLinkAutorizacao({
      nome: payload.nome,
      cpf: payload.cpf,
      data_nascimento: payload.data_nascimento,
      telefone: telefoneObj
    })
  }

  /**
   * CLT: Consulta status da autorização.
   */
  async cltAuthorizationStatus(payload: { cpf: string }): Promise<ApiResponse<any>> {
    return this.consultarStatusAutorizacao({ cpf: payload.cpf })
  }

  /**
   * CLT: Obtém oferta (margem/limite). Chamada direta, sem verificar status antes.
   * Use após o registro ter autorizado (status = AUTORIZADO).
   */
  async cltGetOffer(payload: { cpf_cliente: string }): Promise<ApiResponse<any>> {
    return this.gerarOfertaConsignadoTrabalhador({ cpf_cliente: payload.cpf_cliente })
  }

  /**
   * Simulação de Propostas - Consignado Trabalhador (CLT)
   * Manual V29.1 - POST /marketplace/worker-payroll-loan-offers/simulation
   * Accept: application/vnd.c6bank_error_data_v2+json
   */
  async simularConsignadoTrabalhador(params: C6SimulacaoConsignadoTrabalhadorParams): Promise<ApiResponse<any>> {
    const body: Record<string, unknown> = {
      cpf: params.cpf.replace(/\D/g, ''),
      tipo_simulacao: params.tipo_simulacao
    }
    if (params.prazo != null) body.prazo = params.prazo
    if (params.valor_solicitado != null) body.valor_solicitado = params.valor_solicitado
    if (params.valor_parcela != null) body.valor_parcela = params.valor_parcela
    return this.authenticatedRequest<any>('/marketplace/worker-payroll-loan-offers/simulation', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * Inclusão de Propostas - Consignado Trabalhador (CLT)
   * Manual V29.1 - POST /marketplace/worker-payroll-loan-offers/include
   * Accept: application/vnd.c6bank_error_data_v2+json
   */
  async incluirPropostaConsignadoTrabalhador(params: C6IncluirPropostaConsignadoTrabalhadorParams): Promise<ApiResponse<any>> {
    const body = {
      id_simulacao: params.id_simulacao,
      cpf: params.cpf.replace(/\D/g, ''),
      ddd: params.ddd.replace(/\D/g, ''),
      numero_telefone: params.numero_telefone.replace(/\D/g, ''),
      logradouro: params.logradouro,
      numero: params.numero,
      cep: params.cep.replace(/\D/g, ''),
      bairro: params.bairro,
      cidade: params.cidade,
      uf: params.uf,
      dados_bancarios: params.dados_bancarios,
      codigo_origem_6: params.codigo_origem_6,
      numero_cpf_certificado: params.numero_cpf_certificado
    }
    return this.authenticatedRequest<any>('/marketplace/worker-payroll-loan-offers/include', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }

  /**
   * Testa a conexão com a API C6 Bank (obtém token).
   * Usado pelo botão "Testar" na configuração de APIs.
   */
  async testConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    const token = await this.getAuthToken()
    if (token) {
      return {
        success: true,
        data: { connected: true, message: 'Conexão com C6 Bank estabelecida com sucesso.' }
      }
    }
    const loginResult = await this.login()
    return {
      success: false,
      error: loginResult.error,
      data: {
        connected: false,
        message: loginResult.error || 'Falha ao conectar no C6 Bank.'
      }
    }
  }
}
