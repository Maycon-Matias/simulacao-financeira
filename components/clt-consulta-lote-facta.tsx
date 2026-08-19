"use client"

/**
 * Consulta em lote FACTA (Dados Trabalhador CLT).
 * Fluxo simples: o usuário envia um CSV com CPF (e opcionalmente nome),
 * o sistema chama /api/produto/consultar-clt com a API FACTA para cada linha
 * e exibe a margem/vínculos ou o erro retornado (incluindo falta de autorização).
 */

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, XCircle, FileSpreadsheet, Upload, Download, entidade, DollarSign, AlertCircle } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

type ModoConsultaFacta = "online" | "offline"

interface ClientePlanilha {
  cpf: string
  nome?: string
}

interface ResultadoConsulta {
  linha: number
  registro: ClientePlanilha
  sucesso: boolean
  margemDisponivel?: number
  quantidadeVinculos?: number
  possuiTabela?: boolean
  erro?: string
}

export function CLTConsultaLoteFacta() {
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [registro, setClientes] = useState<ClientePlanilha[]>([])
  const [resultados, setResultados] = useState<ResultadoConsulta[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 })
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const [apiSelecionada, setApiSelecionada] = useState<string>("")
  const [modoConsulta, setModoConsulta] = useState<ModoConsultaFacta>("online")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processamentoAtivoRef = useRef(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter((c) => c.active && c.type === "facta")
        setApisDisponiveis(configs)
        if (configs.length > 0 && !apiSelecionada) {
          setApiSelecionada(configs[0].id)
        }
      } catch (error) {
        console.error("Erro ao carregar APIs FACTA:", error)
      }
    }
  }, [apiSelecionada])

  const parseCSVLine = (linha: string, separador: string): string[] => {
    const valores: string[] = []
    let valorAtual = ""
    let dentroAspas = false

    for (let i = 0; i < linha.length; i++) {
      const char = linha[i]
      const proximoChar = linha[i + 1]

      if (char === '"') {
        if (dentroAspas && proximoChar === '"') {
          valorAtual += '"'
          i++
        } else {
          dentroAspas = !dentroAspas
        }
      } else if (char === separador && !dentroAspas) {
        valores.push(valorAtual.trim())
        valorAtual = ""
      } else {
        valorAtual += char
      }
    }

    valores.push(valorAtual.trim())
    return valores
  }

  const detectarSeparador = (linha: string): string => {
    const contaVirgula = (linha.match(/,/g) || []).length
    const contaPontoVirgula = (linha.match(/;/g) || []).length
    return contaPontoVirgula > contaVirgula ? ";" : ","
  }

  const processarCSV = (texto: string): ClientePlanilha[] => {
    const textoNormalizado = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const linhas = textoNormalizado.split("\n").filter((linha) => linha.trim())

    if (linhas.length < 2) {
      throw new Error("Planilha deve ter pelo menos uma linha de cabeçalho e uma linha de dados")
    }

    const separador = detectarSeparador(linhas[0])
    const cabecalho = parseCSVLine(linhas[0], separador).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""))
    const indices: Record<string, number> = {}

    cabecalho.forEach((col, idx) => {
      if (col.includes("cpf")) indices.cpf = idx
      if (col.includes("nome")) indices.nome = idx
    })

    if (indices.cpf === undefined) {
      throw new Error("Planilha deve conter a coluna: CPF")
    }

    const dados: ClientePlanilha[] = []
    const linhasInvalidas: number[] = []

    for (let i = 1; i < linhas.length; i++) {
      const valores = parseCSVLine(linhas[i], separador).map((v) => v.trim().replace(/^"|"$/g, ""))

      if (valores.length < cabecalho.length) continue

      let cpfRaw = valores[indices.cpf].trim()

      if (!cpfRaw || cpfRaw === "") {
        linhasInvalidas.push(i + 1)
        continue
      }

      if (/[eE][+-]?\d+/.test(cpfRaw)) {
        try {
          const numero = parseFloat(cpfRaw.replace(",", "."))
          if (!isNaN(numero)) {
            cpfRaw = Math.floor(numero).toString()
          }
        } catch (e) {
          console.warn(`Erro ao converter CPF de notação científica: ${cpfRaw}`, e)
        }
      }

      let cpf = cpfRaw.replace(/\D/g, "")

      if (cpf.length > 0 && cpf.length < 11) {
        cpf = cpf.padStart(11, "0")
      }

      if (cpf.length > 11) {
        cpf = cpf.slice(-11)
      }

      if (cpf.length !== 11) {
        linhasInvalidas.push(i + 1)
        continue
      }

      const nome = indices.nome !== undefined ? valores[indices.nome] : undefined

      dados.push({
        cpf,
        nome,
      })
    }

    if (linhasInvalidas.length > 0) {
      console.warn(
        `${linhasInvalidas.length} linha(s) foram ignoradas por terem dados inválidos. Linhas: ${linhasInvalidas
          .slice(0, 10)
          .join(", ")}${linhasInvalidas.length > 10 ? "..." : ""}`,
      )
    }

    return dados
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const nome = (file.name || "").toLowerCase()
    if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
      alert(
        "Para arquivos Excel (.xlsx/.xls), exporte primeiro como CSV no Excel (Salvar como → CSV UTF-8 ou CSV) e envie o arquivo .csv. O processamento em lote usa apenas arquivos CSV.",
      )
      event.target.value = ""
      return
    }

    setArquivo(file)
    setLoading(true)
    setClientes([])
    setResultados([])
    setProgresso({ atual: 0, total: 0, percentual: 0 })
    setCancelado(false)
    setPausado(false)
    processamentoAtivoRef.current = false

    try {
      const texto = await file.text()
      const dados = processarCSV(texto)

      if (dados.length === 0) {
        alert("Nenhum registro válido encontrado no arquivo. Verifique se os campos estão corretos.")
        setArquivo(null)
        return
      }

      setClientes(dados)
      setProgresso({ atual: 0, total: dados.length, percentual: 0 })
    } catch (error: any) {
      alert(`Erro ao processar arquivo: ${error.message}`)
      setArquivo(null)
    } finally {
      setLoading(false)
    }
  }

  const atualizarProgresso = (atual: number, total: number) => {
    const percentual = total > 0 ? Math.round((atual / total) * 100) : 0
    setProgresso({ atual, total, percentual })
  }

  const processarLote = async () => {
    if (modoConsulta === "online" && !apiSelecionada) {
      alert("Nenhuma API FACTA configurada/selecionada.")
      return
    }
    if (registro.length === 0) {
      alert("Carregue primeiro um arquivo CSV com os CPFs.")
      return
    }

    setProcessando(true)
    setCancelado(false)
    setPausado(false)
    processamentoAtivoRef.current = true
    setResultados([])
    atualizarProgresso(0, registro.length)

    const novosResultados: ResultadoConsulta[] = []

    for (let i = 0; i < registro.length; i++) {
      if (!processamentoAtivoRef.current) break

      const registro = registro[i]

      while (pausado && processamentoAtivoRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
      if (!processamentoAtivoRef.current) break

      try {
        let response: Response
        let data: any

        if (modoConsulta === "offline") {
          response = await fetch("/api/produto/facta/offline/consultar", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cpf: registro.cpf,
            }),
          })
        } else {
          response = await fetch("/api/produto/consultar-clt", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              cpfTrabalhador: registro.cpf,
              apiId: apiSelecionada,
            }),
          })
        }

        data = await response.json().catch(() => ({}))

        if (!response.ok || !data?.success) {
          const msg: string =
            data?.error ||
            data?.mensagem ||
            (data?.data && typeof data.data === "object" ? (data.data as any).mensagem : "") ||
            "Erro ao consultar vínculos FACTA"

          const resultado: ResultadoConsulta = {
            linha: i + 1,
            registro,
            sucesso: false,
            erro: msg,
          }

          novosResultados.push(resultado)
          setResultados((prev) => [...prev, resultado])
        } else {
          const payload = data.data || {}
          const vinculos: any[] = Array.isArray(payload.vinculos)
            ? payload.vinculos
            : Array.isArray(payload.data?.vinculos)
            ? payload.data.vinculos
            : []

          const quantidadeVinculos = vinculos.length
          const primeiro = vinculos[0]
          const margem =
            primeiro?.valorDisponivel ??
            primeiro?.valorMargemDisponivel ??
            primeiro?.valorBaseMargem ??
            primeiro?.valorTotalVencimentos ??
            null

          const margemNumero =
            margem === null || margem === undefined
              ? undefined
              : typeof margem === "number"
              ? margem
              : Number(String(margem).trim().replace(/\./g, "").replace(/,/g, ".")) || undefined

          const possuiTabela = vinculos.some(
            (v: any) => v.elegivel === true || String(v.elegivel).toUpperCase() === "S"
          )

          const resultado: ResultadoConsulta = {
            linha: i + 1,
            registro,
            sucesso: true,
            quantidadeVinculos,
            margemDisponivel: margemNumero,
            possuiTabela,
          }

          novosResultados.push(resultado)
          setResultados((prev) => [...prev, resultado])
        }
      } catch (error: any) {
        const resultado: ResultadoConsulta = {
          linha: i + 1,
          registro,
          sucesso: false,
          erro: error?.message || "Erro inesperado ao consultar FACTA",
        }
        novosResultados.push(resultado)
        setResultados((prev) => [...prev, resultado])
      } finally {
        atualizarProgresso(i + 1, registro.length)

        // Base OFFLINE da FACTA requer intervalo mínimo de 3 segundos entre requisições
        if (modoConsulta === "offline" && i < registro.length - 1 && processamentoAtivoRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 3100))
        }
      }
    }

    setProcessando(false)
    processamentoAtivoRef.current = false
  }

  const handleIniciar = () => {
    if (processando) return
    processarLote()
  }

  const handlePausar = () => {
    setPausado(true)
  }

  const handleRetomar = () => {
    setPausado(false)
  }

  const handleCancelar = () => {
    processamentoAtivoRef.current = false
    setCancelado(true)
    setProcessando(false)
    setPausado(false)
  }

  const handleDownloadTemplate = () => {
    const linhas = ["CPF;NOME", "00000000000;Fulano de Tal"]
    const csvContent = linhas.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "template_consulta_facta_lote.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportarResultados = () => {
    if (resultados.length === 0) {
      alert("Nenhum resultado para exportar.")
      return
    }

    const linhas = [
      "LINHA;CPF;NOME;SUCESSO;QTD_VINCULOS;POSSUI_TABELA;MARGEM_DISPONIVEL;ERRO",
      ...resultados.map((r) => {
        const margem =
          r.margemDisponivel != null
            ? r.margemDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
            : ""
        return [
          r.linha,
          r.registro.cpf,
          r.registro.nome ?? "",
          r.sucesso ? "SIM" : "NAO",
          r.quantidadeVinculos ?? "",
          r.possuiTabela ? "SIM" : "NAO",
          margem,
          (r.erro || "").replace(/[\r\n]+/g, " "),
        ].join(";")
      }),
    ]

    const csvContent = linhas.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `consulta_facta_lote_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalSucesso = resultados.filter((r) => r.sucesso).length
  const totalErro = resultados.filter((r) => !r.sucesso).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-orange-600" />
            Consulta FACTA em Lote
          </CardTitle>
          <CardDescription>
            Envie um arquivo CSV com CPF (e opcionalmente nome) para consultar vínculos e margem via FACTA para vários
            registro de uma vez. Atenção: cada CPF precisa ter autorização válida na FACTA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Arquivo CSV</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  disabled={loading || processando}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Formato esperado: <code className="bg-gray-100 px-1 rounded">CPF;NOME</code>. Para Excel, salve como
                CSV UTF-8 antes de enviar.
              </p>
            </div>

            <div className="space-y-2">
              <Label>API FACTA selecionada</Label>
              {apisDisponiveis.length === 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma API FACTA ativa encontrada. Configure uma API do tipo FACTA na aba Configuração.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-1">
                  <select
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    value={apiSelecionada}
                    onChange={(e) => setApiSelecionada(e.target.value)}
                    disabled={processando || modoConsulta === "offline"}
                  >
                    {apisDisponiveis.map((api) => (
                      <option key={api.id} value={api.id}>
                        {api.name || api.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">
                    No modo <strong>Online</strong>, as credenciais (usuário/password) e URL base vêm da configuração desta
                    API. No modo <strong>Offline</strong>, é utilizada a base histórica (sem autorização do registro),
                    configurada via variáveis de ambiente.
                  </p>
                  <div className="mt-3 space-y-1">
                    <Label>Modo de consulta</Label>
                    <select
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                      value={modoConsulta}
                      onChange={(e) => setModoConsulta(e.target.value as ModoConsultaFacta)}
                      disabled={processando}
                    >
                      <option value="online">Online (requere autorização do registro)</option>
                      <option value="offline">Offline (base histórica, sem autorização)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      No modo <strong>Offline</strong> é respeitado um intervalo mínimo de 3 segundos entre cada
                      requisição, conforme manual FACTA &quot;Consulta Dados CLT - OFFLINE&quot;.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Resumo</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <entidade className="h-3 w-3" />
                  {registro.length} registro(s)
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  {totalSucesso} com sucesso
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1 text-red-700 border-red-200">
                  <XCircle className="h-3 w-3" />
                  {totalErro} com erro
                </Badge>
              </div>
              {progresso.total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>
                      Processados: {progresso.atual} / {progresso.total}
                    </span>
                    <span>{progresso.percentual}%</span>
                  </div>
                  <Progress value={progresso.percentual} className="h-2" />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleIniciar}
              disabled={
                loading ||
                processando ||
                registro.length === 0 ||
                (modoConsulta === "online" && !apiSelecionada)
              }
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Iniciar processamento
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={pausado ? handleRetomar : handlePausar}
              disabled={!processando}
            >
              {pausado ? "Retomar" : "Pausar"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelar} disabled={!processando}>
              Cancelar
            </Button>
            <Button type="button" variant="outline" onClick={handleExportarResultados} disabled={resultados.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar resultados
            </Button>
          </div>

          {cancelado && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Processamento cancelado pelo usuário.</AlertDescription>
            </Alert>
          )}

          {resultados.length > 0 && (
            <div className="border rounded-md overflow-hidden mt-2">
              <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Resultados da Consulta em Lote (FACTA)</span>
                </div>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Linha</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">CPF</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Nome</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Qtd. Vínculos</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Possui Tabela?</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Margem Disponível</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Status</th>
                      <th className="px-2 py-1.5 text-left font-semibold text-gray-700">Mensagem / Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((r) => (
                      <tr key={r.linha} className={r.sucesso ? "bg-white" : "bg-red-50/40"}>
                        <td className="px-2 py-1 border-t">{r.linha}</td>
                        <td className="px-2 py-1 border-t font-mono text-[11px]">{r.registro.cpf}</td>
                        <td className="px-2 py-1 border-t">{r.registro.nome || "-"}</td>
                        <td className="px-2 py-1 border-t text-center">
                          {r.quantidadeVinculos != null ? r.quantidadeVinculos : "-"}
                        </td>
                        <td className="px-2 py-1 border-t text-center">
                          {r.possuiTabela == null ? "-" : r.possuiTabela ? "Sim" : "Não"}
                        </td>
                        <td className="px-2 py-1 border-t">
                          {r.margemDisponivel != null
                            ? `R$ ${r.margemDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "-"}
                        </td>
                        <td className="px-2 py-1 border-t">
                          {r.sucesso ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Sucesso</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-700 border-red-200">
                              Erro
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-1 border-t max-w-xs">
                          <span className="line-clamp-2 text-[11px] text-gray-700">
                            {r.erro ||
                              (r.sucesso && r.margemDisponivel == null
                                ? "Consulta realizada, mas a FACTA não retornou margem disponível."
                                : "")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs text-gray-700">
              A FACTA pode exigir autorização prévia do registro para cada CPF. Quando a autorização estiver expirada ou
              ausente, a consulta em lote retornará erro informando a necessidade de utilizar o endpoint de solicitação
              de autorização. Nesses casos, será necessário reenviar o termo para o registro fora deste fluxo em lote.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

