import type { ApiResponse } from './api-client'

/**
 * registro para a API Nossa Fintech
 * Documentação: https://nossa-fintech-doc.spixiiservices.com.br/docs/intro
 */
export class NossaFintechClient {
  private baseUrl: string
  private cpf: string
  private promotId: number | string | undefined
  private password: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private readonly timeout = 30000 // 30 segundos

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.REDACTED || 'https://nossa-fintech-api.spixiiservices.com.br'
    // Remove trailing slash se houver
    this.baseUrl = this.baseUrl.replace(/\/$/, '')
    
    // Tenta obter variáveis de ambiente com e sem prefixo NEXT_PUBLIC_
    const getEnv = (key: string, defaultValue: string = ''): string => {
      if (typeof window === 'undefined') {
        return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      } else {
        return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
    }
    
    this.cpf = getEnv('NOSSA_FINTECH_API_CPF', '')
    const promotIdEnv = getEnv('NOSSA_FINTECH_API_PROMOT_ID', '')
    // Converte promot_id para número, tratando "001" como 1
    if (promotIdEnv) {
      const parsed = parseInt(promotIdEnv, 10)
      this.promotId = isNaN(parsed) ? promotIdEnv : parsed
    } else {
      this.promotId = undefined
    }
    this.password = getEnv('NOSSA_FINTECH_API_PASSWORD', '')
  }

  /**
   * Atualiza credenciais e URL base
   */
  updateCredentials(cpf?: string, password?: string, baseUrl?: string, promotId?: string | number) {
    if (cpf) this.cpf = cpf
    if (password) this.password = password
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '')
    }
    if (promotId !== undefined && promotId !== null && promotId !== '') {
      const oldPromotId = this.promotId
      // Converte promot_id para número, tratando "001" como 1
      if (typeof promotId === 'string') {
        const parsed = parseInt(promotId, 10)
        this.promotId = isNaN(parsed) ? promotId : parsed
      } else {
        this.promotId = promotId
      }
      console.log('[NossaFintechClient] Promot ID atualizado:', oldPromotId, '->', this.promotId, '(tipo:', typeof this.promotId, ')')
    } else {
      console.log('[NossaFintechClient] Promot ID não fornecido ou vazio:', promotId)
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
   * Faz login na API
   */
  private async login(): Promise<ApiResponse<string>> {
    try {
      if (!this.cpf || !this.password) {
        return {
          success: false,
          error: 'Credenciais não configuradas. Configure CPF e password da API Nossa Fintech'
        }
      }
      
      // Se não tiver promot_id, retorna erro específico
      console.log('[NossaFintechClient] Verificando Promot ID para login. Valor atual:', this.promotId, 'Tipo:', typeof this.promotId)
      if (!this.promotId || this.promotId === '') {
        console.error('[NossaFintechClient] Promot ID não configurado!')
        return {
          success: false,
          error: 'Promot ID não configurado. Configure a variável de ambiente NOSSA_FINTECH_API_PROMOT_ID ou atualize as credenciais da API com o Promot ID.'
        }
      }
      
      // Converte promot_id para número se for string (trata "001" como 1)
      let promotIdNum: number | string
      if (typeof this.promotId === 'string') {
        const parsed = parseInt(this.promotId, 10)
        promotIdNum = isNaN(parsed) ? this.promotId : parsed
      } else {
        promotIdNum = this.promotId
      }

      const loginPayload = {
        cpf: this.cpf,
        promot_id: promotIdNum,
        password: this.password,
      }
      
      console.log('[NossaFintechClient] Fazendo login na API:', `${this.baseUrl}/auth/login`)
      console.log('[NossaFintechClient] Payload do login:', JSON.stringify({ ...loginPayload, password: '***' }, null, 2))
      console.log('[NossaFintechClient] Promot ID sendo enviado:', promotIdNum, '(tipo:', typeof promotIdNum, ')')

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginPayload),
      })

      console.log('[NossaFintechClient] Resposta do login - Status:', response.status, response.statusText)

      if (!response.ok) {
        let errorData: any
        try {
          const responseText = await response.text()
          console.error('[NossaFintechClient] Erro no login - Resposta completa:', responseText)
          try {
            errorData = JSON.parse(responseText)
          } catch {
            errorData = { message: responseText || response.statusText }
          }
        } catch (error) {
          errorData = { message: response.statusText }
        }
        console.error('[NossaFintechClient] Erro no login Nossa Fintech:', response.status, errorData)
        return {
          success: false,
          error: errorData.message || errorData.error || `Erro ${response.status}: ${response.statusText}`,
        }
      }

      let data: any
      try {
        const responseText = await response.text()
        console.log('[NossaFintechClient] Resposta do login (texto):', responseText)
        data = JSON.parse(responseText)
        console.log('[NossaFintechClient] Resposta do login (JSON):', JSON.stringify(data, null, 2))
      } catch (parseError: any) {
        console.error('[NossaFintechClient] Erro ao fazer parse da resposta:', parseError)
        return {
          success: false,
          error: 'Erro ao processar resposta da API de login',
        }
      }

      // Verifica diferentes formatos possíveis de resposta
      const accessToken = data.access_token || data.accessToken || data.token || data.data?.access_token || data.data?.accessToken || data.data?.token
      
      if (!accessToken) {
        console.error('[NossaFintechClient] Erro no login - resposta sem token')
        console.error('[NossaFintechClient] Estrutura completa da resposta:', JSON.stringify(data, null, 2))
        console.error('[NossaFintechClient] Campos disponíveis na resposta:', Object.keys(data))
        return {
          success: false,
          error: data.message || data.error || 'Erro ao obter token de autenticação. A resposta da API não contém access_token.',
        }
      }

      console.log('[NossaFintechClient] Token obtido com sucesso! (tamanho:', accessToken.length, 'caracteres)')
      this.accessToken = accessToken
      
      // Verifica expires_in em diferentes formatos possíveis
      const expiresIn = data.expires_in || data.expiresIn || data.expires || data.data?.expires_in || data.data?.expiresIn
      
      // Se a API retornar expiração, usa ela. Caso contrário, assume 1 hora
      if (expiresIn) {
        const expiresInSeconds = typeof expiresIn === 'number' ? expiresIn : parseInt(expiresIn, 10)
        this.tokenExpiration = new Date(Date.now() + expiresInSeconds * 1000)
        console.log('[NossaFintechClient] Token expira em:', expiresInSeconds, 'segundos')
      } else {
        // Padrão: token válido por 1 hora
        this.tokenExpiration = new Date(Date.now() + 60 * 60 * 1000)
        console.log('[NossaFintechClient] Token expira em: 1 hora (padrão)')
      }

      console.log('[NossaFintechClient] Login Nossa Fintech realizado com sucesso!')
      console.log('[NossaFintechClient] Token armazenado:', this.accessToken ? 'SIM' : 'NÃO')
      console.log('[NossaFintechClient] Expiração:', this.tokenExpiration?.toISOString())

      return {
        success: true,
        data: this.accessToken || undefined,
      }
    } catch (error: any) {
      console.error('Erro ao fazer login na API Nossa Fintech:', error)
      return {
        success: false,
        error: error.message || 'Erro ao fazer login',
      }
    }
  }

  /**
   * Obtém o token de autenticação (faz login se necessário)
   */
  private async getAuthToken(): Promise<string | null> {
    console.log('[NossaFintechClient] Verificando token de autenticação...')
    console.log('[NossaFintechClient] Token atual:', this.accessToken ? 'EXISTE' : 'NÃO EXISTE')
    console.log('[NossaFintechClient] Expiração:', this.tokenExpiration?.toISOString() || 'NÃO DEFINIDA')
    
    if (this.isTokenValid()) {
      console.log('[NossaFintechClient] Token ainda é válido, reutilizando')
      return this.accessToken
    }

    console.log('[NossaFintechClient] Token inválido ou expirado, fazendo novo login...')
    const loginResult = await this.login()
    
    if (!loginResult.success) {
      console.error('[NossaFintechClient] Falha no login:', loginResult.error)
      return null
    }

    console.log('[NossaFintechClient] Token obtido após login:', this.accessToken ? 'SIM' : 'NÃO')
    return this.accessToken
  }

  /**
   * Faz uma requisição autenticada
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    customTimeout?: number
  ): Promise<ApiResponse<T>> {
    const requestTimeout = customTimeout || this.timeout
    const token = await this.getAuthToken()
    if (!token) {
      console.error('Erro: Token não obtido. Verifique as credenciais')
      return {
        success: false,
        error: 'Não foi possível autenticar. Verifique as credenciais.',
      }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

      const fullUrl = `${this.baseUrl}${endpoint}`
      console.log('[NossaFintechClient] Fazendo requisição:', options.method || 'GET', fullUrl)
      console.log('[NossaFintechClient] Headers:', JSON.stringify(headers, null, 2))
      
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log('[NossaFintechClient] Resposta recebida:', response.status, response.statusText)

      if (!response.ok) {
        let errorMessage = `Erro ${response.status}: ${response.statusText}`
        let errorData: any = null
        try {
          const responseText = await response.text()
          console.log('[NossaFintechClient] Corpo da resposta de erro (status', response.status, '):', responseText)
          try {
            errorData = JSON.parse(responseText)
            errorMessage = errorData.message || errorData.error || errorMessage
            // Se houver erros em array, adiciona
            if (errorData.errors && Array.isArray(errorData.errors)) {
              errorMessage += ': ' + errorData.errors.join(', ')
            }
            // Se houver detalhes adicionais
            if (errorData.detail) {
              errorMessage += ` - ${errorData.detail}`
            }
          } catch (parseError) {
            // Se não conseguir fazer parse JSON, usa o texto como erro
            if (responseText) {
              errorMessage += ` - ${responseText.substring(0, 200)}`
            }
          }
        } catch (textError) {
          console.error('[NossaFintechClient] Erro ao ler corpo da resposta:', textError)
        }

        return {
          success: false,
          error: errorMessage,
        }
      }

      const data = await response.json()
      
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('Erro na requisição Nossa Fintech:', error)
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Timeout: A requisição demorou muito para responder',
        }
      }
      return {
        success: false,
        error: error.message || 'Erro ao fazer requisição à API',
      }
    }
  }

  /**
   * Cria autorização CLT para o registro
   * Endpoint: POST /clt-loan/v1/request-authorization
   * 
   * Campos obrigatórios conforme documentação:
   * - document_number: CPF do registro
   * - person_name: Nome completo
   * - country_code: Código do país (ex: "55" para Brasil)
   * - area_code: DDD (ex: "73")
   * - phone_number: Número do telefone (sem DDD)
   * - notification_method: "sms"
   * - service_type: Código da bancarizadora (ex: "QITECH")
   */
  async autorizarCLT(
    cpf: string,
    nomeCompleto: string,
    telefone: string,
    serviceType: string
  ): Promise<ApiResponse> {
    if (!cpf || cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    if (!nomeCompleto || nomeCompleto.trim() === '') {
      return {
        success: false,
        error: 'Nome completo é obrigatório',
      }
    }

    if (!telefone || telefone.trim() === '') {
      return {
        success: false,
        error: 'Telefone é obrigatório',
      }
    }

    // Remove formatação do CPF
    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')

    // Processa telefone: extrai DDD e número
    // Aceita formatos: (99)99999-9999, 99999999999, 9999999999, etc
    const telefoneLimpo = telefone.replace(/\D/g, '')
    let areaCode = '99' // DDD padrão
    let phoneNumber = telefoneLimpo

    // Se o telefone tem 10 ou 11 dígitos, assume que os 2 primeiros são o DDD
    if (telefoneLimpo.length >= 10) {
      areaCode = telefoneLimpo.substring(0, 2)
      phoneNumber = telefoneLimpo.substring(2)
    } else if (telefoneLimpo.length >= 8) {
      // Se tem 8 ou 9 dígitos, usa DDD padrão
      phoneNumber = telefoneLimpo
    } else {
      // Se não tem telefone válido, usa padrão
      areaCode = '99'
      phoneNumber = '999999999'
    }

    const endpoint = `/clt-loan/v1/request-authorization`
    const fullUrl = `${this.baseUrl}${endpoint}`
    console.log('[NossaFintechClient] Criando autorização CLT - URL completa:', fullUrl)
    console.log('[NossaFintechClient] CPF:', cpfLimpo)
    console.log('[NossaFintechClient] Nome:', nomeCompleto)
    console.log('[NossaFintechClient] DDD:', areaCode, 'Telefone:', phoneNumber)

    // Payload conforme documentação
    const payload = {
      document_number: cpfLimpo,
      person_name: nomeCompleto.trim(),
      country_code: '55', // Brasil
      area_code: areaCode,
      phone_number: phoneNumber,
      notification_method: 'sms',
      service_type: serviceType || 'QITECH'
    }
    
    console.log('[NossaFintechClient] Payload autorização:', JSON.stringify(payload, null, 2))

    // Faz requisição POST
    const result = await this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    
    console.log('[NossaFintechClient] Resultado da autorização:', JSON.stringify(result, null, 2))
    
    return result
  }

  /**
   * Verifica status da autorização CLT
   * Endpoint: POST /clt-loan/v1/check-authorization
   * 
   * Campos obrigatórios conforme documentação:
   * - document_number: CPF do registro
   * - service_type: Código da bancarizadora (ex: "QITECH")
   * 
   * Retorna: "AUTHORIZED", "PENDING" ou "NOT_AUTHORIZED"
   */
  async verificarStatusAutorizacao(
    cpf: string,
    serviceType: string
  ): Promise<ApiResponse> {
    if (!cpf || cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    // Remove formatação do CPF
    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')

    const endpoint = `/clt-loan/v1/check-authorization`
    const fullUrl = `${this.baseUrl}${endpoint}`
    console.log('[NossaFintechClient] Verificando status autorização CLT - URL completa:', fullUrl)
    console.log('[NossaFintechClient] CPF:', cpfLimpo)
    console.log('[NossaFintechClient] Service Type:', serviceType || 'QITECH')

    // Payload conforme documentação
    const payload = {
      document_number: cpfLimpo,
      service_type: serviceType || 'QITECH'
    }
    
    console.log('[NossaFintechClient] Payload verificação status:', JSON.stringify(payload, null, 2))

    // Faz requisição POST
    const result = await this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    
    console.log('[NossaFintechClient] Resultado verificação status:', JSON.stringify(result, null, 2))
    
    // Se a resposta foi bem-sucedida, tenta extrair o status de diferentes formas
    if (result.success && result.data) {
      const data = result.data as any
      // Tenta diferentes caminhos para encontrar o status
      const possibleStatus = data.status || 
                            data.data?.status ||
                            data.authorization_status ||
                            data.data?.authorization_status ||
                            (typeof data === 'string' ? data : null) ||
                            (typeof data.data === 'string' ? data.data : null)
      
      if (possibleStatus) {
        console.log('[NossaFintechClient] Status extraído da resposta:', possibleStatus)
        // Normaliza e retorna com o status explícito
        return {
          ...result,
          data: {
            ...result.data,
            status: String(possibleStatus).toUpperCase().trim()
          }
        }
      } else {
        console.warn('[NossaFintechClient] Status não encontrado na resposta. Estrutura completa:', JSON.stringify(result.data, null, 2))
      }
    }
    
    return result
  }

  /**
   * Consulta margem/vínculos CLT
   * Endpoint: POST /clt-loan/v1/get-margin
   * 
   * Campos:
   * - document_number: CPF do trabalhador (obrigatório)
   * - service_type: Código da bancarizadora (padrão QITECH)
   * - employer_document: CNPJ do empregador (opcional — a API localiza o vínculo só com o CPF)
   */
  async consultarVinculosCLT(
    cpfTrabalhador: string,
    cnpjEmpregador?: string,
    serviceType?: string,
    _telefone?: string
  ): Promise<ApiResponse> {
    if (!cpfTrabalhador || cpfTrabalhador.trim() === '') {
      return {
        success: false,
        error: 'CPF do trabalhador é obrigatório',
      }
    }

    // Remove formatação do CPF
    const cpfLimpo = cpfTrabalhador.replace(/\D/g, '').padStart(11, '0')

    // Remove formatação do CNPJ se fornecido
    const cnpjLimpo = cnpjEmpregador ? cnpjEmpregador.replace(/\D/g, '').padStart(14, '0') : undefined

    // Valida CNPJ se fornecido
    if (cnpjLimpo && cnpjLimpo.length !== 14) {
      return {
        success: false,
        error: 'CNPJ do empregador inválido (deve ter 14 dígitos)',
      }
    }

    // Endpoint correto: POST /clt-loan/v1/get-margin
    const endpoint = `/clt-loan/v1/get-margin`
    const fullUrl = `${this.baseUrl}${endpoint}`
    console.log('[NossaFintechClient] Consultando margem CLT - URL completa:', fullUrl)
    console.log('[NossaFintechClient] CPF:', cpfLimpo)
    console.log('[NossaFintechClient] CNPJ Empregador:', cnpjLimpo || 'NÃO FORNECIDO')
    console.log('[NossaFintechClient] Service Type:', serviceType || 'NÃO FORNECIDO')

    // https://nossa-fintech-doc.spixiiservices.com.br/docs/nossa-fintech-clt/consulta-margem
    const payload: Record<string, string> = {
      document_number: cpfLimpo,
      service_type: (serviceType || 'QITECH').trim() || 'QITECH',
    }

    if (cnpjLimpo) {
      payload.employer_document = cnpjLimpo
    }
    
    console.log('[NossaFintechClient] Payload (conforme documentação oficial):', JSON.stringify(payload, null, 2))

    // Faz requisição POST com payload correto
    const result = await this.authenticatedRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    
    console.log('[NossaFintechClient] Resultado da consulta de margem:', JSON.stringify(result, null, 2))
    
    return result
  }

  /**
   * Lista tabelas de rebates disponíveis para simulação CLT
   * Endpoint: GET /clt-loan/v1/list-rebates
   */
  async listarTabelasCLT(): Promise<ApiResponse> {
    const endpoint = `/clt-loan/v1/list-rebates`
    console.log('[NossaFintechClient] Listando tabelas CLT - URL completa:', `${this.baseUrl}${endpoint}`)
    
    const result = await this.authenticatedRequest(endpoint, {
      method: 'GET',
    })
    
    console.log('[NossaFintechClient] Resultado da listagem de tabelas:', JSON.stringify(result, null, 2))
    return result
  }

  /**
   * Simula propostas CLT
   * Endpoint: POST /clt-loan/v1/simulate-loan
   * 
   * Documentação: https://nossa-fintech-doc.spixiiservices.com.br/docs/nossa-fintech-clt/simulacao/simulacao-clt
   * 
   * Campos obrigatórios:
   * - margin_key: Obtido da consulta de margem
   * - simulation_type: "Payment" (valor da parcela) ou "Liquid" (valor liberado)
   * - employer_document: CNPJ do empregador
   * - requested_amount: Valor da parcela ou valor liberado
   * - service_type: Código da bancarizadora
   * - cod_tabela: Código da tabela obtido da listagem de tabelas
   */
  async simularCLT(params: {
    marginKey: string
    simulationType: 'Payment' | 'Liquid'
    employerDocument: string
    requestedAmount: number
    serviceType: string
    codTabela: string
  }): Promise<ApiResponse> {
    // Validações
    if (!params.marginKey) {
      return {
        success: false,
        error: 'margin_key é obrigatório. Obtenha-o através da consulta de margem.',
      }
    }

    if (!params.simulationType || !['Payment', 'Liquid'].includes(params.simulationType)) {
      return {
        success: false,
        error: 'simulation_type é obrigatório e deve ser "Payment" ou "Liquid"',
      }
    }

    if (!params.employerDocument) {
      return {
        success: false,
        error: 'employer_document (CNPJ do empregador) é obrigatório',
      }
    }

    if (!params.requestedAmount || params.requestedAmount <= 0) {
      return {
        success: false,
        error: 'requested_amount deve ser maior que zero',
      }
    }

    if (!params.serviceType) {
      return {
        success: false,
        error: 'service_type é obrigatório',
      }
    }

    if (!params.codTabela) {
      return {
        success: false,
        error: 'cod_tabela é obrigatório. Obtenha-o através da listagem de tabelas.',
      }
    }

    // Limpa e formata dados
    const cnpjLimpo = params.employerDocument.replace(/\D/g, '').padStart(14, '0')

    // Valida CNPJ
    if (cnpjLimpo.length !== 14) {
      return {
        success: false,
        error: 'CNPJ do empregador inválido (deve ter 14 dígitos)',
      }
    }

    // Payload conforme documentação oficial
    const payload = {
      margin_key: params.marginKey,
      simulation_type: params.simulationType,
      employer_document: cnpjLimpo,
      requested_amount: Number(params.requestedAmount),
      service_type: params.serviceType,
      cod_tabela: params.codTabela,
    }

    console.log('[NossaFintechClient] Simulando CLT - Payload:', JSON.stringify(payload, null, 2))
    
    const endpoint = `/clt-loan/v1/simulate-loan`
    const fullUrl = `${this.baseUrl}${endpoint}`
    console.log('[NossaFintechClient] Simulando CLT - URL completa:', fullUrl)
    
    try {
      // Simulações CLT podem demorar mais tempo, então aumentamos o timeout para 2 minutos
      const result = await this.authenticatedRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 120000) // 120 segundos (2 minutos)
      
      console.log('[NossaFintechClient] Resultado da simulação CLT:', JSON.stringify(result, null, 2))
      return result
    } catch (error: any) {
      console.error('[NossaFintechClient] Erro ao simular CLT:', error)
      return {
        success: false,
        error: error.message || 'Erro ao simular proposta CLT',
      }
    }
  }

  /**
   * Consulta saldo FGTS
   * Implementado conforme documentação disponível
   */
  async consultarSaldoFGTS(cpf: string): Promise<ApiResponse> {
    if (!cpf || cpf.trim() === '') {
      return {
        success: false,
        error: 'CPF é obrigatório',
      }
    }

    const cpfLimpo = cpf.replace(/\D/g, '').padStart(11, '0')

    // TODO: Ajustar endpoint conforme documentação quando disponível
    return this.authenticatedRequest(`/fgts/saldo?cpf=${encodeURIComponent(cpfLimpo)}`, {
      method: 'GET',
    })
  }

  /**
   * Testa a conexão com a API
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
            message: 'Conexão com a API Nossa Fintech estabelecida com sucesso',
          },
        }
      } else {
        return {
          success: false,
          data: {
            connected: false,
            message: loginResult.error || 'Não foi possível conectar à API Nossa Fintech',
          },
          error: loginResult.error,
        }
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão com Nossa Fintech:', error)
      return {
        success: false,
        data: {
          connected: false,
          message: error.message || 'Erro ao testar conexão com a API Nossa Fintech',
        },
        error: error.message || 'Erro desconhecido ao testar conexão',
      }
    }
  }
}
