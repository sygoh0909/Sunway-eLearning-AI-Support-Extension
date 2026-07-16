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

export async function summarise(announcements: Announcement[]): Promise<SummarisedAnnouncement[]> {
  const settings = await getSettings()
  const results: SummarisedAnnouncement[] = []

  const { connected } = await checkOllamaConnection()

  for (const announcement of announcements) {
    let summary = ''

    if (connected) {
      try {
        const prompt = buildSummaryPrompt(announcement)
        summary = await callOllama(prompt, settings.ollamaUrl, settings.ollamaModel)
      } catch {
        summary = generateFallbackSummary(announcement)
      }
    } else {
      summary = generateFallbackSummary(announcement)
    }

    const deadlines = await extractDeadlines(
      announcement.body,
      announcement.courseId,
      announcement.courseName
    )

    results.push({
      ...announcement,
      summary: summary || generateFallbackSummary(announcement),
      deadlines,
    })
  }

  return results
}

function generateFallbackSummary(announcement: Announcement): string {
  let body = announcement.body.trim()
  body = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

  // Split into sentences
  const sentences = body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0)

  const isGreeting = (s: string) => /^(dear\s+|hi\s+|hello\s+|good\s+(morning|afternoon|evening|day)|greetings?)/i.test(s)
  const isSignOff = (s: string) => /^(thank\s*you|regards|best\s+wishes|cheers|sincerely|stay\s+blessed|have\s+a\s+nice|have\s+a\s+good|all\s+the\s+best|good\s+luck|warm\s+regards)/i.test(s)
  const isFiller = (s: string) => /^(please\s+be\s+informed|kindly\s+note|this\s+is\s+to\s+inform|i\s+would\s+like\s+to\s+inform)/i.test(s)

  // Keep sentences that are not greetings, sign-offs, or pure filler
  const kept = sentences.filter(s => !isGreeting(s) && !isSignOff(s) && !isFiller(s))

  let summary = kept.join(' ')

  // Clean inline filler phrases but keep the rest of the sentence
  summary = summary.replace(/please\s+be\s+informed\s+that\s*/gi, '')
  summary = summary.replace(/kindly\s+note\s+that\s*/gi, '')
  summary = summary.replace(/this\s+is\s+to\s+inform\s+you\s+that\s*/gi, '')

  summary = summary.replace(/\s+/g, ' ').trim()

  if (summary.length > 300) {
    summary = summary.slice(0, 300).replace(/\s+\S*$/, '') + '...'
  }

  return summary || announcement.title
}

export async function checkOllamaConnection(): Promise<{ connected: boolean; models: string[] }> {
  const settings = await getSettings()
  try {
    const res = await fetch(`${settings.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { connected: false, models: [] }
    const data = await res.json()
    const models = (data.models ?? []).map((m: any) => m.name)
    return { connected: true, models }
  } catch {
    return { connected: false, models: [] }
  }
}

