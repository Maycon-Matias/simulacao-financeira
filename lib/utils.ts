import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza telefone para o formato exigido pela API Presença Bank:
 * 11 dígitos, 3º dígito = 9 (DDD + celular). Não pode ser só zeros.
 * Remove código do país (55). Se tiver 10 dígitos (fixo), insere 9 após o DDD.
 * @returns string de 11 dígitos ou null se inválido
 */
export function normalizarTelefonePresenca(telefone: string | null | undefined): string | null {
  if (telefone == null || String(telefone).trim() === "") return null
  let tel = String(telefone).replace(/\D/g, "")
  if (tel.length >= 12 && tel.startsWith("55")) tel = tel.slice(2)
  if (tel.length === 10) tel = tel.slice(0, 2) + "9" + tel.slice(2)
  if (tel.length !== 11 || tel[2] !== "9" || /^0+$/.test(tel)) return null
  return tel
}

/**
 * Interface para vínculo empregatício
 */
export interface VinculoEmpregaticio {
  matricula?: string
  registroEmpregaticio?: string
  cnpj?: string
  cnpjEmpregador?: string
  [key: string]: any
}

/**
 * Extrai array de vínculos de diferentes estruturas de resposta da API
 */
export function extrairVinculos(responseData: any): VinculoEmpregaticio[] {
  if (Array.isArray(responseData)) return responseData
  if (responseData?.vinculos && Array.isArray(responseData.vinculos)) return responseData.vinculos
  if (responseData?.data?.vinculos && Array.isArray(responseData.data.vinculos)) return responseData.data.vinculos
  if (responseData?.data && Array.isArray(responseData.data)) return responseData.data
  if (responseData?.resultado && Array.isArray(responseData.resultado)) return responseData.resultado
  if (responseData?.result && Array.isArray(responseData.result)) return responseData.result
  if (responseData?.items && Array.isArray(responseData.items)) return responseData.items
  if (responseData?.dados && Array.isArray(responseData.dados)) return responseData.dados

  if (responseData && typeof responseData === 'object') {
    for (const key in responseData) {
      const value = responseData[key]
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        const primeiroItem = value[0]
        if (primeiroItem.matricula || primeiroItem.registroEmpregaticio || primeiroItem.cnpj || primeiroItem.cnpjEmpregador) {
          return value
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const subKey in value) {
          const subValue = value[subKey]
          if (Array.isArray(subValue) && subValue.length > 0 && typeof subValue[0] === 'object') {
            const primeiroItem = subValue[0]
            if (primeiroItem.matricula || primeiroItem.registroEmpregaticio || primeiroItem.cnpj || primeiroItem.cnpjEmpregador) {
              return subValue
            }
          }
        }
      }
    }
  }
  return []
}

/**
 * Retorna o primeiro valor de 11 dígitos encontrado no vínculo (CPF do titular).
 * Usado para não confundir CPF com matrícula/CNPJ.
 */
function obterCpfDoVinculo(vinculo: any): string | null {
  if (!vinculo || typeof vinculo !== 'object') return null
  const keys = ['cpf', 'documento', 'cpfTitular', 'numeroDocumento', 'documentoTitular']
  for (const k of keys) {
    const v = vinculo[k]
    if (v != null) {
      const d = String(v).replace(/\D/g, '')
      if (d.length === 11 && /^\d{11}$/.test(d)) return d
    }
  }
  return null
}

/**
 * Extrai matrícula e CNPJ de um vínculo, suportando diferentes nomes de campos.
 * Rejeita valores que são CPF ou concatenação CPF+outros (evita 400 na API de margem).
 * @param cpfContexto - CPF do titular (11 dígitos); usado para rejeitar matrícula/CNPJ que comecem com ele quando o vínculo não traz o campo cpf
 */
export function extrairMatriculaECnpj(vinculo: VinculoEmpregaticio, cpfContexto?: string): { matricula: string; cnpj: string } {
  let cpfNoVinculo = obterCpfDoVinculo(vinculo)
  const cpf11 = cpfContexto ? String(cpfContexto).replace(/\D/g, '') : ''
  if (cpf11.length === 11 && /^\d{11}$/.test(cpf11)) cpfNoVinculo = cpfNoVinculo || cpf11

  // Busca inteligente por matrícula - tenta múltiplas variações
  let matricula = ''
  const possiveisMatriculas = [
    vinculo.registroEmpregaticio,
    vinculo.matricula,
    vinculo.registro,
    vinculo.numeroMatricula,
    vinculo.numMatricula,
    vinculo.matriculaFuncionario,
    vinculo.codigoMatricula,
    vinculo.idMatricula,
    (vinculo as any).matriculaFuncionario,
    (vinculo as any).numeroRegistro,
    (vinculo as any).numeroMatriculaFuncionario,
    (vinculo as any).codigo,
    (vinculo as any).id,
    (vinculo as any).numero,
  ]
  
  // Busca em objetos aninhados
  if ((vinculo as any).empregador?.matricula) matricula = (vinculo as any).empregador.matricula
  if ((vinculo as any).funcionario?.matricula) matricula = (vinculo as any).funcionario.matricula
  if ((vinculo as any).trabalhador?.matricula) matricula = (vinculo as any).trabalhador.matricula
  
  // Se não encontrou, busca no array de possíveis
  if (!matricula) {
    for (const possivel of possiveisMatriculas) {
      if (possivel && String(possivel).trim().length > 0) {
        matricula = String(possivel)
        break
      }
    }
  }

  // Rejeita ou ajusta matrícula que seja CPF ou comece com CPF (ex.: CPF+data 26 dígitos)
  if (matricula && cpfNoVinculo) {
    const m = String(matricula).replace(/\D/g, '')
    if (m === cpfNoVinculo) {
      // Matrícula igual ao CPF não é aceitável
      matricula = ''
    } else if (m.length > 15 && m.startsWith(cpfNoVinculo)) {
      // Padrão comum: CPF + zeros + sufixo numérico (ex.: COL<CPF>0000006954)
      const resto = m.slice(cpfNoVinculo.length) // parte após o CPF
      const semZeros = resto.replace(/^0+/, '')
      if (semZeros.length > 0 && semZeros.length <= 15) {
        // Usa apenas o sufixo numérico "limpo" como matrícula
        matricula = semZeros
      } else {
        // Como fallback, usa os últimos 15 dígitos
        matricula = m.slice(-15)
      }
    }
  }
  if (matricula && matricula.length > 20) {
    const reg = (vinculo as any).registroEmpregaticio
    if (reg && String(reg).trim().length > 0 && String(reg).length <= 15) matricula = String(reg)
  }

  // Busca inteligente por CNPJ - tenta múltiplas variações
  let cnpj = ''
  const possiveisCnpjs = [
    vinculo.cnpj,
    vinculo.cnpjEmpregador,
    vinculo.cnpjEmpresa,
    vinculo.cnpjEmpregadora,
    vinculo.cnpjContratante,
    vinculo.numeroCnpj,
    vinculo.cnpjEmpregadorCnpj,
    // Presença Bank: número de inscrição do empregador (pode vir sem 14 dígitos)
    (vinculo as any).numeroInscricaoEmpregador,
    (vinculo as any).numero_inscricao_empregador,
    (vinculo as any).numeroCnpjEmpregador,
    (vinculo as any).cnpjEmpregadorCnpj,
    // Mais variações possíveis
    (vinculo as any).cnpjEmpregadorCnpjEmpregador,
    (vinculo as any).empregadorCnpj,
    (vinculo as any).empresaCnpj,
    (vinculo as any).cnpjEmpregadorCnpjEmpresa,
    (vinculo as any).numeroCnpjEmpresa,
    (vinculo as any).cnpjContratanteCnpj,
    // Campos em português
    (vinculo as any).cnpj_empregador,
    (vinculo as any).cnpj_empresa,
    (vinculo as any).cnpj_contratante,
    (vinculo as any).numero_cnpj,
    (vinculo as any).cnpjEmpregadorCnpjEmpregador,
  ]
  
  // Busca em objetos aninhados (mais variações)
  if ((vinculo as any).empregador?.cnpj) cnpj = (vinculo as any).empregador.cnpj
  if ((vinculo as any).organizacao?.cnpj) cnpj = (vinculo as any).organizacao.cnpj
  if ((vinculo as any).contratante?.cnpj) cnpj = (vinculo as any).contratante.cnpj
  if ((vinculo as any).empregador?.numeroCnpj) cnpj = (vinculo as any).empregador.numeroCnpj
  if ((vinculo as any).empregador?.cnpjEmpregador) cnpj = (vinculo as any).empregador.cnpjEmpregador
  if ((vinculo as any).organizacao?.numeroCnpj) cnpj = (vinculo as any).organizacao.numeroCnpj
  if ((vinculo as any).contratante?.numeroCnpj) cnpj = (vinculo as any).contratante.numeroCnpj
  if ((vinculo as any).dados?.cnpj) cnpj = (vinculo as any).dados.cnpj
  if ((vinculo as any).dados?.cnpjEmpregador) cnpj = (vinculo as any).dados.cnpjEmpregador
  if ((vinculo as any).informacoes?.cnpj) cnpj = (vinculo as any).informacoes.cnpj
  if ((vinculo as any).vinculo?.cnpj) cnpj = (vinculo as any).vinculo.cnpj
  if ((vinculo as any).vinculo?.cnpjEmpregador) cnpj = (vinculo as any).vinculo.cnpjEmpregador
  
  // Se não encontrou, busca no array de possíveis
  if (!cnpj) {
    for (const possivel of possiveisCnpjs) {
      if (possivel && String(possivel).trim().length > 0) {
        cnpj = String(possivel)
        break
      }
    }
  }
  
  // Rejeita CNPJ que comece com CPF do titular (ex.: 81348371315 + 101 = 14 dígitos)
  const cnpjNaoPodeComecarComCpf = (digitos14: string) =>
    cpfNoVinculo && digitos14.length >= 11 && digitos14.startsWith(cpfNoVinculo)

  // Normaliza para 14 dígitos (pad com zeros à esquerda); rejeita se for CPF ou começar com CPF
  const normalizarCnpj14 = (valor: string): string | null => {
    const d = String(valor).replace(/\D/g, '')
    if (d.length === 0) return null
    if (d.length === 11 && cpfNoVinculo && d === cpfNoVinculo) return null
    const padded = d.length <= 14 ? d.padStart(14, '0') : d.slice(0, 14)
    if (padded.length !== 14 || !/^\d{14}$/.test(padded)) return null
    if (padded === '00000000000000') return null
    if (cnpjNaoPodeComecarComCpf(padded)) return null
    return padded
  }

  // Se já temos um valor em cnpj, normaliza para 14 dígitos (API pode retornar 8 ou menos)
  if (cnpj && cnpj.trim().length > 0) {
    const normalizado = normalizarCnpj14(cnpj)
    cnpj = normalizado ?? ''
  }

  // Busca genérica recursiva: 14 dígitos ou 8–13 dígitos (CNPJ curto do empregador)
  if (!cnpj && vinculo && typeof vinculo === 'object') {
    const buscarCnpjRecursivo = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue
        const value = obj[key]
        if (value !== null && value !== undefined && typeof value !== 'object') {
          const apenasDigitos = String(value).replace(/\D/g, '')
          if (apenasDigitos.length >= 14 && /^\d+$/.test(apenasDigitos)) {
            const cand = apenasDigitos.slice(0, 14)
            if (cand !== '00000000000000' && !cnpjNaoPodeComecarComCpf(cand)) return cand
          }
          if (apenasDigitos.length >= 8 && apenasDigitos.length <= 13 && /^\d+$/.test(apenasDigitos)) {
            const cand = apenasDigitos.padStart(14, '0')
            if (cand !== '00000000000000' && !cnpjNaoPodeComecarComCpf(cand)) return cand
          }
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          const encontrado = buscarCnpjRecursivo(value)
          if (encontrado) return encontrado
        } else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            if (value[i] && typeof value[i] === 'object') {
              const encontrado = buscarCnpjRecursivo(value[i])
              if (encontrado) return encontrado
            } else if (value[i] != null) {
              const apenasDigitos = String(value[i]).replace(/\D/g, '')
              if (apenasDigitos.length >= 8 && apenasDigitos.length <= 13 && /^\d+$/.test(apenasDigitos)) {
                const cand = apenasDigitos.padStart(14, '0')
                if (cand !== '00000000000000' && !cnpjNaoPodeComecarComCpf(cand)) return cand
              }
              if (apenasDigitos.length >= 14) {
                const cand = apenasDigitos.slice(0, 14)
                if (cand !== '00000000000000' && !cnpjNaoPodeComecarComCpf(cand)) return cand
              }
            }
          }
        }
      }
      return null
    }
    const cnpjEncontrado = buscarCnpjRecursivo(vinculo)
    if (cnpjEncontrado) cnpj = cnpjEncontrado
  }
  
  // Última tentativa: busca por padrão de CNPJ na string JSON completa (14 dígitos ou 8–13 dígitos)
  if (!cnpj && vinculo) {
    try {
      const vinculoStr = JSON.stringify(vinculo)
      const cnpj14Matches = vinculoStr.match(/\d{14}/g)
      if (cnpj14Matches && cnpj14Matches.length > 0) {
        const unicos = [...new Set(cnpj14Matches)]
        for (const match of unicos) {
          if (/^\d{14}$/.test(match) && match !== '00000000000000' && !cnpjNaoPodeComecarComCpf(match)) {
            cnpj = match
            break
          }
        }
      }
      if (!cnpj) {
        const shortMatches = vinculoStr.match(/\d{8,13}/g)
        if (shortMatches) {
          const unicos = [...new Set(shortMatches)]
          for (const match of unicos) {
            if (/^\d{8,13}$/.test(match) && !(match.length === 11 && cpfNoVinculo && match === cpfNoVinculo)) {
              const padded = match.padStart(14, '0')
              if (padded !== '00000000000000' && !cnpjNaoPodeComecarComCpf(padded)) {
                cnpj = padded
                break
              }
            }
          }
        }
      }
    } catch (_e) {}
  }

  return {
    matricula: matricula ? String(matricula).trim() : '', 
    cnpj: cnpj ? String(cnpj).trim() : '' 
  }
}

/**
 * Valida se um vínculo tem matrícula e CNPJ válidos
 * Validação mais flexível: aceita vínculo se tiver matrícula OU CNPJ válido
 */
export function validarVinculo(vinculo: VinculoEmpregaticio): boolean {
  const { matricula, cnpj } = extrairMatriculaECnpj(vinculo)
  
  // Limpa e normaliza os valores
  const matriculaLimpa = matricula ? String(matricula).trim() : ''
  const cnpjLimpo = cnpj ? String(cnpj).replace(/\D/g, '') : ''
  
  // Validação mais flexível:
  // - Aceita se tiver matrícula válida (não vazia)
  // - OU se tiver CNPJ válido (14 dígitos)
  // - Idealmente ambos, mas aceita se tiver pelo menos um
  const matriculaValida = matriculaLimpa.length > 0
  const cnpjValido = cnpjLimpo.length >= 14
  
  return matriculaValida || cnpjValido
}

/**
 * Faz requisição HTTP com retry e backoff exponencial para rate limit
 */
export async function fazerRequisicaoComRetry(
  url: string,
  body: any,
  maxRetries = 3
): Promise<any> {
  for (let tentativa = 0; tentativa < maxRetries; tentativa++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      
      const isRateLimit = data.rateLimit || 
        (data.error && data.error.toLowerCase().includes('rate limit')) || 
        response.status === 429
      
      // Se for rate limit e ainda temos tentativas, espera antes de retentar
      if (!data.success && isRateLimit && tentativa < maxRetries - 1) {
        const delay = Math.min(3000 * Math.pow(2, tentativa), 30000) // 3s, 6s, 12s, max 30s
        console.log(`[Retry] Rate limit detectado. Tentativa ${tentativa + 1}/${maxRetries}. Aguardando ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      return data
    } catch (error: any) {
      // Se for a última tentativa, lança o erro
      if (tentativa === maxRetries - 1) {
        throw error
      }
      
      // Caso contrário, espera antes de retentar
      const delay = Math.min(3000 * Math.pow(2, tentativa), 30000)
      console.log(`[Retry] Erro na requisição. Tentativa ${tentativa + 1}/${maxRetries}. Aguardando ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return { success: false, error: 'Máximo de tentativas atingido' }
}

