# 📊 Dados Retornados nas Consultas

## 1️⃣ Consulta de Propostas (`/proposta/painelV3`)

### Endpoint
```
GET /api/proposta/painelV3?cpf={cpf|id|nome}
```

### Campos Retornados

#### Estrutura Básica
```json
{
  "value": [
    {
      "id": 156255,
      "documento": "01893618161",
      "nomeCliente": "SUELY FERNANDES ROLIM",
      "valorVista": 488.14,
      "valorParcela": 48.81,
      "plano": 10,
      "situacao": 4,
      "dataProposta": "2025-02-17T17:20:54.77"
    }
  ],
  "hasSuccess": true,
  "hasError": false,
  "errors": []
}
```

#### Campos Detalhados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | ID único da proposta |
| `documento` | string | CPF do registro |
| `nomeCliente` | string | Nome completo do registro |
| `valorVista` | number | Valor à vista (valor líquido para o registro) |
| `valorParcela` | number | Valor de cada parcela |
| `plano` | number | Número de parcelas |
| `situacao` | number | Status da proposta (ver códigos abaixo) |
| `dataProposta` | string | Data de criação da proposta (ISO 8601) |

#### Códigos de Situação

| Código | Status | Descrição |
|--------|--------|-----------|
| 1 | Temporária | Proposta temporária |
| 2 | Enviado Análise | Enviada para análise |
| 3 | Enviado Atendente | Enviada para atendente |
| 4 | Aprovada | Proposta aprovada |
| 5 | Reprovada | Proposta reprovada |
| 6 | Cancelada | Proposta cancelada |
| 7 | Aprovada Encerrada | Aprovada e encerrada |
| 8 | Reprovada Encerrada | Reprovada e encerrada |

### Campos Adicionais (podem variar)

A API pode retornar campos adicionais dependendo do contexto:
- `valorBruto` - Valor bruto da proposta
- `valorTac` - Taxa de abertura de crédito
- `tabelaComercial` - ID da tabela comercial
- `bancarizador` - Nome do bancarizador
- `lojaId` - ID da loja
- `cpfAtendente` - CPF do atendente
- `dataAprovacao` - Data de aprovação
- `dataReprovacao` - Data de reprovação
- `motivoReprovacao` - Motivo da reprovação
- `observacoes` - Observações sobre a proposta

---

## 2️⃣ Consulta de Vínculos CLT (`/Clt/wincred/listar-vinculos`)

### Endpoint
```
GET /api/Clt/wincred/listar-vinculos?cpfTrabalhador={CPF}
```

### Campos Retornados

#### Estrutura Básica
```json
{
  "value": {
    "idCotacao": "123a7e08-6a44-7dd7-a230-2bf450ffd456",
    "vinculos": [
      {
        "matricula": "00264026",
        "inscricaoEmpregador": {
          "tipoInscricao": 1,
          "numeroInscricao": "36115717000126",
          "nome": ""
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

#### Campos Principais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `idCotacao` | string (Guid) | ID único da cotação (usado na simulação) |
| `vinculos[]` | array | Array de vínculos de trabalho encontrados |

#### Campos do Vínculo

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `matricula` | string | Matrícula do trabalhador na organizacao |
| `inscricaoEmpregador.tipoInscricao` | number | Tipo de inscrição (1 = CNPJ) |
| `inscricaoEmpregador.numeroInscricao` | string | CNPJ do empregador |
| `inscricaoEmpregador.nome` | string | Nome do empregador (quando disponível) |
| `elegivel` | boolean | Indica se o trabalhador é elegível para crédito |

### Campos Adicionais (podem ser retornados)

A API pode retornar campos adicionais dependendo do vínculo:

#### Valores Monetários
- `valorLiberado` - Valor já liberado para crédito
- `valorDisponivel` - Valor disponível para crédito
- `valorLimite` - Valor limite de crédito
- `salario` - Salário do trabalhador

#### Datas
- `dataAdmissao` - Data de admissão do trabalhador
- `dataDemissao` - Data de demissão (se houver)

#### Informações do Empregador
- `nomeEmpregador` - Nome do empregador
- `razaoSocial` - Razão social da organizacao

#### Informações do Trabalhador
- `cpfTrabalhador` - CPF do trabalhador
- `nomeTrabalhador` - Nome completo do trabalhador
- `situacao` - Situação do vínculo

#### Outros Campos
- `cargo` - Cargo do trabalhador
- `setor` - Setor de trabalho
- `dataUltimaAtualizacao` - Data da última atualização dos dados

---

## 3️⃣ Quando Não Há Dados

### Consulta de Propostas
```json
{
  "value": [],
  "hasSuccess": true,
  "hasError": false,
  "errors": []
}
```
**Significado:** Nenhuma proposta encontrada para os filtros informados.

### Consulta CLT
```json
{
  "value": [],
  "hasSuccess": true,
  "hasError": false,
  "errors": [],
  "httpStatusCode": "OK"
}
```
**Significado:** Nenhum vínculo encontrado para o CPF informado.

---

## 4️⃣ Respostas de Erro

### Erro de Autenticação (401)
```json
{
  "message": "Unauthorized"
}
```
**Causa:** Token expirado ou credenciais inválidas.

### Erro de Validação (400)
```json
{
  "hasSuccess": false,
  "hasError": true,
  "errors": [
    "CPF inválido",
    "Campo obrigatório não informado"
  ]
}
```

### Erro do Servidor (500)
```json
{
  "message": "Internal Server Error"
}
```

---

## 5️⃣ Observações Importantes

1. **Campos Opcionais:** Nem todos os campos são sempre retornados. Dependem do contexto e dados disponíveis.

2. **Formato de Datas:** As datas vêm no formato ISO 8601 (`2025-02-17T17:20:54.77`).

3. **Valores Monetários:** Valores monetários são retornados como números decimais (ex: `488.14`).

4. **Arrays Vazios:** Um array vazio `[]` não significa erro, apenas que não há dados para retornar.

5. **ID Cotação:** O `idCotacao` retornado na consulta CLT é obrigatório para realizar simulações.

6. **Elegibilidade:** O campo `elegivel` indica se o trabalhador pode receber crédito consignado.

---

## 6️⃣ Exemplos de Uso

### Consultar todas as propostas
```
GET /api/proposta/painelV3?cpf=null
```

### Consultar propostas de um CPF específico
```
GET /api/proposta/painelV3?cpf=01893618161
```

### Consultar vínculos CLT
```
GET /api/Clt/wincred/listar-vinculos?cpfTrabalhador=12345678900
```

---

## 7️⃣ Próximos Passos Após Consulta

### Após Consulta de Propostas
- Visualizar detalhes da proposta
- Acompanhar status
- Cancelar proposta (se necessário)

### Após Consulta CLT
1. Verificar se há vínculos elegíveis
2. Usar `idCotacao` para simulação
3. Usar dados do vínculo (`matricula`, `inscricaoEmpregador`) na simulação

