/**
 * Logger centralizado para a API.
 * Formato: [HH:mm:ss] TAG  NIVEL  mensagem  [dados opcionais em uma linha]
 *
 * Variável de ambiente LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
 * - debug: tudo (requisições, respostas, detalhes)
 * - info: fluxos principais (login ok, operações, sucesso)
 * - warn: respostas 4xx/5xx tratadas, rate limit
 * - error: falhas que impedem a operação
 *
 * Padrão: info
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type Level = keyof typeof LEVELS

function currentLevel(): Level {
  const v = (process.env.REDACTED || 'info').toLowerCase()
  return LEVELS[v as Level] !== undefined ? (v as Level) : 'info'
}

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[currentLevel()]
}

function timestamp(): string {
  const d = new Date()
  return d.toTimeString().slice(0, 8)
}

function formatData(data: unknown): string {
  if (data === undefined || data === null) return ''
  try {
    const s = typeof data === 'string' ? data : JSON.stringify(data)
    return s.length > 200 ? s.slice(0, 197) + '...' : s
  } catch {
    return String(data)
  }
}

function write(level: Level, tag: string, message: string, data?: unknown) {
  if (!shouldLog(level)) return
  const ts = timestamp()
  const tagPadded = tag.padEnd(10, ' ')
  const levelPadded = level.toUpperCase().padEnd(5, ' ')
  const dataStr = data !== undefined && data !== null ? `  ${formatData(data)}` : ''
  const line = `[${ts}] ${tagPadded} ${levelPadded} ${message}${dataStr}`
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export function createLogger(tag: string) {
  return {
    debug(msg: string, data?: unknown) {
      write('debug', tag, msg, data)
    },
    info(msg: string, data?: unknown) {
      write('info', tag, msg, data)
    },
    warn(msg: string, data?: unknown) {
      write('warn', tag, msg, data)
    },
    error(msg: string, data?: unknown) {
      write('error', tag, msg, data)
    },
  }
}
