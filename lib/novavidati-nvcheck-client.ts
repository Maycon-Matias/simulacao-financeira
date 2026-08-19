/**
 * registro para a API NVCheck Adicional da Nova Vida TI
 * Endpoints: GerarTokenJson, NVCHECKADICIONALJson
 * Documentação: API Consultas Nova Vida (NVCHECK ADICIONAL - cadastrais, contato, dados gerais PF/PJ)
 */

const BASE_URL = 'https://wsnv.novavidati.com.br/WSLocalizador.asmx'
const TOKEN_URL = `${BASE_URL}/GerarTokenJson`
const NVCHECK_URL = `${BASE_URL}/NVCHECKADICIONALJson`

/** Mensagens de erro que a API pode retornar no body mesmo com status 200 (doc oficial) */
const ERROS_200_NOVA_VIDA = [
  'entidade, password OU registro INCORRETO',
  'SEM ACESSO AO SISTEMA',
  'QUANTIDADE CONFIGURADA ATINGIDA AO registro',
  'QUANTIDADE CONFIGURADA ATINGIDA AO USUÁRIO'
]

function mensagemErroNoBody(consulta: unknown): string | null {
  const texto = typeof consulta === 'string'
    ? consulta
    : (consulta && typeof consulta === 'object' && 'CONSULTA' in consulta && typeof (consulta as { CONSULTA: unknown }).CONSULTA === 'string')
      ? (consulta as { CONSULTA: string }).CONSULTA
      : null
  if (!texto || typeof texto !== 'string') return null
  const upper = texto.trim().toUpperCase()
  for (const msg of ERROS_200_NOVA_VIDA) {
    if (upper.includes(msg.toUpperCase())) return msg
  }
  return null
}

export interface NvCheckCredenciais {
  entidade: string
  password: string
  registro: string
}

export interface NvCheckConsultaResponse {
  d?: {
    CONSULTA?: Record<string, any>
  }
}

export class NovaVidaTiNvCheckClient {
  private entidade: string
  private password: string
  private registro: string
  private token: string | null = null
  private tokenExpiry: number = 0
  private readonly tokenValidityMs = 23 * 60 * 60 * 1000 // 23h (margem antes de 24h)

  constructor(credenciais?: NvCheckCredenciais) {
    const getEnv = (key: string, def: string = ''): string => {
      if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || process.env[`NEXT_PUBLIC_${key}`] || def
      }
      return def
    }
    this.entidade = credenciais?.entidade || getEnv('NOVVIDATI_USUARIO', '')
    this.password = credenciais?.password || getEnv('NOVVIDATI_SENHA', '')
    this.registro = credenciais?.registro || getEnv('NOVVIDATI_CLIENTE', '')
  }

  updateCredentials(entidade: string, password: string, registro: string) {
    this.entidade = entidade
    this.password = password
    this.registro = registro
    this.token = null
    this.tokenExpiry = 0
  }

  private isTokenValid(): boolean {
    return !!(this.token && Date.now() < this.tokenExpiry)
  }

  private async getToken(): Promise<string> {
    if (this.isTokenValid()) return this.token!

    if (!this.entidade || !this.password || !this.registro) {
      throw new Error('Nova Vida TI: credenciais não configuradas (entidade, password, registro). Configure NOVVIDATI_USUARIO, NOVVIDATI_SENHA, NOVVIDATI_CLIENTE.')
    }

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credencial: {
          entidade: this.entidade,
          password: this.password,
          registro: this.registro
        }
      })
    })

    const text = await res.text()
    let token = ''

    try {
      let data: any = JSON.parse(text)
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch { token = data }
      }
      if (!token) {
        const raw = data?.d ?? data?.GerarTokenJsonResult ?? data?.token ?? data?.Token ?? data
        token = typeof raw === 'string' ? raw : (raw && typeof raw === 'object' ? raw.token ?? raw.Token ?? '' : String(raw || ''))
      }

      // API retorna JSON com erro dentro de d: { "d": "<?xml...<ERRO>SEM ACESSO AO SISTEMA.</ERRO>..." }
      const xmlErro = typeof token === 'string' && token.match(/<ERRO>([^<]*)<\/ERRO>/i)
      if (xmlErro) {
        throw new Error(`Nova Vida TI: ${xmlErro[1].trim()}`)
      }
    } catch (e: any) {
      if (e?.message?.startsWith('Nova Vida TI:')) throw e
      token = text.trim()
      const xmlErro = token.match(/<ERRO>([^<]*)<\/ERRO>/i)
      if (xmlErro) throw new Error(`Nova Vida TI: ${xmlErro[1].trim()}`)
    }

    // Token deve ser string usável como header (sem caracteres inválidos)
    const invalidChars = /[<>"'\r\n]/
    const isValidToken = token && typeof token === 'string' && token.length < 3000 && !invalidChars.test(token)
    if (!isValidToken) {
      throw new Error(`Nova Vida TI: falha ao gerar token. Verifique usuário, password e registro.`)
    }

    this.token = token
    this.tokenExpiry = Date.now() + this.tokenValidityMs
    return token
  }

  /**
   * Consulta dados cadastrais, endereços, telefones etc. por CPF ou CNPJ.
   */
  async consultar(documento: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const doc = String(documento).replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 14) {
      return { success: false, error: 'Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)' }
    }

    try {
      const token = await this.getToken()

      const res = await fetch(NVCHECK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': token
        },
        body: JSON.stringify({
          nvcheck: { Documento: doc }
        })
      })

      const data = await res.json().catch(() => ({}))
      const consulta = data?.d ?? data

      if (!res.ok) {
        const msg = consulta?.message ?? consulta?.error ?? data?.message ?? res.statusText
        return { success: false, error: msg || `Erro HTTP ${res.status}` }
      }

      // Doc: em 200 a API pode retornar mensagem de erro no body (credenciais, bloqueio mensal, etc.)
      const msgErro = mensagemErroNoBody(consulta)
      if (msgErro) {
        return { success: false, error: `Nova Vida TI: ${msgErro}` }
      }

      return { success: true, data: consulta }
    } catch (e: any) {
      console.error('[NovaVidaTiNvCheck] Erro:', e)
      return { success: false, error: e?.message || 'Erro desconhecido' }
    }
  }
}
