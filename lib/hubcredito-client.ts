/**
 * registro específico para API HubCredito
 * Gerencia autenticação automática e endpoints específicos
 */

interface LoginResponse {
  value: {
    id: string
    nome: string
    cpf: string
    tipoUsuario: string
    lojistaId: number
    token: {
      accessToken: string
      expiration: string
    }
    lojasAtivas: Array<{
      lojaId: number
      nomeLoja: string
      nomeLojista: string
      filaSimulacaoAtiva: boolean
      qtdFilaSimulacaoPorDia: number
      qtdFilaSimulacaoPorDiaAPI: number
    }>
  }
  hasSuccess: boolean
  hasError: boolean
  errors: string[]
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface UserInfo {
  id: string
  nome: string
  cpf: string
  tipoUsuario: string
  lojistaId: number
  lojasAtivas: Array<{
    lojaId: number
    nomeLoja: string
    nomeLojista: string
    filaSimulacaoAtiva: boolean
    qtdFilaSimulacaoPorDia: number
    qtdFilaSimulacaoPorDiaAPI: number
  }>
}

export class HubCreditoClient {
  private baseUrl: string
  private username: string
  private password: string
  private accessToken: string | null = null
  private tokenExpiration: Date | null = null
  private userInfo: UserInfo | null = null
  private lastAuthError: string | null = null
  private timeout: number = 30000
  private readonly DEFAULT_LOJA_ID = 15377
  private readonly DEFAULT_CALLBACK_URL = 'https://webhook.site/'

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      process.env.REDACTED ||
      'https://api.hubcredito.com.br/api'
    // Prioriza variáveis específicas da Hub para evitar conflito com outras integrações.
    this.username =
      process.env.REDACTED ||
      ''
    this.password =
      process.env.REDACTED ||
      ''
  }

  /**
   * Atualiza credenciais e URL base
   */
  updateCredentials(username?: string, password?: string, baseUrl?: string) {
    if (username) this.username = username
    if (password) this.password = password
    if (baseUrl) this.baseUrl = baseUrl
    // Limpa token para forçar novo login
    this.accessToken = null
    this.userInfo = null
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
  private normalizeHubAuthError(rawError: unknown): string {
    const raw = typeof rawError === 'string' ? rawError : JSON.stringify(rawError || {})
    const rawLower = raw.toLowerCase()

    const isRoleAssignmentError =
      raw.includes('AADSTS501051') ||
      rawLower.includes('is not assigned to a role for the application')

    if (isRoleAssignmentError) {
      return 'Usuário sem permissão na aplicação da Hub Crédito (AADSTS501051). Solicite à Hub o vínculo de role para este login no app de integração.'
    }

    return raw
  }

  private sanitizeHubErrorMessage(rawError: unknown): string {
    const normalized = this.normalizeHubAuthError(rawError)
    if (
      normalized.includes('AADSTS501051') ||
      normalized.toLowerCase().includes('is not assigned to a role for the application')
    ) {
      return normalized
    }

    return typeof rawError === 'string' ? rawError : normalized
  }

  private async login(): Promise<ApiResponse<string>> {
    try {
      if (!this.username || !this.password) {
        this.lastAuthError =
          'Credenciais não configuradas. Configure HUBCREDITO_API_USERNAME e HUBCREDITO_API_PASSWORD no arquivo .env.local'
        return {
          success: false,
          error: this.lastAuthError,
        }
      }

      const response = await fetch(`${this.baseUrl}/Login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: this.username,
          password: this.password,
          grantTypes: 'password',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        console.error('Erro no login:', response.status, errorData)
        const normalizedError = this.normalizeHubAuthError(errorData)
        this.lastAuthError =
          normalizedError !== '{}' ? normalizedError : `Erro ${response.status}: ${response.statusText}`
        return {
          success: false,
          error:
            normalizedError !== '{}'
              ? normalizedError
              : errorData.message || errorData.errors?.[0] || `Erro ${response.status}: ${response.statusText}`,
        }
      }

      const data: LoginResponse = await response.json()

      if (!data.hasSuccess || !data.value?.token?.accessToken) {
        const errorMsg = this.normalizeHubAuthError(data.errors?.[0] || data || 'Erro ao obter token de autenticação')
        this.lastAuthError = errorMsg
        console.error('Erro no login - resposta:', JSON.stringify(data, null, 2))
        return {
          success: false,
          error: errorMsg,
        }
      }

      this.accessToken = data.value.token.accessToken
      this.tokenExpiration = new Date(data.value.token.expiration)
      this.lastAuthError = null
      
      // Armazena informações do usuário
      this.userInfo = {
        id: data.value.id,
        nome: data.value.nome || 'Usuário',
        cpf: data.value.cpf || '',
        tipoUsuario: data.value.tipoUsuario || 'Usuário',
        lojistaId: data.value.lojistaId,
        lojasAtivas: data.value.lojasAtivas || [],
      }

      console.log('Login realizado com sucesso. Usuário:', this.userInfo.nome)

      return {
        success: true,
        data: this.accessToken,
      }
    } catch (error: any) {
      console.error('Erro ao fazer login:', error)
      this.lastAuthError = this.normalizeHubAuthError(error?.message || error)
      return {
        success: false,
        error: this.lastAuthError || 'Erro ao fazer login',
      }
    }
  }

  /**
   * Obtém o token de autenticação (faz login se necessário)
   */
  private async getAuthToken(): Promise<string | null> {
    if (this.isTokenValid()) {
      return this.accessToken
    }

    const loginResult = await this.login()
    if (!loginResult.success) {
      return null
    }

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
      console.error('Erro: Token não obtido. Verifique as credenciais no .env.local')
      return {
        success: false,
        error:
          this.lastAuthError ||
          'Não foi possível autenticar na Hub. Verifique HUBCREDITO_API_USERNAME/HUBCREDITO_API_PASSWORD no .env.local.',
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

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Tenta ler o erro da resposta ANTES de fazer qualquer retry
        let errorMessage = `Erro ${response.status}: ${response.statusText}`
        let errorData: any = null
        
        try {
          const responseText = await response.text()
          if (responseText) {
            try {
              errorData = JSON.parse(responseText)
            } catch {
              errorMessage = responseText || errorMessage
            }
          }
        } catch (e) {
          // Se não conseguir ler, usa a mensagem padrão
        }

        // Processa a mensagem de erro
        if (errorData) {
          if (errorData.message) {
            errorMessage = this.sanitizeHubErrorMessage(errorData.message)
          } else if (errorData.errors && Array.isArray(errorData.errors)) {
            errorMessage = this.sanitizeHubErrorMessage(errorData.errors.join(', '))
          } else if (typeof errorData === 'string') {
            errorMessage = this.sanitizeHubErrorMessage(errorData)
          } else if (errorData.value) {
            errorMessage = this.sanitizeHubErrorMessage(String(errorData.value))
          } else {
            errorMessage = this.sanitizeHubErrorMessage(JSON.stringify(errorData))
          }
        }

        // Se for erro 401 (Unauthorized), tenta renovar o token e fazer a requisição novamente
        if (response.status === 401) {
          console.log('Token expirado ou inválido. Tentando renovar...')
          // Limpa o token atual para forçar novo login
          this.accessToken = null
          this.tokenExpiration = null
          
          // Tenta fazer login novamente
          const newToken = await this.getAuthToken()
          if (newToken) {
            // Cria novo controller para o retry
            const retryController = new AbortController()
            const retryTimeoutId = setTimeout(() => retryController.abort(), requestTimeout)
            
            try {
              // Refaz a requisição com o novo token
              const retryHeaders: HeadersInit = {
                ...headers,
                Authorization: `Bearer ${newToken}`,
              }
              
              const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: retryHeaders,
                signal: retryController.signal,
              })
              
              clearTimeout(retryTimeoutId)
              
              if (retryResponse.ok) {
                const retryData = await retryResponse.json()
                return {
                  success: true,
                  data: retryData,
                }
              } else {
                // Se ainda falhar, tenta ler o erro
                let retryErrorMessage = 'Não autorizado após renovar token'
                try {
                  const retryErrorData = await retryResponse.json().catch(() => null)
                  if (retryErrorData) {
                    if (retryErrorData.message) retryErrorMessage = this.sanitizeHubErrorMessage(retryErrorData.message)
                    else if (retryErrorData.errors && Array.isArray(retryErrorData.errors)) {
                      retryErrorMessage = this.sanitizeHubErrorMessage(retryErrorData.errors.join(', '))
                    }
                  }
                } catch (e) {
                  // Usa mensagem padrão
                }
                return {
                  success: false,
                  error:
                    this.sanitizeHubErrorMessage(retryErrorMessage) ||
                    'Erro de autenticação. Verifique as credenciais no arquivo .env.local (NEXT_PUBLIC_API_USERNAME e NEXT_PUBLIC_API_PASSWORD).',
                }
              }
            } catch (retryError: any) {
              clearTimeout(retryTimeoutId)
              return {
                success: false,
                error: 'Erro ao tentar renovar autenticação. Verifique as credenciais.',
              }
            }
          }
          
          // Se não conseguiu renovar o token
          const errorData = await response.json().catch(() => ({ message: 'Não autorizado. Verifique as credenciais.' }))
          return {
            success: false,
            error:
              this.sanitizeHubErrorMessage(errorData.message) ||
              'Erro de autenticação. Verifique as credenciais no arquivo .env.local (NEXT_PUBLIC_API_USERNAME e NEXT_PUBLIC_API_PASSWORD).',
          }
        }
        
        // Retorna o erro já lido acima
        return {
          success: false,
          error: errorMessage,
        }
      }

      const data = await response.json()
      
      // Verifica se a resposta indica erro (HubCredito usa hasError ou errors)
      if (data.hasError === true || (data.errors && Array.isArray(data.errors) && data.errors.length > 0)) {
        const errorMessage = data.errors && Array.isArray(data.errors) 
          ? data.errors.join(', ') 
          : data.message || 'Erro na resposta da API'
        return {
          success: false,
          error: errorMessage,
          data: data // Mantém os dados para debug se necessário
        }
      }
      
      return {
        success: true,
        data,
      }
    } catch (error: any) {
      console.error('Erro na requisição:', error)
      return {
        success: false,
        error: error.message || 'Erro ao fazer requisição à API',
      }
    }
  }

  /**
   * Consulta propostas
   */
  async consultarPropostas(cpf?: string): Promise<ApiResponse> {
    const queryParam = cpf ? `?cpf=${encodeURIComponent(cpf)}` : '?cpf=null'
    return this.authenticatedRequest(`/proposta/painelV3${queryParam}`, {
      method: 'GET',
    })
  }

  /**
   * Cadastra simulação em massa
   */
  async cadastrarSimulacao(params: {
    usuarioId: string
    lojaId: number
    cpfs: string[]
    callbackUrl?: string
  }): Promise<ApiResponse> {
    return this.authenticatedRequest('/FilaSImulacao/cadastrar-em-massa', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Quando a API exige "pré simulação" antes de listar vínculos,
   * dispara uma pré-simulação mínima para o CPF e permite retentativa.
   */
  private async executarPreSimulacaoParaVinculos(cpfTrabalhador: string): Promise<ApiResponse> {
    // Garante token + userInfo carregados
    const token = await this.getAuthToken()
    if (!token || !this.userInfo?.id) {
      return {
        success: false,
        error: 'Não foi possível autenticar para executar pré simulação'
      }
    }

    const lojaIdEnv = Number(process.env.REDACTED || process.env.REDACTED || '')
    const lojaId =
      Number.isFinite(lojaIdEnv) && lojaIdEnv > 0
        ? lojaIdEnv
        : this.userInfo.lojasAtivas?.[0]?.lojaId || this.DEFAULT_LOJA_ID
    const callbackUrl =
      process.env.REDACTED ||
      process.env.REDACTED ||
      this.DEFAULT_CALLBACK_URL

    return this.cadastrarSimulacao({
      usuarioId: this.userInfo.id,
      lojaId,
      cpfs: [cpfTrabalhador],
      callbackUrl,
    })
  }

  /**
   * Obtém dados de uma simulação
   */
  async obterSimulacao(id: string): Promise<ApiResponse> {
    return this.authenticatedRequest(`/FilaSImulacao/${id}`, {
      method: 'GET',
    })
  }

  /**
   * Consulta vínculos de trabalho CLT
   */
  async consultarVinculosCLT(cpfTrabalhador: string): Promise<ApiResponse> {
    if (!cpfTrabalhador || cpfTrabalhador.trim() === '') {
      return {
        success: false,
        error: 'CPF do trabalhador é obrigatório',
      }
    }
    const cpfDigits = String(cpfTrabalhador).replace(/\D/g, '')
    const primeiraTentativa = await this.authenticatedRequest(`/Clt/wincred/listar-vinculos?cpfTrabalhador=${encodeURIComponent(cpfDigits)}`, {
      method: 'GET',
    })

    // Hub pode exigir "pré simulação" antes da consulta de vínculos.
    const erroTexto = String(primeiraTentativa.error || '').toLowerCase()
    const exigePreSimulacao =
      erroTexto.includes('pré simulação') ||
      erroTexto.includes('pre simulacao') ||
      erroTexto.includes('pre-simulacao')

    if (!primeiraTentativa.success && exigePreSimulacao) {
      const pre = await this.executarPreSimulacaoParaVinculos(cpfDigits)
      if (!pre.success) {
        const erroPre = String(pre.error || '').toLowerCase()
        if (erroPre.includes('callbackurl') || erroPre.includes('callback url')) {
          return {
            success: false,
            error:
              'A Hub exige CallbackUrl na pré-simulação. Configure HUBCREDITO_CALLBACK_URL (.env.local) com uma URL válida e tente novamente.',
          }
        }

        if (erroPre.includes('quantidade maxima') || erroPre.includes('fila por dia foi atingida')) {
          return {
            success: false,
            error:
              'A conta da Hub atingiu (ou está zerada em) cota diária de fila para API. Solicite à Hub aumento/liberação da "qtdFilaSimulacaoPorDiaAPI".',
          }
        }

        return {
          success: false,
          error: pre.error || primeiraTentativa.error || 'Falha ao executar pré-simulação exigida pela Hub.',
        }
      }

      // Pequeno intervalo para a Hub consolidar a pré simulação antes da nova leitura.
      await new Promise((resolve) => setTimeout(resolve, 1200))

      return this.authenticatedRequest(`/Clt/wincred/listar-vinculos?cpfTrabalhador=${encodeURIComponent(cpfDigits)}`, {
        method: 'GET',
      })
    }

    return primeiraTentativa
  }

  /**
   * Gera ou verifica termo de aceite CLT
   */
  async gerarTermoAceiteCLT(params: {
    lojaId: number
    nome: string
    cpf: string
    email: string
    telefone: string
    dataNascimento: string
    sexo: string
  }): Promise<ApiResponse> {
    return this.authenticatedRequest('/Clt/gerar-termo-aceite', {
      method: 'POST',
      body: JSON.stringify({
        tipoTermo: 'AutorizacaoDataprev',
        ...params,
      }),
    })
  }

  /**
   * Simula propostas CLT
   */
  async simularCLT(params: {
    cpf: string
    lojaId: number
    idCotacao: string
    numeroParcelas: number
    valor: number
    matricula: string
    codigoInscricaoEmpregador: number
    numeroInscricaoEmpregador: string
  }): Promise<ApiResponse> {
    // Simulações CLT podem demorar mais tempo, então aumentamos o timeout para 2 minutos
    return this.authenticatedRequest('/Clt/wincred/simular', {
      method: 'POST',
      body: JSON.stringify(params),
    }, 120000) // 120 segundos (2 minutos)
  }

  /**
   * Envia proposta CLT para aprovação
   */
  async enviarPropostaCLT(params: {
    lojaId: number
    cpfAtendente: string
    cpfCliente: string
    dataPrimeiraParcela: string
    valorVista: number
    valorBruto: number
    tabelaComercial: number
    plano: number
    valorParcela: number
    SimulacaoId: string
    valorTac: number
    contaBancaria: {
      banco: number
      agencia: number
      digitoAgencia: string
      conta: number
      digitoConta: string
      tipoContaBancaria: number
    }
    chavePix: {
      tipoChave: string
      valorChave: string
    }
    registro: {
      documento: string
      nome: string
      pessoaFisica: any
      enderecos: any[]
      telefones: any[]
    }
  }): Promise<ApiResponse> {
    return this.authenticatedRequest('/proposta', {
      method: 'POST',
      body: JSON.stringify({
        bancarizador: 'Socinal',
        tipoOperacao: 27,
        tipoCliente: 'Novo',
        formaPagamento: 'DescontoFolha',
        formaPagamentoCliente: 'Transferencia',
        ...params,
      }),
    })
  }

  /**
   * Cancela uma proposta CLT
   */
  async cancelarPropostaCLT(propostaId: string | number): Promise<ApiResponse> {
    return this.authenticatedRequest(`/Proposta/cancelamento/${propostaId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Obtém informações do usuário logado
   */
  getUserInfo(): UserInfo | null {
    return this.userInfo
  }

  /**
   * Obtém a primeira loja ativa (para facilitar)
   */
  getFirstActiveLoja(): { lojaId: number; nomeLoja: string } | null {
    if (!this.userInfo || !this.userInfo.lojasAtivas || this.userInfo.lojasAtivas.length === 0) {
      return null
    }
    const primeiraLoja = this.userInfo.lojasAtivas[0]
    return {
      lojaId: primeiraLoja.lojaId,
      nomeLoja: primeiraLoja.nomeLoja,
    }
  }

  /**
   * Testa a conexão (faz login)
   */
  async testConnection(): Promise<ApiResponse<{ connected: boolean; message: string; userInfo?: UserInfo }>> {
    const loginResult = await this.login()
    
    if (loginResult.success) {
      return {
        success: true,
        data: {
          connected: true,
          message: 'Conexão com a API estabelecida com sucesso',
          userInfo: this.userInfo || undefined,
        },
      }
    }

    return {
      success: false,
      data: {
        connected: false,
        message: loginResult.error || 'Não foi possível conectar à API',
      },
    }
  }
}

export type { UserInfo }

// Exporta uma instância singleton
export const hubCreditoClient = new HubCreditoClient()
export type { ApiResponse }

