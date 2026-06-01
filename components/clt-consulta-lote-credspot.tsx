"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, XCircle, FileSpreadsheet, Upload, Download, entidade, TrendingUp, DollarSign, Shield, ExternalLink, AlertCircle, RefreshCw, Clock } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"
import { getCredSpotCredentialsForRequest } from "@/lib/credspot-browser-credentials"
import { birthToIsoDate, normalizeCpfDigits, normalizePhoneDigits } from "@/lib/credspot-entidade-normalize"

interface ClientePlanilha {
  cpf: string
  nome: string
  dataNascimento: string // YYYY-MM-DD
  genero: string // 'M' ou 'F'
  telefone: string
  email: string
}

interface ResultadoConsulta {
  linha: number
  registro: ClientePlanilha
  sucesso: boolean
  relationshipInquiryUuid?: string
  userUuid?: string
  linkConsentimento?: string
  status?: string
  contractUuid?: string
  margemDisponivel?: number
  erro?: string
  etapa?: 'criando_usuario' | 'gerando_consentimento' | 'verificando' | 'consultando_margem' | 'concluido' | 'erro'
  /** True quando o link foi gerado e estamos apenas aguardando o registro autorizar (não é erro) */
  pendenteConsentimento?: boolean
}

export function CLTConsultaLoteCredSpot() {
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [atualizandoStatus, setAtualizandoStatus] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [registro, setClientes] = useState<ClientePlanilha[]>([])
  const [resultados, setResultados] = useState<ResultadoConsulta[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 })
  const [progressoAtualizacao, setProgressoAtualizacao] = useState({ atual: 0, total: 0, percentual: 0 })
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processamentoAtivoRef = useRef(false)

  const credSpotAuthPayload = (): { credspotCredentials: NonNullable<ReturnType<typeof getCredSpotCredentialsForRequest>> } | Record<string, never> => {
    const cred = getCredSpotCredentialsForRequest(apiSelecionada)
    return cred ? { credspotCredentials: cred } : {}
  }

  // Carrega APIs disponíveis (apenas CredSpot)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active && c.type === 'credspot')
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Função helper para fazer parse de linha CSV considerando aspas e separadores
  const parseCSVLine = (linha: string, separador: string): string[] => {
    const valores: string[] = []
    let valorAtual = ''
    let dentroAspas = false
    
    for (let i = 0; i < linha.length; i++) {
      const char = linha[i]
      const proximoChar = linha[i + 1]
      
      if (char === '"') {
        if (dentroAspas && proximoChar === '"') {
          valorAtual += '"'
          i++
        } else {
          dentroAspas = !dentroAspas
        }
      } else if (char === separador && !dentroAspas) {
        valores.push(valorAtual.trim())
        valorAtual = ''
      } else {
        valorAtual += char
      }
    }
    
    valores.push(valorAtual.trim())
    return valores
  }

  // Função para detectar separador CSV (vírgula ou ponto e vírgula)
  const detectarSeparador = (linha: string): string => {
    const contaVirgula = (linha.match(/,/g) || []).length
    const contaPontoVirgula = (linha.match(/;/g) || []).length
    return contaPontoVirgula > contaVirgula ? ';' : ','
  }

  // Função para normalizar data para YYYY-MM-DD
  const normalizarData = (data: string): string => {
    let dataLimpa = data.trim().replace(/\s+/g, '')
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataLimpa)) {
      return dataLimpa
    }
    
    if (dataLimpa.includes('/') || dataLimpa.includes('-')) {
      const separador = dataLimpa.includes('/') ? '/' : '-'
      const partes = dataLimpa.split(separador)
      
      if (partes.length === 3) {
        if (partes[0].length === 4) {
          return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`
        }
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
      }
    }
    
    console.warn('Data não pôde ser normalizada:', data)
    return dataLimpa
  }

  // Função para normalizar gênero
  const normalizarGenero = (genero: string): 'M' | 'F' => {
    const gen = genero.trim().toUpperCase()
    if (gen.includes('FEM') || gen.includes('MULHER') || gen === 'F' || gen === '2') {
      return 'F'
    }
    return 'M'
  }

  // Função para processar CSV
  const processarCSV = (texto: string): ClientePlanilha[] => {
    const textoNormalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const linhas = textoNormalizado.split('\n').filter(linha => linha.trim())
    
    if (linhas.length < 2) {
      throw new Error('Planilha deve ter pelo menos uma linha de cabeçalho e uma linha de dados')
    }

    const separador = detectarSeparador(linhas[0])
    const cabecalho = parseCSVLine(linhas[0], separador).map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''))
    
    // Mapear colunas esperadas (flexível)
    const indices: Record<string, number> = {}
    cabecalho.forEach((col, idx) => {
      if (col.includes('cpf')) indices.cpf = idx
      if (col.includes('nome')) indices.nome = idx
      if ((col.includes('data') && col.includes('nasc')) || col.includes('data_nascimento') || col.includes('dataNascimento')) indices.dataNascimento = idx
      if (col.includes('genero') || col.includes('gênero') || col.includes('sexo')) indices.genero = idx
      if (col.includes('telefone') || col.includes('celular') || col.includes('phone')) indices.telefone = idx
      if (col.includes('email') || col.includes('e-mail')) indices.email = idx
    })

    if (indices.cpf === undefined) {
      throw new Error('Planilha deve conter a coluna: CPF')
    }

    const dados: ClientePlanilha[] = []
    const linhasInvalidas: number[] = []
    
    for (let i = 1; i < linhas.length; i++) {
      const valores = parseCSVLine(linhas[i], separador).map(v => v.trim().replace(/^"|"$/g, ''))
      
      if (valores.length < cabecalho.length) continue

      // Processa CPF
      let cpfRaw = valores[indices.cpf].trim()
      
      if (!cpfRaw || cpfRaw === '') {
        linhasInvalidas.push(i + 1)
        continue
      }
      
      // Trata notação científica
      if (/[eE][+-]?\d+/.test(cpfRaw)) {
        try {
          const numero = parseFloat(cpfRaw.replace(',', '.'))
          if (!isNaN(numero)) {
            cpfRaw = Math.floor(numero).toString()
          }
        } catch (e) {
          console.warn(`Erro ao converter CPF de notação científica: ${cpfRaw}`, e)
        }
      }
      
      // Remove formatação e preenche com zeros
      let cpf = cpfRaw.replace(/\D/g, '')
      
      if (cpf.length > 0 && cpf.length < 11) {
        cpf = cpf.padStart(11, '0')
        console.log(`[CredSpot Lote] CPF corrigido com zeros à esquerda na linha ${i + 1}: ${cpfRaw} -> ${cpf}`)
      }
      
      if (cpf.length > 11) {
        cpf = cpf.slice(-11)
      }
      
      if (cpf.length !== 11) {
        console.warn(`[CredSpot Lote] CPF inválido na linha ${i + 1}: "${valores[indices.cpf]}" (${cpf.length} dígitos)`)
        linhasInvalidas.push(i + 1)
        continue
      }

      // Valida campos obrigatórios
      const nome = indices.nome !== undefined ? valores[indices.nome] : ''
      const email = indices.email !== undefined ? valores[indices.email] : ''
      const telefone = indices.telefone !== undefined ? valores[indices.telefone] : ''
      const dataNascimento = indices.dataNascimento !== undefined ? valores[indices.dataNascimento] : ''
      const genero = indices.genero !== undefined ? valores[indices.genero] : 'M'

      if (!nome || !email || !telefone || !dataNascimento) {
        linhasInvalidas.push(i + 1)
        continue
      }

      dados.push({
        cpf: cpf,
        nome: nome,
        email: email,
        telefone: telefone.replace(/\D/g, ''),
        dataNascimento: normalizarData(dataNascimento),
        genero: normalizarGenero(genero)
      })
    }

    if (linhasInvalidas.length > 0) {
      console.warn(`${linhasInvalidas.length} linha(s) foram ignoradas por terem dados inválidos. Linhas: ${linhasInvalidas.slice(0, 10).join(', ')}${linhasInvalidas.length > 10 ? '...' : ''}`)
    }

    return dados
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    setClientes([])
    setResultados([])
    setProgresso({ atual: 0, total: 0, percentual: 0 })
    setCancelado(false)
    setPausado(false)
    processamentoAtivoRef.current = false

    try {
      const texto = await file.text()
      const dados = processarCSV(texto)
      
      if (dados.length === 0) {
        alert('Nenhum registro válido encontrado no arquivo. Verifique se os campos estão corretos.')
        setArquivo(null)
        return
      }
      
      setClientes(dados)
    } catch (error: any) {
      alert(`Erro ao processar arquivo: ${error.message}`)
      setArquivo(null)
    }
  }

  // Função para processar todas as consultas automaticamente
  const processarConsultas = async () => {
    if (registro.length === 0) {
      alert('Por favor, carregue uma planilha com registro')
      return
    }

    if (!apiSelecionada) {
      alert('Por favor, selecione a API CredSpot')
      return
    }

    if (cancelado) {
      setResultados([])
      setCancelado(false)
    }

    setProcessando(true)
    setPausado(false)
    processamentoAtivoRef.current = true

    const inicio = resultados.length > 0 && !cancelado ? resultados.length : 0
    const resultadosTemp = cancelado ? [] : [...resultados]
    
    if (inicio === 0) {
      setProgresso({ atual: 0, total: registro.length, percentual: 0 })
    }

    for (let i = inicio; i < registro.length; i++) {
      // Verifica se foi cancelado
      if (cancelado || !processamentoAtivoRef.current) {
        break
      }

      // Verifica se está pausado
      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) {
        break
      }

      const registro = registro[i]
      
      // Atualiza progresso
      const percentual = Math.round(((i + 1) / registro.length) * 100)
      setProgresso({
        atual: i + 1,
        total: registro.length,
        percentual
      })

      let resultado: ResultadoConsulta = {
        linha: i + 2,
        registro,
        sucesso: false,
        etapa: 'criando_usuario'
      }

      try {
        const birthIso = birthToIsoDate(registro.dataNascimento)
        if (!birthIso) {
          throw new Error(
            `Data de nascimento inválida na linha ${resultado.linha}: "${registro.dataNascimento}". Use YYYY-MM-DD ou DD/MM/AAAA.`
          )
        }
        const docDigits = normalizeCpfDigits(registro.cpf)
        if (docDigits.length !== 11) {
          throw new Error(`CPF inválido na linha ${resultado.linha}: informe 11 dígitos (após normalização temos ${docDigits.length}).`)
        }
        const phoneDigits = normalizePhoneDigits(registro.telefone)
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
          throw new Error(`Telefone inválido na linha ${resultado.linha}: use DDD + número (10 ou 11 dígitos).`)
        }

        // ETAPA 1: Criar usuário e gerar link de consentimento
        console.log(`[CredSpot Lote] Processando CPF: ${registro.cpf} - Criando usuário e gerando consentimento...`)
        
        const consentResponse = await fetch('/api/produto/credspot/clt/consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiId: apiSelecionada,
            document: docDigits,
            name: registro.nome,
            mail: registro.email,
            phone: phoneDigits,
            birth: birthIso,
            ...(registro.genero === 'F' || registro.genero === 'M' ? { gender: registro.genero } : {}),
            ...credSpotAuthPayload(),
          }),
        })

        const consentData = await consentResponse.json()

        if (!consentData.success || !consentData.data) {
          throw new Error(consentData.error || 'Erro ao criar usuário ou gerar link de consentimento')
        }

        const consent = consentData.data
        resultado.relationshipInquiryUuid = consent.relationshipInquiryUuid
        resultado.userUuid = consent.userUuid
        resultado.linkConsentimento = consent.consentLink || consent.link
        resultado.etapa = 'gerando_consentimento'
        resultado.status = 'WAITING_CONSENT'
        
        console.log(`[CredSpot Lote] Link de consentimento gerado para ${registro.cpf}. UUID: ${consent.relationshipInquiryUuid}`)

        // Aguarda um pouco antes de verificar status (registro precisa autorizar)
        await new Promise(resolve => setTimeout(resolve, 2000))

        // ETAPA 2: Verificar status do consentimento (pode retornar contratos elegíveis)
        resultado.etapa = 'verificando'
        console.log(`[CredSpot Lote] Verificando status do consentimento para CPF: ${registro.cpf}...`)
        
        const statusResponse = await fetch('/api/produto/credspot/clt/consent-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            relationshipInquiryUuid: consent.relationshipInquiryUuid,
            apiId: apiSelecionada,
            ...credSpotAuthPayload(),
          }),
        })
        const statusData = await statusResponse.json()

        if (statusData.success && statusData.data) {
          const status = statusData.data
          resultado.status = status.status || 'WAITING_CONSENT'
          
          // Se o consentimento foi concluído e tem contratos elegíveis, tenta consultar margem
          if (status.contracts && Array.isArray(status.contracts) && status.contracts.length > 0) {
            const contractUuid = status.contracts[0].uuid
            resultado.contractUuid = contractUuid
            
            // ETAPA 3: Consultar margem
            resultado.etapa = 'consultando_margem'
            console.log(`[CredSpot Lote] Consultando margem para contrato ${contractUuid}...`)
            
            await new Promise(resolve => setTimeout(resolve, 2000)) // Aguarda um pouco antes de consultar margem
            
            const marginResponse = await fetch('/api/produto/credspot/clt/margin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                apiId: apiSelecionada,
                userUuid: consent.userUuid,
                eligibilityUuid: contractUuid,
                ...credSpotAuthPayload(),
              }),
            })

            const marginData = await marginResponse.json()

            if (marginData.success && marginData.data) {
              resultado.margemDisponivel = marginData.data.margin || marginData.data.availableMargin || 0
              resultado.sucesso = true
              resultado.etapa = 'concluido'
              console.log(`[CredSpot Lote] Margem consultada para ${registro.cpf}: ${resultado.margemDisponivel}`)
            } else {
              // Mesmo sem margem, se o consentimento foi aprovado, marca como sucesso
              const st = String(status.status || '').toLowerCase()
              if (st === 'completed' || st === 'consented' || st === 'success') {
                resultado.sucesso = true
                resultado.etapa = 'concluido'
              }
              console.warn(`[CredSpot Lote] Não foi possível consultar margem para ${registro.cpf}:`, marginData.error)
            }
          } else {
            // Consentimento ainda pendente: link gerado, aguardando registro autorizar (não é erro)
            resultado.sucesso = false
            resultado.pendenteConsentimento = true
            resultado.erro = 'Link gerado. Acesse o link para autorizar ou use "Atualizar Status" depois.'
          }
        } else {
          resultado.sucesso = false
          resultado.erro = statusData.error || 'Não foi possível verificar status do consentimento'
        }
      } catch (error: any) {
        resultado.sucesso = false
        resultado.etapa = 'erro'
        resultado.erro = error.message || 'Erro ao processar consulta'
        console.error(`[CredSpot Lote] Erro ao processar ${registro.cpf}:`, error)
      }

      resultadosTemp.push(resultado)
      setResultados([...resultadosTemp])

      // Delay entre requisições para respeitar rate limit (60 req/min = 1s entre requisições)
      // Como fazemos múltiplas requisições por registro, usamos 5 segundos
      if (i < registro.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // 5 segundos entre cada registro
      }
    }

    setProcessando(false)
    setPausado(false)
    processamentoAtivoRef.current = false
  }

  // Função para atualizar status de todos os registro processados
  const atualizarStatusTodos = async () => {
    if (!apiSelecionada) {
      alert('Por favor, selecione a API CredSpot')
      return
    }

    // Filtra apenas resultados que têm relationshipInquiryUuid
    const resultadosComUuid = resultados.filter(r => r.relationshipInquiryUuid)
    
    if (resultadosComUuid.length === 0) {
      alert('Nenhum registro com consentimento encontrado para atualizar status')
      return
    }

    setAtualizandoStatus(true)
    setProgressoAtualizacao({ atual: 0, total: resultadosComUuid.length, percentual: 0 })

    const resultadosAtualizados = [...resultados]

    for (let i = 0; i < resultadosComUuid.length; i++) {
      const resultado = resultadosComUuid[i]
      const indexOriginal = resultados.findIndex(r => r.relationshipInquiryUuid === resultado.relationshipInquiryUuid)

      if (indexOriginal === -1) continue

      try {
        // Verifica status atualizado do consentimento
        const statusResponse = await fetch('/api/produto/credspot/clt/consent-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            relationshipInquiryUuid: resultado.relationshipInquiryUuid,
            apiId: apiSelecionada,
            ...credSpotAuthPayload(),
          }),
        })
        const statusData = await statusResponse.json()

        if (statusData.success && statusData.data) {
          const status = statusData.data
          
          // Atualiza status
          resultadosAtualizados[indexOriginal].status = status.status || resultadosAtualizados[indexOriginal].status
          
          // Se o consentimento foi concluído e tem contratos, tenta consultar margem
          if (status.contracts && Array.isArray(status.contracts) && status.contracts.length > 0) {
            const contractUuid = status.contracts[0].uuid
            resultadosAtualizados[indexOriginal].contractUuid = contractUuid

            // Se não tem margem ainda, tenta consultar
            if (!resultadosAtualizados[indexOriginal].margemDisponivel || resultadosAtualizados[indexOriginal].margemDisponivel === 0) {
              const marginResponse = await fetch('/api/produto/credspot/clt/margin', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  apiId: apiSelecionada,
                  userUuid: resultadosAtualizados[indexOriginal].userUuid,
                  eligibilityUuid: contractUuid,
                  ...credSpotAuthPayload(),
                }),
              })

              const marginData = await marginResponse.json()

              if (marginData.success && marginData.data) {
                resultadosAtualizados[indexOriginal].margemDisponivel = marginData.data.margin || marginData.data.availableMargin || 0
              }
            }

            // Marca como sucesso se tem contrato
            const st2 = String(status.status || '').toLowerCase()
            if (st2 === 'completed' || st2 === 'consented' || st2 === 'success') {
              resultadosAtualizados[indexOriginal].sucesso = true
              resultadosAtualizados[indexOriginal].etapa = 'concluido'
              resultadosAtualizados[indexOriginal].pendenteConsentimento = false
              if (resultadosAtualizados[indexOriginal].erro?.includes('Link gerado')) {
                resultadosAtualizados[indexOriginal].erro = undefined
              }
            }
          }

          console.log(`[CredSpot Lote] Status atualizado para ${resultado.registro.cpf}: ${resultadosAtualizados[indexOriginal].status}`)
        }
      } catch (error: any) {
        console.error(`[CredSpot Lote] Erro ao atualizar status de ${resultado.registro.cpf}:`, error)
      }

      // Atualiza progresso
      const percentual = Math.round(((i + 1) / resultadosComUuid.length) * 100)
      setProgressoAtualizacao({
        atual: i + 1,
        total: resultadosComUuid.length,
        percentual
      })

      // Atualiza resultados na tela
      setResultados([...resultadosAtualizados])

      // Delay entre requisições
      if (i < resultadosComUuid.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    setAtualizandoStatus(false)
    setProgressoAtualizacao({ atual: 0, total: 0, percentual: 0 })
    console.log('[CredSpot Lote] ✅ Atualização de status concluída!')
  }

  const pausarProcessamento = () => {
    setPausado(true)
  }

  const retomarProcessamento = () => {
    setPausado(false)
  }

  const cancelarProcessamento = () => {
    setCancelado(true)
    setPausado(false)
    processamentoAtivoRef.current = false
    setProcessando(false)
  }

  // Função helper para escapar valores CSV
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Função helper para formatar linha CSV
  const formatarLinhaCSV = (valores: (string | number | undefined | null)[]): string => {
    return valores.map(escapeCSV).join(';')
  }

  const exportarResultados = () => {
    if (resultados.length === 0) {
      alert('Não há resultados para exportar')
      return
    }

    const cabecalho = [
      'Linha',
      'CPF',
      'Nome',
      'Email',
      'Telefone',
      'Data Nascimento',
      'Gênero',
      'Relationship Inquiry UUID',
      'entidade UUID',
      'Contract UUID',
      'Status',
      'Margem Disponível (R$)',
      'Link Consentimento',
      'Sucesso',
      'Erro'
    ]

    const linhas = resultados.map(r => [
      r.linha.toString(),
      r.registro.cpf,
      r.registro.nome,
      r.registro.email,
      r.registro.telefone,
      r.registro.dataNascimento,
      r.registro.genero,
      r.relationshipInquiryUuid || '',
      r.userUuid || '',
      r.contractUuid || '',
      r.status || '',
      (r.margemDisponivel != null && String(r.margemDisponivel) !== '' && !isNaN(Number(r.margemDisponivel)))
        ? Number(r.margemDisponivel).toFixed(2).replace('.', ',')
        : '',
      r.linkConsentimento || '',
      r.sucesso ? 'SIM' : 'NÃO',
      r.erro || ''
    ])

    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...linhas.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')

    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `consulta_credspot_lote_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const baixarTemplate = () => {
    const cabecalho = ['CPF', 'Nome', 'Email', 'Telefone', 'Data Nascimento', 'Gênero']
    const dados = [
      ['12345678900', 'João Silva', 'joao@exemplo.com', '11999887766', '1990-01-15', 'M'],
      ['98765432100', 'Maria Santos', 'maria@exemplo.com', '21988776655', '1985-05-20', 'F']
    ]
    
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...dados.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')
    
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_consulta_credspot_lote.csv'
    link.click()
  }

  const formatarMoeda = (valor: number | string | undefined | null): string => {
    if (valor === undefined || valor === null || valor === '') return 'N/A'
    const n = Number(valor)
    if (isNaN(n)) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(n)
  }

  const formatarStatus = (status: string | undefined): string => {
    if (!status) return 'N/A'
    const statusMap: Record<string, string> = {
      'WAITING_CONSENT': 'Aguardando Consentimento',
      'SUCCESS': 'Concluído',
      'COMPLETED': 'Concluído',
      'CONSENTED': 'Consentimento Aprovado',
      'REJECTED': 'Rejeitado',
      'FAILED': 'Falhou',
      'PENDING': 'Pendente'
    }
    return statusMap[status.toUpperCase()] || status
  }

  // Estatísticas
  const totalProcessados = resultados.length
  const sucessos = resultados.filter(r => r.sucesso).length
  const pendentes = resultados.filter(r => r.pendenteConsentimento).length
  const erros = resultados.filter(r => !r.sucesso && !r.pendenteConsentimento).length
  const comMargem = resultados.filter(r => {
    const m = Number(r.margemDisponivel)
    return r.sucesso && !isNaN(m) && m > 0
  }).length
  const valorTotalMargem = resultados
    .filter(r => !isNaN(Number(r.margemDisponivel)) && Number(r.margemDisponivel) > 0)
    .reduce((acc, r) => acc + Number(r.margemDisponivel), 0)

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
            </div>
            Consulta CredSpot em Lote
          </CardTitle>
          <CardDescription className="mt-2">
            Partner API CredSpot: importação CSV/Excel — cria usuário, gera consentimento, verifica status e consulta margem com <code className="text-xs bg-gray-100 px-1 rounded">userUuid</code> + <code className="text-xs bg-gray-100 px-1 rounded">eligibilityUuid</code>. Em produção, configure webhooks (ex.: <code className="text-xs">POST /api/webhooks/credspot</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seleção de API */}
            {apisDisponiveis.length > 0 ? (
              <div>
                <Label htmlFor="api">API CredSpot *</Label>
                <select
                  id="api"
                  value={apiSelecionada}
                  onChange={(e) => setApiSelecionada(e.target.value)}
                  required
                  disabled={processando}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="">Selecione uma API...</option>
                  {apisDisponiveis.map((api) => (
                    <option key={api.id} value={api.id}>
                      {api.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  Nenhuma API CredSpot configurada. Configure na seção de Configurações.
                </AlertDescription>
              </Alert>
            )}

            {/* Upload de Arquivo */}
            <div>
              <Label htmlFor="arquivo">Arquivo CSV/Excel com Dados dos registro</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  ref={fileInputRef}
                  id="arquivo"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={baixarTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Template
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O arquivo deve conter as colunas: <strong>CPF</strong>, <strong>Nome</strong>, <strong>Email</strong>, <strong>Telefone</strong>, <strong>Data Nascimento</strong> (YYYY-MM-DD), <strong>Gênero</strong> (M/F)
              </p>
            </div>

            {/* Info do Arquivo */}
            {registro.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>{registro.length}</strong> registro(s) encontrado(s) no arquivo.
                  Clique em "Processar Consultas" para iniciar.
                </AlertDescription>
              </Alert>
            )}

            {/* Progresso */}
            {processando && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Processando: <strong>{progresso.atual}</strong> de <strong>{progresso.total}</strong>
                    {pausado && (
                      <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                        Pausado
                      </Badge>
                    )}
                  </span>
                  <span className="text-gray-600 font-medium">{progresso.percentual}%</span>
                </div>
                <Progress value={progresso.percentual} className="h-2" />
                {resultados.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Etapa atual: {resultados[resultados.length - 1]?.etapa === 'criando_usuario' ? 'Criando Usuário' :
                                  resultados[resultados.length - 1]?.etapa === 'gerando_consentimento' ? 'Gerando Consentimento' :
                                  resultados[resultados.length - 1]?.etapa === 'verificando' ? 'Verificando Status' :
                                  resultados[resultados.length - 1]?.etapa === 'consultando_margem' ? 'Consultando Margem' :
                                  resultados[resultados.length - 1]?.etapa === 'concluido' ? 'Concluído' : 'Erro'}
                  </p>
                )}
              </div>
            )}

            {/* Botões de Controle */}
            <div className="flex gap-2">
              {!processando ? (
                <Button
                  onClick={processarConsultas}
                  disabled={registro.length === 0 || !apiSelecionada}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                  size="lg"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Processar Consultas ({registro.length} registro(s))
                </Button>
              ) : (
                <>
                  {pausado ? (
                    <Button
                      onClick={retomarProcessamento}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                      size="lg"
                    >
                      Retomar Processamento
                    </Button>
                  ) : (
                    <Button
                      onClick={pausarProcessamento}
                      variant="outline"
                      className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      size="lg"
                    >
                      Pausar
                    </Button>
                  )}
                  <Button
                    onClick={cancelarProcessamento}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    size="lg"
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {totalProcessados > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Estatísticas do Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{sucessos}</div>
                <div className="text-xs text-green-600">Sucessos</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-2xl font-bold text-amber-700">{pendentes}</div>
                <div className="text-xs text-amber-600">Pendentes</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{erros}</div>
                <div className="text-xs text-red-600">Erros</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{comMargem}</div>
                <div className="text-xs text-blue-600">Com Margem</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <div className="text-2xl font-bold text-indigo-700">
                  {formatarMoeda(valorTotalMargem)}
                </div>
                <div className="text-xs text-indigo-600">Margem Total</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {/* Botão para atualizar status */}
              {!processando && resultados.length > 0 && resultados.some(r => r.relationshipInquiryUuid) && (
                <Button
                  onClick={atualizarStatusTodos}
                  disabled={atualizandoStatus || !apiSelecionada}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {atualizandoStatus ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando Status... ({progressoAtualizacao.atual}/{progressoAtualizacao.total})
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar Status de Todos os registro
                    </>
                  )}
                </Button>
              )}
              
              {/* Barra de progresso da atualização */}
              {atualizandoStatus && progressoAtualizacao.total > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      Atualizando: <strong>{progressoAtualizacao.atual}</strong> de <strong>{progressoAtualizacao.total}</strong>
                    </span>
                    <span className="font-medium">{progressoAtualizacao.percentual}%</span>
                  </div>
                  <Progress value={progressoAtualizacao.percentual} className="h-1.5" />
                </div>
              )}

              <Button
                onClick={exportarResultados}
                variant="outline"
                className="w-full border-green-600 text-green-700 hover:bg-green-50"
                disabled={atualizandoStatus}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Resultados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resultados Detalhados</CardTitle>
            <CardDescription>
              {totalProcessados} registro(s) processado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">CPF</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-right p-2">Margem</th>
                    <th className="text-center p-2">Resultado</th>
                    <th className="text-left p-2">Link</th>
                    <th className="text-left p-2">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.slice(0, 100).map((resultado, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{resultado.registro.cpf}</td>
                      <td className="p-2">{resultado.registro.nome}</td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={
                          resultado.status?.toUpperCase().includes('COMPLETED') || resultado.status?.toUpperCase().includes('CONSENTED') || resultado.status?.toUpperCase().includes('SUCCESS')
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : resultado.status?.toUpperCase().includes('REJECTED') || resultado.status?.toUpperCase().includes('FAILED')
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }>
                          {formatarStatus(resultado.status)}
                        </Badge>
                      </td>
                      <td className="p-2 text-right font-medium text-green-600">
                        {(resultado.margemDisponivel != null && String(resultado.margemDisponivel) !== '' && !isNaN(Number(resultado.margemDisponivel)))
                        ? formatarMoeda(resultado.margemDisponivel)
                        : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {resultado.sucesso ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : resultado.pendenteConsentimento ? (
                          <Clock className="h-4 w-4 text-amber-500 mx-auto" aria-label="Aguardando autorização" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-2 text-xs text-blue-600 max-w-xs">
                        {resultado.linkConsentimento && (
                          <a 
                            href={resultado.linkConsentimento}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-blue-800 hover:underline"
                            title="Link para consentimento"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="truncate">Abrir Link</span>
                          </a>
                        )}
                      </td>
                      <td className={`p-2 text-xs max-w-xs ${resultado.pendenteConsentimento ? 'text-amber-600' : 'text-red-600'}`}>
                        <div className="truncate" title={resultado.erro || ''}>
                          {resultado.erro || '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultados.length > 100 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Mostrando 100 primeiros resultados. Exporte o CSV para ver todos.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
