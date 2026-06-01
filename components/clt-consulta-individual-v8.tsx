"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Search, entidade, Phone, Mail, Calendar, Briefcase, DollarSign } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface DadosCliente {
  cpf: string
  nome: string
  dataNascimento: string // YYYY-MM-DD
  genero: string // 'male' ou 'female'
  telefone: string
  email: string
}

interface ResultadoConsulta {
  sucesso: boolean
  consultId?: string
  linkAutorizacao?: string
  status?: string
  margemDisponivel?: number
  erro?: string
  etapa?: 'criando_termo' | 'autorizando' | 'verificando' | 'concluido' | 'erro'
  dados?: any
}

interface CLTConsultaIndividualV8Props {
  dadosIniciais?: Partial<DadosCliente>
}

export function CLTConsultaIndividualV8({ dadosIniciais }: CLTConsultaIndividualV8Props = {}) {
  const [loading, setLoading] = useState(false)
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [dadosCliente, setDadosCliente] = useState<DadosCliente>({
    cpf: '',
    nome: '',
    dataNascimento: '',
    genero: 'male',
    telefone: '',
    email: ''
  })
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null)
  const [erro, setErro] = useState<string | null>(null)

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

  // Preenche dados iniciais se fornecidos via props
  useEffect(() => {
    if (dadosIniciais) {
      setDadosCliente(prev => ({
        ...prev,
        ...dadosIniciais,
        // Garante que campos obrigatórios tenham valores padrão se não fornecidos
        cpf: dadosIniciais.cpf || prev.cpf,
        nome: dadosIniciais.nome || prev.nome,
        dataNascimento: dadosIniciais.dataNascimento || prev.dataNascimento,
        telefone: dadosIniciais.telefone || prev.telefone,
        email: dadosIniciais.email || prev.email,
        genero: dadosIniciais.genero || prev.genero
      }))
    }
  }, [dadosIniciais])

  // Verifica se há dados no localStorage (compartilhado do sistema WhatsApp)
  useEffect(() => {
    if (typeof window !== 'undefined' && !dadosIniciais) {
      try {
        const dadosCompartilhados = localStorage.getItem('whatsapp_cliente_dados')
        if (dadosCompartilhados) {
          const dados = JSON.parse(dadosCompartilhados)
          if (dados.cpf || dados.nome) {
            // Normaliza formato de data se necessário
            let dataNascimento = dados.dataNascimento || dados.birthdate || ''
            if (dataNascimento && !dataNascimento.includes('-')) {
              // Se está em formato DD/MM/AAAA, converte para YYYY-MM-DD
              const partes = dataNascimento.split('/')
              if (partes.length === 3) {
                dataNascimento = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
              }
            }
            
            // Detecta gênero se não fornecido
            let genero = dados.genero || 'male'
            if (dados.nome && !dados.genero) {
              // Tenta detectar pelo primeiro nome (lógica simples)
              const primeiroNome = dados.nome.split(' ')[0].toLowerCase()
              const nomesFemininos = ['maria', 'ana', 'julia', 'sofia', 'isabella', 'fernanda', 'patricia', 'carla', 'lucia']
              if (nomesFemininos.some(n => primeiroNome.includes(n))) {
                genero = 'female'
              }
            }

            setDadosCliente(prev => ({
              ...prev,
              cpf: dados.cpf?.replace(/\D/g, '') || prev.cpf,
              nome: dados.nome || dados.name || prev.nome,
              dataNascimento: dataNascimento || prev.dataNascimento,
              telefone: dados.telefone || dados.phone || prev.telefone,
              email: dados.email || prev.email || `registro.${dados.cpf?.replace(/\D/g, '') || 'temp'}@poracred.com.br`,
              genero: genero
            }))

            // Remove dados do localStorage após usar
            localStorage.removeItem('whatsapp_cliente_dados')
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados compartilhados:', error)
      }
    }
  }, [dadosIniciais])

  // Função para normalizar data para YYYY-MM-DD
  const normalizarData = (data: string): string => {
    let dataLimpa = data.trim().replace(/\s+/g, '')
    
    // Se já está no formato YYYY-MM-DD, retorna
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataLimpa)) {
      return dataLimpa
    }
    
    // Se está no formato DD/MM/YYYY ou DD-MM-YYYY
    if (dataLimpa.includes('/') || dataLimpa.includes('-')) {
      const separador = dataLimpa.includes('/') ? '/' : '-'
      const partes = dataLimpa.split(separador)
      
      if (partes.length === 3) {
        // Se o primeiro número tem 4 dígitos, assume YYYY-MM-DD
        if (partes[0].length === 4) {
          return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`
        }
        // Caso contrário, assume DD/MM/YYYY
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
      }
    }
    
    return dataLimpa
  }

  // Função para formatar CPF
  const formatarCPF = (cpf: string) => {
    const apenasNumeros = cpf.replace(/\D/g, '')
    if (apenasNumeros.length <= 11) {
      return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return cpf
  }

  // Função para formatar telefone
  const formatarTelefone = (telefone: string) => {
    const apenasNumeros = telefone.replace(/\D/g, '')
    if (apenasNumeros.length <= 11) {
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
    return telefone
  }

  const handleConsultar = async () => {
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      // Validações
      const cpfLimpo = dadosCliente.cpf.replace(/\D/g, '')
      if (cpfLimpo.length !== 11) {
        setErro('CPF deve conter 11 dígitos')
        setLoading(false)
        return
      }

      if (!dadosCliente.nome.trim()) {
        setErro('Nome é obrigatório')
        setLoading(false)
        return
      }

      if (!dadosCliente.dataNascimento) {
        setErro('Data de nascimento é obrigatória')
        setLoading(false)
        return
      }

      if (!dadosCliente.telefone.trim()) {
        setErro('Telefone é obrigatório')
        setLoading(false)
        return
      }

      if (!dadosCliente.email.trim()) {
        setErro('Email é obrigatório')
        setLoading(false)
        return
      }

      if (!apiSelecionada) {
        setErro('Selecione uma API V8 Digital')
        setLoading(false)
        return
      }

      // Normaliza dados
      const dataNascimentoNormalizada = normalizarData(dadosCliente.dataNascimento)
      const telefoneLimpo = dadosCliente.telefone.replace(/\D/g, '')

      let resultado: ResultadoConsulta = {
        sucesso: false,
        etapa: 'criando_termo'
      }

      // ETAPA 1: Criar termo de consentimento
      console.log(`[V8 Individual] Criando termo para ${cpfLimpo}...`)
      setResultado({ ...resultado, etapa: 'criando_termo' })

      const termoResponse = await fetch('/api/produto/v8/termo-consentimento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: cpfLimpo,
          nome: dadosCliente.nome.trim(),
          telefone: telefoneLimpo,
          email: dadosCliente.email.trim(),
          birthDate: dataNascimentoNormalizada,
          gender: dadosCliente.genero,
          apiId: apiSelecionada,
        }),
      })

      const termoData = await termoResponse.json()

      if (!termoData.success || !termoData.data?.id) {
        resultado.sucesso = false
        resultado.etapa = 'erro'
        resultado.erro = termoData.error || 'Erro ao criar termo de consentimento'
        setResultado(resultado)
        setErro(resultado.erro || 'Erro ao criar termo de consentimento')
        setLoading(false)
        return
      }

      const consultId = termoData.data.id
      resultado.consultId = consultId
      resultado.linkAutorizacao = termoData.data.consentLink || `https://app.v8sistema.com/termos-de-autorizacao/${consultId}`
      resultado.etapa = 'autorizando'
      setResultado({ ...resultado })

      // ETAPA 2: Autorizar termo automaticamente
      console.log(`[V8 Individual] Autorizando termo ${consultId}...`)
      const authResponse = await fetch('/api/produto/v8/autorizar-termo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultId: consultId,
          apiId: apiSelecionada,
        }),
      })

      const authData = await authResponse.json()

      if (!authData.success) {
        console.warn(`[V8 Individual] Erro ao autorizar termo ${consultId}:`, authData.error)
        // Não falha completamente, pode ser que o termo já esteja autorizado
      }

      resultado.etapa = 'verificando'
      setResultado({ ...resultado })

      // ETAPA 3: Verificar status e margem
      console.log(`[V8 Individual] Verificando status do termo ${consultId}...`)
      
      // Aguarda um pouco antes de verificar (pode levar tempo para processar)
      await new Promise(resolve => setTimeout(resolve, 2000))

      const detalhesResponse = await fetch(`/api/produto/v8/detalhes-termo?consultId=${consultId}`)
      const detalhesData = await detalhesResponse.json()

      if (detalhesData.success && detalhesData.data) {
        const termo = detalhesData.data
        
        resultado.status = termo.status || termo.consultStatus || 'UNKNOWN'
        
        // Busca margem em múltiplas estruturas possíveis
        resultado.margemDisponivel = 
          termo.availableMarginValue ||
          termo.available_margin_value ||
          termo.margin?.available ||
          termo.margin?.value ||
          termo.availableMargin ||
          termo.available_margin ||
          termo.data?.availableMarginValue ||
          0
        
        resultado.sucesso = true
        resultado.etapa = 'concluido'
        resultado.dados = termo
      } else {
        // Tenta buscar pela listagem
        try {
          const listagemResponse = await fetch(`/api/produto/consultar-clt?apiId=${apiSelecionada}&cpf=${cpfLimpo}`)
          const listagemData = await listagemResponse.json()
          
          if (listagemData.success && listagemData.data) {
            let termosLista = listagemData.data
            if (listagemData.data.data && Array.isArray(listagemData.data.data)) {
              termosLista = listagemData.data.data
            } else if (Array.isArray(listagemData.data)) {
              termosLista = listagemData.data
            }
            
            if (Array.isArray(termosLista)) {
              const termoEncontrado = termosLista.find((t: any) => t.id === consultId || t.consultId === consultId)
              if (termoEncontrado) {
                resultado.status = termoEncontrado.status || 'UNKNOWN'
                resultado.margemDisponivel = 
                  termoEncontrado.availableMarginValue ||
                  termoEncontrado.available_margin_value ||
                  termoEncontrado.margin?.available ||
                  termoEncontrado.margin?.value ||
                  0
                resultado.sucesso = true
                resultado.etapa = 'concluido'
                resultado.dados = termoEncontrado
              }
            }
          }
        } catch (error) {
          console.error(`[V8 Individual] Erro ao buscar listagem:`, error)
        }
        
        if (!resultado.sucesso) {
          resultado.sucesso = false
          resultado.etapa = 'erro'
          resultado.erro = 'Termo criado mas não foi possível verificar status'
          setErro(resultado.erro)
        }
      }

      setResultado(resultado)
    } catch (error: any) {
      setErro(error.message || 'Erro ao processar consulta')
      setResultado({
        sucesso: false,
        etapa: 'erro',
        erro: error.message || 'Erro ao processar consulta'
      })
    } finally {
      setLoading(false)
    }
  }

  // Função para formatar valores monetários
  const formatarMoeda = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                </div>
                Consultar Vínculos CLT - V8 Digital
              </CardTitle>
              <CardDescription className="mt-2">
                Preencha os dados do registro para consultar vínculos de trabalho CLT
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seleção de API */}
          {apisDisponiveis.length > 0 && (
            <div>
              <Label htmlFor="apiSelecionada">API V8 Digital</Label>
              <select
                id="apiSelecionada"
                value={apiSelecionada}
                onChange={(e) => setApiSelecionada(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={loading}
              >
                <option value="">Selecione uma API</option>
                {apisDisponiveis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* CPF */}
          <div>
            <Label htmlFor="cpf">CPF do Trabalhador *</Label>
            <Input
              id="cpf"
              value={formatarCPF(dadosCliente.cpf)}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '')
                if (valor.length <= 11) {
                  setDadosCliente({ ...dadosCliente, cpf: valor })
                }
              }}
              placeholder="12345678900"
              className="font-mono text-sm"
              maxLength={14}
            />
          </div>

          {/* Nome */}
          <div>
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={dadosCliente.nome}
              onChange={(e) => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
              placeholder="João Silva"
            />
          </div>

          {/* Data de Nascimento */}
          <div>
            <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
            <Input
              id="dataNascimento"
              type="text"
              value={dadosCliente.dataNascimento}
              onChange={(e) => setDadosCliente({ ...dadosCliente, dataNascimento: e.target.value })}
              placeholder="DD/MM/AAAA ou YYYY-MM-DD"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato: DD/MM/AAAA ou YYYY-MM-DD
            </p>
          </div>

          {/* Gênero */}
          <div>
            <Label htmlFor="genero">Gênero *</Label>
            <select
              id="genero"
              value={dadosCliente.genero}
              onChange={(e) => setDadosCliente({ ...dadosCliente, genero: e.target.value })}
              className="w-full p-2 border rounded-md"
              disabled={loading}
            >
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </div>

          {/* Telefone */}
          <div>
            <Label htmlFor="telefone">Telefone *</Label>
            <Input
              id="telefone"
              value={formatarTelefone(dadosCliente.telefone)}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '')
                if (valor.length <= 11) {
                  setDadosCliente({ ...dadosCliente, telefone: valor })
                }
              }}
              placeholder="(11) 98765-4321"
              className="font-mono text-sm"
              maxLength={15}
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato: (DDD) + número com 9 dígitos
            </p>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={dadosCliente.email}
              onChange={(e) => setDadosCliente({ ...dadosCliente, email: e.target.value })}
              placeholder="joao.silva@email.com"
            />
          </div>

          <Button
            onClick={handleConsultar}
            disabled={loading || !dadosCliente.cpf || !dadosCliente.nome || !dadosCliente.dataNascimento || !dadosCliente.telefone || !dadosCliente.email || !apiSelecionada}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {resultado?.etapa === 'criando_termo' && 'Criando termo...'}
                {resultado?.etapa === 'autorizando' && 'Autorizando termo...'}
                {resultado?.etapa === 'verificando' && 'Verificando status...'}
                {!resultado?.etapa && 'Consultando...'}
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Consultar Vínculos
              </>
            )}
          </Button>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {resultado?.sucesso && (
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
              {resultado.sucesso ? 'Consulta concluída com sucesso' : 'Erro na consulta'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resultado.sucesso ? (
              <div className="space-y-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Sucesso
                </Badge>

                {resultado.consultId && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">ID da Consulta:</span> {resultado.consultId}
                    </p>
                  </div>
                )}

                {resultado.status && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Status:</span> {resultado.status}
                    </p>
                  </div>
                )}

                {resultado.margemDisponivel !== undefined && (
                  <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Margem Disponível</p>
                        <p className="text-2xl font-bold text-green-700">
                          {formatarMoeda(resultado.margemDisponivel)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {resultado.linkAutorizacao && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Link de Autorização:</span>{' '}
                      <a href={resultado.linkAutorizacao} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {resultado.linkAutorizacao}
                      </a>
                    </p>
                  </div>
                )}

                {resultado.dados && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Dados Completos:</h4>
                    <pre className="text-xs overflow-auto max-h-96 bg-white p-3 rounded border">
                      {JSON.stringify(resultado.dados, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {resultado.erro || 'Erro desconhecido'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
