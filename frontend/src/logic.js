// Pure data helpers: no React, no DOM. Covered by logic.test.js.

// Sprint flow in ClickUp's order and colours. monday's own label colours differ, so we key by label text.
export const STATUS_COLOR = {
  'backlog': '#87909e', 'sprint-planned': '#ffc53d', 'open': '#94a3b8', 'in progress': '#0091ff',
  'in review': '#ab4aba', 'in test': '#f76808', 'test completed': '#5b7cfa', 'in release': '#12a594',
  'completed': '#22c55e',
}
export const STATUS_ORDER = Object.keys(STATUS_COLOR)
const NOT_STARTED = ['backlog', 'sprint-planned']
const DONE = ['completed', 'complete', 'done', 'closed', 'shipped']
export const PRIORITY_COLOR = { urgent: '#f43f5e', high: '#f5a524', normal: '#60a5fa', low: '#87909e' }

export const key = s => (s || '').trim().toLowerCase()
const norm = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const split = s => (s || '').split(',').map(x => x.trim()).filter(Boolean)
export const hashColor = s => `hsl(${[...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360} 65% 55%)`
export const statusColor = s => STATUS_COLOR[key(s)] || (s ? hashColor(s) : '#87909e')
export const statusRank = s => { const i = STATUS_ORDER.indexOf(key(s)); return i < 0 ? STATUS_ORDER.length : i }
export const isDone = s => DONE.includes(key(s))
export const points = it => Number(it.f['sprint points']) || 0
export const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
export const localDate = s => (s ? new Date(s.slice(0, 10) + 'T00:00') : null)
export const isOverdue = (it, today) => !!it.f['due date'] && localDate(it.f['due date']) < today && !isDone(it.f.status)
export const safeUrl = u => (/^https:\/\//.test(u || '') ? u : null)

export function groupBy(list, fn) {
  const map = new Map()
  for (const x of list) for (const k of [].concat(fn(x))) map.set(k, [...(map.get(k) || []), x])
  return map
}

// shortcut: sprint names carry day/month only, so the current year is assumed; read real dates once monday stores them.
export function sprintDates(name, year) {
  const m = name.match(/\((\d+)\/(\d+)\s*-\s*(\d+)\/(\d+)\)/)
  return m && { start: new Date(year, m[2] - 1, m[1]), end: new Date(year, m[4] - 1, m[3], 23, 59, 59) }
}
export const sprintState = (d, now) => (now < d.start ? 'Not started' : now > d.end ? 'Done' : 'In progress')

export function stats(items, today) {
  return {
    total: items.length,
    notStarted: items.filter(it => NOT_STARTED.includes(key(it.f.status))).length,
    overdue: items.filter(it => isOverdue(it, today)).length,
    completed: items.filter(it => isDone(it.f.status)).length,
    points: items.reduce((a, it) => a + points(it), 0),
    notEstimated: items.filter(it => !points(it)).length,
    assigned: items.filter(it => it.f.assignee).length,
  }
}

// Columns are looked up by title because monday column ids differ from board to board.
export function normalize(board, items) {
  const title = Object.fromEntries(board.columns.map(c => [c.id, norm(c.title)]))
  const kept = items.filter(it => !/^archived/i.test(it.group?.title || ''))
  return {
    id: board.id,
    name: board.name,
    titles: Object.fromEntries(board.columns.map(c => [norm(c.title), c.title])),
    ids: Object.fromEntries(board.columns.map(c => [norm(c.title), c.id])),
    labels: Object.fromEntries(board.columns.filter(c => c.type === 'status')
      .map(c => [norm(c.title), Object.values(JSON.parse(c.settings_str || '{}').labels || {})])),
    group: [...groupBy(kept, it => it.group?.id)].sort((a, b) => b[1].length - a[1].length)[0]?.[0],  // new tasks go where most tasks are
    items: kept.map(it => {
      const f = {}, links = {}  // links: ids of the cards a connect-boards column points to
      for (const cv of it.column_values) {
        f[title[cv.id] || cv.id] = cv.display_value || cv.text || ''
        if (cv.linked_item_ids?.length) links[title[cv.id] || cv.id] = cv.linked_item_ids
      }
      f.assignee ||= f['clickup assignee'] || ''  // people not matched to a monday user during the migration
      return { id: it.id, name: it.name, url: it.url, f, links, subitems: it.subitems || [] }
    }),
  }
}

// Choices for a status-type column: the known flow in its order; boards with other labels offer them all.
export function labelOptions(board, k, known) {
  const all = board.labels[k] || [], flow = all.filter(l => known.includes(key(l)))
  return flow.length ? flow.sort((a, b) => known.indexOf(key(a)) - known.indexOf(key(b))) : all
}

// pad: also return the sprint-flow statuses nobody is in, so boards and charts keep their empty columns like ClickUp.
export function byStatus(items, pad) {
  const groups = groupBy(items, it => key(it.f.status))
  if (pad && STATUS_ORDER.some(s => groups.has(s))) for (const s of STATUS_ORDER) groups.has(s) || groups.set(s, [])
  return [...groups].map(([k, list]) => [list[0]?.f.status || k, list]).sort((a, b) => statusRank(a[0]) - statusRank(b[0]))
}

// ClickUp lists the furthest-along work first and closed work last; labels outside the flow sort with the earliest stage.
export function listGroups(items) {
  const rank = s => statusRank(s) % STATUS_ORDER.length
  return byStatus(items).sort((a, b) => isDone(a[0]) - isDone(b[0]) || rank(b[0]) - rank(a[0]))
}

export function byAssignee(items, value) {
  return [...groupBy(items, it => { const a = split(it.f.assignee); return a.length ? a : ['Unassigned'] })]
    .map(([name, list]) => ({ name, value: list.reduce((a, it) => a + value(it), 0) }))
    .filter(g => g.value > 0).sort((a, b) => b.value - a.value)
}

// Operational work is a subtask whose Tags column in monday holds one of these tags.
export const OPS = { script: 'Operational script', sql: 'SQL' }
export const FINDING = 'test'  // tag of a subtask that records what testing found
export const subField = (sub, title) => sub.column_values.find(c => key(c.column?.title || c.id) === title)?.text || ''
export function opsParts(subitems) {
  const tags = [...Object.keys(OPS), FINDING]
  const tag = sub => tags.find(t => split(subField(sub, 'tags')).map(key).includes(t))
  return { ...Object.fromEntries(tags.map(t => [t, subitems.filter(s => tag(s) === t)])), rest: subitems.filter(s => !tag(s)) }
}

// A pasted monday link (or a bare item id) names a card or a board; anything else is a text search.
export function linkTarget(text) {
  if (/^\d{6,}$/.test(text)) return { item: text }
  if (!/^https?:\/\/\S*monday\.com\//.test(text)) return null
  const item = text.match(/\/pulses\/(\d+)/)?.[1], board = text.match(/\/boards\/(\d+)/)?.[1]
  return item || board ? { item, board } : null
}

// Pasted text that came with formatting is only re-read as markdown when it carries markdown marks (editors like VS Code copy both).
export const looksLikeMarkdown = text => /^\s{0,3}(#{1,6} |[-*+] |\d+[.)] |> |```)|\*\*\S|\[[^\]]+\]\([^)]+\)/m.test(text)

// Planning a Sprint-Ready card into a sprint makes a copy on the sprint board that points back to it, as the migrated boards do.
// source: the card with raw column values; target: the sprint board's groups and columns. Columns are paired by title and type.
// Labels are matched without regard to case and left out when the sprint board lacks them, so no stray labels get created there.
// shortcut: files, docs and subtasks are not copied; copy them too if sprint cards must carry them.
const COPIED = ['people', 'date', 'long_text', 'text', 'numbers', 'link']
export function sprintCopy(source, target) {
  const values = {}
  for (const t of target.columns) {
    const settings = JSON.parse(t.settings_str || '{}')
    const pick = name => Object.values(settings.labels || {}).map(l => l.name ?? l).find(l => key(l) === key(name))
    const s = source.column_values.find(c => norm(c.column.title) === norm(t.title) && c.type === t.type)
    if (t.type === 'board_relation') {
      if ((settings.boardIds || []).map(String).includes(source.board.id)) values[t.id] = { item_ids: [Number(source.id)] }
    } else if (!s) continue
    else if (t.type === 'status') {
      const label = pick(s.text || '') || (norm(t.title) === 'status' && pick('sprint-planned'))
      if (label) values[t.id] = { label }
    } else if (t.type === 'dropdown') {
      const labels = [...new Set(split(s.text).map(pick).filter(Boolean))]
      if (labels.length) values[t.id] = { labels }
    } else if (COPIED.includes(t.type) && s.value) {
      const v = JSON.parse(s.value)
      if (v && typeof v === 'object') delete v.changed_at
      values[t.id] = v
    }
  }
  const group = (target.groups.find(g => g.title === target.name) || target.groups.find(g => !/^archived/i.test(g.title)))?.id
  return { group, values, linked: Object.values(values).some(v => v?.item_ids) }
}
