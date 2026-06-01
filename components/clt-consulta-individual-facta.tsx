"use client"

/**
 * Consulta individual FACTA (Consulta Dados CLT – Manual WebService FACTA v2.0).
 * Utiliza o mesmo fluxo de consulta por CPF; o trabalhador deve ter autorizado a consulta previamente
 * (solicita-autorizacao-consulta por SMS ou WhatsApp) ou já possuir autorização válida.
 */

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Building2, AlertCircle } from "lucide-react"
import { ProdutoConsultarCLT } from "@/components/produto-consultar-clt"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type TipoEnvio = "SMS" | "WHATSAPP"

export function CLTConsultaIndividualFacta() {
  const [factaApiId, setFactaApiId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ultimaMensagemErro, setUltimaMensagemErro] = useState<string | null>(null)
  const [requiresAuthorization, setRequiresAuthorization] = useState(false)
  const [solicitacaoLoading, setSolicitacaoLoading] = useState(false)
  const [solicitacaoSuccess, setSolicitacaoSuccess] = useState<string | null>(null)
  const [solicitacaoError, setSolicitacaoError] = useState<string | null>(null)
  const [nome, setNome] = useState("")
  const [cpf, setCpf] = useState("")
  const [celular, setCelular] = useState("")
  const [tipoEnvio, setTipoEnvio] = useState<TipoEnvio>("WHATSAPP")

  useEffect(() => {
    let cancelled = false
    fetch("/api/produto/apis-clt")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json?.success || !Array.isArray(json.data)) return
        const facta = json.data.find((a: { type?: string }) => a.type === "facta")
        if (facta?.id) {
          setFactaApiId(facta.id)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleConsultaErro = (mensagem: string) => {
    setUltimaMensagemErro(mensagem || null)
    setSolicitacaoSuccess(null)
    setSolicitacaoError(null)

    const normalized = (mensagem || "").toLowerCase()
    if (
      normalized.includes("solicita-autorizacao-consulta") ||
      (normalized.includes("token expirado") && normalized.includes("autorizacao"))
    ) {
      setRequiresAuthorization(true)
    }
  }

  const handleConsultaSucesso = () => {
    setUltimaMensagemErro(null)
    setRequiresAuthorization(false)
    setSolicitacaoSuccess(null)
    setSolicitacaoError(null)
  }

  const handleSolicitarAutorizacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factaApiId) return

    setSolicitacaoLoading(true)
    setSolicitacaoSuccess(null)
    setSolicitacaoError(null)

    try {
      const response = await fetch("/api/produto/facta/solicitar-autorizacao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiId: factaApiId,
          nome,
          cpf,
          celular,
          tipo_envio: tipoEnvio,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.success) {
        setSolicitacaoError(
          data?.error ||
            "Erro ao solicitar autorização na FACTA. Verifique os dados preenchidos e tente novamente.",
        )
        return
      }

      setSolicitacaoSuccess(
        "Autorização solicitada com sucesso. A FACTA enviará o link ao registro por SMS/WhatsApp.",
      )
      setRequiresAuthorization(false)
    } catch (error: any) {
      setSolicitacaoError(error?.message || "Erro inesperado ao solicitar autorização na FACTA.")
    } finally {
      setSolicitacaoLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!factaApiId) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <Building2 className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900">
          <strong>API FACTA não configurada.</strong> Acesse a aba Configuração e cadastre a API Facta
          (tipo Facta) com a URL base, usuário e ****** fornecidos pela FACTA. Em seguida, volte aqui para
          realizar a consulta individual por CPF.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Consulta de dados do trabalhador (vínculos CLT) via FACTA. O CPF deve possuir autorização prévia
        para consulta (solicitada pela FACTA por SMS ou WhatsApp). Token válido por 1 hora.
      </p>

      {requiresAuthorization && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                A FACTA informou que a autorização do registro está expirada ou ausente.
              </p>
              <p className="mt-1 text-xs text-amber-900">
                Envie um novo termo de autorização pelo endpoint{" "}
                <code className="rounded bg-amber-100 px-1 text-[11px]">solicita-autorizacao-consulta</code>{" "}
                preenchendo os dados abaixo. Após o registro autorizar, refaça a consulta pelo CPF.
              </p>
              {ultimaMensagemErro && (
                <p className="mt-1 text-xs text-amber-900">
                  <strong>Mensagem da FACTA:</strong> {ultimaMensagemErro}
                </p>
              )}
            </div>
          </div>

          <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSolicitarAutorizacao}>
            <div className="space-y-1">
              <Label htmlFor="facta-nome">Nome do registro</Label>
              <Input
                id="facta-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo do trabalhador"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facta-cpf">CPF do registro</Label>
              <Input
                id="facta-cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                placeholder="Somente números"
                maxLength={11}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facta-celular">Celular (DDD + número)</Label>
              <Input
                id="facta-celular"
                value={celular}
                onChange={(e) => setCelular(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex.: 11999999999"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facta-tipo-envio">Tipo de envio</Label>
              <select
                id="facta-tipo-envio"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={tipoEnvio}
                onChange={(e) => setTipoEnvio(e.target.value as TipoEnvio)}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={solicitacaoLoading}
                className="w-full bg-amber-600 text-white hover:bg-amber-700"
              >
                {solicitacaoLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando autorização...
                  </>
                ) : (
                  "Solicitar autorização FACTA"
                )}
              </Button>
            </div>
          </form>

          {solicitacaoError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{solicitacaoError}</AlertDescription>
            </Alert>
          )}

          {solicitacaoSuccess && (
            <Alert className="mt-2 border-emerald-200 bg-emerald-50">
              <AlertCircle className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-xs text-emerald-900">{solicitacaoSuccess}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <ProdutoConsultarCLT apiId={factaApiId} onError={handleConsultaErro} onSuccess={handleConsultaSucesso} />
    </div>
  )
}
