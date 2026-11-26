import { useState } from 'react'
import { hashColor, initials, isOverdue, key, localDate, PRIORITY_COLOR, split, statusColor } from './logic.js'

export const Avatars = ({ names }) => (
  <span className="flex -space-x-1.5">
    {split(names).map(n => (
      <span key={n} title={n} style={{ background: `linear-gradient(135deg, ${hashColor(n)}, ${hashColor(n + n)})` }}
        className="grid size-6 place-items-center rounded-full text-[9px] font-bold text-white ring-2 ring-bg">{initials(n)}</span>
    ))}
  </span>
)

export function Pill({ status }) {
  const c = statusColor(status)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, color: `color-mix(in srgb, ${c} 55%, var(--color-ink))` }}>
      <span className="size-2 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
      {status || 'No status'}
    </span>
  )
}

export const Flag = ({ priority }) => priority
  ? <span className="whitespace-nowrap font-medium" style={{ color: PRIORITY_COLOR[key(priority)] || '#87909e' }}>⚑ {priority}</span>
  : null

export const Tags = ({ text }) => split(text).map(t => (
  <span key={t} className="rounded bg-accent/15 px-1.5 py-px text-[11px] text-accent">{t}</span>
))

export const Due = ({ item, today }) => item.f['due date']
  ? <span className={isOverdue(item, today) ? 'font-medium text-danger' : 'text-dim'}>
      {localDate(item.f['due date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
  : null

export const Panel = ({ title, children, className = '' }) => (
  <section className={`rounded-xl border border-line bg-panel/80 p-4 backdrop-blur ${className}`}>
    {title && <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>}
    {children}
  </section>
)

export function AddTask({ onCreate, label = 'Add task' }) {
  const [name, setName] = useState('')
  return (
    <form onSubmit={e => { e.preventDefault(); if (name.trim()) { onCreate(name.trim()); setName('') } }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={`+ ${label}`} aria-label={label}
        className="w-full rounded-md bg-transparent px-2 py-1.5 outline-none placeholder:text-dim hover:bg-raise focus:bg-raise" />
    </form>
  )
}
