// 420px sidebar panel injected into eLearn pages

const SIDEBAR_ID = 'sunway-ext-sidebar'
const TOGGLE_ID  = 'sunway-ext-toggle'

/** Creates a fixed 420px sidebar panel with a toggle button. Safe to call multiple times — checks for existing instance first. */
export function injectSidebar(): void {
  if (document.getElementById(SIDEBAR_ID)) return

  const iframe = document.createElement('iframe')
  iframe.id  = SIDEBAR_ID
  iframe.src = chrome.runtime.getURL('src/popup/index.html')
  iframe.style.cssText = [
    'position:fixed',
    'top: 0',
    'right: 0',
    'width: 420px',
    'height: 100vh',
    'border: none',
    'z-index: 999999',
    'display: none',
    'box-shadow: -2px 0 8px rgba(0,0,0,0.25)',
  ].join(';')

  const toggle = document.createElement('button')
  toggle.id    = TOGGLE_ID
  toggle.title = 'Toggle Sunway Extension'
  toggle.style.cssText = [
    'position:fixed',
    'top:50%',
    'right:0',
    'transform:translateY(-50%)',
    'z-index:1000000',
    'width:24px',
    'height:48px',
    'background:#003399',
    'color:#fff',
    'border:none',
    'cursor:pointer',
    'border-radius:4px 0 0 4px',
    'font-size:16px',
    'line-height:1',
  ].join(';')
  toggle.textContent = '❯'

  toggle.addEventListener('click', () => {
    const open = iframe.style.display === 'none'
    iframe.style.display    = open ? 'block' : 'none'
    toggle.style.right      = open ? '420px' : '0'
    toggle.textContent      = open ? '❮' : '❯'
  })

  document.body.appendChild(iframe)
  document.body.appendChild(toggle)
}
