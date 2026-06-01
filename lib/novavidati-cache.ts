/**
 * Cache de consultas Nova Vida (NVCheck) por CPF para evitar custo de consultas repetidas.
 * Armazenamento em arquivo JSON; TTL configurável (padrão 24h).
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const CACHE_DIR = join(process.cwd(), 'data')
const CACHE_FILE = join(CACHE_DIR, 'novavidati-cache.json')
const TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

export interface CacheEntry {
  cpf: string
  data: unknown
  consultadoEm: string // ISO
}

interface CacheFile {
  [cpf: string]: CacheEntry
}

async function ensureDir(): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
  } catch {
    // ignore
  }
}

async function readCache(): Promise<CacheFile> {
  try {
    const raw = await readFile(CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

async function writeCache(cache: CacheFile): Promise<void> {
  await ensureDir()
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 0), 'utf-8')
}

/**
 * Retorna dados em cache para o CPF se existirem e não estiverem expirados.
 */
export async function getNovaVidaCache(cpf: string): Promise<{ data: unknown; consultadoEm: Date } | null> {
  const normalized = String(cpf).replace(/\D/g, '')
  if (normalized.length !== 11) return null
  const cache = await readCache()
  const entry = cache[normalized]
  if (!entry || !entry.consultadoEm) return null
  const consultadoEm = new Date(entry.consultadoEm)
  if (Date.now() - consultadoEm.getTime() > TTL_MS) {
    delete cache[normalized]
    await writeCache(cache)
    return null
  }
  return { data: entry.data, consultadoEm }
}

/**
 * Grava resultado da consulta Nova Vida no cache.
 */
export async function setNovaVidaCache(cpf: string, data: unknown): Promise<void> {
  const normalized = String(cpf).replace(/\D/g, '')
  if (normalized.length !== 11) return
  const cache = await readCache()
  cache[normalized] = {
    cpf: normalized,
    data,
    consultadoEm: new Date().toISOString()
  }
  await writeCache(cache)
}
