"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, FileText, Upload, Download, FileSpreadsheet } from "lucide-react"

interface ClientePlanilha {
  nome: string
  cpf: string
  email: string
  telefone: string
  dataNascimento: string
  sexo: string
  lojaId?: number
}

interface ResultadoProcessamento {
  linha: number
  registro: ClientePlanilha
  sucesso: boolean
  termoId?: string
  linkAssinatura?: string
  dataValidade?: string
  erro?: string
}

export function CLTTermoLote() {
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [registro, setClientes] = useState<ClientePlanilha[]>([])
  const [resultados, setResultados] = useState<ResultadoProcessamento[]>([])
  const [lojaId, setLojaId] = useState<string>('')
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 })
  const [aceitarAutomaticamente, setAceitarAutomaticamente] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Função para processar CSV
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

  const processarCSV = (texto: string): ClientePlanilha[] => {
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
      if (col.includes('nome')) indices.nome = idx
      if (col.includes('cpf')) indices.cpf = idx
      if (col.includes('email')) indices.email = idx
      if (col.includes('telefone')) indices.telefone = idx
      if (col.includes('data') && col.includes('nasc')) indices.dataNascimento = idx
      if (col.includes('sexo')) indices.sexo = idx
      if (col.includes('loja')) indices.lojaId = idx
    })

    if (!indices.nome || indices.cpf === undefined || !indices.email || !indices.telefone || !indices.dataNascimento || !indices.sexo) {
      throw new Error('Planilha deve conter as colunas: nome, cpf, email, telefone, dataNascimento, sexo')
    }

    const dados: ClientePlanilha[] = []
    for (let i = 1; i < linhas.length; i++) {
      const valores = parseCSVLine(linhas[i], separador).map(v => v.trim().replace(/^"|"$/g, ''))
      
      if (valores.length < cabecalho.length) continue

      const cpf = valores[indices.cpf].replace(/\D/g, '')
      if (cpf.length !== 11) continue

      dados.push({
        nome: valores[indices.nome],
        cpf: cpf,
        email: valores[indices.email],
        telefone: valores[indices.telefone].replace(/\D/g, ''),
        dataNascimento: valores[indices.dataNascimento],
        sexo: valores[indices.sexo],
        lojaId: indices.lojaId !== undefined ? parseInt(valores[indices.lojaId]) : undefined
      })
    }

    return dados
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
    setClientes([])
    setResultados([])

    try {
      const texto = await file.text()
      const dados = processarCSV(texto)
      
      if (dados.length === 0) {
        throw new Error('Nenhum registro válido encontrado na planilha')
      }

      setClientes(dados)
    } catch (error: any) {
      alert(`Erro ao processar planilha: ${error.message}`)
      setArquivo(null)
    }
  }

  const processarLote = async () => {
    if (registro.length === 0) {
      alert('Nenhum registro para processar')
      return
    }

    if (!lojaId) {
      alert('Informe o ID da Loja')
      return
    }

    setProcessando(true)
    setResultados([])
    setProgresso({ atual: 0, total: registro.length })

    const resultadosTemp: ResultadoProcessamento[] = []

    for (let i = 0; i < registro.length; i++) {
      const registro = registro[i]
      setProgresso({ atual: i + 1, total: registro.length })

      try {
        // Formatar data de nascimento
        let dataNascimento = registro.dataNascimento
        // Tentar converter formatos comuns
        if (dataNascimento.includes('/')) {
          const [dia, mes, ano] = dataNascimento.split('/')
          dataNascimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
        }

        const response = await fetch('/api/produto/clt/termo-aceite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lojaId: registro.lojaId || parseInt(lojaId),
            nome: registro.nome,
            cpf: registro.cpf,
            email: registro.email,
            telefone: registro.telefone,
            dataNascimento: dataNascimento,
            sexo: registro.sexo,
          }),
        })

        const data = await response.json()

        if (data.success && data.data?.value) {
          const termo = data.data.value
          
          // Se o termo não tem dataValidade e aceitarAutomaticamente está ativo, simular aceitação
          let termoAceito = !!termo.dataValidade
          let dataValidadeFinal = termo.dataValidade
          
          if (!termo.dataValidade && aceitarAutomaticamente) {
            // Simular aceitação automática: definir data de validade (30 dias a partir de hoje)
            const dataValidade = new Date()
            dataValidade.setDate(dataValidade.getDate() + 30)
            dataValidadeFinal = dataValidade.toISOString()
            termoAceito = true
            
            console.log(`Termo ${termo.id} marcado como aceito automaticamente para CPF ${registro.cpf}`)
          }
          
          resultadosTemp.push({
            linha: i + 2, // +2 porque linha 1 é cabeçalho e começamos do 0
            registro,
            sucesso: true,
            termoId: termo.id,
            dataValidade: dataValidadeFinal,
            linkAssinatura: termoAceito ? undefined : `https://termo.hubcredito.com.br/?cpf=${registro.cpf}`,
          })
        } else {
          resultadosTemp.push({
            linha: i + 2,
            registro,
            sucesso: false,
            erro: data.error || 'Erro desconhecido',
          })
        }
      } catch (error: any) {
        resultadosTemp.push({
          linha: i + 2,
          registro,
          sucesso: false,
          erro: error.message || 'Erro ao processar',
        })
      }

      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    setResultados(resultadosTemp)
    setProcessando(false)
  }

  // Função helper para escapar valores CSV corretamente
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // Se contém vírgula, aspas ou quebra de linha, precisa estar entre aspas e escapar aspas duplas
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Função helper para formatar linha CSV
  const formatarLinhaCSV = (valores: (string | number | undefined | null)[]): string => {
    return valores.map(escapeCSV).join(';') // Usar ponto e vírgula para melhor compatibilidade com Excel
  }

  const downloadModelo = () => {
    const cabecalho = ['nome', 'cpf', 'email', 'telefone', 'dataNascimento', 'sexo', 'lojaId']
    const dados = [
      ['João Silva', '12345678900', 'joao@email.com', '27999999999', '15/05/1990', 'Masculino', '15377'],
      ['Maria Santos', '98765432100', 'maria@email.com', '27988888888', '20/08/1985', 'Feminino', '15377']
    ]
    
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...dados.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n') // Usar \r\n para compatibilidade Windows
    
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'modelo_termos_clt.csv'
    link.click()
  }

  const exportarResultados = () => {
    // Cabeçalho CSV
    const cabecalho = [
      'Linha',
      'Nome',
      'CPF',
      'Email',
      'Telefone',
      'Sucesso',
      'Termo ID',
      'Data Validade',
      'Status',
      'Erro'
    ]

    // Linhas de dados
    const linhas = resultados.map(r => {
      let status = ''
      if (!r.sucesso) {
        status = 'ERRO'
      } else if (r.dataValidade) {
        status = aceitarAutomaticamente && !r.linkAssinatura ? 'Aceito Automaticamente' : 'Válido'
        // Formatar data para padrão brasileiro
        if (r.dataValidade) {
          try {
            const data = new Date(r.dataValidade)
            status += ` (Válido até ${data.toLocaleDateString('pt-BR')})`
          } catch (e) {
            // Se não conseguir formatar, deixa como está
          }
        }
      } else {
        status = 'Pendente Assinatura'
      }

      return [
        r.linha.toString(),
        r.registro.nome || '',
        r.registro.cpf || '',
        r.registro.email || '',
        r.registro.telefone || '',
        r.sucesso ? 'Sim' : 'Não',
        r.termoId || '',
        r.dataValidade ? new Date(r.dataValidade).toLocaleDateString('pt-BR') : '',
        status,
        r.erro || ''
      ]
    })

    // Converte para CSV com separador ponto e vírgula
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...linhas.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n') // Usar \r\n para compatibilidade Windows

    // Download com BOM UTF-8 para Excel reconhecer acentuação
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `resultados_termos_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const sucessos = resultados.filter(r => r.sucesso).length
  const erros = resultados.filter(r => !r.sucesso).length
  const termosValidos = resultados.filter(r => r.sucesso && r.dataValidade).length
  const termosPendentes = resultados.filter(r => r.sucesso && !r.dataValidade).length
  const termosAceitosAutomaticamente = resultados.filter(r => r.sucesso && r.dataValidade && aceitarAutomaticamente && !r.linkAssinatura).length

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
            </div>
            Importar Termos CLT em Lote
          </CardTitle>
          <CardDescription className="mt-2">
            Importe uma planilha CSV com registro e gere termos de aceite em lote
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Baixe o modelo de planilha</p>
                <p className="text-xs text-blue-700">Use o formato CSV com as colunas necessárias</p>
              </div>
            </div>
            <Button
              onClick={downloadModelo}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
          </div>

          <div>
            <Label htmlFor="lojaId">ID da Loja *</Label>
            <Input
              id="lojaId"
              type="number"
              value={lojaId}
              onChange={(e) => setLojaId(e.target.value)}
              placeholder="15377"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              ID da loja para os termos (será usado se não especificado na planilha)
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <input
              type="checkbox"
              id="aceitarAutomaticamente"
              checked={aceitarAutomaticamente}
              onChange={(e) => setAceitarAutomaticamente(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="aceitarAutomaticamente" className="text-sm font-medium text-gray-900 cursor-pointer">
                Aceitar termos automaticamente
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                Quando marcado, os termos serão marcados como aceitos automaticamente após serem gerados. 
                Uma data de validade de 30 dias será definida automaticamente. 
                <strong className="text-yellow-800"> Nota: Esta é uma simulação local - a API pode exigir assinatura manual.</strong>
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="arquivo">Selecionar Planilha CSV *</Label>
            <Input
              ref={fileInputRef}
              id="arquivo"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <p className="text-sm text-gray-500 mt-1">
              Selecione um arquivo CSV com os dados dos registro
            </p>
          </div>

          {registro.length > 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <strong>{registro.length}</strong> registro(s) encontrado(s) na planilha
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={processarLote}
            disabled={processando || registro.length === 0 || !lojaId}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            size="lg"
          >
            {processando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando... ({progresso.atual}/{progresso.total})
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Processar {registro.length > 0 ? `${registro.length} ` : ''}Termo(s)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card className="border-0 shadow-md animate-in fade-in-50 duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Resultados do Processamento</CardTitle>
              <Button
                onClick={exportarResultados}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Resultados
              </Button>
            </div>
            <CardDescription>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div className="text-center p-2 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-xl font-bold text-green-700">{sucessos}</div>
                  <div className="text-xs text-green-600 font-medium">Termos Gerados</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-xl font-bold text-blue-700">{termosValidos}</div>
                  <div className="text-xs text-blue-600 font-medium">Termos Válidos</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-xl font-bold text-yellow-700">{termosPendentes}</div>
                  <div className="text-xs text-yellow-600 font-medium">Pendentes</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-xl font-bold text-red-700">{erros}</div>
                  <div className="text-xs text-red-600 font-medium">Erros</div>
                </div>
              </div>
              {aceitarAutomaticamente && termosAceitosAutomaticamente > 0 && (
                <Alert className="mt-3 bg-purple-50 border-purple-200">
                  <CheckCircle2 className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="text-purple-900 text-xs">
                    <strong>{termosAceitosAutomaticamente}</strong> termo(s) aceito(s) automaticamente (simulação local).
                    <br />
                    <span className="text-purple-700">Nota: A API não possui endpoint para aceitar termos automaticamente.</span>
                  </AlertDescription>
                </Alert>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Resultados organizados por categoria */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {/* Termos Válidos */}
              {termosValidos > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Termos Válidos ({termosValidos})
                  </h4>
                  <div className="space-y-2">
                    {resultados.filter(r => r.sucesso && r.dataValidade).map((resultado, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-green-50 border-green-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-sm">
                                {resultado.registro.nome} ({resultado.registro.cpf})
                              </span>
                            </div>
                            <div className="ml-6 space-y-1 text-xs">
                              {resultado.termoId && (
                                <p className="text-gray-700">
                                  <span className="font-medium">ID:</span> <span className="font-mono">{resultado.termoId}</span>
                                </p>
                              )}
                              <p className="text-green-700">
                                <span className="font-medium">Válido até:</span> {new Date(resultado.dataValidade!).toLocaleDateString('pt-BR')}
                              </p>
                              {aceitarAutomaticamente && !resultado.linkAssinatura && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs mt-1">
                                  Aceito Automaticamente
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Termos Pendentes */}
              {termosPendentes > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Termos Pendentes de Assinatura ({termosPendentes})
                  </h4>
                  <div className="space-y-2">
                    {resultados.filter(r => r.sucesso && !r.dataValidade).map((resultado, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-orange-50 border-orange-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-sm">
                                {resultado.registro.nome} ({resultado.registro.cpf})
                              </span>
                            </div>
                            <div className="ml-6 space-y-1 text-xs">
                              {resultado.termoId && (
                                <p className="text-gray-700">
                                  <span className="font-medium">ID:</span> <span className="font-mono">{resultado.termoId}</span>
                                </p>
                              )}
                              <p className="text-orange-700 font-medium">registro precisa assinar o termo</p>
                              {resultado.linkAssinatura && (
                                <a
                                  href={resultado.linkAssinatura}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline break-all"
                                >
                                  {resultado.linkAssinatura}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Erros */}
              {erros > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Erros ({erros})
                  </h4>
                  <div className="space-y-2">
                    {resultados.filter(r => !r.sucesso).map((resultado, index) => (
                      <div key={index} className="p-3 rounded-lg border bg-red-50 border-red-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <span className="font-medium text-sm">
                                Linha {resultado.linha}: {resultado.registro.nome} ({resultado.registro.cpf})
                              </span>
                            </div>
                            <p className="ml-6 text-xs text-red-700">
                              <span className="font-medium">Erro:</span> {resultado.erro}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

