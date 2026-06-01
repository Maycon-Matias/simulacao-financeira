# 🧪 Teste de Verificação de Autorização - Guia Rápido

## 📋 Informações Necessárias

Para testar a verificação de status de autorização, preciso das seguintes informações:

### 1. **CPF do registro**
- Apenas números (11 dígitos)
- Exemplo: `09182487448`

### 2. **Service Type**
- Código da bancarizadora
- Padrão: `QITECH`

### 3. **API ID**
- ID da API configurada
- Você pode encontrar na interface de configuração de APIs
- Geralmente: `nossafintech`

---

## 🔍 Como Testar via Interface do Sistema

A forma mais simples é usar a própria interface do sistema:

1. **Acesse a página de Consulta CLT em Lote**
   - Procure pela funcionalidade de consulta em lote

2. **Crie um CSV simples com um registro:**
   ```csv
   CPF,Nome,cnpjEmpregador,serviceType,telefone
   09182487448,registro Teste,12345678000190,QITECH,(99)99999-9999
   ```

3. **Faça upload do CSV**

4. **Selecione a API "Nossa Fintech"**

5. **Abra o Console do Navegador (F12)**
   - Vá na aba "Console"

6. **Execute uma das ações:**
   - Clique em "Autorizar e Consultar" - isso vai verificar o status primeiro
   - Ou clique em "Consultar" - que também verifica status quando há erro de autorização

7. **Observe os logs no console:**
   - Procure por: `[CLT Consulta Lote] Status da autorização para CPF`
   - Procure por: `Estrutura completa da resposta de status`

---

## 📊 O que Você Verá nos Logs

### Quando JÁ POSSUI autorização (AUTHORIZED):
```
[CLT Consulta Lote] Status da autorização para CPF 09182487448: AUTHORIZED
[CLT Consulta Lote] CPF 09182487448 já possui autorização válida (AUTHORIZED). Pulando criação.
```

### Quando está PENDENTE:
```
[CLT Consulta Lote] Status da autorização para CPF 09182487448: PENDING
[CLT Consulta Lote] Estrutura completa da resposta de status: {
  "success": true,
  "data": {
    "success": true,
    "data": {
      "status": "PENDING",
      "authorization_link": "https://autorizacao-clt.QITECH.com.br/Info.html"
    }
  }
}
```

### Quando NÃO POSSUI autorização:
```
[CLT Consulta Lote] Status da autorização para CPF 09182487448: NOT_AUTHORIZED
```

---

## 🚀 Teste Rápido via Browser (Recomendado)

**A maneira mais fácil é usar o console do navegador diretamente:**

1. **Abra a página do sistema no navegador**

2. **Abra o Console (F12 → Console)**

3. **Cole e execute este código** (substitua os valores):

```javascript
async function testarVerificacao() {
  const cpf = '09182487448'; // SUBSTITUA pelo CPF do registro
  const serviceType = 'QITECH';
  const apiId = 'nossafintech'; // SUBSTITUA pelo ID da sua API

  console.log('🔄 Testando verificação de autorização...');
  console.log('CPF:', cpf);
  console.log('Service Type:', serviceType);
  console.log('API ID:', apiId);
  console.log('');

  try {
    const response = await fetch('/api/produto/verificar-status-clt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, serviceType, apiId })
    });

    const data = await response.json();
    
    console.log('='.repeat(60));
    console.log('✅ RESPOSTA DA API:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    // Extrai status
    let status = null;
    if (data.success && data.data) {
      status = data.data.data?.status || data.data.status || data.status;
      console.log('📊 STATUS EXTRAÍDO:', status);
      
      if (status === 'AUTHORIZED' || status === 'AUTORIZADO') {
        console.log('✅ registro JÁ POSSUI autorização APROVADA');
      } else if (status === 'PENDING' || status === 'PENDENTE') {
        console.log('⏳ Autorização PENDENTE - registro precisa confirmar via SMS');
        const link = data.data.data?.authorization_link || data.data.authorization_link;
        if (link) console.log('🔗 Link:', link);
      } else {
        console.log('❌ Autorização NÃO encontrada ou NÃO aprovada');
      }
    }
  } catch (error) {
    console.error('❌ ERRO:', error);
  }
}

// Execute a função
testarVerificacao();
```

4. **Pressione Enter e veja o resultado!**

---

## 📝 Envie as Informações Aqui

Se preferir, envie as informações aqui e eu posso ajudar a interpretar os resultados:

1. CPF do registro: `____________`
2. Service Type: `____________` (geralmente QITECH)
3. API ID: `____________` (geralmente nossafintech)

E eu posso ajudar a interpretar os logs ou criar um teste mais específico!

