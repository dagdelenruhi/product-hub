import { normalize } from './logic.js'

// There is no server: the browser talks to monday directly with the user's own API key, kept in this browser only.
const URL = import.meta.env.VITE_MONDAY_URL || 'https://api.monday.com/v2'  // overridable in dev, to work against a mock
const WORKSPACE_ID = '8162750'  // monday "PRODUCT HUB" workspace

const ITEM = `
fragment I on Item {
  id name url group { id title }
  column_values { id text ... on BoardRelationValue { display_value } }
  subitems { id name board { id } column_values { id text column { title } } }
}`

const QUERIES = {
  me: 'query { me { name } }',
  nav: `query($ws: [ID!]) {
    folders(workspace_ids: $ws, limit: 100) { id name }
    boards(workspace_ids: $ws, limit: 200, state: active) { id name type board_folder_id items_count }
  }`,
  board: `query($id: [ID!]) {
    boards(ids: $id) { id name columns { id title type settings_str } items_page(limit: 200) { cursor items { ...I } } }
  }` + ITEM,
  page: 'query($cursor: String!) { next_items_page(cursor: $cursor, limit: 200) { cursor items { ...I } } }' + ITEM,
  item: 'query($id: [ID!]) { items(ids: $id) { id updates(limit: 50) { id text_body created_at creator { name } } } }',
  // shortcut: matches card names only, 10 per board; switch to monday's search API if descriptions must be searched too.
  search: `query($ids: [ID!], $q: CompareValue!) {
    boards(ids: $ids, limit: 200) {
      id items_page(limit: 10, query_params: {rules: [{column_id: "name", compare_value: $q, operator: contains_text}]}) {
        items { id name group { title } column_values(ids: ["status"]) { text } }
      }
    }
  }`,
  find: 'query($id: [ID!]) { items(ids: $id) { id board { id } parent_item { id board { id } } } }',
  users: 'query { users(limit: 1000) { id name } }',
  set: `mutation($board: ID!, $item: ID!, $col: String!, $val: String) {
    change_simple_column_value(board_id: $board, item_id: $item, column_id: $col, value: $val) { id }
  }`,
  create: `mutation($board: ID!, $group: String, $name: String!, $values: JSON) {
    create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id url }
  }`,
  subtask: `mutation($item: ID!, $name: String!, $values: JSON) {
    create_subitem(parent_item_id: $item, item_name: $name, column_values: $values) { id name board { id } column_values { id text column { title } } }
  }`,
  delete: 'mutation($item: ID!) { delete_item(item_id: $item) { id } }',  // monday keeps deleted items in its recycle bin
  archive: 'mutation($item: ID!) { archive_item(item_id: $item) { id } }',  // can be restored from the board's archive in monday
  comment: `mutation($item: ID!, $body: String!) {
    create_update(item_id: $item, body: $body) { id text_body created_at creator { name } }
  }`,
}

// The key lives in localStorage. Private windows may refuse storage; the user is then asked again after a reload.
export const savedKey = () => { try { return localStorage.monday_key || '' } catch { return '' } }
export function saveKey(key) {
  try { key ? (localStorage.monday_key = key) : localStorage.removeItem('monday_key') } catch {}
  location.reload()  // a fresh start also drops every cached board of the previous key
}

const escapeHtml = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

export async function api(name, vars = {}, key = savedKey()) {
  if (name === 'nav') vars = { ws: [WORKSPACE_ID] }
  if (name === 'search') vars = { ids: vars.ids, q: [vars.q] }
  if (name === 'comment') vars = { ...vars, body: escapeHtml(vars.body).replace(/\n/g, '<br>') }  // monday renders update bodies as HTML
  let res
  try {
    res = await fetch(URL, { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: QUERIES[name], variables: vars }) })
  } catch {
    // monday answers a refused key without CORS headers, so the browser reports it exactly like a lost connection
    throw new Error('monday did not answer. Either the API key is wrong or no longer valid, or the connection is down.')
  }
  if (res.status === 401) {
    if (key === savedKey() && key) saveKey('')  // the saved key stopped working: back to the key screen
    throw new Error('monday did not accept this API key.')
  }
  const json = await res.json().catch(() => ({ errors: [{ message: `Unexpected response (${res.status})` }] }))
  if (json.errors?.length || json.error_message) throw new Error(json.error_message || json.errors.map(e => e.message).join('; '))
  return json.data
}

const cache = {}
export const remember = board => (cache[board.id] = Promise.resolve(board), board)  // keep edits when the board is reopened

// shortcut: loads every item of a board into the browser; move filtering to monday if boards like Sprint-Ready feel slow.
export function loadBoard(id) {
  return (cache[id] ||= (async () => {
    const board = (await api('board', { id })).boards[0]
    if (!board) throw new Error('Board not found')
    let { cursor, items } = board.items_page
    while (cursor) {
      const page = (await api('page', { cursor })).next_items_page
      items = items.concat(page.items)
      cursor = page.cursor
    }
    return normalize(board, items)
  })().catch(e => { delete cache[id]; throw e }))
}
