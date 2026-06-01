"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calculator, XCircle, DollarSign, Calendar, AlertCircle, Info, Send, ArrowRight, CheckCircle2, Search, ExternalLink } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface CLTSimularProps {
  onSuccess?: (dados: any) => void
  onError?: (erro: string) => void
  apiId?: string
  dadosAnteriores?: any
}

export function CLTSimular({ onSuccess, onError, apiId: apiIdProp, dadosAnteriores }: CLTSimularProps = {}) {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [resultadosMultiplasApis, setResultadosMultiplasApis] = useState<any[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [isPolicyError, setIsPolicyError] = useState(false)
  const [apiSelecionada, setApiSelecionada] = useState<string>(apiIdProp || '')
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])

  // Preenche dados se vierem de etapa anterior
  useEffect(() => {
    if (dadosAnteriores?.cpf) {
      setFormData(prev => ({
        ...prev,
        cpf: dadosAnteriores.cpf || prev.cpf,
      }))
    }
    if (apiIdProp) {
      setApiSelecionada(apiIdProp)
    }
  }, [dadosAnteriores, apiIdProp])
  const [formData, setFormData] = useState({
    cpf: '',
    lojaId: '',
    idCotacao: '',
    numeroParcelas: '',
    valor: '',
    valorParcela: '', // Valor da parcela (para V8 Digital)
    matricula: '',
    codigoInscricaoEmpregador: '1',
    numeroInscricaoEmpregador: '',
    // Novos campos para Nossa Fintech
    marginKey: '',
    simulationType: 'amount', // 'amount' ou 'installments'
    serviceType: 'QITECH', // Padrão QITECH
    codTabela: '',
    requestedAmount: '',
  })
  const [tabelasDisponiveis, setTabelasDisponiveis] = useState<any[]>([])
  const [carregandoTabelas, setCarregandoTabelas] = useState(false)
  const [consultandoMargem, setConsultandoMargem] = useState(false)
  const [cnpjEmpregador, setCnpjEmpregador] = useState('')
  // Estados para V8 Digital
  const [consultId, setConsultId] = useState<string>('')
  const [taxasDisponiveis, setTaxasDisponiveis] = useState<any[]>([])
  const [carregandoTaxas, setCarregandoTaxas] = useState(false)
  const [configIdSelecionado, setConfigIdSelecionado] = useState<string>('')
  const [informacoesTermo, setInformacoesTermo] = useState<any>(null) // Informações do termo de consentimento (margem, etc)
  const [autorizandoTermo, setAutorizandoTermo] = useState(false) // Estado para controlar autorização do termo
  const [atualizandoStatus, setAtualizandoStatus] = useState(false) // Estado para indicar que está atualizando status
  const carregandoInfoRef = useRef(false) // Flag para evitar chamadas simultâneas

  // Função para formatar status da V8 Digital em português
  const formatarStatusV8 = (status: string): { texto: string; cor: string; icone: any } => {
    if (!status) {
      return { texto: 'Status não disponível', cor: 'gray', icone: Info }
    }
    
    const statusUpper = status.toUpperCase()
    const statusLower = status.toLowerCase()
    
    // Status intermediários (aguardando)
    if (statusUpper === 'WAITING_CONSENT' || statusLower === 'waiting_consent') {
      return { texto: '⏳ Aguardando Consentimento', cor: 'yellow', icone: AlertCircle }
    }
    if (statusUpper === 'CONSENT_APPROVED' || statusLower === 'consent_approved' || statusLower === 'authorized' || statusLower === 'autorizado' || statusLower === 'aprovada' || statusLower === 'approved') {
      return { texto: '✅ Consentimento Aprovado', cor: 'blue', icone: CheckCircle2 }
    }
    if (statusUpper === 'WAITING_CONSULT' || statusLower === 'waiting_consult') {
      return { texto: '🔄 Aguardando Consulta (Banco processando...)', cor: 'blue', icone: Loader2 }
    }
    if (statusUpper === 'WAITING_CREDIT_ANALYSIS' || statusLower === 'waiting_credit_analysis') {
      return { texto: '📊 Aguardando Análise de Crédito', cor: 'blue', icone: Loader2 }
    }
    
    // Status finais (sucesso)
    if (statusUpper === 'SUCCESS' || statusLower === 'success') {
      return { texto: '✅ Consulta Concluída com Sucesso', cor: 'green', icone: CheckCircle2 }
    }
    
    // Status finais (falha/rejeição)
    if (statusUpper === 'REJECTED' || statusLower === 'rejected' || statusLower === 'rejeitado' || statusLower === 'inelegivel' || statusLower === 'inelegível') {
      return { texto: '❌ registro Rejeitado / Inelegível', cor: 'red', icone: XCircle }
    }
    if (statusUpper === 'FAILED' || statusLower === 'failed') {
      return { texto: '❌ Falha na Consulta', cor: 'red', icone: XCircle }
    }
    
    // Status padrão (se não reconhecido)
    return { texto: status, cor: 'gray', icone: Info }
  }

  // Obtém o tipo da API selecionada
  const apiSelecionadaType = apisDisponiveis.find(api => api.id === apiSelecionada)?.type

  // Define quais campos são necessários para cada tipo de API
  // TODO Presença (presencabank): ao integrar, matrícula e CNPJ vêm apenas de dadosAnteriores.vinculoSelecionado
  // (extrair com extrairMatriculaECnpj); não incluir "matricula" nem "cnpjEmpregador" como campos do formulário.
  const getCamposObrigatorios = (): string[] => {
    if (!apiSelecionadaType) return []
    
    switch (apiSelecionadaType) {
      case 'presencabank':
        // Presença: só CPF no form; matrícula e CNPJ vêm do vínculo (dadosAnteriores.vinculoSelecionado).
        return ['cpf']
      case 'nossafintech':
        // Nossa Fintech usa apenas os novos campos
        return ['cpf', 'marginKey', 'simulationType', 'codTabela', 'requestedAmount']
      case 'v8digital':
        return ['cpf', 'consultId', 'configId'] // V8 Digital precisa de CPF, consultId e configId
      default:
        return ['cpf']
    }
  }

  // Verifica se um campo é obrigatório
  const isCampoObrigatorio = (campo: string) => {
    return getCamposObrigatorios().includes(campo)
  }

  // Verifica se um campo deve ser exibido (apenas campos necessários para cada banco)
  // Presença (presencabank): não exibir CNPJ Empregador nem Matrícula; vêm do vínculo (consultar-vinculos).
  const shouldShowCampo = (campo: string) => {
    if (!apiSelecionadaType) return false
    
    switch (apiSelecionadaType) {
      case 'presencabank':
        // Não mostrar matricula/cnpjEmpregador; obter de dadosAnteriores.vinculoSelecionado (extrairMatriculaECnpj).
        return ['cpf', 'valor', 'valorParcela', 'numeroParcelas'].includes(campo)
      case 'nossafintech':
        // Nossa Fintech: cpf, marginKey (oculto, preenchido automaticamente), simulationType, codTabela, requestedAmount
        // CNPJ Empregador é opcional (pode vir da consulta)
        return ['cpf', 'simulationType', 'codTabela', 'requestedAmount'].includes(campo) || campo === 'cnpjEmpregador'
      case 'v8digital':
        // V8 Digital: cpf, consultId (oculto, carregado automaticamente), configId (seleção de taxa), valor (opcional), valorParcela (opcional), numeroParcelas (opcional)
        return ['cpf', 'configId', 'valor', 'valorParcela', 'numeroParcelas'].includes(campo)
      default:
        return false
    }
  }

  // Carrega APIs disponíveis ao montar o componente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active)
        setApisDisponiveis(configs)
        // Define a API padrão como selecionada
        if (configs.length > 0) {
          const defaultId = manager.getDefaultApiId() || configs[0].id
          setApiSelecionada(defaultId)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Carrega dados do localStorage quando o componente é montado
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('clt_simulacao_dados')
    if (dadosSalvos) {
      try {
        const dados = JSON.parse(dadosSalvos)
        setFormData(prev => ({
          ...prev,
          cpf: dados.cpf || prev.cpf,
          idCotacao: dados.idCotacao || prev.idCotacao,
          matricula: dados.matricula || prev.matricula,
          codigoInscricaoEmpregador: dados.codigoInscricaoEmpregador?.toString() || prev.codigoInscricaoEmpregador,
          numeroInscricaoEmpregador: dados.numeroInscricaoEmpregador || prev.numeroInscricaoEmpregador,
        }))
        
        // Limpa os dados após usar
        localStorage.removeItem('clt_simulacao_dados')
        
        // Mostra mensagem de sucesso (opcional - pode ser removido se preferir)
        console.log('Dados preenchidos automaticamente:', dados)
      } catch (error) {
        console.error('Erro ao carregar dados salvos:', error)
      }
    }

    // Carrega consultId e informações do termo de consentimento V8 Digital
    const termoConsentimento = localStorage.getItem('clt_termo_consentimento_v8')
    if (termoConsentimento) {
      try {
        const termoData = JSON.parse(termoConsentimento)
        // O consultId pode estar em termoData.termoData.id ou termoData.id
        const consultIdEncontrado = termoData?.termoData?.id || termoData?.id || termoData?.termoData?.data?.id
        if (consultIdEncontrado) {
          setConsultId(consultIdEncontrado)
          console.log('[CLTSimular] ConsultId carregado do termo de consentimento:', consultIdEncontrado)
        }
        // Salva informações do termo para exibir margem disponível
        // A margem pode estar em termoData.termoData.availableMarginValue ou termoData.termoData
        const infoTermo = termoData?.termoData || termoData
        setInformacoesTermo(infoTermo)
        console.log('[CLTSimular] Informações do termo carregadas:', infoTermo)
      } catch (error) {
        console.error('Erro ao carregar termo de consentimento:', error)
      }
    }

    // Carrega marginKey do localStorage se disponível (após consulta de margem)
    const marginKeySalvo = localStorage.getItem('clt_margin_key')
    if (marginKeySalvo) {
      try {
        const marginKeyData = JSON.parse(marginKeySalvo)
        setFormData(prev => ({
          ...prev,
          marginKey: marginKeyData.margin_key || marginKeyData.marginKey || prev.marginKey,
          serviceType: marginKeyData.service_type || marginKeyData.serviceType || prev.serviceType,
        }))
        console.log('Margin Key carregado do localStorage:', marginKeyData)
      } catch (error) {
        console.error('Erro ao carregar margin_key do localStorage:', error)
      }
    }

    // Carrega dados de autorização do localStorage para garantir que usamos os mesmos parâmetros
    const autorizacaoSalva = localStorage.getItem('clt_autorizacao_dados')
    if (autorizacaoSalva) {
      try {
        const autorizacaoData = JSON.parse(autorizacaoSalva)
        
        // Se tiver serviceType na autorização, usa o da autorização
        if (autorizacaoData.serviceType) {
          setFormData(prev => ({
            ...prev,
            serviceType: autorizacaoData.serviceType,
          }))
          console.log('[CLTSimular] Service Type carregado da autorização:', autorizacaoData.serviceType)
        }
        
        // Se tiver apiId na autorização e for diferente, atualiza
        if (autorizacaoData.apiId && autorizacaoData.apiId !== apiSelecionada) {
          setApiSelecionada(autorizacaoData.apiId)
          console.log('[CLTSimular] API ID carregado da autorização:', autorizacaoData.apiId)
        }
        
        // Verifica se o CPF corresponde
        if (autorizacaoData.cpf && autorizacaoData.cpf !== formData.cpf) {
          console.warn('[CLTSimular] CPF da autorização diferente do CPF do formulário:', autorizacaoData.cpf, 'vs', formData.cpf)
        }
      } catch (error) {
        console.error('Erro ao carregar dados de autorização:', error)
      }
    }
  }, [])

  // Carrega tabelas quando selecionar Nossa Fintech
  useEffect(() => {
    const carregarTabelas = async () => {
      if (apiSelecionadaType === 'nossafintech' && apiSelecionada && !carregandoTabelas) {
        setCarregandoTabelas(true)
        try {
          const response = await fetch(`/api/produto/clt/listar-tabelas?apiId=${apiSelecionada}`)
          const data = await response.json()
          if (data.success && Array.isArray(data.data)) {
            setTabelasDisponiveis(data.data)
            console.log('Tabelas carregadas:', data.data)
          } else {
            console.error('Erro ao carregar tabelas:', data.error)
          }
        } catch (error) {
          console.error('Erro ao carregar tabelas:', error)
        } finally {
          setCarregandoTabelas(false)
        }
      }
    }
    carregarTabelas()
  }, [apiSelecionada, apiSelecionadaType])

  // Carrega taxas disponíveis quando V8 Digital é selecionada
  useEffect(() => {
    const carregarTaxas = async () => {
      if (apiSelecionadaType === 'v8digital' && apiSelecionada && !carregandoTaxas) {
        setCarregandoTaxas(true)
        try {
          const response = await fetch(`/api/produto/v8/taxas-simulacao?apiId=${apiSelecionada}`)
          const data = await response.json()
          if (data.success && Array.isArray(data.data?.configs)) {
            setTaxasDisponiveis(data.data.configs)
            console.log('[CLTSimular] Taxas carregadas:', data.data.configs)
            // Seleciona a primeira taxa por padrão
            if (data.data.configs.length > 0 && !configIdSelecionado) {
              setConfigIdSelecionado(data.data.configs[0].id)
            }
          } else {
            console.error('[CLTSimular] Erro ao carregar taxas:', data.error)
          }
        } catch (error) {
          console.error('[CLTSimular] Erro ao carregar taxas:', error)
        } finally {
          setCarregandoTaxas(false)
        }
      }
    }
    carregarTaxas()
  }, [apiSelecionada, apiSelecionadaType])

  // Carrega informações do termo de consentimento (margem disponível) quando V8 Digital é selecionada e CPF é informado
  useEffect(() => {
    const carregarInfoTermo = async () => {
      // Evita chamadas simultâneas
      if (carregandoInfoRef.current) {
        console.log('[CLTSimular] ⏸️ Já está carregando informações, ignorando nova chamada.')
        return
      }
      
      carregandoInfoRef.current = true
      const cpfNormalizado = normalizarCPF(formData.cpf)
      if (apiSelecionadaType === 'v8digital' && apiSelecionada && cpfNormalizado && cpfNormalizado.length === 11 && consultId) {
        try {
          // Primeiro tenta carregar do localStorage (mais rápido)
          const termoSalvo = localStorage.getItem('clt_termo_consentimento_v8')
          let termoLocal = null
          if (termoSalvo) {
            const termoData = JSON.parse(termoSalvo)
            const infoTermo = termoData?.termoData || termoData
            if (infoTermo && (infoTermo.id === consultId || infoTermo.consultId === consultId)) {
              termoLocal = infoTermo
              setInformacoesTermo(infoTermo)
              console.log('[CLTSimular] Informações do termo carregadas do localStorage:', infoTermo)
              
              // Verifica status do termo conforme documentação V8 Digital
              const statusTermo = infoTermo?.status?.toUpperCase()
              const statusAprovado = statusTermo === 'CONSENT_APPROVED' || 
                                    statusTermo === 'SUCCESS' ||
                                    // Compatibilidade com versões antigas/minúsculas
                                    infoTermo?.status?.toLowerCase() === 'aprovada' || 
                                    infoTermo?.status?.toLowerCase() === 'approved' || 
                                    infoTermo?.status?.toLowerCase() === 'consent_approved' || 
                                    infoTermo?.status?.toLowerCase() === 'success' ||
                                    infoTermo?.status?.toLowerCase() === 'authorized' ||
                                    infoTermo?.status?.toLowerCase() === 'autorizado'
              
              // Verifica se já tem margem no localStorage
              const margem = infoTermo?.availableMarginValue || 
                            infoTermo?.available_margin_value ||
                            infoTermo?.margin?.available ||
                            infoTermo?.margin?.value ||
                            infoTermo?.availableMargin ||
                            infoTermo?.available_margin
              
              // Se está aprovado mas não tem margem, SEMPRE consulta a API para obter dados atualizados
              if (margem && !statusAprovado) {
                console.log('[CLTSimular] Margem encontrada no localStorage e termo não aprovado:', margem)
                return // Já tem margem e não está aprovado, não precisa consultar
              }
              
              // Se está aprovado mas não tem margem, ou se tem margem mas está aprovado, consulta para atualizar
              if (statusAprovado && !margem) {
                console.log('[CLTSimular] Termo aprovado mas sem margem no localStorage, consultando API...')
              } else if (statusAprovado && margem) {
                console.log('[CLTSimular] Termo aprovado com margem, mas consultando API para garantir dados atualizados...')
              }
            }
          }
          
          // SEMPRE consulta a API para obter informações atualizadas (especialmente margem quando aprovado)
          // Primeiro tenta buscar detalhes específicos do termo pelo ID
          let termoEncontrado = null
          
          try {
            console.log('[CLTSimular] Tentando buscar detalhes do termo pelo ID:', consultId)
            const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${consultId}`)
            const detalhesData = await detalhesResponse.json()
            
            if (detalhesData.success && detalhesData.data) {
              termoEncontrado = detalhesData.data
              console.log('[CLTSimular] ✅ Detalhes do termo obtidos pelo endpoint específico:', termoEncontrado)
            } else {
              console.log('[CLTSimular] ⚠️ Endpoint de detalhes não retornou dados, tentando listagem...')
            }
          } catch (error) {
            console.log('[CLTSimular] ⚠️ Erro ao buscar detalhes específicos, tentando listagem:', error)
          }
          
          // Se não encontrou pelos detalhes, tenta pela listagem
          if (!termoEncontrado) {
            const cpfNormalizado = normalizarCPF(formData.cpf)
            const response = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${cpfNormalizado}`)
            const data = await response.json()
            console.log('[CLTSimular] Resposta completa da API (listagem):', JSON.stringify(data, null, 2))
            
            if (data.success && data.data) {
              // V8 Digital pode retornar { data: { data: [...] } } ou { data: [...] }
              let termosLista = data.data
              if (data.data.data && Array.isArray(data.data.data)) {
                termosLista = data.data.data
              } else if (Array.isArray(data.data)) {
                termosLista = data.data
              }
              
              // Procura pelo consultId na lista de termos
              if (Array.isArray(termosLista)) {
                termoEncontrado = termosLista.find((t: any) => t.id === consultId || t.consultId === consultId)
                if (termoEncontrado) {
                  console.log('[CLTSimular] ✅ Termo encontrado na listagem:', termoEncontrado)
                }
              } else if (data.data.id === consultId || data.data.consultId === consultId) {
                termoEncontrado = data.data
                console.log('[CLTSimular] ✅ Termo encontrado como objeto único:', termoEncontrado)
              }
            }
          }
          
          if (termoEncontrado) {
            setInformacoesTermo(termoEncontrado)
            console.log('[CLTSimular] ✅ Termo encontrado na API:', termoEncontrado)
            console.log('[CLTSimular] Status do termo:', termoEncontrado.status)
                
                // Verifica se tem margem na resposta - tenta múltiplos formatos
                const margem = termoEncontrado?.availableMarginValue || 
                              termoEncontrado?.available_margin_value ||
                              termoEncontrado?.margin?.available ||
                              termoEncontrado?.margin?.value ||
                              termoEncontrado?.availableMargin ||
                              termoEncontrado?.available_margin ||
                              termoEncontrado?.availableMarginValue?.value ||
                              termoEncontrado?.data?.availableMarginValue
                
                if (margem) {
                  console.log('[CLTSimular] ✅ Margem encontrada na API:', margem)
                  // Atualiza o localStorage com a margem encontrada
                  const termoSalvo = localStorage.getItem('clt_termo_consentimento_v8')
                  if (termoSalvo) {
                    try {
                      const termoData = JSON.parse(termoSalvo)
                      termoData.termoData = { ...termoData.termoData, ...termoEncontrado }
                      localStorage.setItem('clt_termo_consentimento_v8', JSON.stringify(termoData))
                    } catch (e) {
                      console.error('[CLTSimular] Erro ao atualizar localStorage:', e)
                    }
                  }
                } else {
                  console.log('[CLTSimular] ⚠️ Margem não encontrada na resposta.')
                  console.log('[CLTSimular] Estrutura completa do termo:', JSON.stringify(termoEncontrado, null, 2))
                  console.log('[CLTSimular] Chaves disponíveis:', Object.keys(termoEncontrado || {}))
                  
                  // Verifica status do termo conforme documentação V8 Digital
                  // Status possíveis: WAITING_CONSENT, CONSENT_APPROVED, WAITING_CONSULT, 
                  // WAITING_CREDIT_ANALYSIS, SUCCESS, FAILED, REJECTED
                  const statusTermo = termoEncontrado?.status?.toUpperCase()
                  const statusAprovado = statusTermo === 'CONSENT_APPROVED' || 
                                        statusTermo === 'SUCCESS' ||
                                        // Compatibilidade com versões antigas/minúsculas
                                        termoEncontrado?.status?.toLowerCase() === 'aprovada' || 
                                        termoEncontrado?.status?.toLowerCase() === 'approved' || 
                                        termoEncontrado?.status?.toLowerCase() === 'consent_approved' || 
                                        termoEncontrado?.status?.toLowerCase() === 'success' ||
                                        termoEncontrado?.status?.toLowerCase() === 'authorized' ||
                                        termoEncontrado?.status?.toLowerCase() === 'autorizado'
                  const statusRejeitado = statusTermo === 'REJECTED' || 
                                         statusTermo === 'FAILED' ||
                                         // Compatibilidade com versões antigas/minúsculas
                                         termoEncontrado?.status?.toLowerCase() === 'rejected' || 
                                         termoEncontrado?.status?.toLowerCase() === 'rejeitado' || 
                                         termoEncontrado?.status?.toLowerCase() === 'failed' ||
                                         termoEncontrado?.status?.toLowerCase() === 'inelegivel' ||
                                         termoEncontrado?.status?.toLowerCase() === 'inelegível'
                  
                  // Se está rejeitado, apenas atualiza
                  if (statusRejeitado) {
                    console.log('[CLTSimular] ⚠️ Termo rejeitado.')
                    // Atualiza localStorage com status rejeitado
                    const termoSalvo = localStorage.getItem('clt_termo_consentimento_v8')
                    if (termoSalvo) {
                      try {
                        const termoData = JSON.parse(termoSalvo)
                        termoData.termoData = { ...termoData.termoData, ...termoEncontrado }
                        localStorage.setItem('clt_termo_consentimento_v8', JSON.stringify(termoData))
                      } catch (e) {
                        console.error('[CLTSimular] Erro ao atualizar localStorage:', e)
                      }
                    }
                  } 
                  // Se não tem margem, apenas informa que pode usar o botão de atualizar
                  else if (!margem && consultId) {
                    console.log('[CLTSimular] ⚠️ Termo encontrado mas sem margem. Use o botão "Atualizar Status" para verificar novamente.')
                  }
                }
              }
            } catch (error) {
              console.error('[CLTSimular] Erro ao carregar informações do termo:', error)
            } finally {
              carregandoInfoRef.current = false
            }
          }
        }
        
        // Primeira busca imediata (só se não estiver carregando)
        const cpfNormalizado = normalizarCPF(formData.cpf)
        if (!carregandoInfoRef.current && apiSelecionadaType === 'v8digital' && apiSelecionada && cpfNormalizado && cpfNormalizado.length === 11 && consultId) {
          carregarInfoTermo()
        }
        
        // Limpa ao desmontar ou mudar dependências
        return () => {
          carregandoInfoRef.current = false
        }
      }, [apiSelecionada, apiSelecionadaType, formData.cpf, consultId]) // Removido informacoesTermo das dependências para evitar loops
      
  // Função helper para normalizar CPF (remove formatação e preenche com zeros)
  const normalizarCPF = (cpf: string): string => {
    if (!cpf) return ''
    let cpfNormalizado = cpf.replace(/\D/g, '')
    if (cpfNormalizado.length > 0 && cpfNormalizado.length < 11) {
      cpfNormalizado = cpfNormalizado.padStart(11, '0')
    }
    if (cpfNormalizado.length > 11) {
      cpfNormalizado = cpfNormalizado.slice(-11)
    }
    return cpfNormalizado
  }

  // Função para atualizar status da consulta manualmente
  const atualizarStatusConsulta = async () => {
    const cpfNormalizado = normalizarCPF(formData.cpf)
    if (!consultId || !apiSelecionada || !cpfNormalizado || cpfNormalizado.length !== 11) {
      setErro('Dados insuficientes para atualizar status. Verifique se o CPF e o termo de consentimento estão corretos.')
      return
    }
    
    if (atualizandoStatus) {
      console.log('[CLTSimular] ⏸️ Já está atualizando status, ignorando nova chamada.')
      return
    }
    
    setAtualizandoStatus(true)
    setErro(null)
    console.log('[CLTSimular] 🔄 Atualizando status da consulta...')
    
    try {
      // Busca detalhes do termo
      let termoEncontrado = null
      
      try {
        const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${consultId}`)
        const detalhesData = await detalhesResponse.json()
        
        if (detalhesData.success && detalhesData.data) {
          termoEncontrado = detalhesData.data
          console.log('[CLTSimular] ✅ Detalhes do termo obtidos:', termoEncontrado)
        }
      } catch (error) {
        console.log('[CLTSimular] Erro ao buscar detalhes:', error)
      }
      
      // Se não encontrou pelos detalhes, tenta pela listagem
      if (!termoEncontrado) {
        try {
          const cpfNormalizadoConsulta = normalizarCPF(formData.cpf)
          const response = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${cpfNormalizadoConsulta}`)
          const data = await response.json()
          
          if (data.success && data.data) {
            let termosLista = data.data
            if (data.data.data && Array.isArray(data.data.data)) {
              termosLista = data.data.data
            } else if (Array.isArray(data.data)) {
              termosLista = data.data
            }
            
            if (Array.isArray(termosLista)) {
              termoEncontrado = termosLista.find((t: any) => t.id === consultId || t.consultId === consultId)
            } else if (data.data.id === consultId || data.data.consultId === consultId) {
              termoEncontrado = data.data
            }
          }
        } catch (error) {
          console.log('[CLTSimular] Erro ao buscar listagem:', error)
        }
      }
      
      if (termoEncontrado) {
        const statusTermo = termoEncontrado?.status?.toUpperCase()
        const statusOriginal = termoEncontrado?.status || ''
        
        console.log('[CLTSimular] 📊 Status atualizado:', statusTermo, '(original:', statusOriginal, ')')
        
        // Verifica se tem margem
        const margem = termoEncontrado?.availableMarginValue || 
                      termoEncontrado?.available_margin_value ||
                      termoEncontrado?.margin?.available ||
                      termoEncontrado?.margin?.value ||
                      termoEncontrado?.availableMargin ||
                      termoEncontrado?.available_margin ||
                      termoEncontrado?.availableMarginValue?.value ||
                      termoEncontrado?.data?.availableMarginValue
        
        // Atualiza estado
        setInformacoesTermo(termoEncontrado)
        
        // Atualiza localStorage
        const termoSalvo = localStorage.getItem('clt_termo_consentimento_v8')
        if (termoSalvo) {
          try {
            const termoData = JSON.parse(termoSalvo)
            termoData.termoData = { ...termoData.termoData, ...termoEncontrado }
            localStorage.setItem('clt_termo_consentimento_v8', JSON.stringify(termoData))
          } catch (e) {
            console.error('[CLTSimular] Erro ao atualizar localStorage:', e)
          }
        }
        
        console.log('[CLTSimular] ✅ Status atualizado com sucesso!')
      } else {
        setErro('Não foi possível encontrar informações do termo de consentimento. Verifique se o termo foi criado corretamente.')
      }
    } catch (error: any) {
      console.error('[CLTSimular] Erro ao atualizar status:', error)
      setErro(error.message || 'Erro ao atualizar status da consulta')
    } finally {
      setAtualizandoStatus(false)
    }
  }

  // Função para consultar margem automaticamente
  const consultarMargem = async () => {
    const cpfNormalizado = normalizarCPF(formData.cpf)
    if (!cpfNormalizado || cpfNormalizado.length !== 11) {
      setErro('Por favor, informe um CPF válido (11 dígitos)')
      return
    }

    if (!apiSelecionada) {
      setErro('Por favor, selecione um banco primeiro')
      return
    }

    setConsultandoMargem(true)
    setErro(null)

    try {
      // IMPORTANTE: Usa os mesmos dados da autorização para garantir compatibilidade
      const autorizacaoSalva = localStorage.getItem('clt_autorizacao_dados')
      let serviceTypeParaUsar = formData.serviceType || 'QITECH'
      let apiIdParaUsar = apiSelecionada
      let promotIdParaUsar: string | number | undefined = undefined
      
      if (autorizacaoSalva) {
        try {
          const autorizacaoData = JSON.parse(autorizacaoSalva)
          
          // Verifica se o CPF corresponde
          if (autorizacaoData.cpf && autorizacaoData.cpf !== formData.cpf) {
            console.warn('[CLTSimular] CPF da autorização diferente:', autorizacaoData.cpf, 'vs', formData.cpf)
          }
          
          // Usa o mesmo serviceType da autorização
          if (autorizacaoData.serviceType) {
            serviceTypeParaUsar = autorizacaoData.serviceType
            console.log('[CLTSimular] Usando serviceType da autorização:', serviceTypeParaUsar)
          }
          
          // Usa o mesmo apiId da autorização se disponível
          if (autorizacaoData.apiId) {
            apiIdParaUsar = autorizacaoData.apiId
            console.log('[CLTSimular] Usando apiId da autorização:', apiIdParaUsar)
            
            // Atualiza a API selecionada se for diferente
            if (apiIdParaUsar !== apiSelecionada) {
              setApiSelecionada(apiIdParaUsar)
            }
          }
          
          // IMPORTANTE: Usa o mesmo promot_id da autorização
          if (autorizacaoData.promotId !== undefined && autorizacaoData.promotId !== null) {
            promotIdParaUsar = autorizacaoData.promotId
            console.log('[CLTSimular] Usando promotId da autorização:', promotIdParaUsar)
          }
          
          // Verifica se a autorização está confirmada
          if (autorizacaoData.status === 'AUTHORIZED' || autorizacaoData.status === 'AUTORIZADO') {
            console.log('[CLTSimular] Autorização confirmada encontrada para CPF:', formData.cpf)
          } else {
            console.warn('[CLTSimular] Autorização encontrada mas status não é AUTHORIZED:', autorizacaoData.status)
          }
        } catch (e) {
          console.error('[CLTSimular] Erro ao ler autorização salva:', e)
        }
      } else {
        console.warn('[CLTSimular] Nenhuma autorização encontrada no localStorage para CPF:', formData.cpf)
        setErro('⚠️ Autorização não encontrada. Por favor, vá para a tela de "Autorização CLT" e autorize o registro primeiro.')
        setConsultandoMargem(false)
        return
      }

      const body: any = {
        cpfTrabalhador: cpfNormalizado,
        apiId: apiIdParaUsar, // Usa o mesmo apiId da autorização
      }

      // Se tiver CNPJ do empregador, adiciona
      if (cnpjEmpregador && cnpjEmpregador.length >= 14) {
        body.cnpjEmpregador = cnpjEmpregador.replace(/\D/g, '')
      }

      // Sempre adiciona serviceType (usa o da autorização)
      body.serviceType = serviceTypeParaUsar
      
      // IMPORTANTE: Passa o promot_id da autorização para garantir que use o mesmo
      if (promotIdParaUsar !== undefined) {
        body.credentials = {
          promotId: promotIdParaUsar
        }
        console.log('[CLTSimular] Passando promotId na requisição:', promotIdParaUsar)
      }
      
      console.log('[CLTSimular] Consultando margem com:', {
        cpf: cpfNormalizado,
        apiId: apiIdParaUsar,
        serviceType: serviceTypeParaUsar,
        promotId: promotIdParaUsar || 'não informado',
        cnpjEmpregador: cnpjEmpregador || 'não informado'
      })

      const response = await fetch('/api/produto/consultar-clt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Erro ao consultar margem'
        
        // Verifica se o erro é relacionado a autorização
        if (errorMessage.toLowerCase().includes('autorização') || 
            errorMessage.toLowerCase().includes('authorization') ||
            errorMessage.toLowerCase().includes('não encontrada') ||
            errorMessage.toLowerCase().includes('not found')) {
          setErro(
            '⚠️ Autorização não encontrada.\n\n' +
            'O registro precisa estar autorizado antes de consultar a margem.\n\n' +
            'Solução: Vá para a tela de "Autorização CLT" e:\n' +
            '• Se o registro já está autorizado no sistema web, clique em "Marcar como Autorizado"\n' +
            '• Se não está autorizado, crie uma nova autorização'
          )
        } else {
          setErro('Erro ao consultar margem. Verifique se o CPF está correto e se o registro tem vínculo de trabalho ativo.')
        }
      } else {
        // Busca margin_key na resposta
        const marginKey = data.data?.margin_key || 
                         data.data?.data?.margin_key || 
                         data.data?.value?.margin_key ||
                         (data.data?.value && typeof data.data.value === 'object' && 'margin_key' in data.data.value ? data.data.value.margin_key : null)

        if (marginKey) {
          // Salva margin_key no localStorage
          // Usa o serviceType do formulário ou da autorização salva
          const autorizacaoSalva = localStorage.getItem('clt_autorizacao_dados')
          let serviceTypeParaUsar = formData.serviceType || 'QITECH'
          if (autorizacaoSalva) {
            try {
              const autorizacaoData = JSON.parse(autorizacaoSalva)
              if (autorizacaoData.serviceType) {
                serviceTypeParaUsar = autorizacaoData.serviceType
                console.log('[CLTSimular] Usando serviceType da autorização para margin_key:', serviceTypeParaUsar)
              }
            } catch (e) {
              console.error('Erro ao ler autorização salva:', e)
            }
          }

          const marginKeyData = {
            margin_key: marginKey,
            marginKey: marginKey,
            service_type: serviceTypeParaUsar,
            serviceType: serviceTypeParaUsar,
            cpf: normalizarCPF(formData.cpf),
            timestamp: new Date().toISOString()
          }
          localStorage.setItem('clt_margin_key', JSON.stringify(marginKeyData))

          // Atualiza o formulário
          // Reutiliza o serviceTypeParaUsar que já foi calculado acima
          setFormData(prev => ({
            ...prev,
            marginKey: marginKey,
            serviceType: serviceTypeParaUsar,
          }))

          // Se tiver CNPJ na resposta, atualiza
          const employerDoc = data.data?.employer_document || 
                             data.data?.data?.employer_document ||
                             data.data?.employerDocument ||
                             data.data?.data?.employerDocument ||
                             null
          if (employerDoc) {
            const cnpjLimpo = String(employerDoc).replace(/\D/g, '')
            if (cnpjLimpo.length === 14) {
              setCnpjEmpregador(cnpjLimpo)
              // Também atualiza o formData se o campo estiver visível
              if (shouldShowCampo('numeroInscricaoEmpregador')) {
                setFormData(prev => ({
                  ...prev,
                  numeroInscricaoEmpregador: cnpjLimpo
                }))
              }
              console.log('[CLTSimular] CNPJ do empregador atualizado:', cnpjLimpo)
            }
          }

          console.log('Margem consultada com sucesso! Margin Key:', marginKey)
        } else {
          console.warn('Consulta de margem realizada, mas margin_key não encontrado na resposta')
          setErro('Consulta realizada, mas margin_key não foi retornado. Verifique se o registro tem vínculo ativo e autorização aprovada.')
        }
      }
    } catch (error: any) {
      console.error('Erro ao consultar margem:', error)
      setErro(error.message || 'Erro ao consultar margem')
    } finally {
      setConsultandoMargem(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Valida se uma API foi selecionada
    if (!apiSelecionada) {
      setErro('Por favor, selecione um banco para realizar a simulação')
      return
    }

    // Valida campos obrigatórios baseado no banco selecionado
    const camposObrigatorios = getCamposObrigatorios()
    console.log('[CLTSimular] Banco selecionado:', apiSelecionadaType, 'Campos obrigatórios:', camposObrigatorios)
    
    const camposFaltando: string[] = []
    
    camposObrigatorios.forEach(campo => {
      // Para V8 Digital, consultId e configId estão em estados separados
      if (campo === 'consultId') {
        if (!consultId || consultId.trim() === '') {
          camposFaltando.push(campo)
        }
      } else if (campo === 'configId') {
        if (!configIdSelecionado || configIdSelecionado.trim() === '') {
          camposFaltando.push(campo)
        }
      } else {
        const valor = formData[campo as keyof typeof formData]
        if (!valor || valor === '' || valor === null || valor === undefined) {
          camposFaltando.push(campo)
        }
      }
    })
    
    // Para Nossa Fintech, verifica se temos employerDocument (CNPJ) - pode vir da consulta
    if (apiSelecionadaType === 'nossafintech') {
      // Verifica se temos CNPJ do empregador (pode vir de cnpjEmpregador ou ser buscado automaticamente)
      const employerDoc = cnpjEmpregador?.replace(/\D/g, '') || ''
      // Se não tiver CNPJ, ainda pode funcionar se vier da consulta de margem
      // Então não bloqueamos a simulação, apenas avisamos
    }

    if (camposFaltando.length > 0) {
      const nomesCampos: Record<string, string> = {
        cpf: 'CPF',
        lojaId: 'Loja ID',
        idCotacao: 'ID Cotação',
        matricula: 'Matrícula',
        codigoInscricaoEmpregador: 'Código Inscrição Empregador',
        numeroInscricaoEmpregador: 'CNPJ Empregador',
        marginKey: 'Margin Key (obtido da consulta de margem)',
        simulationType: 'Tipo de Simulação',
        serviceType: 'Service Type',
        codTabela: 'Código da Tabela',
        requestedAmount: 'Valor Solicitado',
        employerDocument: 'CNPJ do Empregador',
        consultId: 'ID do Termo de Consentimento',
        configId: 'Taxa de Simulação',
      }
      console.log('[CLTSimular] Campos faltando:', camposFaltando)
      
      // Mensagem de erro mais específica para cada banco
      if (apiSelecionadaType === 'nossafintech') {
        if (camposFaltando.includes('marginKey')) {
          setErro('⚠️ Margin Key não encontrado. Por favor, clique em "Consultar Margem" primeiro para obter os dados do registro.')
        } else {
          const camposFaltandoNomes = camposFaltando.map(c => nomesCampos[c] || c)
          setErro(`Por favor, preencha os campos obrigatórios: ${camposFaltandoNomes.join(', ')}`)
        }
      } else if (apiSelecionadaType === 'v8digital') {
        if (camposFaltando.includes('consultId')) {
          setErro('⚠️ Termo de consentimento não encontrado. Por favor, crie o termo de consentimento primeiro na etapa anterior.')
        } else if (camposFaltando.includes('configId')) {
          setErro('⚠️ Por favor, selecione uma taxa de simulação.')
        } else {
          const camposFaltandoNomes = camposFaltando.map(c => nomesCampos[c] || c)
          setErro(`Por favor, preencha os campos obrigatórios: ${camposFaltandoNomes.join(', ')}`)
        }
      } else {
        setErro(`Por favor, preencha os campos obrigatórios: ${camposFaltando.map(c => nomesCampos[c] || c).join(', ')}`)
      }
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)
    setResultadosMultiplasApis([])

    try {
      // Prepara o body com apenas os campos necessários para o banco selecionado
      const body: any = {
        cpf: normalizarCPF(formData.cpf),
        apiId: apiSelecionada,
      }

      // Adiciona campos opcionais se preenchidos ou se obrigatórios
      if (shouldShowCampo('lojaId') && formData.lojaId) {
        body.lojaId = Number(formData.lojaId)
      }
      if (shouldShowCampo('idCotacao') && formData.idCotacao) {
        body.idCotacao = formData.idCotacao
      }
      if (shouldShowCampo('matricula') && formData.matricula) {
        body.matricula = formData.matricula
      }
      if (shouldShowCampo('codigoInscricaoEmpregador') && formData.codigoInscricaoEmpregador) {
        body.codigoInscricaoEmpregador = Number(formData.codigoInscricaoEmpregador)
      }
      if (shouldShowCampo('numeroInscricaoEmpregador') && formData.numeroInscricaoEmpregador) {
        body.numeroInscricaoEmpregador = formData.numeroInscricaoEmpregador
      }
      // Para V8 Digital, sempre envia number_of_installments (mesmo que seja 0)
      if (apiSelecionadaType === 'v8digital') {
        body.numeroParcelas = formData.numeroParcelas ? Number(formData.numeroParcelas) : 0
      } else if (shouldShowCampo('numeroParcelas') && formData.numeroParcelas) {
        body.numeroParcelas = Number(formData.numeroParcelas) || 0
      }
      if (shouldShowCampo('valor') && formData.valor) {
        body.valor = Number(formData.valor) || 0
      }
      
      // Campos específicos para V8 Digital
      if (apiSelecionadaType === 'v8digital') {
        // ConsultId é obrigatório (carregado do termo de consentimento)
        if (!consultId) {
          setErro('⚠️ Termo de consentimento não encontrado. Por favor, crie o termo de consentimento primeiro na etapa anterior.')
          setLoading(false)
          return
        }
        body.consultId = consultId

        // ConfigId é obrigatório (selecionado das taxas disponíveis)
        if (!configIdSelecionado) {
          setErro('⚠️ Por favor, selecione uma taxa de simulação.')
          setLoading(false)
          return
        }
        body.configId = configIdSelecionado

        // Verifica se o termo está autorizado/aprovado antes de simular
        const statusTermo = informacoesTermo?.status?.toLowerCase()
        // Status válidos: authorized, autorizado, aprovada, approved, consent_approved, success
        const statusValidos = ['authorized', 'autorizado', 'aprovada', 'approved', 'consent_approved', 'success']
        if (!statusTermo || !statusValidos.includes(statusTermo)) {
          const statusAtual = informacoesTermo?.status || 'não disponível'
          setErro(`⚠️ O termo de consentimento precisa ser autorizado antes de simular. Status atual: ${statusAtual}. Por favor, clique no botão "Autorizar Termo" no card acima para autorizar o termo primeiro.`)
          setLoading(false)
          return
        }

        // Valor solicitado (opcional)
        if (formData.valor) body.valorSolicitado = Number(formData.valor)
        
        // Valor da parcela (opcional, mas necessário se valor solicitado não for informado)
        if (formData.valorParcela) body.valorParcela = Number(formData.valorParcela)
        
        // number_of_installments deve ser enviado, mesmo que seja 0
        body.numeroParcelas = Number(formData.numeroParcelas) || 0
      }

      // Campos específicos para Nossa Fintech
      if (apiSelecionadaType === 'nossafintech') {
        // Margin Key é obrigatório (preenchido automaticamente pela consulta de margem)
        if (formData.marginKey) {
          body.marginKey = formData.marginKey
        }
        
        // Simulation Type é obrigatório
        if (formData.simulationType) {
          // Converte para o formato esperado pela API
          body.simulationType = formData.simulationType === 'amount' ? 'Payment' : 'Liquid'
        }
        
        // Service Type é obrigatório (preenchido automaticamente)
        if (formData.serviceType) {
          body.serviceType = formData.serviceType
        }
        
        // Código da Tabela é obrigatório
        if (formData.codTabela) {
          body.codTabela = formData.codTabela
        }
        
        // Valor Solicitado é obrigatório
        if (formData.requestedAmount) {
          body.requestedAmount = Number(formData.requestedAmount) || 0
        }
        
        // Employer Document (CNPJ do empregador) - pode vir da consulta ou ser informado
        const employerDoc = cnpjEmpregador?.replace(/\D/g, '') || ''
        if (employerDoc && employerDoc.length === 14) {
          body.employerDocument = employerDoc
        }
        // Se não tiver CNPJ, a API pode buscar automaticamente ou retornar erro
      }

      const response = await fetch('/api/produto/clt/simular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        // Se for erro de política, mostra como informação, não como erro crítico
        const errorMsg = data.error || 'Erro ao simular proposta CLT'
        if (data.isPolicyError) {
          setIsPolicyError(true)
          setErro(errorMsg)
        } else {
          setIsPolicyError(false)
          setErro(errorMsg)
        }
        setResultadosMultiplasApis([])
        setResultado(null)
        onError?.(errorMsg)
      } else {
        setIsPolicyError(false)
        
        // Se consultou múltiplas APIs
        if (data.consultouMultiplas && Array.isArray(data.data)) {
          setResultadosMultiplasApis(data.data)
          setResultado(null)
        } else {
          // Resultado de uma única API (comportamento antigo)
          setResultado(data.data)
          setResultadosMultiplasApis([])
          onSuccess?.(data.data)
        }
      }
    } catch (error: any) {
      setIsPolicyError(false)
      setErro(error.message || 'Erro ao simular proposta CLT')
    } finally {
      setLoading(false)
    }
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR')
  }

  // Normaliza a estrutura de simulações vinda de diferentes APIs (V8, Nossa Fintech, etc.)
  const normalizarSimulacoesApi = (data: any, apiType?: string | null): any[] => {
    if (!data) return []

    // Caso comum: backend já retorna um array em data.value (Nossa Fintech, etc.)
    if (Array.isArray(data.value)) return data.value
    if (Array.isArray(data)) return data

    // V8 Digital: converte resposta única da V8 no formato interno de simulação
    if (apiType === 'v8digital' && typeof data === 'object') {
      const v8 = data as any

      const valorLiquido =
        v8.disbursement_option?.final_disbursement_amount ??
        v8.disbursement_amount ??
        v8.disbursed_issue_amount ??
        0

      const valorParcela =
        v8.installment_value ??
        v8.disbursement_option?.installment_value ??
        0

      const numeroParcelas =
        v8.number_of_installments ??
        (Array.isArray(v8.disbursement_option?.installments)
          ? v8.disbursement_option.installments.length
          : 0)

      const simulacaoNormalizada = {
        simulacaoId: v8.id_simulation ?? v8.id ?? null,
        valorMargem: v8.disbursement_amount ?? null,
        numeroParcelas,
        valorParcela,
        valorLiquido,
        valorDesembolso: valorLiquido,
        opcaoProposta: {
          numeroParcelas,
          valorParcela,
          valorDesembolsoTrabalhador: valorLiquido,
          taxaJuros: v8.monthly_interest_rate ?? null,
          dataDeVencimento: v8.disbursement_option?.first_due_date ?? null,
          idProposta: v8.id_simulation ?? v8.id ?? null
        },
        tabelaFinanciamento: {
          id: v8.config_id ?? null,
          descricao: v8.slug ?? 'Simulação V8'
        }
      }

      return [simulacaoNormalizada]
    }

    // Fallback: se data.value for array em qualquer outro formato
    if (Array.isArray(data.value)) return data.value

    return []
  }

  const simulacoes = normalizarSimulacoesApi(resultado, apiSelecionadaType)

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calculator className="h-5 w-5 text-purple-600" />
            </div>
            Simulação CLT
          </CardTitle>
          <CardDescription className="mt-2">
            Simule propostas de crédito CLT usando dados do vínculo consultado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seleção de API */}
            <div>
              <Label htmlFor="banco">Banco para Simulação *</Label>
              <select
                id="banco"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={apiSelecionada}
                onChange={(e) => setApiSelecionada(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Selecione um banco...</option>
                {apisDisponiveis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.type === 'v8digital' ? 'V8 Digital' : 
                                 api.type === 'nossafintech' ? 'Nossa Fintech' : 
                                 'Custom'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selecione o banco que será usado para realizar a simulação
              </p>
              {apisDisponiveis.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Nenhuma API configurada. Configure as APIs na seção de Configuração de APIs.
                </p>
              )}
            </div>

            {/* Mostra campos apenas se uma API foi selecionada */}
            {!apiSelecionada ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Selecione um banco para visualizar os campos de simulação
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Informações do Termo de Consentimento - V8 Digital */}
                {apiSelecionadaType === 'v8digital' && consultId && (
                  <Alert className="mb-4 border-blue-200 bg-blue-50">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-900">
                      <p className="font-semibold">✅ Termo de Consentimento encontrado</p>
                      {(() => {
                        // Tenta encontrar a margem em diferentes locais possíveis
                        const margem = informacoesTermo?.availableMarginValue || 
                                      informacoesTermo?.available_margin_value ||
                                      informacoesTermo?.margin?.available ||
                                      informacoesTermo?.margin?.value ||
                                      informacoesTermo?.availableMargin ||
                                      informacoesTermo?.available_margin ||
                                      informacoesTermo?.data?.availableMarginValue
                        
                        // Verifica status do termo conforme documentação V8 Digital
                        // Status possíveis: WAITING_CONSENT, CONSENT_APPROVED, WAITING_CONSULT, 
                        // WAITING_CREDIT_ANALYSIS, SUCCESS, FAILED, REJECTED
                        const statusTermo = informacoesTermo?.status?.toUpperCase()
                        const statusAprovado = statusTermo === 'CONSENT_APPROVED' || 
                                              statusTermo === 'SUCCESS' ||
                                              // Compatibilidade com versões antigas/minúsculas
                                              informacoesTermo?.status?.toLowerCase() === 'aprovada' || 
                                              informacoesTermo?.status?.toLowerCase() === 'approved' || 
                                              informacoesTermo?.status?.toLowerCase() === 'consent_approved' || 
                                              informacoesTermo?.status?.toLowerCase() === 'success' ||
                                              informacoesTermo?.status?.toLowerCase() === 'authorized' ||
                                              informacoesTermo?.status?.toLowerCase() === 'autorizado'
                        
                        // Verifica se está inelegível ou rejeitado
                        const statusRejeitado = statusTermo === 'REJECTED' || 
                                              statusTermo === 'FAILED' ||
                                              // Compatibilidade com versões antigas/minúsculas
                                              informacoesTermo?.status?.toLowerCase() === 'rejected' || 
                                              informacoesTermo?.status?.toLowerCase() === 'rejeitado' || 
                                              informacoesTermo?.status?.toLowerCase() === 'failed' ||
                                              informacoesTermo?.status?.toLowerCase() === 'inelegivel' ||
                                              informacoesTermo?.status?.toLowerCase() === 'inelegível'
                        const temDescricaoRejeicao = informacoesTermo?.description && (
                          informacoesTermo.description.toLowerCase().includes('inelegível') ||
                          informacoesTermo.description.toLowerCase().includes('rejeitado') ||
                          informacoesTermo.description.toLowerCase().includes('registro inferior') ||
                          informacoesTermo.description.toLowerCase().includes('menos de 6 meses') ||
                          informacoesTermo.description.toLowerCase().includes('6 meses')
                        )
                        const isRejeitado = statusRejeitado || temDescricaoRejeicao
                        
                        // Log para depuração
                        if (informacoesTermo && !margem) {
                          console.log('[CLTSimular] Termo encontrado mas sem margem:', informacoesTermo)
                          console.log('[CLTSimular] Chaves disponíveis:', Object.keys(informacoesTermo || {}))
                          console.log('[CLTSimular] Status:', statusTermo)
                          console.log('[CLTSimular] Description:', informacoesTermo?.description)
                          console.log('[CLTSimular] É rejeitado?', isRejeitado)
                        }
                        
                        // Se está rejeitado/inelegível, mostra mensagem de rejeição
                        if (isRejeitado || (statusRejeitado && informacoesTermo?.description)) {
                          return (
                            <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                              <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
                                <XCircle className="h-4 w-4" />
                                ⚠️ registro Rejeitado / Inelegível
                              </p>
                              {informacoesTermo?.description && (
                                <p className="text-xs text-gray-700 mt-2">
                                  <strong>Motivo:</strong> {informacoesTermo.description}
                                </p>
                              )}
                              {informacoesTermo?.status && (
                                <p className="text-xs text-gray-600 mt-1">
                                  <strong>Status:</strong> <Badge variant="destructive" className="ml-1">{informacoesTermo.status}</Badge>
                                </p>
                              )}
                            </div>
                          )
                        }
                        
                        
                        // Se está aprovado mas não tem margem, pode estar processando
                        if (statusAprovado && !margem && !isRejeitado) {
                          return (
                            <p className="text-xs mt-1 text-yellow-600 italic">
                              ⏳ Aguardando processamento da margem pela API...
                            </p>
                          )
                        }
                        
                        // Se tem margem, exibe
                        if (margem && Number(margem) > 0) {
                          return (
                            <p className="text-sm mt-1">
                              <strong>Margem Disponível:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(margem))}
                            </p>
                          )
                        }
                        
                        // Se margem é zero, pode ser inelegível
                        if (margem !== undefined && Number(margem) === 0) {
                          return (
                            <div className="mt-2">
                              <p className="text-sm text-red-600 font-semibold">
                                ⚠️ Margem Disponível: R$ 0,00
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                registro não possui margem disponível para crédito.
                              </p>
                            </div>
                          )
                        }
                        
                        // Se não tem margem e não está aprovado, mostra mensagem de carregamento
                        return (
                          <p className="text-xs mt-1 text-gray-600 italic">
                            Margem disponível será carregada automaticamente...
                          </p>
                        )
                      })()}
                      {/* Informações do registro */}
                      {informacoesTermo?.name || informacoesTermo?.borrowerName && (
                        <p className="text-sm mt-1">
                          <strong>registro:</strong> {informacoesTermo?.name || informacoesTermo?.borrowerName}
                        </p>
                      )}
                      
                      {/* Status da Consulta - Destaque Visual */}
                      {informacoesTermo?.status && (() => {
                        const statusFormatado = formatarStatusV8(informacoesTermo.status)
                        const StatusIcon = statusFormatado.icone
                        const coresStatus: Record<string, { bg: string; border: string; text: string }> = {
                          yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800' },
                          blue: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
                          green: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
                          red: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
                          gray: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-800' },
                        }
                        const corStatus = coresStatus[statusFormatado.cor] || coresStatus.gray
                        
                        return (
                          <div className={`mt-3 p-3 rounded-lg border-2 ${corStatus.bg} ${corStatus.border}`}>
                            <div className="flex items-center gap-2">
                              <StatusIcon className={`h-5 w-5 ${corStatus.text} ${statusFormatado.cor === 'blue' ? 'animate-spin' : ''}`} />
                              <div className="flex-1">
                                <p className={`font-semibold text-sm ${corStatus.text}`}>
                                  Status da Consulta
                                </p>
                                <p className={`font-bold text-base mt-1 ${corStatus.text}`}>
                                  {statusFormatado.texto}
                                </p>
                                {informacoesTermo?.description && (
                                  <p className={`text-xs mt-1 ${corStatus.text} opacity-90`}>
                                    {informacoesTermo.description}
                                  </p>
                                )}
                              </div>
                              {atualizandoStatus && (
                                <div className="text-xs text-blue-600">
                                  <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                                  Atualizando...
                                </div>
                              )}
                            </div>
                            {/* Botão para atualizar status */}
                            {consultId && apiSelecionada && normalizarCPF(formData.cpf) && normalizarCPF(formData.cpf).length === 11 && (
                              <div className="mt-3 flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={atualizarStatusConsulta}
                                  disabled={atualizandoStatus}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {atualizandoStatus ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Atualizando...
                                    </>
                                  ) : (
                                    <>
                                      <Search className="h-3 w-3 mr-1" />
                                      Atualizar Status
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                      
                      {informacoesTermo?.id && (
                        <p className="text-xs mt-1 text-gray-600">
                          <strong>ID do Termo:</strong> {informacoesTermo.id}
                        </p>
                      )}
                      {/* Link para aceitar o termo (se disponível) */}
                      {(() => {
                        // Tenta obter link da resposta da API primeiro
                        const linkApi = informacoesTermo?.consentUrl || 
                                       informacoesTermo?.url || 
                                       informacoesTermo?.link || 
                                       informacoesTermo?.consent_url || 
                                       informacoesTermo?.signUrl || 
                                       informacoesTermo?.sign_url ||
                                       informacoesTermo?.consentLink ||
                                       informacoesTermo?.consent_link
                        
                        // Se não tiver link na API, constrói usando o padrão da V8 Digital
                        const linkTermo = linkApi || (consultId ? `https://app.v8sistema.com/termos-de-autorizacao/${consultId}` : null)
                        
                        if (linkTermo) {
                          return (
                            <div className="mt-2 p-2 bg-white rounded border border-blue-300">
                              <p className="text-xs font-semibold mb-1">📋 Link para aceitar o termo:</p>
                              <a
                                href={linkTermo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline break-all"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {linkTermo}
                              </a>
                              <p className="text-xs text-gray-600 mt-1">
                                ⚠️ O registro precisa acessar este link para aceitar o termo antes de simular.
                              </p>
                              {!linkApi && (
                                <p className="text-xs text-blue-600 mt-1 italic">
                                  ℹ️ Link gerado automaticamente usando o padrão da V8 Digital
                                </p>
                              )}
                            </div>
                          )
                        }
                        return null
                      })()}
                      {/* Aviso e botão para autorizar se o termo não estiver autorizado */}
                      {(!informacoesTermo?.status || 
                       (informacoesTermo.status.toUpperCase() !== 'CONSENT_APPROVED' && 
                        informacoesTermo.status.toUpperCase() !== 'SUCCESS' &&
                        // Compatibilidade com versões antigas/minúsculas
                        informacoesTermo.status.toLowerCase() !== 'authorized' && 
                        informacoesTermo.status.toLowerCase() !== 'autorizado' &&
                        informacoesTermo.status.toLowerCase() !== 'aprovada' &&
                        informacoesTermo.status.toLowerCase() !== 'approved' &&
                        informacoesTermo.status.toLowerCase() !== 'consent_approved' &&
                        informacoesTermo.status.toLowerCase() !== 'success')) && (
                        <Alert className="mt-2 border-yellow-200 bg-yellow-50">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <AlertDescription className="text-yellow-900 text-xs">
                            <div className="flex items-center justify-between">
                              <span>⚠️ O termo precisa ser autorizado antes de simular. Status atual: <strong>{informacoesTermo?.status || 'não disponível'}</strong></span>
                              <Button
                                type="button"
                                size="sm"
                                onClick={async () => {
                                  if (!consultId || !apiSelecionada) return
                                  setAutorizandoTermo(true)
                                  setErro(null)
                                  try {
                                    const response = await fetch('/api/produto/v8/autorizar-termo', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        apiId: apiSelecionada,
                                        consultId: consultId,
                                      }),
                                    })
                                    
                                    const data = await response.json()
                                    
                                    // Log detalhado para debug
                                    console.log('[CLTSimular] Resposta da autorização:', {
                                      status: response.status,
                                      statusText: response.statusText,
                                      data: data
                                    })
                                    
                                    if (!response.ok) {
                                      throw new Error(data.error || `Erro ${response.status}: ${response.statusText}`)
                                    }
                                    
                                    if (data.success) {
                                      // Atualiza o status localmente primeiro
                                      setInformacoesTermo((prev: any) => ({
                                        ...prev,
                                        status: 'authorized'
                                      }))
                                      
                                      // Recarrega informações do termo da API para garantir dados atualizados
                                      // Primeiro tenta buscar detalhes específicos
                                      setTimeout(async () => {
                                        try {
                                          // Tenta buscar detalhes específicos primeiro
                                          const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${consultId}`)
                                          const detalhesData = await detalhesResponse.json()
                                          
                                          if (detalhesData.success && detalhesData.data) {
                                            setInformacoesTermo(detalhesData.data)
                                            console.log('[CLTSimular] ✅ Informações atualizadas após autorização:', detalhesData.data)
                                            return
                                          }
                                          
                                          // Se não encontrou pelos detalhes, tenta pela listagem
                                          const responseInfo = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${formData.cpf}`)
                                          const dataInfo = await responseInfo.json()
                                          if (dataInfo.success && dataInfo.data) {
                                            if (Array.isArray(dataInfo.data)) {
                                                const termoEncontrado = dataInfo.data.find((t: any) => t.id === consultId || t.consultId === consultId)
                                                if (termoEncontrado) {
                                                  setInformacoesTermo(termoEncontrado)
                                                  console.log('[CLTSimular] Termo atualizado após autorização:', termoEncontrado)
                                                }
                                              } else if (dataInfo.data.id === consultId || dataInfo.data.consultId === consultId) {
                                                setInformacoesTermo(dataInfo.data)
                                                console.log('[CLTSimular] Termo atualizado após autorização:', dataInfo.data)
                                              }
                                            }
                                        } catch (error) {
                                          console.error('[CLTSimular] Erro ao recarregar termo após autorização:', error)
                                        }
                                      }, 1000) // Aguarda 1 segundo para a API processar
                                    } else {
                                      setErro(data.error || 'Erro ao autorizar termo')
                                    }
                                  } catch (error: any) {
                                    setErro(error.message || 'Erro ao autorizar termo')
                                  } finally {
                                    setAutorizandoTermo(false)
                                  }
                                }}
                                disabled={autorizandoTermo || !consultId || !apiSelecionada}
                                className="ml-2 h-7 text-xs"
                              >
                                {autorizandoTermo ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Autorizando...
                                  </>
                                ) : (
                                  'Autorizar Termo'
                                )}
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Verifica se há autorização confirmada */}
                {(() => {
                  const autorizacaoSalva = localStorage.getItem('clt_autorizacao_dados')
                  if (autorizacaoSalva && apiSelecionadaType === 'nossafintech') {
                    try {
                      const autorizacaoData = JSON.parse(autorizacaoSalva)
                      const status = autorizacaoData.status?.toUpperCase()
                      const cpfCorresponde = !autorizacaoData.cpf || autorizacaoData.cpf === formData.cpf
                      
                      if (cpfCorresponde && (status === 'AUTHORIZED' || status === 'AUTORIZADO')) {
                        return (
                          <Alert className="mb-4 border-green-200 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-900">
                              <p className="font-semibold">✅ registro autorizado!</p>
                              <p className="text-sm mt-1">Você pode consultar a margem e simular propostas.</p>
                            </AlertDescription>
                          </Alert>
                        )
                      } else if (cpfCorresponde && (status === 'PENDING' || status === 'PENDENTE')) {
                        return (
                          <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-900">
                              <p className="font-semibold">⏳ Autorização pendente</p>
                              <p className="text-sm mt-1">Aguarde a confirmação do registro via SMS ou marque como autorizado na tela de Autorização.</p>
                            </AlertDescription>
                          </Alert>
                        )
                      } else if (!cpfCorresponde && formData.cpf) {
                        return (
                          <Alert className="mb-4 border-blue-200 bg-blue-50">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-900">
                              <p className="text-sm">💡 Dica: Autorize o registro primeiro na tela de "Autorização CLT" antes de simular.</p>
                            </AlertDescription>
                          </Alert>
                        )
                      }
                    } catch (e) {
                      // Ignora erro
                    }
                  }
                  return null
                })()}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CPF - Sempre visível para todos os bancos */}
                <div>
                  <Label htmlFor="cpf">CPF do registro *</Label>
                  <div className="flex gap-2">
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
                      className="flex-1"
                    />
                    {apiSelecionadaType === 'nossafintech' && (
                      <Button
                        type="button"
                        onClick={consultarMargem}
                        disabled={consultandoMargem || !formData.cpf || formData.cpf.length !== 11}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {consultandoMargem ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Consultando...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Consultar Margem
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {apiSelecionadaType === 'nossafintech' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Clique em "Consultar Margem" para buscar os dados do registro automaticamente
                    </p>
                  )}
                </div>

                {/* CNPJ Empregador - Apenas para Nossa Fintech (opcional, preenchido automaticamente) */}
                {shouldShowCampo('cnpjEmpregador') && (
                  <div>
                    <Label htmlFor="cnpjEmpregador">CNPJ Empregador (Opcional)</Label>
                    <Input
                      id="cnpjEmpregador"
                      value={cnpjEmpregador}
                      onChange={(e) => {
                        const valor = e.target.value.replace(/\D/g, '')
                        if (valor.length <= 14) {
                          setCnpjEmpregador(valor)
                        }
                      }}
                      placeholder="Será preenchido automaticamente"
                      maxLength={14}
                      disabled={!!cnpjEmpregador}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {cnpjEmpregador ? 'Preenchido automaticamente da consulta de margem' : 'Será buscado automaticamente na consulta de margem'}
                    </p>
                  </div>
                )}

                {/* Número de Parcelas - V8 Digital (opcional, select com parcelas disponíveis) */}
                {shouldShowCampo('numeroParcelas') && (
                  <div>
                    <Label htmlFor="numeroParcelas">Número de Parcelas (Opcional)</Label>
                    {(() => {
                      // Obtém as parcelas disponíveis da taxa selecionada
                      const taxaSelecionada = taxasDisponiveis.find(t => t.id === configIdSelecionado)
                      const parcelasDisponiveis = taxaSelecionada && Array.isArray(taxaSelecionada.number_of_installments)
                        ? taxaSelecionada.number_of_installments
                        : []
                      
                      if (parcelasDisponiveis.length > 0) {
                        // Se há parcelas disponíveis, mostra um select
                        return (
                          <>
                            <select
                              id="numeroParcelas"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={formData.numeroParcelas || '0'}
                              onChange={(e) => setFormData({ ...formData, numeroParcelas: e.target.value })}
                              disabled={loading || !configIdSelecionado}
                            >
                              <option value="0">0 - Usar valor máximo disponível</option>
                              {parcelasDisponiveis.map((parcela: number) => (
                                <option key={parcela} value={parcela}>
                                  {parcela} {parcela === 1 ? 'parcela' : 'parcelas'}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Selecione o número de parcelas ou deixe "0" para usar o valor máximo disponível
                            </p>
                          </>
                        )
                      } else {
                        // Se não há parcelas disponíveis, mostra input numérico
                        return (
                          <>
                            <Input
                              id="numeroParcelas"
                              value={formData.numeroParcelas}
                              onChange={(e) => setFormData({ ...formData, numeroParcelas: e.target.value })}
                              type="number"
                              placeholder="0 para usar valor máximo"
                              disabled={loading}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Opcional: deixe 0 ou vazio para usar o valor máximo disponível
                            </p>
                          </>
                        )
                      }
                    })()}
                  </div>
                )}

                {/* Valor Solicitado - V8 Digital (opcional) */}
                {shouldShowCampo('valor') && (
                  <div>
                    <Label htmlFor="valor">Valor Solicitado (Opcional)</Label>
                    <Input
                      id="valor"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      type="number"
                      step="0.01"
                      placeholder="0 para usar valor máximo"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Opcional: deixe 0 ou vazio para usar o valor máximo disponível. Se não informar, informe o valor da parcela.
                    </p>
                  </div>
                )}

                {/* Valor da Parcela - V8 Digital (opcional) */}
                {shouldShowCampo('valorParcela') && (
                  <div>
                    <Label htmlFor="valorParcela">Valor da Parcela (Opcional)</Label>
                    <Input
                      id="valorParcela"
                      value={formData.valorParcela}
                      onChange={(e) => setFormData({ ...formData, valorParcela: e.target.value })}
                      type="number"
                      step="0.01"
                      placeholder="0 para usar valor máximo"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Opcional: informe se não informar o valor solicitado. Deixe 0 ou vazio para usar o valor máximo disponível.
                    </p>
                  </div>
                )}

                {/* Seleção de Taxa - V8 Digital (obrigatório) */}
                {apiSelecionadaType === 'v8digital' && shouldShowCampo('configId') && (
                  <div>
                    <Label htmlFor="configId">Taxa de Simulação *</Label>
                    {carregandoTaxas ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-gray-500">Carregando taxas disponíveis...</span>
                      </div>
                    ) : taxasDisponiveis.length > 0 ? (
                      <select
                        id="configId"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={configIdSelecionado}
                        onChange={(e) => setConfigIdSelecionado(e.target.value)}
                        required
                        disabled={loading}
                      >
                        <option value="">Selecione uma taxa...</option>
                        {taxasDisponiveis.map((taxa) => {
                          const parcelas = Array.isArray(taxa.number_of_installments) 
                            ? taxa.number_of_installments.join(', ') 
                            : (taxa.number_of_installments || 'N/A')
                          return (
                            <option key={taxa.id} value={taxa.id}>
                              {taxa.slug || taxa.id} - Taxa: {taxa.monthly_interest_rate}% a.m. - Parcelas: {parcelas}
                            </option>
                          )
                        })}
                      </select>
                    ) : (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Nenhuma taxa disponível. Verifique se o termo de consentimento foi criado.
                        </AlertDescription>
                      </Alert>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Selecione a taxa de juros para a simulação
                    </p>
                    {/* Mostra parcelas disponíveis da taxa selecionada */}
                    {configIdSelecionado && taxasDisponiveis.length > 0 && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        {(() => {
                          const taxaSelecionada = taxasDisponiveis.find(t => t.id === configIdSelecionado)
                          if (taxaSelecionada) {
                            const parcelas = Array.isArray(taxaSelecionada.number_of_installments)
                              ? taxaSelecionada.number_of_installments
                              : []
                            return (
                              <div>
                                <strong>Parcelas disponíveis:</strong>{' '}
                                {parcelas.length > 0 
                                  ? parcelas.join(', ') + ' parcelas'
                                  : 'Não especificado'}
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Alerta para V8 Digital se não tiver consultId */}
                {apiSelecionadaType === 'v8digital' && !consultId && (
                  <div className="col-span-2">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        ⚠️ Termo de consentimento não encontrado. Por favor, crie o termo de consentimento primeiro na etapa anterior.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Campos específicos para Nossa Fintech */}
                {apiSelecionadaType === 'nossafintech' && (
                  <>
                    {/* Tipo de Simulação */}
                    {shouldShowCampo('simulationType') && (
                      <div>
                        <Label htmlFor="simulationType">Tipo de Simulação *</Label>
                        <select
                          id="simulationType"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={formData.simulationType}
                          onChange={(e) => setFormData({ ...formData, simulationType: e.target.value })}
                          required={isCampoObrigatorio('simulationType')}
                          disabled={loading}
                        >
                          <option value="amount">Por Valor</option>
                          <option value="installments">Por Parcelas</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Escolha se deseja simular por valor ou número de parcelas
                        </p>
                      </div>
                    )}

                    {/* Código da Tabela */}
                    {shouldShowCampo('codTabela') && (
                      <div>
                        <Label htmlFor="codTabela">Código da Tabela *</Label>
                        {carregandoTabelas ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-gray-500">Carregando tabelas...</span>
                          </div>
                        ) : tabelasDisponiveis.length > 0 ? (
                          <select
                            id="codTabela"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.codTabela}
                            onChange={(e) => setFormData({ ...formData, codTabela: e.target.value })}
                            required={isCampoObrigatorio('codTabela')}
                            disabled={loading}
                          >
                            <option value="">Selecione uma tabela...</option>
                            {tabelasDisponiveis.map((tabela: any) => (
                              <option key={tabela.cod_tabela} value={tabela.cod_tabela}>
                                {tabela.name} - {tabela.complement || `${tabela.number_of_installments} parcelas`} ({tabela.cod_tabela})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id="codTabela"
                            value={formData.codTabela}
                            onChange={(e) => setFormData({ ...formData, codTabela: e.target.value })}
                            required={isCampoObrigatorio('codTabela')}
                            placeholder="Ex: 300001"
                          />
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Selecione a tabela de financiamento desejada
                        </p>
                      </div>
                    )}

                    {/* Valor Solicitado (para Nossa Fintech) */}
                    {shouldShowCampo('requestedAmount') && (
                      <div>
                        <Label htmlFor="requestedAmount">Valor Solicitado *</Label>
                        <Input
                          id="requestedAmount"
                          value={formData.requestedAmount}
                          onChange={(e) => setFormData({ ...formData, requestedAmount: e.target.value })}
                          type="number"
                          step="0.01"
                          required={isCampoObrigatorio('requestedAmount')}
                          placeholder={formData.simulationType === 'amount' ? 'Ex: 5000.00' : 'Ex: 12'}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.simulationType === 'amount' 
                            ? 'Valor em R$ que deseja solicitar'
                            : 'Número de parcelas desejadas'}
                        </p>
                      </div>
                    )}
                  </>
                )}
                </div>
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-200" size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Simulando...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Simular Propostas
                </>
              )}
            </Button>
          </form>

          {erro && (
            <Alert 
              variant={isPolicyError ? "default" : "destructive"} 
              className={`mt-4 ${isPolicyError ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : ''}`}
            >
              {isPolicyError ? (
                <Info className="h-4 w-4 text-yellow-600" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription className={isPolicyError ? 'text-yellow-800' : ''}>
                <div>
                  <p className="font-medium">{erro}</p>
                  {isPolicyError && (
                    <div className="mt-2 text-sm text-yellow-700">
                      <p className="font-semibold mb-1">Possíveis motivos:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>registro não atende aos critérios de elegibilidade</li>
                        <li>Margem consignável insuficiente</li>
                        <li>Restrições cadastrais ou de crédito</li>
                        <li>Vínculo de trabalho não permite crédito no momento</li>
                      </ul>
                      <p className="mt-2 italic">Entre em contato com o suporte para mais informações sobre os critérios de aprovação.</p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {simulacoes.length > 0 && (
        <Card className="border-0 shadow-md animate-in fade-in-50 duration-300">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Opções de Simulação</CardTitle>
            <CardDescription>
              {simulacoes.length} opção(ões) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {simulacoes.map((simulacao: any, index: number) => (
                <div key={index} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-md border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {simulacao.tabelaFinanciamento?.descricao || `Opção ${index + 1}`}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Simulação ID: {simulacao.simulacaoId}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {simulacao.opcaoProposta?.numeroParcelas || 0} parcelas
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Valor Margem:
                      </span>
                      <p className="text-lg font-bold text-green-600">
                        {formatarMoeda(simulacao.valorMargem || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Valor Parcela:
                      </span>
                      <p className="text-lg font-bold text-blue-600">
                        {formatarMoeda(simulacao.opcaoProposta?.valorParcela || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Valor Líquido:
                      </span>
                      <p className="text-lg font-bold text-purple-600">
                        {formatarMoeda(simulacao.opcaoProposta?.valorDesembolsoTrabalhador || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Taxa de Juros:</span>
                      <p className="font-semibold">{simulacao.opcaoProposta?.taxaJuros || 0}%</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Com Seguro:</span>
                      <p className="font-semibold">{simulacao.opcaoProposta?.comSeguro ? 'Sim' : 'Não'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Vencimento:
                      </span>
                      <p className="font-semibold">
                        {simulacao.opcaoProposta?.dataDeVencimento
                          ? formatarData(simulacao.opcaoProposta.dataDeVencimento)
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">ID Proposta:</span>
                      <p className="font-mono text-xs break-all">{simulacao.opcaoProposta?.idProposta || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Botão para enviar proposta */}
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={() => {
                        // Salva os dados da simulação selecionada
                        const dadosSimulacao = {
                          cpf: normalizarCPF(formData.cpf),
                          dataDeVencimento: simulacao.opcaoProposta?.dataDeVencimento,
                          valorDesembolsoTrabalhador: simulacao.opcaoProposta?.valorDesembolsoTrabalhador,
                          tabelaFinanciamentoId: simulacao.tabelaFinanciamento?.id,
                          numeroParcelas: simulacao.opcaoProposta?.numeroParcelas,
                          valorParcela: simulacao.opcaoProposta?.valorParcela,
                          simulacaoId: simulacao.simulacaoId,
                          tac: simulacao.tabelaFinanciamento?.tac,
                        }
                        localStorage.setItem('clt_simulacao_selecionada', JSON.stringify(dadosSimulacao))
                        
                        // Dispara evento para mudar de aba
                        window.dispatchEvent(new CustomEvent('mudarAba', { detail: { aba: 'enviar-proposta-clt' } }))
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                      size="lg"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Esta Proposta
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Os dados desta simulação serão preenchidos automaticamente no formulário de envio
                    </p>
                  </div>

                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exibe resultados de múltiplas APIs */}
      {resultadosMultiplasApis.length > 0 && (
        <div className="space-y-6">
          {resultadosMultiplasApis.map((resultadoApi: any) => {
            const simulacoesApi = normalizarSimulacoesApi(resultadoApi.data, resultadoApi.apiType)
            const temSimulacoes = Array.isArray(simulacoesApi) && simulacoesApi.length > 0
            
            return (
              <Card 
                key={resultadoApi.apiId} 
                className={`border-2 ${resultadoApi.success && temSimulacoes ? 'border-green-500' : resultadoApi.success ? 'border-yellow-500' : 'border-red-500'} shadow-md animate-in fade-in-50 duration-300`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        {resultadoApi.apiName}
                        <Badge variant="outline" className={resultadoApi.apiType === 'v8digital' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}>
                          {resultadoApi.apiType === 'v8digital' ? 'V8 Digital' : resultadoApi.apiType === 'nossafintech' ? 'Nossa Fintech' : 'API'}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {resultadoApi.success 
                          ? (temSimulacoes 
                              ? `${simulacoesApi.length} opção(ões) encontrada(s)` 
                              : 'Consulta realizada com sucesso, mas nenhuma simulação disponível')
                          : 'Erro na simulação'}
                      </CardDescription>
                    </div>
                    {resultadoApi.success && temSimulacoes && (
                      <Badge className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Sucesso
                      </Badge>
                    )}
                    {resultadoApi.success && !temSimulacoes && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Sem simulações
                      </Badge>
                    )}
                    {!resultadoApi.success && (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Erro
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!resultadoApi.success && (
                    <Alert variant={resultadoApi.isPolicyError ? "default" : "destructive"} className={resultadoApi.isPolicyError ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : ''}>
                      {resultadoApi.isPolicyError ? (
                        <Info className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <AlertDescription className={resultadoApi.isPolicyError ? 'text-yellow-800' : ''}>
                        {resultadoApi.error || 'Erro ao simular proposta CLT'}
                      </AlertDescription>
                    </Alert>
                  )}

                  {resultadoApi.success && temSimulacoes && (
                    <div className="space-y-4">
                      {simulacoesApi.map((simulacao: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-md border-gray-200">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-lg">
                                {simulacao.tabelaFinanciamento?.descricao || simulacao.descricao || `Opção ${index + 1}`}
                              </h4>
                              {simulacao.simulacaoId && (
                                <p className="text-sm text-gray-500">
                                  Simulação ID: {simulacao.simulacaoId}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {simulacao.opcaoProposta?.numeroParcelas || simulacao.numeroParcelas || 0} parcelas
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {(simulacao.valorMargem || simulacao.valorDisponivel) && (
                              <div>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  Valor Margem:
                                </span>
                                <p className="text-lg font-bold text-green-600">
                                  {formatarMoeda(simulacao.valorMargem || simulacao.valorDisponivel || 0)}
                                </p>
                              </div>
                            )}
                            {(simulacao.opcaoProposta?.valorParcela || simulacao.valorParcela) && (
                              <div>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  Valor Parcela:
                                </span>
                                <p className="text-lg font-bold text-blue-600">
                                  {formatarMoeda(simulacao.opcaoProposta?.valorParcela || simulacao.valorParcela || 0)}
                                </p>
                              </div>
                            )}
                            {(simulacao.opcaoProposta?.valorDesembolsoTrabalhador || simulacao.valorLiquido || simulacao.valorDesembolso) && (
                              <div>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  Valor Líquido:
                                </span>
                                <p className="text-lg font-bold text-purple-600">
                                  {formatarMoeda(simulacao.opcaoProposta?.valorDesembolsoTrabalhador || simulacao.valorLiquido || simulacao.valorDesembolso || 0)}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            {(simulacao.opcaoProposta?.taxaJuros || simulacao.taxaJuros) && (
                              <div>
                                <span className="text-gray-500">Taxa de Juros:</span>
                                <p className="font-semibold">{simulacao.opcaoProposta?.taxaJuros || simulacao.taxaJuros || 0}%</p>
                              </div>
                            )}
                            {(simulacao.opcaoProposta?.comSeguro !== undefined || simulacao.comSeguro !== undefined) && (
                              <div>
                                <span className="text-gray-500">Com Seguro:</span>
                                <p className="font-semibold">{(simulacao.opcaoProposta?.comSeguro || simulacao.comSeguro) ? 'Sim' : 'Não'}</p>
                              </div>
                            )}
                            {(simulacao.opcaoProposta?.dataDeVencimento || simulacao.dataVencimento) && (
                              <div>
                                <span className="text-gray-500 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Vencimento:
                                </span>
                                <p className="font-semibold">
                                  {formatarData(simulacao.opcaoProposta?.dataDeVencimento || simulacao.dataVencimento)}
                                </p>
                              </div>
                            )}
                            {(simulacao.opcaoProposta?.idProposta || simulacao.idProposta) && (
                              <div>
                                <span className="text-gray-500">ID Proposta:</span>
                                <p className="font-mono text-xs break-all">{simulacao.opcaoProposta?.idProposta || simulacao.idProposta || 'N/A'}</p>
                              </div>
                            )}
                          </div>

                          {/* Botão para enviar proposta */}
                          {(simulacao.simulacaoId || simulacao.idProposta) && (
                            <div className="mt-4 pt-4 border-t">
                              <Button
                                onClick={() => {
                                  const dadosSimulacao = {
                                    cpf: normalizarCPF(formData.cpf),
                                    dataDeVencimento: simulacao.opcaoProposta?.dataDeVencimento || simulacao.dataVencimento,
                                    valorDesembolsoTrabalhador: simulacao.opcaoProposta?.valorDesembolsoTrabalhador || simulacao.valorLiquido || simulacao.valorDesembolso,
                                    tabelaFinanciamentoId: simulacao.tabelaFinanciamento?.id || simulacao.tabelaId,
                                    numeroParcelas: simulacao.opcaoProposta?.numeroParcelas || simulacao.numeroParcelas,
                                    valorParcela: simulacao.opcaoProposta?.valorParcela || simulacao.valorParcela,
                                    simulacaoId: simulacao.simulacaoId || simulacao.id,
                                    tac: simulacao.tabelaFinanciamento?.tac || simulacao.tac,
                                    apiId: resultadoApi.apiId,
                                    apiName: resultadoApi.apiName,
                                  }
                                  localStorage.setItem('clt_simulacao_selecionada', JSON.stringify(dadosSimulacao))
                                  
                                  window.dispatchEvent(new CustomEvent('mudarAba', { detail: { aba: 'enviar-proposta-clt' } }))
                                  window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                size="lg"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Enviar Esta Proposta ({resultadoApi.apiName})
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Button>
                              <p className="text-xs text-gray-500 mt-2 text-center">
                                Os dados desta simulação serão preenchidos automaticamente no formulário de envio
                              </p>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

