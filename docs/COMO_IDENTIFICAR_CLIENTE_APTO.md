# ✅ Como Identificar se o registro está Apto para Crédito

## 📋 Resumo

Para saber se um registro está **apto/eligível** para fazer crédito consignado, você precisa verificar o campo `elegivel` retornado pela API na consulta de vínculos CLT.

---

## 🔍 Método Principal: Campo `elegivel`

### Na Consulta CLT (`/Clt/wincred/listar-vinculos`)

A API retorna um campo booleano `elegivel` em cada vínculo encontrado:

```json
{
  "value": {
    "vinculos": [
      {
        "matricula": "1234567",
        "elegivel": true,  // ← Este campo indica se está apto
        "inscricaoEmpregador": {
          "tipoInscricao": 1,
          "numeroInscricao": "12340818000158"
        }
      }
    ]
  }
}
```

### Valores Possíveis

| Valor | Significado | Ação |
|-------|-------------|------|
| `true` | ✅ **registro APTO** | registro pode realizar operações de crédito consignado |
| `false` | ❌ **registro NÃO APTO** | registro não está elegível para crédito no momento |
| `undefined` | ⚠️ **Status não informado** | A API não retornou informação de elegibilidade |

---

## 📊 Outros Indicadores de Aptidão

Além do campo `elegivel`, você pode verificar outros campos que indicam capacidade de crédito:

### 1. Valores Monetários Disponíveis

```json
{
  "valorDisponivel": 5000.00,  // Valor disponível para crédito
  "valorLiberado": 2000.00,    // Valor já liberado
  "valorLimite": 10000.00,     // Limite total de crédito
  "salario": 3000.00           // Salário do trabalhador
}
```

**Interpretação:**
- Se `valorDisponivel > 0`: registro tem crédito disponível
- Se `valorDisponivel === 0` ou `null`: Pode não ter crédito disponível
- Se `valorLimite > 0`: registro tem limite aprovado

### 2. Situação do Vínculo

```json
{
  "situacao": "ATIVO"  // ou "INATIVO", "DEMITIDO", etc.
}
```

**Interpretação:**
- Vínculo **ATIVO**: registro está trabalhando (mais provável de estar apto)
- Vínculo **INATIVO** ou **DEMITIDO**: registro não está trabalhando (provavelmente não apto)

### 3. Data de Admissão

```json
{
  "dataAdmissao": "2020-01-15"
}
```

**Interpretação:**
- registro com mais tempo de organizacao podem ter mais facilidade para crédito
- Geralmente, mínimo de 3-6 meses de vínculo é necessário

---

## 🎯 Como Verificar no Sistema

### 1. Na Consulta CLT

Após realizar a consulta, o sistema exibe:

1. **Resumo no Topo**: Mostra quantos registro estão aptos
   - ✅ "X registro(s) APTO(S) para Crédito" (verde)
   - ❌ "Nenhum registro Apto para Crédito" (vermelho)

2. **Status por Vínculo**: Cada vínculo mostra:
   - ✅ **registro APTO PARA CRÉDITO** (verde) - se `elegivel === true`
   - ❌ **registro NÃO APTO PARA CRÉDITO** (vermelho) - se `elegivel === false`

3. **Valores Disponíveis**: Seção mostra valores monetários que indicam capacidade

### 2. Interpretação Visual

| Cor | Significado |
|-----|-------------|
| 🟢 Verde | registro APTO - Pode prosseguir com simulação |
| 🔴 Vermelho | registro NÃO APTO - Não pode fazer crédito |
| ⚪ Cinza | Status não informado - Verificar outros campos |

---

## ⚠️ Casos Especiais

### 1. Campo `elegivel` não retornado

Se a API não retornar o campo `elegivel`, verifique:
- `valorDisponivel > 0`: Indica que há crédito disponível
- `situacao === "ATIVO"`: Vínculo ativo é necessário
- Presença de `valorLimite`: Indica que há limite aprovado

### 2. Múltiplos Vínculos

Se o registro tiver múltiplos vínculos:
- Verifique cada vínculo individualmente
- Um vínculo apto já permite fazer crédito
- Use o vínculo com maior `valorDisponivel` para simulação

### 3. registro com `elegivel: false`

Possíveis motivos:
- Vínculo inativo ou demitido
- Limite de crédito já utilizado
- Restrições cadastrais
- Empregador não conveniado

**Ação:** Verifique os campos `situacao`, `valorDisponivel` e mensagens de erro da API.

---

## 📝 Fluxo Recomendado

1. **Consultar Vínculos CLT** → Obter dados do registro
2. **Verificar Campo `elegivel`** → Confirmar se está apto
3. **Se `elegivel === true`**:
   - ✅ Prosseguir com simulação
   - ✅ Verificar valores disponíveis
   - ✅ Usar `idCotacao` para simular
4. **Se `elegivel === false`**:
   - ❌ Informar registro que não está apto
   - ❌ Verificar motivo (situação, valores, etc.)
   - ❌ Não prosseguir com simulação

---

## 🔗 Próximos Passos

Após confirmar que o registro está apto (`elegivel === true`):

1. **Gerar Termo de Aceite** (se necessário)
2. **Realizar Simulação** usando:
   - `idCotacao` da consulta
   - Dados do vínculo (`matricula`, `inscricaoEmpregador`)
3. **Enviar Proposta** após registro escolher opção de simulação

---

## 📚 Referências

- [Documentação CLT Completa](./API_CLT_COMPLETA.md)
- [Dados Retornados nas Consultas](./DADOS_RETORNADOS_CONSULTAS.md)

