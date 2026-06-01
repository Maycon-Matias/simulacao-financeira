"use client"

/**
 * Consulta de registro - Nova Vida TI NVCheck
 * Busca completa de dados cadastrais, endereços, telefones, score etc. por CPF ou CNPJ.
 */

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Search, entidade, MapPin, Phone, Mail, Building2, ChevronDown, ChevronUp, Building, CheckCircle2, XCircle, Trash2, RefreshCw, ExternalLink } from "lucide-react"
import { normalizarDadosNv } from "@/lib/whatsapp-nv-normalize"

const CRED_STORAGE_KEY = "novavidati_credenciais"

const DATA_NASC_KEYS = [
  "DATA_NASCIMENTO",
  "DataNascimento",
  "data_nascimento",
  "DATANASC",
  "NASCIMENTO",
  "DtNascimento",
  "DT_NASCIMENTO",
  "DTNASCIMENTO",
  "DATA_NASC",
  "NASCIMENTO_DATA",
]

const NOME_KEYS = [
  "NOME",
  "Nome",
  "nome",
  "NOMEPESSOA",
  "NOME_PESSOA",
  "NOMECLIENTE",
  "NOME_CLIENTE",
  "NOME_COMPLETO",
  "nomeCompleto",
]

/** Extrai nome da consulta Nova Vida (várias chaves e níveis). */
function extrairNome(
  consulta: Record<string, any>,
  resultadoData?: Record<string, any> | null
): string {
  const get = (obj: any, ...keys: string[]) => {
    if (!obj) return ""
    for (const k of keys) {
      const v = obj[k]
      if (v != null && String(v).trim() !== "") return String(v).trim()
    }
    return ""
  }
  const cadastrais = consulta?.CADASTRAIS ?? consulta?.cadastrais ?? {}
  const primeiro = Array.isArray(consulta?.CADASTRAIS) ? consulta.CADASTRAIS[0] : null
  const r = resultadoData?.CADASTRAIS ?? resultadoData?.cadastrais
  const primeiroR = Array.isArray(r) ? r[0] : r
  const cadastraisResultado = (typeof r === "object" && r !== null && !Array.isArray(r)) ? r : {}

  const dataComD = resultadoData?.d ?? resultadoData
  const cadastraisD = dataComD?.CADASTRAIS ?? dataComD?.cadastrais ?? {}
  const primeiroD = Array.isArray(dataComD?.CADASTRAIS) ? dataComD.CADASTRAIS[0] : null

  const raw =
    get(primeiro, ...NOME_KEYS) ||
    get(cadastrais, ...NOME_KEYS) ||
    get(consulta, ...NOME_KEYS) ||
    get(primeiroR, ...NOME_KEYS) ||
    get(cadastraisResultado, ...NOME_KEYS) ||
    get(resultadoData ?? {}, ...NOME_KEYS) ||
    get(primeiroD, ...NOME_KEYS) ||
    get(cadastraisD, ...NOME_KEYS) ||
    get(dataComD ?? {}, ...NOME_KEYS)
  if (raw) return raw
  if (typeof cadastrais === "object" && cadastrais !== null && !Array.isArray(cadastrais)) {
    for (const key of Object.keys(cadastrais)) {
      if (/^nome$/i.test(key) || /^nome_/i.test(key)) {
        const v = cadastrais[key]
        if (v != null && String(v).trim() !== "") return String(v).trim()
      }
    }
  }
  return ""
}

/** Extrai data de nascimento da consulta Nova Vida (várias chaves e níveis). Retorno em DD/MM/AAAA ou AAAA-MM-DD. */
function extrairDataNascimento(
  consulta: Record<string, any>,
  resultadoData?: Record<string, any> | null
): string {
  const get = (obj: any, ...keys: string[]) => {
    if (!obj) return ""
    for (const k of keys) {
      const v = obj[k]
      if (v != null && String(v).trim() !== "") return String(v).trim()
    }
    return ""
  }
  const cadastrais = consulta?.CADASTRAIS ?? consulta?.cadastrais ?? {}
  const primeiro = Array.isArray(consulta?.CADASTRAIS) ? consulta.CADASTRAIS[0] : null
  const cadastraisResultado = resultadoData?.CADASTRAIS ?? resultadoData?.cadastrais ?? {}
  const primeiroResultado = Array.isArray(resultadoData?.CADASTRAIS) ? resultadoData.CADASTRAIS[0] : null

  const dataComD = resultadoData?.d ?? resultadoData
  const cadastraisD = dataComD?.CADASTRAIS ?? dataComD?.cadastrais ?? {}
  const primeiroD = Array.isArray(dataComD?.CADASTRAIS) ? dataComD.CADASTRAIS[0] : null

  const raw =
    get(primeiro, ...DATA_NASC_KEYS) ||
    get(cadastrais, ...DATA_NASC_KEYS) ||
    get(consulta, ...DATA_NASC_KEYS) ||
    get(primeiroResultado, ...DATA_NASC_KEYS) ||
    get(cadastraisResultado, ...DATA_NASC_KEYS) ||
    get(resultadoData ?? {}, ...DATA_NASC_KEYS) ||
    get(primeiroD, ...DATA_NASC_KEYS) ||
    get(cadastraisD, ...DATA_NASC_KEYS) ||
    get(dataComD ?? {}, ...DATA_NASC_KEYS)
  if (raw) return raw
  if (typeof cadastrais === "object" && cadastrais !== null && !Array.isArray(cadastrais)) {
    for (const key of Object.keys(cadastrais)) {
      if (/nascimento|data_nasc|nasc|birth|dt_nasc/i.test(key)) {
        const v = cadastrais[key]
        if (v != null && String(v).trim() !== "") return String(v).trim()
      }
    }
  }
  return ""
}

export function ConsultaClienteNvCheck() {
  const [documento, setDocumento] = useState("")
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [showCred, setShowCred] = useState(false)
  const [credenciais, setCredenciais] = useState({ entidade: "", ******: "", registro: "" })
  const [testResult, setTestResult] = useState<any>(null)
  const [apisClt, setApisClt] = useState<{ id: string; name: string; type: string }[]>([])
  const [resultadosBancos, setResultadosBancos] = useState<Record<string, { loading: boolean; data?: any; error?: string }>>({})
  const [linksAutorizacao, setLinksAutorizacao] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CRED_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setCredenciais({
          entidade: parsed.entidade || "",
          ******: parsed.****** || "",
          registro: parsed.registro || ""
        })
      } else {
        setCredenciais({
          entidade: "poracred61@gmail.com",
          ******: "C#ed@23!8",
          registro: "PORACRED"
        })
      }
    } catch {}
  }, [])

  const salvarCredenciais = () => {
    try {
      localStorage.setItem(CRED_STORAGE_KEY, JSON.stringify(credenciais))
    } catch {}
  }

  const testarConexao = async () => {
    setTestResult(null)
    try {
      const res = await fetch("/api/produto/novavidati/testar-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credenciais)
      })
      const data = await res.json()
      setTestResult(data)
    } catch (e: any) {
      setTestResult({ success: false, error: e.message })
    }
  }

  const formatarDoc = (v: string) => {
    const d = v.replace(/\D/g, "")
    if (d.length <= 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }

  const consultar = async () => {
    const doc = documento.replace(/\D/g, "")
    if (doc.length !== 11 && doc.length !== 14) {
      setErro("Informe CPF (11 dígitos) ou CNPJ (14 dígitos)")
      return
    }

    setLoading(true)
    setErro(null)
    setResultado(null)
    setApisClt([])
    setResultadosBancos({})
    setLinksAutorizacao({})

    try {
      const res = await fetch("/api/produto/novavidati/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documento: doc,
          entidade: credenciais.entidade,
          ******: credenciais.******,
          registro: credenciais.registro
        })
      })

      const data = await res.json()

      if (!data.success) {
        setErro(data.error || "Erro ao consultar")
        return
      }

      setResultado(data)
    } catch (e: any) {
      setErro(e.message || "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  const rawData = resultado?.data ?? {}
  const consulta = rawData.CONSULTA ?? rawData.d ?? rawData
  const cadastrais = consulta.CADASTRAIS ?? consulta.cadastrais ?? {}
  const enderecos = consulta.ENDERECOS ?? []
  const telefones = consulta.TELEFONES ?? []
  const emails = consulta.EMAILS ?? []
  const docLimpo = documento.replace(/\D/g, "")
  const isCpf = docLimpo.length === 11

  useEffect(() => {
    if (!resultado || !isCpf) return
    let cancelled = false
    fetch("/api/produto/apis-clt")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success && Array.isArray(json.data)) {
          const list = json.data.filter((a: { type?: string }) => a.type !== "nossafintech" && a.type !== "c6bank")
          setApisClt(list)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [resultado, isCpf])

  const consultarNoBanco = async (apiId: string) => {
    const cpf = docLimpo
    if (cpf.length !== 11) return
    const api = apisClt.find((a) => a.id === apiId)
    const isC6 = api?.type === "c6bank"

    setResultadosBancos((prev) => ({ ...prev, [apiId]: { loading: true } }))
    let telefone: string | undefined
    if (Array.isArray(telefones) && telefones.length > 0 && telefones[0]) {
      const t = telefones[0]
      const num = (t.DDD || t.DD || "") + (t.NUMERO || t.NUMEROTELEFONE || t.TELEFONE || "")
      if (num) telefone = num.replace(/\D/g, "")
    }

    if (isC6) {
      const resultadoData = resultado?.data
      const dadosNv = normalizarDadosNv(cpf, consulta) ?? (resultadoData ? normalizarDadosNv(cpf, resultadoData) : null)
      const nome =
        (dadosNv?.nome ?? "").trim() ||
        (() => {
          const primeiro = Array.isArray(consulta.CADASTRAIS) ? consulta.CADASTRAIS[0] : cadastrais
          const r = resultadoData?.CADASTRAIS ?? resultadoData?.cadastrais
          const primeiroR = Array.isArray(r) ? r[0] : r
          const n =
            primeiro?.NOME ?? primeiro?.NOMEPESSOA ?? cadastrais?.NOME ?? cadastrais?.NOMECLIENTE ??
            primeiroR?.NOME ?? primeiroR?.NOMEPESSOA ?? r?.NOME ?? r?.NOMECLIENTE ??
            consulta?.NOME ?? consulta?.NOMECLIENTE ?? resultadoData?.NOME ?? ""
          return String(n ?? "").trim()
        })()
      const dataNascRaw =
        dadosNv?.data_nascimento ||
        dadosNv?.data_nascimento_ddmm ||
        extrairDataNascimento(consulta, resultadoData)
      const dataNasc = String(dataNascRaw ?? "").trim()
      try {
        const res = await fetch("/api/produto/c6bank/consultar-margem-clt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiId,
            cpf,
            nome: nome || undefined,
            data_nascimento: dataNasc || undefined,
          }),
        })
        const data = await res.json()
        if (data.success !== false) {
          setResultadosBancos((prev) => ({
            ...prev,
            [apiId]: { loading: false, data: { _c6: true, ...data } },
          }))
        } else {
          setResultadosBancos((prev) => ({
            ...prev,
            [apiId]: { loading: false, error: data.error || "Erro ao consultar C6" },
          }))
        }
      } catch (e: any) {
        setResultadosBancos((prev) => ({
          ...prev,
          [apiId]: { loading: false, error: e?.message || "Erro ao consultar" },
        }))
      }
      return
    }

    // V8 Digital: fluxo igual ao WhatsApp — criar termo + autorizar automaticamente
    if (api?.type === "v8digital") {
      const resultadoData = resultado?.data ?? {}
      const dadosNv = normalizarDadosNv(cpf, consulta) ?? (resultadoData && Object.keys(resultadoData).length > 0 ? normalizarDadosNv(cpf, resultadoData) : null)
      const nomeV8 =
        (dadosNv?.nome ?? "").trim() ||
        extrairNome(consulta, resultadoData) ||
        (() => {
          const primeiro = Array.isArray(consulta.CADASTRAIS) ? consulta.CADASTRAIS[0] : cadastrais
          const r = resultadoData?.CADASTRAIS ?? resultadoData?.cadastrais
          const primeiroR = Array.isArray(r) ? r[0] : r
          const n =
            primeiro?.NOME ?? primeiro?.NOMEPESSOA ?? cadastrais?.NOME ?? cadastrais?.NOMECLIENTE ??
            primeiroR?.NOME ?? primeiroR?.NOMEPESSOA ?? r?.NOME ?? r?.NOMECLIENTE ??
            consulta?.NOME ?? resultadoData?.NOME ?? ""
          return String(n ?? "").trim()
        })()
      const dataNascV8 =
        dadosNv?.data_nascimento ||
        dadosNv?.data_nascimento_ddmm ||
        extrairDataNascimento(consulta, resultadoData)
      const birthDateIso = (() => {
        if (dadosNv?.data_nascimento && /^\d{4}-\d{2}-\d{2}$/.test(String(dadosNv.data_nascimento)))
          return String(dadosNv.data_nascimento)
        if (dataNascV8 && /^\d{4}-\d{2}-\d{2}$/.test(String(dataNascV8))) return String(dataNascV8)
        if (dataNascV8 && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(String(dataNascV8))) {
          const [d, m, y] = String(dataNascV8).split(/[\/\-]/)
          return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`
        }
        return ""
      })()
      const emailV8 =
        (Array.isArray(emails) && emails.length > 0 && (typeof emails[0] === "string" ? emails[0] : (emails[0] as any)?.EMAIL)) ||
        dadosNv?.email ||
        `registro.${cpf}@poracred.com.br`
      const telefoneV8 =
        telefone ||
        (dadosNv?.telefone && dadosNv.telefone.length >= 10 ? dadosNv.telefone : "")
      const genderV8 = dadosNv?.sexo === "female" ? "female" : "male"

      if (!nomeV8 || !birthDateIso) {
        setResultadosBancos((prev) => ({
          ...prev,
          [apiId]: { loading: false, error: "Nome e data de nascimento da consulta Nova Vida são necessários para o V8." },
        }))
        return
      }
      if (!telefoneV8 || telefoneV8.replace(/\D/g, "").length < 10) {
        setResultadosBancos((prev) => ({
          ...prev,
          [apiId]: { loading: false, error: "Telefone da consulta Nova Vida é necessário para o V8 (autorização automática)." },
        }))
        return
      }

      try {
        const res = await fetch("/api/produto/v8/consultar-clt-autorizado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiId,
            cpf,
            nome: nomeV8,
            email: String(emailV8).trim(),
            telefone: String(telefoneV8).replace(/\D/g, ""),
            birthDate: birthDateIso,
            gender: genderV8,
          }),
        })
        const data = await res.json()
        if (data.success && data.data !== undefined) {
          setResultadosBancos((prev) => ({ ...prev, [apiId]: { loading: false, data: data.data } }))
        } else {
          setResultadosBancos((prev) => ({
            ...prev,
            [apiId]: { loading: false, error: data.error || "Erro ao consultar V8" },
          }))
        }
      } catch (e: any) {
        setResultadosBancos((prev) => ({
          ...prev,
          [apiId]: { loading: false, error: e?.message || "Erro ao consultar" },
        }))
      }
      return
    }

    // Presença Bank: fluxo com autorização (envia nome, email, telefone, data nascimento da Nova Vida)
    if (api?.type === "presencabank") {
      const resultadoDataPresenca = resultado?.data ?? {}
      const dadosNvPresenca = normalizarDadosNv(cpf, consulta) ?? (resultadoDataPresenca && Object.keys(resultadoDataPresenca).length > 0 ? normalizarDadosNv(cpf, resultadoDataPresenca) : null)
      const nomePresenca =
        (dadosNvPresenca?.nome ?? "").trim() ||
        extrairNome(consulta, resultadoDataPresenca) ||
        (cadastrais as any)?.NOME ||
        (consulta as any)?.NOME ||
        ""
      const dataNascPresenca =
        dadosNvPresenca?.data_nascimento ||
        dadosNvPresenca?.data_nascimento_ddmm ||
        extrairDataNascimento(consulta, resultadoDataPresenca)
      const birthDatePresenca = (() => {
        if (dadosNvPresenca?.data_nascimento && /^\d{4}-\d{2}-\d{2}$/.test(String(dadosNvPresenca.data_nascimento)))
          return String(dadosNvPresenca.data_nascimento)
        if (dataNascPresenca && /^\d{4}-\d{2}-\d{2}$/.test(String(dataNascPresenca))) return String(dataNascPresenca)
        if (dataNascPresenca && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(String(dataNascPresenca))) {
          const [d, m, y] = String(dataNascPresenca).split(/[\/\-]/)
          return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`
        }
        return ""
      })()
      const emailPresenca =
        (Array.isArray(emails) && emails.length > 0 && (typeof emails[0] === "string" ? emails[0] : (emails[0] as any)?.EMAIL)) ||
        dadosNvPresenca?.email ||
        ""
      const telefonePresenca =
        telefone ||
        (dadosNvPresenca?.telefone && dadosNvPresenca.telefone.length >= 10 ? dadosNvPresenca.telefone : "")

      try {
        const res = await fetch("/api/produto/presenca/consultar-clt-autorizado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiId,
            cpf,
            nome: nomePresenca || undefined,
            email: String(emailPresenca).trim() || undefined,
            telefone: telefonePresenca ? String(telefonePresenca).replace(/\D/g, "") : undefined,
            birthDate: birthDatePresenca || undefined,
          }),
        })
        const data = await res.json()
        if (data.success && data.data !== undefined) {
          const linkPresenca = data.data?.linkAutorizacao ?? data.linkAutorizacao
          if (linkPresenca && typeof linkPresenca === "string") {
            setLinksAutorizacao((prev) => ({ ...prev, [apiId]: linkPresenca }))
          }
          setResultadosBancos((prev) => ({ ...prev, [apiId]: { loading: false, data: data.data } }))
        } else {
          const linkPresenca = data.linkAutorizacao
          if (linkPresenca && typeof linkPresenca === "string") {
            setLinksAutorizacao((prev) => ({ ...prev, [apiId]: linkPresenca }))
          }
          setResultadosBancos((prev) => ({
            ...prev,
            [apiId]: { loading: false, error: data.error || "Erro ao consultar Presença Bank" },
          }))
        }
      } catch (e: any) {
        setResultadosBancos((prev) => ({
          ...prev,
          [apiId]: { loading: false, error: e?.message || "Erro ao consultar" },
        }))
      }
      return
    }

    try {
      const res = await fetch("/api/produto/consultar-clt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId,
          cpfTrabalhador: cpf,
          ...(telefone && { telefone }),
        }),
      })
      const data = await res.json()
      if (data.success && data.data !== undefined) {
        setResultadosBancos((prev) => ({ ...prev, [apiId]: { loading: false, data: data.data } }))
      } else {
        setResultadosBancos((prev) => ({
          ...prev,
          [apiId]: { loading: false, error: data.error || "Erro ao consultar" },
        }))
      }
    } catch (e: any) {
      setResultadosBancos((prev) => ({
        ...prev,
        [apiId]: { loading: false, error: e?.message || "Erro ao consultar" },
      }))
    }
  }

  function getMargemTexto(apiType: string, status: { data?: any; error?: string }): string {
    if (status.error) return "—"
    const d = status.data
    if (!d) return "—"
    if (d._c6) {
      if (d.temMargem && d.margem?.valor_cliente != null) return `R$ ${Number(d.margem.valor_cliente).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      if (d.temMargem === false && d.motivo) return "Sem margem"
      return d.temMargem ? "Consultado" : "—"
    }
    if (apiType === "presencabank") {
      if (d.margemAtivo != null) return `R$ ${Number(d.margemAtivo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      if (d.erroMargem) return "—"
      if (Array.isArray(d?.vinculos) && d.vinculos.length > 0) return `${d.vinculos.length} vínculo(s)`
      return "—"
    }
    if (apiType === "facta") {
      const v = d.vinculos?.[0]
      const valor = v?.valorMargemDisponivel ?? v?.valorDisponivel
      if (valor != null && valor !== "") return `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      if (Array.isArray(d.vinculos) && d.vinculos.length > 0) return `${d.vinculos.length} vínculo(s)`
      return "—"
    }
    const valorDireto =
      d?.availableMarginValue ??
      d?.availableMargin ??
      d?.valor_cliente ??
      d?.valor_maximo ??
      d?.margem ??
      (d?.data && Array.isArray(d.data) ? d.data[0]?.availableMarginValue : undefined) ??
      (d?.data && typeof d.data === "object" && !Array.isArray(d.data) ? (d.data as any).availableMarginValue : undefined)

    if (valorDireto != null && valorDireto !== "") {
      return `R$ ${Number(valorDireto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    }

    // Fallback genérico: procura qualquer campo de margem em profundidade
    const visited = new Set<any>()
    const queue: any[] = [d]
    let valorEncontrado: number | null = null

    while (queue.length > 0 && valorEncontrado === null) {
      const current = queue.shift()
      if (!current || typeof current !== "object" || visited.has(current)) continue
      visited.add(current)
      for (const [key, value] of Object.entries(current)) {
        if (value == null) continue
        if (typeof value === "object") {
          queue.push(value)
        } else {
          const k = key.toLowerCase()
          if (/(margin|margem|availablemargin|available_margin|valor_maximo|valormaximo)/.test(k)) {
            const num = Number(String(value).replace(/[^\d.,-]/g, "").replace(".", "").replace(",", "."))
            if (!Number.isNaN(num) && num > 0) {
              valorEncontrado = num
              break
            }
          }
        }
      }
    }

    if (valorEncontrado !== null) {
      return `R$ ${valorEncontrado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    }

    if (apiType === "v8digital") {
      // Se temos desembolso/simulação disponível mas não achamos o valor, mostra mensagem mais amigável
      if (d.simulacaoDisponivel === true) {
        return "Margem aprovada (valor não informado pela V8)"
      }
      return "Termo não aceito ou margem não informada"
    }

    return "Não informada"
  }

  const limparConsulta = () => {
    setResultado(null)
    setResultadosBancos({})
    setLinksAutorizacao({})
    setApisClt([])
  }

  const atualizarStatusBanco = async (apiId: string) => {
    if (apiId && docLimpo.length === 11) consultarNoBanco(apiId)
  }

  const gerarLinkAutorizacaoC6 = async (apiId: string) => {
    const nome =
      (normalizarDadosNv(docLimpo, consulta) ?? (resultado?.data ? normalizarDadosNv(docLimpo, resultado.data) : null))?.nome?.trim() ||
      (() => {
        const primeiro = Array.isArray(consulta.CADASTRAIS) ? consulta.CADASTRAIS[0] : cadastrais
        const r = resultado?.data?.CADASTRAIS ?? resultado?.data?.cadastrais
        const primeiroR = Array.isArray(r) ? r[0] : r
        const n =
          primeiro?.NOME ?? primeiro?.NOMEPESSOA ?? cadastrais?.NOME ?? cadastrais?.NOMECLIENTE ??
          primeiroR?.NOME ?? primeiroR?.NOMEPESSOA ?? r?.NOME ?? r?.NOMECLIENTE ??
          consulta?.NOME ?? resultado?.data?.NOME ?? ""
        return String(n ?? "").trim()
      })()
    const dataNasc =
      (normalizarDadosNv(docLimpo, consulta) ?? (resultado?.data ? normalizarDadosNv(docLimpo, resultado.data) : null))?.data_nascimento ||
      (normalizarDadosNv(docLimpo, consulta) ?? (resultado?.data ? normalizarDadosNv(docLimpo, resultado.data) : null))?.data_nascimento_ddmm ||
      extrairDataNascimento(consulta, resultado?.data)
    if (!nome || !dataNasc) {
      return
    }
    try {
      const res = await fetch("/api/produto/c6bank/clt/authorization-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiId,
          cpf: docLimpo,
          nome,
          data_nascimento: dataNasc.trim(),
          telefone: Array.isArray(telefones) && telefones[0] ? ((telefones[0].DDD || telefones[0].DD || "") + (telefones[0].NUMERO || telefones[0].NUMEROTELEFONE || telefones[0].TELEFONE || "")).replace(/\D/g, "") : undefined,
        }),
      })
      const data = await res.json()
      if (data.success && data.link) {
        setLinksAutorizacao((prev) => ({ ...prev, [apiId]: data.link }))
      }
    } catch (_) {}
  }

  function temMargemV8(d: any): boolean {
    if (!d) return false
    if (String(d?.status ?? d?.consultStatus ?? "").toUpperCase() === "REJECTED") return false
    const v =
      d?.availableMarginValue ??
      d?.valor_cliente ??
      d?.valor_maximo ??
      d?.margem
    if (v != null && v !== "") return true
    if (d?.data && Array.isArray(d.data) && d.data[0]?.availableMarginValue != null) return true
    if (d?.data && typeof d.data === "object" && !Array.isArray(d.data) && (d.data as any).availableMarginValue != null) return true
    // Fallback: procura margem em qualquer lugar do objeto (chaves margin/margem/availableMargin/valor_maximo etc.)
    const visited = new Set<any>()
    const queue: any[] = [d]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || typeof current !== "object" || visited.has(current)) continue
      visited.add(current)
      for (const [key, value] of Object.entries(current)) {
        if (value == null) continue
        if (typeof value === "object") {
          queue.push(value)
        } else {
          const k = key.toLowerCase()
          if (/(margin|margem|availablemargin|available_margin|valor_maximo|valormaximo)/.test(k)) {
            const num = Number(String(value).replace(/[^\d.,-]/g, "").replace(".", "").replace(",", "."))
            if (!Number.isNaN(num) && num > 0) return true
          }
        }
      }
    }
    return false
  }

  function getMotivoTexto(apiType: string, status: { data?: any; error?: string }): string | null {
    if (status.error) return status.error
    const d = status.data
    if (!d) return null
    if (apiType === "presencabank" && d.erroMargem) return d.erroMargem
    if (apiType === "facta" && d.mensagem) return d.mensagem
    if (d._c6 && d.temMargem === false && d.motivo) return d.motivo
    if (apiType === "v8digital" && d) {
      if (String(d.status ?? d.consultStatus ?? "").toUpperCase() === "REJECTED" && d.description)
        return d.description
      if (!temMargemV8(d)) {
        const link = d.consentUrl ?? d.consent_url ?? d.consentLink ?? d.consent_link
        if (link) return "O registro precisa aceitar o termo pelo link enviado para a margem aparecer."
        return "O registro precisa aceitar o termo de consentimento para a margem aparecer."
      }
    }
    return null
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <entidade className="h-5 w-5 text-teal-600" />
            Consulta de registro
          </CardTitle>
          <CardDescription>
            Busca completa de dados via Nova Vida TI NVCheck. Informe CPF ou CNPJ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <button
              type="button"
              onClick={() => setShowCred(!showCred)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              {showCred ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Credenciais Nova Vida TI
            </button>
            {showCred && (
              <div className="mt-2 p-4 border rounded-lg bg-gray-50 space-y-3">
                <div>
                  <Label>Usuário</Label>
                  <Input
                    value={credenciais.entidade}
                    onChange={(e) => setCredenciais((c) => ({ ...c, entidade: e.target.value }))}
                    onBlur={salvarCredenciais}
                    placeholder="entidade@email.com"
                  />
                </div>
                <div>
                  <Label>******</Label>
                  <Input
                    type="******"
                    value={credenciais.******}
                    onChange={(e) => setCredenciais((c) => ({ ...c, ******: e.target.value }))}
                    onBlur={salvarCredenciais}
                  />
                </div>
                <div>
                  <Label>registro</Label>
                  <Input
                    value={credenciais.registro}
                    onChange={(e) => setCredenciais((c) => ({ ...c, registro: e.target.value }))}
                    onBlur={salvarCredenciais}
                    placeholder="PORACRED"
                  />
                </div>
                <Button type="button" variant="outline" onClick={testarConexao} className="mt-2">
                  Testar conexão
                </Button>
                {testResult && (
                  <div className="mt-3 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-48">
                    <pre>{JSON.stringify(testResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="documento">CPF ou CNPJ</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="documento"
                value={documento}
                onChange={(e) => setDocumento(formatarDoc(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                disabled={loading}
              />
              <Button onClick={consultar} disabled={loading || !documento.trim()}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consultando...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" /> Consultar</>
                )}
              </Button>
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">Dados do registro</CardTitle>
              <CardDescription>
                {resultado.documento === "CPF" ? "Pessoa Física" : "Pessoa Jurídica"}. A ficha é preservada ao atualizar bancos (Nova Vida não é consultada de novo).
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={limparConsulta} className="text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar consulta
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.keys(cadastrais).length > 0 && (
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <entidade className="h-4 w-4" /> Cadastrais
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 bg-gray-50 rounded-lg">
                  {Object.entries(cadastrais).map(([k, v]) => (
                    v != null && String(v).trim() !== "" && (
                      <div key={k} className="text-sm">
                        <span className="text-gray-600">{k}:</span>{" "}
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(enderecos) && enderecos.length > 0 && (
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4" /> Endereços
                </h3>
                <div className="space-y-3">
                  {enderecos.map((e: any, i: number) => (
                    <div key={i} className="p-3 border rounded bg-gray-50 text-sm">
                      {[e.LOGRADOURO, e.NUMERO, e.COMPLEMENTO, e.BAIRRO, e.CIDADE, e.UF, e.CEP]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(telefones) && telefones.length > 0 && (
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" /> Telefones
                </h3>
                <div className="flex flex-wrap gap-2">
                  {telefones.map((t: any, i: number) => (
                    <span key={i} className="px-3 py-1 bg-blue-50 rounded border text-sm">
                      ({t.DDD}) {t.TELEFONE}
                      {t.OPERADORA && ` - ${t.OPERADORA}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(emails) && emails.length > 0 && (
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4" /> E-mails
                </h3>
                <div className="flex flex-wrap gap-2">
                  {emails.map((e: any, i: number) => (
                    <span key={i} className="px-3 py-1 bg-green-50 rounded border text-sm">
                      {e.EMAIL}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(consulta.SOCIEDADES?.length > 0 || consulta.QSA || consulta.PESSOASLIGADAS?.length > 0) && (
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4" /> Outros
                </h3>
                <pre className="text-xs overflow-auto bg-gray-900 text-gray-100 p-4 rounded max-h-64">
                  {JSON.stringify(
                    {
                      SOCIEDADES: consulta.SOCIEDADES,
                      QSA: consulta.QSA,
                      PESSOASLIGADAS: consulta.PESSOASLIGADAS,
                      PERFILCONSUMO: consulta.PERFILCONSUMO,
                      PEP: consulta.PEP
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {isCpf && apisClt.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Building className="h-4 w-4" /> Consultar CLT nos bancos
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Use o CPF e dados já preenchidos da consulta Nova Vida. Clique no banco desejado para consultar vínculos CLT.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {apisClt.map((api) => {
                    const status = resultadosBancos[api.id]
                    return (
                      <div key={api.id} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => consultarNoBanco(api.id)}
                          disabled={status?.loading}
                        >
                          {status?.loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          {api.name}
                        </Button>
                        {status && !status.loading && (
                          status.error ? (
                            <XCircle className="h-4 w-4 text-red-500" aria-label={status.error} />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Consultado" />
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
                {Object.entries(resultadosBancos).map(([apiId, status]) => {
                  if (status.loading || (!status.data && !status.error)) return null
                  const api = apisClt.find((a) => a.id === apiId)
                  const apiType = api?.type ?? ""
                  const margemTexto = getMargemTexto(apiType, status)
                  const motivoTexto = getMotivoTexto(apiType, status)
                  const sucesso = !status.error
                  const v8Rejeitado = apiType === "v8digital" && String(status.data?.status ?? status.data?.consultStatus ?? "").toUpperCase() === "REJECTED"
                  const temErroExibir = status.error || status.data?.erroMargem || v8Rejeitado
                  const tituloErro = "CONSULTA REJEITADA"
                  const mensagemErro = status.error || status.data?.erroMargem || (v8Rejeitado ? (status.data?.description || "Consulta recusada") : "") || "Erro ao consultar."
                  return (
                    <div key={apiId} className="mb-3 p-4 rounded-lg border bg-white shadow-sm text-sm">
                      <div className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        {api?.name ?? apiId}
                        {sucesso && !status.data?.erroMargem && !v8Rejeitado ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      {temErroExibir && (
                        <div className="mb-3 p-3 rounded-lg bg-red-600 text-white shadow-md flex gap-3 items-start">
                          <XCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                          <div>
                            <div className="font-semibold uppercase tracking-wide">{tituloErro}</div>
                            <div className="text-sm mt-1 opacity-95">{mensagemErro}</div>
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2 mb-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-gray-500">Status:</span>
                          <span className={sucesso && !status.data?.erroMargem && !v8Rejeitado ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                            {sucesso && !status.data?.erroMargem && !v8Rejeitado ? "Sucesso" : "Erro"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-gray-500">Margem:</span>
                          <span className="font-medium text-gray-900">{margemTexto}</span>
                          {(apiType === "presencabank" || apiType === "v8digital") && status.data?.simulacaoDisponivel !== undefined && (
                            <>
                              <span className="text-gray-400 mx-1">·</span>
                              <span className="text-gray-500">
                                {apiType === "v8digital" ? "Desembolso disponível:" : "Simulação disponível:"}
                              </span>
                              <span className="font-medium text-gray-900">
                                {apiType === "v8digital" && v8Rejeitado ? "Não" : status.data.simulacaoDisponivel ? "Sim" : "Não"}
                              </span>
                            </>
                          )}
                          {apiType === "facta" && status.data?.temSimulacaoDisponivel !== undefined && (
                            <>
                              <span className="text-gray-400 mx-1">·</span>
                              <span className="text-gray-500">Simulação disponível:</span>
                              <span className="font-medium text-gray-900">
                                {status.data.temSimulacaoDisponivel ? "Sim" : "Não"}
                              </span>
                              {status.data.temSimulacaoDisponivel && typeof status.data.valorMaximoSimulacao === "number" && status.data.valorMaximoSimulacao > 0 && (
                                <>
                                  <span className="text-gray-400 mx-1">·</span>
                                  <span className="text-gray-500">Até:</span>
                                  <span className="font-medium text-gray-900">
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(status.data.valorMaximoSimulacao)}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        {motivoTexto && !temErroExibir && (
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-gray-500">Motivo:</span>
                            <span className={sucesso ? "text-amber-700" : "text-red-600"}>{motivoTexto}</span>
                          </div>
                        )}
                        {linksAutorizacao[apiId] && (
                          <div className="flex flex-wrap items-baseline gap-2 mt-2">
                            <span className="text-gray-500">Link para autorizar:</span>
                            <a
                              href={linksAutorizacao[apiId]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline flex items-center gap-1"
                            >
                              Abrir <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button type="button" variant="outline" size="sm" onClick={() => atualizarStatusBanco(apiId)} disabled={resultadosBancos[apiId]?.loading}>
                            {resultadosBancos[apiId]?.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                            Atualizar status
                          </Button>
                          {apiType === "c6bank" && (
                            <Button type="button" variant="outline" size="sm" onClick={() => gerarLinkAutorizacaoC6(apiId)}>
                              Obter link de autorização
                            </Button>
                          )}
                        </div>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700 text-xs">
                          Ver detalhes técnicos
                        </summary>
                        <pre className="text-xs overflow-auto max-h-48 mt-2 p-2 bg-gray-50 rounded border">
                          {JSON.stringify(status.data ?? { error: status.error }, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Resposta completa</h3>
              <pre className="text-xs overflow-auto bg-gray-50 p-4 rounded border max-h-96">
                {JSON.stringify(resultado, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
