"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Settings, Loader2, CheckCircle2, XCircle, Globe, Key, Shield, Plus, Trash2, Edit2, Star, StarOff } from "lucide-react"
import { getApiManager, type ApiConfig as ApiConfigType } from "@/lib/api-manager"

export function ProdutoApiConfig() {
  const [apis, setApis] = useState<ApiConfigType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; connected: boolean; message: string } | null>(null)
  const [defaultApiId, setDefaultApiId] = useState<string | null>(null)
  
  // Form para nova API
  const [newApi, setNewApi] = useState({
    name: "",
    baseUrl: "",
    username: "",
    ******: "",
    type: 'nossafintech' as ApiConfigType['type'],
    promotId: "",
    clientId: "",
    clientSecret: "",
    authUrl: "",
    audience: "",
  })
  
  // Form para edição
  const [editApi, setEditApi] = useState({
    name: "",
    baseUrl: "",
    username: "",
    ******: "",
    type: 'nossafintech' as ApiConfigType['type'],
    promotId: "",
    clientId: "",
    clientSecret: "",
    authUrl: "",
    audience: "",
  })

  useEffect(() => {
    // Força a inicialização do ApiManager se ainda não foi feito
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        // Se não há configurações salvas, força o carregamento da padrão
        const configs = manager.getConfigs()
        if (configs.length === 0) {
          // Recarrega para garantir que a API padrão seja criada
          const newManager = getApiManager()
          const newConfigs = newManager.getConfigs()
          if (newConfigs.length > 0) {
            setApis(newConfigs)
            setDefaultApiId(newManager.getDefaultApiId())
            setLoading(false)
            return
          }
        }
      } catch (error) {
        console.error('Erro ao inicializar ApiManager:', error)
      }
    }
    loadApis()
  }, [])

  const loadApis = () => {
    try {
      if (typeof window === 'undefined') {
        setLoading(false)
        return
      }
      const manager = getApiManager()
      const configs = manager.getConfigs()
      setApis(configs)
      setDefaultApiId(manager.getDefaultApiId())
    } catch (error) {
      console.error("Erro ao carregar APIs:", error)
      // Em caso de erro, define array vazio
      setApis([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddApi = async () => {
    if (!newApi.name || !newApi.baseUrl) {
      alert('Nome e URL Base são obrigatórios')
      return
    }

    if (newApi.type === 'credspot') {
      if (!newApi.clientId?.trim() || !newApi.clientSecret?.trim()) {
        alert('CredSpot Partner API: informe Client ID e Client Secret (painel CredSpot → API Key).')
        return
      }
    }
    if (newApi.type === 'v8digital') {
      if (!newApi.clientId?.trim() || !newApi.audience?.trim()) {
        alert('V8 Digital: informe Client ID e Audience.')
        return
      }
    }

    try {
      const manager = getApiManager()
      let baseUrl = newApi.baseUrl.trim()
      if (newApi.type === 'facta') {
        baseUrl = baseUrl.replace(/\/gera-token\/?$/i, '').replace(/\/$/, '')
      }
      const config: any = {
        name: newApi.name,
        baseUrl,
        username: newApi.username || undefined,
        ******: newApi.****** || undefined,
        active: true,
        type: newApi.type
      }

      if (newApi.type === 'credspot' || newApi.type === 'v8digital') {
        config.clientId = newApi.clientId?.trim() || undefined
        config.clientSecret = newApi.clientSecret?.trim() || undefined
        config.authUrl =
          newApi.authUrl?.trim() ||
          (newApi.type === 'credspot' ? 'https://auth.credspot.net/oauth/token' : undefined)
        if (newApi.audience?.trim()) {
          let aud = newApi.audience.trim()
          if (!aud.endsWith('/')) aud = `${aud}/`
          config.audience = aud
        } else if (newApi.type === 'credspot') {
          config.audience = 'https://api.credspot.net/'
        }
      }
      
      // Adiciona promotId se for Nossa Fintech
      if (newApi.type === 'nossafintech' && newApi.promotId) {
        config.promotId = newApi.promotId.trim() ? (parseInt(newApi.promotId) || newApi.promotId) : undefined
      }
      
      const id = manager.addConfig(config)

      loadApis()
      setNewApi({ name: "", baseUrl: "", username: "", ******: "", type: 'nossafintech' as ApiConfigType['type'], promotId: "", clientId: "", clientSecret: "", authUrl: "", audience: "" })
      alert('API adicionada com sucesso!')
    } catch (error: any) {
      alert(`Erro ao adicionar API: ${error.message}`)
    }
  }

  const handleUpdateApi = (id: string) => {
    try {
      const manager = getApiManager()
      let baseUrl = editApi.baseUrl.trim()
      // Facta: URL base deve ser só o host; o registro adiciona /gera-token
      if (editApi.type === 'facta') {
        baseUrl = baseUrl.replace(/\/gera-token\/?$/i, '').replace(/\/$/, '')
      }
      const updates: any = {
        name: editApi.name,
        baseUrl,
        username: editApi.username || undefined,
        ******: editApi.****** || undefined,
        type: editApi.type
      }
      
      if (editApi.type === 'v8digital' || editApi.type === 'credspot') {
        if (editApi.clientId?.trim()) updates.clientId = editApi.clientId.trim()
        if (editApi.clientSecret?.trim()) updates.clientSecret = editApi.clientSecret.trim()
        if (editApi.authUrl?.trim()) updates.authUrl = editApi.authUrl.trim()
        if (editApi.audience?.trim()) {
          let aud = editApi.audience.trim()
          if (!aud.endsWith('/')) aud = `${aud}/`
          updates.audience = aud
        } else if (editApi.type === 'credspot') {
          updates.audience = 'https://api.credspot.net/'
        }
      }
      
      // Adiciona promotId se for Nossa Fintech
      if (editApi.type === 'nossafintech') {
        const promotIdValue = editApi.promotId.trim() ? (parseInt(editApi.promotId) || editApi.promotId) : undefined
        updates.promotId = promotIdValue
        console.log('[ProdutoApiConfig] Salvando Promot ID:', promotIdValue, 'para API:', id)
      }
      
      const updated = manager.updateConfig(id, updates)

      if (updated) {
        // Recarrega as APIs para garantir que temos os dados mais recentes
        loadApis()
        
        // Verifica se o promotId foi salvo corretamente
        const savedConfig = manager.getConfig(id)
        if (editApi.type === 'nossafintech') {
          console.log('[ProdutoApiConfig] Verificando após salvar. Promot ID salvo:', (savedConfig as any)?.promotId)
        }
        
        setEditingId(null)
        setEditApi({ name: "", baseUrl: "", username: "", ******: "", type: 'nossafintech' as ApiConfigType['type'], promotId: "", clientId: "", clientSecret: "", authUrl: "", audience: "" })
        alert('API atualizada com sucesso!')
      }
    } catch (error: any) {
      alert(`Erro ao atualizar API: ${error.message}`)
    }
  }

  const handleDeleteApi = (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta API?')) {
      return
    }

    try {
      const manager = getApiManager()
      const deleted = manager.removeConfig(id)
      
      if (deleted) {
        loadApis()
        alert('API removida com sucesso!')
      } else {
        alert('Não é possível remover a última API configurada.')
      }
    } catch (error: any) {
      alert(`Erro ao remover API: ${error.message}`)
    }
  }

  const handleSetDefault = (id: string) => {
    try {
      const manager = getApiManager()
      manager.setDefaultApi(id)
      loadApis()
      alert('API padrão definida com sucesso!')
    } catch (error: any) {
      alert(`Erro ao definir API padrão: ${error.message}`)
    }
  }

  const handleTestApi = async (id: string) => {
    setTestingId(id)
    setTestResult(null)

    try {
      const manager = getApiManager()
      // Usa getConfig diretamente do manager para garantir dados atualizados
      const updatedConfig = manager.getConfig(id)
      if (!updatedConfig) {
        setTestResult({ id, connected: false, message: 'Configuração não encontrada' })
        return
      }

      console.log('[ProdutoApiConfig] Config encontrada para teste:', {
        id: updatedConfig.id,
        type: updatedConfig.type,
        username: updatedConfig.username,
        promotId: (updatedConfig as any).promotId
      })

      // Força recriação do client para garantir credenciais atualizadas
      const freshClient = manager.getClient(id, true) // forceRecreate = true
      
      // Garante que as credenciais estão atualizadas no client (especialmente para Nossa Fintech e V8 Digital)
      if (updatedConfig.type === 'nossafintech' && updatedConfig.username && updatedConfig.****** && 'updateCredentials' in freshClient) {
        const nossaClient = freshClient as any
        // Obtém o promotId da configuração atualizada
        const promotId = (updatedConfig as any).promotId
        console.log('[ProdutoApiConfig] Atualizando credenciais Nossa Fintech.')
        console.log('[ProdutoApiConfig] Promot ID da updatedConfig:', (updatedConfig as any).promotId)
        console.log('[ProdutoApiConfig] Promot ID final:', promotId)
        nossaClient.updateCredentials(
          updatedConfig.username,
          updatedConfig.******,
          updatedConfig.baseUrl,
          promotId
        )
      } else if (updatedConfig.type === 'v8digital' && updatedConfig.username && updatedConfig.****** && 'updateCredentials' in freshClient) {
        const v8Client = freshClient as any
        const clientId = (updatedConfig as any).clientId
        const authUrl = (updatedConfig as any).authUrl
        const audience = (updatedConfig as any).audience
        const clientSecret = (updatedConfig as any).clientSecret
        console.log('[ProdutoApiConfig] Atualizando credenciais V8 Digital.')
        console.log('[ProdutoApiConfig] Client ID:', clientId)
        console.log('[ProdutoApiConfig] Auth URL:', authUrl)
        v8Client.updateCredentials(
          updatedConfig.username,
          updatedConfig.******,
          updatedConfig.baseUrl,
          authUrl,
          clientId,
          clientSecret,
          audience
        )
      } else if (updatedConfig.type === 'credspot' && 'updateCredentials' in freshClient) {
        const credspotClient = freshClient as any
        const clientId = (updatedConfig as any).clientId
        const clientSecret = (updatedConfig as any).clientSecret
        const authUrl = (updatedConfig as any).authUrl
        const audience = (updatedConfig as any).audience
        console.log('[ProdutoApiConfig] Atualizando credenciais CredSpot.')
        console.log('[ProdutoApiConfig] Client ID:', clientId)
        console.log('[ProdutoApiConfig] Auth URL:', authUrl)
        console.log('[ProdutoApiConfig] Audience:', audience)
        credspotClient.updateCredentials(
          clientId,
          clientSecret,
          updatedConfig.baseUrl,
          authUrl,
          audience
        )
      } else if (updatedConfig.type === 'c6bank') {
        // C6 Bank precisa ser testado via API route (servidor) para evitar CORS
        // Não atualiza credenciais aqui, a rota de API fará isso
        const response = await fetch('/api/produto/c6bank/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiId: id
          }),
        })

        const apiResult = await response.json()
        
        setTestResult({
          id,
          connected: apiResult.success && apiResult.data?.connected !== false,
          message: apiResult.data?.message || apiResult.error || (apiResult.success ? 'Conexão bem-sucedida!' : 'Erro ao testar conexão')
        })
        setTestingId(null)
        return
      } else if (updatedConfig.type === 'facta') {
        // Facta também deve ser testada via API route para evitar CORS no navegador
        const response = await fetch('/api/produto/facta/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiId: id,
          }),
        })

        const apiResult = await response.json()

        setTestResult({
          id,
          connected: apiResult.success && apiResult.data?.connected !== false,
          message:
            apiResult.data?.message ||
            apiResult.error ||
            (apiResult.success ? 'Conexão bem-sucedida!' : 'Erro ao testar conexão'),
        })
        setTestingId(null)
        return
      }
      
      const result = await freshClient.testConnection()

        // Extrai mensagem do data se disponível, senão usa error ou mensagem padrão
        // O tipo de retorno pode variar entre APIs, então tratamos ambos os casos
        let message = 'Erro desconhecido'
        let connected = false
        
        if (typeof result.data === 'object' && result.data !== null && 'message' in result.data) {
          message = (result.data as any).message || result.error || (result.success ? 'Conexão bem-sucedida!' : 'Erro desconhecido')
          connected = result.success && (result.data as any).connected !== false
        } else if (typeof result.data === 'boolean') {
          connected = result.data
          message = result.data ? 'Conexão bem-sucedida!' : (result.error || 'Erro ao conectar')
        } else {
          message = result.error || (result.success ? 'Conexão bem-sucedida!' : 'Erro desconhecido')
          connected = result.success || false
        }

      setTestResult({
        id,
        connected,
        message
      })
    } catch (error: any) {
      setTestResult({
        id,
        connected: false,
        message: error.message || 'Erro ao testar conexão'
      })
    } finally {
      setTestingId(null)
    }
  }

  const startEdit = (api: ApiConfigType) => {
    setEditingId(api.id)
    setEditApi({
      name: api.name,
      baseUrl: api.baseUrl,
      username: api.username || "",
      ******: "",
      type: api.type || 'nossafintech',
      promotId: (api as any).promotId ? String((api as any).promotId) : '',
      clientId: (api as any).clientId || "",
      clientSecret: "",
      authUrl: (api as any).authUrl || "",
      audience: (api as any).audience || "",
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="h-5 w-5 text-gray-600" />
            </div>
            Gerenciar APIs
          </CardTitle>
          <CardDescription className="mt-2">
            Configure e gerencie múltiplas APIs no sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lista de APIs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">APIs Configuradas</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{apis.length} API(s)</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Força recarregar as APIs padrão
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('api_configs')
                      window.location.reload()
                    }
                  }}
                  title="Recarregar APIs padrão"
                >
                  Recarregar APIs Padrão
                </Button>
              </div>
            </div>

            {apis.map((api) => (
              <Card key={api.id} className={api.id === defaultApiId ? "border-2 border-blue-500" : ""}>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg">{api.name}</h4>
                          {api.id === defaultApiId && (
                            <Badge className="bg-blue-600">
                              <Star className="h-3 w-3 mr-1" />
                              Padrão
                            </Badge>
                          )}
                          {api.active && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Ativa
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span className="font-mono text-xs">{api.baseUrl}</span>
                          </div>
                          {api.username && (
                            <div className="flex items-center gap-2">
                              <Key className="h-4 w-4" />
                              <span>{api.username}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <Badge variant="outline">
                              {api.type === 'v8digital' ? 'V8 Digital' : 
                               api.type === 'nossafintech' ? 'Nossa Fintech' : 
                               api.type === 'credspot' ? 'CredSpot' :
                               api.type === 'presencabank' ? 'Presença Bank' :
                               api.type === 'c6bank' ? 'C6 Bank' :
                               api.type === 'hubcredito' ? 'Hub Crédito' :
                               'Custom'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {api.id !== defaultApiId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetDefault(api.id)}
                            title="Definir como padrão"
                          >
                            <StarOff className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestApi(api.id)}
                          disabled={testingId === api.id}
                        >
                          {testingId === api.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Testar"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(api)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {apis.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteApi(api.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {editingId === api.id && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3 border-2 border-blue-200">
                        <h5 className="font-semibold">Editar API</h5>
                        <div>
                          <Label>Nome</Label>
                          <Input
                            value={editApi.name}
                            onChange={(e) => setEditApi({ ...editApi, name: e.target.value })}
                            placeholder="Nome da API"
                          />
                        </div>
                        <div>
                          <Label>URL Base</Label>
                          <Input
                            value={editApi.baseUrl}
                            onChange={(e) => setEditApi({ ...editApi, baseUrl: e.target.value })}
                            placeholder="https://api.exemplo.com.br/api"
                          />
                        </div>
                        <div>
                          <Label>{editApi.type === 'nossafintech' ? 'CPF *' : 'Username'}</Label>
                          <Input
                            value={editApi.username}
                            onChange={(e) => setEditApi({ ...editApi, username: e.target.value })}
                            placeholder={editApi.type === 'nossafintech' ? 'CPF do usuário' : 'Username (opcional)'}
                          />
                          {editApi.type === 'nossafintech' && (
                            <p className="text-xs text-gray-500 mt-1">
                              CPF usado para autenticação na Nossa Fintech
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Tipo de API</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={editApi.type}
                            onChange={(e) => setEditApi({ ...editApi, type: e.target.value as ApiConfigType['type'] })}
                          >
                            <option value="nossafintech">Nossa Fintech</option>
                            <option value="v8digital">V8 Digital</option>
                            <option value="credspot">CredSpot</option>
                            <option value="presencabank">Presença Bank</option>
                            <option value="c6bank">C6 Bank</option>
                            <option value="facta">Facta</option>
                            <option value="hubcredito">Hub Crédito</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div>
                          <Label>******</Label>
                          <Input
                            type="******"
                            value={editApi.******}
                            onChange={(e) => setEditApi({ ...editApi, ******: e.target.value })}
                            placeholder="****** (deixe vazio para manter a atual)"
                          />
                        </div>
                        {editApi.type === 'nossafintech' && (
                          <div>
                            <Label>Promot ID *</Label>
                            <Input
                              value={editApi.promotId}
                              onChange={(e) => setEditApi({ ...editApi, promotId: e.target.value })}
                              placeholder="ID da Promotora (ex: 123456)"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Obrigatório para autenticação na Nossa Fintech
                            </p>
                          </div>
                        )}
                        {(editApi.type === 'credspot' || editApi.type === 'v8digital') && (
                          <div className="space-y-3 p-3 bg-emerald-50/80 rounded-md border border-emerald-100">
                            <p className="text-sm font-medium text-emerald-900">
                              {editApi.type === 'credspot' ? 'CredSpot Partner API (OAuth2)' : 'V8 Digital (OAuth2)'}
                            </p>
                            <div>
                              <Label>Client ID *</Label>
                              <Input
                                value={editApi.clientId}
                                onChange={(e) => setEditApi({ ...editApi, clientId: e.target.value })}
                                placeholder="Client ID do painel"
                                className="font-mono text-xs"
                              />
                            </div>
                            <div>
                              <Label>Client Secret {editApi.type === 'credspot' ? '*' : ''}</Label>
                              <Input
                                type="******"
                                value={editApi.clientSecret}
                                onChange={(e) => setEditApi({ ...editApi, clientSecret: e.target.value })}
                                placeholder="Deixe em branco para manter o secret já salvo"
                                className="font-mono text-xs"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                CredSpot: rotacione no painel se perdeu o secret. V8: preencha se for a primeira vez ou ao trocar.
                              </p>
                            </div>
                            <div>
                              <Label>Auth URL (OAuth token)</Label>
                              <Input
                                value={editApi.authUrl}
                                onChange={(e) => setEditApi({ ...editApi, authUrl: e.target.value })}
                                placeholder={editApi.type === 'credspot' ? 'https://auth.credspot.net/oauth/token' : 'https://auth.v8sistema.com/oauth/token'}
                                className="font-mono text-xs"
                              />
                            </div>
                            <div>
                              <Label>Audience *</Label>
                              <Input
                                value={editApi.audience}
                                onChange={(e) => setEditApi({ ...editApi, audience: e.target.value })}
                                placeholder={editApi.type === 'credspot' ? 'https://api.credspot.net/' : 'https://bff.v8sistema.com'}
                                className="font-mono text-xs"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                CredSpot: use exatamente <code className="bg-white px-1 rounded">https://api.credspot.net/</code> (com barra final), conforme a documentação oficial.
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={() => handleUpdateApi(api.id)}>Salvar</Button>
                          <Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}

                    {testResult && testResult.id === api.id && (
                      <Alert variant={testResult.connected ? "default" : "destructive"}>
                        {testResult.connected ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>
                          {testResult.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          {/* Adicionar Nova API */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Adicionar Nova API</h3>
            <div className="p-4 bg-gray-50 rounded-lg space-y-3 border-2 border-dashed border-gray-300">
              <div>
                <Label>Nome da API</Label>
                <Input
                  value={newApi.name}
                  onChange={(e) => setNewApi({ ...newApi, name: e.target.value })}
                  placeholder="Ex: HubCredito Produção, HubCredito Teste, etc."
                />
              </div>
              <div>
                <Label>Tipo de API</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newApi.type}
                  onChange={(e) => setNewApi({ ...newApi, type: e.target.value as ApiConfigType['type'] })}
                >
                  <option value="nossafintech">Nossa Fintech</option>
                  <option value="v8digital">V8 Digital</option>
                  <option value="credspot">CredSpot</option>
                  <option value="presencabank">Presença Bank</option>
                  <option value="c6bank">C6 Bank</option>
                  <option value="facta">Facta</option>
                  <option value="hubcredito">Hub Crédito</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <Label>URL Base *</Label>
                <Input
                  value={newApi.baseUrl}
                  onChange={(e) => setNewApi({ ...newApi, baseUrl: e.target.value })}
                  placeholder="https://api.exemplo.com.br/api"
                />
              </div>
              <div>
                <Label>{newApi.type === 'nossafintech' ? 'CPF *' : 'Username'}</Label>
                <Input
                  value={newApi.username}
                  onChange={(e) => setNewApi({ ...newApi, username: e.target.value })}
                  placeholder={newApi.type === 'nossafintech' ? 'CPF do usuário' : 'Username (opcional)'}
                />
                {newApi.type === 'nossafintech' && (
                  <p className="text-xs text-gray-500 mt-1">
                    CPF usado para autenticação na Nossa Fintech
                  </p>
                )}
              </div>
              <div>
                <Label>******</Label>
                <Input
                  type="******"
                  value={newApi.******}
                  onChange={(e) => setNewApi({ ...newApi, ******: e.target.value })}
                  placeholder="****** (opcional)"
                />
              </div>
              {newApi.type === 'nossafintech' && (
                <div>
                  <Label>Promot ID *</Label>
                  <Input
                    value={newApi.promotId}
                    onChange={(e) => setNewApi({ ...newApi, promotId: e.target.value })}
                    placeholder="ID da Promotora (ex: 123456)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Obrigatório para autenticação na Nossa Fintech
                  </p>
                </div>
              )}
              {(newApi.type === 'credspot' || newApi.type === 'v8digital') && (
                <div className="space-y-3 p-3 bg-emerald-50/80 rounded-md border border-emerald-100">
                  <p className="text-sm font-medium text-emerald-900">
                    {newApi.type === 'credspot' ? 'CredSpot Partner API' : 'V8 Digital'} — credenciais OAuth2
                  </p>
                  <div>
                    <Label>Client ID *</Label>
                    <Input
                      value={newApi.clientId}
                      onChange={(e) => setNewApi({ ...newApi, clientId: e.target.value })}
                      placeholder="Client ID"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Client Secret {newApi.type === 'credspot' ? '*' : ''}</Label>
                    <Input
                      type="******"
                      value={newApi.clientSecret}
                      onChange={(e) => setNewApi({ ...newApi, clientSecret: e.target.value })}
                      placeholder="Client Secret"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Auth URL</Label>
                    <Input
                      value={newApi.authUrl}
                      onChange={(e) => setNewApi({ ...newApi, authUrl: e.target.value })}
                      placeholder={newApi.type === 'credspot' ? 'https://auth.credspot.net/oauth/token' : 'URL de token V8'}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Audience *</Label>
                    <Input
                      value={newApi.audience}
                      onChange={(e) => setNewApi({ ...newApi, audience: e.target.value })}
                      placeholder={newApi.type === 'credspot' ? 'https://api.credspot.net/' : 'Audience V8'}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}
              <Button onClick={handleAddApi} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar API
              </Button>
            </div>
          </div>

          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <strong>Nota:</strong> A API marcada como "Padrão" será usada automaticamente quando nenhuma API específica for selecionada. 
              Você pode alterar a API padrão a qualquer momento.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
