"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, XCircle, CheckCircle2, Briefcase, DollarSign } from "lucide-react"

interface VinculoOffline {
  valorDisponivel?: number
  valorMargemDisponivel?: number
  valorBaseMargem?: number
  valorTotalVencimentos?: number
  nomeEmpregador?: string
  cpfTrabalhador?: string
  nomeTrabalhador?: string
  elegivel?: boolean
  [key: string]: any
}

export function CLTConsultaIndividualFactaOffline() {
  const [cpf, setCpf] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [vinculos, setVinculos] = useState<VinculoOffline[]>([])

  const handleConsultar = async () => {
    setLoading(true)
    setErro(null)
    setVinculos([])

    try {
      const cpfLimpo = cpf.replace(/\D/g, "")
      if (cpfLimpo.length !== 11) {
        setErro("CPF deve conter 11 dígitos")
        setLoading(false)
        return
      }

      const response = await fetch("/api/produto/facta/offline/consultar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf: cpfLimpo }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data?.success) {
        const msg: string =
          data?.error ||
          data?.mensagem ||
          (data?.data && typeof data.data === "object" ? (data.data as any).mensagem : "") ||
          "Erro ao consultar base OFFLINE FACTA"

        setErro(msg)
        return
      }

      const payload = data.data || {}
      const lista: VinculoOffline[] = Array.isArray(payload.vinculos)
        ? payload.vinculos
        : Array.isArray(payload.data?.vinculos)
        ? payload.data.vinculos
        : []

      setVinculos(lista)
    } catch (e: any) {
      setErro(e?.message || "Erro inesperado ao consultar base OFFLINE FACTA")
    } finally {
      setLoading(false)
    }
  }

  const formatarMoeda = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return "N/A"
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor)
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Briefcase className="h-5 w-5 text-orange-600" />
            Consulta FACTA Individual (OFFLINE)
          </CardTitle>
          <CardDescription>
            Consulta de vínculos CLT na base histórica da FACTA, sem necessidade de autorização por SMS/WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cpf-offline-facta">CPF do Trabalhador</Label>
            <Input
              id="cpf-offline-facta"
              value={cpf}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "")
                if (v.length <= 11) setCpf(v)
              }}
              placeholder="12345678900"
              className="font-mono text-sm"
              maxLength={11}
            />
            <p className="mt-1 text-xs text-gray-500">
              Consulta na base OFFLINE da FACTA. Os dados podem estar desatualizados em relação à base online.
            </p>
          </div>

          <Button
            onClick={handleConsultar}
            disabled={loading || cpf.replace(/\D/g, "").length !== 11}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-700 hover:to-amber-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Consultando base OFFLINE...
              </>
            ) : (
              "Consultar Vínculos (OFFLINE)"
            )}
          </Button>

          {erro && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {!erro && vinculos.length > 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900">
                Encontramos {vinculos.length} vínculo(s) na base OFFLINE da FACTA.
              </AlertDescription>
            </Alert>
          )}

          {!erro && !loading && vinculos.length === 0 && cpf.replace(/\D/g, "").length === 11 && (
            <Alert>
              <AlertDescription className="text-sm text-gray-700">
                Nenhum vínculo encontrado na base OFFLINE para este CPF.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {vinculos.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Resultado da Consulta OFFLINE</CardTitle>
            <CardDescription>Vínculos retornados pela base histórica da FACTA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vinculos.map((v, idx) => {
              const margem =
                v.valorDisponivel ??
                v.valorMargemDisponivel ??
                v.valorBaseMargem ??
                v.valorTotalVencimentos ??
                null

              return (
                <div key={idx} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-orange-600" />
                      <span className="font-semibold text-gray-800">
                        Trabalho #{idx + 1} {v.nomeEmpregador ? `- ${v.nomeEmpregador}` : ""}
                      </span>
                    </div>
                    <Badge variant={v.elegivel ? "default" : "outline"} className={v.elegivel ? "bg-green-600" : ""}>
                      {v.elegivel ? "Elegível" : "Não elegível"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                    <p>
                      <strong>Nome:</strong> {v.nomeTrabalhador || "N/A"}
                    </p>
                    <p>
                      <strong>CPF:</strong> {v.cpfTrabalhador || "N/A"}
                    </p>
                    <p className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-green-600" />
                      <span>
                        <strong>Margem disponível (estimada):</strong> {formatarMoeda(margem as number | undefined)}
                      </span>
                    </p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

