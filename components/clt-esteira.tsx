"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Loader2, 
  Briefcase, 
  Shield, 
  Search, 
  Calculator, 
  Send, 
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  FileText
} from "lucide-react"
import { ProdutoConsultarCLT } from "@/components/produto-consultar-clt"
import { CLTAutorizar } from "@/components/clt-autorizar"
import { CLTTermoConsentimentoV8 } from "@/components/clt-termo-consentimento-v8"
import { CLTSimular } from "@/components/clt-simular"
import { CLTEnviarProposta } from "@/components/clt-enviar-proposta"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface EtapaStatus {
  id: string
  nome: string
  concluida: boolean
  emProgresso: boolean
  dados?: any
  erro?: string
}

// Etapas base - serão ajustadas dinamicamente conforme o banco
const ETAPAS_BASE = [
  { id: 'consulta', nome: 'Consulta CLT', icon: Search, descricao: 'Consultar vínculos de trabalho' },
  { id: 'autorizacao', nome: 'Autorização', icon: Shield, descricao: 'Criar ou verificar autorização' },
  { id: 'simulacao', nome: 'Simulação', icon: Calculator, descricao: 'Simular propostas' },
  { id: 'proposta', nome: 'Enviar Proposta', icon: Send, descricao: 'Enviar para aprovação' },
]

export function CLTEsteira() {
  const [etapaAtual, setEtapaAtual] = useState<string>('consulta')
  const [etapasStatus, setEtapasStatus] = useState<Record<string, EtapaStatus>>({})
  const [dadosProcesso, setDadosProcesso] = useState<any>({})
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [pausado, setPausado] = useState(false)

  // Obtém o tipo da API selecionada
  const tipoApiSelecionada = apiSelecionada 
    ? apisDisponiveis.find(a => a.id === apiSelecionada)?.type 
    : null

  // Ajusta etapas conforme o banco
  const ETAPAS = ETAPAS_BASE.map(etapa => {
    if (etapa.id === 'autorizacao') {
      // Para V8 Digital, mostra "Termo de Consentimento"
      if (tipoApiSelecionada === 'v8digital') {
        return {
          ...etapa,
          nome: 'Termo de Consentimento',
          icon: FileText,
          descricao: 'Criar termo de consentimento CLT'
        }
      }
      // Para Nossa Fintech, mantém "Autorização"
      return etapa
    }
    return etapa
  })

  // Carrega APIs disponíveis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active)
        setApisDisponiveis(configs)
        if (configs.length > 0) {
          const defaultId = manager.getDefaultApiId() || configs[0].id
          setApiSelecionada(defaultId)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Carrega estado salvo do localStorage
  useEffect(() => {
    const estadoSalvo = localStorage.getItem('clt_esteira_estado')
    if (estadoSalvo) {
      try {
        const estado = JSON.parse(estadoSalvo)
        setEtapasStatus(estado.etapasStatus || {})
        setDadosProcesso(estado.dadosProcesso || {})
        setEtapaAtual(estado.etapaAtual || 'consulta')
        setApiSelecionada(estado.apiSelecionada || '')
        console.log('Estado da esteira restaurado:', estado)
      } catch (error) {
        console.error('Erro ao restaurar estado:', error)
      }
    }
  }, [])

  // Salva estado no localStorage
  useEffect(() => {
    const estado = {
      etapasStatus,
      dadosProcesso,
      etapaAtual,
      apiSelecionada,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('clt_esteira_estado', JSON.stringify(estado))
  }, [etapasStatus, dadosProcesso, etapaAtual, apiSelecionada])

  // Calcula progresso
  const progresso = (Object.values(etapasStatus).filter(e => e.concluida).length / ETAPAS.length) * 100

  // Marca etapa como concluída
  const marcarEtapaConcluida = (etapaId: string, dados?: any) => {
    setEtapasStatus(prev => ({
      ...prev,
      [etapaId]: {
        id: etapaId,
        nome: ETAPAS.find(e => e.id === etapaId)?.nome || etapaId,
        concluida: true,
        emProgresso: false,
        dados,
      }
    }))

    // Atualiza dados do processo
    if (dados) {
      setDadosProcesso((prev: Record<string, any>) => ({
        ...prev,
        [etapaId]: dados
      }))
    }

    // Avança para próxima etapa automaticamente
    const indiceAtual = ETAPAS.findIndex(e => e.id === etapaId)
    if (indiceAtual < ETAPAS.length - 1) {
      const proximaEtapa = ETAPAS[indiceAtual + 1]
      setEtapaAtual(proximaEtapa.id)
    }
  }

  // Marca etapa com erro
  const marcarEtapaErro = (etapaId: string, erro: string) => {
    setEtapasStatus(prev => ({
      ...prev,
      [etapaId]: {
        id: etapaId,
        nome: ETAPAS.find(e => e.id === etapaId)?.nome || etapaId,
        concluida: false,
        emProgresso: false,
        erro,
      }
    }))
  }

  // Reseta a esteira
  const resetarEsteira = () => {
    if (confirm('Tem certeza que deseja reiniciar a esteira? Todos os dados serão perdidos.')) {
      setEtapasStatus({})
      setDadosProcesso({})
      setEtapaAtual('consulta')
      localStorage.removeItem('clt_esteira_estado')
    }
  }

  // Pula para etapa específica (se anteriores estiverem concluídas)
  const irParaEtapa = (etapaId: string) => {
    const indiceEtapa = ETAPAS.findIndex(e => e.id === etapaId)
    const etapasAnteriores = ETAPAS.slice(0, indiceEtapa)
    
    // Verifica se todas as etapas anteriores estão concluídas
    const todasConcluidas = etapasAnteriores.every(e => etapasStatus[e.id]?.concluida)
    
    if (todasConcluidas || indiceEtapa === 0) {
      setEtapaAtual(etapaId)
    } else {
      alert('Complete as etapas anteriores antes de avançar.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Esteira */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-blue-600" />
                Esteira de Processo CLT
              </CardTitle>
              <CardDescription className="mt-2">
                Fluxo completo de consulta, autorização, simulação e envio de proposta
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPausado(!pausado)}
              >
                {pausado ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Continuar
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetarEsteira}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reiniciar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Barra de Progresso */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progresso Geral</span>
              <span className="font-semibold">{Math.round(progresso)}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>

          {/* Etapas */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
            {ETAPAS.map((etapa, index) => {
              const status = etapasStatus[etapa.id]
              const Icon = etapa.icon
              const isAtual = etapaAtual === etapa.id
              const isConcluida = status?.concluida || false
              const temErro = status?.erro ? true : false
              const podeAcessar = index === 0 || ETAPAS.slice(0, index).every(e => etapasStatus[e.id]?.concluida)

              return (
                <div key={etapa.id} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <button
                      onClick={() => podeAcessar && irParaEtapa(etapa.id)}
                      disabled={!podeAcessar && !isConcluida}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all duration-200 min-w-[120px] ${
                        isAtual
                          ? 'bg-blue-100 border-2 border-blue-500 shadow-md'
                          : isConcluida
                          ? 'bg-green-50 border-2 border-green-500 hover:bg-green-100'
                          : temErro
                          ? 'bg-red-50 border-2 border-red-500'
                          : podeAcessar
                          ? 'bg-gray-50 border-2 border-gray-300 hover:bg-gray-100 cursor-pointer'
                          : 'bg-gray-100 border-2 border-gray-200 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className={`p-2 rounded-full ${
                        isAtual
                          ? 'bg-blue-500 text-white'
                          : isConcluida
                          ? 'bg-green-500 text-white'
                          : temErro
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-400 text-white'
                      }`}>
                        {isConcluida ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : status?.emProgresso ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-medium ${
                          isAtual ? 'text-blue-700' : isConcluida ? 'text-green-700' : temErro ? 'text-red-700' : 'text-gray-700'
                        }`}>
                          {etapa.nome}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {etapa.descricao}
                        </div>
                      </div>
                      {isAtual && (
                        <Badge className="bg-blue-600 text-white">Atual</Badge>
                      )}
                    </button>
                  </div>
                  {index < ETAPAS.length - 1 && (
                    <ArrowRight className="h-6 w-6 text-gray-400 mx-2 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Mensagens de erro nas etapas */}
          {Object.values(etapasStatus).some(e => e.erro) && (
            <div className="mt-4 space-y-2">
              {Object.values(etapasStatus).map(status => {
                if (!status.erro) return null
                return (
                  <Alert key={status.id} variant="destructive" className="text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{status.nome}:</strong> {status.erro}
                    </AlertDescription>
                  </Alert>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seleção de API */}
      {!apiSelecionada && (
        <Card>
          <CardContent className="pt-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Selecione o Banco *</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={apiSelecionada}
                onChange={(e) => setApiSelecionada(e.target.value)}
              >
                <option value="">Selecione um banco...</option>
                {apisDisponiveis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.type === 'hubcredito' ? 'HubCredito' : 
                                 api.type === 'presencabank' ? 'Banco Presença' : 
                                 api.type === 'nossafintech' ? 'Nossa Fintech' : 
                                 api.type === 'v8digital' ? 'V8 Digital' : 'Custom'})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo da Etapa Atual */}
      {apiSelecionada && !pausado && (
        <div className="animate-in fade-in-50 duration-300">
          {etapaAtual === 'consulta' && (
            <div>
              <ProdutoConsultarCLT 
                onSuccess={(dados) => {
                  marcarEtapaConcluida('consulta', dados)
                }}
                onError={(erro) => {
                  marcarEtapaErro('consulta', erro)
                }}
                apiId={apiSelecionada}
              />
            </div>
          )}

          {etapaAtual === 'autorizacao' && (
            <div>
              {tipoApiSelecionada === 'v8digital' ? (
                <CLTTermoConsentimentoV8 
                  onSuccess={(dados) => {
                    marcarEtapaConcluida('autorizacao', dados)
                  }}
                  onError={(erro) => {
                    marcarEtapaErro('autorizacao', erro)
                  }}
                  apiId={apiSelecionada}
                  dadosAnteriores={dadosProcesso.consulta}
                />
              ) : (
                <CLTAutorizar 
                  onSuccess={(dados) => {
                    marcarEtapaConcluida('autorizacao', dados)
                  }}
                  onError={(erro) => {
                    marcarEtapaErro('autorizacao', erro)
                  }}
                  apiId={apiSelecionada}
                  dadosAnteriores={dadosProcesso.consulta}
                />
              )}
            </div>
          )}

          {etapaAtual === 'simulacao' && (
            <div>
              <CLTSimular 
                onSuccess={(dados) => {
                  marcarEtapaConcluida('simulacao', dados)
                }}
                onError={(erro) => {
                  marcarEtapaErro('simulacao', erro)
                }}
                apiId={apiSelecionada}
                dadosAnteriores={{
                  ...dadosProcesso.consulta,
                  ...dadosProcesso.autorizacao,
                }}
              />
            </div>
          )}

          {etapaAtual === 'proposta' && (
            <div>
              <CLTEnviarProposta 
                onSuccess={(dados) => {
                  marcarEtapaConcluida('proposta', dados)
                  alert('🎉 Processo concluído com sucesso! Proposta enviada.')
                }}
                onError={(erro) => {
                  marcarEtapaErro('proposta', erro)
                }}
                dadosAnteriores={{
                  ...dadosProcesso.consulta,
                  ...dadosProcesso.autorizacao,
                  ...dadosProcesso.margem,
                  ...dadosProcesso.simulacao,
                }}
              />
            </div>
          )}
        </div>
      )}

      {pausado && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Pause className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Esteira pausada. Clique em "Continuar" para retomar.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
