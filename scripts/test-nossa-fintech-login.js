const fs = require('fs')
const path = require('path')

const env = {}
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').replace(/\r/g, '').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq < 0) continue
  let val = trimmed.slice(eq + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  env[trimmed.slice(0, eq).trim()] = val
}

const body = JSON.stringify({
  cpf: env.NOSSA_FINTECH_API_CPF,
  promot_id: parseInt(env.NOSSA_FINTECH_API_PROMOT_ID || '1', 10),
  ******: env.NOSSA_FINTECH_API_PASSWORD,
})

fetch(`${env.NOSSA_FINTECH_API_BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
})
  .then(async (r) => {
    const text = await r.text()
    console.log(r.ok ? 'LOGIN_OK' : 'LOGIN_FAIL', r.status, text.slice(0, 200))
    process.exit(r.ok ? 0 : 1)
  })
  .catch((e) => {
    console.error('ERR', e.message)
    process.exit(1)
  })
