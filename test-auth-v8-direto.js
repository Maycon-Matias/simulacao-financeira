/**
 * Teste direto do endpoint de autenticação V8 Digital
 * Testa diferentes formatos de requisição OAuth
 */

const AUTH_URL = 'https://auth.v8sistema.com/oauth/token'

// Credenciais
const credentials = {
  username: 'poracred61@gmail.com',
  ******: 'Ponta@2025',
  clientId: 'DHWogdaYmEI8n5bwwxPDzulMISK7dwln',
}

// Função para testar formato de requisição
async function testarFormato(formato, descricao) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🧪 ${descricao}`)
  console.log('='.repeat(60))
  
  try {
    let response
    let body
    
    if (formato === 'form-urlencoded') {
      // Formato 1: application/x-www-form-urlencoded (padrão OAuth)
      const formData = new URLSearchParams()
      formData.append('grant_type', '******')
      formData.append('username', credentials.username)
      formData.append('******', credentials.******)
      formData.append('client_id', credentials.clientId)
      formData.append('scope', 'offline_access')
      
      body = formData.toString()
      
      console.log('📋 Body:', body.replace(/******=[^&]*/, '******=***'))
      
      response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body,
      })
    } else if (formato === 'form-urlencoded-audience') {
      // Formato 2: Com audience (se necessário)
      const formData = new URLSearchParams()
      formData.append('grant_type', '******')
      formData.append('username', credentials.username)
      formData.append('******', credentials.******)
      formData.append('client_id', credentials.clientId)
      formData.append('scope', 'offline_access')
      // Audience seria adicionado aqui se tivéssemos o valor
      // formData.append('audience', 'VALOR_AQUI')
      
      body = formData.toString()
      
      console.log('📋 Body:', body.replace(/******=[^&]*/, '******=***'))
      console.log('⚠️ Nota: Audience não incluído (precisa do valor da V8 Digital)')
      
      response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body,
      })
    } else if (formato === 'basic-auth') {
      // Formato 3: Com Basic Auth no header
      const basicAuth = Buffer.from(`${credentials.clientId}:`).toString('base64')
      
      const formData = new URLSearchParams()
      formData.append('grant_type', '******')
      formData.append('username', credentials.username)
      formData.append('******', credentials.******)
      formData.append('scope', 'offline_access')
      
      body = formData.toString()
      
      console.log('📋 Body:', body.replace(/******=[^&]*/, '******=***'))
      console.log('🔐 Basic Auth Header:', `Basic ${basicAuth.substring(0, 20)}...`)
      
      response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: body,
      })
    } else if (formato === 'json') {
      // Formato 4: JSON (menos comum para OAuth, mas vamos testar)
      body = JSON.stringify({
        grant_type: '******',
        username: credentials.username,
        ******: credentials.******,
        client_id: credentials.clientId,
        scope: 'offline_access',
      })
      
      console.log('📋 Body:', JSON.stringify({
        grant_type: '******',
        username: credentials.username,
        ******: '***',
        client_id: credentials.clientId,
        scope: 'offline_access',
      }, null, 2))
      
      response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body,
      })
    }
    
    const responseText = await response.text()
    let responseData
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }
    
    console.log(`\n📥 Status: ${response.status} ${response.statusText}`)
    console.log('📦 Resposta:', JSON.stringify(responseData, null, 2))
    
    if (response.ok && responseData.access_token) {
      console.log('\n✅ SUCESSO! Token obtido!')
      console.log('🔑 Token (primeiros 30 caracteres):', responseData.access_token.substring(0, 30) + '...')
      return { success: true, token: responseData.access_token, formato }
    } else {
      console.log('\n❌ Falhou')
      return { success: false, status: response.status, data: responseData, formato }
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
    return { success: false, error: error.message, formato }
  }
}

// Executa todos os testes
async function executarTestes() {
  console.log('🚀 Testando diferentes formatos de autenticação OAuth')
  console.log('🔗 Endpoint:', AUTH_URL)
  console.log('👤 Username:', credentials.username)
  console.log('🆔 Client ID:', credentials.clientId)
  
  const resultados = []
  
  // Teste 1: Formato padrão (form-urlencoded)
  resultados.push(await testarFormato('form-urlencoded', 'Formato 1: application/x-www-form-urlencoded (Padrão OAuth)'))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Teste 2: Com Basic Auth
  resultados.push(await testarFormato('basic-auth', 'Formato 2: Com Basic Auth no header'))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Teste 3: JSON (improvável, mas vamos testar)
  resultados.push(await testarFormato('json', 'Formato 3: application/json'))
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Resumo
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMO DOS TESTES')
  console.log('='.repeat(60))
  
  const sucesso = resultados.find(r => r.success)
  if (sucesso) {
    console.log(`\n✅ Formato que funcionou: ${sucesso.formato}`)
  } else {
    console.log('\n❌ Nenhum formato funcionou')
    console.log('\n💡 Possíveis causas:')
    console.log('   1. Credenciais incorretas ou expiradas')
    console.log('   2. Falta parâmetro "audience" (valor fornecido pela V8 Digital)')
    console.log('   3. Falta parâmetro "client_secret" (se necessário)')
    console.log('   4. Conta não autorizada ou bloqueada')
    console.log('\n📧 Entre em contato com V8 Digital: ti@v8digital.online')
  }
  
  resultados.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.formato}: ${r.success ? '✅ Sucesso' : '❌ Falhou'}`)
    if (!r.success && r.data) {
      console.log(`   Erro: ${r.data.error || r.data.error_description || 'Desconhecido'}`)
    }
  })
}

// Verifica se fetch está disponível
if (typeof fetch === 'undefined') {
  console.error('❌ Este script requer Node.js 18+')
  process.exit(1)
}

// Executa os testes
executarTestes()
