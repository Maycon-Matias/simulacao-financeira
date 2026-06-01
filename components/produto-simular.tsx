"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calculator, Loader2, CheckCircle2, XCircle, Download } from "lucide-react"

interface SimulacaoResultado {
  success: boolean
  data?: any
  error?: string
}

export function ProdutoSimular() {
  const [usuarioId, setUsuarioId] = useState<string>("")
  const [lojaId, setLojaId] = useState<string>("")
  const [cpfs, setCpfs] = useState<string>("")
  const [callbackUrl, setCallbackUrl] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [loadingUserInfo, setLoadingUserInfo] = useState(true)
  const [todasLojas, setTodasLojas] = useState<Array<{lojaId: number; nomeLoja: string}>>([])
  const [resultado, setResultado] = useState<SimulacaoResultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Carrega informações do usuário ao montar o componente
  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/produto/entidade-info')
      const data = await response.json()
      
      if (data.success && data.userInfo) {
        // Preenche automaticamente usuarioId e lojaId
        setUsuarioId(data.userInfo.id)
        if (data.primeiraLoja) {
          setLojaId(data.primeiraLoja.lojaId.toString())
        }
        // Armazena todas as lojas para seleção
        if (data.todasLojas && Array.isArray(data.todasLojas)) {
          setTodasLojas(data.todasLojas.map((loja: any) => ({
            lojaId: loja.lojaId,
            nomeLoja: loja.nomeLoja || `Loja ${loja.lojaId}`,
          })))
        }
      }
    } catch (error) {
      console.error("Erro ao carregar informações do usuário:", error)
    } finally {
      setLoadingUserInfo(false)
    }
  }

  const handleSimular = async () => {
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const cpfsArray = cpfs.split('\n').filter(c => c.trim())
      const lojaIdNum = parseInt(lojaId || '0')

      if (!usuarioId || !lojaIdNum || cpfsArray.length === 0) {
        setErro('Preencha entidade ID, Loja ID e pelo menos um CPF')
        return
      }

      const response = await fetch('/api/produto/simular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuarioId,
          lojaId: lojaIdNum,
          cpfs: cpfsArray,
          callbackUrl: callbackUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setErro(data.error || 'Erro ao simular produto')
        setResultado({ success: false, error: data.error })
      } else {
        setResultado({ success: true, data: data.data })
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao fazer simulação')
      setResultado({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleExportarResultado = () => {
    if (!resultado?.data) return

    const dataStr = JSON.stringify(resultado.data, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `simulacao-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calculator className="h-5 w-5 text-blue-600" />
                </div>
                Simular Produto
              </CardTitle>
              <CardDescription className="mt-2">
                Cadastre simulações em massa na fila de simulação
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingUserInfo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-600">Carregando informações do usuário...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="usuarioId">entidade ID (UUID)</Label>
                <Input
                  id="usuarioId"
                  value={usuarioId}
                  onChange={(e) => setUsuarioId(e.target.value)}
                  placeholder="4b94d0c0-f783-45b4-ab3b-e8d0b19d382f"
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Preenchido automaticamente após login
                </p>
              </div>
              <div>
                <Label htmlFor="lojaId">Loja ID</Label>
                {todasLojas.length > 0 ? (
                  <Select
                    id="lojaId"
                    value={lojaId}
                    onChange={(e) => setLojaId(e.target.value)}
                    className="font-mono text-sm"
                  >
                    {todasLojas.map((loja) => (
                      <option key={loja.lojaId} value={loja.lojaId.toString()}>
                        {loja.nomeLoja} (ID: {loja.lojaId})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id="lojaId"
                    type="number"
                    value={lojaId}
                    onChange={(e) => setLojaId(e.target.value)}
                    placeholder="15377"
                    className="font-mono text-sm"
                  />
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {todasLojas.length > 0 
                    ? "Selecione a loja ou edite manualmente" 
                    : "Preenchido automaticamente com a primeira loja ativa"}
                </p>
              </div>
              <div>
                <Label htmlFor="cpfs">CPFs (um por linha)</Label>
                <Textarea
                  id="cpfs"
                  value={cpfs}
                  onChange={(e) => setCpfs(e.target.value)}
                  placeholder="09719299711&#10;12312312312"
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Insira um CPF por linha. Múltiplos CPFs serão processados em massa.
                </p>
              </div>
              <div>
                <Label htmlFor="callbackUrl">Callback URL (opcional)</Label>
                <Input
                  id="callbackUrl"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://webhook.site/seu-id"
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  URL para receber os resultados das simulações via webhook
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSimular}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Simular
              </>
            )}
          </Button>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {resultado?.success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Simulação realizada com sucesso!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Resultado da Simulação</CardTitle>
                <CardDescription>
                  {resultado.success ? 'Dados retornados pela API' : 'Erro na simulação'}
                </CardDescription>
              </div>
              {resultado.success && resultado.data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportarResultado}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar JSON
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {resultado.success && resultado.data ? (
              <div className="space-y-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Sucesso
                </Badge>
                <Separator />
                {resultado.data?.value && Array.isArray(resultado.data.value) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Simulações Cadastradas:</h4>
                    {resultado.data.value.map((item: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">ID:</span>
                            <span className="ml-2 text-gray-900 font-mono text-xs">{item.id}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">CPF:</span>
                            <span className="ml-2 text-gray-900">{item.cpfCliente}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Situação:</span>
                            <span className="ml-2 text-gray-900">{item.situacao}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Loja ID:</span>
                            <span className="ml-2 text-gray-900">{item.lojaId}</span>
                          </div>
                        </div>
                        {item.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/produto/simulacao/${item.id}`)
                                const data = await response.json()
                                if (data.success) {
                                  setResultado({ success: true, data: data.data })
                                }
                              } catch (error) {
                                console.error("Erro ao buscar simulação:", error)
                              }
                            }}
                          >
                            Ver Resultado da Simulação
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                {resultado.data?.Simulacoes && Array.isArray(resultado.data.Simulacoes) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Simulações Encontradas:</h4>
                    {resultado.data.Simulacoes.map((sim: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 bg-white">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <span className="text-xs font-medium text-gray-500">Financeira:</span>
                            <p className="text-sm font-semibold text-gray-900">{sim.Financeira}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Tabela:</span>
                            <p className="text-sm text-gray-900">{sim.NomeTabela}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Valor registro:</span>
                            <p className="text-sm font-bold text-green-600">
                              R$ {sim.ValorCliente?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Parcelas:</span>
                            <p className="text-sm text-gray-900">{sim.QuantidadeParcelas}x</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Valor Parcela (1ª):</span>
                            <p className="text-sm font-bold text-blue-600">
                              R$ {sim.Parcelas?.[0]?.ValorParcela?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-500">Taxa:</span>
                            <p className="text-sm text-gray-900">{sim.Parcelas?.[0]?.TaxaFinanciamento || '0'}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <div>
                  <Label className="mb-2 block">Dados Completos (JSON)</Label>
                  <pre className="bg-slate-50 p-4 rounded-lg overflow-auto text-sm border max-h-[400px]">
                    {JSON.stringify(resultado.data, null, 2)}
                  </pre>
                </div>
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

