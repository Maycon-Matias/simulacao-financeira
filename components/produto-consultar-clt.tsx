"use client"

import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, CheckCircle2, XCircle, Briefcase, Building2, entidade, DollarSign, Calendar, FileText, Calculator, ArrowRight } from "lucide-react"

interface VinculoCLT {
  matricula?: string
  inscricaoEmpregador?: {
    tipoInscricao?: number
    numeroInscricao?: string
  }
  elegivel?: boolean
  valorLiberado?: number
  valorDisponivel?: number
  valorLimite?: number
  salario?: number
  dataAdmissao?: string
  dataDemissao?: string
  nomeEmpregador?: string
  razaoSocial?: string
  cpfTrabalhador?: string
  nomeTrabalhador?: string
  situacao?: string
  [key: string]: any // Permite campos adicionais dinâmicos
}

interface NossaFintechMarginPayload {
  margin_key?: string
  document?: string
  name?: string
  employer?: { name?: string; document?: string }
  employer_document?: string
  employerDocument?: string
  utilizable_balance?: number
  available_balance?: number
  base_margin_value?: number
  admission_date?: string
}

interface ConsultaCLTResultado {
  success: boolean
  data?: {
    value?: {
      idCotacao?: string
      vinculos?: VinculoCLT[]
    }
    vinculos?: VinculoCLT[]
    hasSuccess?: boolean
    hasError?: boolean
    errors?: string[]
    /** Corpo interno da Nossa Fintech (get-margin) */
    data?: NossaFintechMarginPayload
  } & NossaFintechMarginPayload
  error?: string
}

interface ProdutoConsultarCLTProps {
  onSuccess?: (dados: any) => void
  onError?: (erro: string) => void
  apiId?: string
  dadosAnteriores?: any
}

export function ProdutoConsultarCLT({ onSuccess, onError, apiId, dadosAnteriores }: ProdutoConsultarCLTProps = {}) {
  const [cpfTrabalhador, setCpfTrabalhador] = useState<string>(dadosAnteriores?.cpf || "")
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ConsultaCLTResultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Preenche CPF se vier de dados anteriores
  useEffect(() => {
    if (dadosAnteriores?.cpf && !cpfTrabalhador) {
      setCpfTrabalhador(dadosAnteriores.cpf)
    }
  }, [dadosAnteriores])

  const formatarCPF = (cpf: string) => {
    const apenasNumeros = cpf.replace(/\D/g, '')
    return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const handleConsultar = async () => {
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const cpf = cpfTrabalhador.trim().replace(/\D/g, '')

      if (cpf.length !== 11) {
        setErro('CPF deve conter 11 dígitos')
        setLoading(false)
        return
      }

      const response = await fetch('/api/produto/consultar-clt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpfTrabalhador: cpf,
          apiId: apiId,
          // Nossa Fintech: só CPF + bancarizadora (CNPJ opcional; API localiza o vínculo)
          serviceType: 'QITECH',
        }),
      })

      const data = await response.json()

      console.log('Resposta da API CLT:', data)

      if (!response.ok || !data.success) {
        const errorMsg = data.error || 'Erro ao consultar vínculos CLT'
        setErro(errorMsg)
        setResultado({ success: false, error: data.error })
        onError?.(errorMsg)
      } else {
        console.log('Dados recebidos CLT:', data.data)
        setResultado({ success: true, data: data.data })
        onSuccess?.(data.data)
        
        // Salva margin_key no localStorage se disponível (para Nossa Fintech)
        // O margin_key pode estar em diferentes locais na resposta
        const marginKey = data.data?.margin_key || 
                         data.data?.data?.margin_key || 
                         data.data?.value?.margin_key ||
                         (data.data?.value && typeof data.data.value === 'object' && 'margin_key' in data.data.value ? data.data.value.margin_key : null)
        
        if (marginKey) {
          const marginKeyData = {
            margin_key: marginKey,
            marginKey: marginKey,
            service_type: data.data?.service_type || data.data?.data?.service_type || 'QITECH',
            serviceType: data.data?.service_type || data.data?.data?.service_type || 'QITECH',
            cpf: cpf,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem('clt_margin_key', JSON.stringify(marginKeyData))
          console.log('Margin Key salvo no localStorage:', marginKeyData)
        } else {
          console.log('Margin Key não encontrado na resposta da consulta de margem')
        }
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao fazer consulta CLT')
      setResultado({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  // Função para enviar dados para simulação
  const enviarParaSimulacao = (vinculo: VinculoCLT, idCotacao: string) => {
    // Salva os dados no localStorage para a simulação usar
    const dadosSimulacao = {
      cpf: cpfTrabalhador,
      idCotacao: idCotacao,
      matricula: vinculo.matricula || '',
      codigoInscricaoEmpregador: vinculo.inscricaoEmpregador?.tipoInscricao || 1,
      numeroInscricaoEmpregador: vinculo.inscricaoEmpregador?.numeroInscricao || '',
      // Dados adicionais que podem ser úteis
      nomeCliente: vinculo.nomeTrabalhador || '',
      valorDisponivel: vinculo.valorDisponivel,
      valorLimite: vinculo.valorLimite,
    }
    
    localStorage.setItem('clt_simulacao_dados', JSON.stringify(dadosSimulacao))
    
    // Dispara evento customizado para mudar de aba
    window.dispatchEvent(new CustomEvent('mudarAba', { detail: { aba: 'simular-clt' } }))
    
    // Scroll suave para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Extrai os vínculos da resposta (pode estar em diferentes estruturas)
  const getVinculos = (): VinculoCLT[] => {
    if (!resultado?.success || !resultado.data) return []

    // Tenta diferentes estruturas
    if (resultado.data.value?.vinculos && Array.isArray(resultado.data.value.vinculos)) {
      return resultado.data.value.vinculos
    }
    if (resultado.data.vinculos && Array.isArray(resultado.data.vinculos)) {
      return resultado.data.vinculos
    }
    
    // Se value é um array vazio, não há vínculos
    if (Array.isArray(resultado.data.value) && resultado.data.value.length === 0) {
      return []
    }

    // Resposta Nossa Fintech (get-margin): um vínculo em data.data ou no próprio data
    const nested = resultado.data.data
    const marginData: NossaFintechMarginPayload | undefined =
      nested && typeof nested === 'object'
        ? nested
        : resultado.data.margin_key || resultado.data.document || resultado.data.employer
          ? resultado.data
          : undefined

    if (marginData && (marginData.margin_key || marginData.document || marginData.employer)) {
      const employerDoc =
        marginData.employer?.document ||
        marginData.employer_document ||
        marginData.employerDocument
      const cnpjLimpo = employerDoc ? String(employerDoc).replace(/\D/g, '') : ''

      return [
        {
          cpfTrabalhador: marginData.document || cpfTrabalhador.replace(/\D/g, ''),
          nomeTrabalhador: marginData.name,
          nomeEmpregador: marginData.employer?.name,
          razaoSocial: marginData.employer?.name,
          valorDisponivel: marginData.utilizable_balance ?? marginData.available_balance,
          valorLimite: marginData.base_margin_value,
          valorLiberado: marginData.available_balance,
          salario: marginData.base_margin_value,
          dataAdmissao: marginData.admission_date,
          elegivel: (marginData.utilizable_balance ?? marginData.available_balance ?? 0) > 0,
          margin_key: marginData.margin_key,
          inscricaoEmpregador: cnpjLimpo
            ? { tipoInscricao: 1, numeroInscricao: cnpjLimpo }
            : undefined,
        },
      ]
    }

    return []
  }
  
  // Verifica se a resposta indica que não há vínculos
  const semVinculos = resultado?.success && resultado.data && (
    (Array.isArray(resultado.data.value) && resultado.data.value.length === 0) ||
    (resultado.data.value?.vinculos && Array.isArray(resultado.data.value.vinculos) && resultado.data.value.vinculos.length === 0)
  )

  const vinculos = getVinculos()

  // Função para formatar valores monetários
  const formatarMoeda = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Função para formatar datas
  const formatarData = (data: string | undefined | null): string => {
    if (!data) return 'N/A'
    try {
      return new Date(data).toLocaleDateString('pt-BR')
    } catch {
      return data
    }
  }

  // Função para obter explicação simples de um campo
  const getExplicacaoCampo = (label: string): string | null => {
    const explicacoes: Record<string, string> = {
      'Matrícula': 'Número de registro do funcionário na organizacao',
      'CPF': 'CPF do funcionário',
      'Nome': 'Nome completo do funcionário',
      'Situação do Trabalho': 'Status atual do vínculo de trabalho (Ativo, Inativo, etc.)',
      'CNPJ da organizacao': 'CNPJ da organizacao onde o funcionário trabalha',
      'Nome da organizacao': 'Nome da organizacao onde o funcionário trabalha',
      'Razão Social': 'Nome oficial da organizacao',
      '💰 Valor Disponível para Usar': 'Este é o valor que o registro ainda pode usar para pedir crédito',
      '📊 Limite Total de Crédito': 'Este é o valor máximo que o registro pode ter de crédito',
      '✅ Valor Já Liberado': 'Valor de crédito que o registro já está usando',
      '💵 Salário Mensal': 'Salário mensal do funcionário',
      'Data de Entrada na organizacao': 'Data em que o funcionário começou a trabalhar nesta organizacao',
      'Data de Saída': 'Data em que o funcionário saiu da organizacao (se aplicável)',
    }
    return explicacoes[label] || null
  }

  // Função para renderizar um campo dinamicamente com explicação
  const renderizarCampo = (label: string, valor: any, icon?: ReactNode, explicacao?: string) => {
    if (valor === undefined || valor === null || valor === '') return null
    
    let valorFormatado = valor
    const explicacaoCampo = explicacao || getExplicacaoCampo(label)
    
    // Formatação automática baseada no tipo
    if (typeof valor === 'number') {
      // Se for um número grande, provavelmente é monetário
      if (valor > 100) {
        valorFormatado = formatarMoeda(valor)
      } else {
        valorFormatado = valor.toLocaleString('pt-BR')
      }
    } else if (typeof valor === 'boolean') {
      valorFormatado = valor ? 'Sim' : 'Não'
    } else if (typeof valor === 'string' && valor.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Tenta formatar como data
      valorFormatado = formatarData(valor)
    }

    return (
      <div>
        <div className="flex items-center gap-1 mb-1">
          {icon}
          <span className="text-xs font-medium text-gray-700">{label}:</span>
        </div>
        <p className={`break-words ${typeof valor === 'number' && valor > 100 ? 'text-lg font-bold text-gray-900' : 'text-sm font-semibold text-gray-900'}`}>
          {String(valorFormatado)}
        </p>
        {explicacaoCampo && (
          <p className="text-xs text-gray-500 mt-1 italic">{explicacaoCampo}</p>
        )}
      </div>
    )
  }

  // Função para renderizar objeto aninhado
  const renderizarObjeto = (obj: any, prefixo: string = ''): ReactNode[] => {
    if (!obj || typeof obj !== 'object') return []
    
    return Object.entries(obj).map(([key, value]) => {
      const label = prefixo ? `${prefixo} - ${key}` : key
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        return (
          <div key={key} className="md:col-span-2 border-t pt-2 mt-2">
            <p className="text-xs font-semibold text-gray-600 mb-2">{label}:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
              {renderizarObjeto(value, label)}
            </div>
          </div>
        )
      }
      
      return (
        <div key={key}>
          {renderizarCampo(
            key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            value,
            getIconForKey(key)
          )}
        </div>
      )
    })
  }

  // Função para obter ícone baseado na chave
  const getIconForKey = (key: string) => {
    const keyLower = key.toLowerCase()
    if (keyLower.includes('valor') || keyLower.includes('salario') || keyLower.includes('limite')) {
      return <DollarSign className="h-3 w-3" />
    }
    if (keyLower.includes('data') || keyLower.includes('admissao') || keyLower.includes('demissao')) {
      return <Calendar className="h-3 w-3" />
    }
    if (keyLower.includes('matricula') || keyLower.includes('cpf')) {
      return <entidade className="h-3 w-3" />
    }
    if (keyLower.includes('empregador') || keyLower.includes('organizacao') || keyLower.includes('cnpj')) {
      return <Building2 className="h-3 w-3" />
    }
    return <FileText className="h-3 w-3" />
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
                Consultar Vínculos CLT
              </CardTitle>
              <CardDescription className="mt-2">
                Consulte vínculos de trabalho CLT por CPF
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cpfTrabalhador">CPF do Trabalhador</Label>
            <Input
              id="cpfTrabalhador"
              value={cpfTrabalhador}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, '')
                if (valor.length <= 11) {
                  setCpfTrabalhador(valor)
                }
              }}
              placeholder="12345678900"
              className="font-mono text-sm"
              maxLength={14}
            />
            <p className="text-sm text-gray-500 mt-1">
              Informe o CPF do trabalhador para consultar seus vínculos de trabalho
            </p>
          </div>

          <Button
            onClick={handleConsultar}
            disabled={loading || cpfTrabalhador.trim().replace(/\D/g, '').length !== 11}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Consultando...
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

          {resultado?.success && (
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
            <CardTitle className="text-xl">Resultado da Consulta CLT</CardTitle>
            <CardDescription>
              {resultado.success ? 'Vínculos de trabalho encontrados' : 'Erro na consulta'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resultado.success && resultado.data ? (
              <div className="space-y-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Sucesso
                </Badge>

                {resultado.data.value?.idCotacao && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">ID Cotação:</span> {resultado.data.value.idCotacao}
                    </p>
                  </div>
                )}

                {vinculos.length > 0 ? (
                  <div className="space-y-3">
                    {/* Resumo de Elegibilidade */}
                    {(() => {
                      const clientesAptos = vinculos.filter(v => v.elegivel === true).length
                      const clientesNaoAptos = vinculos.filter(v => v.elegivel === false).length
                      const totalComStatus = vinculos.filter(v => v.elegivel !== undefined).length
                      
                      if (totalComStatus > 0) {
                        return (
                          <div className={`p-4 rounded-lg border-2 ${
                            clientesAptos > 0 
                              ? 'bg-green-50 border-green-300' 
                              : 'bg-red-50 border-red-300'
                          }`}>
                            <div className="flex items-center gap-3">
                              {clientesAptos > 0 ? (
                                <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <h4 className="font-bold text-lg mb-2">
                                  {clientesAptos > 0 
                                    ? `✅ ${clientesAptos} registro(s) PODE(M) FAZER CRÉDITO` 
                                    : '❌ Nenhum registro Pode Fazer Crédito'}
                                </h4>
                                <p className="text-sm text-gray-700">
                                  {clientesAptos > 0 && clientesNaoAptos > 0 && (
                                    <>Encontramos {vinculos.length} trabalho(s). {clientesAptos} registro(s) pode(m) fazer crédito e {clientesNaoAptos} não pode(m) no momento.</>
                                  )}
                                  {clientesAptos > 0 && clientesNaoAptos === 0 && (
                                    <>Ótimo! Todos os {vinculos.length} trabalho(s) encontrado(s) permitem que o registro faça crédito consignado.</>
                                  )}
                                  {clientesAptos === 0 && clientesNaoAptos > 0 && (
                                    <>Infelizmente, nenhum dos {vinculos.length} trabalho(s) encontrado(s) permite que o registro faça crédito no momento. Entre em contato com o suporte para mais informações.</>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                    
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-700 font-medium">
                        📋 Encontramos <strong>{vinculos.length}</strong> {vinculos.length === 1 ? 'trabalho' : 'trabalhos'} registrado{vinculos.length > 1 ? 's' : ''} para este CPF
                      </p>
                    </div>
                    {vinculos.map((vinculo, index) => (
                      <div key={index} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-all duration-200 hover:shadow-md border-gray-200">
                        <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b">
                          <Briefcase className="h-4 w-4 text-blue-500" />
                          Trabalho #{index + 1} {vinculo.nomeEmpregador || vinculo.razaoSocial ? `- ${vinculo.nomeEmpregador || vinculo.razaoSocial}` : ''}
                        </h3>
                        
                        <div className="space-y-4">
                          {/* Status de Elegibilidade - PRIMEIRO E DESTACADO */}
                          {vinculo.elegivel !== undefined && (
                            <div className="mb-4">
                              <div className={`p-4 rounded-lg shadow-sm ${vinculo.elegivel ? 'bg-green-50 border-2 border-green-400' : 'bg-red-50 border-2 border-red-400'}`}>
                                <div className="flex items-start gap-3">
                                  {vinculo.elegivel ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1">
                                    <h4 className={`text-lg font-bold mb-2 ${vinculo.elegivel ? 'text-green-800' : 'text-red-800'}`}>
                                      {vinculo.elegivel ? '✅ PODE FAZER CRÉDITO' : '❌ NÃO PODE FAZER CRÉDITO'}
                                    </h4>
                                    <p className={`text-sm ${vinculo.elegivel ? 'text-green-700' : 'text-red-700'}`}>
                                      {vinculo.elegivel 
                                        ? 'Este registro está autorizado e pode solicitar crédito consignado. Você pode prosseguir com a simulação.'
                                        : 'Este registro não está autorizado para crédito consignado no momento. Entre em contato com o suporte para mais informações.'}
                                    </p>
                                    <p className="text-xs mt-2 text-gray-700">
                                      <strong>Possui tabela disponível:</strong> {vinculo.elegivel ? 'Sim' : 'Não'}
                                    </p>
                                    {vinculo.elegivel && resultado?.data?.value?.idCotacao && (
                                      <div className="mt-4">
                                        <Button
                                          onClick={() => enviarParaSimulacao(vinculo, resultado.data!.value!.idCotacao!)}
                                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                                          size="lg"
                                        >
                                          <Calculator className="h-5 w-5 mr-2" />
                                          Ir para Simulação
                                          <ArrowRight className="h-5 w-5 ml-2" />
                                        </Button>
                                        <p className="text-xs text-green-600 mt-2 text-center">
                                          Os dados do registro serão preenchidos automaticamente
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Seção: Informações do Funcionário */}
                          <div>
                            <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                              <entidade className="h-4 w-4 text-blue-500" />
                              Informações do Funcionário
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {renderizarCampo('Nome', vinculo.nomeTrabalhador, <entidade className="h-4 w-4 text-gray-500" />)}
                              {renderizarCampo('CPF', vinculo.cpfTrabalhador, <entidade className="h-4 w-4 text-gray-500" />)}
                              {renderizarCampo('Matrícula', vinculo.matricula, <FileText className="h-4 w-4 text-gray-500" />)}
                              {renderizarCampo('Situação do Trabalho', vinculo.situacao, <FileText className="h-4 w-4 text-gray-500" />)}
                            </div>
                          </div>

                          {/* Seção: organizacao onde Trabalha */}
                          {vinculo.inscricaoEmpregador && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-500" />
                                organizacao onde Trabalha
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderizarCampo('Nome da organizacao', vinculo.nomeEmpregador || vinculo.razaoSocial, <Building2 className="h-4 w-4 text-gray-500" />)}
                                {renderizarCampo('CNPJ da organizacao', vinculo.inscricaoEmpregador.numeroInscricao, <FileText className="h-4 w-4 text-gray-500" />)}
                                {renderizarCampo('Razão Social', vinculo.razaoSocial, <Building2 className="h-4 w-4 text-gray-500" />)}
                              </div>
                            </div>
                          )}

                          {/* Seção: Valores de Crédito */}
                          {(vinculo.valorLiberado !== undefined || vinculo.valorDisponivel !== undefined || vinculo.valorLimite !== undefined || vinculo.salario !== undefined) && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-500" />
                                Valores de Crédito Disponíveis
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {vinculo.valorDisponivel !== undefined && (
                                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    {renderizarCampo('💰 Valor Disponível para Usar', vinculo.valorDisponivel, <DollarSign className="h-4 w-4 text-blue-600" />, 'Este é o valor que o registro ainda pode usar para pedir crédito')}
                                  </div>
                                )}
                                {vinculo.valorLimite !== undefined && (
                                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                    {renderizarCampo('📊 Limite Total de Crédito', vinculo.valorLimite, <DollarSign className="h-4 w-4 text-purple-600" />, 'Este é o valor máximo que o registro pode ter de crédito')}
                                  </div>
                                )}
                                {vinculo.valorLiberado !== undefined && (
                                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    {renderizarCampo('✅ Valor Já Liberado', vinculo.valorLiberado, <DollarSign className="h-4 w-4 text-yellow-600" />, 'Valor de crédito que o registro já está usando')}
                                  </div>
                                )}
                                {vinculo.salario !== undefined && (
                                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    {renderizarCampo('💵 Salário Mensal', vinculo.salario, <DollarSign className="h-4 w-4 text-gray-600" />, 'Salário mensal do funcionário')}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Seção: Histórico de Trabalho */}
                          {(vinculo.dataAdmissao || vinculo.dataDemissao) && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                Histórico de Trabalho
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderizarCampo('Data de Entrada na organizacao', vinculo.dataAdmissao, <Calendar className="h-4 w-4 text-gray-500" />, 'Data em que o funcionário começou a trabalhar nesta organizacao')}
                                {renderizarCampo('Data de Saída', vinculo.dataDemissao, <Calendar className="h-4 w-4 text-gray-500" />, 'Data em que o funcionário saiu da organizacao (se aplicável)')}
                              </div>
                            </div>
                          )}

                          {/* Seção: Campos Adicionais */}
                          {(() => {
                            const camposAdicionais = Object.entries(vinculo).filter(([key, value]) => {
                              const camposConhecidos = [
                                'matricula', 'inscricaoEmpregador', 'elegivel',
                                'valorLiberado', 'valorDisponivel', 'valorLimite', 'salario',
                                'dataAdmissao', 'dataDemissao', 'nomeEmpregador', 'razaoSocial',
                                'cpfTrabalhador', 'nomeTrabalhador', 'situacao'
                              ]
                              
                              if (camposConhecidos.includes(key.toLowerCase())) return false
                              if (value === undefined || value === null || value === '') return false
                              if (typeof value === 'object' && !Array.isArray(value)) return false
                              return true
                            })

                            if (camposAdicionais.length === 0) return null

                            return (
                              <div className="border-t pt-3">
                                <h4 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wider">Informações Adicionais</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {camposAdicionais.map(([key, value]) => (
                                    <div key={key}>
                                      {renderizarCampo(
                                        key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
                                        value,
                                        getIconForKey(key)
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <XCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-900">
                        <strong>Nenhum vínculo encontrado</strong>
                        <p className="text-sm mt-1">
                          A consulta foi realizada com sucesso, mas não foram encontrados vínculos de trabalho CLT para este CPF.
                        </p>
                      </AlertDescription>
                    </Alert>
                    
                    {(resultado.data.value as any)?.errors && Array.isArray((resultado.data.value as any).errors) && (resultado.data.value as any).errors.length > 0 && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Erros retornados:</strong>
                          <ul className="list-disc list-inside mt-2">
                            {(resultado.data.value as any).errors.map((erro: string, idx: number) => (
                              <li key={idx}>{erro}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {resultado.data.value?.idCotacao && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">ID Cotação:</span> {resultado.data.value.idCotacao}
                        </p>
                      </div>
                    )}
                    
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {resultado.error || 'Erro desconhecido'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

