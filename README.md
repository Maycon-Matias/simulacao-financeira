# Consulta registro Porã Cred

Sistema de consultas e simulações de crédito consignado.

## 🚀 Início Rápido

### Instalação

```bash
npm install
```

### Configuração

1. Crie o arquivo `.env.local` na raiz do projeto
2. Configure as variáveis de ambiente:
   ```env
   HUBCREDITO_API_BASE_URL=https://api.hubcredito.com.br/api
   HUBCREDITO_API_USERNAME=seu_usuario
   HUBCREDITO_API_PASSWORD=sua_senha
   ```

Nunca commite credenciais reais. Use `.env.local` apenas no ambiente local/servidor.

### Executar

```bash
npm run dev
```

O sistema estará disponível em `http://localhost:3004`

### Deploy em um domínio

Para publicar a API em um domínio (ex.: `https://api.poracred.com.br`) e conectar o sistema-whatsapp/CRM, veja **[docs/DEPLOY_DOMINIO.md](docs/DEPLOY_DOMINIO.md)**.

## 📋 Funcionalidades

- ✅ **Consultas** de propostas e vínculos CLT
- ✅ **Simulações** do produto
- ✅ **Configuração** de API via interface
- ✅ **Teste de conexão** em tempo real
- ✅ **Exportação** de resultados em JSON
- ✅ **Visualização formatada** dos resultados

## 🎯 Como Usar

### Consultar Produto

1. Acesse a aba **"Consultar"**
2. Insira os parâmetros em formato JSON ou chave:valor
3. (Opcional) Configure um endpoint customizado
4. Clique em **"Consultar"**
5. Visualize os resultados

### Simular Produto

1. Acesse a aba **"Simular"**
2. Insira os parâmetros da simulação
3. Clique em **"Simular"**
4. Visualize os resultados formatados
5. (Opcional) Exporte os resultados em JSON

### Configurar API

1. Acesse a aba **"Configuração"**
2. Configure temporariamente URL e credenciais para teste
3. Clique em **"Testar Conexão"**
4. Para configuração permanente, use o arquivo `.env.local`

## 🔧 Estrutura do Projeto

```
Sistema-Produto-API/
├── app/
│   ├── api/produto/      # Rotas de API
│   ├── page.tsx          # Página principal
│   └── layout.tsx         # Layout base
├── components/
│   ├── produto-consultar.tsx
│   ├── produto-simular.tsx
│   ├── produto-api-config.tsx
│   └── ui/               # Componentes UI
└── lib/
    └── api-client.ts     # registro HTTP
```

## 📡 API Endpoints

O sistema cria rotas proxy para a API externa:

- `POST /api/produto/consultar` - Consultar produto
- `POST /api/produto/simular` - Simular produto
- `GET /api/produto/config` - Obter configuração
- `POST /api/produto/config/test` - Testar conexão

## 🔐 Segurança

- Credenciais nunca são expostas no frontend
- Autenticação via headers seguros
- Validação de dados no servidor
- Timeout configurável (30s padrão)

