# ✅ Verificação - Dados Necessários para Simulação CLT

## 📋 Endpoint Correto

**Endpoint:** `POST /clt-loan/v1/simulate-loan`

## ✅ Dados Necessários (Conforme Documentação Oficial)

### 1. `margin_key` (string, obrigatório)
- **Fonte:** Resposta da consulta de margem (`POST /clt-loan/v1/get-margin`)
- **Status no Sistema:** ❌ **NÃO TEMOS**
- **Ação Necessária:** 
  - Armazenar `margin_key` quando consultar margem
  - Usar esse `margin_key` na simulação

### 2. `simulation_type` (string, obrigatório)
- **Valores:** `"Payment"` ou `"Liquid"`
- **Status no Sistema:** ❌ **NÃO TEMOS**
- **Ação Necessária:** 
  - Adicionar campo no formulário para escolher tipo de simulação
  - `"Payment"` = Simulação baseada no Valor da Parcela
  - `"Liquid"` = Simulação baseada no Valor Liberado

### 3. `employer_document` (string, obrigatório)
- **Fonte:** CNPJ do empregador (14 dígitos, sem formatação)
- **Status no Sistema:** ✅ **TEMOS** (`numeroInscricaoEmpregador`)
- **Mapeamento:** `numeroInscricaoEmpregador` → `employer_document`

### 4. `requested_amount` (number, obrigatório)
- **Fonte:** Valor da parcela (se `Payment`) ou valor liberado (se `Liquid`)
- **Status no Sistema:** ✅ **TEMOS** (`valor` ou `numeroParcelas`)
- **Mapeamento:** `valor` → `requested_amount`

### 5. `service_type` (string, obrigatório)
- **Fonte:** Código da bancarizadora (ex: "QITECH")
- **Status no Sistema:** ✅ **TEMOS** (`serviceType`)
- **Mapeamento:** `serviceType` → `service_type`

### 6. `cod_tabela` (string, obrigatório)
- **Fonte:** Listagem de tabelas (`GET /clt-loan/v1/list-rebates`)
- **Status no Sistema:** ❌ **NÃO TEMOS**
- **Ação Necessária:**
  - Implementar endpoint para listar tabelas
  - Permitir seleção da tabela ou usar uma padrão

## 📊 Resumo

| Campo | Temos? | Fonte | Ação |
|-------|--------|-------|------|
| `margin_key` | ❌ | Consulta de margem | Armazenar após consulta |
| `simulation_type` | ❌ | Formulário | Adicionar campo |
| `employer_document` | ✅ | `numeroInscricaoEmpregador` | Mapear |
| `requested_amount` | ✅ | `valor` | Mapear |
| `service_type` | ✅ | `serviceType` | Mapear |
| `cod_tabela` | ❌ | Listar tabelas | Implementar listagem |

## 🔧 Dados que Estamos Enviando (INCORRETOS)

```json
{
  "cpf": "11839893427",
  "id_cotacao": "019bacb7-d860-76f6-b432-abbdfc07c75e",
  "matricula": "5",
  "codigo_inscricao_empregador": 1,
  "numero_inscricao_empregador": "38052900000000",
  "valor": 0,
  "numero_parcelas": 12
}
```

**Problemas:**
- ❌ Endpoint errado (`/clt/simular` ao invés de `/clt-loan/v1/simulate-loan`)
- ❌ Falta `margin_key`
- ❌ Falta `simulation_type`
- ❌ Falta `cod_tabela`
- ❌ Campos desnecessários (`cpf`, `id_cotacao`, `matricula`, `codigo_inscricao_empregador`)

## ✅ Payload Correto (Conforme Documentação)

```json
{
  "margin_key": "5ce86e4d-2902-4a19-9859-73eb6c93cb33",
  "simulation_type": "Payment",
  "employer_document": "98179558000180",
  "requested_amount": 10200,
  "service_type": "QITECH",
  "cod_tabela": "300003"
}
```

## 🎯 Próximos Passos

1. ✅ **Atualizar endpoint** para `/clt-loan/v1/simulate-loan`
2. ⏳ **Armazenar `margin_key`** após consulta de margem
3. ⏳ **Implementar listagem de tabelas** (`GET /clt-loan/v1/list-rebates`)
4. ⏳ **Adicionar campo `simulation_type`** ao formulário
5. ⏳ **Atualizar payload** para usar o formato correto

## 📝 Observações Importantes

- A consulta de margem (`/clt-loan/v1/get-margin`) retorna `margin_key` que **DEVE** ser usado na simulação
- O `cod_tabela` deve ser obtido da listagem de tabelas antes de simular
- O `simulation_type` determina se `requested_amount` é valor da parcela ou valor liberado
