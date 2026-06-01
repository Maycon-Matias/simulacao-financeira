"use client"

/**
 * Simulação de Margem Livre C6 Bank
 * Manual V28 - Simulação de Margem Livre / Aumento Margem Livre
 */

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, Calculator, DollarSign, FileText, entidade, Calendar } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

export function C6BankSimularMargem() {
  const [loading, setLoading] = useState(false)
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [productTypeCode, setProductTypeCode] = useState<string>('0007') // 0007 = Aumento Margem Livre
  const [simulationType, setSimulationType] = useState<'POR_VALOR_SOLICITADO' | 'POR_VALOR_PARCELA'>('POR_VALOR_SOLICITADO')
  const [covenantGroup, setCovenantGroup] = useState<string>('INSS')
  const [publicAgency, setPublicAgency] = useState<string>('000001')
  const [operationType, setOperationType] = useState<string>('NOVA')
  
  // Dados do registro
  const [cpfCliente, setCpfCliente] = useState('')
  const [matricula, setMatricula] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [renda, setRenda] = useState('')
  
  // Parâmetros de simulação
  const [valorSolicitado, setValorSolicitado] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('')
  
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

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

  const formatarMoeda = (value: string) => {
    const numero = value.replace(/\D/g, '')
    if (numero) {
      const valor = (parseInt(numero) / 100).toFixed(2)
      return valor.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    }
    return ''
  }

  const handleSimular = async () => {
    if (!apiSelecionada) {
      setErro('Selecione uma API C6 Bank')
      return
    }

    const cpfClienteLimpo = cpfCliente.replace(/\D/g, '')
    if (cpfClienteLimpo.length !== 11) {
      setErro('CPF do registro deve ter 11 dígitos')
      return
    }

    if (!matricula.trim()) {
      setErro('Matrícula é obrigatória')
      return
    }

    const dataNascimentoLimpa = dataNascimento.replace(/\D/g, '')
    if (dataNascimentoLimpa.length !== 8) {
      setErro('Data de nascimento deve estar no formato DD/MM/AAAA')
      return
    }

    const rendaNum = parseFloat(renda.replace(/\./g, '').replace(',', '.'))
    if (!rendaNum || rendaNum <= 0) {
      setErro('Renda deve ser maior que zero')
      return
    }

    if (!quantidadeParcelas || parseInt(quantidadeParcelas) < 1) {
      setErro('Quantidade de parcelas deve ser maior que zero')
      return
    }

    if (simulationType === 'POR_VALOR_SOLICITADO') {
      const valorSolicitadoNum = parseFloat(valorSolicitado.replace(/\./g, '').replace(',', '.'))
      if (!valorSolicitadoNum || valorSolicitadoNum <= 0) {
        setErro('Valor solicitado deve ser maior que zero')
        return
      }
    } else {
      const valorParcelaNum = parseFloat(valorParcela.replace(/\./g, '').replace(',', '.'))
      if (!valorParcelaNum || valorParcelaNum <= 0) {
        setErro('Valor da parcela deve ser maior que zero')
        return
      }
    }

    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      // Converte DD/MM/AAAA para YYYY-MM-DD
      const [dia, mes, ano] = dataNascimento.split('/')
      const dataFormatada = `${ano}-${mes}-${dia}`

      const body: any = {
        apiId: apiSelecionada,
        product_type_code: productTypeCode,
        simulation_type: simulationType,
        covenant_group: covenantGroup,
        public_agency: publicAgency,
        operation_type: operationType,
        installment_quantity: parseInt(quantidadeParcelas),
        client: {
          tax_identifier: cpfClienteLimpo,
          enrollment: matricula.trim(),
          birth_date: dataFormatada,
          income_amount: rendaNum
        }
      }

      if (simulationType === 'POR_VALOR_SOLICITADO') {
        body.request_amount = parseFloat(valorSolicitado.replace(/\./g, '').replace(',', '.'))
      } else {
        body.installment_amount = parseFloat(valorParcela.replace(/\./g, '').replace(',', '.'))
      }

      const response = await fetch('/api/produto/c6bank/simular-margem-livre', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!data.success) {
        setErro(data.error || 'Erro ao simular Margem Livre')
        return
      }

      setResultado(data.data)
    } catch (error: any) {
      console.error('[C6BankSimularMargem] Erro ao simular:', error)
      setErro(error.message || 'Erro desconhecido ao simular Margem Livre. Verifique o console para mais detalhes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Simulação de Margem Livre C6 Bank
          </CardTitle>
          <CardDescription>
            Simule Margem Livre ou Aumento Margem Livre via C6 Bank
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione a API C6 Bank</Label>
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
              <Label htmlFor="productTypeCode">Tipo de Produto</Label>
              <select
                id="productTypeCode"
                value={productTypeCode}
                onChange={(e) => setProductTypeCode(e.target.value)}
                className="w-full p-2 border rounded-md"
                disabled={loading}
              >
                <option value="0007">0007 - Aumento Margem Livre</option>
                <option value="0001">0001 - Margem Livre</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="simulationType">Tipo de Simulação</Label>
              <select
                id="simulationType"
                value={simulationType}
                onChange={(e) => setSimulationType(e.target.value as 'POR_VALOR_SOLICITADO' | 'POR_VALOR_PARCELA')}
                className="w-full p-2 border rounded-md"
                disabled={loading}
              >
                <option value="POR_VALOR_SOLICITADO">Por Valor Solicitado</option>
                <option value="POR_VALOR_PARCELA">Por Valor da Parcela</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <entidade className="h-4 w-4" />
              Dados do registro
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpfCliente">CPF *</Label>
                <Input
                  id="cpfCliente"
                  value={cpfCliente}
                  onChange={(e) => setCpfCliente(formatarCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula *</Label>
                <Input
                  id="matricula"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Número da matrícula"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de Nascimento * (DD/MM/AAAA)</Label>
                <Input
                  id="dataNascimento"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(formatarDataNascimento(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="renda">Renda Mensal * (R$)</Label>
                <Input
                  id="renda"
                  value={renda}
                  onChange={(e) => setRenda(formatarMoeda(e.target.value))}
                  placeholder="0,00"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Parâmetros de Simulação
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {simulationType === 'POR_VALOR_SOLICITADO' ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="valorSolicitado">Valor Solicitado * (R$)</Label>
                  <Input
                    id="valorSolicitado"
                    value={valorSolicitado}
                    onChange={(e) => setValorSolicitado(formatarMoeda(e.target.value))}
                    placeholder="0,00"
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="valorParcela">Valor da Parcela * (R$)</Label>
                  <Input
                    id="valorParcela"
                    value={valorParcela}
                    onChange={(e) => setValorParcela(formatarMoeda(e.target.value))}
                    placeholder="0,00"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="quantidadeParcelas">Quantidade de Parcelas *</Label>
                <Input
                  id="quantidadeParcelas"
                  type="number"
                  value={quantidadeParcelas}
                  onChange={(e) => setQuantidadeParcelas(e.target.value)}
                  placeholder="Ex: 84"
                  min="1"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="covenantGroup">Grupo de Convênio</Label>
                <select
                  id="covenantGroup"
                  value={covenantGroup}
                  onChange={(e) => setCovenantGroup(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  disabled={loading}
                >
                  <option value="INSS">INSS</option>
                  <option value="SIAPE_SERVIDOR">SIAPE Servidor</option>
                  <option value="SIAPE_PENSIONISTA">SIAPE Pensionista</option>
                  <option value="AUXILIO_BRASIL">Auxílio Brasil</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicAgency">Órgão Público</Label>
                <Input
                  id="publicAgency"
                  value={publicAgency}
                  onChange={(e) => setPublicAgency(e.target.value)}
                  placeholder="000001"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="operationType">Tipo de Operação</Label>
                <select
                  id="operationType"
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  disabled={loading}
                >
                  <option value="NOVA">Nova</option>
                  <option value="REFINANCIAMENTO">Refinanciamento</option>
                </select>
              </div>
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSimular}
            disabled={loading || !apiSelecionada || !cpfCliente || !matricula || !dataNascimento || !renda || !quantidadeParcelas || (simulationType === 'POR_VALOR_SOLICITADO' ? !valorSolicitado : !valorParcela)}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Simular Margem Livre
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Simulação Realizada com Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tenta exibir campos específicos se existirem */}
            {(resultado.valor_cliente || resultado.valor_parcela || resultado.quantidade_parcelas) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultado.valor_cliente && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Valor do registro</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      R$ {parseFloat(String(resultado.valor_cliente || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {resultado.quantidade_parcelas && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900">Quantidade de Parcelas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {resultado.quantidade_parcelas || 'N/A'}
                    </p>
                  </div>
                )}

                {resultado.valor_parcela && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">Valor da Parcela</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      R$ {parseFloat(String(resultado.valor_parcela || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}

                {resultado.taxa_juros && (
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Calculator className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold text-orange-900">Taxa de Juros</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-700">
                      {parseFloat(String(resultado.taxa_juros || '0')).toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Dados Completos da Simulação</h4>
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
