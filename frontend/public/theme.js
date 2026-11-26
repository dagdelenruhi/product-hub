// The saved choice, else the system setting.
try { document.documentElement.dataset.theme = localStorage.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') } catch {}
