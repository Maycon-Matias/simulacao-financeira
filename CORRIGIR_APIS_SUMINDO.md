# 🔧 Correção: APIs Nossa Fintech e V8 Digital Sumindo

## Problema

As APIs Nossa Fintech e V8 Digital podem estar sumindo porque o localStorage ainda contém configurações antigas das APIs removidas (HubCredito e PresencaBank).

## Solução

### Opção 1: Limpar localStorage Manualmente (Recomendado)

1. Abra o console do navegador (F12)
2. Execute o seguinte comando:

```javascript
// Limpa apenas as APIs antigas, mantendo as válidas
const saved = localStorage.getItem('api_configs')
if (saved) {
  const parsed = JSON.parse(saved)
  if (Array.isArray(parsed)) {
    const validTypes = ['nossafintech', 'v8digital', 'custom']
    const validConfigs = parsed.filter(c => validTypes.includes(c.type))
    localStorage.setItem('api_configs', JSON.stringify(validConfigs))
    
    // Verifica API padrão
    const defaultId = localStorage.getItem('default_api_id')
    if (defaultId && !validConfigs.some(c => c.id === defaultId)) {
      localStorage.setItem('default_api_id', 'nossafintech-default')
    }
    
    console.log('✅ APIs antigas removidas!')
    console.log('APIs válidas:', validConfigs.map(c => c.name))
  }
}

// Recarrega a página
location.reload()
```

### Opção 2: Limpar Tudo e Recarregar

Se a opção 1 não funcionar, limpe completamente o localStorage:

```javascript
// Remove todas as configurações
localStorage.removeItem('api_configs')
localStorage.removeItem('default_api_id')

// Recarrega a página
location.reload()
```

O sistema irá recriar automaticamente as APIs padrão (Nossa Fintech e V8 Digital).

### Opção 3: Usar o Script

Execute o script `scripts/limpar-apis-antigas.js` no console do navegador.

## O que foi corrigido no código

1. ✅ **Filtro de APIs válidas**: O sistema agora filtra automaticamente APIs antigas (HubCredito e PresencaBank) ao carregar do localStorage
2. ✅ **Garantia de APIs padrão**: O sistema sempre garante que as APIs padrão (Nossa Fintech e V8 Digital) estejam presentes
3. ✅ **Salvamento de campos V8 Digital**: O sistema agora salva corretamente os campos específicos do V8 Digital (clientId, authUrl, audience, clientSecret)

## Verificação

Após limpar o localStorage, verifique:

1. Acesse a página de **Configurações**
2. Você deve ver:
   - ✅ **Nossa Fintech (Padrão)** - Ativa
   - ✅ **V8 Digital (Padrão)** - Ativa

Se ainda não aparecerem, recarregue a página (F5) ou limpe o cache do navegador.

## Se o problema persistir

1. Verifique o console do navegador para erros
2. Verifique se as variáveis de ambiente estão configuradas (se aplicável)
3. Tente limpar completamente o cache do navegador
