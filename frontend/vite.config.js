import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The published page may only load its own files and talk to monday, so a stray script cannot send the API key elsewhere.
// Styles need 'unsafe-inline' because the animation and chart libraries set inline styles. Left out in dev, where Vite injects scripts.
const CSP = "default-src 'self'; connect-src https://api.monday.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'"
const csp = { name: 'csp', apply: 'build', transformIndexHtml: html => html.replace('<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`) }

// A static site with no server: relative paths let it run from any folder, such as a GitHub Pages project page.
export default defineConfig({ plugins: [react(), tailwindcss(), csp], base: './' })
