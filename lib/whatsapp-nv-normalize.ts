/**
 * Normaliza resposta da consulta Nova Vida (NVCheck) para uso nos endpoints WhatsApp (V8, C6).
 * Extrai nome, data nascimento, sexo, email, telefone dos blocos CADASTRAIS, EMAILS, TELEFONES.
 */

export interface DadosClienteNv {
  cpf: string
  nome: string
  data_nascimento: string // YYYY-MM-DD
  data_nascimento_ddmm: string // DD/MM/AAAA
  sexo: 'male' | 'female'
  email: string
  telefone: string // DDD + número sem formatação
  telefone_ddd?: string
  raw?: Record<string, unknown>
}

function getStr(obj: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function toIsoDate(s: string): string | null {
  const t = String(s).trim()
  if (!t) return null
  // DD/MM/AAAA
  const m1 = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) {
    const [, d, m, y] = m1
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return null
}

function toDdMmYyyy(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Detecta gênero a partir do primeiro nome (fallback quando NV não retorna SEXO).
 */
function detectGenderByFirstName(nome: string): 'male' | 'female' {
  const first = nome.split(/\s+/)[0]?.toLowerCase() || ''
  const female = ['maria', 'ana', 'francisca', 'antonieta', 'josefa', 'fernanda', 'juliana', 'patricia', 'paula', 'camila', 'amanda', 'bruna', 'leticia', 'luciana', 'adriana', 'sandra', 'carla', 'renata', 'daniela', 'andrea', 'fabiana', 'roberta', 'vanessa', 'tatiana', 'aline', 'sueli', 'eliane', 'rosana', 'claudia', 'simone', 'lucia', 'regina', 'elaine', 'sonia', 'cristina', 'marcia', 'lucia', 'fatima', 'tereza', 'lucia']
  if (female.includes(first)) return 'female'
  return 'male'
}

/**
 * Extrai dados do registro a partir da resposta bruta da API Nova Vida (CONSULTA).
 */
export function normalizarDadosNv(cpf: string, consulta: Record<string, any>): DadosClienteNv | null {
  const cadastrais = consulta.CADASTRAIS ?? consulta.cadastrais ?? {}
  const emails = consulta.EMAILS ?? consulta.emails ?? []
  const telefones = consulta.TELEFONES ?? consulta.telefones ?? []

  const nome = getStr(cadastrais, 'NOME', 'Nome', 'nome', 'NOMECLIENTE', 'NOME_CLIENTE')
  if (!nome) return null

  const dataNascRaw = getStr(
    cadastrais,
    'DATA_NASCIMENTO',
    'DataNascimento',
    'data_nascimento',
    'DATANASC',
    'NASCIMENTO',
    'DtNascimento',
    'DT_NASCIMENTO',
    'DTNASCIMENTO',
    'DATA_NASC',
    'NASCIMENTO_DATA'
  )
  const dataIso = dataNascRaw ? toIsoDate(dataNascRaw) : null
  const dataNascimento = dataIso || ''
  const data_nascimento_ddmm = dataIso ? toDdMmYyyy(dataIso) : ''

  let sexo: 'male' | 'female' = detectGenderByFirstName(nome)
  const sexoStr = getStr(cadastrais, 'SEXO', 'Sexo', 'sexo', 'GENERO', 'Genero')
  if (sexoStr) {
    const s = sexoStr.toLowerCase()
    if (s === 'm' || s === 'masculino' || s === 'male') sexo = 'male'
    else if (s === 'f' || s === 'feminino' || s === 'female') sexo = 'female'
  }

  let email = ''
  if (Array.isArray(emails) && emails.length > 0) {
    const first = emails[0]
    email = typeof first === 'string' ? first : getStr(first, 'EMAIL', 'email', 'Email')
  }

  let telefone = ''
  let telefone_ddd = ''
  if (Array.isArray(telefones) && telefones.length > 0) {
    const t = telefones[0]
    const ddd = typeof t === 'object' ? getStr(t, 'DDD', 'ddd', 'Ddd') : ''
    const num = typeof t === 'object' ? getStr(t, 'TELEFONE', 'telefone', 'Telefone', 'NUMERO', 'numero') : String(t).replace(/\D/g, '')
    telefone_ddd = ddd
    telefone = (ddd + num).replace(/\D/g, '')
    if (telefone.length < 10) telefone = ''
  }

  return {
    cpf: String(cpf).replace(/\D/g, ''),
    nome,
    data_nascimento: dataNascimento,
    data_nascimento_ddmm: data_nascimento_ddmm,
    sexo,
    email: email || `registro.${String(cpf).replace(/\D/g, '')}@poracred.com.br`,
    telefone: telefone || '11999999999',
    telefone_ddd: telefone_ddd || undefined,
    raw: consulta as Record<string, unknown>
  }
}
