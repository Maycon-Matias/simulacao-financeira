"use client"

import { useState, useEffect } from "react"
import { CLTConsultaLoteV8 } from "@/components/clt-consulta-lote-v8"
import { CLTConsultaIndividualV8 } from "@/components/clt-consulta-individual-v8"
import { CLTSimularCredSpot } from "@/components/clt-simular-credspot"
import { CLTConsultaLoteCredSpot } from "@/components/clt-consulta-lote-credspot"
import { CLTConsultaLotePresenca } from "@/components/clt-consulta-lote-presenca"
import { CLTConsultaLoteFacta } from "@/components/clt-consulta-lote-facta"
import { CLTConsultaLote } from "@/components/clt-consulta-lote"
import { CLTAutorizar } from "@/components/clt-autorizar"
import { CLTSimular } from "@/components/clt-simular"
import { CLTEnviarProposta } from "@/components/clt-enviar-proposta"
import { CLTEsteira } from "@/components/clt-esteira"
import { CLTConsultaIndividualPresenca } from "@/components/clt-consulta-individual-presenca"
import { CLTConsultaIndividualFacta } from "@/components/clt-consulta-individual-facta"
import { CLTConsultaIndividualFactaOffline } from "@/components/clt-consulta-individual-facta-offline"
import { C6BankConsultaMargemCLT } from "@/components/c6bank-consulta-margem-clt"
import { ConsultaClienteNvCheck } from "@/components/consulta-registro-nvcheck"
import { ProdutoConsultarCLT } from "@/components/produto-consultar-clt"
import { ProdutoApiConfig } from "@/components/produto-api-config"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Search, Package, entidade, Building2, XCircle, Menu, ChevronDown, ChevronRight, Shield, FileSpreadsheet, Settings, Calculator, Briefcase, Send } from "lucide-react"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>("consulta-lote-v8")
  const [userInfo, setUserInfo] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState<Record<string, boolean>>({
    'Nossa Fintech': true,
    'Consultas em Lote': true,
    'Consultas Individuais': true,
    'Consulta Dados NV': true,
    'Configuração': true,
  })

  // Verifica parâmetro tab na URL ao carregar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tabParam = urlParams.get('tab')
      if (tabParam) {
        setActiveTab(tabParam)
      }
    }
  }, [])

  // Escuta evento customizado para mudar de aba
  useEffect(() => {
    const handleMudarAba = (event: CustomEvent) => {
      setActiveTab(event.detail.aba)
    }
    
    window.addEventListener('mudarAba' as any, handleMudarAba as EventListener)
    
    return () => {
      window.removeEventListener('mudarAba' as any, handleMudarAba as EventListener)
    }
  }, [])

  useEffect(() => {
    loadUserInfo()
  }, [])

  const loadUserInfo = async () => {
    try {
      const response = await fetch('/api/produto/entidade-info')
      const data = await response.json()
      if (data.success) {
        setUserInfo(data.userInfo)
      }
    } catch (error) {
      console.error("Erro ao carregar informações do usuário:", error)
    } finally {
      setLoadingUser(false)
    }
  }

  const menuCategories = [
    {
      title: 'Nossa Fintech',
      icon: Briefcase,
      items: [
        { id: 'esteira-clt', label: 'Esteira Completa', icon: Briefcase, color: 'blue', description: 'Fluxo completo: Consulta → Autorização → Simulação → Proposta' },
        { id: 'consulta-fintech-individual', label: 'Consultar CLT', icon: Search, color: 'indigo', description: 'Consulta individual de vínculos e margem via Nossa Fintech' },
        { id: 'autorizar-clt', label: 'Autorização', icon: Shield, color: 'blue', description: 'Criar ou verificar autorização CLT (Nossa Fintech)' },
        { id: 'simular-clt', label: 'Simular', icon: Calculator, color: 'purple', description: 'Simular crédito CLT via Nossa Fintech' },
        { id: 'enviar-proposta-clt', label: 'Enviar Proposta', icon: Send, color: 'green', description: 'Enviar proposta para aprovação' },
        { id: 'consulta-lote-fintech', label: 'Consulta em Lote', icon: FileSpreadsheet, color: 'indigo', description: 'Processe múltiplos registro via Excel/CSV (Nossa Fintech)' },
      ],
    },
    {
      title: 'Consultas em Lote',
      icon: FileSpreadsheet,
      items: [
        { id: 'consulta-lote-v8', label: 'Consulta V8 em Lote', icon: FileSpreadsheet, color: 'indigo', description: 'Processe múltiplos registro via Excel/CSV' },
        { id: 'consulta-lote-hub', label: 'Consulta Hub Crédito em Lote', icon: FileSpreadsheet, color: 'blue', description: 'Processe múltiplos registro Hub Crédito via Excel/CSV' },
        { id: 'consulta-lote-credspot', label: 'Consulta CredSpot em Lote', icon: FileSpreadsheet, color: 'green', description: 'Partner API CLT: usuário → consentimento → margem (webhooks recomendados)' },
        { id: 'consulta-lote-presenca', label: 'Consulta Presença Bank em Lote', icon: FileSpreadsheet, color: 'purple', description: 'Processe múltiplos registro Presença Bank via Excel/CSV' },
        { id: 'consulta-lote-facta', label: 'Consulta FACTA em Lote', icon: FileSpreadsheet, color: 'orange', description: 'Processe múltiplos registro FACTA via Excel/CSV' },
      ]
    },
    {
      title: 'Consultas Individuais',
      icon: Search,
      items: [
        { id: 'consulta-v8-individual', label: 'Consulta V8 Individual', icon: Search, color: 'indigo', description: 'Consulta individual de vínculos CLT via V8 Digital' },
        { id: 'consulta-hub-individual', label: 'Consulta Hub Crédito Individual', icon: Search, color: 'blue', description: 'Consulta individual de vínculos CLT via Hub Crédito' },
        { id: 'consulta-credspot-individual', label: 'Consulta CredSpot Individual', icon: Search, color: 'green', description: 'Fluxo CLT CredSpot: consentimento, margem, oferta e contrato (OpenAPI)' },
        { id: 'consulta-presenca-individual', label: 'Consulta Presença Bank Individual', icon: Search, color: 'purple', description: 'Consulta individual de consignado privado CLT via Presença Bank' },
        { id: 'consulta-facta-individual', label: 'Consulta FACTA Individual (Online)', icon: Search, color: 'orange', description: 'Consulta individual de dados do trabalhador CLT via FACTA (token + autorização)' },
        { id: 'consulta-facta-individual-offline', label: 'Consulta FACTA Individual (Offline)', icon: Search, color: 'orange', description: 'Consulta individual na base histórica OFFLINE da FACTA (sem autorização SMS/WhatsApp)' },
        { id: 'consulta-margem-c6', label: 'Consulta Margem CLT C6', icon: Search, color: 'blue', description: 'Consulta de margem consignado CLT via C6 Bank' },
      ]
    },
    {
      title: 'Consulta Dados NV',
      icon: entidade,
      items: [
        { id: 'consulta-registro', label: 'Consulta registro NVCheck', icon: Search, color: 'teal', description: 'Busca completa de dados do registro via Nova Vida TI (CPF/CNPJ)' },
      ]
    },
    {
      title: 'Configuração',
      icon: Settings,
      items: [
        { id: 'configuracao', label: 'Configuração', icon: Settings, color: 'gray', description: 'Configurar APIs V8, CredSpot, Presença Bank, C6 Bank e Nossa Fintech' },
      ]
    },
  ]

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; hover: string }> = {
      blue: {
        active: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg',
        hover: 'hover:bg-blue-50 hover:text-blue-700'
      },
      indigo: {
        active: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg',
        hover: 'hover:bg-indigo-50 hover:text-indigo-700'
      },
      green: {
        active: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg',
        hover: 'hover:bg-green-50 hover:text-green-700'
      },
      purple: {
        active: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg',
        hover: 'hover:bg-purple-50 hover:text-purple-700'
      },
      orange: {
        active: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg',
        hover: 'hover:bg-orange-50 hover:text-orange-700'
      },
      teal: {
        active: 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg',
        hover: 'hover:bg-teal-50 hover:text-teal-700'
      },
      red: {
        active: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg',
        hover: 'hover:bg-red-50 hover:text-red-700'
      },
      gray: {
        active: 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-lg',
        hover: 'hover:bg-gray-50 hover:text-gray-700'
      },
    }
    return isActive ? colors[color].active : `text-gray-700 ${colors[color].hover}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex flex-col">
      {/* Header Compacto */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm sticky top-0 z-50">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-md">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Consulta registro Porã Cred
                </h1>
                <p className="text-xs text-gray-600 hidden sm:block">Sistema de Consultas e Simulações</p>
              </div>
            </div>
            {!loadingUser && userInfo && (
              <div className="flex items-center gap-2">
                <div className="text-right hidden lg:block">
                  <div className="flex items-center gap-1.5 justify-end">
                    <entidade className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900">{userInfo.nome}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Building2 className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-600">
                      {userInfo.lojasAtivas?.length || 0} loja(s)
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                  {userInfo.tipoUsuario || 'Usuário'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Layout com Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Compacta */}
        <aside className="w-72 bg-gradient-to-b from-white to-gray-50/50 border-r border-gray-200/80 shadow-lg flex-shrink-0 overflow-y-auto hidden md:block">
          <div className="p-4">
            <nav className="space-y-4">
              {menuCategories.map((category, categoryIndex) => {
                const isExpanded = categoriasExpandidas[category.title] ?? true
                const CategoryIcon = category.icon
                return (
                  <div key={category.title} className={categoryIndex > 0 ? 'pt-4 border-t border-gray-200/60' : ''}>
                    <button
                      onClick={() => {
                        setCategoriasExpandidas(prev => ({
                          ...prev,
                          [category.title]: !isExpanded
                        }))
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-5 w-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
                        <span>{category.title}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-transform duration-200" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-transform duration-200" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="space-y-1.5 animate-in fade-in-50 duration-200 ml-1">
                        {category.items.map((item) => {
                          const Icon = item.icon
                          const isActive = activeTab === item.id
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                                isActive
                                  ? getColorClasses(item.color, true) + ' shadow-md'
                                  : `bg-white/80 hover:bg-gray-50 ${getColorClasses(item.color, false)} border border-transparent hover:border-gray-200`
                              }`}
                              title={item.description}
                            >
                              <div className={`p-1.5 rounded-md flex-shrink-0 transition-colors ${
                                isActive 
                                  ? 'bg-white/20' 
                                  : 'bg-gray-100 group-hover:bg-gray-200'
                              }`}>
                                <Icon className={`h-4 w-4 ${
                                  isActive ? 'text-white' : 'text-gray-600'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium ${
                                  isActive ? 'text-white' : 'text-gray-700'
                                }`}>
                                  {item.label}
                                </div>
                              </div>
                              {isActive && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="h-2 w-2 rounded-full bg-white animate-pulse shadow-sm"></div>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
            
            {/* Footer da Sidebar */}
            <div className="mt-6 pt-4 border-t border-gray-200/60">
              <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">Sistema Ativo</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar Mobile - Menu Hamburger */}
        <div className="md:hidden fixed bottom-4 right-4 z-50">
            <button
              onClick={() => {
                const sidebar = document.getElementById('mobile-sidebar')
                const overlay = document.getElementById('mobile-overlay')
                sidebar?.classList.toggle('translate-x-full')
                overlay?.classList.toggle('opacity-0')
                overlay?.classList.toggle('pointer-events-none')
                overlay?.classList.toggle('opacity-100')
                overlay?.classList.toggle('pointer-events-auto')
              }}
              className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" />
            </button>
        </div>

        {/* Overlay Mobile */}
        <div
          id="mobile-overlay"
          className="md:hidden fixed inset-0 bg-black/50 z-30 opacity-0 pointer-events-none transition-opacity duration-300"
          style={{ top: '57px' }}
          onClick={() => {
            const sidebar = document.getElementById('mobile-sidebar')
            const overlay = document.getElementById('mobile-overlay')
            sidebar?.classList.add('translate-x-full')
            overlay?.classList.add('opacity-0', 'pointer-events-none')
            overlay?.classList.remove('opacity-100', 'pointer-events-auto')
          }}
        />

        {/* Mobile Sidebar */}
        <div
          id="mobile-sidebar"
          className="md:hidden fixed inset-y-0 right-0 w-64 bg-white border-l border-gray-200 shadow-xl z-40 transform translate-x-full transition-transform duration-300 overflow-y-auto"
          style={{ top: '73px' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={() => {
                  const sidebar = document.getElementById('mobile-sidebar')
                  const overlay = document.getElementById('mobile-overlay')
                  sidebar?.classList.add('translate-x-full')
                  overlay?.classList.add('opacity-0', 'pointer-events-none')
                  overlay?.classList.remove('opacity-100', 'pointer-events-auto')
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fechar menu"
              >
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <nav className="space-y-6">
              {menuCategories.map((category, categoryIndex) => {
                const isExpanded = categoriasExpandidas[category.title] ?? true
                return (
                  <div key={category.title} className={categoryIndex > 0 ? 'pt-6 border-t border-gray-200' : ''}>
                    <button
                      onClick={() => {
                        setCategoriasExpandidas(prev => ({
                          ...prev,
                          [category.title]: !isExpanded
                        }))
                      }}
                      className="w-full flex items-center justify-between px-3 mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900 transition-colors group"
                    >
                      <span>{category.title}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                        {category.items.map((item) => {
                          const Icon = item.icon
                          const isActive = activeTab === item.id
                          
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setActiveTab(item.id)
                                const sidebar = document.getElementById('mobile-sidebar')
                                const overlay = document.getElementById('mobile-overlay')
                                sidebar?.classList.add('translate-x-full')
                                overlay?.classList.add('opacity-0', 'pointer-events-none')
                                overlay?.classList.remove('opacity-100', 'pointer-events-auto')
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                                isActive
                                  ? getColorClasses(item.color, true)
                                  : `bg-white ${getColorClasses(item.color, false)}`
                              }`}
                            >
                              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? '' : 'text-gray-500'}`} />
                              <span className="text-sm">{item.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Conteúdo Principal Compacto */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 md:p-4 lg:p-5 max-w-7xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsContent value="esteira-clt" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Esteira de Processo CLT — Nossa Fintech</h2>
                  <p className="text-sm text-gray-600">Fluxo completo: Consulta → Autorização → Margem → Simulação → Proposta</p>
                </div>
                <CLTEsteira />
              </TabsContent>

              <TabsContent value="consulta-fintech-individual" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consultar Vínculos CLT — Nossa Fintech</h2>
                  <p className="text-sm text-gray-600">Consulte vínculos de trabalho e margem por CPF</p>
                </div>
                <ProdutoConsultarCLT apiId="nossafintech-default" />
              </TabsContent>

              <TabsContent value="autorizar-clt" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Autorização CLT — Nossa Fintech</h2>
                  <p className="text-sm text-gray-600">Crie ou verifique a autorização do registro para consultar margem e simular propostas</p>
                </div>
                <CLTAutorizar />
              </TabsContent>

              <TabsContent value="simular-clt" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Simulação CLT — Nossa Fintech</h2>
                  <p className="text-sm text-gray-600">Simule propostas de crédito CLT usando dados do vínculo</p>
                </div>
                <CLTSimular apiId="nossafintech-default" />
              </TabsContent>

              <TabsContent value="enviar-proposta-clt" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Enviar Proposta CLT — Nossa Fintech</h2>
                  <p className="text-sm text-gray-600">Envie a proposta completa para aprovação com todos os dados necessários</p>
                </div>
                <CLTEnviarProposta />
              </TabsContent>

              <TabsContent value="consulta-lote-fintech" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta Nossa Fintech em Lote</h2>
                  <p className="text-sm text-gray-600">Processe múltiplos registro via Excel/CSV: consulta de margem e autorização em massa</p>
                </div>
                <CLTConsultaLote apiTypeFilter="nossafintech" defaultApiId="nossafintech-default" />
              </TabsContent>

              <TabsContent value="consulta-lote-v8" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta V8 Digital em Lote</h2>
                  <p className="text-sm text-gray-600">Processe múltiplos registro via Excel/CSV: Criar Termo → Autorizar → Verificar Status</p>
                </div>
                <CLTConsultaLoteV8 />
              </TabsContent>

              <TabsContent value="consulta-lote-credspot" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta CredSpot em Lote</h2>
                  <p className="text-sm text-gray-600">Importação Excel/CSV: cria usuário, gera consentimento, verifica status e consulta margem (userUuid + eligibilityUuid conforme Partner API).</p>
                </div>
                <CLTConsultaLoteCredSpot />
              </TabsContent>

              <TabsContent value="consulta-lote-hub" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta Hub Crédito em Lote</h2>
                  <p className="text-sm text-gray-600">Processe múltiplos registro Hub Crédito via Excel/CSV com seleção do banco na própria tela.</p>
                </div>
                <CLTConsultaLote />
              </TabsContent>

              <TabsContent value="consulta-lote-facta" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta FACTA em Lote</h2>
                  <p className="text-sm text-gray-600">
                    Processe múltiplos registro FACTA via Excel/CSV: o sistema consulta vínculos e margem para cada CPF
                    utilizando a API FACTA configurada.
                  </p>
                </div>
                <CLTConsultaLoteFacta />
              </TabsContent>

              <TabsContent value="consulta-v8-individual" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta V8 Individual</h2>
                  <p className="text-sm text-gray-600">Consulta individual de vínculos CLT via V8 Digital</p>
                </div>
                <CLTConsultaIndividualV8 />
              </TabsContent>

              <TabsContent value="consulta-credspot-individual" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta CredSpot Individual</h2>
                  <p className="text-sm text-gray-600">Empréstimo consignado CLT (Consignado Privado) via CredSpot Partner API — alinhado à documentação oficial e webhooks.</p>
                </div>
                <CLTSimularCredSpot />
              </TabsContent>

              <TabsContent value="consulta-hub-individual" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta Hub Crédito Individual</h2>
                  <p className="text-sm text-gray-600">Consulta individual de vínculos CLT via Hub Crédito.</p>
                </div>
                <ProdutoConsultarCLT apiId="hubcredito-default" />
              </TabsContent>

              <TabsContent value="consulta-lote-presenca" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta Presença Bank em Lote</h2>
                  <p className="text-sm text-gray-600">Processe múltiplos registro Presença Bank via Excel/CSV: Criar Termo → Consultar Margem → Simular</p>
                </div>
                <CLTConsultaLotePresenca />
              </TabsContent>

              <TabsContent value="consulta-presenca-individual" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta Presença Bank Individual</h2>
                  <p className="text-sm text-gray-600">Consulta individual de consignado privado CLT via Presença Bank</p>
                </div>
                <CLTConsultaIndividualPresenca />
              </TabsContent>

              <TabsContent value="consulta-facta-individual" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta FACTA Individual</h2>
                  <p className="text-sm text-gray-600">Consulta individual de dados do trabalhador CLT via FACTA (token + autorização prévia por SMS/WhatsApp)</p>
                </div>
                <CLTConsultaIndividualFacta />
              </TabsContent>

              <TabsContent value="consulta-facta-individual-offline" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta FACTA Individual (OFFLINE)</h2>
                  <p className="text-sm text-gray-600">
                    Consulta de vínculos CLT na base histórica OFFLINE da FACTA, sem necessidade de autorização do registro.
                  </p>
                </div>
                <CLTConsultaIndividualFactaOffline />
              </TabsContent>

              <TabsContent value="consulta-margem-c6" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta de Margem CLT - C6 Bank</h2>
                  <p className="text-sm text-gray-600">
                    Consulta de margem consignado CLT diretamente no C6 Bank. Informe CPF, data de nascimento, matrícula e renda.
                  </p>
                </div>
                <C6BankConsultaMargemCLT />
              </TabsContent>

              <TabsContent value="consulta-registro" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Consulta de registro</h2>
                  <p className="text-sm text-gray-600">
                    Busca completa de dados cadastrais via Nova Vida TI NVCheck. Informe CPF ou CNPJ para consultar todas as informações do registro.
                  </p>
                </div>
                <ConsultaClienteNvCheck />
              </TabsContent>

              <TabsContent value="configuracao" className="space-y-4 mt-0 animate-in fade-in-50 duration-300">
                <div className="mb-3">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Configuração</h2>
                  <p className="text-sm text-gray-600">Gerencie APIs (V8 Digital, CredSpot, Nossa Fintech), credenciais e endpoints</p>
                </div>
                <ProdutoApiConfig />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}

