# Informações Necessárias para Testar Verificação de Autorização

Para testar a verificação de status de autorização de um registro, preciso das seguintes informações:

## 📋 Dados Obrigatórios

1. **CPF do registro**
   - Formato: apenas números (11 dígitos)
   - Exemplo: `09182487448`

2. **Service Type**
   - Código da bancarizadora
   - Padrão: `QITECH`
   - Exemplo: `QITECH`

3. **API ID**
   - ID da API configurada no sistema
   - Geralmente: `nossafintech` ou outro ID que você configurou
   - Pode verificar na configuração da API

## 🔧 Opcional (se necessário)

4. **Credenciais** (geralmente já configuradas no sistema)
   - CPF/Username
   - ******
   - Base URL
   - Promot ID

## 📝 Como Fornecer as Informações

Você pode fornecer as informações de duas formas:

### Opção 1: Via Interface do Sistema
1. Acesse a funcionalidade de "Consulta CLT em Lote"
2. Faça upload de um CSV com pelo menos um registro
3. Selecione a API "Nossa Fintech"
4. Clique em "Autorizar e Consultar" ou "Consultar"
5. Verifique os logs no console do navegador (F12)

### Opção 2: Via Script de Teste (Node.js)

1. Certifique-se de que o servidor está rodando:
   ```bash
   npm run dev
   ```

2. Execute o script de teste:
   ```bash
   node test-verificar-autorizacao.js
   ```

3. Digite as informações quando solicitado

## 🔍 O que o Teste Vai Mostrar

O teste vai exibir:
- ✅ Status da autorização (AUTHORIZED, PENDING, NOT_AUTHORIZED)
- 🔗 Link de autorização (se disponível)
- 📊 Estrutura completa da resposta da API
- 🔍 Interpretação do status

## 📌 Exemplo de Resposta Esperada

### Quando já possui autorização (AUTHORIZED):
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Status de autorização consultado com sucesso.",
    "data": {
      "status": "AUTHORIZED",
      "authorization_link": null
    },
    "status": "AUTHORIZED"
  }
}
```

### Quando está pendente (PENDING):
```json
{
  "success": true,
  "data": {
    "success": true,
    "data": {
      "status": "PENDING",
      "authorization_link": "https://autorizacao-clt.QITECH.com.br/Info.html"
    },
    "status": "PENDING"
  }
}
```

## ❓ Preciso de Ajuda?

Se precisar, posso ajudar você a:
- Identificar o API ID configurado
- Verificar se as credenciais estão corretas
- Interpretar os resultados do teste

