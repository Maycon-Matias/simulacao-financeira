# Deploy do Sistema-Produto-API em um domínio

Para colocar o **Sistema-Produto-API** em um domínio (ex.: `https://api.poracred.com.br`), use um dos fluxos abaixo.

## 1. Deploy na Vercel (recomendado)

1. **Conectar o repositório**
   - No [Vercel](https://vercel.com), importe o projeto do Sistema-Produto-API (GitHub/GitLab).
   - Build Command: `npm run build`
   - Output: Next.js (detectado automaticamente).
   - **Não** defina Port; a Vercel usa o padrão do Next.js.

2. **Variáveis de ambiente**
   - Em **Settings → Environment Variables** do projeto, configure:
     - `NEXT_PUBLIC_BASE_URL` = **URL pública da API** (ex.: `https://api.poracred.com.br`).
       - Necessário se você for usar **domínio customizado**.
       - Se não definir, a API usará a URL gerada pela Vercel (ex.: `https://sistema-produto-api-xxx.vercel.app`).
     - As demais variáveis que você já usa em `.env.local` (API Hub, C6, V8, CredSpot, etc.), apenas em **Production** (e em Preview se quiser testar).

3. **Domínio customizado**
   - Em **Settings → Domains**, adicione o domínio (ex.: `api.poracred.com.br`).
   - Siga as instruções de DNS (registro CNAME ou A).
   - Depois que o domínio estiver ativo, defina (ou atualize) `NEXT_PUBLIC_BASE_URL` para essa URL (ex.: `https://api.poracred.com.br`) e faça um novo deploy.

4. **Apontar o sistema-whatsapp para esta API**
   - No projeto **sistema-whatsapp** (ou CRM que consome esta API), configure:
     - `PRODUTO_API_URL` ou `NEXT_PUBLIC_PRODUTO_API_URL` = mesma URL do domínio (ex.: `https://api.poracred.com.br`).
   - Reinicie o sistema-whatsapp ou faça redeploy para carregar a nova variável.

## 2. Outros provedores (VPS, Docker, etc.)

- Rode a aplicação com `npm run build` e `npm run start` (ou `next start -p 3004`).
- Coloque um proxy reverso (Nginx, Caddy, etc.) com HTTPS na frente, apontando para a porta da aplicação.
- Defina `NEXT_PUBLIC_BASE_URL` com a URL pública final (ex.: `https://api.poracred.com.br`).
- No sistema-whatsapp, defina `PRODUTO_API_URL` para essa mesma URL.

## Resumo

| Onde              | Variável                 | Exemplo                          |
|-------------------|--------------------------|----------------------------------|
| Sistema-Produto-API | `NEXT_PUBLIC_BASE_URL`   | `https://api.poracred.com.br`   |
| sistema-whatsapp  | `PRODUTO_API_URL`        | `https://api.poracred.com.br`   |

Assim a API fica no domínio e o robô WhatsApp (e outros consumidores) passam a usar essa URL.
