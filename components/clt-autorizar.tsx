"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield, ShieldCheck, ShieldX, ExternalLink, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface CLTAutorizarProps {
  onSuccess?: (dados: any) => void
  onError?: (erro: string) => void
  apiId?: string
  dadosAnteriores?: any
}

export function CLTAutorizar({ onSuccess, onError, apiId: apiIdProp, dadosAnteriores }: CLTAutorizarProps = {}) {
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [statusAutorizacao, setStatusAutorizacao] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [jaAutorizado, setJaAutorizado] = useState(false) // Flag para quando o usuário confirma que já está autorizado
  const [apiSelecionada, setApiSelecionada] = useState<string>(apiIdProp || '')
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [formData, setFormData] = useState({
    cpf: dadosAnteriores?.cpf || dadosAnteriores?.cpfTrabalhador || '',
    nomeCompleto: dadosAnteriores?.nome || dadosAnteriores?.nomeCompleto || '', // Opcional - pode deixar vazio
    telefone: dadosAnteriores?.telefone || '',
    serviceType: dadosAnteriores?.serviceType || 'QITECH', // Padrão
  })

  // Preenche dados se vierem de etapa anterior
  useEffect(() => {
    if (dadosAnteriores?.cpf || dadosAnteriores?.cpfTrabalhador) {
      setFormData(prev => ({
        ...prev,
        cpf: dadosAnteriores.cpf || dadosAnteriores.cpfTrabalhador || prev.cpf,
        nomeCompleto: dadosAnteriores.nome || dadosAnteriores.nomeCompleto || prev.nomeCompleto,
        telefone: dadosAnteriores.telefone || prev.telefone,
      }))
    }
    if (apiIdProp) {
      setApiSelecionada(apiIdProp)
    }
  }, [dadosAnteriores, apiIdProp])

  // Carrega APIs disponíveis ao montar o componente
  // Nota: Autorização é necessária apenas para Nossa Fintech, mas mostramos todos os bancos para consistência
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        // Mostra todos os bancos ativos, mas apenas Nossa Fintech suporta autorização
        const configs = manager.getConfigs().filter(c => c.active)
        setApisDisponiveis(configs)
        // Define a API padrão como selecionada (preferência por Nossa Fintech se disponível)
        if (configs.length > 0) {
          const nossaFintech = configs.find(c => c.type === 'nossafintech')
          const defaultId = nossaFintech?.id || manager.getDefaultApiId() || configs[0].id
          setApiSelecionada(defaultId)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Carrega dados do localStorage quando o componente é montado
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('clt_autorizacao_dados')
    if (dadosSalvos) {
      try {
        const dados = JSON.parse(dadosSalvos)
        setFormData(prev => ({
          ...prev,
          cpf: dados.cpf || prev.cpf,
          nomeCompleto: dados.nomeCompleto || prev.nomeCompleto,
          telefone: dados.telefone || prev.telefone,
          serviceType: dados.serviceType || prev.serviceType,
        }))
        
        // Se foi marcado como autorizado manualmente, restaura o status
        if (dados.marcadoManual && dados.status === 'AUTHORIZED') {
          setJaAutorizado(true)
          setStatusAutorizacao('AUTHORIZED')
        }
        
        console.log('Dados de autorização carregados:', dados)
      } catch (error) {
        console.error('Erro ao carregar dados salvos:', error)
      }
    }
  }, [])

  // Função para verificar status da autorização
  const verificarStatus = async () => {
    if (!formData.cpf || formData.cpf.length !== 11) {
      setErro('Por favor, informe um CPF válido (11 dígitos)')
      return
    }

    if (!apiSelecionada) {
      setErro('Por favor, selecione um banco primeiro')
      return
    }

    setVerificando(true)
    setErro(null)
    setStatusAutorizacao(null)

    try {
      const response = await fetch('/api/produto/verificar-status-clt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: formData.cpf,
          serviceType: formData.serviceType,
          apiId: apiSelecionada,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setErro(data.error || 'Erro ao verificar status da autorização')
      } else {
        const status = data.data?.status || data.status || 'UNKNOWN'
        const statusUpper = status.toUpperCase()
        setStatusAutorizacao(statusUpper)
        console.log('[CLTAutorizar] Status da autorização:', status)
        
        // Salva o status no localStorage (preserva promotId se já existir)
        const autorizacaoAtual = localStorage.getItem('clt_autorizacao_dados')
        if (autorizacaoAtual) {
          try {
            const dadosAtuais = JSON.parse(autorizacaoAtual)
            dadosAtuais.status = statusUpper
            dadosAtuais.apiId = apiSelecionada
            // Preserva o promotId se já existir
            if (!dadosAtuais.promotId && data.data?.promotId) {
              dadosAtuais.promotId = data.data.promotId
            }
            localStorage.setItem('clt_autorizacao_dados', JSON.stringify(dadosAtuais))
            console.log('[CLTAutorizar] Status atualizado no localStorage:', dadosAtuais)
          } catch (e) {
            console.error('[CLTAutorizar] Erro ao atualizar status:', e)
          }
        }
        
        // Se retornar PENDING mas o usuário sabe que está autorizado no sistema web
        if (statusUpper === 'PENDING' || statusUpper === 'PENDENTE') {
          console.warn('[CLTAutorizar] Status retornado como PENDING. Se o registro já está autorizado no sistema web, pode haver diferença no promot_id ou service_type usado.')
        }
      }
    } catch (error: any) {
      console.error('Erro ao verificar status:', error)
      setErro(error.message || 'Erro ao verificar status da autorização')
    } finally {
      setVerificando(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.cpf || formData.cpf.length !== 11) {
      setErro('Por favor, informe um CPF válido (11 dígitos)')
      return
    }

    if (!formData.telefone || formData.telefone.replace(/\D/g, '').length < 8) {
      setErro('Por favor, informe um telefone válido')
      return
    }

    if (!apiSelecionada) {
      setErro('Por favor, selecione um banco para realizar a autorização')
      return
    }

    // Valida que apenas Nossa Fintech suporta autorização
    const apiSelecionadaObj = apisDisponiveis.find(a => a.id === apiSelecionada)
    if (!apiSelecionadaObj || apiSelecionadaObj.type !== 'nossafintech') {
      setErro('⚠️ Apenas Nossa Fintech suporta autorização CLT. Por favor, selecione uma API Nossa Fintech.')
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)
    setStatusAutorizacao(null)

    try {
      // Se não tiver nome, usa um padrão
      const nomeParaEnviar = formData.nomeCompleto.trim() || 'registro'

      const response = await fetch('/api/produto/autorizar-clt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: formData.cpf,
          nomeCompleto: nomeParaEnviar,
          telefone: formData.telefone,
          serviceType: formData.serviceType,
          apiId: apiSelecionada,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errorMsg = data.error || 'Erro ao criar autorização'
        setErro(errorMsg)
        onError?.(errorMsg)
      } else {
        setResultado(data.data)
        const status = data.data?.status || 'PENDING'
        
        // Salva dados no localStorage com apiId e promotId para garantir que usamos a mesma API
        const dadosParaSalvar = {
          cpf: formData.cpf,
          nomeCompleto: formData.nomeCompleto,
          telefone: formData.telefone,
          serviceType: formData.serviceType,
          apiId: apiSelecionada,
          promotId: data.data?.promotId || null, // Salva o promot_id usado na autorização
          status: status.toUpperCase(),
          timestamp: new Date().toISOString()
        }
        localStorage.setItem('clt_autorizacao_dados', JSON.stringify(dadosParaSalvar))
        console.log('[CLTAutorizar] Dados de autorização salvos:', dadosParaSalvar)

        // Atualiza status
        setStatusAutorizacao(status.toUpperCase())

        console.log('Autorização criada com sucesso:', data)
        
        // Chama callback de sucesso
        onSuccess?.({
          ...data.data,
          cpf: formData.cpf,
          nomeCompleto: formData.nomeCompleto,
          telefone: formData.telefone,
          serviceType: formData.serviceType,
          apiId: apiSelecionada,
        })
      }
    } catch (error: any) {
      console.error('Erro ao criar autorização:', error)
      setErro(error.message || 'Erro ao criar autorização')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return null

    const statusUpper = status.toUpperCase()
    
    if (statusUpper === 'AUTHORIZED' || statusUpper === 'AUTORIZADO') {
      return (
        <Badge className="bg-green-600 text-white">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Autorizado
        </Badge>
      )
    }
    
    if (statusUpper === 'PENDING' || statusUpper === 'PENDENTE') {
      return (
        <Badge className="bg-yellow-600 text-white">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      )
    }
    
    if (statusUpper === 'NOT_AUTHORIZED' || statusUpper === 'NAO_AUTORIZADO') {
      return (
        <Badge variant="destructive">
          <ShieldX className="h-3 w-3 mr-1" />
          Não Autorizado
        </Badge>
      )
    }

    return (
      <Badge variant="outline">
        <Shield className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            Autorização CLT
          </CardTitle>
          <CardDescription className="mt-2">
            Crie ou verifique a autorização do registro para consultar margem e simular propostas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seleção de API */}
            <div>
              <Label htmlFor="banco">Banco para Autorização *</Label>
              <select
                id="banco"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={apiSelecionada}
                onChange={(e) => setApiSelecionada(e.target.value)}
                required
                disabled={loading || verificando}
              >
                <option value="">Selecione um banco...</option>
                {apisDisponiveis.map((api) => {
                  const tipoNome = api.type === 'nossafintech' ? 'Nossa Fintech' :
                                   api.type === 'hubcredito' ? 'HubCredito' :
                                   api.type === 'presencabank' ? 'Banco Presença' :
                                   api.type === 'v8digital' ? 'V8 Digital' : 'Custom'
                  return (
                    <option key={api.id} value={api.id} disabled={api.type !== 'nossafintech'}>
                      {api.name} ({tipoNome}){api.type !== 'nossafintech' ? ' - Não suporta autorização' : ''}
                    </option>
                  )
                })}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {apisDisponiveis.find(a => a.id === apiSelecionada)?.type !== 'nossafintech' && apiSelecionada ? (
                  <span className="text-yellow-600">⚠️ Apenas Nossa Fintech suporta autorização CLT. Selecione uma API Nossa Fintech.</span>
                ) : (
                  'Selecione o banco que será usado para realizar a autorização (apenas Nossa Fintech)'
                )}
              </p>
              {apisDisponiveis.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Nenhuma API Nossa Fintech configurada. Configure as APIs na seção de Configuração de APIs.
                </p>
              )}
            </div>

            {apiSelecionada && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CPF */}
                <div>
                  <Label htmlFor="cpf">CPF do registro *</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      if (valor.length <= 11) {
                        setFormData({ ...formData, cpf: valor })
                      }
                    }}
                    required
                    placeholder="12345678910"
                    maxLength={11}
                  />
                </div>

                {/* Telefone */}
                <div>
                  <Label htmlFor="telefone">Telefone/Celular *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, telefone: valor })
                    }}
                    required
                    placeholder="73999999999"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O registro receberá um SMS neste número para confirmar a autorização
                  </p>
                </div>

                {/* Nome Completo (Opcional) */}
                <div>
                  <Label htmlFor="nomeCompleto">Nome Completo (Opcional)</Label>
                  <Input
                    id="nomeCompleto"
                    value={formData.nomeCompleto}
                    onChange={(e) => setFormData({ ...formData, nomeCompleto: e.target.value })}
                    placeholder="João da Silva"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se não informado, será usado "registro" como padrão
                  </p>
                </div>

              </div>
            )}

            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={loading || verificando || !apiSelecionada} 
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200" 
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando Autorização...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Criar Autorização
                  </>
                )}
              </Button>

              <Button 
                type="button"
                onClick={verificarStatus}
                disabled={loading || verificando || !formData.cpf || formData.cpf.length !== 11 || !apiSelecionada}
                variant="outline"
                className="flex-1"
              >
                {verificando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verificar Status
                  </>
                )}
              </Button>
            </div>

            {/* Botão para marcar como já autorizado */}
            {statusAutorizacao === 'PENDING' || statusAutorizacao === 'PENDENTE' ? (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">⚠️ Status retornado como PENDING pela API</p>
                      <p className="text-sm mt-1">
                        Se o registro <strong>já está autorizado no sistema web</strong>, você pode marcar como autorizado e continuar.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-yellow-300">
                      <Button
                        type="button"
                        onClick={() => {
                          setJaAutorizado(true)
                          setStatusAutorizacao('AUTHORIZED')
                          
                          // Obtém o promot_id da configuração da API
                          let promotIdParaSalvar: string | number | undefined = undefined
                          try {
                            const manager = getApiManager()
                            const config = manager.getConfig(apiSelecionada)
                            if (config && (config as any).promotId !== undefined) {
                              promotIdParaSalvar = (config as any).promotId
                              console.log('[CLTAutorizar] Promot ID obtido da config:', promotIdParaSalvar)
                            }
                          } catch (e) {
                            console.error('[CLTAutorizar] Erro ao obter promot_id:', e)
                          }
                          
                          // Salva no localStorage que foi marcado como autorizado manualmente
                          const dadosParaSalvar = {
                            cpf: formData.cpf,
                            nomeCompleto: formData.nomeCompleto,
                            telefone: formData.telefone,
                            serviceType: formData.serviceType,
                            status: 'AUTHORIZED',
                            marcadoManual: true,
                            timestamp: new Date().toISOString(),
                            apiId: apiSelecionada,
                            promotId: promotIdParaSalvar // Salva o promot_id usado
                          }
                          localStorage.setItem('clt_autorizacao_dados', JSON.stringify(dadosParaSalvar))
                          console.log('[CLTAutorizar] Autorização marcada como autorizada manualmente:', dadosParaSalvar)
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marcar como Autorizado
                      </Button>
                      <p className="text-xs text-yellow-700 flex-1">
                        Use este botão se o registro já está autorizado no sistema web
                      </p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
          </form>

          {erro && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {statusAutorizacao && (
            <Alert className={`mt-4 ${
              statusAutorizacao === 'AUTHORIZED' || statusAutorizacao === 'AUTORIZADO' 
                ? 'border-green-200 bg-green-50' 
                : statusAutorizacao === 'PENDING' || statusAutorizacao === 'PENDENTE'
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
            }`}>
              {statusAutorizacao === 'AUTHORIZED' || statusAutorizacao === 'AUTORIZADO' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : statusAutorizacao === 'PENDING' || statusAutorizacao === 'PENDENTE' ? (
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={
                statusAutorizacao === 'AUTHORIZED' || statusAutorizacao === 'AUTORIZADO' 
                  ? 'text-green-900' 
                  : statusAutorizacao === 'PENDING' || statusAutorizacao === 'PENDENTE'
                  ? 'text-yellow-900'
                  : 'text-red-900'
              }>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">
                      Status da Autorização
                    </p>
                    <p className="text-sm mt-1">
                      {statusAutorizacao === 'AUTHORIZED' || statusAutorizacao === 'AUTORIZADO' 
                        ? '✅ registro autorizado! Você pode continuar para consultar margem e simular propostas.'
                        : statusAutorizacao === 'PENDING' || statusAutorizacao === 'PENDENTE'
                        ? '⏳ Aguardando confirmação do registro via SMS. Se já está autorizado no sistema web, clique em "Marcar como Autorizado" acima.'
                        : '❌ registro não está autorizado'}
                    </p>
                  </div>
                  {getStatusBadge(statusAutorizacao)}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {resultado && (
            <Card className="mt-4 border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Resultado da Autorização</CardTitle>
              </CardHeader>
              <CardContent>
                {resultado.authorization_link && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Link de Autorização:</p>
                    <a
                      href={resultado.authorization_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-2 break-all"
                    >
                      {resultado.authorization_link}
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    </a>
                    <p className="text-xs text-gray-600 mt-2">
                      O registro precisa acessar este link ou confirmar via SMS para completar a autorização
                    </p>
                  </div>
                )}

                {resultado.status && (
                  <div className="mb-2">
                    <p className="text-sm">
                      <strong>Status:</strong> {getStatusBadge(resultado.status)}
                    </p>
                  </div>
                )}

              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
