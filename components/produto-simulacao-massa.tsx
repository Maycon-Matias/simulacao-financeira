"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, CheckCircle2, XCircle, entidade, Clock, RefreshCw } from "lucide-react"

export function ProdutoSimulacaoMassa() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [formData, setFormData] = useState({
    lojaId: '',
    usuarioId: '',
    cpfs: '',
    callbackUrl: '',
  })
  const [simulacaoId, setSimulacaoId] = useState<string>('')
  const [statusSimulacao, setStatusSimulacao] = useState<any>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/produto/entidade-info')
      const data = await response.json()
      if (data.success && data.userInfo) {
        setUserInfo(data.userInfo)
        const primeiraLoja = data.userInfo.lojasAtivas?.[0]
        if (primeiraLoja) {
          setFormData(prev => ({
            ...prev,
            lojaId: primeiraLoja.lojaId.toString(),
            usuarioId: data.userInfo.id || prev.usuarioId,
          }))
        }
      }
    } catch (error) {
      console.error("Erro ao carregar informações do usuário:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setResultado(null)
    setStatusSimulacao(null)

    try {
      // Converte a string de CPFs em array
      const cpfsArray = formData.cpfs
        .split(/[,\n]/)
        .map(cpf => cpf.trim().replace(/\D/g, ''))
        .filter(cpf => cpf.length === 11)

      if (cpfsArray.length === 0) {
        setErro('Informe pelo menos um CPF válido')
        setLoading(false)
        return
      }

      const response = await fetch('/api/produto/simular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuarioId: formData.usuarioId,
          lojaId: Number(formData.lojaId),
          cpfs: cpfsArray,
          callbackUrl: formData.callbackUrl || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setErro(data.error || 'Erro ao cadastrar simulação em massa')
      } else {
        setResultado(data.data)
        // Se retornou apenas um resultado, pega o ID
        if (data.data?.value && Array.isArray(data.data.value) && data.data.value.length > 0) {
          setSimulacaoId(data.data.value[0].id)
        }
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao cadastrar simulação em massa')
    } finally {
      setLoading(false)
    }
  }

  const consultarStatus = async () => {
    if (!simulacaoId) {
      setErro('Informe o ID da simulação para consultar o status')
      return
    }

    setLoadingStatus(true)
    setErro(null)

    try {
      const response = await fetch(`/api/produto/simulacao/${simulacaoId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        setErro(data.error || 'Erro ao consultar status da simulação')
      } else {
        setStatusSimulacao(data.data)
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao consultar status da simulação')
    } finally {
      setLoadingStatus(false)
    }
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <entidade className="h-5 w-5 text-blue-600" />
            </div>
            Simulação em Massa
          </CardTitle>
          <CardDescription className="mt-2">
            Cadastre múltiplos CPFs para simulação em massa através da fila de simulação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lojaId">Loja ID *</Label>
                <Input
                  id="lojaId"
                  value={formData.lojaId}
                  onChange={(e) => setFormData({ ...formData, lojaId: e.target.value })}
                  type="number"
                  required
                />
              </div>
              <div>
                <Label htmlFor="usuarioId">Usuário ID *</Label>
                <Input
                  id="usuarioId"
                  value={formData.usuarioId}
                  onChange={(e) => setFormData({ ...formData, usuarioId: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  ID do usuário obtido no login
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="cpfs">CPFs para Simulação *</Label>
              <Textarea
                id="cpfs"
                value={formData.cpfs}
                onChange={(e) => setFormData({ ...formData, cpfs: e.target.value })}
                placeholder="Informe os CPFs separados por vírgula ou quebra de linha:&#10;12345678900&#10;98765432100&#10;11122233344"
                className="min-h-[120px] font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Informe os CPFs separados por vírgula ou um por linha (apenas números)
              </p>
            </div>

            <div>
              <Label htmlFor="callbackUrl">URL de Callback (Opcional)</Label>
              <Input
                id="callbackUrl"
                value={formData.callbackUrl}
                onChange={(e) => setFormData({ ...formData, callbackUrl: e.target.value })}
                type="url"
                placeholder="https://webhook.site/seu-id"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL para receber notificações quando a simulação estiver pronta
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cadastrando Simulação...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Cadastrar Simulação em Massa
                </>
              )}
            </Button>
          </form>

          {erro && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {resultado && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <div>
                  <p className="font-medium">Simulação cadastrada com sucesso!</p>
                  {resultado.value && Array.isArray(resultado.value) && (
                    <div className="mt-2 space-y-2">
                      {resultado.value.map((item: any, index: number) => (
                        <div key={index} className="text-sm bg-white p-2 rounded border border-green-200">
                          <p><strong>CPF:</strong> {item.cpfCliente}</p>
                          <p><strong>ID da Simulação:</strong> {item.id}</p>
                          <p><strong>Situação:</strong> <Badge variant="outline" className="bg-blue-50">{item.situacao}</Badge></p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Consulta de Status */}
      {resultado && (
        <Card className="border-0 shadow-md animate-in fade-in-50 duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Consultar Status da Simulação
            </CardTitle>
            <CardDescription>
              Informe o ID da simulação para consultar o status e resultados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="simulacaoId">ID da Simulação</Label>
                <div className="flex gap-2">
                  <Input
                    id="simulacaoId"
                    value={simulacaoId}
                    onChange={(e) => setSimulacaoId(e.target.value)}
                    placeholder="ID retornado no cadastro"
                  />
                  <Button
                    onClick={consultarStatus}
                    disabled={loadingStatus || !simulacaoId}
                    variant="outline"
                  >
                    {loadingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Consultar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {statusSimulacao && (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold mb-2">Status da Simulação</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">CPF:</span>
                        <p className="font-semibold">{statusSimulacao.Cpf || statusSimulacao.cpfCliente}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Situação:</span>
                        <p className="font-semibold">
                          <Badge variant="outline" className="bg-green-50">
                            {statusSimulacao.situacao || 'Processando'}
                          </Badge>
                        </p>
                      </div>
                    </div>
                  </div>

                  {statusSimulacao.Simulacoes && Array.isArray(statusSimulacao.Simulacoes) && statusSimulacao.Simulacoes.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold">Simulações Encontradas:</h4>
                      {statusSimulacao.Simulacoes.map((sim: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold">{sim.NomeTabela || sim.Financeira}</h5>
                            <Badge variant="outline">{sim.QuantidadeParcelas} parcelas</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Valor Bruto:</span>
                              <p className="font-semibold">{formatarMoeda(sim.Valorbruto || 0)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Valor registro:</span>
                              <p className="font-semibold text-green-600">{formatarMoeda(sim.ValorCliente || 0)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Valor TAC:</span>
                              <p className="font-semibold">{formatarMoeda(sim.ValorTac || 0)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Simulação ID:</span>
                              <p className="font-mono text-xs break-all">{sim.SimulacaoId}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

