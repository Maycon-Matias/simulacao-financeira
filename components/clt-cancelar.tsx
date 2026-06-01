"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, XCircle, CheckCircle2, Trash2 } from "lucide-react"

export function CLTCancelar() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [propostaId, setPropostaId] = useState('')

  const handleCancelar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const response = await fetch('/api/produto/clt/cancelar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ propostaId }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setErro(data.error || 'Erro ao cancelar proposta')
      } else {
        setResultado(data.data)
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao cancelar proposta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            Cancelar Proposta CLT
          </CardTitle>
          <CardDescription className="mt-2">
            Cancele uma proposta CLT enviada anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCancelar} className="space-y-4">
            <div>
              <Label htmlFor="propostaId">ID da Proposta *</Label>
              <Input
                id="propostaId"
                value={propostaId}
                onChange={(e) => setPropostaId(e.target.value)}
                required
                placeholder="455552"
              />
              <p className="text-sm text-gray-500 mt-1">
                Informe o ID da proposta que deseja cancelar
              </p>
            </div>

            <Button type="submit" disabled={loading || !propostaId} className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancelar Proposta
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
                  <p className="font-semibold">{resultado.value?.mensagem || 'Proposta cancelada com sucesso!'}</p>
                  {resultado.value?.propostaId && (
                    <p className="text-sm mt-1">
                      Proposta ID: {resultado.value.propostaId}
                    </p>
                  )}
                  {resultado.value?.situacao !== undefined && (
                    <p className="text-sm mt-1">
                      Situação: {resultado.value.situacao} (6 = Cancelada)
                    </p>
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

