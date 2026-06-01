# Endpoints V8 Digital - Base URL: https://bff.v8sistema.com

## URL Base Configurada
✅ **Base URL**: `https://bff.v8sistema.com`
✅ **Auth URL**: `https://auth.v8sistema.com/oauth/token`

## Endpoints Implementados

### 1. Autenticação
- **Endpoint**: `POST https://auth.v8sistema.com/oauth/token`
- **Status**: ✅ Implementado
- **Parâmetros**: `grant_type`, `username`, `******`, `client_id`, `scope`

### 2. Consulta CLT
- **Endpoint**: `POST https://bff.v8sistema.com/clt/consultar`
- **Status**: ✅ Implementado
- **Método**: `consultarVinculosCLT(cpf: string)`
- **Parâmetros**: `{ cpf: string }`

### 3. Termo de Consentimento
- **Endpoint**: `POST https://bff.v8sistema.com/clt/termo-consentimento`
- **Status**: ✅ Implementado
- **Método**: `criarTermoConsentimentoCLT(params)`
- **Parâmetros**: `{ cpf, nome?, telefone?, email? }`

### 4. Simulação CLT
- **Endpoint**: `POST https://bff.v8sistema.com/clt/simular`
- **Status**: ✅ Implementado
- **Método**: `simularCreditoCLT(params)`

### 5. Criar Proposta CLT
- **Endpoint**: `POST https://bff.v8sistema.com/clt/proposta`
- **Status**: ✅ Implementado
- **Método**: `criarPropostaCLT(params)`

### 6. Listar Operações CLT
- **Endpoint**: `GET https://bff.v8sistema.com/clt/operacoes`
- **Status**: ✅ Implementado
- **Método**: `listarOperacoesCLT(cpf?)`

## ⚠️ Importante

Os endpoints acima foram implementados baseados no padrão comum de APIs REST. **É necessário verificar na documentação oficial da V8 Digital** se os endpoints estão corretos:

- **Documentação**: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
- **Verificar**: Se os caminhos dos endpoints estão corretos
- **Exemplo**: Pode ser `/api/clt/consultar` ao invés de `/clt/consultar`

## Como Verificar

1. Consulte a documentação oficial: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
2. Verifique os endpoints exatos na seção de "Crédito Privado CLT"
3. Se os endpoints estiverem diferentes, atualize em:
   - `lib/v8-digital-client.ts`
   - `app/api/produto/v8/termo-consentimento/route.ts`

## Teste dos Endpoints

Após resolver a autenticação, você pode testar:

```bash
# 1. Consulta CLT
curl -X POST https://bff.v8sistema.com/clt/consultar \
  -H "Authorization: Bearer REDACTED" \
  -H "Content-Type: application/json" \
  -d '{"cpf": "12345678900"}'

# 2. Termo de Consentimento
curl -X POST https://bff.v8sistema.com/clt/termo-consentimento \
  -H "Authorization: Bearer REDACTED" \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "12345678900",
    "nome": "João da Silva",
    "telefone": "73999999999"
  }'
```

**Nota**: Substitua `SEU_TOKEN_AQUI` pelo token obtido na autenticação.
