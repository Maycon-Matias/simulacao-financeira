# 📚 Documentação da API HubCredito

## 🔐 Autenticação

### Endpoint
```
POST https://api.hubcredito.com.br/api/Login
```

### Body
```json
{
  "userName": "<username>",
  "password": "<password>",
  "grantTypes": "password"
}
```

### Resposta
```json
{
  "value": {
    "token": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
    }
  }
}
```

**Todas as requisições subsequentes precisam do header:**
```
Authorization: Bearer <accessToken>
```

---

## 📋 Consulta de Propostas

### Endpoint
```
GET https://api.hubcredito.com.br/api/proposta/painelV3?cpf=null
```

### Parâmetros (Query String)
- `cpf` (opcional): CPF, ID de Proposta ou Nome do registro

### Exemplo
```bash
GET /api/proposta/painelV3?cpf=01893618161
```

### Resposta
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
  "hasSuccess": true
}
```

### Status da Proposta
- 1 = Temporaria
- 2 = EnviadoAnalise
- 3 = EnviadoAtendente
- 4 = Aprovada
- 5 = Reprovada
- 6 = Cancelada
- 7 = AprovadaEncerrada
- 8 = ReprovadaEncerrada

---

## 🧮 Simulação (Fila de Simulação)

### Cadastrar Simulação em Massa
```
POST https://api.hubcredito.com.br/api/FilaSImulacao/cadastrar-em-massa
```

### Body
```json
{
  "usuarioId": "4b94d0c0-f783-45b4-ab3b-e8d0b19d382f",
  "lojaId": 9330,
  "cpfs": [
    "09719299711",
    "12312312312"
  ],
  "callbackUrl": "https://webhook.site/c8a3255b-e351-4d00-991e-9e8078e75dc4"
}
```

### Resposta
```json
{
  "value": [
    {
      "id": "46042a23-926d-4cc0-3920-08dd71818e2e",
      "cpfCliente": "09719299711",
      "lojaId": 9330,
      "situacao": "CRIADO"
    }
  ],
  "hasSuccess": true
}
```

### Obter Resultado da Simulação
```
GET https://api.hubcredito.com.br/api/FilaSImulacao/{id}
```

### Resposta (Callback)
```json
{
  "Cpf": "09719299711",
  "LojaId": 9330,
  "UsuarioId": "4b94d0c0-f783-45b4-ab3b-e8d0b19d382f",
  "id": "46042a23-926d-4cc0-3920-08dd71818e2e",
  "Simulacoes": [
    {
      "SimulacaoId": "eaa60834-6325-4cb3-8a13-91b8fd581c7e",
      "Financeira": "Hub Crédito",
      "NomeTabela": "CARTA NA MANGA",
      "ValorTac": 545.714,
      "QuantidadeParcelas": 10,
      "Valorbruto": 4961.04,
      "ValorCliente": 4260.056,
      "Parcelas": [...]
    }
  ]
}
```

---

## 👔 Consulta de Vínculos CLT

### Endpoint
```
GET https://api.hubcredito.com.br/api/Clt/wincred/listar-vinculos?cpfTrabalhador=12345678900
```

### Parâmetros (Query String)
- `cpfTrabalhador` (obrigatório): CPF do trabalhador (11 dígitos)

### Exemplo
```bash
GET /api/Clt/wincred/listar-vinculos?cpfTrabalhador=12345678900
```

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

### Resposta com Erro
```json
{
  "hasSuccess": true,
  "hasError": false,
  "errors": [
    "registro não encontrado."
  ],
  "httpStatusCode": "OK"
}
```

### Campos da Resposta
- `idCotacao`: ID único da cotação gerada
- `vinculos`: Array de vínculos de trabalho encontrados
  - `matricula`: Matrícula do trabalhador
  - `inscricaoEmpregador`: Dados do empregador
    - `tipoInscricao`: Tipo de inscrição (1 = CNPJ)
    - `numeroInscricao`: Número da inscrição (CNPJ)
  - `elegivel`: Indica se o trabalhador é elegível para crédito

### Próxima Etapa
Após receber os vínculos, deve usar os dados do vínculo para enviar a simulação.

---

## 📝 Variáveis de Ambiente Necessárias

```env
NEXT_PUBLIC_API_BASE_URL=https://api.hubcredito.com.br/api
NEXT_PUBLIC_API_USERNAME=seu-entidade
NEXT_PUBLIC_API_PASSWORD=sua-password
```

