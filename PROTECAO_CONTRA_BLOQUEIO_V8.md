# Proteções Contra Bloqueio - V8 Digital

Este documento descreve todas as proteções implementadas para evitar bloqueio da API V8 Digital por comportamento suspeito.

## 🛡️ Proteções Implementadas

### 1. **Rate Limiting de Requisições (250/hora)**
- **Limite**: 250 requisições por hora (regra da V8 Digital)
- **Contador automático**: Rastreia todas as requisições autenticadas
- **Janela deslizante**: Reseta automaticamente após 1 hora
- **Avisos progressivos**: 
  - Aviso quando restam 10 requisições
  - Log a cada 50 requisições
- **Bloqueio automático**: Impede requisições quando limite é atingido
- **Mensagem informativa**: Informa tempo de espera até reset
- **Benefício**: Evita bloqueio por excesso de requisições

### 2. **Cache de Token Otimizado**
- **Margem de validade**: 30 minutos (antes de renovar)
- **Benefício**: Reduz drasticamente o número de tentativas de login
- **Implementação**: `isTokenValid()` verifica se token ainda é válido com margem de 30 minutos

### 3. **Controle de Login Simultâneo**
- **Flag `loginInProgress`**: Evita múltiplos logins ao mesmo tempo
- **Aguarda até 10 segundos**: Se já está fazendo login, aguarda conclusão
- **Reutiliza token**: Se token ficou válido após espera, reutiliza
- **Benefício**: Evita requisições duplicadas de autenticação

### 4. **Intervalo Mínimo Entre Tentativas**
- **Intervalo padrão**: 60 segundos entre tentativas de login
- **Aumento progressivo**: Após falhas consecutivas, intervalo aumenta:
  - 1 falha: 2x o intervalo (120 segundos)
  - 2 falhas: 3x o intervalo (180 segundos)
  - 3+ falhas: 4x o intervalo (240 segundos)
- **Após bloqueio detectado**: Intervalo aumenta para 5 minutos (300 segundos)
- **Benefício**: Respeita rate limiting e evita bloqueios

### 5. **Contador de Falhas Consecutivas**
- **Rastreamento**: Conta falhas consecutivas de login
- **Aumento de intervalo**: Intervalo aumenta progressivamente com mais falhas
- **Reset automático**: Reseta após login bem-sucedido
- **Benefício**: Sistema se adapta automaticamente após problemas

### 6. **Detecção de Bloqueio**
- **Detecção automática**: Identifica mensagens de bloqueio ("suspicious", "blocked")
- **Ação imediata**: Aumenta intervalo para 5 minutos automaticamente
- **Força intervalo maior**: Após bloqueio, força intervalo maior
- **Benefício**: Sistema se adapta automaticamente quando bloqueado

### 7. **Tratamento de Erro 401**
- **Não tenta login imediatamente**: Se receber 401, limpa token mas não tenta login novamente
- **Respeita intervalo mínimo**: Próxima tentativa respeitará intervalo mínimo
- **Evita loops**: Previne loops infinitos de autenticação
- **Benefício**: Evita múltiplas tentativas quando token está inválido

### 8. **Reset de Flags**
- **Em todos os cenários**: Flags são resetadas em sucesso, erro e bloqueio
- **Ao atualizar credenciais**: Limpa todas as flags e restaura intervalo padrão
- **Benefício**: Sistema sempre começa limpo após atualizações

## 📊 Fluxo de Requisição Protegido

```
1. Requisição autenticada é solicitada
   ↓
2. Verifica rate limiting (250 req/hora)
   ├─ ❌ Limite atingido → Retorna erro (aguarde X segundos)
   └─ ✅ Dentro do limite → Incrementa contador, vai para passo 3
   ↓
3. Requisição precisa de token
   ↓
4. Verifica se token é válido (30 min de margem)
   ├─ ✅ Válido → Reutiliza token (SEM login)
   └─ ❌ Inválido → Vai para passo 5
   ↓
5. Verifica se já está fazendo login
   ├─ ✅ Sim → Aguarda até 10s
   │   ├─ Token ficou válido → Reutiliza
   │   └─ Timeout → Retorna erro (não conta como requisição)
   └─ ❌ Não → Vai para passo 6
   ↓
6. Verifica intervalo mínimo desde última tentativa
   ├─ ❌ Muito recente → Retorna erro (aguarde X segundos, não conta como requisição)
   └─ ✅ OK → Vai para passo 7
   ↓
7. Faz login
   ├─ ✅ Sucesso → Salva token, reseta contador de falhas
   └─ ❌ Erro → Incrementa contador, aumenta intervalo se necessário
   ↓
8. Faz requisição autenticada
   ├─ ✅ Sucesso → Retorna dados
   └─ ❌ Erro → Retorna erro (requisição já foi contada)
```

## 🔒 Regras de Rate Limiting

### Limite de Requisições:
- **Máximo**: 250 requisições por hora
- **Janela deslizante**: Reseta automaticamente após 1 hora
- **Avisos**: 
  - Quando restam 10 requisições
  - Log a cada 50 requisições
- **Bloqueio**: Impede novas requisições até reset da janela

### Intervalos Entre Tentativas de Login:
- **Primeira tentativa**: Sempre permitida
- **Após 1 falha**: 120 segundos (2 minutos)
- **Após 2 falhas**: 180 segundos (3 minutos)
- **Após 3+ falhas**: 240 segundos (4 minutos)
- **Após bloqueio detectado**: 300 segundos (5 minutos)

### Cache de Token:
- **Token válido por**: Tempo de expiração da API (geralmente 1 hora)
- **Margem de segurança**: 30 minutos antes de renovar
- **Resultado**: Token usado por até 30 minutos sem renovação

## ⚠️ Comportamentos que Causam Bloqueio

### ❌ EVITAR:
1. **Exceder 250 requisições por hora** (bloqueio imediato)
2. Múltiplas tentativas de login simultâneas
3. Tentativas muito frequentes (menos de 60 segundos)
4. Não respeitar intervalos após falhas
5. Tentar login após erro 401 imediatamente
6. Não usar cache de token
7. Fazer requisições desnecessárias

### ✅ FAZER:
1. **Monitorar contador de requisições** (250/hora máximo)
2. Reutilizar token enquanto válido (30 min de margem)
3. Aguardar login em progresso em vez de iniciar novo
4. Respeitar intervalo mínimo entre tentativas
5. Aumentar intervalo após falhas
6. Detectar e responder a bloqueios automaticamente
7. Evitar requisições redundantes ou desnecessárias

## 📝 Logs de Depuração

O sistema gera logs detalhados para acompanhar:
- 📊 **Rate limiting**: Requisições nesta hora (X/250)
- ⚠️ **Atenção**: X requisições restantes (quando ≤ 10)
- ⚠️ **Limite atingido**: Aguarde X segundos (quando ≥ 250)
- ✅ Token reutilizado (evita login)
- ⏸️ Login em progresso (aguarda)
- ⏸️ Intervalo mínimo não respeitado (aguarda)
- ⚠️ Bloqueio detectado (aumenta intervalo)
- ❌ Falha ao obter token (incrementa contador)
- 📊 Falhas consecutivas (ajusta intervalo)

## 🎯 Resultado Final

Com todas essas proteções, o sistema:
- ✅ **Respeita limite de 250 requisições por hora**
- ✅ **Monitora e avisa quando próximo do limite**
- ✅ **Evita múltiplas tentativas simultâneas**
- ✅ **Reutiliza token por até 30 minutos**
- ✅ **Respeita intervalos mínimos (60s a 5min)**
- ✅ **Aumenta intervalo progressivamente após falhas**
- ✅ **Detecta bloqueios e se adapta automaticamente**
- ✅ **Previne loops infinitos de autenticação**

## 🔧 Configuração

As proteções são automáticas e não requerem configuração adicional. O sistema se adapta automaticamente baseado em:
- Sucesso/falha das tentativas
- Mensagens de bloqueio da API
- Tempo desde última tentativa
