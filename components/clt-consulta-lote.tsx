"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select } from "@/components/ui/select"
import { Loader2, CheckCircle2, XCircle, FileSpreadsheet, Upload, Download, entidade, TrendingUp, DollarSign, Pause, Play, Square, ArrowRight, Calculator, Shield, ShieldCheck, ExternalLink } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface ClienteCSV {
  cpf: string
  nome?: string
  cnpjEmpregador?: string
  serviceType?: string
  telefone?: string
  celular?: string
}

interface ResultadoConsulta {
  linha: number
  cpf: string
  nome?: string
  sucesso: boolean
  elegivel?: boolean
  valorLiberado?: number
  valorDisponivel?: number
  valorLimite?: number
  salario?: number
  organizacao?: string
  cnpjEmpregador?: string
  matricula?: string
  idCotacao?: string
  quantidadeVinculos?: number
  bancoOrigem?: string
  erro?: string
  mensagemErro?: string
  authorizationLink?: string // Link para completar autorização
}

interface CLTConsultaLoteProps {
  /** Restringe o seletor de API a um tipo (ex.: consulta em lote só Nossa Fintech). */
  apiTypeFilter?: ApiConfig['type']
  /** API pré-selecionada ao abrir a tela. */
  defaultApiId?: string
}

export function CLTConsultaLote({ apiTypeFilter, defaultApiId }: CLTConsultaLoteProps = {}) {
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [autorizando, setAutorizando] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [registro, setClientes] = useState<ClienteCSV[]>([])
  const [resultados, setResultados] = useState<ResultadoConsulta[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 })
  const [progressoAutorizacao, setProgressoAutorizacao] = useState({ atual: 0, total: 0, percentual: 0 })
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [linksAutorizacao, setLinksAutorizacao] = useState<Record<string, string>>({}) // CPF -> Link de autorização
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processamentoAtivoRef = useRef(false)

  // Carrega APIs disponíveis ao montar o componente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        let configs = manager.getConfigs().filter(c => c.active)
        if (apiTypeFilter) {
          configs = configs.filter(c => c.type === apiTypeFilter)
        }
        setApisDisponiveis(configs)
        // Define a API padrão como selecionada
        if (configs.length > 0) {
          const preferredId =
            (defaultApiId && configs.some(c => c.id === defaultApiId) ? defaultApiId : null) ||
            configs.find(c => c.type === 'nossafintech')?.id ||
            manager.getDefaultApiId() ||
            configs[0].id
          setApiSelecionada(preferredId)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [apiTypeFilter, defaultApiId])

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
          // Aspas duplas = aspas literal
          valorAtual += '"'
          i++ // Pula o próximo caractere
        } else {
          // Toggle dentro/fora das aspas
          dentroAspas = !dentroAspas
        }
      } else if (char === separador && !dentroAspas) {
        // Separador encontrado fora de aspas
        valores.push(valorAtual.trim())
        valorAtual = ''
      } else {
        valorAtual += char
      }
    }
    
    // Adiciona o último valor
    valores.push(valorAtual.trim())
    
    return valores
  }

  // Função para detectar separador CSV (vírgula ou ponto e vírgula)
  const detectarSeparador = (linha: string): string => {
    const contaVirgula = (linha.match(/,/g) || []).length
    const contaPontoVirgula = (linha.match(/;/g) || []).length
    return contaPontoVirgula > contaVirgula ? ';' : ','
  }

  // Função para processar CSV
  const processarCSV = (texto: string): ClienteCSV[] => {
    // Normalizar quebras de linha
    const textoNormalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const linhas = textoNormalizado.split('\n').filter(linha => linha.trim())
    
    if (linhas.length < 2) {
      throw new Error('Planilha deve ter pelo menos uma linha de cabeçalho e uma linha de dados')
    }

    // Detectar separador
    const separador = detectarSeparador(linhas[0])
    const cabecalho = parseCSVLine(linhas[0], separador).map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''))
    
    // Mapear colunas esperadas
    const indices: Record<string, number> = {}
    cabecalho.forEach((col, idx) => {
      if (col.includes('cpf')) indices.cpf = idx
      if (col.includes('nome')) indices.nome = idx
      // Para Nossa Fintech: CNPJ do empregador, service_type e telefone/celular
      if (col.includes('cnpj') && (col.includes('empregador') || col.includes('organizacao'))) indices.cnpjEmpregador = idx
      if (col.includes('service') && col.includes('type')) indices.serviceType = idx
      if (col.includes('service_type')) indices.serviceType = idx
      if (col.includes('telefone') || col.includes('celular') || col.includes('phone')) indices.telefone = idx
    })

    if (indices.cpf === undefined) {
      throw new Error('Planilha deve conter a coluna: cpf')
    }

    const dados: ClienteCSV[] = []
    const cpfsInvalidos: number[] = []
    const cnpjsCorrigidos: Array<{ linha: number; original: string; corrigido: string }> = []
    
    for (let i = 1; i < linhas.length; i++) {
      const valores = parseCSVLine(linhas[i], separador).map(v => v.trim().replace(/^"|"$/g, ''))
      
      if (valores.length < cabecalho.length) continue

      let cpfRaw = valores[indices.cpf].trim()
      
      // Trata notação científica (improvável para CPF, mas pode acontecer)
      if (/[eE][+-]?\d+/.test(cpfRaw)) {
        try {
          const numero = parseFloat(cpfRaw.replace(',', '.'))
          if (!isNaN(numero)) {
            cpfRaw = Math.floor(numero).toString()
            console.log(`[CLT Consulta Lote] CPF convertido de notação científica: ${valores[indices.cpf]} -> ${cpfRaw}`)
          }
        } catch (e) {
          console.warn(`[CLT Consulta Lote] Erro ao converter CPF de notação científica: ${cpfRaw}`, e)
        }
      }
      
      // Remove formatação (pontos, hífens, espaços)
      let cpf = cpfRaw.replace(/\D/g, '')
      
      // Se o CPF tem menos de 11 dígitos, adiciona zeros à esquerda
      // Isso corrige o problema de CPFs que começam com zero serem formatados pelo Excel
      if (cpf.length < 11 && cpf.length > 0) {
        cpf = cpf.padStart(11, '0')
        console.log(`[CLT Consulta Lote] CPF corrigido com zeros à esquerda na linha ${i + 1}: ${cpfRaw} -> ${cpf}`)
      }
      
      // Validação rigorosa: CPF deve ter exatamente 11 dígitos
      if (cpf.length !== 11) {
        console.warn(`[CLT Consulta Lote] CPF inválido na linha ${i + 1}: "${valores[indices.cpf]}" (${cpf.length} dígitos após processamento)`)
        cpfsInvalidos.push(i + 1) // +1 porque linha 1 é cabeçalho
        continue
      }

      // Processa CNPJ do empregador se disponível
      let cnpjEmpregador: string | undefined = undefined
      if (indices.cnpjEmpregador !== undefined) {
        let cnpjRaw = valores[indices.cnpjEmpregador].trim()
        
        const cnpjOriginal = cnpjRaw
        
        // Trata notação científica (ex: "4,41073E+13" ou "4.41073E+13")
        // Isso acontece quando o Excel/Google Sheets converte números grandes
        if (/[eE][+-]?\d+/.test(cnpjRaw)) {
          try {
            // Converte notação científica para número
            const numero = parseFloat(cnpjRaw.replace(',', '.'))
            if (!isNaN(numero)) {
              // Converte para string sem notação científica e remove decimais
              cnpjRaw = Math.floor(numero).toString()
              console.log(`[CLT Consulta Lote] CNPJ convertido de notação científica: ${cnpjOriginal} -> ${cnpjRaw}`)
            }
          } catch (e) {
            console.warn(`[CLT Consulta Lote] Erro ao converter CNPJ de notação científica: ${cnpjRaw}`, e)
          }
        }
        
        // Remove formatação (pontos, barras, hífens, espaços)
        cnpjRaw = cnpjRaw.replace(/\D/g, '')
        
        // Valida e corrige CNPJ
        if (cnpjRaw.length === 14) {
          cnpjEmpregador = cnpjRaw
          // Se o original estava em notação científica ou tinha formatação, registra a correção
          if (cnpjOriginal !== cnpjEmpregador && (cnpjOriginal.includes('E') || cnpjOriginal.includes('e') || /[^\d]/.test(cnpjOriginal))) {
            cnpjsCorrigidos.push({ linha: i + 1, original: cnpjOriginal, corrigido: cnpjEmpregador })
          }
        } else if (cnpjRaw.length > 0 && cnpjRaw.length < 14) {
          // Tenta corrigir CNPJ com zeros à esquerda (comum quando Excel remove zeros iniciais)
          cnpjEmpregador = cnpjRaw.padStart(14, '0')
          cnpjsCorrigidos.push({ linha: i + 1, original: cnpjOriginal, corrigido: cnpjEmpregador })
          console.log(`[CLT Consulta Lote] CNPJ corrigido com zeros à esquerda: ${cnpjRaw} -> ${cnpjEmpregador}`)
        } else if (cnpjRaw.length > 14) {
          // Se tiver mais de 14 dígitos, pega os últimos 14 (pode ter formatação extra)
          cnpjEmpregador = cnpjRaw.slice(-14)
          cnpjsCorrigidos.push({ linha: i + 1, original: cnpjOriginal, corrigido: cnpjEmpregador })
          console.warn(`[CLT Consulta Lote] CNPJ truncado de ${cnpjRaw.length} para 14 dígitos: ${cnpjRaw} -> ${cnpjEmpregador}`)
        }
        
        // Valida se não é apenas zeros (inválido)
        if (cnpjEmpregador && (cnpjEmpregador === '00000000000000' || /^0+$/.test(cnpjEmpregador))) {
          console.warn(`[CLT Consulta Lote] CNPJ inválido (apenas zeros) na linha ${i + 1}: ${cnpjOriginal}`)
          cnpjEmpregador = undefined
        }
      }

      // Processa service_type se disponível
      const serviceType = indices.serviceType !== undefined ? valores[indices.serviceType]?.trim() : undefined

      // Processa telefone/celular se disponível
      const telefone = indices.telefone !== undefined ? valores[indices.telefone]?.trim() : undefined

      // Normaliza nome para garantir encoding correto (UTF-8)
      let nome = indices.nome !== undefined ? valores[indices.nome] : undefined
      if (nome) {
        // Remove caracteres de controle e normaliza espaços
        nome = nome.replace(/[\x00-\x1F\x7F]/g, '').trim()
      }
      
      dados.push({
        cpf: cpf,
        nome: nome,
        cnpjEmpregador: cnpjEmpregador,
        serviceType: serviceType,
        telefone: telefone
      })
    }

    // Avisa sobre CPFs inválidos
    if (cpfsInvalidos.length > 0) {
      const mensagem = `Atenção: ${cpfsInvalidos.length} linha(s) foram ignoradas por terem CPF inválido (vazio ou não pode ser corrigido para 11 dígitos).\nLinhas: ${cpfsInvalidos.slice(0, 10).join(', ')}${cpfsInvalidos.length > 10 ? '...' : ''}`
      console.warn(mensagem)
      // Não bloqueia o processamento, apenas avisa
    }
    
    // Avisa sobre CNPJs corrigidos (notação científica ou zeros removidos)
    if (cnpjsCorrigidos.length > 0) {
      const mensagem = `ℹ️ ${cnpjsCorrigidos.length} CNPJ(s) foram corrigidos automaticamente (notação científica ou zeros removidos pelo Excel).\nExemplos: ${cnpjsCorrigidos.slice(0, 3).map(c => `Linha ${c.linha}: ${c.original} -> ${c.corrigido}`).join(', ')}${cnpjsCorrigidos.length > 3 ? '...' : ''}`
      console.log(mensagem)
      // Não bloqueia o processamento, apenas informa
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
      // Lê o arquivo como texto (UTF-8 por padrão no navegador)
      // Se o arquivo tiver encoding incorreto, tenta normalizar
      let texto = await file.text()
      
      // Tenta detectar e corrigir encoding se necessário
      // Se houver caracteres estranhos, pode ser que o arquivo esteja em outro encoding
      // Mas o file.text() já trata UTF-8, então isso é mais uma precaução
      
      const dados = processarCSV(texto)
      
      if (dados.length === 0) {
        alert('Nenhum CPF válido encontrado no arquivo. Verifique se os CPFs têm exatamente 11 dígitos.')
        setArquivo(null)
        return
      }
      
      setClientes(dados)
    } catch (error: any) {
      alert(`Erro ao processar arquivo: ${error.message}`)
      setArquivo(null)
    }
  }

  // Função para autorizar todos os registro e depois consultar margem
  const autorizarEConsultar = async () => {
    if (registro.length === 0) {
      alert('Por favor, carregue uma planilha com CPFs')
      return
    }

    if (!apiSelecionada) {
      alert('Por favor, selecione um banco para realizar as consultas')
      return
    }

    const apiSelecionadaConfig = apisDisponiveis.find(a => a.id === apiSelecionada)
    
    // Só funciona para Nossa Fintech
    if (apiSelecionadaConfig?.type !== 'nossafintech') {
      alert('Autorização automática só está disponível para Nossa Fintech')
      return
    }

    // Verifica se os registro têm os dados necessários
    const clientesComDados = registro.filter(c => 
      c.cpf && 
      c.nome && 
      (c.telefone || c.celular) &&
      c.serviceType
    )

    if (clientesComDados.length === 0) {
      alert('Os registro precisam ter: CPF, Nome, Telefone e serviceType no CSV')
      return
    }

    setAutorizando(true)
    setProgressoAutorizacao({ atual: 0, total: clientesComDados.length, percentual: 0 })

    const autorizacoesSucesso: string[] = []
    const autorizacoesErro: string[] = []
    const novosLinks: Record<string, string> = {} // CPF -> Link de autorização (temporário para esta execução)

    try {
      // Autoriza cada registro
      for (let i = 0; i < clientesComDados.length; i++) {
        const registro = clientesComDados[i]
        
        // Verifica se foi cancelado
        if (cancelado) {
          break
        }

        const cpfProcessado = registro.cpf.replace(/\D/g, '').padStart(11, '0')
        // Usa telefone do CSV ou padrão
        const telefoneCliente = registro.telefone || registro.celular || '(99)99999-9999'
        const nomeCliente = registro.nome || `registro ${cpfProcessado}`

        // Obtém a configuração da API selecionada
        const requestBody: any = {
          cpf: cpfProcessado,
          nomeCompleto: nomeCliente,
          telefone: telefoneCliente,
          serviceType: registro.serviceType || 'QITECH',
          apiId: apiSelecionada
        }

        // Para Nossa Fintech, envia credenciais se necessário
        if ((apiSelecionadaConfig as any).promotId) {
          requestBody.credentials = {
            username: apiSelecionadaConfig.username,
            ******: apiSelecionadaConfig.******,
            baseUrl: apiSelecionadaConfig.baseUrl,
            promotId: (apiSelecionadaConfig as any).promotId
          }
        }

        try {
          // PRIMEIRO: Verifica se já existe autorização válida
          console.log(`[CLT Consulta Lote] Verificando status da autorização para CPF: ${cpfProcessado}`)
          const statusResponse = await fetch('/api/produto/verificar-status-clt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cpf: cpfProcessado,
              serviceType: registro.serviceType || 'QITECH',
              apiId: apiSelecionada,
              credentials: requestBody.credentials
            })
          })
          
          const statusData = await statusResponse.json()
          let status = null
          
          if (statusData.success && statusData.data) {
            // A resposta tem estrutura aninhada:
            // { success: true, data: { success: true, data: { status: "PENDING", authorization_link: "..." }, status: "PENDING" } }
            const dataObj = statusData.data
            
            // Extrai status verificando múltiplos níveis (prioriza data.data.status, depois data.status)
            if (dataObj.data?.status) {
              status = dataObj.data.status
            } else if (dataObj.status) {
              status = dataObj.status
            } else if (statusData.status) {
              status = statusData.status
            } else if (dataObj.authorization_status) {
              status = dataObj.authorization_status
            } else if (dataObj.authorized !== undefined) {
              status = dataObj.authorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
            } else if (dataObj.is_authorized !== undefined) {
              status = dataObj.is_authorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
            } else if (dataObj.confirmed !== undefined) {
              status = dataObj.confirmed ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
            } else if (typeof dataObj === 'string') {
              status = dataObj
            }
            
            // Normaliza para comparação
            if (status) {
              status = String(status).toUpperCase().trim()
            }
            
            console.log(`[CLT Consulta Lote] Status da autorização para CPF ${cpfProcessado}:`, status)
            console.log(`[CLT Consulta Lote] Estrutura completa da resposta de status:`, JSON.stringify(statusData, null, 2))
            
            // Armazena link de autorização se disponível (pode estar em data.data.authorization_link ou data.authorization_link)
            const authLink = dataObj.data?.authorization_link || dataObj.authorization_link
            if (authLink && !novosLinks[cpfProcessado]) {
              novosLinks[cpfProcessado] = authLink
            }
          }
          
          // Se já está AUTHORIZED (ou variações), não precisa criar nova autorização
          if (status && (status === 'AUTHORIZED' || status === 'AUTORIZADO' || status === 'CONFIRMED')) {
            autorizacoesSucesso.push(cpfProcessado)
            console.log(`[CLT Consulta Lote] CPF ${cpfProcessado} já possui autorização válida (AUTHORIZED). Pulando criação.`)
            // Atualiza progresso e continua
            const percentual = Math.round(((i + 1) / clientesComDados.length) * 100)
            setProgressoAutorizacao({
              atual: i + 1,
              total: clientesComDados.length,
              percentual
            })
            await new Promise(resolve => setTimeout(resolve, 200)) // Pequeno delay
            continue
          }
          
          // Se não está AUTHORIZED, cria/atualiza autorização
          console.log(`[CLT Consulta Lote] Criando/atualizando autorização para CPF: ${cpfProcessado} (status atual: ${status || 'desconhecido'})`)
          const response = await fetch('/api/produto/autorizar-clt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })

          const data = await response.json()

          if (data.success) {
            autorizacoesSucesso.push(cpfProcessado)
            
            // Extrai status da resposta (pode estar em data.data.status ou data.status)
            const authStatus = data.data?.status || data.data?.data?.status
            
            // Conforme documentação: quando já existe autorização ativa, retorna status "AUTHORIZED"
            if (authStatus === 'AUTHORIZED' || authStatus === 'AUTORIZADO') {
              console.log(`[CLT Consulta Lote] CPF ${cpfProcessado} já possui autorização ativa (AUTHORIZED).`)
            } else {
              console.log(`[CLT Consulta Lote] Autorização criada para CPF: ${cpfProcessado} (status: ${authStatus || 'PENDING'})`)
            }
            
            // Armazena link de autorização se disponível (só para casos PENDING)
            // A estrutura pode ser: data.data.data.authorization_link ou data.data.authorization_link
            const authorizationLink = data.data?.data?.authorization_link || data.data?.authorization_link
            if (authorizationLink) {
              novosLinks[cpfProcessado] = authorizationLink
              console.log(`[CLT Consulta Lote] Link de autorização para CPF ${cpfProcessado}:`, authorizationLink)
            } else if (authStatus !== 'AUTHORIZED' && authStatus !== 'AUTORIZADO') {
              // Log apenas se não for autorizado (para evitar logs desnecessários)
              console.log(`[CLT Consulta Lote] Resposta completa da autorização para CPF ${cpfProcessado}:`, JSON.stringify(data, null, 2))
            }
          } else {
            autorizacoesErro.push(cpfProcessado)
            console.error(`[CLT Consulta Lote] Erro ao autorizar CPF ${cpfProcessado}:`, data.error)
          }
        } catch (error: any) {
          autorizacoesErro.push(cpfProcessado)
          console.error(`Erro ao verificar/criar autorização para CPF ${cpfProcessado}:`, error)
        }

        // Atualiza progresso
        const percentual = Math.round(((i + 1) / clientesComDados.length) * 100)
        setProgressoAutorizacao({
          atual: i + 1,
          total: clientesComDados.length,
          percentual
        })

        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      setAutorizando(false)
      
      // Atualiza os links de autorização no estado (para usar durante consulta)
      if (Object.keys(novosLinks).length > 0) {
        setLinksAutorizacao(prev => ({ ...prev, ...novosLinks }))
      }

      // Mostra resultado da autorização
      const mensagem = `Autorização concluída:\n✅ ${autorizacoesSucesso.length} solicitação(ões) enviada(s) com sucesso\n${autorizacoesErro.length > 0 ? `❌ ${autorizacoesErro.length} com erro\n` : ''}\n\n⚠️ IMPORTANTE: As autorizações precisam ser confirmadas pelo registro via SMS antes de consultar a margem.\n\nDeseja consultar a margem agora mesmo assim? (Alguns registro podem ter autorização já confirmada)`
      
      if (confirm(mensagem)) {
        // Continua automaticamente com a consulta de margem
        await processarConsultas()
      } else {
        alert('Você pode consultar a margem depois clicando em "Processar Consultas" quando as autorizações forem confirmadas pelos registro.')
      }
    } catch (error: any) {
      setAutorizando(false)
      alert(`Erro ao autorizar registro: ${error.message}`)
    }
  }

  const processarConsultas = async () => {
    if (registro.length === 0) {
      alert('Por favor, carregue uma planilha com CPFs')
      return
    }

    if (!apiSelecionada) {
      alert('Por favor, selecione um banco para realizar as consultas')
      return
    }

    // Se foi cancelado, limpa e recomeça
    if (cancelado) {
      setResultados([])
      setCancelado(false)
    }

    setProcessando(true)
    setPausado(false)
    processamentoAtivoRef.current = true

    // Se já tem resultados, continua de onde parou
    const inicio = resultados.length > 0 && !cancelado ? resultados.length : 0
    const resultadosTemp = cancelado ? [] : [...resultados]
    
    if (inicio === 0) {
      setProgresso({ atual: 0, total: registro.length, percentual: 0 })
    } else {
      // Atualiza progresso baseado no que já foi processado
      const percentual = Math.round((inicio / registro.length) * 100)
      setProgresso({
        atual: inicio,
        total: registro.length,
        percentual
      })
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

      // Verifica novamente após pausar
      if (cancelado || !processamentoAtivoRef.current) {
        break
      }

      const registro = registro[i]
      
      // Garante que o CPF tem 11 dígitos (adiciona zeros à esquerda se necessário)
      let cpfProcessado = registro.cpf.replace(/\D/g, '')
      if (cpfProcessado.length < 11 && cpfProcessado.length > 0) {
        cpfProcessado = cpfProcessado.padStart(11, '0')
      }
      
      // Se após processar ainda não tiver 11 dígitos, pula este registro
      if (cpfProcessado.length !== 11) {
        resultadosTemp.push({
          linha: i + 2,
          cpf: registro.cpf, // Mantém o original para referência
          nome: registro.nome,
          sucesso: false,
          elegivel: false,
          quantidadeVinculos: 0,
          bancoOrigem: undefined,
          erro: 'CPF inválido',
          mensagemErro: `CPF inválido: deve ter 11 dígitos (encontrado: ${cpfProcessado.length})`
        })
        
        const percentual = Math.round(((i + 1) / registro.length) * 100)
        setProgresso({
          atual: i + 1,
          total: registro.length,
          percentual
        })
        setResultados([...resultadosTemp])
        continue
      }
      
      try {
        // Obtém a configuração da API selecionada para enviar credenciais se necessário
        const apiSelecionadaConfig = apisDisponiveis.find(a => a.id === apiSelecionada)
        const requestBody: any = {
          cpfTrabalhador: cpfProcessado,
          apiId: apiSelecionada
        }
        
        // Para Nossa Fintech, envia campos adicionais obrigatórios
        if (apiSelecionadaConfig?.type === 'nossafintech') {
          // Envia credenciais (promotId)
          if ((apiSelecionadaConfig as any).promotId) {
            requestBody.credentials = {
              username: apiSelecionadaConfig.username,
              ******: apiSelecionadaConfig.******,
              baseUrl: apiSelecionadaConfig.baseUrl,
              promotId: (apiSelecionadaConfig as any).promotId
            }
          }
          
          // CNPJ opcional — a API localiza o vínculo apenas com CPF
          if (registro.cnpjEmpregador) {
            const cnpjLimpo = registro.cnpjEmpregador.replace(/\D/g, '').padStart(14, '0')
            if (cnpjLimpo !== '00000000000000' && !/^0+$/.test(cnpjLimpo)) {
              requestBody.cnpjEmpregador = cnpjLimpo
            }
          }

          requestBody.serviceType = registro.serviceType?.trim() || 'QITECH'
          
          // Envia telefone/celular se disponível (ou a API usará padrão)
          if (registro.telefone) {
            requestBody.telefone = registro.telefone
          }
        }
        
        // Consulta apenas a API selecionada
        const response = await fetch('/api/produto/consultar-clt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        const data = await response.json()
        
        // Debug detalhado para registro com erro
        if (!data.success && apiSelecionadaConfig?.type === 'nossafintech') {
          console.log(`[CLT Consulta Lote] Erro para CPF ${cpfProcessado}:`, {
            erro: data.error,
            cnpjEmpregador: requestBody.cnpjEmpregador,
            serviceType: requestBody.serviceType,
            telefone: requestBody.telefone
          })
        }
        
        // Debug: log da resposta para entender a estrutura
        if (i === 0) {
          console.log('Resposta da API para primeiro registro:', JSON.stringify(data, null, 2))
        }
        
        // Se a requisição falhou completamente
        if (!data.success) {
          let mensagemErro = data.error || 'Erro ao consultar APIs'
          let isAutorizacaoErro = false
          
          // Para Nossa Fintech, trata erros de forma especial
          if (apiSelecionadaConfig?.type === 'nossafintech') {
            // Erro 500: Erro interno da API
            if (mensagemErro.includes('500') || mensagemErro.includes('INTERNAL SERVER ERROR')) {
              mensagemErro = '⚠️ Erro 500: Erro interno na API da Nossa Fintech. Pode ser:\n• Problema temporário na API\n• Dados inválidos (CPF, CNPJ ou service_type)\n• Problema de configuração\n\nTente novamente mais tarde ou verifique os dados do registro.'
            }
            // Erro de autorização - verifica status antes de definir mensagem
            else if (mensagemErro.includes('autorização')) {
              isAutorizacaoErro = true
              
              // Tenta verificar o status da autorização para dar mensagem mais precisa
              try {
                const statusResponse = await fetch('/api/produto/verificar-status-clt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    cpf: cpfProcessado,
                    serviceType: registro.serviceType || 'QITECH',
                    apiId: apiSelecionada,
                    credentials: requestBody.credentials
                  })
                })
                
                const statusData = await statusResponse.json()
                
                // Log detalhado para debug
                console.log(`[CLT Consulta Lote] Resposta completa da verificação de status para CPF ${cpfProcessado}:`, JSON.stringify(statusData, null, 2))
                
                if (statusData.success && statusData.data) {
                  // Tenta extrair status de diferentes estruturas possíveis - verifica TODA a estrutura
                  // A resposta tem estrutura aninhada:
                  // { success: true, data: { success: true, data: { status: "PENDING", authorization_link: "..." }, status: "PENDING" } }
                  let status = null
                  const dataObj = statusData.data
                  
                  // Prioriza data.data.status (nível mais profundo), depois data.status, depois nível superior
                  if (dataObj.data?.status) {
                    status = dataObj.data.status
                  } else if (dataObj.status) {
                    status = dataObj.status
                  } else if (statusData.status) {
                    status = statusData.status
                  } else if (dataObj.authorization_status) {
                    status = dataObj.authorization_status
                  } else if (dataObj.authorized !== undefined) {
                    status = dataObj.authorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
                  } else if (dataObj.is_authorized !== undefined) {
                    status = dataObj.is_authorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
                  } else if (dataObj.confirmed !== undefined) {
                    status = dataObj.confirmed ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
                  } else if (typeof dataObj === 'string') {
                    status = dataObj
                  }
                  
                  console.log(`[CLT Consulta Lote] Status extraído da autorização para CPF ${cpfProcessado}:`, status)
                  console.log(`[CLT Consulta Lote] Estrutura completa da resposta:`, JSON.stringify(statusData, null, 2))
                  
                  // Normaliza o status para comparação (case-insensitive)
                  const statusNormalizado = status ? String(status).toUpperCase().trim() : null
                  
                  // Extrai link de autorização (pode estar em data.data.authorization_link ou data.authorization_link)
                  const authLink = dataObj.data?.authorization_link || dataObj.authorization_link
                  if (authLink) {
                    // Atualiza o estado de links de autorização
                    setLinksAutorizacao(prev => {
                      if (!prev[cpfProcessado]) {
                        return { ...prev, [cpfProcessado]: authLink }
                      }
                      return prev
                    })
                  }
                  
                  // IMPORTANTE: Se o sistema web mostra como autorizado mas a API retorna PENDING,
                  // pode haver uma inconsistência. Vamos tratar isso de forma especial.
                  if (statusNormalizado === 'AUTHORIZED' || statusNormalizado === 'AUTORIZADO' || statusNormalizado === 'CONFIRMED' || statusNormalizado === 'TRUE') {
                    // Se está autorizado mas deu erro na consulta, pode ser problema temporário ou dados incorretos
                    mensagemErro = '⚠️ Autorização encontrada e aprovada, mas erro ao consultar margem.\n\nPossíveis causas:\n• Problema temporário na API\n• Dados inválidos (CNPJ do empregador, service_type)\n• CNPJ do empregador não corresponde ao vínculo do registro\n\nSe o registro já tem termo válido no sistema web, verifique:\n• Se o CNPJ do empregador no CSV está correto\n• Se o service_type está correto (deve ser QITECH)\n• Tente novamente mais tarde'
                  } else if (statusNormalizado === 'PENDING' || statusNormalizado === 'PENDENTE') {
                    // Se retornou PENDING mas o sistema web mostra como autorizado, pode ser inconsistência
                    // Ou a autorização pode estar vinculada a um promot_id/service_type diferente
                    const authLink = dataObj.data?.authorization_link || dataObj.authorization_link
                    let linkMsg = ''
                    if (authLink) {
                      linkMsg = `\n\n🔗 Link de autorização disponível: ${authLink}\n(O registro precisa confirmar a autorização via este link se ainda não confirmou)`
                    }
                    
                    // Informa os dados que estão sendo usados na consulta para facilitar comparação
                    const dadosConsulta = `\n\n📋 Dados usados nesta consulta:\n• CPF: ${cpfProcessado}\n• CNPJ Empregador: ${requestBody.cnpjEmpregador || 'NÃO FORNECIDO'}\n• Service Type: ${requestBody.serviceType || 'NÃO FORNECIDO'}\n• Promot ID: ${requestBody.credentials?.promotId || 'NÃO FORNECIDO'}`
                    
                    mensagemErro = `⚠️ API retornou status PENDING para este CPF.\n\nSe o sistema web mostra como autorizado, pode ser:\n• Autorização no sistema web está vinculada a um promot_id diferente\n• Autorização no sistema web usa dados diferentes (CNPJ do empregador ou service_type)\n• Inconsistência entre sistema web e API\n• Autorização expirou ou precisa ser renovada\n• registro ainda não confirmou a autorização via SMS${linkMsg}${dadosConsulta}\n\n✅ Ação recomendada:\n• Verifique no sistema web qual CNPJ do empregador e service_type foram usados na autorização\n• Compare com os dados acima - devem ser EXATAMENTE iguais\n• Se os dados não corresponderem, atualize o CSV ou crie nova autorização com os dados corretos\n• Se os dados corresponderem mas ainda retornar PENDING, pode ser necessário aguardar sincronização ou contatar suporte`
                  } else if (statusNormalizado === 'NOT_AUTHORIZED' || statusNormalizado === 'FALSE') {
                    mensagemErro = '⚠️ Autorização não encontrada ou não aprovada.\n\nSe o registro já tem termo válido no sistema web:\n• Autorização pode estar vinculada a um promot_id diferente\n• Dados da consulta (CNPJ, service_type) podem não corresponder aos da autorização\n• Pode ser necessário criar nova autorização'
                  } else {
                    mensagemErro = `⚠️ Status da autorização: ${status || 'desconhecido'}\n\nSe o registro já tem termo válido no sistema web mas a API retorna status diferente, pode ser:\n• Autorização vinculada a um promot_id diferente\n• Dados incorretos na consulta (CNPJ do empregador, service_type)\n• Problema de sincronização entre sistema web e API\n\nVerifique se o CNPJ do empregador e service_type no CSV correspondem exatamente aos dados da autorização no sistema web.`
                  }
                } else {
                  console.warn(`[CLT Consulta Lote] Não foi possível verificar status para CPF ${cpfProcessado}. Resposta:`, statusData)
                  // Se não conseguiu verificar status, mas há autorização no sistema web, pode ser problema de sincronização
                  mensagemErro = '⚠️ Não foi possível verificar o status da autorização na API.\n\nSe o registro já tem termo válido no sistema web, pode ser:\n• Autorização vinculada a um promot_id diferente\n• Problema de sincronização entre sistema web e API\n• Dados incorretos na consulta (CNPJ do empregador, service_type)\n\nVerifique se o CNPJ do empregador e service_type no CSV correspondem exatamente aos dados da autorização no sistema web.'
                }
              } catch (statusError) {
                console.error(`[CLT Consulta Lote] Erro ao verificar status da autorização para CPF ${cpfProcessado}:`, statusError)
                // Mantém mensagem padrão se não conseguir verificar status
                if (mensagemErro.includes('não foi encontrada')) {
                  mensagemErro = '⚠️ Autorização não encontrada ou não aprovada.\n\nSe o registro já tem termo válido no sistema web, verifique:\n• Autorização vinculada a um promot_id diferente\n• Dados incorretos na consulta (CNPJ do empregador, service_type)\n• Problema de sincronização entre sistema web e API'
                } else if (mensagemErro.includes('aprovada')) {
                  mensagemErro = '⚠️ Autorização não aprovada. O registro precisa confirmar a autorização via SMS antes de consultar a margem.'
                }
              }
            }
          }
          
          // Mantém os dados do CSV mesmo em caso de erro, para que possam ser usados posteriormente
          const resultadoErro: ResultadoConsulta = {
            linha: i + 2,
            cpf: registro.cpf,
            nome: registro.nome,
            sucesso: false,
            elegivel: false,
            quantidadeVinculos: 0,
            bancoOrigem: apiSelecionadaConfig?.name || 'Nossa Fintech',
            erro: mensagemErro,
            mensagemErro: mensagemErro
          }
          
          // Para Nossa Fintech, mantém todos os dados do CSV (CNPJ, serviceType, telefone) mesmo com erro
          // Isso permite que os dados sejam exportados e usados posteriormente
          if (apiSelecionadaConfig?.type === 'nossafintech') {
            if (registro.cnpjEmpregador) {
              resultadoErro.cnpjEmpregador = registro.cnpjEmpregador.replace(/\D/g, '').padStart(14, '0')
            }
            
            // Adiciona link de autorização se disponível (para registro com autorização pendente)
            const linkAutorizacao = linksAutorizacao[cpfProcessado]
            if (linkAutorizacao) {
              resultadoErro.authorizationLink = linkAutorizacao
            }
          }
          
          resultadosTemp.push(resultadoErro)
        } else if (data.success && data.data) {
          // Processa resposta de uma única API selecionada
          const apiSelecionadaConfig = apisDisponiveis.find(a => a.id === apiSelecionada)
          const apiNome = apiSelecionadaConfig?.name || data.apiName || 'API Selecionada'
          const apiType = apiSelecionadaConfig?.type || 'hubcredito'
          
          // Função helper para normalizar vínculos de diferentes estruturas
          const normalizarVinculos = (apiData: any, tipo: string): any[] => {
            if (tipo === 'hubcredito') {
              return apiData.value?.vinculos || apiData.vinculos || []
            }
            
            if (tipo === 'presencabank') {
              if (Array.isArray(apiData)) {
                return apiData
              }
              if (apiData.data && Array.isArray(apiData.data)) {
                return apiData.data
              }
              if (apiData && typeof apiData === 'object' && !Array.isArray(apiData)) {
                if (apiData.valorDisponivel !== undefined || apiData.valorLimite !== undefined || apiData.margem !== undefined) {
                  return [apiData]
                }
              }
              return apiData.value?.vinculos || apiData.vinculos || apiData.margens || []
            }
            
            return apiData.value?.vinculos || apiData.vinculos || apiData.data || (Array.isArray(apiData) ? apiData : [])
          }
          
          // Extrai vínculos da resposta
          const vinculos = normalizarVinculos(data.data, apiType)
          
          // Tenta extrair o nome do registro da resposta da API
          const nomeDaAPI = 
            data.data?.value?.nomeTrabalhador ||
            data.data?.value?.nome ||
            data.data?.nomeTrabalhador ||
            data.data?.nome ||
            vinculos[0]?.nomeTrabalhador ||
            vinculos[0]?.nome ||
            vinculos[0]?.trabalhador?.nome ||
            ''
          
          // Usa o nome da API se disponível, senão usa o do CSV
          const nomeFinal = nomeDaAPI || registro.nome
          
          // Extrai dados do nível raiz da resposta também (pode estar aqui se não estiver no vínculo)
          const dadosRaiz = data.data?.value || data.data || {}
          
          if (vinculos.length === 0) {
            resultadosTemp.push({
              linha: i + 2,
              cpf: cpfProcessado,
              nome: nomeFinal,
              sucesso: true,
              elegivel: false,
              quantidadeVinculos: 0,
              bancoOrigem: apiNome,
              mensagemErro: 'Nenhum vínculo encontrado'
            })
          } else {
            // Processa vínculos elegíveis
            const vinculosElegiveis = vinculos.filter((v: any) => {
              if (apiType === 'presencabank') {
                return v.elegivel === true || 
                       v.disponivel === true || 
                       (v.valorDisponivel && v.valorDisponivel > 0) ||
                       (v.valorLimite && v.valorLimite > 0) ||
                       (v.margem && v.margem > 0)
              }
              return v.elegivel === true
            })
            
            // Usa o primeiro vínculo elegível, ou o primeiro se não houver elegíveis
            let vinculo = vinculosElegiveis.length > 0 ? vinculosElegiveis[0] : vinculos[0]
            
            // Função helper para extrair dados de um vínculo (busca recursiva em objetos aninhados)
            const extrairDadosVinculo = (v: any, dadosRaiz: any = {}): any => {
              // Busca recursiva em um objeto
              const buscarValor = (obj: any, chaves: string[]): string => {
                if (!obj || typeof obj !== 'object') return ''
                for (const chave of chaves) {
                  const partes = chave.split('.')
                  let valor = obj
                  for (const parte of partes) {
                    if (valor && typeof valor === 'object' && parte in valor) {
                      valor = valor[parte]
                    } else {
                      valor = undefined
                      break
                    }
                  }
                  if (valor !== undefined && valor !== null && valor !== '') {
                    return String(valor).trim()
                  }
                }
                return ''
              }
              
              // Busca CNPJ Empregador em múltiplas estruturas possíveis
              const cnpjEmpregador = buscarValor(v, [
                'inscricaoEmpregador.numeroInscricao',
                'numeroInscricaoEmpregador',
                'cnpjEmpregador',
                'empregador.cnpj',
                'empregador.inscricaoEmpregador.numeroInscricao',
                'cnpj',
                'codigoInscricaoEmpregador',
                'inscricaoEmpregador'
              ]) || buscarValor(dadosRaiz, [
                'inscricaoEmpregador.numeroInscricao',
                'numeroInscricaoEmpregador',
                'cnpjEmpregador',
                'empregador.cnpj'
              ])
              
              // Busca Matrícula em múltiplas estruturas possíveis
              const matricula = buscarValor(v, [
                'matricula',
                'numeroMatricula',
                'registro',
                'numeroRegistro',
                'numeroMatriculaFuncionario',
                'matriculaFuncionario',
                'trabalhador.matricula',
                'trabalhador.numeroMatricula'
              ]) || buscarValor(dadosRaiz, [
                'matricula',
                'numeroMatricula',
                'registro'
              ])
              
              // Busca ID Cotação em múltiplas estruturas possíveis
              const idCotacao = buscarValor(v, [
                'idCotacao',
                'cotacaoId',
                'cotacao.id',
                'idCotacaoTrabalhador',
                'id'
              ]) || buscarValor(dadosRaiz, [
                'idCotacao',
                'cotacaoId',
                'id'
              ])
              
              return {
                cnpjEmpregador: cnpjEmpregador || '',
                matricula: matricula || '',
                idCotacao: idCotacao || ''
              }
            }
            
            // Extrai dados do vínculo principal (passa dadosRaiz para busca recursiva)
            let dadosVinculo = extrairDadosVinculo(vinculo, dadosRaiz)
            
            // Se faltarem dados, tenta buscar nos outros vínculos
            if ((!dadosVinculo.idCotacao || !dadosVinculo.matricula || !dadosVinculo.cnpjEmpregador) && vinculos.length > 1) {
              for (const v of vinculos) {
                const dadosV = extrairDadosVinculo(v, dadosRaiz)
                // Se este vínculo tem mais dados completos, usa ele
                if (dadosV.idCotacao && dadosV.matricula && dadosV.cnpjEmpregador) {
                  vinculo = v
                  dadosVinculo = dadosV
                  break
                }
                // Atualiza campos faltantes se este vínculo tiver
                if (!dadosVinculo.idCotacao && dadosV.idCotacao) dadosVinculo.idCotacao = dadosV.idCotacao
                if (!dadosVinculo.matricula && dadosV.matricula) dadosVinculo.matricula = dadosV.matricula
                if (!dadosVinculo.cnpjEmpregador && dadosV.cnpjEmpregador) dadosVinculo.cnpjEmpregador = dadosV.cnpjEmpregador
              }
            }
            
            // Se ainda faltarem dados, busca na estrutura completa da resposta e em todos os vínculos
            if (!dadosVinculo.idCotacao || !dadosVinculo.matricula || !dadosVinculo.cnpjEmpregador) {
              // Busca recursiva na resposta completa
              const buscarNaResposta = (obj: any, profundidade = 0): any => {
                if (profundidade > 4 || !obj || typeof obj !== 'object') return null
                const resultado: any = {}
                
                // Busca ID Cotação em várias variações
                if (obj.idCotacao || obj.cotacaoId || obj.idCotacaoTrabalhador || obj.cotacao?.id || (obj.id && typeof obj.id === 'string' && obj.id.length > 0)) {
                  resultado.idCotacao = obj.idCotacao || obj.cotacaoId || obj.idCotacaoTrabalhador || obj.cotacao?.id || (typeof obj.id === 'string' ? obj.id : '')
                }
                
                // Busca Matrícula em várias variações
                if (obj.matricula || obj.numeroMatricula || obj.registro || obj.numeroRegistro || obj.numeroMatriculaFuncionario || obj.matriculaFuncionario) {
                  resultado.matricula = obj.matricula || obj.numeroMatricula || obj.registro || obj.numeroRegistro || obj.numeroMatriculaFuncionario || obj.matriculaFuncionario
                }
                
                // Busca CNPJ Empregador em várias variações
                if (obj.numeroInscricaoEmpregador || obj.cnpjEmpregador || obj.cnpj || obj.codigoInscricaoEmpregador || obj.inscricaoEmpregador) {
                  resultado.cnpjEmpregador = obj.numeroInscricaoEmpregador || obj.cnpjEmpregador || obj.cnpj || obj.codigoInscricaoEmpregador || 
                    (typeof obj.inscricaoEmpregador === 'string' ? obj.inscricaoEmpregador : (obj.inscricaoEmpregador?.numeroInscricao || ''))
                }
                
                if (resultado.idCotacao && resultado.matricula && resultado.cnpjEmpregador) {
                  return resultado
                }
                
                // Busca recursivamente em objetos filhos (incluindo arrays)
                for (const key in obj) {
                  if (obj[key] && typeof obj[key] === 'object') {
                    if (Array.isArray(obj[key])) {
                      // Para arrays, busca em cada elemento
                      for (const item of obj[key]) {
                        if (item && typeof item === 'object') {
                          const subResultado = buscarNaResposta(item, profundidade + 1)
                          if (subResultado) {
                            if (!resultado.idCotacao && subResultado.idCotacao) resultado.idCotacao = subResultado.idCotacao
                            if (!resultado.matricula && subResultado.matricula) resultado.matricula = subResultado.matricula
                            if (!resultado.cnpjEmpregador && subResultado.cnpjEmpregador) resultado.cnpjEmpregador = subResultado.cnpjEmpregador
                            if (resultado.idCotacao && resultado.matricula && resultado.cnpjEmpregador) {
                              return resultado
                            }
                          }
                        }
                      }
                    } else {
                      const subResultado = buscarNaResposta(obj[key], profundidade + 1)
                      if (subResultado) {
                        if (!resultado.idCotacao && subResultado.idCotacao) resultado.idCotacao = subResultado.idCotacao
                        if (!resultado.matricula && subResultado.matricula) resultado.matricula = subResultado.matricula
                        if (!resultado.cnpjEmpregador && subResultado.cnpjEmpregador) resultado.cnpjEmpregador = subResultado.cnpjEmpregador
                        if (resultado.idCotacao && resultado.matricula && resultado.cnpjEmpregador) {
                          return resultado
                        }
                      }
                    }
                  }
                }
                
                return Object.keys(resultado).length > 0 ? resultado : null
              }
              
              // Busca em toda a resposta
              const dadosEncontrados = buscarNaResposta(data.data)
              if (dadosEncontrados) {
                if (!dadosVinculo.idCotacao && dadosEncontrados.idCotacao) dadosVinculo.idCotacao = dadosEncontrados.idCotacao
                if (!dadosVinculo.matricula && dadosEncontrados.matricula) dadosVinculo.matricula = dadosEncontrados.matricula
                if (!dadosVinculo.cnpjEmpregador && dadosEncontrados.cnpjEmpregador) dadosVinculo.cnpjEmpregador = dadosEncontrados.cnpjEmpregador
              }
              
              // Se ainda faltar, tenta buscar em todos os vínculos novamente (busca mais agressiva)
              if ((!dadosVinculo.idCotacao || !dadosVinculo.matricula || !dadosVinculo.cnpjEmpregador) && vinculos.length > 0) {
                for (const v of vinculos) {
                  const buscaVinculo = buscarNaResposta(v)
                  if (buscaVinculo) {
                    if (!dadosVinculo.idCotacao && buscaVinculo.idCotacao) dadosVinculo.idCotacao = buscaVinculo.idCotacao
                    if (!dadosVinculo.matricula && buscaVinculo.matricula) dadosVinculo.matricula = buscaVinculo.matricula
                    if (!dadosVinculo.cnpjEmpregador && buscaVinculo.cnpjEmpregador) dadosVinculo.cnpjEmpregador = buscaVinculo.cnpjEmpregador
                    if (dadosVinculo.idCotacao && dadosVinculo.matricula && dadosVinculo.cnpjEmpregador) {
                      break
                    }
                  }
                }
              }
            }
            
            // Determina se é elegível
            const isElegivel = apiType === 'presencabank'
              ? (vinculo.elegivel === true || 
                 vinculo.disponivel === true || 
                 (vinculo.valorDisponivel && vinculo.valorDisponivel > 0) ||
                 (vinculo.valorLimite && vinculo.valorLimite > 0) ||
                 (vinculo.margem && vinculo.margem > 0))
              : vinculo.elegivel === true
            
            // Debug: log detalhado do primeiro vínculo para entender a estrutura
            if (i === 0 && vinculo && (!dadosVinculo.idCotacao || !dadosVinculo.matricula || !dadosVinculo.cnpjEmpregador)) {
              console.warn('Campos ainda faltando após busca completa:', {
                idCotacao: dadosVinculo.idCotacao || 'FALTANDO',
                matricula: dadosVinculo.matricula || 'FALTANDO',
                cnpjEmpregador: dadosVinculo.cnpjEmpregador || 'FALTANDO',
                estruturaVinculo: Object.keys(vinculo),
                estruturaRaiz: Object.keys(dadosRaiz)
              })
            }
            
            // Usa os dados extraídos
            const cnpjEmpregador = dadosVinculo.cnpjEmpregador || ''
            const matricula = dadosVinculo.matricula || ''
            const idCotacao = dadosVinculo.idCotacao || ''
            
            // Normaliza valores para diferentes estruturas de API
            const valorDisponivel = vinculo.valorDisponivel || 
                                    vinculo.valorLiberado || 
                                    vinculo.valorLimite || 
                                    vinculo.margem || 
                                    0
            
            const valorLiberado = vinculo.valorLiberado || 
                                  vinculo.valorDisponivel || 
                                  vinculo.valorLimite || 
                                  vinculo.margem || 
                                  0
            
            const valorLimite = vinculo.valorLimite || 
                                vinculo.valorLiberado || 
                                vinculo.valorDisponivel || 
                                vinculo.margem || 
                                0
            
            resultadosTemp.push({
              linha: i + 2,
              cpf: cpfProcessado,
              nome: nomeFinal,
              sucesso: true,
              elegivel: isElegivel,
              valorLiberado: valorLiberado,
              valorDisponivel: valorDisponivel,
              valorLimite: valorLimite,
              salario: vinculo.salario || vinculo.renda || vinculo.rendaBruta || 0,
              organizacao: vinculo.nomeEmpregador || 
                      vinculo.empregador?.nome || 
                      vinculo.razaoSocial || 
                      vinculo.nomeEmpresa || 
                      vinculo.organizacao ||
                      '',
              cnpjEmpregador: String(cnpjEmpregador || '').trim(),
              matricula: String(matricula || '').trim(),
              idCotacao: String(idCotacao || '').trim(),
              quantidadeVinculos: vinculos.length,
              bancoOrigem: apiNome
            })
            
            // Log de aviso se campos importantes estiverem faltando
            if (i === 0 && (!idCotacao || !matricula || !cnpjEmpregador)) {
              console.warn('Campos faltando para registro', cpfProcessado, {
                idCotacao: idCotacao || 'FALTANDO',
                matricula: matricula || 'FALTANDO',
                cnpjEmpregador: cnpjEmpregador || 'FALTANDO',
                estruturaVinculo: Object.keys(vinculo),
                estruturaRaiz: Object.keys(dadosRaiz)
              })
            }
          }
        } else {
          resultadosTemp.push({
            linha: i + 2,
            cpf: cpfProcessado,
            nome: registro.nome || '',
            sucesso: false,
            erro: data.error || 'Erro desconhecido',
            mensagemErro: data.error || 'Erro ao consultar',
          })
        }
      } catch (error: any) {
        resultadosTemp.push({
          linha: i + 2,
          cpf: cpfProcessado,
          nome: registro.nome || '',
          sucesso: false,
          erro: error.message || 'Erro de conexão',
          mensagemErro: error.message || 'Erro de conexão',
        })
      }

      // Atualiza progresso
      const percentual = Math.round(((i + 1) / registro.length) * 100)
      setProgresso({
        atual: i + 1,
        total: registro.length,
        percentual
      })
      
      setResultados([...resultadosTemp])

      // Pequeno delay para não sobrecarregar a API
      if (i < registro.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    setProcessando(false)
    setPausado(false)
    processamentoAtivoRef.current = false
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

  // Função helper para escapar valores CSV corretamente
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // Se contém ponto e vírgula, aspas ou quebra de linha, precisa estar entre aspas e escapar aspas duplas
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Função helper para formatar linha CSV
  const formatarLinhaCSV = (valores: (string | number | undefined | null)[]): string => {
    return valores.map(escapeCSV).join(';') // Usar ponto e vírgula para melhor compatibilidade com Excel
  }

  const exportarResultados = () => {
    if (resultados.length === 0) {
      alert('Não há resultados para exportar')
      return
    }

    // Cabeçalho CSV com ponto e vírgula (melhor para Excel)
    const cabecalho = [
      'Linha',
      'CPF',
      'Nome',
      'Elegível',
      'Banco Origem',
      'Valor Liberado (R$)',
      'Valor Disponível (R$)',
      'Valor Limite (R$)',
      'Salário (R$)',
      'organizacao',
      'CNPJ Empregador',
      'Matrícula',
      'ID Cotação',
      'Quantidade Vínculos',
      'Status',
      'Erro/Mensagem'
    ]

    // Linhas de dados
    const linhas = resultados.map(r => [
      r.linha.toString(),
      r.cpf,
      r.nome || '',
      r.elegivel === true ? 'SIM' : r.elegivel === false ? 'NÃO' : 'N/A',
      r.bancoOrigem || 'N/A',
      r.valorLiberado !== undefined && r.valorLiberado !== null ? r.valorLiberado.toFixed(2).replace('.', ',') : '',
      r.valorDisponivel !== undefined && r.valorDisponivel !== null ? r.valorDisponivel.toFixed(2).replace('.', ',') : '',
      r.valorLimite !== undefined && r.valorLimite !== null ? r.valorLimite.toFixed(2).replace('.', ',') : '',
      r.salario !== undefined && r.salario !== null ? r.salario.toFixed(2).replace('.', ',') : '',
      r.organizacao || '',
      r.cnpjEmpregador || '',
      r.matricula || '',
      r.idCotacao || '',
      r.quantidadeVinculos !== undefined && r.quantidadeVinculos !== null ? r.quantidadeVinculos.toString() : '',
      r.sucesso ? 'SUCESSO' : 'ERRO',
      r.mensagemErro || r.erro || ''
    ])

    // Converte para CSV com separador ponto e vírgula
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...linhas.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n') // Usar \r\n para compatibilidade Windows

    // Download com BOM UTF-8 para Excel reconhecer acentuação
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `consulta_elegibilidade_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const baixarTemplate = () => {
    // Verifica qual API está selecionada
    const apiSelecionadaConfig = apisDisponiveis.find(a => a.id === apiSelecionada)
    const isNossaFintech = apiSelecionadaConfig?.type === 'nossafintech'
    
    let cabecalho: string[]
    let dados: string[][]
    
    if (isNossaFintech) {
      // Template para Nossa Fintech: requer cnpjEmpregador, serviceType e telefone (opcional)
      // serviceType deve ser o código da bancarizadora (ex: "QITECH" conforme sistema do banco)
      // telefone é opcional - se não fornecido, será usado o padrão (99)99999-9999
      cabecalho = ['CPF', 'Nome', 'cnpjEmpregador', 'serviceType', 'telefone']
      dados = [
        ['12345678900', 'João Silva', '44107297000164', 'QITECH', '(99)99999-9999'],
        ['98765432100', 'Maria Santos', '12345678000190', 'QITECH', '(99)99999-9999']
      ]
    } else {
      // Template padrão para outras APIs
      cabecalho = ['CPF', 'Nome']
      dados = [
        ['12345678900', 'João Silva'],
        ['98765432100', 'Maria Santos']
      ]
    }
    
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...dados.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')
    
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_consulta_elegibilidade.csv'
    link.click()
  }

  const formatarMoeda = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Estatísticas - categorias mutuamente exclusivas
  // Com erro tem prioridade: se tem erro, não conta em aptos/não aptos
  const clientesComErro = resultados.filter(r => !r.sucesso).length
  const clientesAptos = resultados.filter(r => r.sucesso && r.elegivel === true).length
  const clientesNaoAptos = resultados.filter(r => r.sucesso && r.elegivel === false).length
  const totalProcessados = resultados.length
  
  // Validação: total deve ser igual ao número de resultados
  const totalCalculado = clientesComErro + clientesAptos + clientesNaoAptos
  const clientesSemCategoria = resultados.filter(r => r.sucesso && r.elegivel !== true && r.elegivel !== false).length
  
  // Agrupa erros por tipo para análise
  const errosAgrupados = resultados
    .filter(r => !r.sucesso && r.mensagemErro)
    .reduce((acc: Record<string, number>, r) => {
      const erro = r.mensagemErro || r.erro || 'Erro desconhecido'
      // Normaliza mensagens similares
      const erroNormalizado = erro.split(':')[0].trim() // Pega apenas a primeira parte do erro
      acc[erroNormalizado] = (acc[erroNormalizado] || 0) + 1
      return acc
    }, {})
  
  const errosOrdenados = Object.entries(errosAgrupados)
    .sort((a, b) => b[1] - a[1]) // Ordena por quantidade (maior primeiro)
    .slice(0, 10) // Top 10 erros mais comuns
  
  const valorTotalDisponivel = resultados
    .filter(r => r.elegivel === true && r.valorDisponivel)
    .reduce((acc, r) => acc + (r.valorDisponivel || 0), 0)

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            </div>
            Consulta de Elegibilidade em Lote
          </CardTitle>
          <CardDescription className="mt-2">
            Faça upload de um arquivo CSV com CPFs e verifique quais registro estão aptos para empréstimo CLT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seleção de Banco */}
            <div>
              <Label htmlFor="banco">Banco para Consulta *</Label>
              <Select
                id="banco"
                value={apiSelecionada}
                onChange={(e) => setApiSelecionada(e.target.value)}
                required
                disabled={processando}
              >
                <option value="">Selecione um banco...</option>
                {apisDisponiveis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} {api.type === 'hubcredito' ? '(HubCredito)' : 
                                 api.type === 'presencabank' ? '(Banco Presença)' : 
                                 api.type === 'nossafintech' ? '(Nossa Fintech)' : 
                                 ''}
                  </option>
                ))}
              </Select>
              {apisDisponiveis.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Nenhuma API configurada. Configure as APIs na seção de Configuração de APIs.
                </p>
              )}
            </div>

            {/* Upload de Arquivo */}
            <div>
              <Label htmlFor="arquivo">Arquivo CSV com CPFs</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  ref={fileInputRef}
                  id="arquivo"
                  type="file"
                  accept=".csv"
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
                {apisDisponiveis.find(a => a.id === apiSelecionada)?.type === 'nossafintech' ? (
                  <>
                    Para <strong>Nossa Fintech</strong>, basta a coluna <strong>cpf</strong> (a API localiza o vínculo). Opcionais: <strong>cnpjEmpregador</strong>, <strong>serviceType</strong> (padrão QITECH), <strong>telefone</strong> e <strong>nome</strong>.
                  </>
                ) : (
                  <>
                    O CSV deve conter pelo menos a coluna "cpf". Coluna "nome" é opcional - o sistema tentará buscar o nome pela API quando disponível.
                  </>
                )}
              </p>
            </div>

            {/* Info do Arquivo */}
            {registro.length > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
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
              </div>
            )}

            {/* Botões de Controle */}
            <div className="flex gap-2">
              {!processando && !autorizando ? (
                <>
                  {/* Botão de Autorização (só para Nossa Fintech) */}
                  {apisDisponiveis.find(a => a.id === apiSelecionada)?.type === 'nossafintech' && (
                    <Button
                      onClick={autorizarEConsultar}
                      disabled={registro.length === 0}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                      size="lg"
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Autorizar e Consultar ({registro.length} registro(s))
                    </Button>
                  )}
                  <Button
                    onClick={processarConsultas}
                    disabled={registro.length === 0}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                    size="lg"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {resultados.length > 0 ? 'Continuar' : 'Processar'} Consultas ({registro.length} registro(s))
                  </Button>
                </>
              ) : autorizando ? (
                <div className="flex-1 space-y-2">
                  <Button
                    disabled
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                    size="lg"
                  >
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Autorizando... ({progressoAutorizacao.atual}/{progressoAutorizacao.total})
                  </Button>
                  {progressoAutorizacao.total > 0 && (
                    <Progress value={progressoAutorizacao.percentual} className="h-2" />
                  )}
                </div>
              ) : (
                <>
                  {pausado ? (
                    <Button
                      onClick={retomarProcessamento}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                      size="lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Retomar Processamento
                    </Button>
                  ) : (
                    <Button
                      onClick={pausarProcessamento}
                      variant="outline"
                      className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      size="lg"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </Button>
                  )}
                  <Button
                    onClick={cancelarProcessamento}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    size="lg"
                  >
                    <Square className="h-4 w-4 mr-2" />
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{clientesAptos}</div>
                <div className="text-xs text-green-600">Aptos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{clientesNaoAptos}</div>
                <div className="text-xs text-red-600">Não Aptos</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{clientesComErro}</div>
                <div className="text-xs text-yellow-600">Com Erro</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {formatarMoeda(valorTotalDisponivel)}
                </div>
                <div className="text-xs text-blue-600">Valor Disponível Total</div>
              </div>
            </div>
            
            {/* Resumo de Erros - mostra os erros mais comuns */}
            {clientesComErro > 0 && errosOrdenados.length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">Principais Erros Encontrados:</h4>
                <div className="space-y-1 text-sm">
                  {errosOrdenados.map(([erro, quantidade]) => (
                    <div key={erro} className="flex justify-between items-center">
                      <span className="text-yellow-800 truncate flex-1">{erro}</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 ml-2">
                        {quantidade}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-yellow-700 mt-2">
                  💡 Exporte o CSV para ver detalhes completos de todos os erros
                </p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={exportarResultados}
                  variant="outline"
                  className="flex-1 border-green-600 text-green-700 hover:bg-green-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Todos
                </Button>
                <Button
                  onClick={() => {
                    // Exporta apenas registro elegíveis com dados completos para simulação
                    const clientesCompletos = resultados.filter(r => 
                      r.elegivel === true && 
                      r.sucesso === true &&
                      r.idCotacao && 
                      r.idCotacao.trim() !== '' &&
                      r.matricula && 
                      r.matricula.trim() !== '' &&
                      r.cnpjEmpregador && 
                      r.cnpjEmpregador.trim() !== ''
                    )
                    
                    if (clientesCompletos.length === 0) {
                      alert('Nenhum registro elegível encontrado com todos os dados necessários para simulação (ID Cotação, Matrícula e CNPJ Empregador).')
                      return
                    }
                    
                    // Cria CSV apenas com registro completos
                    const cabecalho = [
                      'CPF',
                      'Nome',
                      'ID Cotação',
                      'Matrícula',
                      'CNPJ Empregador',
                      'Valor Disponível (R$)',
                      'organizacao',
                      'Banco Origem'
                    ]
                    
                    const linhas = clientesCompletos.map(r => {
                      // Garante que o CNPJ seja exportado como texto (não como número) para evitar notação científica
                      let cnpjFormatado = r.cnpjEmpregador || ''
                      // Se o CNPJ for um número sem formatação, adiciona um espaço no início para forçar Excel a tratar como texto
                      // Ou pode adicionar um apóstrofo no início
                      if (cnpjFormatado && /^\d+$/.test(cnpjFormatado)) {
                        // Usa tabulação para garantir que Excel não converta para número
                        cnpjFormatado = `\t${cnpjFormatado}`
                      }
                      
                      return [
                        r.cpf,
                        r.nome || '',
                        r.idCotacao || '',
                        r.matricula || '',
                        cnpjFormatado,
                        r.valorDisponivel !== undefined && r.valorDisponivel !== null ? r.valorDisponivel.toFixed(2).replace('.', ',') : '0,00',
                        r.organizacao || '',
                        r.bancoOrigem || ''
                      ]
                    })
                    
                    const linhasCSV = [
                      formatarLinhaCSV(cabecalho),
                      ...linhas.map(linha => formatarLinhaCSV(linha))
                    ].join('\r\n')
                    
                    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `clientes_elegiveis_simulacao_${new Date().toISOString().split('T')[0]}.csv`
                    link.click()
                    
                    alert(`${clientesCompletos.length} registro(s) elegível(eis) com dados completos exportado(s) para simulação.`)
                  }}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar para Simulação ({resultados.filter(r => 
                    r.elegivel === true && 
                    r.sucesso === true &&
                    r.idCotacao && 
                    r.idCotacao.trim() !== '' &&
                    r.matricula && 
                    r.matricula.trim() !== '' &&
                    r.cnpjEmpregador && 
                    r.cnpjEmpregador.trim() !== ''
                  ).length})
                </Button>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Use "Exportar para Simulação" para exportar apenas registro elegíveis com todos os dados necessários (ID Cotação, Matrícula e CNPJ Empregador)
              </p>
              
              {/* Botão para enviar elegíveis para simulação */}
              {clientesAptos > 0 && (
                <Button
                  onClick={() => {
                    // Filtra registro elegíveis com vínculos
                    const clientesElegiveis = resultados.filter(r => 
                      r.elegivel === true && 
                      r.quantidadeVinculos !== undefined && 
                      r.quantidadeVinculos >= 1
                    )

                    // Filtra os que têm todos os dados necessários
                    const clientesCompletos = clientesElegiveis.filter(r => 
                      r.idCotacao && 
                      r.idCotacao.trim() !== '' &&
                      r.matricula && 
                      r.matricula.trim() !== '' &&
                      r.cnpjEmpregador && 
                      r.cnpjEmpregador.trim() !== ''
                    )

                    if (clientesElegiveis.length === 0) {
                      alert('Nenhum registro elegível encontrado.')
                      return
                    }

                    if (clientesCompletos.length === 0) {
                      const faltando = clientesElegiveis.length - clientesCompletos.length
                      alert(`Nenhum registro elegível tem todos os dados necessários.\n${faltando} registro(s) estão faltando: ID Cotação, Matrícula ou CNPJ Empregador.`)
                      return
                    }

                    // Se alguns estão faltando dados, avisa mas continua
                    if (clientesCompletos.length < clientesElegiveis.length) {
                      const faltando = clientesElegiveis.length - clientesCompletos.length
                      if (!confirm(`Atenção: ${faltando} registro(s) estão faltando campos obrigatórios (ID Cotação, Matrícula ou CNPJ Empregador).\nDeseja continuar enviando apenas os ${clientesCompletos.length} registro(s) com dados completos?`)) {
                        return
                      }
                    }

                    // Cria CSV no formato esperado pela simulação
                    const cabecalho = ['CPF', 'ID Cotação', 'Matrícula', 'CNPJ Empregador', 'Nome']
                    const dados = clientesCompletos.map(r => [
                      r.cpf,
                      (r.idCotacao || '').trim(),
                      (r.matricula || '').trim(),
                      (r.cnpjEmpregador || '').trim(),
                      (r.nome || '').trim()
                    ])

                    const linhasCSV = [
                      formatarLinhaCSV(cabecalho),
                      ...dados.map(linha => formatarLinhaCSV(linha))
                    ].join('\r\n')

                    // Salva no localStorage para ser usado pela simulação em lote
                    localStorage.setItem('clt_simulacao_lote_dados', linhasCSV)
                    localStorage.setItem('clt_simulacao_lote_count', clientesElegiveis.length.toString())

                    // Dispara evento para mudar de aba
                    window.dispatchEvent(new CustomEvent('mudarAba', { 
                      detail: { aba: 'simular-lote-clt' } 
                    }))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Enviar {clientesAptos} Elegível(is) para Simulação em Lote
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
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
              {clientesSemCategoria > 0 && (
                <span className="text-yellow-600 ml-2">
                  ({clientesSemCategoria} sem categoria definida)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">CPF</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-center p-2">Elegível</th>
                    <th className="text-left p-2">Banco Origem</th>
                    <th className="text-right p-2">Valor Disponível</th>
                    <th className="text-right p-2">Valor Liberado</th>
                    <th className="text-left p-2">organizacao</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-left p-2">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.slice(0, 100).map((resultado, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{resultado.cpf}</td>
                      <td className="p-2">{resultado.nome || '-'}</td>
                      <td className="p-2 text-center">
                        {resultado.elegivel === true ? (
                          <Badge className="bg-green-100 text-green-700">SIM</Badge>
                        ) : resultado.elegivel === false ? (
                          <Badge variant="outline" className="bg-red-100 text-red-700">NÃO</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2">
                        {resultado.bancoOrigem ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {resultado.bancoOrigem}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-medium text-green-600">
                        {resultado.valorDisponivel ? formatarMoeda(resultado.valorDisponivel) : '-'}
                      </td>
                      <td className="p-2 text-right text-gray-600">
                        {resultado.valorLiberado ? formatarMoeda(resultado.valorLiberado) : '-'}
                      </td>
                      <td className="p-2 text-xs">{resultado.organizacao || '-'}</td>
                      <td className="p-2 text-center">
                        {resultado.sucesso ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-2 text-xs text-red-600 max-w-xs">
                        <div className="flex flex-col gap-1">
                          <div className="truncate" title={resultado.mensagemErro || resultado.erro || ''}>
                            {resultado.mensagemErro || resultado.erro || '-'}
                          </div>
                          {resultado.authorizationLink && (
                            <a 
                              href={resultado.authorizationLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs"
                              title="Link para completar autorização"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Completar Autorização</span>
                            </a>
                          )}
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

