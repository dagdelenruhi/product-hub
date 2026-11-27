import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api, forget, loadBoard, remember, saveKey, savedKey } from './api.js'
import { groupBy, key, split, sprintCopy, sprintDates, sprintState, stats } from './logic.js'
import { BoardView, ListView, ReportView } from './views.jsx'
import { TaskPanel } from './TaskPanel.jsx'
import { GlobalSearch } from './Search.jsx'

const REPO = 'https://github.com/dagdelenruhi/cuma'
const shortDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function Folder({ name, boards, current }) {
  const [open, setOpen] = useState(name === 'Sprints' || boards.some(b => b.id === current))
  return (
    <div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-dim hover:text-ink">
        <motion.span animate={{ rotate: open ? 90 : 0 }}>▸</motion.span>{name}
      </button>
      {open && boards.map(b => <BoardLink key={b.id} board={b} current={current} indent />)}
    </div>
  )
}

function BoardLink({ board, current, indent }) {
  const active = board.id === current
  return (
    <a href={`#/${board.id}/list`} aria-current={active ? 'page' : undefined}
      className={`relative flex justify-between gap-2 rounded-md py-1.5 pr-2 ${indent ? 'pl-6' : 'pl-2'} ${active ? 'text-ink' : 'text-ink/85 hover:bg-raise/60'}`}>
      {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-md bg-linear-to-r from-accent/30 to-accent2/10 ring-1 ring-accent/40" />}
      <span className="relative truncate">{board.name}</span>
      <span className="relative text-xs text-dim">{board.items_count}</span>
    </a>
  )
}

function Header({ board, folder, today }) {
  const now = new Date(), dates = sprintDates(board.name, now.getFullYear()), s = stats(board.items, today)
  const done = s.total ? Math.round(s.completed / s.total * 100) : 0
  const elapsed = dates ? Math.min(100, Math.max(0, (now - dates.start) / (dates.end - dates.start) * 100)) : 0
  const chip = 'rounded-md border border-line bg-panel/70 px-2 py-0.5 text-xs text-dim'
  return (
    <header>
      <p className="text-dim">PRODUCT HUB{folder && ` / ${folder.name}`}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="bg-linear-to-r from-ink via-accent to-accent2 bg-clip-text text-xl font-semibold text-transparent">{board.name}</h1>
        {dates && <><span className={chip}>{sprintState(dates, now)}</span><span className={chip}>{shortDate(dates.start)} – {shortDate(dates.end)}</span></>}
        <span className={chip}>{s.points} pts</span><span className={chip}>{s.notEstimated} not est</span>
      </div>
      {dates && (
        <div className="mt-3 max-w-xl" title={`${done}% of tasks completed, ${Math.round(elapsed)}% of the sprint elapsed`}>
          <div className="relative h-1.5 rounded-full bg-raise">
            <motion.div className="h-full rounded-full bg-linear-to-r from-accent to-accent2" initial={{ width: 0 }} animate={{ width: `${done}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink/80" style={{ left: `${elapsed}%` }} />
          </div>
          <p className="mt-1 text-xs text-dim">{done}% completed · {Math.round(elapsed)}% of sprint time elapsed</p>
        </div>
      )}
    </header>
  )
}

const Skeleton = () => (
  <div className="grid gap-3" aria-label="Loading">
    <div className="shimmer h-8 w-80 rounded-lg" />
    <div className="shimmer h-10 rounded-lg" />
    {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="shimmer h-14 rounded-lg" />)}
  </div>
)

// First screen: everyone signs in with their own monday API key, so their changes carry their own name and rights.
function KeyScreen() {
  const [key, setKey] = useState('')
  const [state, setState] = useState('')  // 'busy', or why the key was refused
  const submit = async e => {
    e.preventDefault()
    setState('busy')
    try { await api('me', {}, key.trim()); saveKey(key.trim()) }
    catch (err) { setState(err.message) }
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <span className="size-5 rounded-md bg-linear-to-br from-accent to-accent2" />Cuma
        </h1>
        <p className="mt-3 text-dim">Sign in with your own monday API key. In monday, click your profile picture, then Developers, then “My access tokens”.</p>
        <label className="mt-4 block text-xs font-semibold" htmlFor="key">monday API key</label>
        <input id="key" type="password" required autoFocus autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 outline-none focus:border-accent" />
        {state && state !== 'busy' && <p role="alert" className="mt-2 text-danger">{state}</p>}
        <button disabled={state === 'busy' || !key.trim()} className="mt-4 w-full rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-40">
          {state === 'busy' ? 'Checking…' : 'Continue'}
        </button>
        <p className="mt-4 text-xs text-dim">The key is saved in this browser only and is sent to monday.com and nowhere else. “Sign out” removes it. Do not use this on a shared computer.</p>
        <p className="mt-2 text-xs text-dim">Cuma is open source: <a href={REPO} target="_blank" rel="noopener" className="underline hover:text-ink">read the code or open a pull request on GitHub</a>.</p>
      </form>
    </main>
  )
}

export default function App() { return savedKey() ? <Hub /> : <KeyScreen /> }

function Hub() {
  const [id, view = 'list', team] = useHash().replace(/^#\//, '').split('/').map(decodeURIComponent)
  const [nav, setNav] = useState(null)
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [notice, setNotice] = useState('')
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark')
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next; setTheme(next)
    try { localStorage.theme = next } catch {}  // private windows may refuse storage; the choice then lasts until reload
  }
  const wanted = useRef(null)  // card to open once the board it lives on has loaded
  const today = useMemo(() => new Date(new Date().toDateString()), [])

  useEffect(() => { api('nav').then(setNav).catch(e => setError(e.message)) }, [])

  const boards = useMemo(() => (nav ? nav.boards.filter(b => b.type === 'board')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : []), [nav])
  const valid = boards.some(b => b.id === id)

  useEffect(() => {  // no board in the URL yet: open the sprint that is running now
    if (!nav || valid) return
    const now = new Date(), sprints = boards.filter(b => sprintDates(b.name, now.getFullYear()))
    const first = sprints.find(b => sprintState(sprintDates(b.name, now.getFullYear()), now) === 'In progress') || sprints[0] || boards[0]
    if (first) location.replace(`#/${first.id}/list`)
    else setError('No boards found in the workspace.')
  }, [nav, valid, boards])

  useEffect(() => {
    if (!valid) return
    let live = true
    setBoard(null); setError(''); setQ(''); setOpenId(wanted.current); wanted.current = null
    loadBoard(id).then(b => live && setBoard(b)).catch(e => live && setError(e.message))
    return () => { live = false }
  }, [id, valid])

  const items = useMemo(() => {
    const needle = key(q)
    return (board?.items || []).filter(it =>
      (!team || split(it.f['development team']).includes(team)) &&
      (!needle || key(it.name).includes(needle) || key(it.f.assignee).includes(needle)))
  }, [board, team, q])
  const teams = useMemo(() => [...groupBy(board?.items || [], it => split(it.f['development team'])).keys()].sort(), [board])
  const folder = nav?.folders.find(f => f.id === boards.find(b => b.id === id)?.board_folder_id)
  const openItem = board?.items.find(it => it.id === openId)

  // Writes show at once and are undone with a message if monday refuses them.
  const apply = (itemId, f) => setBoard(b => remember({ ...b, items: b.items.map(it => (it.id === itemId ? { ...it, f: { ...it.f, ...f } } : it)) }))
  const change = async (item, k, text, val) => {
    if (k === 'name') {  // the name is not a column value, but monday sets it through the same call
      if (text === item.name) return
      const put = name => setBoard(b => remember({ ...b, items: b.items.map(it => (it.id === item.id ? { ...it, name } : it)) }))
      put(text)
      return api('set', { board: board.id, item: item.id, col: 'name', val: text }).catch(e => { put(item.name); setNotice(`Not saved: ${e.message}`) })
    }
    const prev = item.f[k] || ''
    text = (board.labels[k] || []).find(l => key(l) === key(text)) ?? text  // board columns carry lower-case keys; monday wants the exact label
    if (text === prev) return
    apply(item.id, { [k]: text })
    try { await api('set', { board: board.id, item: item.id, col: board.ids[k], val: val ?? text }) }
    catch (e) { apply(item.id, { [k]: prev }); setNotice(`Not saved: ${e.message}`) }
  }
  const create = async (name, status) => {
    const values = {}, label = (board.labels.status || []).find(l => key(l) === key(status))
    if (label) values[board.ids.status] = { label }
    if (team) values[board.ids['development team']] = { labels: [team] }
    try {
      const made = (await api('create', { board: board.id, group: board.group, name, values: JSON.stringify(values) })).create_item
      setBoard(b => remember({ ...b, items: [...b.items, { ...made, name, f: { status: label || '', 'development team': team || '', assignee: '' }, subitems: [] }] }))
    } catch (e) { setNotice(`Not created: ${e.message}`) }
  }
  // how is 'archive' or 'delete'; monday keeps both restorable (archive / recycle bin)
  const remove = async (item, how) => {
    setOpenId(null)
    setBoard(b => remember({ ...b, items: b.items.filter(it => it.id !== item.id) }))
    try { await api(how, { item: item.id }) }
    catch (e) { setBoard(b => remember({ ...b, items: [...b.items, item] })); setNotice(`Not ${how}d: ${e.message}`) }
  }
  // Plans a Sprint-Ready card into a sprint: a linked copy on the sprint board, and the sprint's name on the card. Returns the copy's id.
  const plan = async (item, target) => {
    let made
    try {
      const [src, meta] = await Promise.all([api('source', { id: item.id }), api('target', { id: target.id })])
      const copy = sprintCopy(src.items[0], meta.boards[0])
      made = (await api('create', { board: target.id, group: copy.group, name: item.name, values: JSON.stringify(copy.values) })).create_item
      forget(target.id)
      if (!copy.linked) setNotice(`Added to ${target.name}, but that board has no column connected to this board, so the two cards are not linked.`)
    } catch (e) { setNotice(`Not added to the sprint: ${e.message}`); return }
    const prev = item.f.sprint
    apply(item.id, { sprint: target.name })
    try { await api('set', { board: board.id, item: item.id, col: board.ids.sprint, val: target.name, create: true }) }  // a new sprint has no label yet
    catch (e) { apply(item.id, { sprint: prev }); setNotice(`Added to ${target.name}, but the Sprint field of this card was not updated: ${e.message}`) }
    return made.id
  }
  // Opens the card a connect-boards column points to, whichever board it is on.
  const openLinked = async itemId => {
    try {
      const found = (await api('find', { id: itemId })).items[0]
      if (!found || !go(found.board.id, found.id)) setNotice('That card is on a board outside PRODUCT HUB, or no longer exists.')
    } catch (e) { setNotice(e.message) }
  }
  const subs = (itemId, fn) => setBoard(b => remember({ ...b, items: b.items.map(it => (it.id === itemId ? { ...it, subitems: fn(it.subitems) } : it)) }))
  const sub = {
    add: async (item, name, tag) => {
      try {
        const made = (await api('subtask', {
          item: item.id, name,
          // shortcut: assumes the subitems board uses the parent's Tags column id (true for the migrated boards); look it up if monday refuses.
          values: tag ? JSON.stringify({ [board.ids.tags]: tag }) : undefined,
        })).create_subitem
        subs(item.id, list => [...list, made])
      } catch (e) { setNotice(`Not created: ${e.message}`) }
    },
    // field is 'name' or a column title such as 'status'
    edit: async (item, s, field, text) => {
      const cv = s.column_values.find(c => key(c.column?.title || c.id) === field)
      const prev = field === 'name' ? s.name : cv?.text || ''
      if (text === prev) return
      const put = v => subs(item.id, list => list.map(x => (x.id !== s.id ? x : field === 'name' ? { ...x, name: v }
        : { ...x, column_values: x.column_values.map(c => (c.id === cv?.id ? { ...c, text: v } : c)) })))
      put(text)
      try { await api('set', { board: s.board?.id, item: s.id, col: field === 'name' ? 'name' : cv?.id || field, val: text }) }
      catch (e) { put(prev); setNotice(`Not saved: ${e.message}`) }
    },
    remove: async (item, s) => {
      subs(item.id, list => list.filter(x => x.id !== s.id))
      try { await api('delete', { item: s.id }) }
      catch (e) { subs(item.id, list => [...list, s]); setNotice(`Not deleted: ${e.message}`) }
    },
  }

  const year = new Date().getFullYear()
  const sprints = useMemo(() => boards.filter(b => sprintDates(b.name, year)).reverse(), [boards])  // newest first
  const go = (boardId, itemId) => {
    if (!boards.some(b => b.id === boardId)) return false
    if (boardId === id) setOpenId(itemId || null)
    else { wanted.current = itemId || null; location.hash = `#/${boardId}/list` }
    return true
  }

  const View = view === 'board' ? BoardView : view === 'report' ? ReportView : ListView
  const path = (v, t) => `#/${id}/${v}${t ? '/' + encodeURIComponent(t) : ''}`
  const tabs = [['List', 'list'], ['Board', 'board'], ['Sprint Reporting', 'report'], ...teams.map(t => [t, 'board', t])]

  return (
    <div className="flex h-screen max-md:h-auto max-md:flex-col">
      <aside aria-label="Spaces" className="w-64 flex-none overflow-auto border-r border-line bg-panel/70 p-3 backdrop-blur max-md:max-h-[40vh] max-md:w-auto">
        <p className="mb-3 flex items-center gap-2 px-2 text-[13px] font-semibold tracking-wide">
          <span className="size-5 rounded-md bg-linear-to-br from-accent to-accent2 shadow-lg shadow-accent/40" />Cuma
          <button onClick={flip} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className="ml-auto grid size-7 place-items-center rounded-md text-base text-dim hover:bg-raise hover:text-ink">{theme === 'light' ? '☾' : '☀'}</button>
        </p>
        {nav && <>
          {nav.folders.map(f => [f, boards.filter(b => b.board_folder_id === f.id)]).filter(x => x[1].length)
            .map(([f, list]) => <Folder key={f.id} name={f.name} boards={list} current={id} />)}
          {boards.filter(b => !b.board_folder_id).map(b => <BoardLink key={b.id} board={b} current={id} />)}
        </>}
        <button onClick={() => saveKey('')} title="Removes your monday API key from this browser"
          className="mt-4 w-full rounded-md px-2 py-1.5 text-left text-dim hover:bg-raise hover:text-ink">Sign out</button>
        <a href={REPO} target="_blank" rel="noopener" className="block rounded-md px-2 py-1.5 text-dim hover:bg-raise hover:text-ink">GitHub · pull requests welcome</a>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto px-6 pb-10 pt-4">
        <GlobalSearch boards={boards} onGo={go} />
        {error ? <p role="alert" className="py-6 text-danger">{error}</p> : !board ? <Skeleton /> : (
          <>
            <Header board={board} folder={folder} today={today} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-line">
              <nav aria-label="Views" className="flex flex-wrap">
                {tabs.map(([label, v, t]) => {
                  // a team tab is the board of that team; List and Sprint Reporting keep the team picked in the filter
                  const active = t ? view === 'board' && team === t : view === v && !(team && v === 'board')
                  return (
                    <a key={label} href={path(v, t || (v === 'board' ? '' : team))} aria-current={active ? 'page' : undefined}
                      className={`relative px-3 py-2 ${active ? 'text-ink' : 'text-dim hover:text-ink'}`}>
                      {label}
                      {active && <motion.span layoutId="tab-active" className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-linear-to-r from-accent to-accent2" />}
                    </a>
                  )
                })}
              </nav>
              <div className="mb-1.5 flex flex-wrap gap-2">
                {teams.length > 0 && (
                  <select aria-label="Team" value={team || ''} onChange={e => { location.hash = path(view, e.target.value) }}
                    className="rounded-lg border border-line bg-panel px-2 py-1.5 outline-none focus:border-accent">
                    <option value="">All teams</option>
                    {teams.map(t => <option key={t}>{t}</option>)}
                  </select>
                )}
                <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks or assignees" aria-label="Search tasks"
                  className="w-64 rounded-lg border border-line bg-panel px-3 py-1.5 outline-none focus:border-accent" />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={view + (team || '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
                <View items={items} today={today} onOpen={setOpenId} onChange={change} onCreate={create} />
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>

      <AnimatePresence>
        {openItem && <TaskPanel key={openItem.id} board={board} item={openItem} onChange={change} onRemove={remove} sub={sub} sprints={sprints} onPlan={plan} onGo={go} onOpenLinked={openLinked} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
      {notice && (
        <p role="alert" className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-rose-500/50 bg-panel px-4 py-2 text-danger shadow-xl">
          {notice}<button onClick={() => setNotice('')} aria-label="Dismiss" className="text-dim hover:text-ink">✕</button>
        </p>
      )}
    </div>
  )
}
