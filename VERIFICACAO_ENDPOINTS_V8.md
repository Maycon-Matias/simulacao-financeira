# Verificação de Endpoints V8 Digital

## ✅ URL Base Confirmada
- **Base URL**: `https://bff.v8sistema.com/` ✅
- **Auth URL**: `https://auth.v8sistema.com/oauth/token` ✅

## Endpoints Implementados

### 1. Consulta CLT
- **Endpoint Atual**: `POST https://bff.v8sistema.com/clt/consultar`
- **Parâmetros**: `{ cpf: string }`
- **Status**: ⚠️ **Precisa verificar na documentação oficial**

### 2. Termo de Consentimento
- **Endpoint Atual**: `POST https://bff.v8sistema.com/clt/termo-consentimento`
- **Parâmetros**: `{ cpf, nome?, telefone?, email? }`
- **Status**: ⚠️ **Precisa verificar na documentação oficial**

## ⚠️ Importante

Os endpoints acima foram implementados baseados em padrões comuns, mas **podem estar incorretos**. É necessário verificar na documentação oficial da V8 Digital:

**Documentação**: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)

### Possíveis variações de endpoints:

1. **Consulta CLT** pode ser:
   - `/clt/consultar` (implementado)
   - `/api/clt/consultar`
   - `/clt/vinculos`
   - `/clt/consulta`
   - Outro caminho conforme documentação

2. **Termo de Consentimento** pode ser:
   - `/clt/termo-consentimento` (implementado)
   - `/clt/consentimento`
   - `/clt/termo`
   - `/api/clt/consentimento`
   - Outro caminho conforme documentação

## Como Verificar

1. Acesse: [http://docs.v8sistema.com/](http://docs.v8sistema.com/)
2. Navegue até a seção: **Crédito Privado CLT**
3. Verifique os endpoints exatos para:
   - Consulta de vínculos CLT
   - Criação de termo de consentimento
4. Compare com os endpoints implementados
5. Se diferentes, atualize em:
   - `lib/v8-digital-client.ts` (linhas 370 e 398)

## Próximos Passos

1. **Resolver autenticação primeiro** (erro 401)
2. **Verificar documentação** para confirmar endpoints
3. **Ajustar endpoints** se necessário
4. **Testar consulta e termo de consentimento**

## Nota

A URL base `https://bff.v8sistema.com/` está correta. O problema atual é na autenticação (401 Unauthorized), que precisa ser resolvido antes de testar os outros endpoints.
