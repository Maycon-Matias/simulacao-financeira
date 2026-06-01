# ✅ Resumo da Verificação - Dados para Simulação CLT

## 🔍 Verificação Realizada

Verifiquei a documentação oficial da API Nossa Fintech e identifiquei o endpoint correto e os dados necessários.

## ✅ Endpoint Correto Encontrado

**Endpoint:** `POST /clt-loan/v1/simulate-loan`

**Documentação:** https://nossa-fintech-doc.spixiiservices.com.br/docs/nossa-fintech-clt/simulacao/simulacao-clt

## 📋 Dados Necessários vs Dados Disponíveis

### ✅ Dados que TEMOS no Sistema:

1. **`employer_document`** (CNPJ do empregador)
   - ✅ Temos: `numeroInscricaoEmpregador`
   - ✅ Mapeamento direto

2. **`requested_amount`** (Valor solicitado)
   - ✅ Temos: `valor` ou `numeroParcelas`
   - ✅ Mapeamento direto

3. **`service_type`** (Código da bancarizadora)
   - ✅ Temos: `serviceType`
   - ✅ Mapeamento direto

### ❌ Dados que NÃO TEMOS no Sistema:

1. **`margin_key`** (obrigatório)
   - ❌ **NÃO TEMOS**
   - **Fonte:** Resposta da consulta de margem (`POST /clt-loan/v1/get-margin`)
   - **Ação:** Precisamos armazenar o `margin_key` quando consultar margem

2. **`simulation_type`** (obrigatório)
   - ❌ **NÃO TEMOS**
   - **Valores:** `"Payment"` ou `"Liquid"`
   - **Ação:** Adicionar campo no formulário

3. **`cod_tabela`** (obrigatório)
   - ❌ **NÃO TEMOS**
   - **Fonte:** Listagem de tabelas (`GET /clt-loan/v1/list-rebates`)
   - **Ação:** Implementar endpoint para listar tabelas

## 🔧 Correções Implementadas

### 1. ✅ Endpoint Atualizado
- Endpoint correto: `/clt-loan/v1/simulate-loan`
- Código atualizado para usar o endpoint correto

### 2. ✅ Payload Atualizado
- Payload agora usa o formato correto conforme documentação
- Validação de todos os campos obrigatórios

### 3. ✅ Método `listarTabelasCLT` Criado
- Novo método para listar tabelas disponíveis
- Endpoint: `GET /clt-loan/v1/list-rebates`

## ⚠️ O que Ainda Precisa Ser Feito

### 1. Armazenar `margin_key` após Consulta de Margem

**Problema:** Quando consultamos a margem, não estamos armazenando o `margin_key` retornado.

**Solução:**
- Modificar a resposta da consulta de margem para incluir `margin_key`
- Armazenar `margin_key` no localStorage ou estado
- Usar esse `margin_key` na simulação

### 2. Implementar Listagem de Tabelas

**Problema:** Não temos código de tabela (`cod_tabela`) para enviar na simulação.

**Solução:**
- Criar endpoint `/api/produto/clt/listar-tabelas`
- Chamar `GET /clt-loan/v1/list-rebates` da Nossa Fintech
- Permitir seleção da tabela ou usar uma padrão

### 3. Adicionar Campo `simulation_type` ao Formulário

**Problema:** Não temos campo para escolher o tipo de simulação.

**Solução:**
- Adicionar campo no formulário de simulação
- Opções: "Payment" (valor da parcela) ou "Liquid" (valor liberado)
- Enviar esse valor na requisição

## 📝 Fluxo Correto para Simulação

1. **Consultar Margem** → Obter `margin_key`
2. **Listar Tabelas** → Obter `cod_tabela`
3. **Preencher Formulário:**
   - `margin_key` (obtido da consulta)
   - `simulation_type` ("Payment" ou "Liquid")
   - `employer_document` (CNPJ do empregador)
   - `requested_amount` (valor solicitado)
   - `service_type` (código da bancarizadora)
   - `cod_tabela` (obtido da listagem)
4. **Simular** → Chamar `/clt-loan/v1/simulate-loan`

## 🎯 Status Atual

- ✅ Endpoint correto identificado e atualizado
- ✅ Payload correto implementado
- ✅ Validação de campos implementada
- ✅ Método para listar tabelas criado
- ⏳ Armazenar `margin_key` após consulta (pendente)
- ⏳ Adicionar campo `simulation_type` ao formulário (pendente)
- ⏳ Criar endpoint para listar tabelas (pendente)

## 📞 Próximos Passos

1. Modificar consulta de margem para retornar e armazenar `margin_key`
2. Criar endpoint `/api/produto/clt/listar-tabelas`
3. Atualizar formulário de simulação para incluir `simulation_type`
4. Atualizar formulário para usar `margin_key` e `cod_tabela`
