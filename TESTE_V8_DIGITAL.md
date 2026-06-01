# Teste V8 Digital - Consulta e Termo de Consentimento

## Endpoints Criados

### 1. Consulta CLT V8 Digital
**Endpoint:** `POST /api/produto/consultar-clt`

**Body:**
```json
{
  "cpfTrabalhador": "12345678900",
  "apiId": "v8digital-default"
}
```

**Exemplo de uso:**
```bash
curl -X POST http://localhost:3004/api/produto/consultar-clt \
  -H "Content-Type: application/json" \
  -d '{
    "cpfTrabalhador": "12345678900",
    "apiId": "v8digital-default"
  }'
```

### 2. Termo de Consentimento V8 Digital
**Endpoint:** `POST /api/produto/v8/termo-consentimento`

**Body:**
```json
{
  "cpf": "12345678900",
  "nome": "João da Silva",
  "telefone": "73999999999",
  "email": "joao@example.com",
  "apiId": "v8digital-default"
}
```

**Exemplo de uso:**
```bash
curl -X POST http://localhost:3004/api/produto/v8/termo-consentimento \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "12345678900",
    "nome": "João da Silva",
    "telefone": "73999999999",
    "email": "joao@example.com",
    "apiId": "v8digital-default"
  }'
```

## Métodos Implementados no registro V8 Digital

### `consultarVinculosCLT(cpf: string)`
- Consulta vínculos de trabalho CLT
- Endpoint: `POST /clt/consultar`
- Parâmetros: `{ cpf: string }`

### `criarTermoConsentimentoCLT(params)`
- Cria termo de consentimento CLT
- Endpoint: `POST /clt/termo-consentimento`
- Parâmetros:
  - `cpf` (obrigatório)
  - `nome` (opcional)
  - `telefone` (opcional)
  - `email` (opcional)

## Testando via Interface Web

1. **Consulta CLT:**
   - Acesse a tela "Consultar CLT"
   - Selecione a API V8 Digital no dropdown
   - Informe o CPF
   - Clique em "Consultar"

2. **Termo de Consentimento:**
   - Para testar via código, use o endpoint `/api/produto/v8/termo-consentimento`
   - Ou adicione um componente na interface se necessário

## Notas

- Os endpoints da V8 Digital podem variar conforme a documentação oficial
- Se os endpoints retornarem erro, verifique a documentação em: http://docs.v8sistema.com/
- A autenticação OAuth é feita automaticamente pelo registro
