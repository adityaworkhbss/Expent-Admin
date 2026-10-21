import { Plus, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import type { ConfigGroup, ConfigValue } from '../../types'
import { humanize, isGroup, matchesSearch, missingPlaceholders, placeholders, type Path } from '../../lib/configUtils'

interface FieldsProps {
  value: ConfigGroup
  /** The published value at the same path, to highlight edits and offer a reset. */
  original: ConfigGroup | undefined
  path: Path
  query: string
  onChange: (path: Path, value: ConfigValue) => void
}

/** Renders every text in a config group: inputs for text, editable lists, and nested groups. */
export function ConfigFields({ value, original, path, query, onChange }: FieldsProps) {
  const entries = Object.entries(value).filter(([key, child]) =>
    matchesSearch(child, [...path, key].join('.').toLowerCase(), query)
  )
  if (entries.length === 0) return null

  return (
    <div className="space-y-4">
      {entries.map(([key, child]) => {
        const childPath = [...path, key]
        const childOriginal = original?.[key]
        if (isGroup(child)) {
          return (
            <fieldset key={key} className="border-l-2 border-purple-200 dark:border-purple-900 pl-4 space-y-3">
              <legend className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{humanize(key)}</legend>
              <ConfigFields
                value={child}
                original={isGroup(childOriginal) ? childOriginal : undefined}
                path={childPath}
                query={query}
                onChange={onChange}
              />
            </fieldset>
          )
        }
        if (Array.isArray(child)) {
          return (
            <ListField
              key={key}
              label={humanize(key)}
              path={childPath}
              items={child}
              original={Array.isArray(childOriginal) ? childOriginal : undefined}
              onChange={(items) => onChange(childPath, items)}
            />
          )
        }
        return (
          <TextField
            key={key}
            label={humanize(key)}
            path={childPath}
            value={child}
            original={typeof childOriginal === 'string' ? childOriginal : undefined}
            onChange={(text) => onChange(childPath, text)}
          />
        )
      })}
    </div>
  )
}

const fieldClass = (changed: boolean) =>
  clsx(
    'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100',
    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
    changed ? 'border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-900/10' : 'border-gray-300 dark:border-gray-600'
  )

function FieldHeader({ label, path, changed, onReset }: { label: string; path: Path; changed: boolean; onReset?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <label htmlFor={path.join('.')} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        <span className="ml-2 font-mono text-xs font-normal text-gray-400">{path.join('.')}</span>
      </label>
      {changed && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:underline"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  )
}

function PlaceholderHints({ original, value }: { original: string | undefined; value: string }) {
  const names = placeholders(original ?? value)
  if (names.length === 0) return null
  const missing = original !== undefined ? missingPlaceholders(original, value) : []
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-gray-500 dark:text-gray-400">Filled in by the app:</span>
      {names.map((name) => (
        <code
          key={name}
          className={clsx(
            'px-1.5 py-0.5 rounded',
            missing.includes(name)
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 line-through'
              : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          )}
        >
          {`{${name}}`}
        </code>
      ))}
      {missing.length > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Removed placeholders won't show the value
        </span>
      )}
    </div>
  )
}

function TextField({
  label,
  path,
  value,
  original,
  onChange,
}: {
  label: string
  path: Path
  value: string
  original: string | undefined
  onChange: (value: string) => void
}) {
  const changed = original !== value
  const multiline = (original ?? value).length > 70 || (original ?? value).includes('\n')
  const id = path.join('.')
  return (
    <div>
      <FieldHeader label={label} path={path} changed={changed} onReset={original !== undefined ? () => onChange(original) : undefined} />
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.min(10, Math.max(3, Math.ceil(value.length / 80) + value.split('\n').length - 1))}
          className={clsx(fieldClass(changed), 'resize-y')}
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass(changed)} />
      )}
      <PlaceholderHints original={original} value={value} />
    </div>
  )
}

function ListField({
  label,
  path,
  items,
  original,
  onChange,
}: {
  label: string
  path: Path
  items: string[]
  original: string[] | undefined
  onChange: (items: string[]) => void
}) {
  const changed = JSON.stringify(items) !== JSON.stringify(original)
  return (
    <div>
      <FieldHeader label={label} path={path} changed={changed} onReset={original ? () => onChange(original) : undefined} />
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="w-6 text-right text-xs text-gray-400">{index + 1}.</span>
            <input
              id={index === 0 ? path.join('.') : undefined}
              aria-label={`${label} item ${index + 1}`}
              value={item}
              onChange={(e) => onChange(items.map((it, i) => (i === index ? e.target.value : it)))}
              className={fieldClass(original?.[index] !== item)}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label={`Remove ${label} item ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="mt-2 ml-8 flex items-center gap-1 text-sm text-purple-700 dark:text-purple-300 hover:underline"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add item
      </button>
    </div>
  )
}
