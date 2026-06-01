"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, CheckCircle2, XCircle, AlertCircle, ExternalLink, AlertCircle as AlertCircleIcon } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface CLTTermoConsentimentoV8Props {
  onSuccess?: (dados: any) => void
  onError?: (erro: string) => void
  apiId?: string
  dadosAnteriores?: any
}

export function CLTTermoConsentimentoV8({ onSuccess, onError, apiId: apiIdProp, dadosAnteriores }: CLTTermoConsentimentoV8Props = {}) {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [apiSelecionada, setApiSelecionada] = useState<string>(apiIdProp || '')
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [autorizandoTermo, setAutorizandoTermo] = useState(false)
  const [formData, setFormData] = useState({
    cpf: dadosAnteriores?.cpf || dadosAnteriores?.cpfTrabalhador || '',
    nome: dadosAnteriores?.nome || dadosAnteriores?.nomeCompleto || '',
    telefone: dadosAnteriores?.telefone || '',
    email: dadosAnteriores?.email || '',
    birthDate: dadosAnteriores?.birthDate || dadosAnteriores?.dataNascimento || '',
    gender: dadosAnteriores?.gender || dadosAnteriores?.genero || 'male',
  })

  // Preenche dados se vierem de etapa anterior
  useEffect(() => {
    if (dadosAnteriores?.cpf || dadosAnteriores?.cpfTrabalhador) {
      setFormData(prev => ({
        ...prev,
        cpf: dadosAnteriores.cpf || dadosAnteriores.cpfTrabalhador || prev.cpf,
        nome: dadosAnteriores.nome || dadosAnteriores.nomeCompleto || prev.nome,
        telefone: dadosAnteriores.telefone || prev.telefone,
        email: dadosAnteriores.email || prev.email,
        birthDate: dadosAnteriores.birthDate || dadosAnteriores.dataNascimento || prev.birthDate,
        gender: dadosAnteriores.gender || dadosAnteriores.genero || prev.gender,
      }))
    }
    if (apiIdProp) {
      setApiSelecionada(apiIdProp)
    }
  }, [dadosAnteriores, apiIdProp])

  // Carrega APIs disponíveis (apenas V8 Digital)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active && c.type === 'v8digital')
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Função para criar termo de consentimento
  const criarTermo = async () => {
    if (!formData.cpf || formData.cpf.trim() === '') {
      setErro('CPF é obrigatório')
      return
    }

    // Normaliza CPF: remove formatação e preenche com zeros à esquerda se necessário
    let cpfNormalizado = formData.cpf.replace(/\D/g, '')
    if (cpfNormalizado.length > 0 && cpfNormalizado.length < 11) {
      cpfNormalizado = cpfNormalizado.padStart(11, '0')
    }
    if (cpfNormalizado.length > 11) {
      cpfNormalizado = cpfNormalizado.slice(-11)
    }
    if (cpfNormalizado.length !== 11) {
      setErro('CPF inválido: deve ter 11 dígitos')
      return
    }

    if (!formData.nome || formData.nome.trim() === '') {
      setErro('Nome completo é obrigatório')
      return
    }

    if (!formData.email || formData.email.trim() === '') {
      setErro('Email é obrigatório')
      return
    }

    if (!formData.telefone || formData.telefone.trim() === '') {
      setErro('Telefone é obrigatório')
      return
    }

    if (!formData.birthDate || formData.birthDate.trim() === '') {
      setErro('Data de nascimento é obrigatória no formato YYYY-MM-DD')
      return
    }

    // Valida formato da data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(formData.birthDate)) {
      setErro('Data de nascimento deve estar no formato YYYY-MM-DD (ex: 1990-01-15)')
      return
    }

    if (!apiSelecionada) {
      setErro('Selecione uma API V8 Digital')
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const response = await fetch('/api/produto/v8/termo-consentimento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cpfNormalizado,
          nome: formData.nome,
          telefone: formData.telefone,
          email: formData.email,
          birthDate: formData.birthDate,
          gender: formData.gender,
          apiId: apiSelecionada,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        // Tenta extrair mensagem de erro mais detalhada
        let errorMessage = data.error || `Erro ${response.status}: ${response.statusText || 'Erro ao criar termo de consentimento'}`
        
        // Se for erro 422, tenta mostrar detalhes adicionais
        if (response.status === 422) {
          if (data.data) {
            if (typeof data.data === 'object') {
              const errorDetails = Object.entries(data.data)
                .map(([key, value]) => {
                  if (Array.isArray(value)) {
                    return `${key}: ${value.join(', ')}`
                  }
                  return `${key}: ${value}`
                })
                .join(' | ')
              if (errorDetails) {
                errorMessage = `${errorMessage}\n\nDetalhes: ${errorDetails}`
              }
            } else if (typeof data.data === 'string') {
              errorMessage = `${errorMessage}\n\n${data.data}`
            }
          }
          
          // Mensagem adicional para erro 422
          errorMessage = `${errorMessage}\n\nVerifique se todos os campos estão preenchidos corretamente:\n- CPF (11 dígitos)\n- Nome completo\n- Data de nascimento (YYYY-MM-DD)\n- Gênero (Masculino/Feminino)\n- Telefone com DDD\n- Email válido`
        }
        
        throw new Error(errorMessage)
      }

      setResultado(data.data)
      
      // Log da resposta completa para verificar se há link
      console.log('[CLTTermoConsentimentoV8] Resposta completa da API:', JSON.stringify(data.data, null, 2))
      console.log('[CLTTermoConsentimentoV8] Chaves disponíveis na resposta:', Object.keys(data.data || {}))
      
      // Se a resposta só tem o ID, tenta buscar detalhes completos do termo
      let termoCompleto = data.data
      if (data.data?.id && !data.data?.consentUrl && !data.data?.url && !data.data?.link) {
        console.log('[CLTTermoConsentimentoV8] Resposta só contém ID, buscando detalhes completos...')
        try {
          const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${data.data.id}`)
          if (detalhesResponse.ok) {
            const detalhesData = await detalhesResponse.json()
            if (detalhesData.success && detalhesData.data) {
              termoCompleto = detalhesData.data
              console.log('[CLTTermoConsentimentoV8] Detalhes completos obtidos:', JSON.stringify(termoCompleto, null, 2))
            }
          }
        } catch (error) {
          console.log('[CLTTermoConsentimentoV8] Erro ao buscar detalhes:', error)
        }
      }
      
      // Verifica se há link na resposta
      const linkTermo = termoCompleto?.consentUrl || 
                       termoCompleto?.url || 
                       termoCompleto?.link || 
                       termoCompleto?.consent_url || 
                       termoCompleto?.signUrl || 
                       termoCompleto?.sign_url ||
                       termoCompleto?.consentLink ||
                       termoCompleto?.consent_link
      if (linkTermo) {
        console.log('[CLTTermoConsentimentoV8] ✅ Link de consentimento encontrado:', linkTermo)
      } else {
        console.log('[CLTTermoConsentimentoV8] ⚠️ Link de consentimento não encontrado. Tentando construir link baseado no ID...')
        // Se não houver link, tenta construir um link padrão (caso a V8 use um padrão)
        // Isso é uma tentativa - pode não funcionar se a V8 não usar esse padrão
        if (termoCompleto?.id) {
          console.log('[CLTTermoConsentimentoV8] ID do termo:', termoCompleto.id)
        }
      }
      
      // Salva no localStorage com os dados completos
      const dadosTermo = {
        apiId: apiSelecionada,
        cpf: formData.cpf,
        nome: formData.nome,
        telefone: formData.telefone,
        email: formData.email,
        termoData: termoCompleto,
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('clt_termo_consentimento_v8', JSON.stringify(dadosTermo))
      
      // Atualiza o resultado com os dados completos
      setResultado(termoCompleto)
      
      // Autoriza automaticamente o termo após criação
      if (termoCompleto?.id && apiSelecionada) {
        console.log('[CLTTermoConsentimentoV8] Autorizando termo automaticamente após criação...')
        setAutorizandoTermo(true)
        
        setTimeout(async () => {
          try {
            const autorizarResponse = await fetch('/api/produto/v8/autorizar-termo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apiId: apiSelecionada,
                consultId: termoCompleto.id,
              }),
            })
            
            const autorizarData = await autorizarResponse.json()
            
            if (autorizarData.success) {
              console.log('[CLTTermoConsentimentoV8] ✅ Termo autorizado automaticamente com sucesso!')
              // Atualiza o resultado com o status autorizado
              const novoStatus = 'authorized' // ou 'autorizado' dependendo do que a API retornar
              setResultado((prev: any) => ({
                ...prev,
                status: novoStatus
              }))
              
              // Atualiza o localStorage
              const termoAtualizado = {
                ...dadosTermo,
                termoData: {
                  ...termoCompleto,
                  status: novoStatus
                }
              }
              localStorage.setItem('clt_termo_consentimento_v8', JSON.stringify(termoAtualizado))
            } else {
              console.log('[CLTTermoConsentimentoV8] ⚠️ Não foi possível autorizar automaticamente:', autorizarData.error)
              console.log('[CLTTermoConsentimentoV8] O termo pode precisar ser autorizado manualmente através do link')
            }
          } catch (error: any) {
            console.log('[CLTTermoConsentimentoV8] ⚠️ Erro ao autorizar automaticamente:', error.message)
            console.log('[CLTTermoConsentimentoV8] O termo pode precisar ser autorizado manualmente através do link')
          } finally {
            setAutorizandoTermo(false)
          }
        }, 1000) // Aguarda 1 segundo após criar o termo para tentar autorizar
      }

      if (onSuccess) {
        onSuccess(dadosTermo)
      }
    } catch (error: any) {
      const mensagemErro = error.message || 'Erro ao criar termo de consentimento'
      setErro(mensagemErro)
      if (onError) {
        onError(mensagemErro)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Termo de Consentimento CLT - V8 Digital
        </CardTitle>
        <CardDescription>
          Crie o termo de consentimento necessário para prosseguir com a simulação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seleção de API */}
        {apisDisponiveis.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="api">Banco *</Label>
            <select
              id="api"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={apiSelecionada}
              onChange={(e) => setApiSelecionada(e.target.value)}
            >
              <option value="">Selecione um banco...</option>
              {apisDisponiveis.map((api) => (
                <option key={api.id} value={api.id}>
                  {api.name} (V8 Digital)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Formulário */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              type="text"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              type="text"
              placeholder="Nome completo do registro"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Data de Nascimento *</Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
              disabled={loading}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500">Formato: YYYY-MM-DD (ex: 1990-01-15)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gênero *</Label>
            <select
              id="gender"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.gender}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              disabled={loading}
            >
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone/Celular *</Label>
            <Input
              id="telefone"
              type="text"
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={loading}
            />
          </div>
        </div>

        {/* Mensagens de erro */}
        {erro && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {/* Resultado */}
        {resultado && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="font-semibold mb-2">Termo de consentimento criado com sucesso!</div>
              {resultado.id && (
                <div className="text-sm mb-2">
                  <strong>ID do Termo:</strong> {resultado.id}
                </div>
              )}
              {resultado.status && (
                <div className="text-sm mb-2">
                  <strong>Status:</strong> <Badge variant="outline" className="ml-1">{resultado.status}</Badge>
                </div>
              )}
              {autorizandoTermo && (
                <div className="text-xs mb-2 text-blue-600 italic flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Autorizando termo automaticamente...
                </div>
              )}
              {/* Link para aceitar o termo */}
              {(() => {
                // Tenta obter link da resposta da API primeiro
                const linkApi = resultado.consentUrl || 
                               resultado.url || 
                               resultado.link || 
                               resultado.consent_url || 
                               resultado.signUrl || 
                               resultado.sign_url ||
                               resultado.consentLink ||
                               resultado.consent_link
                
                // Se não tiver link na API, constrói usando o padrão da V8 Digital
                const linkTermo = linkApi || (resultado.id ? `https://app.v8sistema.com/termos-de-autorizacao/${resultado.id}` : null)
                
                if (linkTermo) {
                  return (
                    <div className="mt-3 p-3 bg-white rounded border border-green-300">
                      <p className="text-sm font-semibold mb-2">📋 Link para aceitar o termo:</p>
                      <a
                        href={linkTermo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {linkTermo}
                      </a>
                      <p className="text-xs text-gray-600 mt-2">
                        ⚠️ O termo está sendo autorizado automaticamente. Se necessário, o registro pode acessar este link para aceitar o termo de consentimento.
                      </p>
                      {!linkApi && (
                        <p className="text-xs text-blue-600 mt-1 italic">
                          ℹ️ Link gerado automaticamente usando o padrão da V8 Digital
                        </p>
                      )}
                      {autorizandoTermo && (
                        <p className="text-xs text-blue-600 mt-1 italic flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Autorizando automaticamente...
                        </p>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-300">
                      <p className="text-sm font-semibold mb-2 text-yellow-800">ℹ️ Informação sobre o link de consentimento:</p>
                      <p className="text-xs text-yellow-700">
                        Não foi possível gerar o link de consentimento. O link pode ser enviado por email ou SMS para o registro.
                        <br />
                        <strong>ID do Termo:</strong> {resultado.id || 'não disponível'}
                        <br />
                        <br />
                        Você pode verificar o status do termo e obter mais informações na tela de simulação.
                      </p>
                    </div>
                  )
                }
              })()}
            </AlertDescription>
          </Alert>
        )}

        {/* Botão de ação */}
        <div className="flex gap-2">
          <Button
            onClick={criarTermo}
            disabled={loading || !formData.cpf || !formData.nome || !formData.email || !formData.telefone || !formData.birthDate || !apiSelecionada}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando termo...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Criar Termo de Consentimento
              </>
            )}
          </Button>
        </div>

        {/* Informações adicionais */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Campos marcados com * são obrigatórios</p>
          <p>• A data de nascimento deve estar no formato YYYY-MM-DD</p>
          <p>• O termo será salvo automaticamente após a criação</p>
        </div>
      </CardContent>
    </Card>
  )
}
