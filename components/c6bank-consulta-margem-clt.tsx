"use client"

/**
 * Consulta de Margem CLT - C6 Bank
 * Fluxo correto: Link de autorização → Status → Oferta (margem/limite)
 * Sem matrícula nem renda - o banco consulta eSocial/empregador após autorização.
 */

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Shield, DollarSign, FileText, entidade, ExternalLink } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

export function C6BankConsultaMargemCLT() {
  const [loading, setLoading] = useState(false)
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>("")

  const [cpf, setCpf] = useState("")
  const [nome, setNome] = useState("")
  const [dataNascimento, setDataNascimento] = useState("")

  const [link, setLink] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter((c) => c.active && c.type === "c6bank")
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error("Erro ao carregar APIs:", error)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const dadosCompartilhados = localStorage.getItem("whatsapp_cliente_dados")
        if (dadosCompartilhados) {
          const dados = JSON.parse(dadosCompartilhados)
          if (dados.cpf) {
            const d = dados.cpf.replace(/\D/g, "")
            setCpf(d.length <= 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d)
          }
          if (dados.nome) setNome(dados.nome)
          if (dados.data_nascimento) setDataNascimento(dados.data_nascimento)
          localStorage.removeItem("whatsapp_cliente_dados")
        }
      } catch (error) {
        console.error("Erro ao carregar dados compartilhados:", error)
      }
    }
  }, [])

  const cpfLimpo = cpf.replace(/\D/g, "")

  const formatarCPF = (value: string) => {
    const limpo = value.replace(/\D/g, "")
    if (limpo.length <= 11) return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    return value
  }

  const formatarDataNascimento = (value: string) => {
    const limpo = value.replace(/\D/g, "")
    if (limpo.length <= 8) return limpo.replace(/(\d{2})(\d{2})(\d{4})/, "$1/$2/$3")
    return value
  }

  async function gerarLink() {
    setLoading(true)
    setErro(null)
    setLink(null)
    setStatus(null)
    setResultado(null)
    try {
      const res = await fetch("/api/produto/c6bank/clt/authorization-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId: apiSelecionada,
          cpf: cpfLimpo,
          nome: nome.trim(),
          data_nascimento: dataNascimento,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Falha ao gerar link")
      setLink(data.link)
    } catch (e: any) {
      setErro(e.message || "Erro")
    } finally {
      setLoading(false)
    }
  }

  async function checarStatus() {
    setLoading(true)
    setErro(null)
    setStatus(null)
    try {
      const res = await fetch("/api/produto/c6bank/clt/authorization-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: apiSelecionada, cpf: cpfLimpo }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Falha ao consultar status")
      setStatus(data.status)
    } catch (e: any) {
      setErro(e.message || "Erro")
    } finally {
      setLoading(false)
    }
  }

  async function consultarOferta() {
    setLoading(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await fetch("/api/produto/c6bank/clt/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: apiSelecionada, cpf: cpfLimpo }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Falha ao consultar oferta")
      setResultado(data)
    } catch (e: any) {
      setErro(e.message || "Erro")
    } finally {
      setLoading(false)
    }
  }

  const temMargem = resultado?.temMargem === true

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Consulta de Margem CLT - C6 Bank
          </CardTitle>
          <CardDescription>
            Fluxo: 1) Gerar link de autorização → 2) registro autoriza → 3) Checar status → 4) Oferta (margem). Sem matrícula nem renda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API C6 Bank</Label>
            <select
              value={apiSelecionada}
              onChange={(e) => setApiSelecionada(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={loading}
            >
              <option value="">Selecione</option>
              {apisDisponiveis.map((api) => (
                <option key={api.id} value={api.id}>{api.name}</option>
              ))}
            </select>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <entidade className="h-4 w-4" />
              Dados do registro
            </h3>
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
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do registro"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de nascimento * (DD/MM/AAAA)</Label>
                <Input
                  id="dataNascimento"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(formatarDataNascimento(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={gerarLink}
              disabled={loading || !apiSelecionada || cpfLimpo.length !== 11 || !nome.trim() || !dataNascimento}
              variant="outline"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : "1) Gerar link"}
            </Button>
            <Button
              onClick={checarStatus}
              disabled={loading || !apiSelecionada || cpfLimpo.length !== 11}
              variant="outline"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Consultando...</> : "2) Status"}
            </Button>
            <Button
              onClick={consultarOferta}
              disabled={loading || !apiSelecionada || cpfLimpo.length !== 11}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Consultando...</> : "3) Oferta (margem)"}
            </Button>
          </div>

          {link && (
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-1">Link de autorização:</div>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-blue-600 hover:underline flex items-center gap-1"
                >
                  {link}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-sm text-gray-600 mt-2">Envie ao registro para autorizar. Depois use "2) Status" e "3) Oferta".</p>
              </AlertDescription>
            </Alert>
          )}

          {status && (
            <Alert variant={status === "AUTORIZADO" ? "default" : "destructive"}>
              <AlertDescription>
                <span className="font-semibold">Status: </span>
                {status}
                {status === "AUTORIZADO" && <span className="block text-sm text-gray-600 mt-1">Pode usar "3) Oferta (margem)".</span>}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {temMargem ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {temMargem ? "registro com Margem Disponível" : "registro sem Margem Disponível"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {temMargem && resultado.margem && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultado.margem.valor_cliente != null && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Valor do registro</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      R$ {parseFloat(String(resultado.margem.valor_cliente || "0")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {resultado.margem.quantidade_parcelas != null && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-900">Quantidade de Parcelas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{resultado.margem.quantidade_parcelas || "N/A"}</p>
                  </div>
                )}
                {resultado.margem.valor_parcela != null && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-purple-900">Valor da Parcela</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      R$ {parseFloat(String(resultado.margem.valor_parcela || "0")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!temMargem && resultado.motivo && (
              <Alert>
                <AlertDescription>{resultado.motivo}</AlertDescription>
              </Alert>
            )}

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">Detalhes da Resposta</h4>
              <pre className="text-xs overflow-auto bg-white p-3 rounded border max-h-96">{JSON.stringify(resultado, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
