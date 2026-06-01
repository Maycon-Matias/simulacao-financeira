/**
 * Script para limpar APIs antigas (HubCredito e PresencaBank) do localStorage
 * Execute este script no console do navegador ou via Node.js
 */

if (typeof window !== 'undefined') {
  // registro-side: limpa localStorage
  try {
    const saved = localStorage.getItem('api_configs')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        // Filtra apenas APIs válidas
        const validTypes = ['nossafintech', 'v8digital', 'custom']
        const validConfigs = parsed.filter(c => validTypes.includes(c.type))
        
        // Salva apenas as válidas
        localStorage.setItem('api_configs', JSON.stringify(validConfigs))
        
        // Verifica se a API padrão ainda existe
        const defaultId = localStorage.getItem('default_api_id')
        if (defaultId && !validConfigs.some(c => c.id === defaultId)) {
          // Se a API padrão não existe mais, define uma válida
          if (validConfigs.length > 0) {
            localStorage.setItem('default_api_id', validConfigs[0].id)
          } else {
            localStorage.setItem('default_api_id', 'nossafintech-default')
          }
        }
        
        console.log('✅ APIs antigas removidas!')
        console.log('APIs válidas:', validConfigs.map(c => c.name))
      }
    } else {
      console.log('ℹ️ Nenhuma configuração salva encontrada')
    }
  } catch (error) {
    console.error('❌ Erro ao limpar APIs:', error)
  }
} else {
  console.log('⚠️ Este script deve ser executado no navegador (console do navegador)')
}
