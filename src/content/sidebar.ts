const SIDEBAR_ID = 'sunway-ext-sidebar'
const TOGGLE_ID = 'sunway-ext-toggle'

export function injectSidebar() {
  if (document.getElementById(SIDEBAR_ID)) return

  const sidebar = document.createElement('div')
  sidebar.id = SIDEBAR_ID
  Object.assign(sidebar.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '420px',
    height: '100vh',
    zIndex: '99999',
    border: 'none',
    boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
    transition: 'transform 0.3s ease',
    transform: 'translateX(100%)',
    background: '#f9fafb',
  })

  const iframe = document.createElement('iframe')
  iframe.src = chrome.runtime.getURL('src/popup/index.html?mode=sidebar')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
  })
  sidebar.appendChild(iframe)
  document.body.appendChild(sidebar)

  const toggle = document.createElement('button')
  toggle.id = TOGGLE_ID
  toggle.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
  `
  Object.assign(toggle.style, {
    position: 'fixed',
    top: '50%',
    right: '0px',
    transform: 'translateY(-50%)',
    zIndex: '100000',
    width: '36px',
    height: '36px',
    borderRadius: '8px 0 0 8px',
    backgroundColor: '#2563eb',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
    transition: 'right 0.3s ease',
  })

  let isOpen = false
  function toggleSidebar() {
    isOpen = !isOpen
    sidebar.style.transform = isOpen ? 'translateX(0)' : 'translateX(100%)'
    toggle.style.right = isOpen ? '420px' : '0px'
  }

  toggle.addEventListener('click', toggleSidebar)
  document.body.appendChild(toggle)

  // Auto-open sidebar after a short delay on first load
  setTimeout(() => {
    toggleSidebar()
  }, 800)
}
