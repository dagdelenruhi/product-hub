import { useEffect, useState } from 'react'
import { animate, AnimatePresence, motion } from 'motion/react'
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { byAssignee, byStatus, FINDING, opsParts, subField, hashColor, isDone, key, listGroups, points, stats, statusColor } from './logic.js'
import { AddTask, Avatars, Due, Flag, Panel, Pill, Tags } from './ui.jsx'

const COLS = 'grid grid-cols-[minmax(0,1fr)_110px_80px_100px_60px] items-center gap-3 px-3'
const TIP = { background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 12 }
const Subtasks = ({ item }) => {
  const found = opsParts(item.subitems)[FINDING].filter(s => !isDone(subField(s, 'status'))).length  // open findings only
  return item.subitems.length > 0 && (
    <span className="whitespace-nowrap text-xs text-dim">⑂ {item.subitems.length}
      {found > 0 && <span className="ml-1.5 font-medium text-danger" title="Open test findings">🐞 {found}</span>}</span>
  )
}

function CountUp({ value }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const run = animate(0, value, { duration: 0.8, ease: 'easeOut', onUpdate: v => setN(Math.round(v)) })
    return () => run.stop()
  }, [value])
  return n
}

// ---------- list ----------

function Group({ status, rows, today, onOpen, onCreate }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="mt-5">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 py-1">
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-dim">▸</motion.span>
        <Pill status={status} /><span className="text-xs text-dim">{rows.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className={`${COLS} py-1.5 text-xs text-dim`}>
              <span>Name</span><span>Assignee</span><span>Due date</span><span>Priority</span><span>Points</span>
            </div>
            {rows.map(it => (
              <button key={it.id} onClick={() => onOpen(it.id)}
                className={`${COLS} w-full border-t border-line py-2 text-left transition-colors hover:bg-raise`}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{it.name}</span><Tags text={it.f.tags} /><Subtasks item={it} />
                </span>
                <Avatars names={it.f.assignee} />
                <span><Due item={it} today={today} /></span>
                <span><Flag priority={it.f.priority} /></span>
                <span>{points(it) || ''}</span>
              </button>
            ))}
            <AddTask onCreate={name => onCreate(name, status)} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export function ListView({ items, today, onOpen, onCreate }) {
  const s = stats(items, today)
  const cards = [
    ['Backlog', `${s.total} tasks added`, '#8b5cf6'],
    ['Assigned', `${s.total ? Math.round(s.assigned / s.total * 100) : 0}% assigned`, '#22d3ee'],
    ['Effort', `${s.notEstimated} tasks missing effort`, '#f5a524'],
  ]
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-3">
        {cards.map(([title, text, c], i) => (
          <motion.div key={title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
            className="min-w-52 rounded-xl border border-line bg-panel/80 px-4 py-3" style={{ boxShadow: `inset 3px 0 0 ${c}` }}>
            <b className="block">{title}</b><span className="text-dim">{text}</span>
          </motion.div>
        ))}
      </div>
      {listGroups(items).map(([status, rows]) => <Group key={key(status)} status={status} rows={rows} today={today} onOpen={onOpen} onCreate={onCreate} />)}
      {items.length === 0 && <><p className="py-6 text-dim">No tasks match.</p><AddTask onCreate={name => onCreate(name, '')} /></>}
    </>
  )
}

// ---------- board ----------

// shortcut: native drag and drop, so no touch dragging and Firefox may not drag a button; the status menu in the task panel always works.
export function BoardView({ items, today, onOpen, onChange, onCreate }) {
  const many = items.length > 300  // skip entrance animations on huge boards
  const [fold, setFold] = useState({})  // columns folded or opened by hand; untouched ones fold to a narrow strip only while empty
  return (
    <div className="mt-4 flex items-start gap-3 overflow-x-auto pb-4">
      {byStatus(items, true).map(([status, cards]) => {
        const c = statusColor(status), k = key(status), folded = fold[k] ?? cards.length === 0
        const drop = {
          onDragOver: e => e.preventDefault(),
          onDrop: e => { const it = items.find(x => x.id === e.dataTransfer.getData('text/plain')); if (it) onChange(it, 'status', status) },
        }
        const toggle = () => setFold(f => ({ ...f, [k]: !folded }))
        if (folded) return (
          <section key={k} aria-label={status || 'No status'} {...drop} className="flex-none rounded-xl border border-line" style={{ borderTopColor: c }}>
            <button onClick={toggle} aria-expanded={false} title="Expand column"
              className="flex min-h-40 items-center gap-2 px-2 py-3 text-[11px] font-semibold uppercase tracking-wide text-dim [writing-mode:vertical-rl] hover:text-ink">
              <span className="size-2 rounded-full" style={{ background: c }} />{status || 'No status'}<span>{cards.length}</span>
            </button>
          </section>
        )
        return (
          <section key={k} aria-label={status || 'No status'} {...drop} className="w-[270px] flex-none rounded-xl border border-line p-2"
            style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${c} 14%, transparent), transparent 160px)`, borderTopColor: c }}>
            <h3 className="mb-2 flex items-center gap-2 px-1"><Pill status={status} /><span className="text-xs text-dim">{cards.length}</span>
              <button onClick={toggle} aria-expanded title="Collapse column" className="ml-auto px-1 text-dim hover:text-ink">⇤</button></h3>
            {cards.map((it, i) => (
              <div key={it.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', it.id)} className="mb-2">
              <motion.button onClick={() => onOpen(it.id)}
                initial={many ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
                whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                className="grid w-full gap-2 rounded-lg border border-line bg-panel/90 p-3 text-left shadow-md shadow-black/15 hover:border-accent/60">
                <span className="font-semibold leading-snug">{it.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <Avatars names={it.f.assignee} /><Due item={it} today={today} /><Flag priority={it.f.priority} />
                  {points(it) > 0 && <span className="text-dim">◎ {points(it)}</span>}
                </span>
                {(it.f.tags || it.subitems.length > 0) && (
                  <span className="flex flex-wrap items-center gap-1.5"><Tags text={it.f.tags} /><Subtasks item={it} /></span>
                )}
              </motion.button>
              </div>
            ))}
            <AddTask onCreate={name => onCreate(name, status)} />
          </section>
        )
      })}
    </div>
  )
}

// ---------- reporting ----------

function Donut({ title, data }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  return (
    <Panel title={title}>
      {total === 0 ? <p className="text-dim">No data.</p> : (
        <div className="flex items-center gap-4">
          <div className="size-44 flex-none">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={1} stroke="none">
                  {data.map(d => <Cell key={d.name} fill={hashColor(d.name)} />)}
                </Pie>
                <Tooltip contentStyle={TIP} itemStyle={{ color: 'var(--color-ink)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="max-h-44 flex-1 overflow-auto pr-1">
            {data.map(d => (
              <li key={d.name} className="flex items-center gap-2 py-0.5">
                <i className="size-2.5 flex-none rounded-sm" style={{ background: hashColor(d.name) }} />
                <span className="truncate">{d.name}</span>
                <b className="ml-auto font-normal text-dim">{(d.value / total * 100).toFixed(1)}%</b>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

export function ReportView({ items, today }) {
  const s = stats(items, today)
  const donePoints = items.filter(it => isDone(it.f.status)).reduce((a, it) => a + points(it), 0)
  const workload = byStatus(items, true).map(([status, list]) => ({ name: status || 'No status', value: list.length, color: statusColor(status) }))
  const counters = [['Total Tasks', s.total, '#a78bfa'], ['Not Started', s.notStarted, '#94a3b8'], ['Overdue', s.overdue, '#fb7185'], ['Completed', s.completed, '#4ade80']]
  return (
    <div className="mt-4 grid gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {counters.map(([label, n, c], i) => (
          <motion.div key={label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.06 } }}>
            <Panel title={label}><p className="text-center text-4xl font-semibold" style={{ color: c }}><CountUp value={n} /></p></Panel>
          </motion.div>
        ))}
      </div>
      <Panel title="Sprint Burndown">
        <div className="h-2.5 overflow-hidden rounded-full bg-raise">
          <motion.div className="h-full rounded-full bg-linear-to-r from-accent to-accent2"
            initial={{ width: 0 }} animate={{ width: `${s.points ? donePoints / s.points * 100 : 0}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
        </div>
        <p className="mt-2 text-dim">{donePoints} of {s.points} pts completed. monday keeps no daily point history, so the day-by-day burndown line cannot be drawn yet.</p>
      </Panel>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-3">
        <Donut title="Sprint Points by Assignee" data={byAssignee(items, points)} />
        <Donut title="Tasks by Assignee" data={byAssignee(items, () => 1)} />
      </div>
      <Panel title="Workload by Status">
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={workload} margin={{ top: 20 }}>
              <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={{ fill: 'var(--color-dim)', fontSize: 11 }} />
              <Tooltip contentStyle={TIP} itemStyle={{ color: 'var(--color-ink)' }} cursor={{ fill: 'color-mix(in srgb, var(--color-ink) 5%, transparent)' }} />
              <Bar dataKey="value" name="Tasks" radius={[6, 6, 0, 0]}>
                {workload.map(d => <Cell key={d.name} fill={d.color} />)}
                <LabelList dataKey="value" position="top" fill="var(--color-ink)" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  )
}
