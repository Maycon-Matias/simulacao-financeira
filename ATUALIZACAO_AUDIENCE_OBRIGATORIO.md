# Atualização: `audience` Agora é Obrigatório

## Resumo das Alterações

Com base no exemplo de código fornecido pela V8 Digital, o parâmetro `audience` foi identificado como **OBRIGATÓRIO** para autenticação. Todas as requisições de autenticação agora exigem este parâmetro.

## Arquivos Modificados

### 1. `app/api/produto/v8/auth/route.ts`
- ✅ Adicionada validação para garantir que `audience` está presente
- ✅ `audience` agora é sempre incluído na requisição OAuth
- ✅ Mensagem de erro clara se `audience` estiver faltando

### 2. `lib/v8-digital-client.ts`
- ✅ `audience` mudou de opcional (`audience?: string`) para obrigatório (`audience: string`)
- ✅ Validação adicionada no método `login()` para verificar se `audience` está configurado
- ✅ Mensagem de erro clara se `audience` não estiver configurado

### 3. `lib/api-manager.ts`
- ✅ `audience` adicionado à configuração padrão de V8 Digital
- ✅ `audience` passado corretamente ao criar/atualizar registro V8 Digital
- ✅ Lógica de atualização de credenciais para V8 Digital inclui `audience`

## Como Configurar

### Opção 1: Variáveis de Ambiente (Recomendado)

Crie ou atualize `.env.local`:

```env
V8_API_AUDIENCE=valor_fornecido_pela_v8_digital
```

### Opção 2: Interface de Configuração

1. Acesse a página de configuração de APIs
2. Selecione a configuração V8 Digital
3. Adicione o campo `audience` (se ainda não existir na interface)
4. Preencha com o valor fornecido pela V8 Digital

## Obtendo o Valor de `audience`

O valor de `audience` é fornecido pela V8 Digital. Entre em contato:

- **Email**: `ti@v8digital.online`
- **Solicite**: O valor do parâmetro `audience` para sua integração

## Teste

Execute o script de teste para verificar se a autenticação funciona:

```bash
# Se tiver axios e qs instalados:
npx ts-node test-v8-exemplo.ts

# Ou use o teste existente:
node test-v8-digital-completo.js
```

## Comportamento Anterior vs. Novo

### Antes
- `audience` era opcional
- Se não fornecido, a requisição era enviada sem `audience`
- Resultado: Erro 401 Unauthorized

### Agora
- `audience` é obrigatório
- Sistema valida se `audience` está presente antes de fazer a requisição
- Se faltar, retorna erro claro: "O parâmetro audience é obrigatório"
- Se presente, sempre incluído na requisição OAuth

## Próximos Passos

1. ✅ Obter valor de `audience` da V8 Digital
2. ✅ Configurar `V8_API_AUDIENCE` no `.env.local`
3. ✅ Testar autenticação
4. ✅ Testar consulta CLT
5. ✅ Testar criação de termo de consentimento

## Referência

Exemplo de código fornecido pela V8 Digital:
- Usa `qs.stringify()` para criar o body
- Inclui `audience` como parâmetro obrigatório
- Formato: `application/x-www-form-urlencoded`
- Método: `POST` (apenas POST, não aceita GET)
