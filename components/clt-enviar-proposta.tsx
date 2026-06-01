"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, CheckCircle2, XCircle, Building2, Banknote, entidade, MapPin, Phone, CreditCard } from "lucide-react"
import { Select } from "@/components/ui/select"

interface CLTEnviarPropostaProps {
  onSuccess?: (dados: any) => void
  onError?: (erro: string) => void
  dadosAnteriores?: any
}

export function CLTEnviarProposta({ onSuccess, onError, dadosAnteriores }: CLTEnviarPropostaProps = {}) {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [formData, setFormData] = useState({
    // Dados básicos
    lojaId: '',
    cpfAtendente: '',
    cpfCliente: '',
    
    // Dados da simulação (preenchidos automaticamente se vier da simulação)
    dataPrimeiraParcela: '',
    valorVista: '',
    valorBruto: '',
    tabelaComercial: '',
    plano: '',
    valorParcela: '',
    SimulacaoId: '',
    valorTac: '',
    
    // Dados bancários
    banco: '',
    agencia: '',
    digitoAgencia: '',
    conta: '',
    digitoConta: '',
    tipoContaBancaria: '1', // 1 = Conta Corrente, 2 = Poupança
    
    // Chave PIX
    tipoChavePix: 'NaturalRegistrationNumber', // CPF
    valorChavePix: '',
    
    // Dados do registro
    nomeCliente: '',
    dataNascimento: '',
    rg: '',
    orgaoEmissorRg: 'SSP',
    ufOrgaoEmissorRg: 'ES',
    dataEmissaoRg: '',
    mae: '',
    pai: '',
    sexo: '0', // 0 = Masculino, 1 = Feminino
    estadoCivil: 'Solteiro',
    email: '',
    naturalidade: '',
    tipoResidencia: 'Proprio',
    tempoResidencia: '',
    ocupacao: '5',
    cargo: '',
    organizacao: '',
    valorRenda: '',
    valorRendaExtra: '0',
    tempoServico: '',
    quantidadeDependentes: '0',
    
    // Endereço
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: 'ES',
    cep: '',
    
    // Telefone
    ddd: '',
    numeroTelefone: '',
  })

  useEffect(() => {
    loadUserInfo()
    
    // Verifica se há dados salvos da simulação
    const dadosSimulacao = localStorage.getItem('clt_simulacao_selecionada')
    if (dadosSimulacao) {
      try {
        const dados = JSON.parse(dadosSimulacao)
        setFormData(prev => ({
          ...prev,
          cpfCliente: dados.cpf || prev.cpfCliente,
          dataPrimeiraParcela: dados.dataDeVencimento ? dados.dataDeVencimento.split('T')[0] : prev.dataPrimeiraParcela,
          valorVista: dados.valorDesembolsoTrabalhador?.toString() || prev.valorVista,
          valorBruto: dados.valorDesembolsoTrabalhador?.toString() || prev.valorBruto,
          tabelaComercial: dados.tabelaFinanciamentoId?.toString() || prev.tabelaComercial,
          plano: dados.numeroParcelas?.toString() || prev.plano,
          valorParcela: dados.valorParcela?.toString() || prev.valorParcela,
          SimulacaoId: dados.simulacaoId?.toString() || prev.SimulacaoId,
          valorTac: dados.tac?.toString() || prev.valorTac,
        }))
        localStorage.removeItem('clt_simulacao_selecionada')
      } catch (error) {
        console.error('Erro ao carregar dados da simulação:', error)
      }
    }
  }, [])

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/produto/entidade-info')
      const data = await response.json()
      if (data.success && data.userInfo) {
        setUserInfo(data.userInfo)
        const primeiraLoja = data.userInfo.lojasAtivas?.[0]
        if (primeiraLoja) {
          setFormData(prev => ({
            ...prev,
            lojaId: primeiraLoja.lojaId.toString(),
            cpfAtendente: data.userInfo.cpf || prev.cpfAtendente,
          }))
        }
      }
    } catch (error) {
      console.error("Erro ao carregar informações do usuário:", error)
    }
  }

  const formatarMoeda = (valor: number | string) => {
    const num = typeof valor === 'string' ? parseFloat(valor) : valor
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num || 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      // Monta a estrutura completa da proposta
      const proposta = {
        lojaId: Number(formData.lojaId),
        cpfAtendente: formData.cpfAtendente.replace(/\D/g, ''),
        cpfCliente: formData.cpfCliente.replace(/\D/g, ''),
        dataPrimeiraParcela: formData.dataPrimeiraParcela,
        valorVista: Number(formData.valorVista),
        valorBruto: Number(formData.valorBruto),
        tabelaComercial: Number(formData.tabelaComercial),
        plano: Number(formData.plano),
        valorParcela: Number(formData.valorParcela),
        SimulacaoId: formData.SimulacaoId,
        valorTac: Number(formData.valorTac),
        contaBancaria: {
          banco: Number(formData.banco),
          agencia: Number(formData.agencia),
          digitoAgencia: formData.digitoAgencia,
          conta: Number(formData.conta),
          digitoConta: formData.digitoConta,
          tipoContaBancaria: Number(formData.tipoContaBancaria),
        },
        chavePix: {
          tipoChave: formData.tipoChavePix,
          valorChave: formData.valorChavePix.replace(/\D/g, ''),
        },
        registro: {
          documento: formData.cpfCliente.replace(/\D/g, ''),
          nome: formData.nomeCliente,
          pessoaFisica: {
            dataNascimento: formData.dataNascimento,
            rg: formData.rg,
            orgaoEmissorRg: formData.orgaoEmissorRg,
            ufOrgaoEmissorRg: formData.ufOrgaoEmissorRg,
            dataEmissaoRg: formData.dataEmissaoRg,
            mae: formData.mae,
            pai: formData.pai,
            sexo: Number(formData.sexo),
            estadoCivil: formData.estadoCivil,
            email: formData.email,
            naturalidade: formData.naturalidade,
            tipoResidencia: formData.tipoResidencia,
            tempoResidencia: Number(formData.tempoResidencia) || 0,
            ocupacao: Number(formData.ocupacao) || 5,
            cargo: formData.cargo,
            organizacao: formData.organizacao,
            valorRenda: Number(formData.valorRenda) || 0,
            valorRendaExtra: Number(formData.valorRendaExtra) || 0,
            tempoServico: Number(formData.tempoServico) || 0,
            falecido: false,
            quantidadeDependentes: Number(formData.quantidadeDependentes) || 0,
          },
          enderecos: [
            {
              logradouro: formData.logradouro,
              numero: Number(formData.numero) || 0,
              bairro: formData.bairro,
              cidade: formData.cidade,
              uf: formData.uf,
              cep: formData.cep.replace(/\D/g, ''),
              tipoEndereco: 'Residencial',
            }
          ],
          telefones: [
            {
              ddd: formData.ddd,
              numero: formData.numeroTelefone.replace(/\D/g, ''),
              tipoTelefone: 'Pessoal',
              renderPhone: `${formData.ddd}${formData.numeroTelefone.replace(/\D/g, '')}`,
            }
          ],
        },
      }

      const response = await fetch('/api/produto/clt/enviar-proposta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proposta),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errorMsg = data.error || 'Erro ao enviar proposta CLT'
        setErro(errorMsg)
        onError?.(errorMsg)
      } else {
        setResultado(data.data)
        onSuccess?.(data.data)
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao enviar proposta CLT'
      setErro(errorMsg)
      onError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <Send className="h-5 w-5 text-green-600" />
            </div>
            Enviar Proposta CLT
          </CardTitle>
          <CardDescription className="mt-2">
            Envie a proposta completa para aprovação com dados do registro, bancários e da simulação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Seção: Dados da Simulação */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-500" />
                Dados da Simulação Selecionada
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cpfCliente">CPF do registro *</Label>
                  <Input
                    id="cpfCliente"
                    value={formData.cpfCliente}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      if (valor.length <= 11) {
                        setFormData({ ...formData, cpfCliente: valor, valorChavePix: valor })
                      }
                    }}
                    placeholder="12345678900"
                    className="font-mono"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lojaId">Loja ID *</Label>
                  <Input
                    id="lojaId"
                    value={formData.lojaId}
                    onChange={(e) => setFormData({ ...formData, lojaId: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dataPrimeiraParcela">Data da Primeira Parcela *</Label>
                  <Input
                    id="dataPrimeiraParcela"
                    value={formData.dataPrimeiraParcela}
                    onChange={(e) => setFormData({ ...formData, dataPrimeiraParcela: e.target.value })}
                    type="date"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="valorVista">Valor à Vista (Líquido) *</Label>
                  <Input
                    id="valorVista"
                    value={formData.valorVista}
                    onChange={(e) => setFormData({ ...formData, valorVista: e.target.value })}
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tabelaComercial">Tabela Comercial (ID) *</Label>
                  <Input
                    id="tabelaComercial"
                    value={formData.tabelaComercial}
                    onChange={(e) => setFormData({ ...formData, tabelaComercial: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="plano">Número de Parcelas *</Label>
                  <Input
                    id="plano"
                    value={formData.plano}
                    onChange={(e) => setFormData({ ...formData, plano: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="valorParcela">Valor da Parcela *</Label>
                  <Input
                    id="valorParcela"
                    value={formData.valorParcela}
                    onChange={(e) => setFormData({ ...formData, valorParcela: e.target.value })}
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="SimulacaoId">Simulação ID *</Label>
                  <Input
                    id="SimulacaoId"
                    value={formData.SimulacaoId}
                    onChange={(e) => setFormData({ ...formData, SimulacaoId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="valorTac">Valor TAC *</Label>
                  <Input
                    id="valorTac"
                    value={formData.valorTac}
                    onChange={(e) => setFormData({ ...formData, valorTac: e.target.value })}
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="valorBruto">Valor Bruto *</Label>
                  <Input
                    id="valorBruto"
                    value={formData.valorBruto}
                    onChange={(e) => setFormData({ ...formData, valorBruto: e.target.value })}
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Seção: Dados Bancários */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-blue-500" />
                Dados Bancários
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="banco">Banco (Código) *</Label>
                  <Input
                    id="banco"
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    type="number"
                    placeholder="Ex: 33 (Santander)"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="agencia">Agência *</Label>
                  <Input
                    id="agencia"
                    value={formData.agencia}
                    onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="digitoAgencia">Dígito da Agência</Label>
                  <Input
                    id="digitoAgencia"
                    value={formData.digitoAgencia}
                    onChange={(e) => setFormData({ ...formData, digitoAgencia: e.target.value })}
                    maxLength={1}
                  />
                </div>
                <div>
                  <Label htmlFor="conta">Conta *</Label>
                  <Input
                    id="conta"
                    value={formData.conta}
                    onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="digitoConta">Dígito da Conta *</Label>
                  <Input
                    id="digitoConta"
                    value={formData.digitoConta}
                    onChange={(e) => setFormData({ ...formData, digitoConta: e.target.value })}
                    maxLength={1}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tipoContaBancaria">Tipo de Conta *</Label>
                  <Select
                    id="tipoContaBancaria"
                    value={formData.tipoContaBancaria}
                    onChange={(e) => setFormData({ ...formData, tipoContaBancaria: e.target.value })}
                    required
                  >
                    <option value="1">Conta Corrente</option>
                    <option value="2">Poupança</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Seção: Chave PIX */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-500" />
                Chave PIX
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipoChavePix">Tipo de Chave PIX *</Label>
                  <Select
                    id="tipoChavePix"
                    value={formData.tipoChavePix}
                    onChange={(e) => setFormData({ ...formData, tipoChavePix: e.target.value })}
                    required
                  >
                    <option value="NaturalRegistrationNumber">CPF</option>
                    <option value="LegalRegistrationNumber">CNPJ</option>
                    <option value="Phone">Telefone</option>
                    <option value="Email">Email</option>
                    <option value="Automatic">Automática (UUID)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="valorChavePix">Valor da Chave PIX *</Label>
                  <Input
                    id="valorChavePix"
                    value={formData.valorChavePix}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      setFormData({ ...formData, valorChavePix: valor })
                    }}
                    placeholder={formData.tipoChavePix === 'Email' ? 'email@exemplo.com' : '12345678900'}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Seção: Dados do registro */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <entidade className="h-5 w-5 text-indigo-500" />
                Dados Pessoais do registro
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nomeCliente">Nome Completo *</Label>
                  <Input
                    id="nomeCliente"
                    value={formData.nomeCliente}
                    onChange={(e) => setFormData({ ...formData, nomeCliente: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                  <Input
                    id="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                    type="date"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="rg">RG *</Label>
                  <Input
                    id="rg"
                    value={formData.rg}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="orgaoEmissorRg">Órgão Emissor do RG *</Label>
                  <Input
                    id="orgaoEmissorRg"
                    value={formData.orgaoEmissorRg}
                    onChange={(e) => setFormData({ ...formData, orgaoEmissorRg: e.target.value })}
                    placeholder="SSP"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="ufOrgaoEmissorRg">UF do Órgão Emissor *</Label>
                  <Input
                    id="ufOrgaoEmissorRg"
                    value={formData.ufOrgaoEmissorRg}
                    onChange={(e) => setFormData({ ...formData, ufOrgaoEmissorRg: e.target.value.toUpperCase() })}
                    maxLength={2}
                    placeholder="ES"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dataEmissaoRg">Data de Emissão do RG *</Label>
                  <Input
                    id="dataEmissaoRg"
                    value={formData.dataEmissaoRg}
                    onChange={(e) => setFormData({ ...formData, dataEmissaoRg: e.target.value })}
                    type="date"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="mae">Nome da Mãe *</Label>
                  <Input
                    id="mae"
                    value={formData.mae}
                    onChange={(e) => setFormData({ ...formData, mae: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="pai">Nome do Pai</Label>
                  <Input
                    id="pai"
                    value={formData.pai}
                    onChange={(e) => setFormData({ ...formData, pai: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="sexo">Sexo *</Label>
                  <Select
                    id="sexo"
                    value={formData.sexo}
                    onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                    required
                  >
                    <option value="0">Masculino</option>
                    <option value="1">Feminino</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="estadoCivil">Estado Civil *</Label>
                  <Select
                    id="estadoCivil"
                    value={formData.estadoCivil}
                    onChange={(e) => setFormData({ ...formData, estadoCivil: e.target.value })}
                    required
                  >
                    <option value="Solteiro">Solteiro</option>
                    <option value="Casado">Casado</option>
                    <option value="Divorciado">Divorciado</option>
                    <option value="Viúvo">Viúvo</option>
                    <option value="União Estável">União Estável</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    type="email"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="naturalidade">Naturalidade *</Label>
                  <Input
                    id="naturalidade"
                    value={formData.naturalidade}
                    onChange={(e) => setFormData({ ...formData, naturalidade: e.target.value })}
                    placeholder="Cidade de nascimento"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tipoResidencia">Tipo de Residência *</Label>
                  <Select
                    id="tipoResidencia"
                    value={formData.tipoResidencia}
                    onChange={(e) => setFormData({ ...formData, tipoResidencia: e.target.value })}
                    required
                  >
                    <option value="Proprio">Próprio</option>
                    <option value="Alugado">Alugado</option>
                    <option value="Cedido">Cedido</option>
                    <option value="Outros">Outros</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tempoResidencia">Tempo de Residência (meses) *</Label>
                  <Input
                    id="tempoResidencia"
                    value={formData.tempoResidencia}
                    onChange={(e) => setFormData({ ...formData, tempoResidencia: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="ocupacao">Ocupação (Código) *</Label>
                  <Input
                    id="ocupacao"
                    value={formData.ocupacao}
                    onChange={(e) => setFormData({ ...formData, ocupacao: e.target.value })}
                    type="number"
                    placeholder="5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cargo">Cargo *</Label>
                  <Input
                    id="cargo"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="organizacao">organizacao *</Label>
                  <Input
                    id="organizacao"
                    value={formData.organizacao}
                    onChange={(e) => setFormData({ ...formData, organizacao: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="valorRenda">Valor da Renda *</Label>
                  <Input
                    id="valorRenda"
                    value={formData.valorRenda}
                    onChange={(e) => setFormData({ ...formData, valorRenda: e.target.value })}
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tempoServico">Tempo de Serviço (meses) *</Label>
                  <Input
                    id="tempoServico"
                    value={formData.tempoServico}
                    onChange={(e) => setFormData({ ...formData, tempoServico: e.target.value })}
                    type="number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="quantidadeDependentes">Quantidade de Dependentes</Label>
                  <Input
                    id="quantidadeDependentes"
                    value={formData.quantidadeDependentes}
                    onChange={(e) => setFormData({ ...formData, quantidadeDependentes: e.target.value })}
                    type="number"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Endereço */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-500" />
                Endereço
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="logradouro">Logradouro *</Label>
                  <Input
                    id="logradouro"
                    value={formData.logradouro}
                    onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                    placeholder="Rua, Avenida, etc."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="uf">UF *</Label>
                  <Input
                    id="uf"
                    value={formData.uf}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                    maxLength={2}
                    placeholder="ES"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      if (valor.length <= 8) {
                        setFormData({ ...formData, cep: valor })
                      }
                    }}
                    placeholder="29000000"
                    maxLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Seção: Telefone */}
            <div className="pb-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-green-500" />
                Telefone
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ddd">DDD *</Label>
                  <Input
                    id="ddd"
                    value={formData.ddd}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      if (valor.length <= 2) {
                        setFormData({ ...formData, ddd: valor })
                      }
                    }}
                    maxLength={2}
                    placeholder="27"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="numeroTelefone">Número do Telefone *</Label>
                  <Input
                    id="numeroTelefone"
                    value={formData.numeroTelefone}
                    onChange={(e) => {
                      const valor = e.target.value.replace(/\D/g, '')
                      if (valor.length <= 9) {
                        setFormData({ ...formData, numeroTelefone: valor })
                      }
                    }}
                    placeholder="999999999"
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando Proposta...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Proposta para Aprovação
                </>
              )}
            </Button>
          </form>

          {erro && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {resultado && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <div>
                  <p className="font-medium">Proposta enviada com sucesso!</p>
                  {resultado.value && (
                    <div className="mt-2 text-sm">
                      <p>ID da Proposta: <strong>{resultado.value.id || resultado.value.propostaId}</strong></p>
                      {resultado.value.situacao !== undefined && (
                        <p>Situação: <strong>{resultado.value.situacao}</strong></p>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

