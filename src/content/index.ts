import { injectSidebar } from './sidebar'
import { scrapeAllCourses } from '../utils/scraper'
import { summarise } from '../utils/ai'

function isElearnPage(): boolean {
  return window.location.hostname === 'elearn.sunway.edu.my'
}

function isLoggedIn(): boolean {
  const loggedInIndicators = document.querySelector(
    '#main-content, [data-bbid="user-menu"], .bb-avatar, ' +
    '.usermenu, .logininfo a[href*="logout"], [data-region="drawer"]'
  )
  const loginForm = document.querySelector('#login, .login-form, form#login, .login-page')
  return !!loggedInIndicators && !loginForm
}

let initialized = false

function init() {
  if (!isElearnPage() || initialized) return
  if (!isLoggedIn()) {
    waitForLogin()
    return
  }

  initialized = true
  console.log('[Sunway Extension] eLearn detected, initializing...')
  injectSidebar()
  chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE', data: null })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DO_SCRAPE') {
    scrapeAllCourses()
      .then(({ courses, announcements, assignmentDeadlines }) => {
        sendResponse({ success: true, data: { courses, announcements, assignmentDeadlines } })
      })
      .catch((e) => {
        sendResponse({ success: false, error: String(e) })
      })
    return true
  }

  if (message.type === 'DO_SUMMARISE') {
    summarise(message.data as any)
      .then((results) => {
        sendResponse({ success: true, data: results })
      })
      .catch((e) => {
        sendResponse({ success: false, error: String(e) })
      })
    return true
  }

  return false
})

function waitForLogin() {
  const observer = new MutationObserver(() => {
    if (isLoggedIn() && !initialized) {
      observer.disconnect()
      init()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  let lastUrl = location.href
  const urlCheck = setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      if (isLoggedIn() && !initialized) {
        clearInterval(urlCheck)
        observer.disconnect()
        init()
      }
    }
  }, 1000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
