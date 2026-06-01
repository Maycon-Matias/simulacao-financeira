/**
 * Script completo de teste para V8 Digital
 * Testa autenticação, consulta CLT e termo de consentimento
 */

const BASE_URL = 'http://localhost:3004'

// Função para fazer requisições
async function fazerRequisicao(endpoint, body, descricao) {
  try {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📤 ${descricao}`)
    console.log(`🔗 Endpoint: ${endpoint}`)
    if (body) {
      console.log('📋 Body:', JSON.stringify(body, null, 2))
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      ...(body && { body: JSON.stringify(body) }),
    })

    const data = await response.json()
    
    console.log(`\n📥 Status: ${response.status} ${response.statusText}`)
    console.log('📦 Resposta:', JSON.stringify(data, null, 2))
    
    return { success: response.ok && data.success, data, status: response.status }
  } catch (error) {
    console.error('❌ Erro:', error.message)
    return { success: false, error: error.message }
  }
}

// Teste 1: Autenticação
async function testarAutenticacao() {
  console.log('\n' + '='.repeat(60))
  console.log('TESTE 1: Autenticação V8 Digital')
  console.log('='.repeat(60))
  
  const resultado = await fazerRequisicao('/api/produto/v8/auth', {
    username: 'credpora2@gmail.com',
    ******: '(qi)cRGsCN71',
    clientId: 'DHWogdaYmEI8n5bwwxPDzulMISK7dwln',
    authUrl: 'https://auth.v8sistema.com/oauth/token',
    scope: 'offline_access',
  }, 'Testando autenticação OAuth')
  
  if (resultado.success && resultado.data?.data?.access_token) {
    console.log('\n✅ Autenticação realizada com sucesso!')
    console.log('🔑 Token obtido (primeiros 20 caracteres):', resultado.data.data.access_token.substring(0, 20) + '...')
    return resultado.data.data.access_token
  } else {
    console.log('\n❌ Erro na autenticação')
    console.log('💡 Verifique se está faltando audience ou client_secret')
    return null
  }
}

// Teste 2: Consulta CLT
async function testarConsultaCLT(token) {
  console.log('\n' + '='.repeat(60))
  console.log('TESTE 2: Consulta CLT V8 Digital')
  console.log('='.repeat(60))
  
  if (!token) {
    console.log('⚠️ Token não disponível. Pulando teste de consulta.')
    return null
  }
  
  const cpf = process.argv[2] || '12345678900' // CPF como argumento ou padrão
  
  const resultado = await fazerRequisicao('/api/produto/consultar-clt', {
    cpfTrabalhador: cpf,
    apiId: 'v8digital-default',
  }, 'Testando consulta CLT')
  
  if (resultado.success) {
    console.log('\n✅ Consulta CLT realizada com sucesso!')
  } else {
    console.log('\n❌ Erro na consulta CLT')
  }
  
  return resultado
}

// Teste 3: Termo de Consentimento
async function testarTermoConsentimento(token) {
  console.log('\n' + '='.repeat(60))
  console.log('TESTE 3: Termo de Consentimento V8 Digital')
  console.log('='.repeat(60))
  
  if (!token) {
    console.log('⚠️ Token não disponível. Pulando teste de termo de consentimento.')
    return null
  }
  
  const cpf = process.argv[2] || '12345678900'
  
  const resultado = await fazerRequisicao('/api/produto/v8/termo-consentimento', {
    cpf: cpf,
    nome: 'João da Silva',
    telefone: '73999999999',
    email: 'joao@example.com',
    apiId: 'v8digital-default',
  }, 'Testando criação de termo de consentimento')
  
  if (resultado.success) {
    console.log('\n✅ Termo de consentimento criado com sucesso!')
  } else {
    console.log('\n❌ Erro ao criar termo de consentimento')
  }
  
  return resultado
}

// Teste 4: Verificar URL Base
async function testarURLBase() {
  console.log('\n' + '='.repeat(60))
  console.log('TESTE 0: Verificação da URL Base')
  console.log('='.repeat(60))
  
  try {
    console.log('🔗 Testando: https://bff.v8sistema.com/')
    const response = await fetch('https://bff.v8sistema.com/', {
      method: 'GET',
    })
    
    const text = await response.text()
    console.log(`📥 Status: ${response.status} ${response.statusText}`)
    console.log('📦 Resposta:', text.substring(0, 200))
    
    if (response.status === 404 && text.includes('Route GET:/ not found')) {
      console.log('\n✅ URL Base está acessível! (404 é esperado na raiz)')
      return true
    } else {
      console.log('\n⚠️ Resposta inesperada da URL base')
      return false
    }
  } catch (error) {
    console.error('❌ Erro ao acessar URL base:', error.message)
    return false
  }
}

// Executa todos os testes
async function executarTestes() {
  console.log('🚀 Iniciando testes completos V8 Digital...')
  console.log('💡 Dica: Você pode passar um CPF como argumento: node test-v8-digital-completo.js 12345678900')
  
  try {
    // Teste 0: Verificar URL Base
    await testarURLBase()
    
    // Aguarda 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Teste 1: Autenticação
    const token = await testarAutenticacao()
    
    // Aguarda 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Teste 2: Consulta CLT (só se autenticação funcionou)
    if (token) {
      await testarConsultaCLT(token)
      
      // Aguarda 1 segundo
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Teste 3: Termo de Consentimento
      await testarTermoConsentimento(token)
    } else {
      console.log('\n⚠️ Não foi possível obter token. Testes de consulta e termo de consentimento foram pulados.')
      console.log('💡 Resolva o problema de autenticação primeiro.')
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Testes concluídos!')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n❌ Erro ao executar testes:', error)
    process.exit(1)
  }
}

// Verifica se fetch está disponível (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Este script requer Node.js 18+ ou instale node-fetch')
  process.exit(1)
}

// Executa os testes
executarTestes()
