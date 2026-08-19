/**
 * Gerenciador de múltiplas APIs
 * Permite configurar e alternar entre diferentes APIs
 */

import { NossaFintechClient } from "./nossa-fintech-client"
import { V8DigitalClient } from "./v8-digital-client"
import { CredSpotClient } from "./credspot-client"
import { PresencaBankClient } from "./presenca-bank-client"
import { C6BankClient } from "./c6bank-client"
import { FactaClient } from "./facta-client"
import { HubCreditoClient } from "./hubcredito-client"

export type ApiClient = NossaFintechClient | V8DigitalClient | CredSpotClient | PresencaBankClient | C6BankClient | FactaClient | HubCreditoClient

export interface ApiConfig {
  id: string
  name: string
  baseUrl: string
  username?: string
  password?: string
  active: boolean
  type: 'nossafintech' | 'v8digital' | 'credspot' | 'presencabank' | 'c6bank' | 'facta' | 'hubcredito' | 'custom'
  // Campos adicionais para APIs específicas
  promotId?: string | number // Para Nossa Fintech
  clientId?: string // Para V8 Digital e CredSpot
  authUrl?: string // Para V8 Digital e CredSpot (URL de autenticação OAuth)
  audience?: string // Para V8 Digital e CredSpot (OBRIGATÓRIO para autenticação)
  clientSecret?: string // Para V8 Digital e CredSpot
}

class ApiManager {
  private apis: Map<string, ApiClient> = new Map()
  private configs: ApiConfig[] = []
  private defaultApiId: string | null = null

  /**
   * Cria um registro baseado no tipo da API
   */
  private createClient(config: ApiConfig): ApiClient {
    switch (config.type) {
      case 'nossafintech': {
        const nossaFintechClient = new NossaFintechClient(config.baseUrl)
        // Nossa Fintech usa CPF como primeiro parâmetro e precisa de promot_id
        // Por padrão, se não houver promot_id separado, assumimos que username é o CPF
        // O promot_id pode estar em uma variável de ambiente separada ou ser definido depois
        if (config.username && config.password) {
          // Prioriza promot_id da config, depois tenta variável de ambiente
          const getEnvPromotId = (key: string, defaultValue?: string): string | undefined => {
            if (typeof window === 'undefined') {
              return process.env[key] || defaultValue
            } else {
              return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
            }
          }
          
          // Garante que o promotId está definido (da config ou do env)
          let promotId = (config as any).promotId
          if (!promotId || promotId === undefined || promotId === null || promotId === '') {
            promotId = getEnvPromotId('NOSSA_FINTECH_API_PROMOT_ID', '1') // Default: 1
            console.log('[ApiManager] Promot ID não encontrado na config, usando do env ou padrão:', promotId)
          }
          
          // Converte para número se for string
          if (typeof promotId === 'string') {
            const parsed = parseInt(promotId, 10)
            promotId = isNaN(parsed) ? promotId : parsed
          }
          
          console.log('[ApiManager] Criando client Nossa Fintech.')
          console.log('[ApiManager] - Config completa:', JSON.stringify({ 
            id: config.id, 
            username: config.username, 
            baseUrl: config.baseUrl,
            promotId: (config as any).promotId,
            promotIdType: typeof (config as any).promotId
          }, null, 2))
          console.log('[ApiManager] - Promot ID da config:', (config as any).promotId, 'Tipo:', typeof (config as any).promotId)
          console.log('[ApiManager] - Promot ID do env:', getEnvPromotId('NOSSA_FINTECH_API_PROMOT_ID'))
          console.log('[ApiManager] - Promot ID final usado:', promotId, 'Tipo:', typeof promotId)
          
          nossaFintechClient.updateCredentials(
            config.username, // CPF
            config.password,
            config.baseUrl,
            promotId
          )
        }
        return nossaFintechClient
      }
      case 'v8digital': {
        const v8Client = new V8DigitalClient(config.baseUrl, (config as any).authUrl)
        if (config.username && config.password) {
          v8Client.updateCredentials(
            config.username,
            config.password,
            config.baseUrl,
            (config as any).authUrl,
            (config as any).clientId,
            (config as any).clientSecret,
            (config as any).audience // OBRIGATÓRIO
          )
        }
        return v8Client
      }
      case 'credspot': {
        const credspotClient = new CredSpotClient(
          config.baseUrl,
          (config as any).clientId,
          (config as any).clientSecret,
          (config as any).authUrl,
          (config as any).audience
        )
        if ((config as any).clientId && (config as any).clientSecret) {
          credspotClient.updateCredentials(
            (config as any).clientId,
            (config as any).clientSecret,
            config.baseUrl,
            (config as any).authUrl,
            (config as any).audience
          )
        }
        return credspotClient
      }
      case 'presencabank': {
        const presencaBankClient = new PresencaBankClient(config.baseUrl)
        if (config.username && config.password) {
          presencaBankClient.updateCredentials(
            config.username,
            config.password,
            config.baseUrl
          )
        }
        return presencaBankClient
      }
      case 'c6bank': {
        const c6BankClient = new C6BankClient(config.baseUrl, (config as any).authUrl)
        if (config.username && config.password) {
          c6BankClient.updateCredentials(
            config.username,
            config.password,
            config.baseUrl,
            (config as any).authUrl
          )
        }
        return c6BankClient
      }
      case 'facta': {
        const factaClient = new FactaClient(config.baseUrl)
        if (config.username && config.password) {
          factaClient.updateCredentials(config.username, config.password, config.baseUrl)
        }
        return factaClient
      }
      case 'hubcredito': {
        const hubClient = new HubCreditoClient(config.baseUrl)
        if (config.username && config.password) {
          hubClient.updateCredentials(config.username, config.password, config.baseUrl)
        }
        return hubClient
      }
      default:
        throw new Error(`Tipo de API não suportado: ${config.type}`)
    }
  }

  constructor() {
    this.loadConfigs()
  }

  /**
   * Carrega configurações salvas do localStorage
   */
  private loadConfigs() {
    if (typeof window === 'undefined') {
      // Servidor-side: usa configurações padrão
      this.loadDefaultConfig()
      return
    }

    try {
      // Sempre carrega as configurações padrão primeiro
      const defaultConfigs = this.getDefaultConfigs()
      
      const saved = localStorage.getItem('api_configs')
      
      if (saved && saved !== 'null' && saved !== 'undefined') {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Filtra apenas APIs válidas
            const validTypes = ['nossafintech', 'v8digital', 'credspot', 'presencabank', 'c6bank', 'facta', 'hubcredito', 'custom']
            const validSavedConfigs = parsed.filter((c: any) => validTypes.includes(c.type))
            
            // Mescla configurações salvas válidas com as padrão
            const savedConfigsMap = new Map(validSavedConfigs.map((c: any) => [c.id, c]))
            
            // Inicia com as configurações padrão
            this.configs = defaultConfigs.map(defaultConfig => {
              const savedConfig = savedConfigsMap.get(defaultConfig.id)
              if (savedConfig) {
                // Mescla: usa dados salvos, mas mantém valores padrão se não existirem
                const mergedConfig = {
                  ...defaultConfig, // Valores padrão como base
                  ...savedConfig,   // Sobrescreve com valores salvos
                  password: savedConfig.password || defaultConfig.password, // Mantém password padrão se salva estiver vazia
                  username: savedConfig.username || defaultConfig.username,
                  baseUrl: savedConfig.baseUrl || defaultConfig.baseUrl,
                  active:
                    defaultConfig.id === 'nossafintech-default'
                      ? true
                      : savedConfig.active !== undefined
                        ? savedConfig.active
                        : defaultConfig.active,
                  type: defaultConfig.type, // Sempre usa o tipo da config padrão
                  // Mantém promotId se existir no savedConfig, senão usa do defaultConfig
                  promotId: (savedConfig as any).promotId !== undefined && (savedConfig as any).promotId !== null && (savedConfig as any).promotId !== '' 
                    ? (savedConfig as any).promotId 
                    : defaultConfig.promotId,
                  // Para V8 Digital, mantém campos específicos
                  clientId: (savedConfig as any).clientId || (defaultConfig as any).clientId,
                  authUrl: (savedConfig as any).authUrl || (defaultConfig as any).authUrl,
                  audience: (savedConfig as any).audience || (defaultConfig as any).audience,
                  clientSecret: (defaultConfig as any).clientSecret,
                  // Para CredSpot, mantém campos específicos
                  ...(defaultConfig.type === 'credspot' ? {
                    clientId: (savedConfig as any).clientId || (defaultConfig as any).clientId,
                    clientSecret: (defaultConfig as any).clientSecret,
                    authUrl: (savedConfig as any).authUrl || (defaultConfig as any).authUrl,
                    audience: (savedConfig as any).audience || (defaultConfig as any).audience
                  } : {})
                }
                
                // Log para debug
                if (defaultConfig.type === 'nossafintech') {
                  console.log('[ApiManager] Carregando config Nossa Fintech:', defaultConfig.id)
                  console.log('[ApiManager] - Promot ID final:', mergedConfig.promotId)
                }
                if (defaultConfig.type === 'v8digital') {
                  console.log('[ApiManager] Carregando config V8 Digital:', defaultConfig.id)
                  console.log('[ApiManager] - Audience:', mergedConfig.audience)
                }
                
                return mergedConfig
              }
              return defaultConfig
            })
            
            // Adiciona APIs customizadas válidas que não estão nas padrão
            validSavedConfigs.forEach((savedConfig: any) => {
              if (!this.configs.some(c => c.id === savedConfig.id) && savedConfig.type === 'custom') {
                this.configs.push({
                  ...savedConfig,
                  password: savedConfig.password || undefined // password não é salva, mas pode vir do savedConfig
                })
              }
            })
            
            // Garante que pelo menos as APIs padrão estão presentes e ativas
            defaultConfigs.forEach(defaultConfig => {
              if (!this.configs.some(c => c.id === defaultConfig.id)) {
                this.configs.push(defaultConfig)
              }
            })
            
            const defaultId = localStorage.getItem('default_api_id')
            if (defaultId && this.configs.some(c => c.id === defaultId)) {
              this.defaultApiId = defaultId
            } else if (this.configs.length > 0) {
              this.defaultApiId = this.configs.find(c => c.active)?.id || this.configs[0].id
            }
          } else {
            // Array vazio: usa apenas as padrão
            this.configs = defaultConfigs
            this.defaultApiId = 'nossafintech-default'
            this.saveConfigs()
          }
        } catch (parseError) {
          console.error('Erro ao fazer parse das configurações:', parseError)
          // Em caso de erro, usa apenas as padrão
          this.configs = defaultConfigs
          this.defaultApiId = 'nossafintech-default'
          this.saveConfigs()
        }
      } else {
        // Primeira vez: usa apenas as configurações padrão
        this.configs = defaultConfigs
        this.defaultApiId = 'nossafintech-default'
        this.saveConfigs()
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de API:', error)
      // Em caso de erro, usa apenas as padrão
      this.configs = this.getDefaultConfigs()
      this.defaultApiId = 'nossafintech-default'
      this.saveConfigs()
    }

    this.initializeClients()
  }

  /**
   * Retorna as configurações padrão (helper para não duplicar código)
   */
  private getDefaultConfigs(): ApiConfig[] {
    const getEnv = (key: string, defaultValue?: string): string | undefined => {
      if (typeof window === 'undefined') {
        return process.env[key] || defaultValue
      } else {
        return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
      }
    }

    return [
      {
        id: 'nossafintech-default',
        name: 'Nossa Fintech (Padrão)',
        baseUrl: getEnv('NOSSA_FINTECH_API_BASE_URL', 'https://nossa-fintech-api.spixiiservices.com.br') || 'https://nossa-fintech-api.spixiiservices.com.br',
        username: getEnv('NOSSA_FINTECH_API_CPF', '') || '', // CPF usado como username
        password: getEnv('NOSSA_FINTECH_API_PASSWORD', '') || '',
        promotId: getEnv('NOSSA_FINTECH_API_PROMOT_ID'), // Promot ID pode vir da variável de ambiente
        active: true,
        type: 'nossafintech' as const
      },
      {
        id: 'v8digital-default',
        name: 'V8 Digital (Padrão)',
        baseUrl: getEnv('V8_API_BASE_URL', 'https://bff.v8sistema.com') || 'https://bff.v8sistema.com',
        username: getEnv('V8_API_USERNAME', '') || '',
        password: getEnv('V8_API_PASSWORD', '') || '',
        clientId: getEnv('V8_API_CLIENT_ID', '') || '',
        authUrl: getEnv('V8_API_AUTH_URL', 'https://auth.v8sistema.com/oauth/token') || 'https://auth.v8sistema.com/oauth/token',
        audience: getEnv('V8_API_AUDIENCE', 'https://bff.v8sistema.com') || 'https://bff.v8sistema.com', // OBRIGATÓRIO
        active: true,
        type: 'v8digital' as const
      },
      {
        id: 'credspot-default',
        name: 'CredSpot (Padrão)',
        baseUrl: getEnv('CREDSPOT_API_BASE_URL', 'https://api.credspot.net/api/v1') || 'https://api.credspot.net/api/v1',
        authUrl: getEnv('CREDSPOT_AUTH_URL', 'https://auth.credspot.net/oauth/token') || 'https://auth.credspot.net/oauth/token',
        // Audience conforme documentação oficial (https://api.credspot.net/api/v1/docs)
        audience: getEnv('CREDSPOT_AUDIENCE', 'https://api.credspot.net/') || 'https://api.credspot.net/',
        clientId: getEnv('CREDSPOT_CLIENT_ID', '') || '',
        clientSecret: getEnv('CREDSPOT_CLIENT_SECRET', '') || '',
        active: true,
        type: 'credspot' as const
      },
      {
        id: 'presencabank-default',
        name: 'Presença Bank (Padrão)',
        baseUrl: getEnv('PRESENCA_API_BASE_URL', 'https://presenca-bank-api.azurewebsites.net') || 'https://presenca-bank-api.azurewebsites.net',
        username: getEnv('PRESENCA_API_USERNAME', '') || '',
        password: getEnv('PRESENCA_API_PASSWORD', '') || '',
        active: true,
        type: 'presencabank' as const
      },
      {
        id: 'c6bank-default',
        name: 'C6 Bank (CLT)',
        baseUrl: getEnv('C6BANK_API_BASE_URL', 'https://marketplace-proposal-service-api-p.c6bank.info') || 'https://marketplace-proposal-service-api-p.c6bank.info',
        username: getEnv('C6BANK_USERNAME', '') || '',
        password: getEnv('C6BANK_PASSWORD', '') || '',
        active: true,
        type: 'c6bank' as const
      },
      {
        id: 'hubcredito-default',
        name: 'Hub Crédito',
        baseUrl: getEnv('HUBCREDITO_API_BASE_URL', 'https://api.hubcredito.com.br/api') || 'https://api.hubcredito.com.br/api',
        username: getEnv('HUBCREDITO_API_USERNAME', '') || '',
        password: getEnv('HUBCREDITO_API_PASSWORD', '') || '',
        active: true,
        type: 'hubcredito' as const
      },
      {
        id: 'facta-default',
        name: 'Facta',
        baseUrl: getEnv('FACTA_API_BASE_URL', '') || '',
        username: getEnv('FACTA_API_USERNAME', '') || '',
        password: getEnv('FACTA_API_PASSWORD', '') || '',
        active: true,
        type: 'facta' as const
      }
    ]
  }

  /**
   * Carrega configuração padrão (Nossa Fintech e V8 Digital)
   */
  private loadDefaultConfig() {
    this.configs = this.getDefaultConfigs()
    this.defaultApiId = 'nossafintech-default'
  }

  /**
   * Inicializa registro das APIs configuradas
   */
  private initializeClients() {
    this.configs.forEach(config => {
      if (config.active) {
        const client = this.createClient(config)
        this.apis.set(config.id, client)
      }
    })
  }

  /**
   * Obtém todas as configurações de API
   */
  getConfigs(): ApiConfig[] {
    // Se não há configurações, garante que a padrão esteja carregada
    if (this.configs.length === 0) {
      this.loadDefaultConfig()
      if (typeof window !== 'undefined') {
        this.saveConfigs()
      }
    }
    return [...this.configs]
  }

  /**
   * Adiciona uma nova configuração de API
   */
  addConfig(config: Omit<ApiConfig, 'id'>): string {
    const id = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newConfig: ApiConfig = {
      ...config,
      id
    }

    this.configs.push(newConfig)
    this.saveConfigs()

    if (newConfig.active) {
      const client = this.createClient(newConfig)
      this.apis.set(id, client)
    }

    // Se for a primeira API ou se não houver padrão, define como padrão
    if (!this.defaultApiId) {
      this.defaultApiId = id
      this.saveDefaultApi()
    }

    return id
  }

  /**
   * Atualiza uma configuração existente
   */
  updateConfig(id: string, updates: Partial<ApiConfig>): boolean {
    const index = this.configs.findIndex(c => c.id === id)
    if (index === -1) return false

    // Mescla atualizações com configuração existente
    this.configs[index] = { ...this.configs[index], ...updates }
    console.log('[ApiManager] Config atualizada. Promot ID:', (this.configs[index] as any).promotId)
    
    // Se password foi fornecida, atualiza também (mas não salva no localStorage por segurança)
    // Se promotId foi fornecido, salva junto com a config
    this.saveConfigs()

    // Recria o registro para aplicar as novas credenciais
    if (this.configs[index].active) {
      const client = this.createClient(this.configs[index])
      this.apis.set(id, client)
    } else {
      this.apis.delete(id)
    }

    return true
  }

  /**
   * Remove uma configuração
   */
  removeConfig(id: string): boolean {
    // Não permite remover a última API
    if (this.configs.length <= 1) {
      return false
    }

    const index = this.configs.findIndex(c => c.id === id)
    if (index === -1) return false

    this.configs.splice(index, 1)
    this.apis.delete(id)
    this.saveConfigs()

    // Se a API removida era a padrão, define outra como padrão
    if (this.defaultApiId === id && this.configs.length > 0) {
      this.defaultApiId = this.configs[0].id
      this.saveDefaultApi()
    }

    return true
  }

  /**
   * Obtém o registro de uma API específica
   */
  getClient(apiId?: string, forceRecreate: boolean = false): ApiClient {
    const id = apiId || this.defaultApiId || this.configs[0]?.id
    
    if (!id) {
      throw new Error('Nenhuma API configurada')
    }

    // Se forceRecreate, remove o client do cache
    if (forceRecreate) {
      this.apis.delete(id)
    }

    let client = this.apis.get(id)
    
    if (!client) {
      const config = this.configs.find(c => c.id === id)
      if (!config) {
        throw new Error(`API com ID ${id} não encontrada`)
      }

      client = this.createClient(config)
      this.apis.set(id, client)
    }

    return client
  }

  /**
   * Define a API padrão
   */
  setDefaultApi(apiId: string): boolean {
    if (!this.configs.some(c => c.id === apiId)) {
      return false
    }

    this.defaultApiId = apiId
    this.saveDefaultApi()
    return true
  }

  /**
   * Obtém a API padrão
   */
  getDefaultApiId(): string | null {
    return this.defaultApiId
  }

  /**
   * Salva configurações no localStorage
   */
  private saveConfigs() {
    if (typeof window !== 'undefined') {
      // Salva apenas os metadados, senhas devem ser reconfiguradas
      // Em produção, isso deveria ser feito via API backend segura
      const configsToSave = this.configs.map(config => {
        const saved = {
          id: config.id,
          name: config.name,
          baseUrl: config.baseUrl,
          username: config.username,
          active: config.active,
          type: config.type,
          // Não salva a password por segurança
          hasPassword: !!config.password
        } as any
        
        // Salva promot_id para Nossa Fintech
        if (config.promotId !== undefined) {
          saved.promotId = config.promotId
          console.log('[ApiManager] Salvando Promot ID:', config.promotId, 'para API:', config.id)
        }
        
        // Salva campos específicos do V8 Digital
        if (config.type === 'v8digital') {
          if ((config as any).clientId) {
            saved.clientId = (config as any).clientId
          }
          if ((config as any).authUrl) {
            saved.authUrl = (config as any).authUrl
          }
          if ((config as any).audience) {
            saved.audience = (config as any).audience
          }
        }
        
        // Salva campos específicos do CredSpot
        if (config.type === 'credspot') {
          if ((config as any).clientId) {
            saved.clientId = (config as any).clientId
          }
          if ((config as any).authUrl) {
            saved.authUrl = (config as any).authUrl
          }
          if ((config as any).audience) {
            saved.audience = (config as any).audience
          }
        }

        // Salva campos específicos do C6 Bank
        if (config.type === 'c6bank') {
          if ((config as any).authUrl) {
            saved.authUrl = (config as any).authUrl
          }
        }
        
        return saved
      })
      localStorage.setItem('api_configs', JSON.stringify(configsToSave))
      
      // Salva também o ID da API padrão
      if (this.defaultApiId) {
        localStorage.setItem('default_api_id', this.defaultApiId)
      }
    }
  }

  /**
   * Atualiza password de uma API (para uso quando reconfigurando)
   */
  updateApiPassword(apiId: string, password: string): boolean {
    const index = this.configs.findIndex(c => c.id === apiId)
    if (index === -1) return false

    this.configs[index].password = password
    const client = this.apis.get(apiId)
    if (client) {
      client.updateCredentials(this.configs[index].username, password, this.configs[index].baseUrl)
    }

    return true
  }

  /**
   * Salva a API padrão
   */
  private saveDefaultApi() {
    if (typeof window !== 'undefined' && this.defaultApiId) {
      localStorage.setItem('default_api_id', this.defaultApiId)
    }
  }

  /**
   * Para uso no servidor: obtém configuração por ID diretamente
   */
  getConfig(apiId?: string): ApiConfig | null {
    const id = apiId || this.defaultApiId || this.configs[0]?.id
    return this.configs.find(c => c.id === id) || null
  }

  /**
   * Para uso no servidor: obtém registro diretamente por ID
   */
  getClientById(apiId: string): ApiClient | null {
    const config = this.configs.find(c => c.id === apiId)
    if (!config) {
      console.log('[ApiManager] getClientById: Config não encontrada para API:', apiId)
      return null
    }

    console.log('[ApiManager] getClientById: Config encontrada para API:', apiId)
    console.log('[ApiManager] - Promot ID na config:', (config as any).promotId, 'Tipo:', typeof (config as any).promotId)
    console.log('[ApiManager] - Config ativa:', config.active)

    // No servidor, garante que o promotId está configurado a partir das variáveis de ambiente
    if (typeof window === 'undefined' && config.type === 'nossafintech' && !(config as any).promotId) {
      const getEnvPromotId = (key: string): string | undefined => {
        return process.env[key]
      }
      const envPromotId = getEnvPromotId('NOSSA_FINTECH_API_PROMOT_ID')
      if (envPromotId) {
        (config as any).promotId = envPromotId
        console.log('[ApiManager] Promot ID obtido do env no servidor:', envPromotId)
      }
    }

    let client = this.apis.get(apiId)

    if (!client && config.active) {
      console.log('[ApiManager] registro não encontrado no cache, recriando para API:', apiId)
      client = this.createClient(config)
      this.apis.set(apiId, client)
    } else if (client && config.type === 'nossafintech') {
      // Para Nossa Fintech, sempre atualiza as credenciais para garantir que o promotId está atualizado
      const nossaFintechClient = client as any
      if (nossaFintechClient.updateCredentials && config.username && config.password) {
        const getEnvPromotId = (key: string, defaultValue?: string): string | undefined => {
          if (typeof window === 'undefined') {
            return process.env[key] || defaultValue
          } else {
            return process.env[`NEXT_PUBLIC_${key}`] || defaultValue
          }
        }
        
        // Garante que o promotId está definido (da config ou do env)
        let promotId = (config as any).promotId
        if (!promotId || promotId === undefined || promotId === null || promotId === '') {
          promotId = getEnvPromotId('NOSSA_FINTECH_API_PROMOT_ID', '1') // Default: 1
          console.log('[ApiManager] Promot ID não encontrado na config, usando do env ou padrão:', promotId)
        }
        
        // Converte para número se for string
        if (typeof promotId === 'string') {
          const parsed = parseInt(promotId, 10)
          promotId = isNaN(parsed) ? promotId : parsed
        }
        
        console.log('[ApiManager] Atualizando credenciais do registro existente. Promot ID:', promotId, 'Tipo:', typeof promotId)
        nossaFintechClient.updateCredentials(
          config.username,
          config.password,
          config.baseUrl,
          promotId
        )
      }
    } else if (client && config.type === 'v8digital') {
      // Para V8 Digital, sempre atualiza as credenciais para garantir que audience está atualizado
      const v8Client = client as any
      if (v8Client.updateCredentials && config.username && config.password) {
        const getEnv = (key: string): string | undefined => {
          if (typeof window === 'undefined') {
            return process.env[key]
          } else {
            return process.env[`NEXT_PUBLIC_${key}`]
          }
        }
        
        // Garante que audience está definido (da config ou do env)
        let audience = (config as any).audience
        if (!audience || audience === undefined || audience === null || audience === '') {
          audience = getEnv('V8_API_AUDIENCE')
          if (audience) {
            console.log('[ApiManager] Audience obtido do env:', audience)
          }
        }
        
        console.log('[ApiManager] Atualizando credenciais do V8 Digital. Audience:', audience ? 'configurado' : 'NÃO configurado')
        v8Client.updateCredentials(
          config.username,
          config.password,
          config.baseUrl,
          (config as any).authUrl,
          (config as any).clientId,
          (config as any).clientSecret,
          audience
        )
      }
    } else if (client && config.type === 'credspot') {
      const credspotClient = client as any
      if (credspotClient.updateCredentials && (config as any).clientId && (config as any).clientSecret) {
        credspotClient.updateCredentials(
          (config as any).clientId,
          (config as any).clientSecret,
          config.baseUrl,
          (config as any).authUrl,
          (config as any).audience
        )
      }
    }

    return client || null
  }
}

// Singleton para uso no registro E servidor
// IMPORTANTE: No servidor, usar singleton garante que o cache de registro persista entre requisições
// Isso é crítico para evitar múltiplos logins quando há bloqueio de "Too many logins"
let apiManagerInstance: ApiManager | null = null

export function getApiManager(): ApiManager {
  // Usa singleton tanto no registro quanto no servidor para manter cache persistente
  // No servidor Next.js, o módulo é cacheado entre requisições, então o singleton funciona
  if (!apiManagerInstance) {
    apiManagerInstance = new ApiManager()
  }
  return apiManagerInstance
}

