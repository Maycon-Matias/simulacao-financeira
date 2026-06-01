const fs = require('fs')
const path = require('path')

/**
 * PM2 no Windows costuma falhar com `pm2 start npm -- start`
 * (trata "start" como caminho). Subimos o Next via binário oficial.
 *
 * Carrega .env e .env.local para o processo (Nossa Fintech, V8, etc.).
 * Variáveis NEXT_PUBLIC_* também precisam existir no momento do `npm run build`.
 *
 * Uso:
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs --update-env   (após alterar .env.local)
 */
function loadEnvFile(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) return env
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const root = __dirname
const fileEnv = loadEnvFile(path.join(root, '.env'))
const localEnv = loadEnvFile(path.join(root, '.env.local'))

module.exports = {
  apps: [
    {
      name: 'Sistema-Produto-API',
      cwd: root,
      script: path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: 'start -p 3004',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: '3004',
        ...fileEnv,
        ...localEnv,
      },
    },
  ],
}
