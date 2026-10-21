import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Braces,
  Check,
  ChevronDown,
  UploadCloud,
  Globe,
  Info,
  ListTree,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Undo2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { AxiosError } from 'axios'
import { apiClient } from '../api/client'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ConfigFields } from '../components/config/ConfigFields'
import {
  countTexts,
  diffConfigs,
  humanize,
  isGroup,
  matchesSearch,
  setAt,
  validateConfig,
  type Path,
} from '../lib/configUtils'
import type { ApiResponse, AppConfigData, ConfigValue, RemoteConfig } from '../types'

type Mode = 'form' | 'json'
type Notice = { kind: 'success' | 'info' | 'error' | 'conflict'; message: string }

const DRAFT_KEY = 'appConfigDraft'
interface SavedDraft {
  baseVersion: string
  draft: RemoteConfig
}

/** The edits saved for this exact published version, if any; drafts made on an older version are dropped. */
function readSavedDraft(data: AppConfigData): RemoteConfig | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as SavedDraft | null
    if (saved && saved.baseVersion === data.version && !validateConfig(saved.draft)) return saved.draft
  } catch {
    // Ignore unreadable drafts
  }
  sessionStorage.removeItem(DRAFT_KEY)
  return null
}

const errorMessage = (err: unknown, fallback: string) =>
  (err as AxiosError<ApiResponse<unknown>>).response?.data?.message || fallback

export function AppConfigPage() {
  const [published, setPublished] = useState<AppConfigData | null>(null)
  const [draft, setDraft] = useState<RemoteConfig | null>(null)
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('form')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [reviewOpen, setReviewOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const response = await apiClient.getAppConfig()
      if (!response.success) throw new Error(response.message)
      const restored = readSavedDraft(response.data)
      setPublished(response.data)
      setDraft(restored ?? response.data.config)
      if (restored) setNotice({ kind: 'info', message: 'Restored your unpublished edits from earlier.' })
      setMode('form')
      setJsonError('')
    } catch (err) {
      setLoadError(errorMessage(err, (err as Error).message || 'Failed to load the app config'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const changes = useMemo(
    () => (published && draft ? diffConfigs(published.config, draft) : []),
    [published, draft]
  )
  const isDirty = changes.length > 0 || (published !== null && !published.storedInKv)
  const draftError = useMemo(() => (draft ? validateConfig(draft) : null), [draft])

  // Keep unpublished edits across page switches and reloads in this tab (until published or discarded)
  useEffect(() => {
    if (!published || !draft) return
    if (changes.length > 0) {
      const saved: SavedDraft = { baseVersion: published.version, draft }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(saved))
    } else {
      sessionStorage.removeItem(DRAFT_KEY)
    }
  }, [published, draft, changes.length])

  // Warn before closing or reloading with unpublished edits
  useEffect(() => {
    if (changes.length === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changes.length])

  const updateAt = (path: Path, value: ConfigValue) => {
    setDraft((current) => (current ? { ...current, content: setAt(current.content, path, value) } : current))
  }

  const switchMode = (next: Mode) => {
    if (!draft || next === mode) return
    if (next === 'json') {
      setJsonText(JSON.stringify(draft, null, 2))
      setJsonError('')
    }
    setMode(next)
  }

  const onJsonChange = (text: string) => {
    setJsonText(text)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setJsonError(`Invalid JSON: ${(err as Error).message}`)
      return
    }
    const problem = validateConfig(parsed)
    setJsonError(problem ?? '')
    if (!problem) setDraft(parsed as RemoteConfig)
  }

  const discard = () => {
    if (!published) return
    setDraft(published.config)
    setJsonText(JSON.stringify(published.config, null, 2))
    setJsonError('')
  }

  const publish = async () => {
    if (!draft || !published) return
    setIsPublishing(true)
    setNotice(null)
    try {
      const response = await apiClient.updateAppConfig(draft, published.version)
      if (!response.success) throw new Error(response.message)
      setPublished(response.data)
      setDraft(response.data.config)
      setReviewOpen(false)
      setNotice({
        kind: 'success',
        message: `Published. Apps pick it up on next launch, when they reconnect, or within ~15 minutes.`,
      })
    } catch (err) {
      const status = (err as AxiosError).response?.status
      setReviewOpen(false)
      setNotice({
        kind: status === 409 ? 'conflict' : 'error',
        message: errorMessage(err, (err as Error).message || 'Failed to publish'),
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const toggleSection = (key: string) =>
    setOpenSections((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-purple-600 animate-spin" aria-label="Loading app config" />
      </div>
    )
  }

  if (loadError || !draft || !published) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageTitle />
        <Card className="flex items-start gap-3 border-red-200 dark:border-red-800">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">Couldn't load the app config</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const normalizedQuery = query.trim().toLowerCase()
  const sections = Object.entries(draft.content).filter(([key, value]) =>
    matchesSearch(value, key.toLowerCase(), normalizedQuery)
  )

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle />

      {!published.storedInKv && (
        <Banner kind="info">
          This is the config the app receives today. It isn't in the new storage yet: publish once to start
          managing it here, then switch the worker over.
        </Banner>
      )}
      {notice && (
        <Banner kind={notice.kind === 'conflict' ? 'error' : notice.kind} onDismiss={() => setNotice(null)}>
          {notice.message}
          {notice.kind === 'conflict' && (
            <Button variant="outline" size="sm" className="mt-2" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Load latest (discards your edits)
            </Button>
          )}
        </Banner>
      )}

      <Card padding="sm" className="space-y-3">
        <label htmlFor="serverUrl" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Globe className="h-4 w-4 text-purple-600" aria-hidden="true" />
          Server URL
        </label>
        <input
          id="serverUrl"
          value={draft.serverUrl}
          disabled={mode === 'json'}
          onChange={(e) => setDraft({ ...draft, serverUrl: e.target.value })}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-gray-100',
            'focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60',
            draft.serverUrl !== published.config.serverUrl ? 'border-amber-400' : 'border-gray-300 dark:border-gray-600'
          )}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Every API call from the app goes here (the app adds <code>/api/v1</code>). A wrong URL breaks the app
          for everyone, so double-check before publishing.
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5" role="tablist">
          <ModeTab active={mode === 'form'} onClick={() => switchMode('form')} disabled={mode === 'json' && !!jsonError}>
            <ListTree className="h-4 w-4" /> Form
          </ModeTab>
          <ModeTab active={mode === 'json'} onClick={() => switchMode('json')}>
            <Braces className="h-4 w-4" /> JSON
          </ModeTab>
        </div>
        {mode === 'form' && (
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search text or keys, e.g. “Log Out” or profile.logout"
              aria-label="Search config"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}
      </div>

      {mode === 'json' ? (
        <Card padding="sm" className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(e) => onJsonChange(e.target.value)}
            spellCheck={false}
            aria-label="Config JSON"
            className="w-full h-[60vh] p-3 font-mono text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {jsonError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{jsonError}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use this to add or remove keys. New keys only show in the app once its code reads them.
            </p>
          )}
        </Card>
      ) : sections.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Nothing matches “{query}”.</p>
      ) : (
        <div className="space-y-3">
          {sections.map(([key, value]) => {
            const open = normalizedQuery !== '' || openSections.has(key)
            const sectionChanges = changes.filter((c) => c.path === key || c.path.startsWith(`${key}.`)).length
            return (
              <Card key={key} padding="none">
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left"
                >
                  <SlidersHorizontal className="h-4 w-4 text-purple-600" aria-hidden="true" />
                  <span className="font-semibold text-gray-900 dark:text-white">{humanize(key)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{countTexts(value)} texts</span>
                  {sectionChanges > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {sectionChanges} edited
                    </span>
                  )}
                  <ChevronDown className={clsx('ml-auto h-5 w-5 text-gray-400 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-4">
                    {isGroup(value) ? (
                      <ConfigFields
                        value={value}
                        original={(() => {
                          const original = published.config.content[key]
                          return isGroup(original) ? original : undefined
                        })()}
                        path={[key]}
                        query={normalizedQuery}
                        onChange={updateAt}
                      />
                    ) : (
                      <ConfigFields
                        value={{ [key]: value }}
                        original={published.config.content}
                        path={[]}
                        query={normalizedQuery}
                        onChange={updateAt}
                      />
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Publish bar, stuck to the bottom of the scrolling main area */}
      <div className="sticky bottom-0 z-20 -mx-4 lg:-mx-6 -mb-4 lg:-mb-6 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-4xl px-4 lg:px-6 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">
            {draftError ? (
              <span className="text-red-600 dark:text-red-400">{draftError}</span>
            ) : changes.length > 0 ? (
              `${changes.length} unpublished change${changes.length === 1 ? '' : 's'}`
            ) : published.storedInKv ? (
              'Everything is published'
            ) : (
              'Not published to the new storage yet'
            )}
          </p>
          <Button variant="outline" onClick={discard} disabled={changes.length === 0}>
            <Undo2 className="h-4 w-4" />
            Discard
          </Button>
          <Button onClick={() => setReviewOpen(true)} disabled={!isDirty || !!draftError || !!jsonError}>
            <UploadCloud className="h-4 w-4" />
            Review & publish
          </Button>
        </div>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col" padding="none">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 id="review-title" className="text-lg font-semibold text-gray-900 dark:text-white">Publish to all apps?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {changes.length > 0
                  ? `${changes.length} change${changes.length === 1 ? '' : 's'} will go live for every user.`
                  : 'This copies the current config into the new storage. Nothing changes for users.'}
              </p>
            </div>
            <ul className="flex-1 overflow-auto divide-y divide-gray-100 dark:divide-gray-700">
              {changes.slice(0, 300).map((change) => (
                <li key={change.path} className="px-6 py-3 text-sm">
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{change.path}</p>
                  <p className="mt-1 text-red-700 dark:text-red-400 line-through break-words">{change.before}</p>
                  <p className="text-green-700 dark:text-green-400 break-words">{change.after}</p>
                </li>
              ))}
              {changes.length > 300 && (
                <li className="px-6 py-3 text-sm text-gray-500">…and {changes.length - 300} more</li>
              )}
            </ul>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={isPublishing}>
                Cancel
              </Button>
              <Button onClick={publish} loading={isPublishing}>
                <UploadCloud className="h-4 w-4" />
                Publish
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">App Config</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-1">
        Edit the text shown in the app and the server it talks to. Changes reach apps without a new release.
      </p>
    </div>
  )
}

function ModeTab({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50',
        active
          ? 'bg-purple-600 text-white'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      )}
    >
      {children}
    </button>
  )
}

function Banner({
  kind,
  children,
  onDismiss,
}: {
  kind: 'info' | 'success' | 'error'
  children: ReactNode
  onDismiss?: () => void
}) {
  const Icon = kind === 'success' ? Check : kind === 'error' ? AlertTriangle : Info
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={clsx(
        'p-4 rounded-lg flex items-start gap-3 border text-sm',
        kind === 'info' && 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        kind === 'success' && 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
        kind === 'error' && 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
