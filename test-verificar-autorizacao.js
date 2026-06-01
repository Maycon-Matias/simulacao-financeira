/**
 * Script para testar a verificação de status de autorização
 * 
 * USO:
 * node test-verificar-autorizacao.js <CPF> <SERVICE_TYPE> <API_ID>
 * 
 * Exemplo:
 * node test-verificar-autorizacao.js 09182487448 QITECH nossafintech
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function testarVerificacaoAutorizacao() {
  console.log('='.repeat(60));
  console.log('TESTE DE VERIFICAÇÃO DE STATUS DE AUTORIZAÇÃO - NOSSA FINTECH');
  console.log('='.repeat(60));
  console.log('');

  // Solicita informações necessárias
  const cpf = await perguntar('CPF do registro (apenas números): ');
  const serviceType = await perguntar('Service Type (padrão: QITECH): ') || 'QITECH';
  const apiId = await perguntar('API ID (ex: nossafintech): ');

  console.log('');
  console.log('📋 Dados para teste:');
  console.log(`   CPF: ${cpf}`);
  console.log(`   Service Type: ${serviceType}`);
  console.log(`   API ID: ${apiId}`);
  console.log('');

  // Prepara a requisição
  const url = 'http://localhost:3000/api/produto/verificar-status-clt';
  
  const body = {
    cpf: cpf.replace(/\D/g, ''), // Remove formatação
    serviceType: serviceType,
    apiId: apiId
  };

  console.log('🔄 Enviando requisição...');
  console.log('   URL:', url);
  console.log('   Body:', JSON.stringify(body, null, 2));
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    console.log('='.repeat(60));
    console.log('RESPOSTA DA API:');
    console.log('='.repeat(60));
    console.log('');
    console.log('Status HTTP:', response.status, response.statusText);
    console.log('');
    console.log('Resposta completa:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    // Análise da resposta
    if (data.success && data.data) {
      console.log('✅ RESPOSTA COM SUCESSO');
      console.log('');

      // Extrai status de múltiplos níveis
      let status = null;
      let authorizationLink = null;
      
      if (data.data.data?.status) {
        status = data.data.data.status;
        authorizationLink = data.data.data.authorization_link;
      } else if (data.data.status) {
        status = data.data.status;
        authorizationLink = data.data.authorization_link;
      } else if (data.status) {
        status = data.status;
      }

      console.log('📊 STATUS EXTRAÍDO:');
      console.log(`   Status: ${status || 'NÃO ENCONTRADO'}`);
      if (authorizationLink) {
        console.log(`   Link de Autorização: ${authorizationLink}`);
      }
      console.log('');

      // Interpreta o status
      if (status) {
        const statusUpper = String(status).toUpperCase().trim();
        console.log('🔍 INTERPRETAÇÃO:');
        if (statusUpper === 'AUTHORIZED' || statusUpper === 'AUTORIZADO') {
          console.log('   ✅ registro JÁ POSSUI autorização APROVADA');
          console.log('   → Pode prosseguir com consulta de margem');
        } else if (statusUpper === 'PENDING' || statusUpper === 'PENDENTE') {
          console.log('   ⏳ Autorização PENDENTE');
          console.log('   → registro precisa confirmar via SMS');
          if (authorizationLink) {
            console.log(`   → Link para confirmar: ${authorizationLink}`);
          }
        } else if (statusUpper === 'NOT_AUTHORIZED' || statusUpper === 'FALSE') {
          console.log('   ❌ Autorização NÃO ENCONTRADA ou NÃO APROVADA');
          console.log('   → Precisa criar nova autorização');
        } else {
          console.log(`   ❓ Status desconhecido: ${status}`);
        }
      }
    } else {
      console.log('❌ ERRO NA RESPOSTA');
      console.log(`   Erro: ${data.error || 'Erro desconhecido'}`);
    }

    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('');
    console.error('❌ ERRO AO FAZER REQUISIÇÃO:');
    console.error('   Verifique se o servidor está rodando (npm run dev)');
    console.error('   Erro:', error.message);
    console.error('');
  }

  rl.close();
}

function perguntar(pergunta) {
  return new Promise((resolve) => {
    rl.question(pergunta, (resposta) => {
      resolve(resposta.trim());
    });
  });
}

// Executa o teste
testarVerificacaoAutorizacao().catch(console.error);

