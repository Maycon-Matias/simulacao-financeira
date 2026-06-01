# 🔐 Credenciais da API HubCredito

## Credenciais Configuradas

```
entidade: 10143545108
******: Maycon123
Loja ID: 15377
```

## Configuração do .env.local

Crie o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.hubcredito.com.br/api
NEXT_PUBLIC_API_USERNAME=10143545108
NEXT_PUBLIC_API_PASSWORD=Maycon123
```

## Observações

- O sistema fará login automaticamente ao iniciar
- O **entidade ID** (UUID) será obtido automaticamente após o login
- O **Loja ID (15377)** será preenchido automaticamente
- Se você tiver múltiplas lojas, poderá selecionar no dropdown

## Segurança

⚠️ **IMPORTANTE:** 
- Nunca commite o arquivo `.env.local` no Git
- O arquivo já está no `.gitignore`
- As credenciais são usadas apenas no servidor (backend)

