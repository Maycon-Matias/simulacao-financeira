"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, CheckCircle2, XCircle, entidade, DollarSign, Calendar, FileText } from "lucide-react"

interface ConsultaResultado {
  success: boolean
  data?: any
  error?: string
}

export function ProdutoConsultar() {
  const [parametros, setParametros] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ConsultaResultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const handleConsultar = async () => {
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const cpf = parametros.trim() || undefined

      const response = await fetch('/api/produto/consultar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf,
        }),
      })

      const data = await response.json()

      console.log('Resposta da API:', data)

      if (!response.ok) {
        // Trata erros HTTP específicos
        if (response.status === 401) {
          setErro('Erro de autenticação. Verifique as credenciais na aba "Configuração" ou no arquivo .env.local')
        } else if (response.status === 500) {
          setErro(data.error || 'Erro interno do servidor. Verifique as credenciais e tente novamente.')
        } else {
          setErro(data.error || `Erro ${response.status}: ${response.statusText}`)
        }
        setResultado({ success: false, error: data.error || 'Erro ao consultar produto' })
      } else if (!data.success) {
        setErro(data.error || 'Erro ao consultar produto')
        setResultado({ success: false, error: data.error })
      } else {
        console.log('Dados recebidos:', data.data)
        setResultado({ success: true, data: data.data })
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao fazer consulta')
      setResultado({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Search className="h-5 w-5 text-blue-600" />
                </div>
                Consultar Produto
              </CardTitle>
              <CardDescription className="mt-2">
                Consulte propostas por CPF, ID ou Nome
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="parametros">CPF, ID de Proposta ou Nome do registro (opcional)</Label>
            <Input
              id="parametros"
              value={parametros}
              onChange={(e) => setParametros(e.target.value)}
              placeholder="01893618161 ou deixe vazio para listar todas"
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500 mt-1">
              Deixe vazio para listar todas as propostas, ou informe CPF/ID/Nome para filtrar
            </p>
          </div>

          <Button
            onClick={handleConsultar}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Consultar
              </>
            )}
          </Button>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div>
                  <p className="font-medium">{erro}</p>
                  {(erro.toLowerCase().includes('autentic') || erro.toLowerCase().includes('unauthorized') || erro.toLowerCase().includes('credenciais')) && (
                    <div className="mt-2 text-sm">
                      <p className="text-gray-700">Sugestões:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1 text-gray-600">
                        <li>Verifique as credenciais na aba "Configuração"</li>
                        <li>Confirme se o arquivo .env.local está configurado corretamente</li>
                        <li>Tente testar a conexão na aba "Configuração"</li>
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {resultado?.success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Consulta realizada com sucesso!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card className="border-0 shadow-md animate-in fade-in-50 duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Resultado da Consulta</CardTitle>
            <CardDescription>
              {resultado.success ? 'Dados retornados pela API' : 'Erro na consulta'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resultado.success && resultado.data ? (
              <div className="space-y-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Sucesso
                </Badge>
                {/* Verifica diferentes estruturas de resposta */}
                {(() => {
                  // Tenta encontrar o array de propostas em diferentes formatos
                  let propostas: any[] = []
                  
                  if (Array.isArray(resultado.data)) {
                    propostas = resultado.data
                  } else if (resultado.data?.value && Array.isArray(resultado.data.value)) {
                    propostas = resultado.data.value
                  } else if (resultado.data?.data && Array.isArray(resultado.data.data)) {
                    propostas = resultado.data.data
                  } else if (resultado.data?.propostas && Array.isArray(resultado.data.propostas)) {
                    propostas = resultado.data.propostas
                  }
                  
                  if (propostas.length > 0) {
                    return (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600 font-medium">
                          {propostas.length} proposta(s) encontrada(s)
                        </p>
                        {propostas.map((proposta: any, index: number) => {
                          // Função para formatar valores monetários
                          const formatarMoeda = (valor: number | undefined | null): string => {
                            if (valor === undefined || valor === null) return 'N/A'
                            return new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(valor)
                          }

                          // Função para formatar datas
                          const formatarData = (data: string | undefined | null): string => {
                            if (!data) return 'N/A'
                            try {
                              return new Date(data).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            } catch {
                              return data
                            }
                          }

                          // Função para obter status da proposta
                          const getStatusProposta = (situacao: number): { label: string; color: string } => {
                            const statusMap: Record<number, { label: string; color: string }> = {
                              1: { label: 'Temporária', color: 'bg-gray-100 text-gray-800' },
                              2: { label: 'Enviado Análise', color: 'bg-blue-100 text-blue-800' },
                              3: { label: 'Enviado Atendente', color: 'bg-yellow-100 text-yellow-800' },
                              4: { label: 'Aprovada', color: 'bg-green-100 text-green-800' },
                              5: { label: 'Reprovada', color: 'bg-red-100 text-red-800' },
                              6: { label: 'Cancelada', color: 'bg-gray-100 text-gray-800' },
                              7: { label: 'Aprovada Encerrada', color: 'bg-green-100 text-green-800' },
                              8: { label: 'Reprovada Encerrada', color: 'bg-red-100 text-red-800' },
                            }
                            return statusMap[situacao] || { label: `Situação ${situacao}`, color: 'bg-gray-100 text-gray-800' }
                          }

                          const status = getStatusProposta(proposta.situacao)

                          return (
                            <div key={index} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-md border-gray-200">
                              <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b">
                                <Search className="h-4 w-4 text-blue-500" />
                                Proposta #{proposta.id || index + 1}
                              </h3>
                              
                              <div className="space-y-4">
                                {/* Status da Proposta - DESTACADO */}
                                <div className={`p-4 rounded-lg border-2 ${
                                  proposta.situacao === 4 || proposta.situacao === 7 
                                    ? 'bg-green-50 border-green-400' 
                                    : proposta.situacao === 5 || proposta.situacao === 8
                                    ? 'bg-red-50 border-red-400'
                                    : 'bg-yellow-50 border-yellow-400'
                                }`}>
                                  <div className="flex items-center gap-3">
                                    {proposta.situacao === 4 || proposta.situacao === 7 ? (
                                      <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                                    ) : proposta.situacao === 5 || proposta.situacao === 8 ? (
                                      <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                                    ) : (
                                      <FileText className="h-6 w-6 text-yellow-600 flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                      <h4 className={`text-lg font-bold mb-1 ${
                                        proposta.situacao === 4 || proposta.situacao === 7 
                                          ? 'text-green-800' 
                                          : proposta.situacao === 5 || proposta.situacao === 8
                                          ? 'text-red-800'
                                          : 'text-yellow-800'
                                      }`}>
                                        {status.label}
                                      </h4>
                                      <p className={`text-sm ${
                                        proposta.situacao === 4 || proposta.situacao === 7 
                                          ? 'text-green-700' 
                                          : proposta.situacao === 5 || proposta.situacao === 8
                                          ? 'text-red-700'
                                          : 'text-yellow-700'
                                      }`}>
                                        {proposta.situacao === 4 && '✅ Proposta aprovada! O registro pode receber o crédito.'}
                                        {proposta.situacao === 5 && '❌ Proposta reprovada. O registro não pode receber o crédito.'}
                                        {proposta.situacao === 7 && '✅ Proposta aprovada e finalizada.'}
                                        {proposta.situacao === 8 && '❌ Proposta reprovada e finalizada.'}
                                        {(proposta.situacao === 1 || proposta.situacao === 2 || proposta.situacao === 3) && '⏳ Proposta em análise. Aguarde a aprovação.'}
                                        {proposta.situacao === 6 && '🚫 Proposta cancelada.'}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Seção: Informações do registro */}
                                <div>
                                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <entidade className="h-4 w-4 text-blue-500" />
                                    Informações do registro
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex items-center gap-1 mb-1">
                                        <entidade className="h-4 w-4 text-gray-500" />
                                        <span className="text-xs font-medium text-gray-700">Nome do registro:</span>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-900">{proposta.nomeCliente || 'Não informado'}</p>
                                      <p className="text-xs text-gray-500 mt-1 italic">Nome completo do registro</p>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1 mb-1">
                                        <entidade className="h-4 w-4 text-gray-500" />
                                        <span className="text-xs font-medium text-gray-700">CPF:</span>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-900 font-mono">
                                        {proposta.documento ? proposta.documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : 'Não informado'}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1 italic">CPF do registro</p>
                                    </div>
                                    {proposta.id && (
                                      <div>
                                        <div className="flex items-center gap-1 mb-1">
                                          <FileText className="h-4 w-4 text-gray-500" />
                                          <span className="text-xs font-medium text-gray-700">Número da Proposta:</span>
                                        </div>
                                        <p className="text-sm font-semibold text-gray-900">{proposta.id}</p>
                                        <p className="text-xs text-gray-500 mt-1 italic">ID único desta proposta</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Seção: Valores da Proposta */}
                                {(proposta.valorVista !== undefined || proposta.valorParcela !== undefined || proposta.valorBruto !== undefined || proposta.valorTac !== undefined) && (
                                  <div className="border-t pt-4">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-green-500" />
                                      Valores da Proposta
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {proposta.valorVista !== undefined && (
                                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <DollarSign className="h-4 w-4 text-green-600" />
                                            <span className="text-xs font-medium text-gray-700">💰 Valor que o registro Recebe:</span>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">{formatarMoeda(proposta.valorVista)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Valor líquido que o registro receberá</p>
                                        </div>
                                      )}
                                      {proposta.valorParcela !== undefined && (
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <DollarSign className="h-4 w-4 text-blue-600" />
                                            <span className="text-xs font-medium text-gray-700">💳 Valor de Cada Parcela:</span>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">{formatarMoeda(proposta.valorParcela)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Valor que será descontado mensalmente</p>
                                        </div>
                                      )}
                                      {proposta.valorBruto !== undefined && (
                                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <DollarSign className="h-4 w-4 text-purple-600" />
                                            <span className="text-xs font-medium text-gray-700">📊 Valor Total Bruto:</span>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">{formatarMoeda(proposta.valorBruto)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Valor total antes dos descontos</p>
                                        </div>
                                      )}
                                      {proposta.valorTac !== undefined && (
                                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <DollarSign className="h-4 w-4 text-yellow-600" />
                                            <span className="text-xs font-medium text-gray-700">📋 Taxa de Abertura (TAC):</span>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">{formatarMoeda(proposta.valorTac)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Taxa cobrada na abertura do crédito</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Seção: Plano de Pagamento */}
                                {(proposta.plano !== undefined || proposta.numeroParcelas !== undefined) && (
                                  <div className="border-t pt-4">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-blue-500" />
                                      Plano de Pagamento
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {proposta.plano !== undefined && (
                                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <FileText className="h-4 w-4 text-indigo-600" />
                                            <span className="text-xs font-medium text-gray-700">📅 Quantidade de Parcelas:</span>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">{proposta.plano} parcela(s)</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Número de vezes que será descontado do salário</p>
                                        </div>
                                      )}
                                      {proposta.valorParcela !== undefined && proposta.plano !== undefined && (
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <DollarSign className="h-4 w-4 text-blue-600" />
                                            <span className="text-xs font-medium text-gray-700">💵 Valor por Parcela:</span>
                                          </div>
                                          <p className="text-lg font-bold text-gray-900">{formatarMoeda(proposta.valorParcela)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Valor descontado mensalmente</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Seção: Histórico da Proposta */}
                                {(proposta.dataProposta || proposta.dataAprovacao || proposta.dataReprovacao) && (
                                  <div className="border-t pt-4">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-blue-500" />
                                      Histórico da Proposta
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {proposta.dataProposta && (
                                        <div>
                                          <div className="flex items-center gap-1 mb-1">
                                            <Calendar className="h-4 w-4 text-gray-500" />
                                            <span className="text-xs font-medium text-gray-700">📅 Data de Criação:</span>
                                          </div>
                                          <p className="text-sm font-semibold text-gray-900">{formatarData(proposta.dataProposta)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Data em que a proposta foi criada</p>
                                        </div>
                                      )}
                                      {proposta.dataAprovacao && (
                                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <Calendar className="h-4 w-4 text-green-600" />
                                            <span className="text-xs font-medium text-gray-700">✅ Data de Aprovação:</span>
                                          </div>
                                          <p className="text-sm font-semibold text-gray-900">{formatarData(proposta.dataAprovacao)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Data em que a proposta foi aprovada</p>
                                        </div>
                                      )}
                                      {proposta.dataReprovacao && (
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                                          <div className="flex items-center gap-1 mb-1">
                                            <Calendar className="h-4 w-4 text-red-600" />
                                            <span className="text-xs font-medium text-gray-700">❌ Data de Reprovação:</span>
                                          </div>
                                          <p className="text-sm font-semibold text-gray-900">{formatarData(proposta.dataReprovacao)}</p>
                                          <p className="text-xs text-gray-500 mt-1 italic">Data em que a proposta foi reprovada</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Seção: Informações Adicionais */}
                                {(() => {
                                  const camposConhecidos = [
                                    'id', 'documento', 'nomeCliente', 'valorVista', 'valorParcela', 
                                    'plano', 'situacao', 'dataProposta', 'valorBruto', 'valorTac',
                                    'numeroParcelas', 'dataAprovacao', 'dataReprovacao'
                                  ]
                                  
                                  const camposAdicionais = Object.entries(proposta).filter(([key]) => {
                                    if (camposConhecidos.includes(key.toLowerCase())) return false
                                    const valor = proposta[key]
                                    if (valor === undefined || valor === null || valor === '') return false
                                    if (typeof valor === 'object' && !Array.isArray(valor)) return false
                                    return true
                                  })

                                  if (camposAdicionais.length === 0) return null

                                  return (
                                    <div className="border-t pt-3">
                                      <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Informações Adicionais</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {camposAdicionais.map(([key, value]) => (
                                          <div key={key}>
                                            <span className="text-xs font-medium text-gray-500">
                                              {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:
                                            </span>
                                            <p className="text-sm text-gray-900">
                                              {typeof value === 'number' && value > 100 
                                                ? formatarMoeda(value)
                                                : String(value)
                                              }
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>

                              {/* Seção de dados completos (JSON) para debug */}
                              <details className="mt-4 pt-4 border-t">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                  Ver dados completos (JSON)
                                </summary>
                                <pre className="mt-2 bg-slate-50 p-3 rounded text-xs overflow-auto max-h-[200px] border">
                                  {JSON.stringify(proposta, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )
                        })}
                      </div>
                    )
                  } else {
                    // Se não encontrou array, mostra JSON completo
                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          Dados retornados (formato não reconhecido):
                        </p>
                        <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm border max-h-[500px]">
                          {JSON.stringify(resultado.data, null, 2)}
                        </pre>
                      </div>
                    )
                  }
                })()}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {resultado.error || 'Erro desconhecido'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

