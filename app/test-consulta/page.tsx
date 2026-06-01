'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Search } from 'lucide-react'

export default function TestConsultaPage() {
  const [cpf, setCpf] = useState('05933953954')
  const [apiId, setApiId] = useState('hubcredito-default')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)

  const consultar = async () => {
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
      alert('CPF inválido. Forneça um CPF com 11 dígitos.')
      return
    }

    const cpfLimpo = cpf.replace(/\D/g, '')
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const response = await fetch('/api/produto/consultar-clt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpfTrabalhador: cpfLimpo,
          apiId: apiId
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setResultado(data)
      } else {
        setErro(data.error || 'Erro desconhecido')
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao fazer requisição')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Teste de Consulta de CPF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF do registro</Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="00000000000"
              maxLength={14}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api">API</Label>
            <select
              id="api"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="hubcredito-default">HubCredito (Padrão)</option>
              <option value="presencabank-default">Banco Presença (Padrão)</option>
            </select>
          </div>

          <Button 
            onClick={consultar} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Consultar
              </>
            )}
          </Button>

          {erro && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-800 font-semibold">❌ Erro:</p>
                <p className="text-red-600">{erro}</p>
              </CardContent>
            </Card>
          )}

          {resultado && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">
                  ✅ Resultado da Consulta
                  {resultado.apiName && (
                    <span className="text-sm font-normal text-green-600 ml-2">
                      - {resultado.apiName}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-white p-4 rounded border overflow-auto text-xs">
                  {JSON.stringify(resultado.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

