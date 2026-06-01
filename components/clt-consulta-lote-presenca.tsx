"use client"

/**
 * Consulta em lote Presença Bank (Consignado Privado CLT).
 * Fluxo: o usuário informa apenas CPF (por planilha); matrícula e CNPJ vêm exclusivamente
 * do vínculo retornado pela API (consultar-vinculos), nunca de campos de formulário.
 */

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, XCircle, FileSpreadsheet, Upload, Download, entidade, TrendingUp, DollarSign, Shield, AlertCircle, RefreshCw, Search, Filter } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"
import { extrairVinculos, extrairMatriculaECnpj, validarVinculo, fazerRequisicaoComRetry } from "@/lib/utils"

interface ClientePlanilha {
  cpf: string
  nome: string
  dataNascimento?: string
  telefone?: string
  email?: string
}

interface VinculoEmpregaticio {
  matricula?: string
  cnpj?: string
  registroEmpregaticio?: string
  cnpjEmpregador?: string
  [key: string]: any
}

interface ResultadoConsulta {
  linha: number
  registro: ClientePlanilha
  sucesso: boolean
  vinculos?: VinculoEmpregaticio[]
  vinculoSelecionado?: VinculoEmpregaticio
  margemDisponivel?: number
  simulacaoDisponivel?: boolean | null
  erro?: string
  etapa?: 'consultando_vinculos' | 'consultando_margem' | 'concluido' | 'erro'
  operacaoId?: string
}

export function CLTConsultaLotePresenca() {
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [registro, setClientes] = useState<ClientePlanilha[]>([])
  const [resultados, setResultados] = useState<ResultadoConsulta[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 })
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'sucesso' | 'erro'>('todos')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processamentoAtivoRef = useRef(false)

  // Carrega APIs disponíveis (apenas Presença Bank)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active && c.type === 'presencabank')
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
    
    return dataLimpa
  }

  const processarCSV = (texto: string): ClientePlanilha[] => {
    const textoNormalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const linhas = textoNormalizado.split('\n').filter(linha => linha.trim())
    
    if (linhas.length < 2) {
      throw new Error('Planilha deve ter pelo menos uma linha de cabeçalho e uma linha de dados')
    }

    const separador = detectarSeparador(linhas[0])
    const cabecalho = parseCSVLine(linhas[0], separador).map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''))
    const indices: Record<string, number> = {}
    
    cabecalho.forEach((col, idx) => {
      if (col.includes('cpf')) indices.cpf = idx
      if (col.includes('nome')) indices.nome = idx
      if ((col.includes('data') && col.includes('nasc')) || col.includes('data_nascimento') || col.includes('dataNascimento')) indices.dataNascimento = idx
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
      
      let cpf = cpfRaw.replace(/\D/g, '')
      
      if (cpf.length > 0 && cpf.length < 11) {
        cpf = cpf.padStart(11, '0')
      }
      
      if (cpf.length > 11) {
        cpf = cpf.slice(-11)
      }
      
      if (cpf.length !== 11) {
        linhasInvalidas.push(i + 1)
        continue
      }

      dados.push({
        cpf,
        nome: valores[indices.nome] || '',
        dataNascimento: indices.dataNascimento !== undefined ? normalizarData(valores[indices.dataNascimento]) : undefined,
        telefone: indices.telefone !== undefined ? valores[indices.telefone].replace(/\D/g, '') : undefined,
        email: indices.email !== undefined ? valores[indices.email] : undefined,
      })
    }

    if (linhasInvalidas.length > 0) {
      console.warn(`${linhasInvalidas.length} linha(s) foram ignoradas por terem dados inválidos. Linhas: ${linhasInvalidas.slice(0, 10).join(', ')}${linhasInvalidas.length > 10 ? '...' : ''}`)
    }

    return dados
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const nome = (file.name || '').toLowerCase()
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
      alert('Para arquivos Excel (.xlsx/.xls), exporte primeiro como CSV no Excel (Salvar como → CSV UTF-8 ou CSV) e envie o arquivo .csv. O processamento em lote usa apenas arquivos CSV.')
      event.target.value = ''
      return
    }

    setArquivo(file)
    setLoading(true)
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
      setProgresso({ atual: 0, total: dados.length, percentual: 0 })
    } catch (error: any) {
      alert(`Erro ao processar arquivo: ${error.message}`)
      setArquivo(null)
    } finally {
      setLoading(false)
    }
  }

  const processarConsultas = async () => {
    if (!apiSelecionada || registro.length === 0) return

    setProcessando(true)
    setPausado(false)
    setCancelado(false)
    processamentoAtivoRef.current = true

    const inicio = resultados.length > 0 && !cancelado ? resultados.length : 0
    const novosResultados = cancelado ? [] : [...resultados]
    
    if (inicio === 0) {
      setProgresso({ atual: 0, total: registro.length, percentual: 0 })
    }

    let lastClientEndTime = Date.now();

    for (let i = inicio; i < registro.length; i++) {
      if (!processamentoAtivoRef.current || cancelado) break
      
      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) break

      const registro = registro[i]
      const resultado: ResultadoConsulta = {
        linha: i + 2,
        registro,
        sucesso: false,
        etapa: 'consultando_vinculos',
      }

      try {
        // 1. Consultar Presença com fluxo completo (autorização + vínculos + margem + simulação)
        resultado.etapa = 'consultando_vinculos'
        novosResultados[i] = resultado
        setResultados([...novosResultados])
        setProgresso({ atual: i + 1, total: registro.length, percentual: ((i + 1) / registro.length) * 100 })

        const consultaData = await fazerRequisicaoComRetry('/api/produto/presenca/consultar-clt-autorizado', {
          apiId: apiSelecionada,
          cpf: registro.cpf,
          nome: registro.nome || undefined,
          email: registro.email || undefined,
          telefone: registro.telefone || undefined,
          birthDate: registro.dataNascimento || undefined,
        })

        if (!consultaData.success) {
          resultado.erro = consultaData.error || 'Erro ao consultar Presença Bank'
          resultado.etapa = 'erro'
          novosResultados[i] = resultado
          setResultados([...novosResultados])
          setProgresso({ atual: i + 1, total: registro.length, percentual: ((i + 1) / registro.length) * 100 })
          continue
        }

        const data = consultaData.data || {}
        const vinculos = extrairVinculos(data.vinculos ?? data.raw ?? data)
        resultado.vinculos = vinculos

        if (!Array.isArray(vinculos) || vinculos.length === 0) {
          resultado.erro = 'CPF sem vínculo CLT ativo na Presença Bank ou dados não aceitos pela API. Trate como registro sem margem disponível.'
          resultado.etapa = 'erro'
          novosResultados[i] = resultado
          setResultados([...novosResultados])
          setProgresso({ atual: i + 1, total: registro.length, percentual: ((i + 1) / registro.length) * 100 })
          continue
        }

        resultado.vinculoSelecionado = vinculos[0]
        resultado.margemDisponivel = typeof data.margemAtivo === 'number'
          ? data.margemAtivo
          : typeof data.availableMarginValue === 'number'
            ? data.availableMarginValue
            : typeof data.availableMargin === 'number'
              ? data.availableMargin
              : 0
        resultado.simulacaoDisponivel = typeof data.simulacaoDisponivel === 'boolean' ? data.simulacaoDisponivel : null

        if (data.erroMargem && !resultado.margemDisponivel) {
          resultado.erro = String(data.erroMargem)
          resultado.etapa = 'erro'
        } else {
          resultado.sucesso = true
          resultado.etapa = 'concluido'
        }
      } catch (error: any) {
        const msgCatch = error?.message ?? (typeof error === 'string' ? error : error?.toString?.()) ?? 'Erro desconhecido ao processar consulta'
        resultado.erro = String(msgCatch).trim() || 'Erro desconhecido ao processar consulta'
        resultado.etapa = 'erro'
      }

      novosResultados[i] = resultado
      setResultados([...novosResultados])
      setProgresso({ atual: i + 1, total: registro.length, percentual: ((i + 1) / registro.length) * 100 })

      // Delay entre registro (5 segundos) para respeitar rate limit da API
      const delayMs = 5000
      await new Promise(resolve => setTimeout(resolve, delayMs))
      lastClientEndTime = Date.now()
    }

    setProcessando(false)
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
  }

  const formatarLinhaCSV = (valores: (string | number | undefined)[]): string => {
    return valores.map(v => {
      if (v === undefined || v === null) return ''
      const str = String(v)
      // Se contém vírgula, ponto e vírgula, aspas ou quebra de linha, envolve em aspas
      if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  }

  const formatarLinhaCSVTemplate = (valores: string[]): string => {
    // Para o template, usa ponto e vírgula (padrão Excel brasileiro) e envolve valores em aspas
    return valores.map(v => `"${v.replace(/"/g, '""')}"`).join(';')
  }

  const exportarResultados = () => {
    const cabecalho = [
      'Linha',
      'CPF',
      'Nome',
      'Email',
      'Telefone',
      'Data Nascimento',
      'Quantidade Vínculos',
      'Matrícula',
      'CNPJ',
      'Margem Disponível',
      'Status',
      'Erro'
    ]

    const linhas = resultados.map(r => [
      r.linha.toString(),
      r.registro.cpf,
      r.registro.nome,
      r.registro.email || '',
      r.registro.telefone || '',
      r.registro.dataNascimento || '',
      r.vinculos ? r.vinculos.length.toString() : '0',
      r.vinculoSelecionado?.matricula || r.vinculoSelecionado?.registroEmpregaticio || '',
      r.vinculoSelecionado?.cnpj || r.vinculoSelecionado?.cnpjEmpregador || '',
      r.margemDisponivel ? r.margemDisponivel.toFixed(2).replace('.', ',') : '',
      r.sucesso ? 'SUCESSO' : 'ERRO',
      r.erro || ''
    ])

    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...linhas.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')

    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `consulta_presenca_lote_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const baixarTemplate = () => {
    const cabecalho = ['CPF', 'Nome', 'Email', 'Telefone', 'Data Nascimento']
    const dados = [
      ['12345678900', 'João Silva', 'joao@exemplo.com', '11999887766', '1990-01-15'],
      ['98765432100', 'Maria Santos', 'maria@exemplo.com', '21988776655', '1985-05-20']
    ]
    
    // Gera CSV com ponto e vírgula como separador (padrão Excel brasileiro)
    const linhasCSV = [
      formatarLinhaCSVTemplate(cabecalho),
      ...dados.map(linha => formatarLinhaCSVTemplate(linha))
    ].join('\r\n')
    
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_consulta_presenca_lote.csv'
    link.click()
  }

  const formatarMoeda = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
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

  // Filtrar resultados
  const resultadosFiltrados = resultados.filter(r => {
    const matchBusca = !filtroBusca || 
      r.registro.cpf.includes(filtroBusca) ||
      r.registro.nome.toLowerCase().includes(filtroBusca.toLowerCase()) ||
      (r.operacaoId && r.operacaoId.includes(filtroBusca))
    
    const matchStatus = filtroStatus === 'todos' ||
      (filtroStatus === 'sucesso' && r.sucesso) ||
      (filtroStatus === 'erro' && !r.sucesso)
    
    return matchBusca && matchStatus
  })

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
            </div>
            Consulta Presença Bank em Lote
          </CardTitle>
          <CardDescription className="mt-2">
            Faça upload de um arquivo CSV/Excel com dados dos registro e processe consultas automaticamente (Consultar Vínculos → Consultar Margem)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seleção de API */}
            {apisDisponiveis.length > 0 ? (
              <div>
                <Label htmlFor="api">API Presença Bank *</Label>
                <select
                  id="api"
                  value={apiSelecionada}
                  onChange={(e) => setApiSelecionada(e.target.value)}
                  required
                  disabled={processando}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
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
                  Nenhuma API Presença Bank configurada. Configure na seção de Configurações.
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
                  onChange={handleFileUpload}
                  disabled={loading || processando}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={baixarTemplate}
                  className="flex items-center gap-2"
                  disabled={loading || processando}
                >
                  <Download className="h-4 w-4" />
                  Template
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O arquivo deve conter as colunas: <strong>CPF</strong> (obrigatório), <strong>Nome</strong>, <strong>Email</strong>, <strong>Telefone</strong>, <strong>Data Nascimento</strong> (YYYY-MM-DD)
              </p>
            </div>

            {/* Info do Arquivo */}
            {registro.length > 0 && (
              <Alert className="bg-purple-50 border-purple-200">
                <FileSpreadsheet className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-900">
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
                  <span className="text-gray-600 font-medium">{Math.round(progresso.percentual)}%</span>
                </div>
                <Progress value={progresso.percentual} className="h-2" />
                {resultados.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Etapa atual: {resultados[resultados.length - 1]?.etapa === 'consultando_vinculos' ? 'Consultando Vínculos' :
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
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
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
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">{sucessos}</div>
                <div className="text-xs text-green-600">Sucessos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-700">{erros}</div>
                <div className="text-xs text-red-600">Erros</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{comMargem}</div>
                <div className="text-xs text-blue-600">Com Margem</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-700">
                  {formatarMoeda(valorTotalMargem)}
                </div>
                <div className="text-xs text-purple-600">Margem Total</div>
              </div>
            </div>

            <div className="mt-4">
              <Button
                onClick={exportarResultados}
                variant="outline"
                className="w-full border-purple-600 text-purple-700 hover:bg-purple-50"
                disabled={processando}
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Resultados Detalhados</CardTitle>
                <CardDescription>
                  {totalProcessados} registro(s) processado(s) | Mostrando {resultadosFiltrados.length} resultado(s)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por CPF, Nome ou Operação ID..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as 'todos' | 'sucesso' | 'erro')}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="todos">Todos</option>
                <option value="sucesso">Sucessos</option>
                <option value="erro">Erros</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-semibold">Linha</th>
                    <th className="text-left p-2 font-semibold">CPF</th>
                    <th className="text-left p-2 font-semibold">Nome</th>
                    <th className="text-left p-2 font-semibold">Vínculos</th>
                    <th className="text-right p-2 font-semibold">Margem</th>
                    <th className="text-center p-2 font-semibold">Simulação</th>
                    <th className="text-center p-2 font-semibold">Status</th>
                    <th className="text-left p-2 font-semibold">Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosFiltrados.slice(0, 100).map((resultado, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-2 text-gray-600">{resultado.linha}</td>
                      <td className="p-2 font-mono text-xs">{resultado.registro.cpf}</td>
                      <td className="p-2">{resultado.registro.nome || '-'}</td>
                      <td className="p-2 text-xs text-gray-600">
                        {resultado.vinculos && resultado.vinculos.length > 0 ? (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {resultado.vinculos.length} vínculo(s)
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-2 text-right font-medium">
                        {resultado.sucesso ? (
                          <span
                            className={Number(resultado.margemDisponivel) > 0 ? 'text-green-600' : 'text-gray-600'}
                            title={Number(resultado.margemDisponivel) === 0 ? 'Sem margem disponível para consignado' : undefined}
                          >
                            {formatarMoeda(resultado.margemDisponivel ?? 0)}
                            {Number(resultado.margemDisponivel) === 0 && (
                              <span className="block text-xs text-gray-500 font-normal">(sem margem)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {resultado.sucesso && resultado.simulacaoDisponivel !== null ? (
                          <Badge className={resultado.simulacaoDisponivel ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}>
                            {resultado.simulacaoDisponivel ? 'Disponível' : 'Indisponível'}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {resultado.sucesso ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                            Sucesso
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-200">
                            <XCircle className="h-3 w-3 mr-1 inline" />
                            Erro
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs text-red-600 max-w-md break-words align-top" title={resultado.erro || (resultado.sucesso ? undefined : 'Erro ao processar consulta')}>
                        {resultado.sucesso ? (resultado.erro || '-') : (resultado.erro || 'Erro ao processar consulta (motivo não informado)')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultadosFiltrados.length > 100 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Mostrando apenas os primeiros 100 resultados. Use os filtros para refinar a busca.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
