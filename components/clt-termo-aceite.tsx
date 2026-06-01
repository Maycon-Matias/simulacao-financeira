"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, FileText, ExternalLink, Calendar } from "lucide-react"
import { Select } from "@/components/ui/select"

export function CLTTermoAceite() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [formData, setFormData] = useState({
    lojaId: '',
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    sexo: 'Masculino',
  })

  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/produto/entidade-info')
      const data = await response.json()
      if (data.success && data.userInfo) {
        setUserInfo(data.userInfo)
        const primeiraLoja = data.userInfo.lojasAtivas?.[0]
        if (primeiraLoja) {
          setFormData(prev => ({ ...prev, lojaId: primeiraLoja.lojaId.toString() }))
        }
      }
    } catch (error) {
      console.error("Erro ao carregar informações do usuário:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setResultado(null)

    try {
      const response = await fetch('/api/produto/clt/termo-aceite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setErro(data.error || 'Erro ao gerar termo de aceite')
      } else {
        setResultado(data.data)
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao gerar termo de aceite')
    } finally {
      setLoading(false)
    }
  }

  const isTermoValido = resultado?.value?.dataValidade && new Date(resultado.value.dataValidade) > new Date()

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            Termo de Aceite CLT
          </CardTitle>
          <CardDescription className="mt-2">
            Gere ou verifique o termo de aceite necessário para consultar vínculos CLT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lojaId">Loja ID *</Label>
                <Input
                  id="lojaId"
                  value={formData.lojaId}
                  onChange={(e) => setFormData({ ...formData, lojaId: e.target.value })}
                  required
                  type="number"
                />
              </div>
              <div>
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, '')
                    if (valor.length <= 11) {
                      setFormData({ ...formData, cpf: valor })
                    }
                  }}
                  required
                  placeholder="12345678900"
                  maxLength={11}
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => {
                    const valor = e.target.value.replace(/\D/g, '')
                    setFormData({ ...formData, telefone: valor })
                  }}
                  required
                  placeholder="27988887777"
                />
              </div>
              <div>
                <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                  required
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
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200" size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Termo...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar/Verificar Termo
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
            <Alert className={`mt-4 ${isTermoValido ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
              <CheckCircle2 className={`h-4 w-4 ${isTermoValido ? 'text-green-600' : 'text-yellow-600'}`} />
              <AlertDescription className={isTermoValido ? 'text-green-900' : 'text-yellow-900'}>
                {isTermoValido ? (
                  <div>
                    <p className="font-semibold">Termo válido encontrado!</p>
                    <p className="text-sm mt-1">
                      Válido até: {new Date(resultado.value.dataValidade).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold">Termo gerado com sucesso!</p>
                    <p className="text-sm mt-1">
                      O registro precisa assinar o termo em:
                    </p>
                    <a
                      href={`https://termo.hubcredito.com.br/?cpf=${formData.cpf}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 mt-2"
                    >
                      https://termo.hubcredito.com.br/
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {resultado && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border">
              <h4 className="font-semibold mb-2">Detalhes do Termo:</h4>
              <div className="space-y-1 text-sm">
                <p><strong>ID:</strong> {resultado.value?.id}</p>
                {resultado.value?.dataAceite && (
                  <p><strong>Data de Aceite:</strong> {new Date(resultado.value.dataAceite).toLocaleString('pt-BR')}</p>
                )}
                {resultado.value?.dataValidade && (
                  <p><strong>Data de Validade:</strong> {new Date(resultado.value.dataValidade).toLocaleString('pt-BR')}</p>
                )}
                {resultado.value?.bancarizador && (
                  <p><strong>Bancarizador:</strong> {resultado.value.bancarizador}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

