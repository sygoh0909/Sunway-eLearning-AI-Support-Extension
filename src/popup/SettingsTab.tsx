import { useEffect, useState } from 'react'
import { storageGet, storageSet } from '../utils/storage'
import type { AppSettings } from '../utils/types'

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>({
    ollamaUrl: 'http://localhost:11434',
    refreshInterval: 60,
  })

  useEffect(() => {
    storageGet('settings').then((saved) => {
      if (saved) setSettings(saved)
    })
  }, [])

  async function handleSave() {
    await storageSet('settings', settings)
    alert('Settings saved!')
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-medium">Ollama URL</label>
        <input
          className="w-full border rounded px-2 py-1 text-sm mt-1"
          value={settings.ollamaUrl}
          onChange={(e) =>
            setSettings({ ...settings, ollamaUrl: e.target.value })
          }
        />
      </div>
      <div>
        <label className="text-sm font-medium">Refresh Interval (minutes)</label>
        <input
          type="number"
          className="w-full border rounded px-2 py-1 text-sm mt-1"
          value={settings.refreshInterval}
          onChange={(e) =>
            setSettings({ ...settings, refreshInterval: Number(e.target.value) })
          }
        />
      </div>
      <button
        onClick={handleSave}
        className="bg-blue-600 text-white rounded py-1 text-sm"
      >
        Save Settings
      </button>
    </div>
  )
}