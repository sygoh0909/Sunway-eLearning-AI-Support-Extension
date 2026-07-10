import { useEffect, useState } from 'react'
import { storageGet, storageSet } from '../utils/storage'
import { checkOllamaConnection } from '../utils/ai'
import type { AppSettings } from '../utils/types'

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>({
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    refreshInterval: 60,
    notificationsEnabled: true,
  })
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    storageGet('settings').then((saved) => {
      if (saved) setSettings(s => ({ ...s, ...saved }))
    })
    checkConnection()
  }, [])

  async function checkConnection() {
    setOllamaStatus('checking')
    const result = await checkOllamaConnection()
    setOllamaStatus(result.connected ? 'connected' : 'disconnected')
    setAvailableModels(result.models)
  }

  async function handleSave() {
    await storageSet('settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    checkConnection()
  }

  return (
    <div className="space-y-4">
      {/* Ollama Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">Ollama Status</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            ollamaStatus === 'connected' ? 'bg-green-100 text-green-700' :
            ollamaStatus === 'disconnected' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {ollamaStatus === 'checking' ? 'Checking...' :
             ollamaStatus === 'connected' ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        {ollamaStatus === 'disconnected' && (
          <p className="text-xs text-gray-500">
            Make sure Ollama is running locally. Download from ollama.com
          </p>
        )}
        {availableModels.length > 0 && (
          <p className="text-xs text-gray-500">
            Models: {availableModels.slice(0, 5).join(', ')}
          </p>
        )}
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-700">Ollama URL</label>
          <input
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm mt-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={settings.ollamaUrl}
            onChange={(e) => setSettings({ ...settings, ollamaUrl: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700">Model</label>
          {availableModels.length > 0 ? (
            <select
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm mt-1 focus:ring-1 focus:ring-blue-500"
              value={settings.ollamaModel}
              onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm mt-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={settings.ollamaModel}
              onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
            />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700">Auto-refresh interval (minutes)</label>
          <input
            type="number"
            min={5}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm mt-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={settings.refreshInterval}
            onChange={(e) => setSettings({ ...settings, refreshInterval: Math.max(5, Number(e.target.value)) })}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="notifications"
            checked={settings.notificationsEnabled}
            onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="notifications" className="text-xs font-medium text-gray-700">
            Enable deadline notifications
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
          saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}