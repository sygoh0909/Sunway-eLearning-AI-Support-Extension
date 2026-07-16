// Entry point for the content script
if (window.location.hostname === 'elearn.sunway.edu.my') {
  console.log('[Sunway Extension] Content script loaded')
}

import { scrapeAllCourses } from '../utils/scraper'
import { injectSidebar } from './sidebar'

// checks we're actually on eLearn before doing anything
function isElearnPage(): boolean {
  return window.location.hostname === 'elearn.sunway.edu.my'
}

// checks DOM for logged-in elements vs login form
function isLoggedIn(): boolean {
  const loggedInIndicators = document.querySelector(
    '#main-content, [data-bbid="user-menu"], .bb-avatar, ' +
    '.usermenu, .logininfo a[href*="logout"], [data-region="drawer"]'
  )
  const loginForm = document.querySelector('#login, .login-form, form#login, .login-page')
  return !!loggedInIndicators && !loginForm
}

let initialized = false

// injects the sidebar and tells background to start scraping
// uses initialized flag so it never runs twice
function init() {
  if (!isElearnPage() || initialized) return
  if (!isLoggedIn()) { 
    waitForLogin(); 
    return 
  }

  initialized = true
  injectSidebar()
  chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE', data: null })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'DO_SCRAPE') {
    // background sent us DO_SCRAPE — run the full scrape and reply
    scrapeAllCourses()
      .then(({ courses, announcements, assignmentDeadlines }) => {
        sendResponse({ success: true, data: { courses, announcements, assignmentDeadlines } })
      })
      .catch((e) => {
        sendResponse({ success: false, error: String(e) })
      })
    return true  // tells Chrome we'll respond asynchronously
  }
  return false
})

function waitForLogin() {
  // watches DOM mutations + URL changes until login is detected, then calls init()
  const observer = new MutationObserver(() => { 
    if (isLoggedIn() && !initialized) { 
      observer.disconnect()
      init()
    } 
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // also polls URL every 1s in case of SPA navigation
  let lastUrl = location.href
  const urlCheck = setInterval(() => {
    if (location.href != lastUrl) {
      lastUrl = location.href
      if (isLoggedIn() && !initialized) {
        clearInterval(urlCheck)
        observer.disconnect()
        init()
      }
    }
  }, 1000)
}

// entry — runs on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
