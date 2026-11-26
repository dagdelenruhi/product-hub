import { useEffect, useState, useRef } from 'react'
import { motion } from 'motion/react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { api } from './api.js'
import { FINDING, isDone, key, labelOptions, looksLikeMarkdown, OPS, opsParts, subField, PRIORITY_COLOR, safeUrl, split, statusColor, STATUS_ORDER } from './logic.js'
import { AddTask, Avatars, Flag, Pill, Tags } from './ui.jsx'

const EXTRA = ['type', 'product module', 'release status', 'development team', 'epic', 'product manager', 'target quarter', 'company id', 'ready for qa date']
const Row = ({ label, wide, children }) => <><dt className="text-dim">{label}</dt><dd className={wide ? 'min-w-0 md:col-span-3' : 'min-w-0'}>{children || '–'}</dd></>
const hours = v => v && `${v}h`
const FIELD = 'rounded-md border border-line bg-panel px-2 py-1 outline-none focus:border-accent'

function Choice({ label, value, options, onChange }) {
  const all = !value || options.some(o => key(o) === key(value)) ? options : [value, ...options]
  return (
    <select aria-label={label} value={all.find(o => key(o) === key(value)) || ''} onChange={e => onChange(e.target.value)} className={FIELD}>
      <option value="">–</option>
      {all.map(o => <option key={o}>{o}</option>)}
    </select>
  )
}

// shortcut: people are matched by name and teams cannot be assigned; read ids from the people column if names ever collide.
function People({ value, onPick }) {
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const names = split(value)
  const load = e => e.target.open && !users && api('users').then(d => setUsers(d.users)).catch(() => setUsers([]))
  const toggle = u => {
    const next = names.includes(u.name) ? names.filter(n => n !== u.name) : [...names, u.name]
    const picked = users.filter(x => next.includes(x.name))
    onPick(picked.map(x => x.name).join(', '), picked.map(x => x.id).join(','))
  }
  return (
    <details onToggle={load} className="relative">
      <summary className={`${FIELD} flex cursor-pointer list-none items-center gap-2`}>
        {value ? <><Avatars names={value} /><span className="truncate">{value}</span></> : <span className="text-dim">Assign</span>}
      </summary>
      <div className="absolute z-10 mt-1 w-64 rounded-lg border border-line bg-raise p-2 shadow-2xl">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className={`${FIELD} mb-1 w-full`} />
        <ul className="max-h-56 overflow-auto">
          {!users ? <li className="p-2 text-dim">Loading…</li> : users.filter(u => key(u.name).includes(key(q))).map(u => (
            <li key={u.id}>
              <button aria-pressed={names.includes(u.name)} onClick={() => toggle(u)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-panel aria-pressed:text-accent2">
                <Avatars names={u.name} /><span className="truncate">{u.name}</span>{names.includes(u.name) && <span className="ml-auto">✓</span>}
              </button>
            </li>
          ))}
          {users?.length === 0 && <li className="p-2 text-dim">No people found.</li>}
        </ul>
      </div>
    </details>
  )
}

// Destructive buttons take a second click.
function Confirm({ label, ask, title, onYes }) {
  const [sure, setSure] = useState(false)
  return (
    <button onClick={() => (sure ? onYes() : setSure(true))} onBlur={() => setSure(false)} aria-label={title} title={title}
      className={`rounded px-1.5 py-0.5 text-xs ${sure ? 'bg-rose-500/20 text-danger' : 'text-dim hover:text-danger'}`}>{sure ? ask : label}</button>
  )
}

// Long text shows five lines until "Show more" or a click into it.
function Clamp({ children, className = '' }) {
  const box = useRef(null)
  const [more, setMore] = useState(false)
  const [long, setLong] = useState(false)
  useEffect(() => { if (!more) setLong(box.current.scrollHeight > box.current.clientHeight + 1) })
  return (
    <>
      <div ref={box} onFocus={() => setMore(true)} className={`${className} ${more ? '' : 'max-h-[5lh] overflow-hidden'}`}>{children}</div>
      {long && <button onClick={() => setMore(!more)} aria-expanded={more} className="mt-1 block text-xs text-accent2 hover:underline">{more ? 'Show less' : 'Show more'}</button>}
    </>
  )
}

const LIMIT = 2000  // monday's long text column keeps no more than this

// Rich text editor that reads and saves markdown, so the text stays readable in monday too.
function Description({ text, onSave }) {
  const ed = useRef(null), base = useRef(null)  // base: the text as the editor first wrote it back, so only real edits are saved
  const [size, setSize] = useState(0)
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: text || '', contentType: 'markdown',
    editorProps: {
      attributes: { 'aria-label': 'Description', role: 'textbox', 'aria-multiline': 'true', class: 'outline-none min-h-[1lh]' },
      handlePaste: (view, e) => {
        const plain = e.clipboardData?.getData('text/plain')
        if (!plain || (e.clipboardData.types.includes('text/html') && !looksLikeMarkdown(plain))) return false  // real rich text pastes as it is
        return ed.current.commands.insertContent(plain, { contentType: 'markdown' })
      },
    },
    onCreate: ({ editor }) => { base.current = editor.getMarkdown().trim() },
    onBlur: ({ editor }) => {
      const md = editor.getMarkdown().trim()
      if (md === base.current) return
      setSize(md.length)
      if (md.length <= LIMIT) { base.current = md; onSave(md) }
    },
  })
  ed.current = editor
  return (
    <>
      <Clamp className="md -mx-1 rounded px-1 leading-relaxed text-ink/85 hover:bg-raise/60 focus-within:bg-raise"><EditorContent editor={editor} /></Clamp>
      {size > LIMIT && <p role="alert" className="mt-1 text-xs text-danger">Not saved: {size} characters, monday keeps at most {LIMIT}. Shorten it and click outside.</p>}
    </>
  )
}

function SubRow({ sub, onEdit, onDelete }) {
  const status = subField(sub, 'status'), done = isDone(status)
  const rename = e => { const v = e.target.value.trim(); if (v) onEdit(sub, 'name', v); else e.target.value = sub.name }
  const desc = subField(sub, 'description'), owner = subField(sub, 'owner'), tags = subField(sub, 'tags')
  const [open, setOpen] = useState(!!desc)  // rows that carry a description start open, so the detail is not missed
  return (
    <li className="rounded-lg border border-line px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Details of ${sub.name}`} title="Details"
          className={`w-3 flex-none transition-transform ${open ? 'rotate-90' : ''} ${desc ? 'text-ink' : 'text-dim'}`}>▸</button>
        <input type="checkbox" checked={done} onChange={e => onEdit(sub, 'status', e.target.checked ? 'Done' : '')} aria-label={`Done: ${sub.name}`} className="accent-emerald-500" />
        <input key={sub.name} defaultValue={sub.name} title={sub.name} aria-label="Name" onBlur={rename} onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          className={`min-w-0 flex-1 rounded bg-transparent px-1 outline-none focus:bg-raise ${done ? 'text-dim line-through' : ''}`} />
        {status && !done && <Pill status={status} />}
        <Confirm label="✕" ask="Delete?" title={`Delete ${sub.name}`} onYes={() => onDelete(sub)} />
      </div>
      {open && (
        <div className="ml-5 mt-1.5 border-t border-line pt-1.5">
          {(owner || tags || subField(sub, 'priority')) && (
            <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-dim">
              {owner && <><Avatars names={owner} /><span>{owner}</span></>}<Flag priority={subField(sub, 'priority')} /><Tags text={tags} />
            </p>
          )}
          <Description text={desc} onSave={md => onEdit(sub, 'description', md)} />
        </div>
      )}
    </li>
  )
}

function SubList({ title, big, subs, label, item, tag, sub }) {
  const Title = big ? 'h3' : 'h4'
  return (
    <section aria-label={title}>
      <Title className={big ? 'mb-2 mt-7 font-semibold' : 'mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-dim'}>{title} · {subs.length}</Title>
      <ul className="grid gap-1.5">
        {subs.map(s => <SubRow key={s.id} sub={s} onEdit={(...a) => sub.edit(item, ...a)} onDelete={s => sub.remove(item, s)} />)}
      </ul>
      <AddTask label={label} onCreate={name => sub.add(item, name, tag)} />
    </section>
  )
}

export function TaskPanel({ board, item, onChange, onRemove, sub, onClose }) {
  const [updates, setUpdates] = useState(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState('')  // 'busy', or why the comment was not sent
  const f = item.f

  useEffect(() => {
    let live = true
    api('item', { id: item.id }).then(d => live && setUpdates(d.items[0]?.updates || [])).catch(e => live && setError(e.message))
    return () => { live = false }
  }, [item.id])

  useEffect(() => {
    // Esc inside a text box leaves the box (which saves it) instead of closing the card and losing the text
    const onKey = e => e.key === 'Escape' && (e.target.closest?.('input, textarea, [contenteditable="true"]') ? document.activeElement.blur() : onClose())
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  const set = k => v => onChange(item, k, v)
  const date = (k, label) => <input type="date" aria-label={label} value={(f[k] || '').slice(0, 10)} onChange={e => set(k)(e.target.value)} className={FIELD} />
  const send = async e => {
    e.preventDefault()
    if (!draft.trim()) return
    setSending('busy')
    try {
      const made = (await api('comment', { item: item.id, body: draft.trim() })).create_update
      setUpdates(u => [made, ...(u || [])]); setDraft(''); setSending('')
    } catch (err) { setSending(err.message) }
  }

  const parts = opsParts(item.subitems)
  const clickup = safeUrl(((f.clickup || '').match(/https:\/\/\S+/) || [])[0])
  const link = 'underline decoration-dim underline-offset-2 hover:text-ink'
  return (
    <motion.div className="fixed inset-0 z-20 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-modal="true" aria-label={item.name} onClick={e => e.stopPropagation()}
        initial={{ x: 80 }} animate={{ x: 0 }} exit={{ x: 80 }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="flex h-full w-[min(1100px,96vw)] border-l border-line bg-bg shadow-2xl max-md:flex-col">
        <article className="min-w-0 flex-1 overflow-auto p-8">
          <p className="text-dim">{board.name}
            {safeUrl(item.url) && <> · <a className={link} href={item.url} target="_blank" rel="noopener">Open in monday</a></>}
            {clickup && <> · <a className={link} href={clickup} target="_blank" rel="noopener">ClickUp</a></>}
          </p>
          <h2 className="mb-5 mt-2">
            <textarea rows={1} defaultValue={item.name} aria-label="Card name" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), e.target.blur())}
              onBlur={e => { const v = e.target.value.trim(); if (v) onChange(item, 'name', v); else e.target.value = item.name }}
              className="field-sizing-content -mx-1 block w-[calc(100%+0.5rem)] resize-none rounded bg-transparent px-1 text-2xl font-semibold leading-tight outline-none hover:bg-raise/60 focus:bg-raise" />
          </h2>
          <dl className="grid grid-cols-[110px_1fr_110px_1fr] items-center gap-x-3 gap-y-3 max-md:grid-cols-[110px_1fr]">
            <Row label="Status">{board.ids.status
              ? <span className="flex items-center gap-2"><span className="size-2.5 flex-none rounded-full" style={{ background: statusColor(f.status) }} /><Choice label="Status" value={f.status} options={labelOptions(board, 'status', STATUS_ORDER)} onChange={set('status')} /></span>
              : <Pill status={f.status} />}</Row>
            <Row label="Assignees">{board.ids.assignee
              ? <People value={f.assignee} onPick={(names, ids) => onChange(item, 'assignee', names, ids)} />
              : f.assignee}</Row>
            <Row label="Dates" wide>{board.ids['start date'] && board.ids['due date']
              ? <span className="flex flex-wrap items-center gap-2">{date('start date', 'Start date')}<span className="text-dim">→</span>{date('due date', 'Due date')}</span>
              : [f['start date'], f['due date']].filter(Boolean).join(' → ')}</Row>
            <Row label="Priority">{board.ids.priority
              ? <Choice label="Priority" value={f.priority} options={labelOptions(board, 'priority', Object.keys(PRIORITY_COLOR))} onChange={set('priority')} />
              : f.priority}</Row>
            <Row label="Time estimate">{hours(f['time estimate h'])}</Row>
            <Row label="Sprint points">{board.ids['sprint points']
              ? <input type="number" min="0" step="0.5" aria-label="Sprint points" key={f['sprint points']} defaultValue={f['sprint points']}
                  onBlur={e => set('sprint points')(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.target.blur()} className={`${FIELD} w-20`} />
              : f['sprint points']}</Row>
            <Row label="Time spent">{hours(f['time spent h'])}</Row>
            <Row label="Tags">{f.tags && <span className="flex flex-wrap gap-1"><Tags text={f.tags} /></span>}</Row>
          </dl>
          <h3 className="mb-2 mt-7 font-semibold">Description</h3>
          {board.ids.description
            ? <Description text={f.description} onSave={set('description')} />
            : <p className="whitespace-pre-wrap break-words leading-relaxed text-ink/85">{f.description || 'No description.'}</p>}
          <h3 className="mb-2 mt-7 font-semibold">Fields</h3>
          <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-2.5 rounded-xl border border-line bg-panel/60 p-4">
            {EXTRA.filter(k => k in board.titles).map(k => <Row key={k} label={board.titles[k]}>{f[k]}</Row>)}
          </dl>
          <SubList title="Subtasks" big subs={parts.rest} label="Add subtask" item={item} sub={sub} />
          <h3 className="mt-7 font-semibold">Activity</h3>
          <form onSubmit={send} className="mt-3 grid gap-2">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder="Write a comment" aria-label="Comment" className={FIELD} />
            {sending && sending !== 'busy' && <p role="alert" className="text-xs text-danger">{sending}</p>}
            <button disabled={sending === 'busy' || !draft.trim()} className="justify-self-end rounded-md bg-accent px-3 py-1 font-medium text-white disabled:opacity-40">Comment</button>
          </form>
          {error ? <p role="alert" className="py-4 text-danger">{error}</p>
            : !updates ? <div className="shimmer mt-4 h-24 rounded-lg" />
            : updates.length === 0 ? <p className="py-4 text-dim">No activity yet.</p>
            : updates.map(u => (
              <div key={u.id} className="mt-3 border-t border-line pt-3">
                <b>{u.creator?.name || 'Unknown'}</b>
                <time className="ml-2 text-xs text-dim">{new Date(u.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <Clamp className="mt-1 whitespace-pre-wrap break-words text-xs text-ink/85">{u.text_body}</Clamp>
              </div>
            ))}
        </article>
        <aside className="w-[400px] flex-none overflow-auto border-l border-line bg-panel px-4 pb-4 pt-7 max-md:w-auto max-md:border-l-0 max-md:border-t">
          <div className="flex items-center justify-end gap-1">
            <Confirm label="Archive" ask="Archive card?" title="Archive this card" onYes={() => onRemove(item, 'archive')} />
            <Confirm label="Delete" ask="Delete card?" title="Delete this card" onYes={() => onRemove(item, 'delete')} />
            <button autoFocus onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-base hover:bg-raise">✕</button>
          </div>
          <div className="-mt-4">
            <SubList title="Test findings" big subs={parts[FINDING]} label="Add test finding" item={item} tag={FINDING} sub={sub} />
          </div>
          <h3 className="mt-7 font-semibold">Operational work</h3>
          {Object.entries(OPS).map(([tag, title]) => (
            <SubList key={tag} title={title} subs={parts[tag]} label={`Add ${title.toLowerCase()}`} item={item} tag={tag} sub={sub} />
          ))}
        </aside>
      </motion.div>
    </motion.div>
  )
}
