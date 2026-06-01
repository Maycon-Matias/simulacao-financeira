"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, XCircle, FileSpreadsheet, Upload, Download, entidade, TrendingUp, DollarSign, Shield, ExternalLink, AlertCircle, RefreshCw } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface ClientePlanilha {
  cpf: string
  nome: string
  dataNascimento: string // YYYY-MM-DD
  genero: string // 'male' ou 'female'
  telefone: string
  email: string
}

interface ResultadoConsulta {
  linha: number
  registro: ClientePlanilha
  sucesso: boolean
  consultId?: string
  linkAutorizacao?: string
  status?: string
  margemDisponivel?: number
  erro?: string
  etapa?: 'criando_termo' | 'autorizando' | 'verificando' | 'concluido' | 'erro'
}

type EstiloConsulta = 'sequencial' | 'lote'

export function CLTConsultaLoteV8() {
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
  const [estiloConsulta, setEstiloConsulta] = useState<EstiloConsulta>('sequencial')
  const [tempoEspera, setTempoEspera] = useState(60) // minutos
  const [tempoRestante, setTempoRestante] = useState<number | null>(null) // segundos restantes
  const [faseAtual, setFaseAtual] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processamentoAtivoRef = useRef(false)
  const intervaloEsperaRef = useRef<NodeJS.Timeout | null>(null)

  // Carrega APIs disponíveis (apenas V8 Digital)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active && c.type === 'v8digital')
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Limpa intervalo ao desmontar componente
  useEffect(() => {
    return () => {
      if (intervaloEsperaRef.current) {
        clearInterval(intervaloEsperaRef.current)
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
    // Remove espaços e caracteres especiais
    let dataLimpa = data.trim().replace(/\s+/g, '')
    
    // Se já está no formato YYYY-MM-DD, retorna
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataLimpa)) {
      return dataLimpa
    }
    
    // Se está no formato DD/MM/YYYY ou DD-MM-YYYY
    if (dataLimpa.includes('/') || dataLimpa.includes('-')) {
      const separador = dataLimpa.includes('/') ? '/' : '-'
      const partes = dataLimpa.split(separador)
      
      if (partes.length === 3) {
        // Se o primeiro número tem 4 dígitos, assume YYYY-MM-DD
        if (partes[0].length === 4) {
          return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`
        }
        // Caso contrário, assume DD/MM/YYYY
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
      }
    }
    
    // Se não conseguir normalizar, retorna a data original
    console.warn('Data não pôde ser normalizada:', data)
    return dataLimpa
  }

  // Função para normalizar gênero
  const normalizarGenero = (genero: string): 'male' | 'female' => {
    const gen = genero.trim().toLowerCase()
    if (gen.includes('fem') || gen.includes('mulher') || gen === 'f' || gen === '2') {
      return 'female'
    }
    return 'male' // Padrão
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
      
      // Se estiver vazio, pula
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
      
      // Remove formatação (pontos, hífens, espaços)
      let cpf = cpfRaw.replace(/\D/g, '')
      
      // Se após remover formatação ainda tiver conteúdo, preenche com zeros à esquerda até 11 dígitos
      if (cpf.length > 0 && cpf.length < 11) {
        cpf = cpf.padStart(11, '0')
        console.log(`[V8 Lote] CPF corrigido com zeros à esquerda na linha ${i + 1}: ${cpfRaw} -> ${cpf}`)
      }
      
      // Se tiver mais de 11 dígitos, pega apenas os últimos 11 (pode ter formatação extra)
      if (cpf.length > 11) {
        cpf = cpf.slice(-11)
        console.log(`[V8 Lote] CPF truncado de ${cpf.length + 11} para 11 dígitos na linha ${i + 1}: ${cpfRaw} -> ${cpf}`)
      }
      
      // Valida se tem exatamente 11 dígitos
      if (cpf.length !== 11) {
        console.warn(`[V8 Lote] CPF inválido na linha ${i + 1}: "${valores[indices.cpf]}" (${cpf.length} dígitos após processamento)`)
        linhasInvalidas.push(i + 1)
        continue
      }

      // Valida campos obrigatórios
      const nome = indices.nome !== undefined ? valores[indices.nome] : ''
      const email = indices.email !== undefined ? valores[indices.email] : ''
      const telefone = indices.telefone !== undefined ? valores[indices.telefone] : ''
      const dataNascimento = indices.dataNascimento !== undefined ? valores[indices.dataNascimento] : ''
      const genero = indices.genero !== undefined ? valores[indices.genero] : 'male'

      if (!nome || !email || !telefone || !dataNascimento) {
        linhasInvalidas.push(i + 1)
        continue
      }

      dados.push({
        cpf: cpf,
        nome: nome,
        email: email,
        telefone: telefone.replace(/\D/g, ''), // Remove formatação
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
      // Aceita tanto CSV quanto Excel (convertido para CSV)
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
      alert('Por favor, selecione a API V8 Digital')
      return
    }

    if (cancelado) {
      setResultados([])
      setCancelado(false)
    }

    // Escolhe o estilo de processamento
    if (estiloConsulta === 'lote') {
      await processarConsultasEmLote()
    } else {
      await processarConsultasSequencial()
    }
  }

  // Função para processar consultas em lote (criar todos → autorizar todos → esperar → verificar todos)
  const processarConsultasEmLote = async () => {
    setProcessando(true)
    setPausado(false)
    processamentoAtivoRef.current = true
    setFaseAtual('Criando termos...')
    setResultados([])

    const resultadosTemp: ResultadoConsulta[] = []
    setProgresso({ atual: 0, total: registro.length, percentual: 0 })

    // FASE 1: Criar todos os termos
    console.log('[V8 Lote] FASE 1: Criando todos os termos...')
    for (let i = 0; i < registro.length; i++) {
      if (cancelado || !processamentoAtivoRef.current) break

      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) break

      const registro = registro[i]
      const percentual = Math.round(((i + 1) / registro.length) * 100)
      setProgresso({ atual: i + 1, total: registro.length, percentual })

      let resultado: ResultadoConsulta = {
        linha: i + 2,
        registro,
        sucesso: false,
        etapa: 'criando_termo'
      }

      try {
        console.log(`[V8 Lote] Criando termo para ${registro.cpf}...`)
        const termoResponse = await fetch('/api/produto/v8/termo-consentimento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cpf: registro.cpf,
            nome: registro.nome,
            telefone: registro.telefone,
            email: registro.email,
            birthDate: registro.dataNascimento,
            gender: registro.genero,
            apiId: apiSelecionada,
          }),
        })

        const termoData = await termoResponse.json()

        if (termoData.success && termoData.data?.id) {
          resultado.consultId = termoData.data.id
          resultado.linkAutorizacao = termoData.data.consentLink || `https://app.v8sistema.com/termos-de-autorizacao/${termoData.data.id}`
          resultado.etapa = 'autorizando'
        } else {
          resultado.etapa = 'erro'
          resultado.erro = termoData.error || 'Erro ao criar termo de consentimento'
        }
      } catch (error: any) {
        resultado.etapa = 'erro'
        resultado.erro = error.message || 'Erro ao criar termo'
        console.error(`[V8 Lote] Erro ao criar termo para ${registro.cpf}:`, error)
      }

      resultadosTemp.push(resultado)
      setResultados([...resultadosTemp])

      // Delay mínimo entre requisições
      if (i < registro.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // FASE 2: Autorizar todos os termos
    console.log('[V8 Lote] FASE 2: Autorizando todos os termos...')
    setFaseAtual('Autorizando termos...')
    const termosParaAutorizar = resultadosTemp.filter(r => r.consultId && !r.erro)

    for (let i = 0; i < termosParaAutorizar.length; i++) {
      if (cancelado || !processamentoAtivoRef.current) break

      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) break

      const resultado = termosParaAutorizar[i]
      const indexOriginal = resultadosTemp.findIndex(r => r.consultId === resultado.consultId)

      if (indexOriginal === -1) continue

      try {
        console.log(`[V8 Lote] Autorizando termo ${resultado.consultId}...`)
        const authResponse = await fetch('/api/produto/v8/autorizar-termo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultId: resultado.consultId,
            apiId: apiSelecionada,
          }),
        })

        const authData = await authResponse.json()

        if (!authData.success) {
          console.warn(`[V8 Lote] Erro ao autorizar termo ${resultado.consultId}:`, authData.error)
        } else {
          resultadosTemp[indexOriginal].etapa = 'verificando'
        }
      } catch (error: any) {
        console.error(`[V8 Lote] Erro ao autorizar termo ${resultado.consultId}:`, error)
      }

      setResultados([...resultadosTemp])

      if (i < termosParaAutorizar.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // FASE 3: Esperar o tempo configurado
    console.log(`[V8 Lote] FASE 3: Aguardando ${tempoEspera} minutos antes de verificar status...`)
    setFaseAtual(`Aguardando ${tempoEspera} minutos...`)
    const tempoEsperaSegundos = tempoEspera * 60
    setTempoRestante(tempoEsperaSegundos)

    // Atualiza o tempo restante a cada segundo
    intervaloEsperaRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev === null || prev <= 1) {
          if (intervaloEsperaRef.current) {
            clearInterval(intervaloEsperaRef.current)
            intervaloEsperaRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Aguarda o tempo configurado
    for (let segundos = 0; segundos < tempoEsperaSegundos; segundos++) {
      if (cancelado || !processamentoAtivoRef.current) {
        if (intervaloEsperaRef.current) {
          clearInterval(intervaloEsperaRef.current)
          intervaloEsperaRef.current = null
        }
        setTempoRestante(null)
        break
      }

      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) {
        if (intervaloEsperaRef.current) {
          clearInterval(intervaloEsperaRef.current)
          intervaloEsperaRef.current = null
        }
        setTempoRestante(null)
        break
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    if (intervaloEsperaRef.current) {
      clearInterval(intervaloEsperaRef.current)
      intervaloEsperaRef.current = null
    }
    setTempoRestante(null)

    if (cancelado || !processamentoAtivoRef.current) {
      setProcessando(false)
      setFaseAtual('')
      return
    }

    // FASE 4: Verificar status de todos
    console.log('[V8 Lote] FASE 4: Verificando status de todos os termos...')
    setFaseAtual('Verificando status...')
    const termosParaVerificar = resultadosTemp.filter(r => r.consultId && !r.erro)

    for (let i = 0; i < termosParaVerificar.length; i++) {
      if (cancelado || !processamentoAtivoRef.current) break

      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) break

      const resultado = termosParaVerificar[i]
      const indexOriginal = resultadosTemp.findIndex(r => r.consultId === resultado.consultId)

      if (indexOriginal === -1) continue

      const percentual = Math.round(((i + 1) / termosParaVerificar.length) * 100)
      setProgresso({ atual: i + 1, total: termosParaVerificar.length, percentual })

      try {
        console.log(`[V8 Lote] Verificando status do termo ${resultado.consultId}...`)
        const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${resultado.consultId}`)
        const detalhesData = await detalhesResponse.json()

        if (detalhesData.success && detalhesData.data) {
          const termo = detalhesData.data
          resultadosTemp[indexOriginal].status = termo.status || termo.consultStatus || 'UNKNOWN'
          resultadosTemp[indexOriginal].margemDisponivel = 
            termo.availableMarginValue ||
            termo.available_margin_value ||
            termo.margin?.available ||
            termo.margin?.value ||
            termo.availableMargin ||
            termo.available_margin ||
            termo.data?.availableMarginValue ||
            0
          resultadosTemp[indexOriginal].sucesso = true
          resultadosTemp[indexOriginal].etapa = 'concluido'
        } else {
          // Tenta buscar pela listagem
          try {
            const listagemResponse = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${resultado.registro.cpf}`)
            const listagemData = await listagemResponse.json()
            
            if (listagemData.success && listagemData.data) {
              let termosLista = listagemData.data
              if (listagemData.data.data && Array.isArray(listagemData.data.data)) {
                termosLista = listagemData.data.data
              } else if (Array.isArray(listagemData.data)) {
                termosLista = listagemData.data
              }
              
              if (Array.isArray(termosLista)) {
                const termoEncontrado = termosLista.find((t: any) => t.id === resultado.consultId || t.consultId === resultado.consultId)
                if (termoEncontrado) {
                  resultadosTemp[indexOriginal].status = termoEncontrado.status || 'UNKNOWN'
                  resultadosTemp[indexOriginal].margemDisponivel = 
                    termoEncontrado.availableMarginValue ||
                    termoEncontrado.available_margin_value ||
                    termoEncontrado.margin?.available ||
                    termoEncontrado.margin?.value ||
                    0
                  resultadosTemp[indexOriginal].sucesso = true
                  resultadosTemp[indexOriginal].etapa = 'concluido'
                }
              }
            }
          } catch (error) {
            console.error(`[V8 Lote] Erro ao buscar listagem:`, error)
          }
          
          if (!resultadosTemp[indexOriginal].sucesso) {
            resultadosTemp[indexOriginal].erro = 'Termo criado mas não foi possível verificar status'
            resultadosTemp[indexOriginal].etapa = 'erro'
          }
        }
      } catch (error: any) {
        resultadosTemp[indexOriginal].erro = error.message || 'Erro ao verificar status'
        resultadosTemp[indexOriginal].etapa = 'erro'
        console.error(`[V8 Lote] Erro ao verificar status de ${resultado.registro.cpf}:`, error)
      }

      setResultados([...resultadosTemp])

      // Delay entre verificações
      if (i < termosParaVerificar.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    setProcessando(false)
    setPausado(false)
    setFaseAtual('')
    processamentoAtivoRef.current = false
    console.log('[V8 Lote] ✅ Processamento em lote concluído!')
  }

  // Função para processar consultas sequencialmente (estilo original)
  const processarConsultasSequencial = async () => {
    setProcessando(true)
    setPausado(false)
    processamentoAtivoRef.current = true
    setFaseAtual('Processando sequencialmente...')

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
      
      // Atualiza progresso e etapa
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
        etapa: 'criando_termo'
      }

      try {
        // ETAPA 1: Criar termo de consentimento
        console.log(`[V8 Lote] Criando termo para ${registro.cpf}...`)
        const termoResponse = await fetch('/api/produto/v8/termo-consentimento', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cpf: registro.cpf,
            nome: registro.nome,
            telefone: registro.telefone,
            email: registro.email,
            birthDate: registro.dataNascimento,
            gender: registro.genero,
            apiId: apiSelecionada,
          }),
        })

        const termoData = await termoResponse.json()

        if (!termoData.success || !termoData.data?.id) {
          resultado.sucesso = false
          resultado.etapa = 'erro'
          resultado.erro = termoData.error || 'Erro ao criar termo de consentimento'
          resultadosTemp.push(resultado)
          setResultados([...resultadosTemp])
          // Delay entre requisições para respeitar rate limit
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }

        const consultId = termoData.data.id
        resultado.consultId = consultId
        resultado.etapa = 'autorizando'
        resultado.linkAutorizacao = termoData.data.consentLink || `https://app.v8sistema.com/termos-de-autorizacao/${consultId}`

        // ETAPA 2: Autorizar termo automaticamente
        console.log(`[V8 Lote] Autorizando termo ${consultId}...`)
        const authResponse = await fetch('/api/produto/v8/autorizar-termo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            consultId: consultId,
            apiId: apiSelecionada,
          }),
        })

        const authData = await authResponse.json()

        if (!authData.success) {
          console.warn(`[V8 Lote] Erro ao autorizar termo ${consultId}:`, authData.error)
          // Não falha completamente, pode ser que o termo já esteja autorizado
        }

        resultado.etapa = 'verificando'
        
        // ETAPA 3: Verificar status e margem
        console.log(`[V8 Lote] Verificando status do termo ${consultId}...`)
        
        // Aguarda um pouco antes de verificar (pode levar tempo para processar)
        await new Promise(resolve => setTimeout(resolve, 2000))

        const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${consultId}`)
        const detalhesData = await detalhesResponse.json()

        if (detalhesData.success && detalhesData.data) {
          const termo = detalhesData.data
          
          resultado.status = termo.status || termo.consultStatus || 'UNKNOWN'
          
          // Busca margem em múltiplas estruturas possíveis
          resultado.margemDisponivel = 
            termo.availableMarginValue ||
            termo.available_margin_value ||
            termo.margin?.available ||
            termo.margin?.value ||
            termo.availableMargin ||
            termo.available_margin ||
            termo.data?.availableMarginValue ||
            0
          
          resultado.sucesso = true
          resultado.etapa = 'concluido'
        } else {
          // Tenta buscar pela listagem
          try {
            const listagemResponse = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${registro.cpf}`)
            const listagemData = await listagemResponse.json()
            
            if (listagemData.success && listagemData.data) {
              let termosLista = listagemData.data
              if (listagemData.data.data && Array.isArray(listagemData.data.data)) {
                termosLista = listagemData.data.data
              } else if (Array.isArray(listagemData.data)) {
                termosLista = listagemData.data
              }
              
              if (Array.isArray(termosLista)) {
                const termoEncontrado = termosLista.find((t: any) => t.id === consultId || t.consultId === consultId)
                if (termoEncontrado) {
                  resultado.status = termoEncontrado.status || 'UNKNOWN'
                  resultado.margemDisponivel = 
                    termoEncontrado.availableMarginValue ||
                    termoEncontrado.available_margin_value ||
                    termoEncontrado.margin?.available ||
                    termoEncontrado.margin?.value ||
                    0
                  resultado.sucesso = true
                  resultado.etapa = 'concluido'
                }
              }
            }
          } catch (error) {
            console.error(`[V8 Lote] Erro ao buscar listagem:`, error)
          }
          
          if (!resultado.sucesso) {
            resultado.sucesso = false
            resultado.etapa = 'erro'
            resultado.erro = 'Termo criado mas não foi possível verificar status'
          }
        }
      } catch (error: any) {
        resultado.sucesso = false
        resultado.etapa = 'erro'
        resultado.erro = error.message || 'Erro ao processar consulta'
        console.error(`[V8 Lote] Erro ao processar ${registro.cpf}:`, error)
      }

      resultadosTemp.push(resultado)
      setResultados([...resultadosTemp])

      // Delay entre requisições para respeitar rate limit (250 req/hora = ~14s entre requisições)
      // Usando 1 segundo para não ser muito lento, mas respeitando o limite
      if (i < registro.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 15000)) // 15 segundos entre cada registro
      }
    }

    setProcessando(false)
    setPausado(false)
    setFaseAtual('')
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
    setFaseAtual('')
    if (intervaloEsperaRef.current) {
      clearInterval(intervaloEsperaRef.current)
      intervaloEsperaRef.current = null
    }
    setTempoRestante(null)
  }

  // Função para atualizar status de todos os registro processados
  const atualizarStatusTodos = async () => {
    if (!apiSelecionada) {
      alert('Por favor, selecione a API V8 Digital')
      return
    }

    // Filtra apenas resultados que têm consultId (foram processados com sucesso)
    const resultadosComConsultId = resultados.filter(r => r.consultId)
    
    if (resultadosComConsultId.length === 0) {
      alert('Nenhum registro com termo de consentimento encontrado para atualizar status')
      return
    }

    setAtualizandoStatus(true)
    setProgressoAtualizacao({ atual: 0, total: resultadosComConsultId.length, percentual: 0 })

    const resultadosAtualizados = [...resultados]

    for (let i = 0; i < resultadosComConsultId.length; i++) {
      const resultado = resultadosComConsultId[i]
      const indexOriginal = resultados.findIndex(r => r.consultId === resultado.consultId)

      if (indexOriginal === -1) continue

      try {
        // Busca detalhes atualizados do termo
        const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${resultado.consultId}`)
        const detalhesData = await detalhesResponse.json()

        if (detalhesData.success && detalhesData.data) {
          const termo = detalhesData.data
          
          // Atualiza status
          resultadosAtualizados[indexOriginal].status = termo.status || termo.consultStatus || resultadosAtualizados[indexOriginal].status
          
          // Atualiza margem disponível
          const novaMargem = 
            termo.availableMarginValue ||
            termo.available_margin_value ||
            termo.margin?.available ||
            termo.margin?.value ||
            termo.availableMargin ||
            termo.available_margin ||
            termo.data?.availableMarginValue ||
            0
          
          if (novaMargem > 0) {
            resultadosAtualizados[indexOriginal].margemDisponivel = novaMargem
          }

          // Se o status mudou para sucesso/aprovado, marca como sucesso
          const statusUpper = resultadosAtualizados[indexOriginal].status?.toUpperCase() || ''
          if (statusUpper.includes('APPROVED') || statusUpper.includes('SUCCESS')) {
            resultadosAtualizados[indexOriginal].sucesso = true
            resultadosAtualizados[indexOriginal].etapa = 'concluido'
            if (resultadosAtualizados[indexOriginal].erro && !resultadosAtualizados[indexOriginal].erro.includes('Link Autorização')) {
              resultadosAtualizados[indexOriginal].erro = undefined
            }
          }

          console.log(`[V8 Lote] Status atualizado para ${resultado.registro.cpf}: ${resultadosAtualizados[indexOriginal].status}`)
        } else {
          // Tenta buscar pela listagem como fallback
          try {
            const listagemResponse = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${resultado.registro.cpf}`)
            const listagemData = await listagemResponse.json()
            
            if (listagemData.success && listagemData.data) {
              let termosLista = listagemData.data
              if (listagemData.data.data && Array.isArray(listagemData.data.data)) {
                termosLista = listagemData.data.data
              } else if (Array.isArray(listagemData.data)) {
                termosLista = listagemData.data
              }
              
              if (Array.isArray(termosLista)) {
                const termoEncontrado = termosLista.find((t: any) => t.id === resultado.consultId || t.consultId === resultado.consultId)
                if (termoEncontrado) {
                  resultadosAtualizados[indexOriginal].status = termoEncontrado.status || resultadosAtualizados[indexOriginal].status
                  const novaMargem = 
                    termoEncontrado.availableMarginValue ||
                    termoEncontrado.available_margin_value ||
                    termoEncontrado.margin?.available ||
                    termoEncontrado.margin?.value ||
                    0
                  if (novaMargem > 0) {
                    resultadosAtualizados[indexOriginal].margemDisponivel = novaMargem
                  }
                  
                  const statusUpper = resultadosAtualizados[indexOriginal].status?.toUpperCase() || ''
                  if (statusUpper.includes('APPROVED') || statusUpper.includes('SUCCESS')) {
                    resultadosAtualizados[indexOriginal].sucesso = true
                    resultadosAtualizados[indexOriginal].etapa = 'concluido'
                  }
                }
              }
            }
          } catch (error) {
            console.error(`[V8 Lote] Erro ao buscar listagem para ${resultado.registro.cpf}:`, error)
          }
        }
      } catch (error: any) {
        console.error(`[V8 Lote] Erro ao atualizar status de ${resultado.registro.cpf}:`, error)
      }

      // Atualiza progresso
      const percentual = Math.round(((i + 1) / resultadosComConsultId.length) * 100)
      setProgressoAtualizacao({
        atual: i + 1,
        total: resultadosComConsultId.length,
        percentual
      })

      // Atualiza resultados na tela
      setResultados([...resultadosAtualizados])

      // Delay entre requisições para respeitar rate limit
      if (i < resultadosComConsultId.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2 segundos entre cada atualização
      }
    }

    setAtualizandoStatus(false)
    setProgressoAtualizacao({ atual: 0, total: 0, percentual: 0 })
    console.log('[V8 Lote] ✅ Atualização de status concluída!')
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
      'Consult ID',
      'Status',
      'Margem Disponível (R$)',
      'Link Autorização',
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
      r.consultId || '',
      r.status || '',
      (r.margemDisponivel != null && String(r.margemDisponivel) !== '' && !isNaN(Number(r.margemDisponivel)))
        ? Number(r.margemDisponivel).toFixed(2).replace('.', ',')
        : '',
      r.linkAutorizacao || '',
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
    link.download = `consulta_v8_lote_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const baixarTemplate = () => {
    const cabecalho = ['CPF', 'Nome', 'Email', 'Telefone', 'Data Nascimento', 'Gênero']
    const dados = [
      ['12345678900', 'João Silva', 'joao@exemplo.com', '27999999999', '1990-01-15', 'Masculino'],
      ['98765432100', 'Maria Santos', 'maria@exemplo.com', '27988888888', '1985-05-20', 'Feminino']
    ]
    
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...dados.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')
    
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_consulta_v8_lote.csv'
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
      'WAITING_CREDIT_ANALYSIS': 'Aguardando Análise',
      'CONSENT_APPROVED': 'Aprovado',
      'REJECTED': 'Rejeitado',
      'FAILED': 'Falhou',
      'SUCCESS': 'Sucesso',
      'PENDING': 'Pendente'
    }
    return statusMap[status.toUpperCase()] || status
  }

  // Estatísticas
  const totalProcessados = resultados.length
  const sucessos = resultados.filter(r => r.sucesso).length
  const erros = resultados.filter(r => !r.sucesso).length
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
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            </div>
            Consulta V8 Digital em Lote
          </CardTitle>
          <CardDescription className="mt-2">
            Faça upload de um arquivo CSV/Excel com dados dos registro e processe consultas automaticamente (Criar Termo → Autorizar → Verificar Status)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seleção de API */}
            {apisDisponiveis.length > 0 ? (
              <div>
                <Label htmlFor="api">API V8 Digital *</Label>
                <select
                  id="api"
                  value={apiSelecionada}
                  onChange={(e) => setApiSelecionada(e.target.value)}
                  required
                  disabled={processando}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
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
                  Nenhuma API V8 Digital configurada. Configure na seção de Configurações.
                </AlertDescription>
              </Alert>
            )}

            {/* Seleção de Estilo de Consulta */}
            <div>
              <Label htmlFor="estiloConsulta">Estilo de Processamento *</Label>
              <select
                id="estiloConsulta"
                value={estiloConsulta}
                onChange={(e) => setEstiloConsulta(e.target.value as EstiloConsulta)}
                required
                disabled={processando}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              >
                <option value="sequencial">
                  Sequencial (Criar → Autorizar → Verificar → Próximo) - 15s entre cada
                </option>
                <option value="lote">
                  Em Lote (Criar Todos → Autorizar Todos → Aguardar → Verificar Todos)
                </option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {estiloConsulta === 'sequencial' 
                  ? 'Processa um registro por vez, aguardando 15 segundos entre cada consulta.'
                  : 'Cria e autoriza todos os termos primeiro, depois aguarda o tempo configurado antes de verificar o status de todos.'}
              </p>
            </div>

            {/* Configuração de Tempo de Espera (apenas para estilo lote) */}
            {estiloConsulta === 'lote' && (
              <div>
                <Label htmlFor="tempoEspera">Tempo de Espera (minutos) *</Label>
                <Input
                  id="tempoEspera"
                  type="number"
                  min="1"
                  max="120"
                  value={tempoEspera}
                  onChange={(e) => setTempoEspera(parseInt(e.target.value) || 60)}
                  disabled={processando}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tempo de espera entre autorizar os termos e verificar o status (padrão: 60 minutos)
                </p>
              </div>
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
                O arquivo deve conter as colunas: <strong>CPF</strong>, <strong>Nome</strong>, <strong>Email</strong>, <strong>Telefone</strong>, <strong>Data Nascimento</strong> (YYYY-MM-DD), <strong>Gênero</strong> (Masculino/Feminino)
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
                    {faseAtual && <strong className="text-indigo-600">{faseAtual}</strong>}
                    {!faseAtual && (
                      <>
                        Processando: <strong>{progresso.atual}</strong> de <strong>{progresso.total}</strong>
                      </>
                    )}
                    {pausado && (
                      <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                        Pausado
                      </Badge>
                    )}
                  </span>
                  <span className="text-gray-600 font-medium">{progresso.percentual}%</span>
                </div>
                <Progress value={progresso.percentual} className="h-2" />
                {tempoRestante !== null && tempoRestante > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
                    <p className="text-sm text-indigo-900 font-medium">
                      ⏱️ Aguardando: {Math.floor(tempoRestante / 60)}:{(tempoRestante % 60).toString().padStart(2, '0')}
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      O sistema está aguardando antes de verificar o status de todos os termos.
                    </p>
                  </div>
                )}
                {resultados.length > 0 && !faseAtual && (
                  <p className="text-xs text-gray-500">
                    Etapa atual: {resultados[resultados.length - 1]?.etapa === 'criando_termo' ? 'Criando Termo' :
                                  resultados[resultados.length - 1]?.etapa === 'autorizando' ? 'Autorizando' :
                                  resultados[resultados.length - 1]?.etapa === 'verificando' ? 'Verificando Status' :
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
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{sucessos}</div>
                <div className="text-xs text-green-600">Sucessos</div>
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
              {!processando && resultados.length > 0 && resultados.some(r => r.consultId) && (
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
                          resultado.status?.toUpperCase().includes('APPROVED') || resultado.status?.toUpperCase().includes('SUCCESS') 
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
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-2 text-xs text-red-600 max-w-xs">
                        <div className="truncate" title={resultado.erro || ''}>
                          {resultado.erro || '-'}
                        </div>
                        {resultado.linkAutorizacao && (
                          <a 
                            href={resultado.linkAutorizacao}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline text-xs mt-1"
                            title="Link para autorização"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Link Autorização</span>
                          </a>
                        )}
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
