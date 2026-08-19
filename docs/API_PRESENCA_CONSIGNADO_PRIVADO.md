# API Presença Bank – Consignado Privado (CLT)

Documentação baseada na collection Postman **ConsignadoPrivado**. Base URL: `{{url}}` (ex.: `https://presenca-bank-api.azurewebsites.net` ou `http://localhost:5125`).

**Configuração:** O registro usa timeout padrão de **120 segundos** por requisição (consultar-vinculos pode demorar). Para alterar: variável de ambiente `PRESENCA_API_TIMEOUT_MS` (valor em milissegundos; ex.: `180000` = 3 min).

---

## Autorização para consultar vínculos

A API pode retornar **400** com a mensagem *"Não foi possível retornar a consulta, é necessario uma autorização válida"* ao chamar **consultar vínculos** sem uma autorização prévia.

- **Configuração:** Defina no ambiente o path do endpoint de **gerar termo** (usado na collection ConsignadoPrivado para o fluxo CLT):
  - `PRESENCA_AUTORIZACAO_PATH=/consultas/termo-inss`
  - O nome "termo-inss" é histórico; a Presença usa esse mesmo endpoint para autorizar a consulta de vínculos **CLT** (Consignado Privado).
- **Fluxo no sistema:** Use `POST /api/produto/presenca/consultar-clt-autorizado` com body `{ apiId?, cpf, nome?, email?, telefone?, birthDate? }`. A rota chama **POST** no path configurado (ex.: `/consultas/termo-inss`) com `cpf`, `nome`, `telefone`, `produtoId: 28`, obtém o id do termo e envia na consulta de vínculos.
- **Assinatura do termo:** O sistema chama automaticamente **PUT** `/consultas/termo-inss/{termoId}` após gerar o termo (header `tenant-id`, padrão `superuser`; configurável via `PRESENCA_TERMO_TENANT_ID`). O body é obrigatório no formato indicado pelo suporte Presença: **PascalCase** (`UserAgent`, `OperationalSystem`, `DeviceModel`, `DeviceName`, `DeviceType`) e **GeoLocation** com `Latitude` e `Longitude` (ex.: "-1.0", "-5.0"). Sem body a API retorna 400. Opcionalmente defina `PRESENCA_SKIP_TERMO_ASSINATURA=true` para pular a chamada do PUT.
- **Consulta direta com id:** Se você já tiver um `autorizacaoId`/`idAutorizacao` (ex.: obtido por outro canal), envie no body de `POST /api/produto/consultar-clt`: `{ cpfTrabalhador, apiId, autorizacaoId }` ou `idAutorizacao`.

---

## Regra de uso: CPF apenas

No fluxo Presença Bank (Consignado Privado CLT), o usuário **nunca** informa CNPJ nem matrícula manualmente:

- O usuário informa **somente CPF** (e dados complementares opcionais, ex.: nome, telefone).
- **CNPJ** e **matrícula** (`registroEmpregaticio`) **nunca** são solicitados ao usuário; são obtidos da resposta de **consultar vínculos** (e do vínculo selecionado).
- Qualquer tela ou fluxo Presença (consulta, simulação, criar operação) deve usar matrícula e CNPJ **extraídos do vínculo** retornado pela API, nunca de campos de formulário digitados pelo usuário.

---

## Autenticação

### Login
- **Método:** `POST`
- **Path:** `/login`
- **Body:** `{ "login": "", "password": "" }`
- **Resposta:** `{ "token": "..." }` — usar em todas as requisições como Bearer.

---

## Fluxo Consignado Privado (CLT)

### 0. Gerar termo de autorização (quando a API exige)
- **Método:** `POST`
- **Path:** `/consultas/termo-inss` (configurável via `PRESENCA_AUTORIZACAO_PATH`)
- **Headers:** `Authorization: Bearer {{token}}`
- **Body:** `{ "cpf": "", "nome": "", "telefone": "", "produtoId": 28 }` — opcional: `cpfRepresentante`, `nomeRepresentante`.
- **Uso:** Gera o termo; a resposta traz um id (ex.: UUID) usado para assinatura (PUT) e/ou para a consulta de vínculos. O registro do sistema chama esse endpoint automaticamente quando `PRESENCA_AUTORIZACAO_PATH` está definido.

### 1. Consultar vínculos empregatícios
- **Método:** `POST`
- **Path:** `/v3/operacoes/consignado-privado/consultar-vinculos`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body:** `{ "cpf": "" }` (CPF com 11 dígitos, só números). Se a API exige autorização prévia, o body pode aceitar também `autorizacaoId`, `idAutorizacao`, `nome`, `dataNascimento` (conforme documentação da Presença).
- **Uso:** Retorna lista de vínculos (pessoa + organizacao). Cada vínculo deve trazer dados para matrícula e CNPJ do empregador (ex.: `registroEmpregaticio`, `cnpjEmpregador` ou equivalentes). Se retornar *"é necessario uma autorização válida"*, use o fluxo da seção **Autorização para consultar vínculos** acima.

### 2. Consultar margem do vínculo
- **Método:** `POST`
- **Path:** `/v3/operacoes/consignado-privado/consultar-margem`
- **Headers:** `Authorization: Bearer {{token}}`
- **Body:** `{ "cpf": "", "matricula": "", "cnpj": "" }`
  - **cpf:** 11 dígitos
  - **matricula:** obtida do vínculo (ex.: `registroEmpregaticio`)
  - **cnpj:** 14 dígitos do empregador (ex.: `cnpjEmpregador`)
- **Uso:** Consultar margem disponível para um vínculo retornado no passo 1.

### 3. Consultar tabelas disponíveis (simulação)
- **Método:** `POST`
- **Path:** `/v5/operacoes/simulacao/disponiveis`
- **Body:** `tomador` com `cpf` (11 dígitos) e `vinculoEmpregaticio: { cnpjEmpregador, registroEmpregaticio }`.
- **registro:** `consultarTabelasDisponiveisCLT({ cpf, registroEmpregaticio, cnpjEmpregador })`.
- **Rota Next.js:** `POST /api/produto/presenca/clt/simulacao/disponiveis` (body: `apiId`, `cpf`, `registroEmpregaticio`, `cnpjEmpregador`).

### 4. Criar operação
- **Método:** `POST`
- **Path:** `/v3/operacoes`
- **Body:** `type: "credito-privado-bpn"`, `tomador` com `cpf` e `vinculoEmpregaticio: { cnpjEmpregador, registroEmpregaticio }`.
- **registro:** `criarOperacaoCLT({ cpf, registroEmpregaticio, cnpjEmpregador, tipo? })` — monta o body e chama `/v3/operacoes`.
- **Rota Next.js:** `POST /api/produto/presenca/clt/operacao` (body: `apiId`, `cpf`, `registroEmpregaticio`, `cnpjEmpregador`, `tipo?`).

### 5. Consultar operação por ID
- **Método:** `GET`
- **Path:** `/v3/operacoes/{id}`
- **registro:** `consultarOperacaoCLT(operacaoId)`.
- **Rota Next.js:** `GET /api/produto/presenca/clt/operacao?apiId=...&operacaoId=...`.

### 6. Simular crédito CLT
- **registro:** `simularCreditoCLT({ cpf, operacaoId?, valorSolicitado?, numeroParcelas?, valorParcela?, matricula?, cnpj?, registroEmpregaticio?, cnpjEmpregador? })` — chama `POST /operacoes/realizar-simulacao`; para fluxo completo pode-se chamar antes `consultarTabelasDisponiveisCLT`.
- **Rota Next.js:** `POST /api/produto/presenca/clt/simular` (body: `apiId`, `cpf`, `operacaoId`, `valorSolicitado`, `numeroParcelas`, `valorParcela`, `matricula`, `cnpj`, `registroEmpregaticio`, `cnpjEmpregador`).

---

## Nomes de campos nos vínculos

A API utiliza, entre outros, os nomes abaixo para o vínculo empregatício:

| Campo na API        | Uso no sistema      |
|---------------------|----------------------|
| `registroEmpregaticio` | Matrícula do trabalhador |
| `cnpjEmpregador`    | CNPJ do empregador (14 dígitos) |

O registro (`lib/presenca-bank-client.ts`) e os helpers (`lib/utils.ts`) já tratam `registroEmpregaticio` e `cnpjEmpregador`, além de variações como `matricula`, `cnpj`, e objetos aninhados (`empregador.cnpj`, `vinculo.cnpjEmpregador`, etc.).

---

## Ordem recomendada no sistema

1. **Login** → obter token.
2. (Se a API exige) **Gerar termo** → `POST /consultas/termo-inss` com cpf, nome, telefone, produtoId: 28; opcionalmente assinar com `PUT /consultas/termo-inss/{termoId}`.
3. **Consultar vínculos** por CPF → obter lista de vínculos.
4. **Selecionar um vínculo** (ex.: primeiro válido) e extrair `matricula`/`registroEmpregaticio` e `cnpj`/`cnpjEmpregador`.
5. **Consultar margem** com `cpf`, `matricula` e `cnpj`.
6. (Opcional) **Consultar tabelas disponíveis** (`/v5/operacoes/simulacao/disponiveis`) com vínculo.
7. (Opcional) **Simular crédito** (`/operacoes/realizar-simulacao`) e **criar operação** (`POST /v3/operacoes`) com `type: "credito-privado-bpn"` e vínculo no `tomador`.
8. **Consultar operação** por ID: `GET /v3/operacoes/{id}`.

Referência: collection Postman **ConsignadoPrivado** (ConsignadoPrivado.postman_collection.json).
