/**
 * Script de teste para V8 Digital
 * Testa consulta CLT e termo de consentimento
 */

const BASE_URL = 'http://localhost:3004'

// Função para fazer requisições
async function fazerRequisicao(endpoint, body) {
  try {
    console.log(`\n📤 Fazendo requisição para: ${endpoint}`)
    console.log('📋 Body:', JSON.stringify(body, null, 2))
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

// Teste 1: Consulta CLT
async function testarConsultaCLT() {
  console.log('\n' + '='.repeat(60))
  console.log('TESTE 1: Consulta CLT V8 Digital')
  console.log('='.repeat(60))
  
  const cpf = process.argv[2] || '12345678900' // CPF como argumento ou padrão
  
  const resultado = await fazerRequisicao('/api/produto/consultar-clt', {
    cpfTrabalhador: cpf,
    apiId: 'v8digital-default', // Ajuste conforme sua configuração
  })
  
  if (resultado.success) {
    console.log('\n✅ Consulta CLT realizada com sucesso!')
  } else {
    console.log('\n❌ Erro na consulta CLT')
  }
  
  return resultado
}

// Teste 2: Termo de Consentimento
async function testarTermoConsentimento() {
  console.log('\n' + '='.repeat(60))
  console.log('TESTE 2: Termo de Consentimento V8 Digital')
  console.log('='.repeat(60))
  
  const cpf = process.argv[2] || '12345678900' // CPF como argumento ou padrão
  
  const resultado = await fazerRequisicao('/api/produto/v8/termo-consentimento', {
    cpf: cpf,
    nome: 'João da Silva',
    telefone: '73999999999',
    email: 'joao@example.com',
    apiId: 'v8digital-default', // Ajuste conforme sua configuração
  })
  
  if (resultado.success) {
    console.log('\n✅ Termo de consentimento criado com sucesso!')
  } else {
    console.log('\n❌ Erro ao criar termo de consentimento')
  }
  
  return resultado
}

// Executa os testes
async function executarTestes() {
  console.log('🚀 Iniciando testes V8 Digital...')
  console.log('💡 Dica: Você pode passar um CPF como argumento: node test-v8-digital.js 12345678900')
  
  try {
    // Teste 1: Consulta CLT
    await testarConsultaCLT()
    
    // Aguarda 1 segundo entre os testes
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Teste 2: Termo de Consentimento
    await testarTermoConsentimento()
    
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
