"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, XCircle, FileSpreadsheet, Upload, Download, Calculator, Pause, Play, Square, DollarSign, Calendar } from "lucide-react"
import { getApiManager, type ApiConfig } from "@/lib/api-manager"

interface ClienteSimulacaoCSV {
  cpf: string
  idCotacao?: string
  matricula?: string
  numeroInscricaoEmpregador?: string
  nome?: string
}

interface ResultadoSimulacao {
  linha: number
  cpf: string
  nome?: string
  sucesso: boolean
  simulacoes?: any[]
  quantidadeOpcoes?: number
  erro?: string
  mensagemErro?: string
  valorMargem?: number
  melhorParcela?: number
  melhorValorLiquido?: number
}

export function CLTSimularLote() {
  const [loading, setLoading] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [registro, setClientes] = useState<ClienteSimulacaoCSV[]>([])
  const [resultados, setResultados] = useState<ResultadoSimulacao[]>([])
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, percentual: 0 })
  const [apiSelecionada, setApiSelecionada] = useState<string>('')
  const [apisDisponiveis, setApisDisponiveis] = useState<ApiConfig[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const processamentoAtivoRef = useRef(false)

  // Carrega APIs disponíveis ao montar o componente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const manager = getApiManager()
        const configs = manager.getConfigs().filter(c => c.active)
        setApisDisponiveis(configs)
        // Define a API padrão como selecionada
        if (configs.length > 0) {
          const defaultId = manager.getDefaultApiId() || configs[0].id
          setApiSelecionada(defaultId)
        }
      } catch (error) {
        console.error('Erro ao carregar APIs:', error)
      }
    }
  }, [])

  // Carrega dados do localStorage quando o componente é montado
  useEffect(() => {
    const dadosSalvos = localStorage.getItem('clt_simulacao_lote_dados')
    if (dadosSalvos) {
      try {
        // Processa o CSV salvo (processamento simples para dados vindos da consulta)
        const textoNormalizado = dadosSalvos.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const linhas = textoNormalizado.split('\n').filter(linha => linha.trim())
        
        if (linhas.length >= 2) {
          const separador = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ';' : ','
          
          // Usa parseCSVLine para lidar com aspas corretamente
          const parseCSVLineLocal = (linha: string, sep: string): string[] => {
            const valores: string[] = []
            let valorAtual = ''
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
              } else if (char === sep && !dentroAspas) {
                valores.push(valorAtual.trim())
                valorAtual = ''
              } else {
                valorAtual += char
              }
            }
            valores.push(valorAtual.trim())
            return valores
          }
          
          const cabecalhoRaw = parseCSVLineLocal(linhas[0], separador).map(c => c.trim().replace(/^"|"$/g, ''))
          
          // Função para normalizar texto (remove acentos e converte para lowercase)
          const normalizarTexto = (texto: string): string => {
            return texto
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // Remove acentos
              .trim()
          }
          
          const cabecalho = cabecalhoRaw.map(c => normalizarTexto(c))
          
          const indices: Record<string, number> = {}
          cabecalho.forEach((col, idx) => {
            const colNormalizado = normalizarTexto(col)
            
            // CPF
            if (colNormalizado === 'cpf') {
              indices.cpf = idx
            }
            // Nome
            if (colNormalizado === 'nome') {
              indices.nome = idx
            }
            // ID Cotação
            if (colNormalizado.includes('cotac') && colNormalizado.includes('id')) {
              indices.idCotacao = idx
            }
            // Matrícula
            if (colNormalizado.includes('matr')) {
              indices.matricula = idx
            }
            // CNPJ Empregador
            if ((colNormalizado.includes('cnpj') || colNormalizado.includes('inscric')) && colNormalizado.includes('empreg')) {
              indices.numeroInscricaoEmpregador = idx
            }
          })
          
          console.log('Detecção de colunas CSV (localStorage):')
          console.log('Cabeçalho original:', cabecalhoRaw)
          console.log('Índices detectados:', indices)
          
          // Debug: log dos índices encontrados
          console.log('Índices das colunas detectados:', indices)
          console.log('Cabeçalho do CSV:', cabecalho)

          if (indices.cpf !== undefined) {
            const dados: ClienteSimulacaoCSV[] = []
            for (let i = 1; i < linhas.length; i++) {
              // Usa parseCSVLine para processar corretamente as linhas
              const parseCSVLineLocal = (linha: string, sep: string): string[] => {
                const valores: string[] = []
                let valorAtual = ''
                let dentroAspas = false
                
                for (let j = 0; j < linha.length; j++) {
                  const char = linha[j]
                  const proximoChar = linha[j + 1]
                  
                  if (char === '"') {
                    if (dentroAspas && proximoChar === '"') {
                      valorAtual += '"'
                      j++
                    } else {
                      dentroAspas = !dentroAspas
                    }
                  } else if (char === sep && !dentroAspas) {
                    valores.push(valorAtual.trim())
                    valorAtual = ''
                  } else {
                    valorAtual += char
                  }
                }
                valores.push(valorAtual.trim())
                return valores
              }
              
              const valores = parseCSVLineLocal(linhas[i], separador).map(v => v.replace(/^"|"$/g, ''))
              if (valores.length >= cabecalho.length) {
                let cpf = valores[indices.cpf].replace(/\D/g, '')
                // Se o CPF tem menos de 11 dígitos, adiciona zeros à esquerda
                if (cpf.length < 11 && cpf.length > 0) {
                  cpf = cpf.padStart(11, '0')
                }
                if (cpf.length === 11) {
      // Extrai campos, garantindo que não sejam undefined ou vazios
      const idCotacao = indices.idCotacao !== undefined ? valores[indices.idCotacao]?.trim() : undefined
      const matricula = indices.matricula !== undefined ? valores[indices.matricula]?.trim() : undefined
      
      // Processa CNPJ Empregador - pode estar em formato científico do Excel (ex: 5,35988E+12)
      let cnpjEmpregador: string | undefined = undefined
      if (indices.numeroInscricaoEmpregador !== undefined) {
        let cnpjRaw = valores[indices.numeroInscricaoEmpregador]?.trim() || ''
        
        // Se estiver em formato científico (contém 'E' ou 'e'), converte
        if (cnpjRaw.toUpperCase().includes('E')) {
          try {
            // Tenta converter de notação científica (substitui vírgula por ponto)
            const num = parseFloat(cnpjRaw.replace(',', '.'))
            cnpjRaw = Math.round(num).toString()
          } catch (e) {
            console.warn('Erro ao converter CNPJ de notação científica:', cnpjRaw)
          }
        }
        
        // Remove formatação (pontos, traços, barras, vírgulas)
        cnpjRaw = cnpjRaw.replace(/[^\d]/g, '')
        
        // Garante que tem 14 dígitos (adiciona zeros à esquerda se necessário)
        if (cnpjRaw && cnpjRaw.length > 0 && cnpjRaw.length < 14) {
          cnpjRaw = cnpjRaw.padStart(14, '0')
        }
        
        // Valida se tem 14 dígitos
        if (cnpjRaw && cnpjRaw.length === 14) {
          cnpjEmpregador = cnpjRaw
        } else if (cnpjRaw && cnpjRaw.length > 14) {
          // Se tiver mais de 14 dígitos, pega apenas os primeiros 14
          cnpjEmpregador = cnpjRaw.substring(0, 14)
        }
      }
      
      dados.push({
        cpf: cpf,
        nome: indices.nome !== undefined ? valores[indices.nome]?.trim() : undefined,
        idCotacao: idCotacao && idCotacao !== '' ? idCotacao : undefined,
        matricula: matricula && matricula !== '' ? matricula : undefined,
        numeroInscricaoEmpregador: cnpjEmpregador,
      })
                }
              }
            }
            
            if (dados.length > 0) {
              setClientes(dados)
              const count = localStorage.getItem('clt_simulacao_lote_count')
              if (count) {
                setTimeout(() => {
                  alert(`${count} registro(s) elegível(eis) carregado(s) da consulta de elegibilidade em lote.`)
                }, 100)
              }
              localStorage.removeItem('clt_simulacao_lote_dados')
              localStorage.removeItem('clt_simulacao_lote_count')
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados salvos:', error)
      }
    }
  }, [])

  // Campos padrão para simulação CLT
  // IMPORTANTE: Esta simulação é apenas para verificar se a pessoa tem margem disponível para empréstimo CLT
  // Por isso, VALOR_SOLICITADO é 0 - para retornar todas as opções disponíveis baseadas na margem do registro
  const LOJA_ID = 15377
  const CODIGO_INSCRICAO_EMPREGADOR = 1
  const NUMERO_PARCELAS = 12
  const VALOR_SOLICITADO = 0 // Valor 0 = verifica apenas a margem disponível, não simula um valor específico

  // Função helper para fazer parse de linha CSV considerando aspas e separadores
  const parseCSVLine = (linha: string, separador: string): string[] => {
    const valores: string[] = []
    let valorAtual = ''
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
        valorAtual = ''
      } else {
        valorAtual += char
      }
    }
    
    valores.push(valorAtual.trim())
    return valores
  }

  // Função para detectar separador CSV
  const detectarSeparador = (linha: string): string => {
    const contaVirgula = (linha.match(/,/g) || []).length
    const contaPontoVirgula = (linha.match(/;/g) || []).length
    return contaPontoVirgula > contaVirgula ? ';' : ','
  }

  // Função para processar CSV
  const processarCSV = (texto: string): ClienteSimulacaoCSV[] => {
    const textoNormalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const linhas = textoNormalizado.split('\n').filter(linha => linha.trim())
    
    if (linhas.length < 2) {
      throw new Error('Planilha deve ter pelo menos uma linha de cabeçalho e uma linha de dados')
    }

    const separador = detectarSeparador(linhas[0])
    const cabecalhoRaw = parseCSVLine(linhas[0], separador).map(c => c.trim().replace(/^"|"$/g, ''))
    
    // Função para normalizar texto (remove acentos e converte para lowercase)
    const normalizarTexto = (texto: string): string => {
      return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .trim()
    }
    
    const cabecalho = cabecalhoRaw.map(c => normalizarTexto(c))
    
    // Mapear colunas esperadas (busca case-insensitive e suporta variações)
    const indices: Record<string, number> = {}
    cabecalho.forEach((col, idx) => {
      const colNormalizado = normalizarTexto(col)
      
      // CPF
      if (colNormalizado === 'cpf') {
        indices.cpf = idx
      }
      // Nome - apenas "nome" simples (não "nome empregador" ou "nome organizacao")
      if (colNormalizado === 'nome') {
        indices.nome = idx
      }
      // ID Cotação - busca "cotac" e "id" na mesma string
      if (colNormalizado.includes('cotac') && colNormalizado.includes('id')) {
        indices.idCotacao = idx
      }
      // Matrícula - busca "matr" (funciona com "matrícula" e "matricula")
      if (colNormalizado.includes('matr')) {
        indices.matricula = idx
      }
      // CNPJ Empregador - busca "cnpj" ou "inscric" E "empreg"
      if ((colNormalizado.includes('cnpj') || colNormalizado.includes('inscric')) && colNormalizado.includes('empreg')) {
        indices.numeroInscricaoEmpregador = idx
      }
    })
    
    // Debug: log dos índices encontrados
    console.log('Detecção de colunas CSV:')
    console.log('Cabeçalho original:', cabecalhoRaw)
    console.log('Cabeçalho normalizado:', cabecalho)
    console.log('Índices detectados:', indices)

    if (indices.cpf === undefined) {
      throw new Error('Planilha deve conter a coluna: cpf')
    }

    const dados: ClienteSimulacaoCSV[] = []
    const cpfsInvalidos: number[] = []
    
    for (let i = 1; i < linhas.length; i++) {
      const valores = parseCSVLine(linhas[i], separador).map(v => v.trim().replace(/^"|"$/g, ''))
      
      if (valores.length < cabecalho.length) continue

      let cpf = valores[indices.cpf].replace(/\D/g, '')
      
      // Se o CPF tem menos de 11 dígitos, adiciona zeros à esquerda
      // Isso corrige o problema de CPFs que começam com zero serem formatados pelo Excel
      if (cpf.length < 11 && cpf.length > 0) {
        cpf = cpf.padStart(11, '0')
      }
      
      // Validação rigorosa: CPF deve ter exatamente 11 dígitos
      if (cpf.length !== 11) {
        cpfsInvalidos.push(i + 1) // +1 porque linha 1 é cabeçalho
        continue
      }

      // Extrai campos, garantindo que não sejam undefined ou vazios
      const idCotacao = indices.idCotacao !== undefined ? valores[indices.idCotacao]?.trim() : undefined
      const matricula = indices.matricula !== undefined ? valores[indices.matricula]?.trim() : undefined
      
      // Processa CNPJ Empregador - pode estar em formato científico do Excel (ex: 5,35988E+12)
      let cnpjEmpregador: string | undefined = undefined
      if (indices.numeroInscricaoEmpregador !== undefined) {
        let cnpjRaw = valores[indices.numeroInscricaoEmpregador]?.trim() || ''
        
        // Remove formatação (pontos, traços, barras)
        cnpjRaw = cnpjRaw.replace(/\D/g, '')
        
        // Se estiver em formato científico (contém 'E' ou 'e'), converte
        if (cnpjRaw.includes('E') || cnpjRaw.includes('e')) {
          try {
            // Tenta converter de notação científica
            const num = parseFloat(cnpjRaw.replace(',', '.'))
            cnpjRaw = Math.round(num).toString()
          } catch (e) {
            console.warn('Erro ao converter CNPJ de notação científica:', cnpjRaw)
          }
        }
        
        // Garante que tem 14 dígitos (adiciona zeros à esquerda se necessário)
        if (cnpjRaw && cnpjRaw.length > 0 && cnpjRaw.length < 14) {
          cnpjRaw = cnpjRaw.padStart(14, '0')
        }
        
        // Valida se tem 14 dígitos
        if (cnpjRaw && cnpjRaw.length === 14) {
          cnpjEmpregador = cnpjRaw
        }
      }
      
      dados.push({
        cpf: cpf,
        nome: indices.nome !== undefined ? valores[indices.nome]?.trim() : undefined,
        idCotacao: idCotacao && idCotacao !== '' ? idCotacao : undefined,
        matricula: matricula && matricula !== '' ? matricula : undefined,
        numeroInscricaoEmpregador: cnpjEmpregador && cnpjEmpregador !== '' ? cnpjEmpregador : undefined,
      })
    }

    // Avisa sobre CPFs inválidos
    if (cpfsInvalidos.length > 0) {
      const mensagem = `Atenção: ${cpfsInvalidos.length} linha(s) foram ignoradas por terem CPF inválido (vazio ou não pode ser corrigido para 11 dígitos).\nLinhas: ${cpfsInvalidos.slice(0, 10).join(', ')}${cpfsInvalidos.length > 10 ? '...' : ''}`
      console.warn(mensagem)
      // Não bloqueia o processamento, apenas avisa
    }

    return dados
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setArquivo(file)
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
        alert('Nenhum CPF válido encontrado no arquivo. Verifique se os CPFs têm exatamente 11 dígitos.')
        setArquivo(null)
        return
      }
      
      setClientes(dados)
    } catch (error: any) {
      alert(`Erro ao processar arquivo: ${error.message}`)
      setArquivo(null)
    }
  }

  const processarSimulacoes = async () => {
    if (registro.length === 0) {
      alert('Por favor, carregue uma planilha com CPFs')
      return
    }

    if (!apiSelecionada) {
      alert('Por favor, selecione um banco para realizar as simulações')
      return
    }

    // Validar campos obrigatórios
    const clientesInvalidos = registro.filter(c => 
      !c.idCotacao || !c.matricula || !c.numeroInscricaoEmpregador
    )

    if (clientesInvalidos.length > 0) {
      alert(`Atenção: ${clientesInvalidos.length} registro(s) estão faltando campos obrigatórios (ID Cotação, Matrícula ou CNPJ Empregador). Eles serão pulados.`)
    }

    if (cancelado) {
      setResultados([])
      setCancelado(false)
    }

    setProcessando(true)
    setPausado(false)
    processamentoAtivoRef.current = true

    const inicio = resultados.length > 0 && !cancelado ? resultados.length : 0
    const resultadosTemp = cancelado ? [] : [...resultados]
    
    if (inicio === 0) {
      setProgresso({ atual: 0, total: registro.length, percentual: 0 })
    } else {
      const percentual = Math.round((inicio / registro.length) * 100)
      setProgresso({
        atual: inicio,
        total: registro.length,
        percentual
      })
    }

    for (let i = inicio; i < registro.length; i++) {
      if (cancelado || !processamentoAtivoRef.current) {
        break
      }

      while (pausado && !cancelado && processamentoAtivoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      if (cancelado || !processamentoAtivoRef.current) {
        break
      }

      const registro = registro[i]

      // Pula se faltar campos obrigatórios
      if (!registro.idCotacao || !registro.matricula || !registro.numeroInscricaoEmpregador) {
        resultadosTemp.push({
          linha: i + 2,
          cpf: registro.cpf,
          nome: registro.nome,
          sucesso: false,
          erro: 'Campos obrigatórios faltando',
          mensagemErro: 'Faltam campos obrigatórios: ID Cotação, Matrícula ou CNPJ Empregador'
        })

        const percentual = Math.round(((i + 1) / registro.length) * 100)
        setProgresso({
          atual: i + 1,
          total: registro.length,
          percentual
        })
        setResultados([...resultadosTemp])
        continue
      }
      
      try {
        // Valida se todos os campos obrigatórios estão preenchidos
        if (!registro.idCotacao || !registro.matricula || !registro.numeroInscricaoEmpregador) {
          resultadosTemp.push({
            linha: i + 2,
            cpf: registro.cpf,
            nome: registro.nome,
            sucesso: false,
            erro: 'Campos obrigatórios faltando',
            mensagemErro: `Faltam campos obrigatórios: ${!registro.idCotacao ? 'ID Cotação' : ''} ${!registro.matricula ? 'Matrícula' : ''} ${!registro.numeroInscricaoEmpregador ? 'CNPJ Empregador' : ''}`.trim()
          })
          
          const percentual = Math.round(((i + 1) / registro.length) * 100)
          setProgresso({
            atual: i + 1,
            total: registro.length,
            percentual
          })
          setResultados([...resultadosTemp])
          continue
        }
        
        // Debug: log dos parâmetros enviados para a primeira simulação
        if (i === 0) {
          console.log('Parâmetros da primeira simulação:', {
            cpf: registro.cpf,
            idCotacao: registro.idCotacao,
            matricula: registro.matricula,
            numeroInscricaoEmpregador: registro.numeroInscricaoEmpregador,
            codigoInscricaoEmpregador: CODIGO_INSCRICAO_EMPREGADOR
          })
        }
        
        const response = await fetch('/api/produto/clt/simular', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cpf: registro.cpf,
            lojaId: LOJA_ID,
            idCotacao: registro.idCotacao.trim(),
            matricula: registro.matricula.trim(),
            codigoInscricaoEmpregador: CODIGO_INSCRICAO_EMPREGADOR,
            numeroInscricaoEmpregador: registro.numeroInscricaoEmpregador.trim().replace(/\D/g, ''),
            numeroParcelas: NUMERO_PARCELAS,
            valor: VALOR_SOLICITADO,
            apiId: apiSelecionada,
          }),
        })

        const data = await response.json()
        
        // Debug: log da resposta da primeira simulação
        if (i === 0) {
          console.log('Resposta da primeira simulação:', JSON.stringify(data, null, 2))
        }
        
        if (data.success && data.data) {
          const simulacoes = data.data.value || data.data || []
          
          if (simulacoes.length === 0) {
            resultadosTemp.push({
              linha: i + 2,
              cpf: registro.cpf,
              nome: registro.nome,
              sucesso: true,
              simulacoes: [],
              quantidadeOpcoes: 0,
              mensagemErro: 'Nenhuma simulação disponível'
            })
          } else {
            // Encontra a melhor opção (maior valor líquido)
            let melhorSimulacao = simulacoes[0]
            simulacoes.forEach((sim: any) => {
              const valorLiquido = sim.opcaoProposta?.valorDesembolsoTrabalhador || 0
              const melhorValor = melhorSimulacao?.opcaoProposta?.valorDesembolsoTrabalhador || 0
              if (valorLiquido > melhorValor) {
                melhorSimulacao = sim
              }
            })

            resultadosTemp.push({
              linha: i + 2,
              cpf: registro.cpf,
              nome: registro.nome,
              sucesso: true,
              simulacoes: simulacoes,
              quantidadeOpcoes: simulacoes.length,
              valorMargem: melhorSimulacao?.valorMargem || 0,
              melhorParcela: melhorSimulacao?.opcaoProposta?.valorParcela || 0,
              melhorValorLiquido: melhorSimulacao?.opcaoProposta?.valorDesembolsoTrabalhador || 0,
            })
          }
        } else {
          resultadosTemp.push({
            linha: i + 2,
            cpf: registro.cpf,
            nome: registro.nome,
            sucesso: false,
            erro: data.error || 'Erro desconhecido',
            mensagemErro: data.error || 'Erro ao simular',
          })
        }
      } catch (error: any) {
        resultadosTemp.push({
          linha: i + 2,
          cpf: registro.cpf,
          nome: registro.nome,
          sucesso: false,
          erro: error.message || 'Erro de conexão',
          mensagemErro: error.message || 'Erro de conexão',
        })
      }

      const percentual = Math.round(((i + 1) / registro.length) * 100)
      setProgresso({
        atual: i + 1,
        total: registro.length,
        percentual
      })
      
      setResultados([...resultadosTemp])

      // Delay para não sobrecarregar a API
      if (i < registro.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    setProcessando(false)
    setPausado(false)
    processamentoAtivoRef.current = false
  }

  const pausarProcessamento = () => {
    setPausado(true)
  }

  const retomarProcessamento = () => {
    setPausado(false)
  }

  const cancelarProcessamento = () => {
    setCancelado(true)
    setPausado(false)
    processamentoAtivoRef.current = false
    setProcessando(false)
  }

  // Função helper para escapar valores CSV
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const formatarLinhaCSV = (valores: (string | number | undefined | null)[]): string => {
    return valores.map(escapeCSV).join(';')
  }

  const exportarResultados = () => {
    if (resultados.length === 0) {
      alert('Não há resultados para exportar')
      return
    }

    const cabecalho = [
      'Linha',
      'CPF',
      'Nome',
      'Status',
      'Quantidade Opções',
      'Valor Margem (R$)',
      'Melhor Valor Parcela (R$)',
      'Melhor Valor Líquido (R$)',
      'Erro/Mensagem'
    ]

    const linhas = resultados.map(r => {
      const melhorParcela = r.melhorParcela !== undefined && r.melhorParcela !== null 
        ? r.melhorParcela.toFixed(2).replace('.', ',') 
        : ''
      const melhorValorLiquido = r.melhorValorLiquido !== undefined && r.melhorValorLiquido !== null
        ? r.melhorValorLiquido.toFixed(2).replace('.', ',')
        : ''
      const valorMargem = r.valorMargem !== undefined && r.valorMargem !== null
        ? r.valorMargem.toFixed(2).replace('.', ',')
        : ''

      return [
        r.linha.toString(),
        r.cpf,
        r.nome || '',
        r.sucesso ? (r.quantidadeOpcoes && r.quantidadeOpcoes > 0 ? 'SUCESSO' : 'SEM OPÇÕES') : 'ERRO',
        r.quantidadeOpcoes !== undefined && r.quantidadeOpcoes !== null ? r.quantidadeOpcoes.toString() : '0',
        valorMargem,
        melhorParcela,
        melhorValorLiquido,
        r.mensagemErro || r.erro || ''
      ]
    })

    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...linhas.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')

    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `simulacao_clt_lote_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const baixarTemplate = () => {
    const cabecalho = ['CPF', 'ID Cotação', 'Matrícula', 'CNPJ Empregador', 'Nome']
    const dados = [
      ['12345678900', '123a7344-8144-7d20-8ad4-e65b316b04458', '12345', '12340818000180', 'João Silva'],
      ['98765432100', '456b8455-9255-8e31-9be5-f76c427c15569', '67890', '98765432000123', 'Maria Santos']
    ]
    
    const linhasCSV = [
      formatarLinhaCSV(cabecalho),
      ...dados.map(linha => formatarLinhaCSV(linha))
    ].join('\r\n')
    
    const blob = new Blob(['\uFEFF' + linhasCSV], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_simulacao_clt_lote.csv'
    link.click()
  }

  const formatarMoeda = (valor: number | undefined | null): string => {
    if (valor === undefined || valor === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Estatísticas
  const clientesComSimulacoes = resultados.filter(r => r.sucesso && r.quantidadeOpcoes && r.quantidadeOpcoes > 0).length
  const clientesSemOpcoes = resultados.filter(r => r.sucesso && (!r.quantidadeOpcoes || r.quantidadeOpcoes === 0)).length
  const clientesComErro = resultados.filter(r => !r.sucesso).length
  const totalProcessados = resultados.length
  const valorTotalMargem = resultados
    .filter(r => r.sucesso && r.valorMargem)
    .reduce((acc, r) => acc + (r.valorMargem || 0), 0)

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calculator className="h-5 w-5 text-purple-600" />
            </div>
            Simulação CLT em Lote
          </CardTitle>
          <CardDescription className="mt-2">
            Faça upload de um arquivo CSV com dados dos registro e simule propostas CLT em lote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Informações de campos padrão */}
            <Alert className="bg-blue-50 border-blue-200">
              <Calculator className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Campos padrão aplicados:</strong>
                <ul className="list-disc list-inside mt-1 text-sm space-y-0.5">
                  <li>Loja ID: <strong>{LOJA_ID}</strong></li>
                  <li>Código Inscrição Empregador: <strong>{CODIGO_INSCRICAO_EMPREGADOR}</strong></li>
                  <li>Número de Parcelas: <strong>{NUMERO_PARCELAS}</strong></li>
                  <li>Valor Solicitado: <strong>0 (usa valor máximo disponível)</strong></li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Seleção de Banco */}
            <div>
              <Label htmlFor="banco">Banco para Simulação *</Label>
              <select
                id="banco"
                value={apiSelecionada}
                onChange={(e) => setApiSelecionada(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={processando}
              >
                <option value="">Selecione um banco...</option>
                {apisDisponiveis.map((api) => (
                  <option key={api.id} value={api.id}>
                    {api.name} ({api.type === 'hubcredito' ? 'HubCredito' : 
                                 api.type === 'presencabank' ? 'Banco Presença' : 
                                 api.type === 'nossafintech' ? 'Nossa Fintech' : 
                                 'Custom'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Selecione o banco que será usado para realizar as simulações
              </p>
              {apisDisponiveis.length === 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  Nenhuma API configurada. Configure as APIs na seção de Configuração de APIs.
                </p>
              )}
            </div>

            {/* Upload de Arquivo */}
            <div>
              <Label htmlFor="arquivo">Arquivo CSV com Dados dos registro</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  ref={fileInputRef}
                  id="arquivo"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={baixarTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Template
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                O CSV deve conter: <strong>CPF</strong> (obrigatório), <strong>ID Cotação</strong>, <strong>Matrícula</strong>, <strong>CNPJ Empregador</strong> (obrigatórios). <strong>Nome</strong> é opcional.
                <br />
                💡 Você pode usar o CSV exportado da consulta de elegibilidade em lote - ele já contém todos os campos necessários!
              </p>
            </div>

            {/* Info do Arquivo */}
            {registro.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>{registro.length}</strong> registro(s) encontrado(s) no arquivo.
                  Clique em "Processar Simulações" para iniciar.
                </AlertDescription>
              </Alert>
            )}

            {/* Progresso */}
            {processando && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Processando: <strong>{progresso.atual}</strong> de <strong>{progresso.total}</strong>
                    {pausado && (
                      <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200">
                        Pausado
                      </Badge>
                    )}
                  </span>
                  <span className="text-gray-600 font-medium">{progresso.percentual}%</span>
                </div>
                <Progress value={progresso.percentual} className="h-2" />
              </div>
            )}

            {/* Botões de Controle */}
            <div className="flex gap-2">
              {!processando ? (
                <Button
                  onClick={processarSimulacoes}
                  disabled={registro.length === 0}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                  size="lg"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  {resultados.length > 0 ? 'Continuar' : 'Processar'} Simulações ({registro.length} registro(s))
                </Button>
              ) : (
                <>
                  {pausado ? (
                    <Button
                      onClick={retomarProcessamento}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                      size="lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Retomar Processamento
                    </Button>
                  ) : (
                    <Button
                      onClick={pausarProcessamento}
                      variant="outline"
                      className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      size="lg"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </Button>
                  )}
                  <Button
                    onClick={cancelarProcessamento}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    size="lg"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {totalProcessados > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Estatísticas do Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{clientesComSimulacoes}</div>
                <div className="text-xs text-green-600">Com Simulações</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{clientesSemOpcoes}</div>
                <div className="text-xs text-yellow-600">Sem Opções</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{clientesComErro}</div>
                <div className="text-xs text-red-600">Com Erro</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {formatarMoeda(valorTotalMargem)}
                </div>
                <div className="text-xs text-blue-600">Valor Margem Total</div>
              </div>
            </div>

            <div className="mt-4">
              <Button
                onClick={exportarResultados}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Resultados para CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resultados Detalhados</CardTitle>
            <CardDescription>
              {totalProcessados} registro(s) processado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">CPF</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-center p-2">Opções</th>
                    <th className="text-right p-2">Valor Margem</th>
                    <th className="text-right p-2">Melhor Parcela</th>
                    <th className="text-right p-2">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.slice(0, 100).map((resultado, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{resultado.cpf}</td>
                      <td className="p-2">{resultado.nome || '-'}</td>
                      <td className="p-2 text-center">
                        {resultado.sucesso ? (
                          resultado.quantidadeOpcoes && resultado.quantidadeOpcoes > 0 ? (
                            <Badge className="bg-green-100 text-green-700">SIMULAÇÕES</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-700">SEM OPÇÕES</Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="bg-red-100 text-red-700">ERRO</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">{resultado.quantidadeOpcoes || 0}</td>
                      <td className="p-2 text-right font-medium text-green-600">
                        {resultado.valorMargem ? formatarMoeda(resultado.valorMargem) : '-'}
                      </td>
                      <td className="p-2 text-right text-gray-600">
                        {resultado.melhorParcela ? formatarMoeda(resultado.melhorParcela) : '-'}
                      </td>
                      <td className="p-2 text-right font-medium text-purple-600">
                        {resultado.melhorValorLiquido ? formatarMoeda(resultado.melhorValorLiquido) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {resultados.length > 100 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Mostrando 100 primeiros resultados. Exporte o CSV para ver todos.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

