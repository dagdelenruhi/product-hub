import { useEffect, useState } from 'react'
import { api } from './api.js'
import { linkTarget } from './logic.js'
import { Pill } from './ui.jsx'

// Searches every board of the workspace by card name (subitem boards are left out to keep it quick), or jumps straight to a pasted monday link.
// onGo(boardId, itemId) returns false when the board is not part of this workspace.
export function GlobalSearch({ boards, onGo }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState(null)
  const [msg, setMsg] = useState('')
  const text = q.trim()

  useEffect(() => {
    setHits(null); setMsg('')
    if (text.length < 2) return
    let live = true
    const timer = setTimeout(async () => {
      try {
        const link = linkTarget(text)
        if (link) {
          const found = link.item && (await api('find', { id: link.item })).items[0]
          if (!live) return
          if (link.item && !found) return setMsg('No card found for this link.')
          const card = found?.parent_item || found  // a link to a subtask opens its parent card
          if (onGo(card ? card.board.id : link.board, card?.id)) setQ('')
          else setMsg('That link points outside PRODUCT HUB.')
          return
        }
        const names = Object.fromEntries(boards.map(b => [b.id, b.name]))
        const found = (await api('search', { q: text, ids: Object.keys(names) })).boards.flatMap(b => b.items_page.items
          .filter(it => !/^archived/i.test(it.group?.title || ''))
          .map(it => ({ id: it.id, name: it.name, board: b.id, boardName: names[b.id], status: it.column_values[0]?.text })))
        if (live) setHits(found)
      } catch (e) { if (live) setMsg(e.message) }
    }, 350)
    return () => { live = false; clearTimeout(timer) }
  }, [text])

  return (
    <div className="relative mb-4 max-w-2xl">
      <input type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Escape' && setQ('')}
        placeholder="Search all cards, or paste a monday link" aria-label="Search all cards"
        className="w-full rounded-lg border border-line bg-panel px-3 py-2 outline-none focus:border-accent" />
      {text.length >= 2 && (
        <div className="absolute inset-x-0 z-10 mt-1 max-h-[60vh] overflow-auto rounded-lg border border-line bg-raise p-1 shadow-2xl">
          {msg ? <p role="alert" className="p-2 text-danger">{msg}</p>
            : !hits ? <p className="p-2 text-dim">Searching…</p>
            : hits.length === 0 ? <p className="p-2 text-dim">No cards found.</p>
            : hits.map(h => (
              <button key={h.id} onClick={() => { onGo(h.board, h.id); setQ('') }}
                className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-panel">
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                <span className="max-w-48 flex-none truncate text-xs text-dim">{h.boardName}</span>
                <Pill status={h.status} />
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
