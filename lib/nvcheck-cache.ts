import fs from "fs"
import path from "path"

type DocumentoTipo = "CPF" | "CNPJ"

type NvCheckCacheItem = {
  documento: string
  tipo: DocumentoTipo
  data: any
  savedAt: string
}

type NvCheckCacheFile = {
  items: NvCheckCacheItem[]
}

const DATA_DIR =
  process.env.REDACTED && process.env.REDACTED.trim() !== ""
    ? path.resolve(process.cwd(), process.env.REDACTED)
    : path.join(process.cwd(), "data")

const FILE_PATH = path.join(DATA_DIR, "nvcheck-cache.json")

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function loadCache(): NvCheckCacheFile {
  ensureDataDir()
  if (!fs.existsSync(FILE_PATH)) {
    return { items: [] }
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf-8")
    const parsed = JSON.parse(raw) as NvCheckCacheFile | NvCheckCacheItem[]
    if (Array.isArray(parsed)) {
      return { items: parsed }
    }
    if (parsed && Array.isArray(parsed.items)) {
      return { items: parsed.items }
    }
    return { items: [] }
  } catch (e) {
    console.error("[NvCheckCache] Erro ao ler arquivo de cache:", e)
    return { items: [] }
  }
}

function saveCache(cache: NvCheckCacheFile) {
  ensureDataDir()
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(cache, null, 2), "utf-8")
  } catch (e) {
    console.error("[NvCheckCache] Erro ao salvar arquivo de cache:", e)
  }
}

function getTtlMs(): number | null {
  const raw = process.env.REDACTED
  if (!raw) return 1 * 24 * 60 * 60 * 1000
  const days = Number(raw)
  if (!Number.isFinite(days) || days <= 0) return 1 * 24 * 60 * 60 * 1000
  return days * 24 * 60 * 60 * 1000
}

export async function getCachedConsulta(documento: string): Promise<NvCheckCacheItem | null> {
  const cache = loadCache()
  if (!cache.items.length) return null

  const now = Date.now()
  const ttlMs = getTtlMs()

  const found = cache.items.find((item) => item.documento === documento)
  if (!found) return null

  if (ttlMs != null) {
    const savedAtTime = new Date(found.savedAt).getTime()
    if (Number.isFinite(savedAtTime) && now - savedAtTime > ttlMs) {
      return null
    }
  }

  return found
}

export async function saveConsulta(
  documento: string,
  tipo: DocumentoTipo,
  data: any
): Promise<void> {
  const cache = loadCache()
  const nowIso = new Date().toISOString()
  const existingIndex = cache.items.findIndex((item) => item.documento === documento)
  const newItem: NvCheckCacheItem = {
    documento,
    tipo,
    data,
    savedAt: nowIso,
  }

  if (existingIndex >= 0) {
    cache.items[existingIndex] = newItem
  } else {
    cache.items.push(newItem)
  }

  saveCache(cache)
}

