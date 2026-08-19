# API FACTA – Consulta Dados CLT (BASE OFFLINE)

Resumo com base no **Manual do WebService FACTA v2.0 – BASE OFFLINE CLT** (emissão 09.01.2026).

## Visão geral

Consulta na **base OFFLINE** da Facta: usa histórico já existente, **sem necessidade de autorização** (SMS/WhatsApp) do registro.

## Endpoints

| Etapa | Método | Homologação | Produção |
|--------|--------|-------------|----------|
| 1. Gerar token | GET | `https://cltoff-homol.facta.com.br/gera-token` | `https://cltoff.facta.com.br/gera-token` |
| 2. Consultar CPF | GET | `https://cltoff-homol.facta.com.br/clt/base-offline?cpf=00000000000` | `https://cltoff.facta.com.br/clt/base-offline?cpf=00000000000` |

## Autenticação

- **Token:** Header `Authorization: Basic <base64(entidade:password)>` em `/gera-token`.
- **Consulta:** Header `Authorization: Bearer <token>` em `/clt/base-offline`.
- Token válido por **1 hora**; pode ser reutilizado em várias requisições.

## Regra importante: intervalo entre consultas

> **Há um intervalo de 3 segundos entre cada requisição** de consulta (`/clt/base-offline`).

- Na **consulta individual** isso não impacta.
- No **lote** (Facta em lote – modo Offline), o sistema já respeita esse intervalo.

## Respostas de erro (exemplos do manual)

- **Token:** `"Usuário ou password inválida"`, `"Authorization incorreto"`.
- **Consulta:** `"Consulta de base offline indisponível, volte em 3 segundos"`, `"Nenhum dado encontrado!"`, validação de CPF.

## Variáveis de ambiente (este projeto)

- `FACTA_OFFLINE_API_BASE_URL` – obrigatório (ex.: `https://cltoff-homol.facta.com.br`).
- `FACTA_OFFLINE_API_USERNAME` / `FACTA_OFFLINE_API_PASSWORD` – ou, se for o mesmo usuário, `FACTA_API_USERNAME` / `FACTA_API_PASSWORD`.

## Ajuste de credenciais (v2.0 – 09.01.2026)

O manual v2.0 cita **“Ajuste de Credenciais”**. A Facta pode ter passado a exigir **credenciais específicas** para a base offline. Em caso de **403 Forbidden** ou “Usuário ou password inválida” na base offline:

1. Confirmar com a Facta se o usuário tem **acesso à base OFFLINE** (cltoff).
2. Solicitar, se necessário, **usuário/password específicos** para a API Base Offline.

## Implementação no código

- registro: `lib/facta-offline-client.ts`
- Rota: `app/api/produto/facta/offline/consultar/route.ts`
- Telas: Consulta individual (OFFLINE) e Facta em lote (modo Offline).
