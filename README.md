# Cuma

A ClickUp-style sprint board for the monday.com "PRODUCT HUB" workspace: list, board and sprint-report views, card details with
subtasks, test findings, operational work (scripts and SQL), comments, and a search across all boards.

It is a static site with no server. Each person signs in with their own monday API key. The key is saved in that browser only
and is sent to `api.monday.com` and nowhere else, so every change carries the name and the rights of the person who made it.

## Use

Open the published page, paste your monday API key (monday → profile picture → Developers → My access tokens) and continue.
"Sign out" in the sidebar removes the key from the browser.

## Develop

```sh
cd frontend
npm install
npm run dev     # local page with live reload
npm test        # unit tests for the board logic
npm run build   # production build in frontend/dist
```

Every push to `main` runs the tests and publishes `frontend/dist` to GitHub Pages (`.github/workflows/pages.yml`).

## Contribute

Pull requests are welcome at https://github.com/dagdelenruhi/cuma. Run `npm test` and `npm run build` in `frontend/` before opening one;
the same two commands run on every push.

## Notes

- The workspace id is set in `frontend/src/api.js`. Columns are found by their title and status labels by their text.
- Subtasks tagged `script` or `sql` appear under "Operational work", subtasks tagged `test` under "Test findings".
- The published page carries a content security policy that only allows connections to `api.monday.com`.
