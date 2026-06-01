"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calculator, CheckCircle2, XCircle, DollarSign, Calendar, AlertCircle, Info, Send, ArrowRight, Search, ExternalLink } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"
import { getCredSpotCredentialsForRequest } from "@/lib/credspot-browser-credentials"
import { birthToIsoDate, normalizePhoneDigits, normalizeCpfDigits } from "@/lib/credspot-entidade-normalize"

interface CLTSimularCredSpotProps {
  onSuccess?: (dados: any) => void
  onError?: (erro: string) => void
  apiId?: string
  dadosAnteriores?: any
}

export function CLTSimularCredSpot({ onSuccess, onError, apiId: apiIdProp, dadosAnteriores }: CLTSimularCredSpotProps = {}) {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [apiSelecionada, setApiSelecionada] = useState<string>(apiIdProp || '')
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  
  // Estados para o fluxo CredSpot
  const [relationshipInquiryUuid, setRelationshipInquiryUuid] = useState<string>('')
  const [userUuid, setUserUuid] = useState<string>('')
  const [linkConsentimento, setLinkConsentimento] = useState<string>('')
  const [statusConsentimento, setStatusConsentimento] = useState<string>('')
  const [contratosElegiveis, setContratosElegiveis] = useState<any[]>([])
  const [contractUuidSelecionado, setContractUuidSelecionado] = useState<string>('')
  const [margemDisponivel, setMargemDisponivel] = useState<number | null>(null)
  const [balanceInquiryUuid, setBalanceInquiryUuid] = useState<string>('')
  const [ofertasDisponiveis, setOfertasDisponiveis] = useState<any[]>([])
  const [simulationMeta, setSimulationMeta] = useState<any>(null)
  const [verificandoStatus, setVerificandoStatus] = useState(false)
  const [disbursementValue, setDisbursementValue] = useState<string>('')
  const [installmentsOffer, setInstallmentsOffer] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [bankAccountUuid, setBankAccountUuid] = useState<string>('')
  const [selectedOptionUuid, setSelectedOptionUuid] = useState<string>('')
  const [skipSmsCredspot, setSkipSmsCredspot] = useState(false)

  const credSpotAuthPayload = (): { credspotCredentials: NonNullable<ReturnType<typeof getCredSpotCredentialsForRequest>> } | Record<string, never> => {
    const cred = getCredSpotCredentialsForRequest(apiSelecionada)
    return cred ? { credspotCredentials: cred } : {}
  }

  const [formData, setFormData] = useState({
    cpf: dadosAnteriores?.cpf || dadosAnteriores?.document || '',
    nome: dadosAnteriores?.nome || dadosAnteriores?.name || '',
    email: dadosAnteriores?.email || dadosAnteriores?.mail || '',
    telefone: dadosAnteriores?.telefone || dadosAnteriores?.phone || '',
    dataNascimento: dadosAnteriores?.dataNascimento || dadosAnteriores?.birth || '',
    genero: dadosAnteriores?.genero || dadosAnteriores?.gender || 'M',
  })

  // Função helper para normalizar CPF (delega à mesma regra do servidor CredSpot)
  const normalizarCPF = (cpf: string): string => normalizeCpfDigits(cpf)

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

  // Preenche dados se vierem de etapa anterior
  useEffect(() => {
    if (dadosAnteriores?.cpf || dadosAnteriores?.document) {
      setFormData(prev => ({
        ...prev,
        cpf: dadosAnteriores.cpf || dadosAnteriores.document || prev.cpf,
        nome: dadosAnteriores.nome || dadosAnteriores.name || prev.nome,
        email: dadosAnteriores.email || dadosAnteriores.mail || prev.email,
        telefone: dadosAnteriores.telefone || dadosAnteriores.phone || prev.telefone,
        dataNascimento: dadosAnteriores.dataNascimento || dadosAnteriores.birth || prev.dataNascimento,
        genero: dadosAnteriores.genero || dadosAnteriores.gender || prev.genero,
      }))
    }
    if (apiIdProp) {
      setApiSelecionada(apiIdProp)
    }
  }, [dadosAnteriores, apiIdProp])

  // Função para criar usuário e gerar link de consentimento
  const gerarLinkConsentimento = async () => {
    const cpfNormalizado = normalizarCPF(formData.cpf)
    
    if (!cpfNormalizado || cpfNormalizado.length !== 11) {
      setErro('Por favor, informe um CPF válido (11 dígitos)')
      return
    }

    if (!formData.nome || !formData.email || !formData.telefone || !formData.dataNascimento) {
      setErro('Por favor, preencha todos os campos obrigatórios: Nome, Email, Telefone e Data de Nascimento')
      return
    }

    const birthIso = birthToIsoDate(formData.dataNascimento)
    if (!birthIso) {
      setErro(
        'Data de nascimento inválida. Selecione no calendário (formato interno YYYY-MM-DD) ou digite DD/MM/AAAA (ex.: 25/02/1985).'
      )
      return
    }

    const phoneDigits = normalizePhoneDigits(formData.telefone)
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setErro('Telefone inválido: informe DDD + número (10 ou 11 dígitos).')
      return
    }

    if (!apiSelecionada) {
      setErro('Por favor, selecione a API CredSpot')
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      console.log('[CredSpot CLT] Gerando link de consentimento para CPF:', cpfNormalizado)
      
      const response = await fetch('/api/produto/credspot/clt/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId: apiSelecionada,
          document: cpfNormalizado,
          name: formData.nome,
          mail: formData.email,
          phone: phoneDigits,
          birth: birthIso,
          gender: formData.genero === 'F' ? 'F' : 'M',
          skipSms: skipSmsCredspot,
          ...credSpotAuthPayload(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const base = data.error || 'Erro ao gerar link de consentimento'
        const det = data.details
        let suffix = ''
        if (det && typeof det === 'object') {
          const m = (det as { message?: string }).message
          const errs = (det as { errors?: unknown }).errors
          if (m) suffix = ` — ${m}`
          else if (Array.isArray(errs) && errs.length) suffix = ` — ${JSON.stringify(errs).slice(0, 500)}`
          else if (typeof det === 'object') suffix = ` — ${JSON.stringify(det).slice(0, 400)}`
        }
        throw new Error(base + suffix)
      }

      const consentData = data.data
      
      setRelationshipInquiryUuid(consentData.relationshipInquiryUuid || '')
      setUserUuid(consentData.userUuid || '')
      setLinkConsentimento(consentData.consentLink || '')
      setBalanceInquiryUuid('')
      setSimulationMeta(null)
      setOfertasDisponiveis([])
      setMargemDisponivel(null)

      if (consentData.accepted && consentData.contracts?.length) {
        setStatusConsentimento('success')
        setContratosElegiveis(consentData.contracts)
        if (consentData.contracts[0]?.uuid) {
          setContractUuidSelecionado(consentData.contracts[0].uuid)
        }
      } else {
        setStatusConsentimento('WAITING_CONSENT')
      }
      
      console.log('[CredSpot CLT] ✅ Link de consentimento gerado:', consentData)
      
      if (onSuccess) {
        onSuccess(consentData)
      }
    } catch (error: any) {
      console.error('[CredSpot CLT] Erro ao gerar link de consentimento:', error)
      setErro(error.message || 'Erro ao gerar link de consentimento')
      if (onError) {
        onError(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Função para verificar status do consentimento
  const verificarStatusConsentimento = async () => {
    if (!relationshipInquiryUuid || !apiSelecionada) {
      setErro('Relationship Inquiry UUID não encontrado')
      return
    }

    setVerificandoStatus(true)
    setErro(null)

    try {
      console.log('[CredSpot CLT] Verificando status do consentimento:', relationshipInquiryUuid)
      
      const response = await fetch('/api/produto/credspot/clt/consent-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relationshipInquiryUuid,
          apiId: apiSelecionada,
          ...credSpotAuthPayload(),
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao verificar status do consentimento')
      }

      const statusData = data.data
      
      setStatusConsentimento(statusData.status || 'pending')
      if (statusData.userUuid || statusData.user_uuid) {
        setUserUuid(statusData.userUuid || statusData.user_uuid)
      }

      if (statusData.contracts && Array.isArray(statusData.contracts) && statusData.contracts.length > 0) {
        setContratosElegiveis(statusData.contracts)
        if (!contractUuidSelecionado && statusData.contracts[0].uuid) {
          setContractUuidSelecionado(statusData.contracts[0].uuid)
        }
        console.log('[CredSpot CLT] ✅ Contratos elegíveis encontrados:', statusData.contracts)
      }
      
      console.log('[CredSpot CLT] ✅ Status atualizado:', statusData)
    } catch (error: any) {
      console.error('[CredSpot CLT] Erro ao verificar status:', error)
      setErro(error.message || 'Erro ao verificar status do consentimento')
    } finally {
      setVerificandoStatus(false)
    }
  }

  // Função para consultar margem
  const consultarMargem = async () => {
    if (!contractUuidSelecionado || !apiSelecionada || !userUuid) {
      setErro('Selecione um contrato elegível e confirme o UUID do usuário (retornado no consentimento)')
      return
    }

    setLoading(true)
    setErro(null)

    try {
      console.log('[CredSpot CLT] Consultando margem (userUuid + eligibilityUuid):', userUuid, contractUuidSelecionado)

      const response = await fetch('/api/produto/credspot/clt/margin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId: apiSelecionada,
          userUuid,
          eligibilityUuid: contractUuidSelecionado,
          ...credSpotAuthPayload(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao consultar margem')
      }

      const marginData = data.data

      const bq = marginData.balanceInquiryUuid || marginData.data?.balanceInquiryUuid
      if (bq) setBalanceInquiryUuid(bq)

      const m =
        marginData.margin ??
        marginData.availableMargin ??
        marginData.cached_data?.available_margin_value ??
        null
      setMargemDisponivel(m != null ? Number(m) : null)

      console.log('[CredSpot CLT] ✅ Margem consultada:', marginData)
    } catch (error: any) {
      console.error('[CredSpot CLT] Erro ao consultar margem:', error)
      setErro(error.message || 'Erro ao consultar margem')
    } finally {
      setLoading(false)
    }
  }

  // Função para simular ofertas
  const simularOfertas = async () => {
    if (!apiSelecionada || !userUuid || !balanceInquiryUuid) {
      setErro('É necessário userUuid e balanceInquiryUuid (obtidos após POST /clt/margin ou webhook margin.completed)')
      return
    }

    setLoading(true)
    setErro(null)

    try {
      const body: Record<string, unknown> = {
        apiId: apiSelecionada,
        userUuid,
        balanceInquiryUuid,
      }
      if (disbursementValue.trim()) body.disbursementValue = Number(disbursementValue.replace(',', '.'))
      if (installmentsOffer.trim()) body.installments = Number(installmentsOffer)
      if (selectedTable.trim()) body.selectedTable = selectedTable.trim()
      Object.assign(body, credSpotAuthPayload())

      console.log('[CredSpot CLT] Simulando ofertas (OpenAPI /clt/offer):', body)

      const response = await fetch('/api/produto/credspot/clt/offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao simular ofertas')
      }

      const offerData = data.data
      setSimulationMeta(offerData)
      setOfertasDisponiveis(offerData.offers || offerData.installments || [])
      const opt = offerData.simulationUuid || offerData.selectedOptionUuid || offerData.uuid
      if (opt) setSelectedOptionUuid(String(opt))

      console.log('[CredSpot CLT] ✅ Ofertas simuladas:', offerData)
    } catch (error: any) {
      console.error('[CredSpot CLT] Erro ao simular ofertas:', error)
      setErro(error.message || 'Erro ao simular ofertas')
    } finally {
      setLoading(false)
    }
  }

  const criarContrato = async () => {
    if (!apiSelecionada || !userUuid || !selectedOptionUuid || !bankAccountUuid.trim()) {
      setErro('Preencha userUuid (já obtido), selectedOptionUuid (simulação) e bankAccountUuid (POST /bank-accounts na CredSpot).')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const response = await fetch('/api/produto/credspot/clt/contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiId: apiSelecionada,
          userUuid,
          selectedOptionUuid,
          bankAccountUuid: bankAccountUuid.trim(),
          ...credSpotAuthPayload(),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao criar contrato')
      }
      alert('Contrato enviado para criação. Acompanhe webhooks contract.created / contract.failed.')
    } catch (error: any) {
      setErro(error.message || 'Erro ao criar contrato')
    } finally {
      setLoading(false)
    }
  }

  // Função para formatar status em português
  const formatarStatus = (status: string): { texto: string; cor: string } => {
    if (!status) {
      return { texto: 'Status não disponível', cor: 'gray' }
    }
    
    const statusUpper = status.toUpperCase()
    
    if (statusUpper === 'WAITING_CONSENT' || statusUpper === 'PENDING') {
      return { texto: '⏳ Aguardando Consentimento', cor: 'yellow' }
    }
    if (
      statusUpper === 'COMPLETED' ||
      statusUpper === 'CONSENTED' ||
      statusUpper === 'SUCCESS'
    ) {
      return { texto: '✅ Consentimento Concluído', cor: 'green' }
    }
    if (statusUpper === 'PROCESSING') {
      return { texto: '⏳ Processando (Dataprev)', cor: 'yellow' }
    }
    if (statusUpper === 'REJECTED' || statusUpper === 'FAILED' || statusUpper === 'ERROR') {
      return { texto: '❌ Consentimento Rejeitado', cor: 'red' }
    }
    if (statusUpper === 'EXPIRED') {
      return { texto: '⏱️ Consentimento expirado', cor: 'red' }
    }
    
    return { texto: status, cor: 'blue' }
  }

  // Função para formatar moeda
  const formatarMoeda = (valor: number | null): string => {
    if (valor === null || valor === undefined) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calculator className="h-5 w-5 text-green-600" />
            </div>
            Consulta CLT Individual - CredSpot
          </CardTitle>
          <CardDescription className="mt-2">
            Fluxo alinhado à{' '}
            <a
              href="https://api.credspot.net/api/v1/docs#description/introduction"
              className="text-green-700 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              CredSpot Partner API (OpenAPI)
            </a>
            : consentimento → margem (`eligibilityUuid`) → oferta (`balanceInquiryUuid`) → contrato. Webhooks são obrigatórios na integração oficial; use{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">POST /api/webhooks/credspot</code> como URL pública após registrar em{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">/webhooks/endpoints</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seleção de API */}
            {apisDisponiveis.length > 0 ? (
              <div>
                <Label htmlFor="api-credspot">API CredSpot *</Label>
                <select
                  id="api-credspot"
                  value={apiSelecionada}
                  onChange={(e) => setApiSelecionada(e.target.value)}
                  required
                  disabled={loading}
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

            {userUuid ? (
              <p className="text-xs text-gray-600">
                <span className="font-medium">entidade UUID:</span> {userUuid}
              </p>
            ) : null}

            {/* Campos do formulário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="00000000000"
                  value={formData.cpf}
                  onChange={(e) => {
                    let valor = e.target.value.replace(/\D/g, '')
                    if (valor.length <= 11) {
                      setFormData({ ...formData, cpf: valor })
                    }
                  }}
                  maxLength={14}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">Apenas números (11 dígitos). Com 10 dígitos: se começar com 0, acrescentamos um dígito ao fim; caso contrário, um zero à esquerda (ex.: 2231494540 → 02231494540).</p>
              </div>

              <div>
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="João da Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  type="text"
                  placeholder="11999887766"
                  value={formData.telefone}
                  onChange={(e) => {
                    let valor = e.target.value.replace(/\D/g, '')
                    if (valor.length <= 11) {
                      setFormData({ ...formData, telefone: valor })
                    }
                  }}
                  maxLength={11}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">DDD + número (11 dígitos)</p>
              </div>

              <div>
                <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">Formato: YYYY-MM-DD</p>
              </div>

              <div>
                <Label htmlFor="genero">Gênero</Label>
                <select
                  id="genero"
                  value={formData.genero}
                  onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 pt-2">
                <input
                  id="skipSmsCredspot"
                  type="checkbox"
                  checked={skipSmsCredspot}
                  onChange={(e) => setSkipSmsCredspot(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="skipSmsCredspot" className="font-normal cursor-pointer text-sm text-gray-700">
                  Não enviar SMS automático da CredSpot com o link (<code className="text-xs">skipSms</code>)
                </Label>
              </div>
            </div>
            <Button
              onClick={gerarLinkConsentimento}
              disabled={loading || !apiSelecionada || normalizarCPF(formData.cpf).length !== 11 || !formData.nome || !formData.email || !formData.telefone || !formData.dataNascimento}
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Gerar Link de Consentimento
                </>
              )}
            </Button>

            {/* Link de consentimento */}
            {linkConsentimento && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <div className="space-y-2">
                    <p className="font-semibold">Link de Consentimento Gerado</p>
                    <a
                      href={linkConsentimento}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline break-all"
                    >
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      <span className="break-all">{linkConsentimento}</span>
                    </a>
                    <p className="text-xs mt-2">
                      Envie este link ao registro para que ele possa autorizar a consulta. Após a autorização, clique em "Verificar Status" para atualizar.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Status do consentimento */}
            {statusConsentimento && (
              <Alert className={`border-2 ${
                formatarStatus(statusConsentimento).cor === 'green' ? 'bg-green-50 border-green-200' :
                formatarStatus(statusConsentimento).cor === 'red' ? 'bg-red-50 border-red-200' :
                formatarStatus(statusConsentimento).cor === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <AlertCircle className={`h-4 w-4 ${
                  formatarStatus(statusConsentimento).cor === 'green' ? 'text-green-600' :
                  formatarStatus(statusConsentimento).cor === 'red' ? 'text-red-600' :
                  formatarStatus(statusConsentimento).cor === 'yellow' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} />
                <AlertDescription className={`${
                  formatarStatus(statusConsentimento).cor === 'green' ? 'text-green-900' :
                  formatarStatus(statusConsentimento).cor === 'red' ? 'text-red-900' :
                  formatarStatus(statusConsentimento).cor === 'yellow' ? 'text-yellow-900' :
                  'text-blue-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Status do Consentimento</p>
                      <p className="font-bold text-base mt-1">{formatarStatus(statusConsentimento).texto}</p>
                    </div>
                    {relationshipInquiryUuid && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={verificarStatusConsentimento}
                        disabled={verificandoStatus}
                        variant="outline"
                        className="ml-4"
                      >
                        {verificandoStatus ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <Search className="h-3 w-3 mr-1" />
                            Verificar Status
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Contratos elegíveis */}
            {contratosElegiveis.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <div className="space-y-3">
                    <p className="font-semibold">Contratos Elegíveis Encontrados</p>
                    <div>
                      <Label htmlFor="contractUuid">Selecione um contrato:</Label>
                      <select
                        id="contractUuid"
                        value={contractUuidSelecionado}
                        onChange={(e) => setContractUuidSelecionado(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Selecione um contrato...</option>
                        {contratosElegiveis.map((contrato: any, index: number) => (
                          <option key={contrato.uuid || index} value={contrato.uuid}>
                            Contrato {index + 1} - UUID: {contrato.uuid?.substring(0, 8)}...
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={consultarMargem}
                      disabled={loading || !contractUuidSelecionado || !userUuid}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Consultando...
                        </>
                      ) : (
                        <>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Consultar Margem Disponível
                        </>
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Margem disponível */}
            {(margemDisponivel !== null || balanceInquiryUuid) && (
              <Alert className="bg-green-50 border-green-200">
                <DollarSign className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold">Margem / consulta</p>
                      {balanceInquiryUuid ? (
                        <p className="text-xs mt-1 break-all">
                          <span className="font-medium">balanceInquiryUuid:</span> {balanceInquiryUuid}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-800 mt-1">
                          Se não aparecer UUID, aguarde o webhook <code className="bg-white px-1 rounded">margin.completed</code> ou verifique o retorno bruto da API (processamento assíncrono).
                        </p>
                      )}
                      <p className="font-bold text-2xl mt-1 text-green-700">{formatarMoeda(margemDisponivel)}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor="disbursementValue">Valor liberação (opcional)</Label>
                        <Input
                          id="disbursementValue"
                          placeholder="ex: 5000"
                          value={disbursementValue}
                          onChange={(e) => setDisbursementValue(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="installmentsOffer">Parcelas (opcional)</Label>
                        <Input
                          id="installmentsOffer"
                          placeholder="ex: 36"
                          value={installmentsOffer}
                          onChange={(e) => setInstallmentsOffer(e.target.value.replace(/\D/g, ''))}
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="selectedTable">Tabela (opcional)</Label>
                        <Input
                          id="selectedTable"
                          placeholder="RET, SMART..."
                          value={selectedTable}
                          onChange={(e) => setSelectedTable(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={simularOfertas}
                      disabled={loading || !balanceInquiryUuid || !userUuid}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Simulando...
                        </>
                      ) : (
                        <>
                          <Calculator className="h-4 w-4 mr-2" />
                          Simular Ofertas de Empréstimo
                        </>
                      )}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Ofertas / resposta da simulação */}
            {(ofertasDisponiveis.length > 0 || simulationMeta) && (
              <Alert className="bg-purple-50 border-purple-200">
                <Calculator className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-900">
                  <div className="space-y-2">
                    <p className="font-semibold">Simulação / ofertas</p>
                    {ofertasDisponiveis.length > 0 ? (
                    <div className="space-y-2">
                      {ofertasDisponiveis.map((oferta: any, index: number) => (
                        <div key={index} className="p-3 bg-white rounded border border-purple-200">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">Valor:</span>{' '}
                              {formatarMoeda(oferta.amount || oferta.valor || 0)}
                            </div>
                            <div>
                              <span className="font-medium">Parcelas:</span>{' '}
                              {oferta.installments || oferta.parcelas || 'N/A'}
                            </div>
                            {oferta.monthlyPayment && (
                              <div>
                                <span className="font-medium">Parcela Mensal:</span>{' '}
                                {formatarMoeda(oferta.monthlyPayment)}
                              </div>
                            )}
                            {oferta.rate && (
                              <div>
                                <span className="font-medium">Taxa:</span>{' '}
                                {(oferta.rate * 100).toFixed(2)}% ao mês
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    ) : (
                      <pre className="text-xs bg-white p-2 rounded border border-purple-100 overflow-auto max-h-64">
                        {JSON.stringify(simulationMeta, null, 2)}
                      </pre>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {(selectedOptionUuid || simulationMeta) && userUuid ? (
              <Alert className="bg-slate-50 border-slate-200">
                <Info className="h-4 w-4 text-slate-700" />
                <AlertDescription className="text-slate-900 space-y-3">
                  <p className="font-semibold">Criar contrato (POST /clt/contract)</p>
                  <p className="text-xs">
                    selectedOptionUuid preenchido a partir da simulação. Cadastre conta em{' '}
                    <code className="bg-white px-1 rounded">POST /bank-accounts</code> na API CredSpot e informe o UUID abaixo.
                  </p>
                  <div>
                    <Label htmlFor="selectedOptionUuid">selectedOptionUuid *</Label>
                    <Input
                      id="selectedOptionUuid"
                      value={selectedOptionUuid}
                      onChange={(e) => setSelectedOptionUuid(e.target.value)}
                      disabled={loading}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankAccountUuid">bankAccountUuid *</Label>
                    <Input
                      id="bankAccountUuid"
                      placeholder="UUID da conta bancária do usuário"
                      value={bankAccountUuid}
                      onChange={(e) => setBankAccountUuid(e.target.value)}
                      disabled={loading}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={criarContrato}
                    disabled={loading || !selectedOptionUuid || !bankAccountUuid.trim()}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar contrato CLT'}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Erro */}
            {erro && (
              <Alert className="bg-red-50 border-red-200">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-900">
                  {erro}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
