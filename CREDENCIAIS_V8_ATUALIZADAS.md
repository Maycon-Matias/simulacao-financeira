# Credenciais V8 Digital Atualizadas

## Valores Configurados

As seguintes credenciais foram atualizadas no sistema:

```env
V8_API_CLIENT_ID=DHWdgAymE8n5bwwxPDzulMlSK7dwln
V8_API_AUDIENCE=https://bff.v8sistema.com
```

## Status da Autenticação

⚠️ **Atenção**: O teste de autenticação ainda retorna `401 Unauthorized` mesmo com `audience` configurado.

### Possíveis Causas

1. **Credenciais de usuário (username/******) podem estar incorretas ou expiradas**
   - Verifique se `poracred61@gmail.com` e a ****** estão corretos
   - A ****** pode ter expirado ou sido alterada

2. **Client ID pode estar incorreto ou não autorizado**
   - O Client ID fornecido: `DHWdgAymE8n5bwwxPDzulMlSK7dwln`
   - Verifique se este Client ID está ativo e autorizado para sua conta

3. **Pode faltar `client_secret`**
   - Algumas configurações OAuth requerem `client_secret` além de `client_id`
   - Entre em contato com V8 Digital para confirmar

4. **Conta pode não estar autorizada**
   - A conta pode estar bloqueada ou sem permissão para acessar a API
   - Verifique com V8 Digital se a conta está ativa

## Próximos Passos

1. ✅ **Configuração atualizada** - `audience` e `client_id` foram atualizados no código
2. ⚠️ **Verificar credenciais** - Confirmar username/****** com V8 Digital
3. ⚠️ **Verificar client_secret** - Perguntar se é necessário
4. ⚠️ **Verificar status da conta** - Confirmar se a conta está ativa e autorizada

## Contato V8 Digital

- **Email**: `ti@v8digital.online`
- **Informar**:
  - Client ID: `DHWdgAymE8n5bwwxPDzulMlSK7dwln`
  - Audience: `https://bff.v8sistema.com`
  - Erro: `401 Unauthorized` mesmo com audience configurado
  - Perguntar:
    - As credenciais de usuário estão corretas?
    - É necessário `client_secret`?
    - A conta está ativa e autorizada?

## Arquivos Atualizados

- ✅ `lib/api-manager.ts` - Client ID e Audience atualizados
- ✅ `lib/v8-digital-client.ts` - Client ID e Audience atualizados
- ✅ `CONFIGURACAO_V8_DIGITAL.md` - Documentação atualizada

## Teste

Execute o teste para verificar:

```bash
node test-v8-com-credenciais.js
```

O teste mostra:
- ✅ Audience configurado corretamente
- ✅ Client ID atualizado
- ❌ Ainda retorna 401 (provavelmente problema com username/****** ou client_secret)
