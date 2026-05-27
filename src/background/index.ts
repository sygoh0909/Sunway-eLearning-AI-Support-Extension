import { initStorage } from '../utils/storage'

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Sunway Extension] Installed')
  await initStorage()
})

export {}

