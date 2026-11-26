import test from 'node:test'
import assert from 'node:assert/strict'
import { byAssignee, byStatus, labelOptions, linkTarget, looksLikeMarkdown, opsParts, listGroups, normalize, sprintDates, sprintState, stats, statusRank, STATUS_ORDER } from './logic.js'

const item = (status, extra = {}) => ({ f: { status, assignee: '', 'sprint points': '', 'due date': '', ...extra } })

test('sprint dates and state come from the board name', () => {
  const d = sprintDates('Sprint 14 (16/11 - 30/11)', 2026)
  assert.deepEqual([d.start.getMonth(), d.start.getDate(), d.end.getDate()], [10, 16, 30])
  assert.equal(sprintDates('Roadmap 2026', 2026), null)
  assert.equal(sprintState(d, new Date(2026, 10, 20)), 'In progress')
  assert.equal(sprintState(d, new Date(2026, 11, 1)), 'Done')
})

test('stats count started, overdue, completed and estimated work', () => {
  const s = stats([
    item('completed', { 'sprint points': '3', assignee: 'A', 'due date': '2026-11-01' }),
    item('backlog', { 'due date': '2026-11-01' }),
  ], new Date(2026, 10, 20))
  assert.deepEqual(s, { total: 2, notStarted: 1, overdue: 1, completed: 1, points: 3, notEstimated: 1, assigned: 1 })
})

test('status groups follow the sprint flow and can keep empty columns', () => {
  assert.ok(statusRank('In Review') < statusRank('completed'))
  const items = [item('completed'), item('Open'), item('')]
  assert.deepEqual(byStatus(items).map(g => g[0]), ['Open', 'completed', ''])
  assert.equal(byStatus(items, true).length, STATUS_ORDER.length + 1)
  assert.deepEqual(byStatus([item('idea')], true).map(g => g[0]), ['idea'])  // other flows are not padded
  assert.deepEqual(listGroups([...items, item('in test')]).map(g => g[0]), ['in test', 'Open', '', 'completed'])
})

test('normalize maps columns by title, drops archived groups and falls back to the ClickUp assignee', () => {
  const board = { id: '1', name: 'B', columns: [{ id: 'x1', title: '🛠 Release Status' }, { id: 'a', title: 'Assignee' }, { id: 'c', title: 'ClickUp assignee' }] }
  const raw = [
    { id: '1', name: 'kept', group: { title: 'Sprint' }, column_values: [{ id: 'x1', text: 'Blocked' }, { id: 'a', text: '' }, { id: 'c', text: 'Ann' }] },
    { id: '2', name: 'gone', group: { title: 'Archived (ClickUp)' }, column_values: [] },
  ]
  const b = normalize(board, raw)
  assert.equal(b.items.length, 1)
  assert.equal(b.items[0].f['release status'], 'Blocked')
  assert.equal(b.items[0].f.assignee, 'Ann')
})

test('assignee totals split shared tasks and label the unassigned', () => {
  const rows = byAssignee([item('Open', { assignee: 'A, B' }), item('Open', { assignee: 'A' }), item('Open')], () => 1)
  assert.deepEqual(rows, [{ name: 'A', value: 2 }, { name: 'B', value: 1 }, { name: 'Unassigned', value: 1 }])
})

test('write metadata: column ids, label choices and the group new tasks go to', () => {
  const board = { id: '1', name: 'B', columns: [
    { id: 's', title: 'Status', type: 'status', settings_str: '{"labels":{"0":"Done","9":"completed","10":"Open"}}' },
    { id: 'p', title: 'Phase', type: 'status', settings_str: '{"labels":{"0":"Idea"}}' },
  ] }
  const raw = ['g1', 'g2', 'g2'].map((g, i) => ({ id: String(i), name: 'x', group: { id: g, title: g }, column_values: [] }))
  const b = normalize(board, raw)
  assert.equal(b.ids.status, 's')
  assert.equal(b.group, 'g2')
  assert.deepEqual(labelOptions(b, 'status', STATUS_ORDER), ['Open', 'completed'])
  assert.deepEqual(labelOptions(b, 'phase', STATUS_ORDER), ['Idea'])
})

test('subtasks split into operational parts by their monday tag', () => {
  const sub = (id, tags) => ({ id, column_values: [{ id: 'tags_text', text: tags, column: { title: 'Tags' } }] })
  const p = opsParts([sub('1', 'SQL'), sub('2', 'x, script'), sub('3', ''), { id: '4', column_values: [] }, sub('5', 'Test')])
  assert.deepEqual(p.test.map(s => s.id), ['5'])
  assert.deepEqual([p.sql, p.script, p.rest].map(l => l.map(s => s.id)), [['1'], ['2'], ['3', '4']])
})

test('pasted monday links and ids are told apart from search text', () => {
  assert.deepEqual(linkTarget('https://acme.monday.com/boards/123456/pulses/987654?x=1'), { item: '987654', board: '123456' })
  assert.deepEqual(linkTarget('https://acme.monday.com/boards/123456'), { item: undefined, board: '123456' })
  assert.deepEqual(linkTarget('5108090224'), { item: '5108090224' })
  assert.equal(linkTarget('crawler 502'), null)
  assert.equal(linkTarget('https://example.com/boards/1/pulses/2'), null)
})

test('looksLikeMarkdown spots markdown marks and leaves plain prose alone', () => {
  for (const md of ['# Title', 'text\n- item', '1. first', 'a **bold** word', 'see [docs](https://x.y)', '```\ncode']) assert.ok(looksLikeMarkdown(md), md)
  for (const plain of ['Just a sentence.', 'a * b - c', 'price is 3.5']) assert.ok(!looksLikeMarkdown(plain), plain)
})
