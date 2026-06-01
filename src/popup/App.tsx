import { useState } from 'react'
import DeadlineTab from './DeadlineTab'
import SettingsTab from './SettingsTab'

type Tab = 'summary' | 'deadlines' | 'settings'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('summary')

  return (
    <div className="w-80 p-4">
      <h1 className="text-lg font-bold mb-3">Sunway Learning Support</h1>
      <div className="flex gap-2 mb-4">
        {(['summary', 'deadlines', 'settings'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 rounded text-sm capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab === 'summary' && <div>Summary coming soon</div>}
      {activeTab === 'deadlines' && <DeadlineTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  )
}