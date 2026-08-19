# 📚 Documentação Completa da API CLT - HubCredito

## 📋 Visão Geral

A API CLT (Consolidação das Leis do Trabalho) permite realizar consultas de vínculos de trabalho, simulações e envio de propostas de crédito consignado para trabalhadores CLT.

## 🔄 Fluxo Completo de Integração

1. **Termo de Aceite** → Gerar/Verificar termo válido
2. **Consulta de Vínculos** → Consultar vínculos de trabalho do registro
3. **Simulação** → Simular propostas de crédito
4. **Envio de Proposta** → Enviar proposta para aprovação
5. **Atualização de Dados Bancários** → (Em desenvolvimento)
6. **Cancelamento** → Cancelar proposta se necessário

---

## 1️⃣ Termo de Aceite Consulta ao DataPrev

### Endpoint
```
POST /api/Clt/gerar-termo-aceite
```

### Descrição
Para realizar a consulta de vínculos, é necessário um termo válido assinado pelo registro. Se já existir um termo válido, a propriedade `dataValidade` terá valor. Caso contrário, o termo será criado e o registro deverá assinar em: https://termo.hubcredito.com.br/

### Campos Fixos
- `tipoTermo`: `"AutorizacaoDataprev"` (fixo)

### Campos Variáveis
- `lojaId` (integer): ID da Loja configurada na integração
- `nome` (string): Nome do registro
- `cpf` (string): CPF do registro
- `email` (string): Email do registro
- `telefone` (string): Telefone do registro
- `dataNascimento` (DateTime): Data de nascimento do registro
- `sexo` (string): Sexo do registro (ex: "Masculino", "Feminino")

### Exemplo de Requisição
```json
{
  "tipoTermo": "AutorizacaoDataprev",
  "lojaId": 2701,
  "nome": "Nome do registro",
  "cpf": "11122233344",
  "email": "registro@hub.com.br",
  "telefone": "27988887777",
  "dataNascimento": "2025-11-13T17:55:37.567Z",
  "sexo": "Masculino"
}
```

### Resposta de Sucesso
```json
{
  "hasSuccess": true,
  "hasError": false,
  "errors": [],
  "httpStatusCode": "OK",
  "value": {
    "id": "fb23b4f5-114b-4f6a-99da-34aecdbac94d",
    "lojaId": 2701,
    "tipoDocumento": "AutorizacaoDataprev",
    "dataAceite": "2025-11-07T15:48:16.673",
    "dataValidade": "2025-12-07T15:48:16.673",
    "ip": "201.51.140.153",
    "latitude": "-20.35071346757231",
    "longitude": "-40.398226940434235",
    "bancarizador": "Socinal"
  }
}
```

**Importante:** Se `dataValidade` estiver presente, o termo é válido. Caso contrário, o registro precisa assinar em https://termo.hubcredito.com.br/

---

## 2️⃣ Consulta de Vínculos de Trabalho

### Endpoint
```
GET /api/Clt/wincred/listar-vinculos?cpfTrabalhador={CPF}
```

### Descrição
Consulta os vínculos de trabalho CLT de um trabalhador pelo CPF.

### Parâmetros
- `cpfTrabalhador` (obrigatório): CPF do trabalhador (11 dígitos)

### Resposta de Sucesso
```json
{
  "value": {
    "idCotacao": "123a7e08-6a44-7dd7-a230-2bf450ffd456",
    "vinculos": [
      {
        "matricula": "1234567",
        "inscricaoEmpregador": {
          "tipoInscricao": 1,
          "numeroInscricao": "12340818000158"
        },
        "elegivel": true
      }
    ]
  },
  "hasSuccess": true,
  "hasError": false,
  "errors": [],
  "httpStatusCode": "OK"
}
```

### Campos Retornados
- `idCotacao`: ID único da cotação (usado na simulação)
- `vinculos[]`: Array de vínculos encontrados
  - `matricula`: Matrícula do trabalhador
  - `inscricaoEmpregador.tipoInscricao`: Tipo de inscrição (1 = CNPJ)
  - `inscricaoEmpregador.numeroInscricao`: CNPJ do empregador
  - `elegivel`: Indica se o trabalhador é elegível para crédito

**Nota:** A API pode retornar campos adicionais como `valorLiberado`, `valorDisponivel`, `salario`, `dataAdmissao`, etc.

---

## 3️⃣ Simulação CLT

### Endpoint
```
POST /api/Clt/wincred/simular
```

### Descrição
Realiza simulação de propostas de crédito CLT com base nos dados do vínculo consultado.

### Campos Obrigatórios
- `cpf` (string): CPF do registro
- `lojaId` (integer): ID da Loja configurada na integração
- `idCotacao` (Guid): ID da cotação retornado na consulta de vínculos
- `numeroParcelas` (Integer): Número de parcelas desejado
- `valor` (Decimal): Valor solicitado total (0 para usar valor máximo disponível)
- `matricula` (String): Matrícula retornada na consulta de vínculos
- `codigoInscricaoEmpregador` (Integer): Tipo de inscrição retornado na consulta (ex: 1)
- `numeroInscricaoEmpregador` (String): Número de inscrição (CNPJ) retornado na consulta

### Exemplo de Requisição
```json
{
  "cpf": "12345678910",
  "lojaId": 2701,
  "idCotacao": "123a7344-8144-7d20-8ad4-e65b316b04458",
  "numeroParcelas": 8,
  "valor": 0,
  "matricula": "12345678",
  "codigoInscricaoEmpregador": 1,
  "numeroInscricaoEmpregador": "12340818000180"
}
```

### Resposta de Sucesso
```json
{
  "value": [
    {
      "tabelaFinanciamento": {
        "id": 9500,
        "descricao": "Tabela CLT (1 a 6)",
        "tipoOperacaoId": 27,
        "formaPagamento": 1,
        "carencia": 1,
        "tac": 0,
        "tap": 0,
        "ativo": true
      },
      "valorMargem": 12624.88,
      "idCotacao": "019a7e08-6a44-7dd7-a230-2bf450ffd324",
      "simulacaoId": "724",
      "opcaoProposta": {
        "idProposta": "019a7e84-5c57-76a7-a01a-0992317bea50",
        "dataDeVencimento": "2026-01-28T00:00:00Z",
        "dataDaLiberacao": "2025-11-14T00:00:00Z",
        "dataDeExpiracao": "2025-11-18T00:00:00Z",
        "valorDesembolsoTotal": 12624.88,
        "valorSeguro": 0,
        "valorDesembolsoTrabalhador": 12420.58,
        "valorParcela": 2765.98,
        "numeroParcelas": 6,
        "taxaJuros": 5.71,
        "comSeguro": false,
        "cet": 0,
        "cetAnual": 0,
        "valorEmprestimoTotal": 0
      }
    }
  ],
  "hasSuccess": true,
  "hasError": false,
  "errors": [],
  "httpStatusCode": "OK"
}
```

### Campos Importantes da Resposta
- `tabelaFinanciamento.id`: ID da tabela (usado no envio da proposta)
- `simulacaoId`: ID da simulação (usado no envio da proposta)
- `opcaoProposta.idProposta`: ID da proposta (usado no envio)
- `opcaoProposta.dataDeVencimento`: Data de vencimento da primeira parcela
- `opcaoProposta.valorDesembolsoTrabalhador`: Valor líquido para o trabalhador
- `opcaoProposta.valorParcela`: Valor da parcela
- `opcaoProposta.numeroParcelas`: Quantidade de parcelas

**Nota:** A API retorna múltiplas opções de simulação (diferentes tabelas e parcelas).

---

## 4️⃣ Envio de Proposta para Aprovação

### Endpoint
```
POST /api/proposta
```

### Descrição
Envia a proposta completa para aprovação, incluindo dados do registro, dados bancários e dados da simulação selecionada.

### Campos Fixos (Obrigatórios)
- `tipoOperacao`: `27` (fixo para CLT)
- `tipoCliente`: `"Novo"` (fixo)
- `formaPagamento`: `"DescontoFolha"` (fixo)
- `formaPagamentoCliente`: `"Transferencia"` (fixo)
- `bancarizador`: `"Socinal"` (fixo)

### Campos Variáveis
- `lojaId` (integer): ID da Loja
- `cpfAtendente` (string): CPF do atendente configurado na integração
- `cpfCliente` (string): CPF do registro

### Campos da Simulação Selecionada
- `dataPrimeiraParcela`: Vem de `opcaoProposta.dataDeVencimento`
- `valorVista`: Vem de `opcaoProposta.valorDesembolsoTrabalhador`
- `tabelaComercial`: Vem de `tabelaFinanciamento.id`
- `plano`: Vem de `opcaoProposta.numeroParcelas`
- `valorParcela`: Vem de `opcaoProposta.valorParcela`
- `SimulacaoId`: Vem de `simulacaoId`
- `valorTac`: Vem de `tabelaFinanciamento.tac`
- `valorBruto`: Vem de `opcaoProposta.valorDesembolsoTrabalhador`

### Estrutura Completa da Requisição
```json
{
  "bancarizador": "Socinal",
  "tipoOperacao": 27,
  "tipoCliente": "Novo",
  "formaPagamento": "DescontoFolha",
  "formaPagamentoCliente": "Transferencia",
  "lojaId": 2701,
  "cpfAtendente": "12345678900",
  "cpfCliente": "01681468352",
  "dataPrimeiraParcela": "2025-01-12",
  "valorVista": 320.5,
  "valorBruto": 320.5,
  "tabelaComercial": 4994,
  "plano": 5,
  "valorParcela": 35.19375,
  "SimulacaoId": "54961",
  "valorTac": 100,
  "contaBancaria": {
    "banco": 33,
    "agencia": 4272,
    "digitoAgencia": "0",
    "conta": 1002701,
    "digitoConta": "2",
    "tipoContaBancaria": 1
  },
  "chavePix": {
    "tipoChave": "NaturalRegistrationNumber",
    "valorChave": "01681468352"
  },
  "registro": {
    "documento": "01681468352",
    "nome": "registro",
    "pessoaFisica": {
      "dataNascimento": "1986-04-18",
      "rg": "15561313",
      "orgaoEmissorRg": "SSP",
      "ufOrgaoEmissorRg": "MG",
      "dataEmissaoRg": "2010-10-10",
      "mae": "Elizabeth storani pessoa",
      "pai": "luiz michel ferraz pessoa",
      "sexo": 0,
      "estadoCivil": "Solteiro",
      "email": "email@email.com",
      "naturalidade": "Vitória",
      "tipoResidencia": "Proprio",
      "tempoResidencia": 12,
      "ocupacao": 5,
      "cargo": "cargo",
      "organizacao": "organizacao",
      "valorRenda": 5000,
      "valorRendaExtra": 0,
      "tempoServico": 12,
      "falecido": false,
      "quantidadeDependentes": 0
    },
    "enderecos": [
      {
        "logradouro": "Travessa João Oliveira",
        "numero": 97,
        "bairro": "Santo Antônio",
        "cidade": "Vitória",
        "uf": "ES",
        "cep": "29026360",
        "tipoEndereco": "Residencial"
      }
    ],
    "telefones": [
      {
        "ddd": "27",
        "numero": "999072255",
        "tipoTelefone": "Pessoal",
        "renderPhone": "27999072255"
      }
    ]
  }
}
```

### Tipos de Chave PIX
- `NaturalRegistrationNumber` (1): CPF
- `LegalRegistrationNumber` (2): CNPJ
- `Phone` (3): Telefone
- `Email` (4): Email
- `Automatic` (5): Automática Gerada (UUID)

---

## 5️⃣ Atualização de Dados Bancários

**Status:** Em desenvolvimento

---

## 6️⃣ Cancelamento de Proposta

### Endpoint
```
DELETE /api/Proposta/cancelamento/{propostaId}
```

### Descrição
Cancela uma proposta enviada anteriormente.

### Parâmetros
- `propostaId` (obrigatório): ID da proposta a ser cancelada (na URL)

### Exemplo de Requisição
```bash
DELETE /api/Proposta/cancelamento/455552
```

### Resposta de Sucesso
```json
{
  "value": {
    "propostaId": "455552",
    "situacao": 6,
    "mensagem": "Proposta cancelada com sucesso!"
  },
  "hasSuccess": true,
  "hasError": false,
  "errors": [],
  "httpStatusCode": "OK"
}
```

### Resposta de Erro
```json
{
  "hasSuccess": true,
  "hasError": false,
  "errors": [
    "Proposta não possui código da Socinal."
  ],
  "httpStatusCode": "OK"
}
```

---

## 📝 Resumo dos Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/Clt/gerar-termo-aceite` | POST | Gerar/verificar termo de aceite |
| `/api/Clt/wincred/listar-vinculos` | GET | Consultar vínculos de trabalho |
| `/api/Clt/wincred/simular` | POST | Simular propostas de crédito |
| `/api/proposta` | POST | Enviar proposta para aprovação |
| `/api/Proposta/cancelamento/{id}` | DELETE | Cancelar proposta |

---

## 🔐 Autenticação

Todas as requisições requerem o header:
```
Authorization: Bearer {accessToken}
```

O token é obtido através do endpoint `/api/Login` com `userName` e `password`.

---

## 📌 Observações Importantes

1. **Fluxo Sequencial:** As etapas devem ser seguidas em ordem:
   - Termo → Vínculos → Simulação → Envio → Cancelamento (se necessário)

2. **Validade do Termo:** Verifique sempre se o termo está válido antes de consultar vínculos.

3. **ID da Cotação:** O `idCotacao` retornado na consulta de vínculos é obrigatório para a simulação.

4. **Dados da Simulação:** Use os dados exatos da simulação selecionada no envio da proposta.

5. **Bancarizador:** Sempre use `"Socinal"` como bancarizador.

6. **Tipo de Operação:** Sempre use `27` para operações CLT.

---

## 🎯 Próximos Passos para Implementação

1. ✅ Consulta de Vínculos (já implementado)
2. ⏳ Termo de Aceite
3. ⏳ Simulação CLT
4. ⏳ Envio de Proposta
5. ⏳ Cancelamento de Proposta
6. ⏳ Atualização de Dados Bancários (quando disponível)

