import type { Announcement, SummarisedAnnouncement } from './types'
import { getSettings } from './storage'
import { extractDeadlines } from './deadlines'

async function callOllama(prompt: string, ollamaUrl: string, model: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 120 },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`)
    }

    const data = await response.json()
    return data.response?.trim() ?? ''
  } finally {
    clearTimeout(timeout)
  }
}

function buildSummaryPrompt(announcement: Announcement): string {
  const body = announcement.body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const truncated = body.length > 600 ? body.slice(0, 600) : body
  return `You are a student assistant. Extract the important content from this announcement. Keep the original wording but remove all fluff.

REMOVE:
- Greetings: "Dear students", "Hi all", "Good morning"
- Sign-offs: "Thank you", "Regards", "Stay blessed", "Have a nice day"
- Filler: "Please be informed that", "Kindly note that", "This is to inform you"

KEEP (in original wording):
- What's happening (test, submission, event, class change)
- Requirements (bring laptop, prepare, etc.)
- Warnings (no retake, no late submission, etc.)
- Dates, times, locations

EXAMPLES:
Original: "Dear Students, Please note that the mock test will be conducted during your regular class hours in the classroom. All students are required to bring their laptops and ensure that they are fully charged before coming to class. Please be informed that no retake, makeup test, or any other excuse will be entertained in case of absence or lack of preparation. Therefore, you are advised to make all necessary arrangements and be fully prepared in advance. Thank you, and stay blessed. Have a nice day!"
Summary: "Mock test will be conducted during regular class hours in classroom. All students are required to bring their laptops and ensure they are fully charged. No retake, makeup test, or any excuse will be entertained in case of absence or lack of preparation. Make all necessary arrangements and be fully prepared in advance."

Original: "Hi all, there will be no class this Thursday 12 June due to public holiday. The replacement class will be on Saturday 14 June, 10am-12pm at room 3.12. Please be there on time. Thank you."
Summary: "No class this Thursday 12 June due to public holiday. Replacement class on Saturday 14 June, 10am-12pm at room 3.12. Please be there on time."

Title: ${announcement.title}
Announcement: ${truncated}

Summary:`
}

export async function summarise(
  announcements: Announcement[]
): Promise<SummarisedAnnouncement[]> {
  // TODO: Feature 1 implementation
  return []
}
