import type { ConfigGroup, ConfigValue, RemoteConfig } from '../types'

export type Path = string[]

export interface ConfigChange {
  path: string
  before: string
  after: string
}

export const isGroup = (value: unknown): value is ConfigGroup =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function getAt(root: ConfigGroup, path: Path): ConfigValue | undefined {
  let node: ConfigValue | undefined = root
  for (const key of path) {
    if (!isGroup(node)) return undefined
    node = node[key]
  }
  return node
}

/** Returns a copy of root with the value at path replaced (copying only the groups along the path). */
export function setAt(root: ConfigGroup, path: Path, value: ConfigValue): ConfigGroup {
  if (path.length === 0) return root
  const [key, ...rest] = path
  const child = root[key]
  return {
    ...root,
    [key]: rest.length === 0 ? value : setAt(isGroup(child) ? child : {}, rest, value),
  }
}

/** Every "{name}" placeholder in a text, e.g. "Hi {name}" -> ["name"]. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
}

/** Placeholders the app fills in that are missing from the edited text. */
export function missingPlaceholders(original: string, edited: string): string[] {
  const kept = new Set(placeholders(edited))
  return placeholders(original).filter((p) => !kept.has(p))
}

const show = (value: unknown): string =>
  value === undefined ? '(none)' : Array.isArray(value) ? value.join(' · ') : String(value)

/** Flat list of changed text values between two configs (serverUrl and every content leaf). */
export function diffConfigs(before: RemoteConfig, after: RemoteConfig): ConfigChange[] {
  const changes: ConfigChange[] = []
  if (before.serverUrl !== after.serverUrl) {
    changes.push({ path: 'serverUrl', before: show(before.serverUrl), after: show(after.serverUrl) })
  }
  const walk = (a: ConfigValue | undefined, b: ConfigValue | undefined, path: string) => {
    if (isGroup(a) || isGroup(b)) {
      const keys = new Set([...Object.keys(isGroup(a) ? a : {}), ...Object.keys(isGroup(b) ? b : {})])
      for (const key of keys) {
        walk(isGroup(a) ? a[key] : undefined, isGroup(b) ? b[key] : undefined, path ? `${path}.${key}` : key)
      }
      return
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ path, before: show(a), after: show(b) })
    }
  }
  walk(before.content, after.content, '')
  return changes
}

/** Number of text values (strings and list items) under a value. */
export function countTexts(value: ConfigValue): number {
  if (typeof value === 'string') return 1
  if (Array.isArray(value)) return value.length
  return Object.values(value).reduce((sum, child) => sum + countTexts(child), 0)
}

/** Whether a value (or anything inside it) matches the search, by key path or text. */
export function matchesSearch(value: ConfigValue, path: string, query: string): boolean {
  if (!query) return true
  if (path.toLowerCase().includes(query)) return true
  if (typeof value === 'string') return value.toLowerCase().includes(query)
  if (Array.isArray(value)) return value.some((item) => item.toLowerCase().includes(query))
  return Object.entries(value).some(([key, child]) => matchesSearch(child, `${path}.${key}`, query))
}

/** Same checks the backend runs, so most mistakes are caught before publishing. */
export function validateConfig(value: unknown): string | null {
  if (!isGroup(value)) return 'The config must be a JSON object.'
  const serverUrl = value.serverUrl
  if (typeof serverUrl !== 'string' || !serverUrl.trim()) return '"serverUrl" must be a non-empty string.'
  try {
    const url = new URL(serverUrl.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '"serverUrl" must start with http:// or https://.'
    if (url.pathname !== '/' || url.search || url.hash) return '"serverUrl" must be just the server origin, without a path.'
  } catch {
    return '"serverUrl" must be an absolute URL, e.g. https://api.example.com'
  }
  if (!isGroup(value.content)) return '"content" must be an object.'
  const check = (node: unknown, path: string): string | null => {
    if (typeof node === 'string') return null
    if (Array.isArray(node)) {
      const bad = node.findIndex((item) => typeof item !== 'string')
      return bad === -1 ? null : `${path}[${bad}] must be text.`
    }
    if (isGroup(node)) {
      for (const [key, child] of Object.entries(node)) {
        const error = check(child, `${path}.${key}`)
        if (error) return error
      }
      return null
    }
    return `${path} must be text, a list of text, or a group.`
  }
  return check(value.content, 'content')
}

/** "addTransactionSheet" -> "Add transaction sheet" */
export function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
