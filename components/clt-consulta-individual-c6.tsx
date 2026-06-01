"use client"

/**
 * Consulta individual C6 Bank - Consignado Trabalhador (CLT)
 * Manual V29.1 - Ordem da API CLT:
 * 1) Geração de link para autorização (POST /marketplace/authorization/generate-liveness)
 * 2) Consulta de status da autorização (POST /marketplace/authorization/status)
 * 3) Geração de oferta (POST /marketplace/worker-payroll-loan-offers)
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Search, Shield, DollarSign, entidade, FileText, ExternalLink, RefreshCw } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

export function CLTConsultaIndividualC6() {
  const [loading, setLoading] = useState(false)
  const [loadingAuth, setLoadingAuth] = useState(false)
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [cpfCliente, setCpfCliente] = useState('')
  const [cpfRepresentanteLegal, setCpfRepresentanteLegal] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [codigoArea, setCodigoArea] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [linkAutorizacao, setLinkAutorizacao] = useState<string | null>(null)
  const [statusAutorizacao, setStatusAutorizacao] = useState<string | null>(null)
  const [precisaAutorizacao, setPrecisaAutorizacao] = useState(false)
  const [aguardandoAutorizacao, setAguardandoAutorizacao] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active && c.type === 'c6bank')
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Carrega dados do localStorage (compartilhado do sistema WhatsApp)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const dadosCompartilhados = localStorage.getItem('whatsapp_cliente_dados')
        if (dadosCompartilhados) {
          const dados = JSON.parse(dadosCompartilhados)
          if (dados.cpf) {
            setCpfCliente(dados.cpf.replace(/\D/g, ''))
          }
          if (dados.nome) {
            setNomeCliente(dados.nome)
          }
          if (dados.data_nascimento) {
            setDataNascimento(dados.data_nascimento)
          }
          // Remove dados do localStorage após usar
          localStorage.removeItem('whatsapp_cliente_dados')
        }
      } catch (error) {
        console.error('Erro ao carregar dados compartilhados:', error)
      }
    }
  }, [])

  // Limpa polling quando componente desmonta
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const formatarCPF = (value: string) => {
    const cpfLimpo = value.replace(/\D/g, '')
    if (cpfLimpo.length <= 11) {
      return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return value
  }

  const formatarDataNascimento = (value: string) => {
    const dataLimpa = value.replace(/\D/g, '')
    if (dataLimpa.length <= 8) {
      return dataLimpa.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3')
    }
    return value
  }

  const formatarTelefone = (value: string) => {
    const telLimpo = value.replace(/\D/g, '')
    if (telLimpo.length <= 9) {
      return telLimpo.replace(/(\d{5})(\d{4})/, '$1-$2')
    }
    return value
  }

  const handleGerarLinkAutorizacao = async () => {
    if (!apiSelecionada) {
      setErro('Selecione uma API C6 Bank')
      return
    }

    const cpfClienteLimpo = cpfCliente.replace(/\D/g, '')
    if (cpfClienteLimpo.length !== 11) {
      setErro('CPF do registro deve ter 11 dígitos')
      return
    }

    if (!nomeCliente.trim()) {
      setErro('Nome do registro é obrigatório para gerar link de autorização')
      return
    }

    const dataNascimentoLimpa = dataNascimento.replace(/\D/g, '')
    if (dataNascimentoLimpa.length !== 8) {
      setErro('Data de nascimento deve estar no formato DD/MM/AAAA')
      return
    }

    // Converte DD/MM/AAAA para YYYY-MM-DD
    const [dia, mes, ano] = dataNascimento.split('/')
    const dataFormatada = `${ano}-${mes}-${dia}`

    setLoadingAuth(true)
    setErro(null)
    setLinkAutorizacao(null)

    try {
      const body: any = {
        apiId: apiSelecionada,
        nome: nomeCliente.trim(),
        cpf: cpfClienteLimpo,
        data_nascimento: dataFormatada
      }

      if (telefoneCliente && codigoArea) {
        body.telefone = {
          numero: telefoneCliente.replace(/\D/g, ''),
          codigo_area: codigoArea.replace(/\D/g, '')
        }
      }

      const response = await fetch('/api/produto/c6bank/autorizacao/gerar-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!data.success) {
        setErro(data.error || 'Erro ao gerar link de autorização')
        return
      }

      const link = data.data.link
      setLinkAutorizacao(link)
      setPrecisaAutorizacao(true)

      // Tenta aceitar o termo automaticamente
      console.log('[CLTConsultaIndividualC6] Tentando aceitar termo automaticamente...')
      try {
        const aceitarResponse = await fetch('/api/produto/c6bank/autorizacao/aceitar-automatico', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ link }),
        })

        const aceitarData = await aceitarResponse.json()
        if (aceitarData.success) {
          console.log('[CLTConsultaIndividualC6] Termo aceito automaticamente com sucesso!')
          // Aguarda um pouco e verifica o status
          await new Promise(resolve => setTimeout(resolve, 3000))
          await handleConsultarStatusAutorizacao()
        } else {
          console.warn('[CLTConsultaIndividualC6] Não foi possível aceitar automaticamente:', aceitarData.error)
        }
      } catch (aceitarError: any) {
        console.error('[CLTConsultaIndividualC6] Erro ao tentar aceitar automaticamente:', aceitarError)
        // Continua mesmo se houver erro na automação
      }
    } catch (error: any) {
      console.error('[CLTConsultaIndividualC6] Erro ao gerar link de autorização:', error)
      setErro(error.message || 'Erro desconhecido ao gerar link de autorização.')
    } finally {
      setLoadingAuth(false)
    }
  }

  const handleConsultarStatusAutorizacao = async () => {
    if (!apiSelecionada) {
      setErro('Selecione uma API C6 Bank')
      return
    }

    const cpfClienteLimpo = cpfCliente.replace(/\D/g, '')
    if (cpfClienteLimpo.length !== 11) {
      setErro('CPF do registro deve ter 11 dígitos')
      return
    }

    setLoadingAuth(true)
    setErro(null)

    try {
      const response = await fetch('/api/produto/c6bank/autorizacao/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId: apiSelecionada,
          cpf: cpfClienteLimpo
        }),
      })

      const data = await response.json()

      if (!data.success) {
        setErro(data.error || 'Erro ao consultar status de autorização')
        return
      }

      setStatusAutorizacao(data.data.status)
      
      if (data.data.status === 'AUTORIZADO') {
        setPrecisaAutorizacao(false)
      } else {
        setPrecisaAutorizacao(true)
      }
    } catch (error: any) {
      console.error('[CLTConsultaIndividualC6] Erro ao consultar status de autorização:', error)
      setErro(error.message || 'Erro desconhecido ao consultar status de autorização.')
    } finally {
      setLoadingAuth(false)
    }
  }

  // Função auxiliar para verificar status de autorização
  const verificarStatusAutorizacao = async (): Promise<string | null> => {
    if (!apiSelecionada) return null

    const cpfClienteLimpo = cpfCliente.replace(/\D/g, '')
    if (cpfClienteLimpo.length !== 11) return null

    try {
      const response = await fetch('/api/produto/c6bank/autorizacao/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId: apiSelecionada,
          cpf: cpfClienteLimpo
        }),
      })

      const data = await response.json()
      if (data.success && data.data) {
        return data.data.status
      }
    } catch (error) {
      console.error('[CLTConsultaIndividualC6] Erro ao verificar status:', error)
    }
    return null
  }

  // Função auxiliar para gerar link de autorização automaticamente
  const gerarLinkAutorizacaoAutomatico = async (): Promise<string | null> => {
    if (!apiSelecionada) return null

    const cpfClienteLimpo = cpfCliente.replace(/\D/g, '')
    if (cpfClienteLimpo.length !== 11) return null

    if (!nomeCliente.trim()) {
      setErro('Nome do registro é obrigatório para gerar link de autorização')
      return null
    }

    const dataNascimentoLimpa = dataNascimento.replace(/\D/g, '')
    if (dataNascimentoLimpa.length !== 8) {
      setErro('Data de nascimento é obrigatória para gerar link de autorização')
      return null
    }

    // Converte DD/MM/AAAA para YYYY-MM-DD
    const [dia, mes, ano] = dataNascimento.split('/')
    const dataFormatada = `${ano}-${mes}-${dia}`

    try {
      const body: any = {
        apiId: apiSelecionada,
        nome: nomeCliente.trim(),
        cpf: cpfClienteLimpo,
        data_nascimento: dataFormatada
      }

      if (telefoneCliente && codigoArea) {
        body.telefone = {
          numero: telefoneCliente.replace(/\D/g, ''),
          codigo_area: codigoArea.replace(/\D/g, '')
        }
      }

      const response = await fetch('/api/produto/c6bank/autorizacao/gerar-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (data.success && data.data && data.data.link) {
        const link = data.data.link
        
        // Tenta aceitar o termo automaticamente
        console.log('[CLTConsultaIndividualC6] Tentando aceitar termo automaticamente...')
        try {
          const aceitarResponse = await fetch('/api/produto/c6bank/autorizacao/aceitar-automatico', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ link }),
          })

          const aceitarData = await aceitarResponse.json()
          if (aceitarData.success) {
            console.log('[CLTConsultaIndividualC6] Termo aceito automaticamente com sucesso!')
            // Aguarda um pouco antes de verificar o status
            await new Promise(resolve => setTimeout(resolve, 3000))
          } else {
            console.warn('[CLTConsultaIndividualC6] Não foi possível aceitar automaticamente:', aceitarData.error)
            // Continua mesmo se não conseguir aceitar automaticamente
          }
        } catch (aceitarError: any) {
          console.error('[CLTConsultaIndividualC6] Erro ao tentar aceitar automaticamente:', aceitarError)
          // Continua mesmo se houver erro na automação
        }
        
        return link
      } else {
        setErro(data.error || 'Erro ao gerar link de autorização')
      }
    } catch (error: any) {
      console.error('[CLTConsultaIndividualC6] Erro ao gerar link de autorização:', error)
      setErro(error.message || 'Erro ao gerar link de autorização')
    }
    return null
  }

  // Função para iniciar polling de status de autorização
  const iniciarPollingAutorizacao = () => {
    // Limpa polling anterior se existir
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    const interval = setInterval(async () => {
      const status = await verificarStatusAutorizacao()
      if (status) {
        setStatusAutorizacao(status)
        
        if (status === 'AUTORIZADO') {
          // Autorização concluída, para o polling e tenta gerar oferta
          clearInterval(interval)
          setPollingInterval(null)
          setAguardandoAutorizacao(false)
          setPrecisaAutorizacao(false)
          
          // Tenta gerar a oferta automaticamente
          await gerarOfertaAposAutorizacao()
        } else if (status === 'NAO_AUTORIZADO') {
          // registro negou, para o polling
          clearInterval(interval)
          setPollingInterval(null)
          setAguardandoAutorizacao(false)
          setErro('registro não autorizou a consulta de dados')
        }
      }
    }, 5000) // Verifica a cada 5 segundos

    setPollingInterval(interval)
  }

  // Função para gerar oferta após autorização
  const gerarOfertaAposAutorizacao = async () => {
    const cpfClienteLimpo = cpfCliente.replace(/\D/g, '')
    
    setLoading(true)
    setErro(null)

    try {
      const response = await fetch('/api/produto/c6bank/gerar-oferta-clt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId: apiSelecionada,
          cpf_cliente: cpfClienteLimpo,
          cpf_representante_legal: cpfRepresentanteLegal ? cpfRepresentanteLegal.replace(/\D/g, '') : undefined
        }),
      })

      const data = await response.json()

      if (!data.success) {
        // Verifica se ainda precisa de autorização
        const erroMsg = (data.error || '').toLowerCase()
        const precisaAuth = data.requiresAuthorization || 
                           response.status === 403 || 
                           erroMsg.includes('data query not authorized') ||
                           erroMsg.includes('dataprev') ||
                           erroMsg.includes('not authorized by dataprev')
        
        if (precisaAuth) {
          setPrecisaAutorizacao(true)
          setStatusAutorizacao(data.authorizationStatus || 'NAO_AUTORIZADO')
          setErro('Ainda é necessário autorizar a consulta de dados. Verifique se o registro autorizou corretamente.')
          return
        }
        
        setErro(data.error || 'Erro ao gerar oferta Consignado Trabalhador')
        return
      }

      setResultado(data.data)
      setPrecisaAutorizacao(false)
    } catch (error: any) {
      console.error('[CLTConsultaIndividualC6] Erro ao gerar oferta:', error)
      setErro(error.message || 'Erro desconhecido ao gerar oferta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Consulta Individual C6 Bank - Consignado Trabalhador (CLT)
          </CardTitle>
          <CardDescription>
            Siga a ordem da API CLT: 1) Gerar link de autorização → 2) Consultar status → 3) Gerar oferta (quando autorizado).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione a API C6 Bank</Label>
            <select
              value={apiSelecionada}
              onChange={(e) => setApiSelecionada(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={loading || loadingAuth}
            >
              <option value="">Selecione uma API</option>
              {apisDisponiveis.map(api => (
                <option key={api.id} value={api.id}>{api.name}</option>
              ))}
            </select>
          </div>

          {/* Dados do registro (usados no Passo 1 e no Passo 3) */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <entidade className="h-4 w-4" />
              Dados do registro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpfCliente">CPF do registro *</Label>
                <Input
                  id="cpfCliente"
                  value={cpfCliente}
                  onChange={(e) => setCpfCliente(formatarCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  disabled={loading || loadingAuth}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomeCliente">Nome do registro *</Label>
                <Input
                  id="nomeCliente"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  placeholder="Nome completo"
                  disabled={loading || loadingAuth}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de nascimento * (DD/MM/AAAA)</Label>
                <Input
                  id="dataNascimento"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(formatarDataNascimento(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  disabled={loading || loadingAuth}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpfRepresentanteLegal">CPF do representante legal (opcional)</Label>
                <Input
                  id="cpfRepresentanteLegal"
                  value={cpfRepresentanteLegal}
                  onChange={(e) => setCpfRepresentanteLegal(formatarCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  disabled={loading || loadingAuth}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="codigoArea">DDD (opcional)</Label>
                <Input
                  id="codigoArea"
                  value={codigoArea}
                  onChange={(e) => setCodigoArea(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="00"
                  maxLength={2}
                  disabled={loading || loadingAuth}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="telefoneCliente">Telefone (opcional)</Label>
                <Input
                  id="telefoneCliente"
                  value={telefoneCliente}
                  onChange={(e) => setTelefoneCliente(formatarTelefone(e.target.value))}
                  placeholder="00000-0000"
                  maxLength={10}
                  disabled={loading || loadingAuth}
                />
              </div>
            </div>
          </div>

          {/* Passo 1 - Geração de link para autorização (generate-liveness) */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm">1</span>
              Passo 1 – Geração de link para autorização
            </h3>
            <p className="text-sm text-gray-600">
              API: POST /marketplace/authorization/generate-liveness (nome, cpf, data_nascimento, telefone opcional)
            </p>
            <Button
              onClick={handleGerarLinkAutorizacao}
              disabled={loading || loadingAuth || !apiSelecionada || !cpfCliente || !nomeCliente || !dataNascimento}
              variant="outline"
            >
              {loadingAuth ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando link...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  1. Gerar link de autorização
                </>
              )}
            </Button>
            {linkAutorizacao && (
              <Alert>
                <AlertDescription>
                  <p className="font-semibold mb-1">Link gerado:</p>
                  <a
                    href={linkAutorizacao}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all flex items-center gap-1"
                  >
                    {linkAutorizacao}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-sm text-gray-600 mt-2">
                    Envie ao registro. Após autorizar, use o Passo 2 para consultar o status.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Passo 2 - Consulta de status da autorização (status) */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm">2</span>
              Passo 2 – Consulta de status da autorização
            </h3>
            <p className="text-sm text-gray-600">
              API: POST /marketplace/authorization/status (cpf)
            </p>
            <Button
              onClick={handleConsultarStatusAutorizacao}
              disabled={loading || loadingAuth || !apiSelecionada || !cpfCliente}
              variant="outline"
            >
              {loadingAuth ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  2. Consultar status da autorização
                </>
              )}
            </Button>
            {statusAutorizacao && (
              <Alert variant={statusAutorizacao === 'AUTORIZADO' ? 'default' : 'destructive'}>
                <AlertDescription>
                  <span className="font-semibold">Status: </span>
                  <Badge variant={statusAutorizacao === 'AUTORIZADO' ? 'default' : 'destructive'}>
                    {statusAutorizacao === 'AUTORIZADO' ? 'AUTORIZADO' :
                     statusAutorizacao === 'NAO_AUTORIZADO' ? 'NÃO AUTORIZADO' :
                     statusAutorizacao === 'AGUARDANDO_AUTORIZACAO' ? 'AGUARDANDO AUTORIZAÇÃO' :
                     statusAutorizacao}
                  </Badge>
                  {statusAutorizacao === 'AUTORIZADO' && (
                    <p className="text-sm text-gray-600 mt-2">Pode seguir para o Passo 3.</p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Passo 3 - Geração de oferta (worker-payroll-loan-offers) */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm">3</span>
              Passo 3 – Geração de oferta
            </h3>
            <p className="text-sm text-gray-600">
              API: POST /marketplace/worker-payroll-loan-offers (cpf_cliente, cpf_representante_legal opcional). Só disponível com status AUTORIZADO.
            </p>
            <Button
              onClick={() => gerarOfertaAposAutorizacao()}
              disabled={loading || loadingAuth || !apiSelecionada || !cpfCliente || statusAutorizacao !== 'AUTORIZADO'}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando oferta...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  3. Gerar oferta CLT
                </>
              )}
            </Button>
            {statusAutorizacao && statusAutorizacao !== 'AUTORIZADO' && (
              <p className="text-sm text-amber-700">
                Conclua o Passo 2 e obtenha status AUTORIZADO para habilitar a geração de oferta.
              </p>
            )}
          </div>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Oferta Gerada com Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tenta exibir campos específicos se existirem */}
            {(resultado.trabalhador || resultado.valor_cliente || resultado.quantidade_parcelas) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(resultado.trabalhador?.valor_cliente || resultado.valor_cliente) && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Valor do registro</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      R$ {parseFloat(String(resultado.trabalhador?.valor_cliente || resultado.valor_cliente || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {(resultado.trabalhador?.quantidade_parcelas || resultado.quantidade_parcelas) && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900">Quantidade de Parcelas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {resultado.trabalhador?.quantidade_parcelas || resultado.quantidade_parcelas || 'N/A'}
                    </p>
                  </div>
                )}

                {(resultado.trabalhador?.valor_parcela || resultado.valor_parcela) && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">Valor da Parcela</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      R$ {parseFloat(String(resultado.trabalhador?.valor_parcela || resultado.valor_parcela || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {(resultado.trabalhador?.seguro?.valor_seguro || resultado.seguro?.valor_seguro || resultado.valor_seguro) && (
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold text-orange-900">Valor do Seguro</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-700">
                      R$ {parseFloat(String(resultado.trabalhador?.seguro?.valor_seguro || resultado.seguro?.valor_seguro || resultado.valor_seguro || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Dados Completos da Oferta</h4>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border max-h-96">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
