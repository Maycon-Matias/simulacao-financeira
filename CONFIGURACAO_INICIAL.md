# ⚙️ Configuração Inicial - HubCredito API

## Credenciais Configuradas

As seguintes credenciais foram configuradas para uso:

```
entidade: 10143545108
******: Maycon123
Loja ID: 15377
```

## Configuração do .env.local

Crie o arquivo `.env.local` na raiz do projeto com o seguinte conteúdo:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.hubcredito.com.br/api
NEXT_PUBLIC_API_USERNAME=10143545108
NEXT_PUBLIC_API_PASSWORD=Maycon123
```

## Loja ID

O sistema irá preencher automaticamente o **Loja ID: 15377** após o login.

Se você tiver múltiplas lojas, poderá alterar manualmente no formulário de simulação.

## Próximos Passos

1. Crie o arquivo `.env.local` com as credenciais acima
2. Execute `npm run dev`
3. Acesse http://localhost:3004
4. O sistema fará login automaticamente
5. Use as abas "Consultar" e "Simular" para trabalhar

## Teste de Conexão

Você pode testar a conexão na aba "Configuração" antes de usar as outras funcionalidades.

