import { useEffect, useState } from 'react'
import { storageGet, storageSet } from '../utils/storage'
import type { AppSettings, NotificationTiming } from '../utils/types'

const TIMING_OPTIONS: { value: NotificationTiming; label: string }[] = [
  { value: '1day', label: '1 day before' },
  { value: '3days', label: '3 days before' },
  { value: '1week', label: '1 week before' },
  { value: '2weeks', label: '2 weeks before' },
]

export default function SettingsTab() {
  const [settings, setSettings] = useState<AppSettings>({
    refreshInterval: 60,
    notificationsEnabled: true,
    notificationTiming: ['1week'],
    notificationTypes: {
      deadlineReminders: true,
      newAnnouncements: true,
      urgentOnly: false,
    },
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    storageGet('settings').then((saved) => {
      if (saved) setSettings(s => ({ ...s, ...saved }))
    })
  }, [])

  async function handleSave() {
    await storageSet('settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleTiming(timing: NotificationTiming) {
    const current = settings.notificationTiming
    const updated = current.includes(timing)
      ? current.filter(t => t !== timing)
      : [...current, timing]
    setSettings({ ...settings, notificationTiming: updated })
  }

  return (
    <div className="space-y-4">
      {/* General Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <span className="text-sm font-medium text-gray-900">General</span>

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
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Notifications</span>
          <button
            onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings.notificationsEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {settings.notificationsEnabled && (
          <div className="space-y-3 pt-1">
            {/* Notification Types */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notify me about</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationTypes.deadlineReminders}
                    onChange={(e) => setSettings({
                      ...settings,
                      notificationTypes: { ...settings.notificationTypes, deadlineReminders: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Upcoming deadline reminders</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationTypes.newAnnouncements}
                    onChange={(e) => setSettings({
                      ...settings,
                      notificationTypes: { ...settings.notificationTypes, newAnnouncements: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">New announcements</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationTypes.urgentOnly}
                    onChange={(e) => setSettings({
                      ...settings,
                      notificationTypes: { ...settings.notificationTypes, urgentOnly: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">Urgent items only</span>
                </label>
              </div>
            </div>

            {/* Reminder Timing */}
            {settings.notificationTypes.deadlineReminders && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Remind me before deadline</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIMING_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => toggleTiming(opt.value)}
                      className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                        settings.notificationTiming.includes(opt.value)
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
