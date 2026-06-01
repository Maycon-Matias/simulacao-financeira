"use client"

/**
 * Consulta individual Presença Bank (Consignado Privado CLT).
 * Fluxo: o usuário informa apenas CPF; matrícula e CNPJ vêm exclusivamente do vínculo
 * retornado pela API (consultar-vinculos), nunca de campos de formulário.
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Search, Shield, DollarSign, entidade, Mail, Phone, Calendar } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"
import { extrairVinculos, extrairMatriculaECnpj, validarVinculo, fazerRequisicaoComRetry, type VinculoEmpregaticio } from "@/lib/utils"

export function CLTConsultaIndividualPresenca() {
  const [loading, setLoading] = useState(false)
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [vinculosEncontrados, setVinculosEncontrados] = useState<VinculoEmpregaticio[]>([])
  const [vinculoSelecionadoIndex, setVinculoSelecionadoIndex] = useState<number>(0)
  const [mostrarSelecaoVinculo, setMostrarSelecaoVinculo] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active && c.type === 'presencabank')
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  const formatarCPF = (value: string) => {
    const cpfLimpo = value.replace(/\D/g, '')
    if (cpfLimpo.length <= 11) {
      return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    }
    return value
  }

  const formatarTelefone = (value: string) => {
    const telLimpo = value.replace(/\D/g, '')
    if (telLimpo.length <= 11) {
      return telLimpo.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
    return value
  }

  const processarConsultaMargem = async (vinculo: VinculoEmpregaticio) => {
    const cpfLimpo = cpf.replace(/\D/g, '')
    let { matricula, cnpj } = extrairMatriculaECnpj(vinculo, cpfLimpo)
    if (!cnpj?.trim().length) {
      const retry = extrairMatriculaECnpj(vinculo, cpfLimpo)
      if (retry.cnpj?.trim().length) cnpj = retry.cnpj
        else {
          const str = JSON.stringify(vinculo)
          const cnpj14 = str.match(/\d{14}/g)
          if (cnpj14?.length) {
            const unicos = [...new Set(cnpj14)].filter((m: string) => m !== '00000000000000')
            const cpf11 = cpfLimpo.length === 11 ? cpfLimpo : null
            const valid = cpf11 ? unicos.filter((m: string) => !m.startsWith(cpf11)) : unicos
            cnpj = valid[0] ?? unicos[0]
          }
          if (!cnpj || cnpj.replace(/\D/g, '').length < 14 || cnpj.replace(/\D/g, '') === '00000000000000') {
            const short = str.match(/\d{8,13}/g)
            if (short) {
              const unicos = [...new Set(short)]
              const cpf11 = cpfLimpo.length === 11 ? cpfLimpo : null
              for (const m of unicos) {
                if (m.length === 11 && cpf11 && m === cpf11) continue
                const padded = m.padStart(14, '0')
                if (padded !== '00000000000000' && (!cpf11 || !padded.startsWith(cpf11))) { cnpj = padded; break }
              }
            }
          }
        }
    }
    if (!cnpj || cnpj.replace(/\D/g, '').length < 14) {
      setErro('Este vínculo não possui CNPJ válido (14 dígitos). A API de margem exige CNPJ.')
      return
    }
    if (cnpj.replace(/\D/g, '') === '00000000000000') {
      setErro('CNPJ do vínculo é inválido (apenas zeros). Selecione outro vínculo ou verifique os dados.')
      return
    }

    setLoading(true)
    setErro(null)

    try {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const marginData = await fazerRequisicaoComRetry('/api/produto/presenca/clt/margin', {
        apiId: apiSelecionada,
        cpf: cpfLimpo,
        matricula,
        cnpj,
      })

      if (marginData.success) {
        setResultado({
          vinculos: vinculosEncontrados,
          vinculoSelecionado: vinculo,
          margem: marginData.data?.valorMargemDisponivel ?? marginData.data?.margem ?? marginData.data?.margin ?? marginData.data?.margemDisponivel ?? 0,
          status: marginData.data?.status || 'success',
          dados: marginData.data,
        })
        setMostrarSelecaoVinculo(false)
      } else {
        setErro(marginData.error || 'Erro ao consultar margem')
      }
    } catch (error: any) {
      setErro(error.message || 'Erro desconhecido ao consultar margem')
    } finally {
      setLoading(false)
    }
  }

  const handleConsultar = async () => {
    if (!apiSelecionada) {
      setErro('Selecione uma API Presença Bank')
      return
    }

    const cpfLimpo = cpf.replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      setErro('CPF deve ter 11 dígitos')
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      // 1. Consultar vínculos com fluxo de autorização (envia nome, email, telefone, dataNascimento quando a API exige "autorização válida")
      const vinculosData = await fazerRequisicaoComRetry('/api/produto/presenca/consultar-clt-autorizado', {
        apiId: apiSelecionada,
        cpf: cpfLimpo,
        nome: nome?.trim() || undefined,
        email: email?.trim() || undefined,
        telefone: telefone?.replace(/\D/g, '') || undefined,
        birthDate: dataNascimento || undefined,
      })

      if (!vinculosData.success) {
        setErro(vinculosData.error || 'Erro ao consultar vínculos empregatícios')
        return
      }

      const vinculos = extrairVinculos(vinculosData.data?.vinculos ?? vinculosData.data?.raw ?? vinculosData.data)

      if (!Array.isArray(vinculos) || vinculos.length === 0) {
        setErro('Nenhum vínculo empregatício encontrado para este CPF')
        return
      }

      // Seleção automática do vínculo (igual ao fluxo em lote): prioriza válidos, senão usa primeiro disponível
      const vinculosValidos = vinculos.filter(validarVinculo)
      let vinculoSelecionado: VinculoEmpregaticio
      let listaParaSelecao: VinculoEmpregaticio[]

      if (vinculosValidos.length > 0) {
        listaParaSelecao = vinculosValidos
        vinculoSelecionado = vinculosValidos[0]
      } else {
        // Nenhum passou na validação: usa primeiro vínculo (CNPJ pode estar em outro campo)
        listaParaSelecao = vinculos
        vinculoSelecionado = vinculos[0]
      }

      // Extrai matrícula e CNPJ; aplica fallback se CNPJ vazio (mesmo que no lote)
      let { matricula, cnpj } = extrairMatriculaECnpj(vinculoSelecionado, cpfLimpo)
      if (!cnpj || cnpj.trim().length === 0) {
        const retry = extrairMatriculaECnpj(vinculoSelecionado, cpfLimpo)
        if (retry.cnpj?.trim().length) cnpj = retry.cnpj
        else {
          const str = JSON.stringify(vinculoSelecionado)
          const cnpj14 = str.match(/\d{14}/g)
          if (cnpj14?.length) {
            const unicos = [...new Set(cnpj14)].filter((m: string) => m !== '00000000000000')
            const cpf11 = cpfLimpo.length === 11 ? cpfLimpo : null
            const valid = cpf11 ? unicos.filter((m: string) => !m.startsWith(cpf11)) : unicos
            cnpj = valid[0] ?? unicos[0]
          }
          if (!cnpj || cnpj.replace(/\D/g, '').length < 14 || cnpj.replace(/\D/g, '') === '00000000000000') {
            const short = str.match(/\d{8,13}/g)
            if (short) {
              const unicos = [...new Set(short)]
              const cpf11 = cpfLimpo.length === 11 ? cpfLimpo : null
              for (const m of unicos) {
                if (m.length === 11 && cpf11 && m === cpf11) continue
                const padded = m.padStart(14, '0')
                if (padded !== '00000000000000' && (!cpf11 || !padded.startsWith(cpf11))) { cnpj = padded; break }
              }
            }
          }
        }
      }

      if (!matricula || matricula.trim().length === 0) {
        setErro('Vínculo encontrado mas sem matrícula identificável')
        setLoading(false)
        return
      }
      if (!cnpj || cnpj.replace(/\D/g, '').length < 14) {
        setErro('Vínculo encontrado mas sem CNPJ válido (14 dígitos). A API de margem exige CPF, matrícula e CNPJ.')
        setLoading(false)
        return
      }
      if (cnpj.replace(/\D/g, '') === '00000000000000') {
        setErro('CNPJ do vínculo é inválido (apenas zeros). Verifique os dados do vínculo.')
        setLoading(false)
        return
      }

      // Se houver múltiplos vínculos na lista escolhida, permite seleção na UI
      if (listaParaSelecao.length > 1) {
        setVinculosEncontrados(listaParaSelecao)
        setVinculoSelecionadoIndex(0)
        setMostrarSelecaoVinculo(true)
        setLoading(false)
        return
      }

      // Delay entre requisições (1 segundo)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 2. Consultar margem com dados do vínculo (com retry)
      const marginData = await fazerRequisicaoComRetry('/api/produto/presenca/clt/margin', {
        apiId: apiSelecionada,
        cpf: cpfLimpo,
        matricula,
        cnpj,
      })

      if (marginData.success) {
        setResultado({
          vinculos: listaParaSelecao,
          vinculoSelecionado,
          margem: marginData.data?.valorMargemDisponivel ?? marginData.data?.margem ?? marginData.data?.margin ?? marginData.data?.margemDisponivel ?? 0,
          status: marginData.data?.status || 'success',
          dados: marginData.data,
        })
      } else {
        setErro(marginData.error || 'Erro ao consultar margem')
      }
    } catch (error: any) {
      setErro(error.message || 'Erro desconhecido ao consultar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-600" />
            Consulta Individual Presença Bank
          </CardTitle>
          <CardDescription>
            Consulte margem disponível para consignado privado CLT
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione a API Presença Bank</Label>
            <select
              value={apiSelecionada}
              onChange={(e) => setApiSelecionada(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={loading}
            >
              <option value="">Selecione uma API</option>
              {apisDisponiveis.map(api => (
                <option key={api.id} value={api.id}>{api.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do registro"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {mostrarSelecaoVinculo && vinculosEncontrados.length > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm">Múltiplos vínculos encontrados</CardTitle>
                <CardDescription>Selecione qual vínculo deseja consultar:</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {vinculosEncontrados.map((vinculo, index) => {
                  const { matricula, cnpj } = extrairMatriculaECnpj(vinculo, cpf.replace(/\D/g, ''))
                  return (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        vinculoSelecionadoIndex === index
                          ? 'border-purple-500 bg-purple-100'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                      onClick={() => setVinculoSelecionadoIndex(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            Matrícula: {matricula || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-600 font-mono">
                            CNPJ: {cnpj || 'N/A'}
                          </div>
                        </div>
                        {vinculoSelecionadoIndex === index && (
                          <CheckCircle2 className="h-5 w-5 text-purple-600" />
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => processarConsultaMargem(vinculosEncontrados[vinculoSelecionadoIndex])}
                    disabled={loading}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? (
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
                  <Button
                    onClick={() => {
                      setMostrarSelecaoVinculo(false)
                      setVinculosEncontrados([])
                    }}
                    variant="outline"
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!mostrarSelecaoVinculo && (
            <Button
              onClick={handleConsultar}
              disabled={loading || !apiSelecionada || !cpf}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
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
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Resultado da Consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">Margem Disponível</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  R$ {resultado.margem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <entidade className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Vínculos Encontrados</span>
                </div>
                <p className="text-sm font-semibold text-blue-700">
                  {Array.isArray(resultado.vinculos) ? resultado.vinculos.length : 0} vínculo(s)
                </p>
              </div>
            </div>

            {resultado.vinculoSelecionado && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Vínculo Utilizado</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-green-700 font-medium">Matrícula:</span>
                    <span className="ml-2 text-green-900">
                      {resultado.vinculoSelecionado.matricula || resultado.vinculoSelecionado.registroEmpregaticio || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-700 font-medium">CNPJ:</span>
                    <span className="ml-2 text-green-900 font-mono">
                      {resultado.vinculoSelecionado.cnpj || resultado.vinculoSelecionado.cnpjEmpregador || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {resultado.status && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <Badge variant={resultado.status === 'success' ? 'default' : 'outline'}>
                  {resultado.status}
                </Badge>
              </div>
            )}

            {resultado.dados && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Detalhes Adicionais</h4>
                <pre className="text-xs text-gray-600 overflow-x-auto">
                  {JSON.stringify(resultado.dados, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
