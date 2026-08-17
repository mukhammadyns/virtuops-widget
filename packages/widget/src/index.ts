// Register web component
import './web-component/index'

// Public types
export type { WidgetConfig, Message, ChatProps } from './types'
export { ChatWidget } from './components/ChatWidget'

// IIFE global API — auto-init from declarative config and expose window.VirtuOpsWidget
type ThemeOverride = 'light' | 'dark' | 'auto'

declare global {
  interface Window {
    VirtuOps?: { token: string; apiUrl?: string; theme?: ThemeOverride }
    VirtuOpsWidget?: {
      init(opts: { token: string; apiUrl?: string; theme?: ThemeOverride }): void
    }
  }
}

function initWidget(token: string, apiUrl?: string, theme?: ThemeOverride) {
  const el = document.createElement('virtuops-chat')
  el.setAttribute('token', token)
  if (apiUrl) el.setAttribute('api-url', apiUrl)
  if (theme) el.setAttribute('theme', theme)
  document.body.appendChild(el)
}

/** Programmatic mount. In the IIFE build this lands on `window.VirtuOpsWidget`
 *  as a module export — assigning to that global here would not survive, since
 *  the bundle overwrites it with the export object once the script finishes. */
export function init(opts: {
  token: string
  apiUrl?: string
  theme?: ThemeOverride
}) {
  initWidget(opts.token, opts.apiUrl, opts.theme)
}

// Declarative: <script>window.VirtuOps = { token: "wgt_xxx" }</script>
function tryAutoInit() {
  if (window.VirtuOps?.token) {
    initWidget(
      window.VirtuOps.token,
      window.VirtuOps.apiUrl,
      window.VirtuOps.theme,
    )
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryAutoInit)
} else {
  tryAutoInit()
}
