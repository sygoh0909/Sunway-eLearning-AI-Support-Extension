import type { Announcement, SummarisedAnnouncement, KeyInfo } from './types'
import { extractDeadlines, scoreUrgency, categorizeAnnouncement, computePriorityScore } from './deadlines'
import { storageGet } from './storage'


const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall','can',
  'to','of','in','for','on','with','at','by','from','as','into','through','during',
  'before','after','above','below','between','out','off','over','under','again',
  'further','then','once','here','there','when','where','why','how','all','each',
  'every','both','few','more','most','other','some','such','no','nor','not','only',
  'own','same','so','than','too','very','just','because','but','and','or','if',
  'while','about','against','this','that','these','those','it','its','i','me','my',
  'we','our','you','your','he','him','his','she','her','they','them','their','what',
  'which','who','whom','please','kindly','note','dear','regards','thank','thanks'
])

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

function cosineSimilarity(a: string[], b: string[]): number {
  const freqA: Record<string, number> = {}
  const freqB: Record<string, number> = {}
  for (const w of a) freqA[w] = (freqA[w] || 0) + 1
  for (const w of b) freqB[w] = (freqB[w] || 0) + 1

  const allWords = new Set([...Object.keys(freqA), ...Object.keys(freqB)])
  let dot = 0, magA = 0, magB = 0
  for (const w of allWords) {
    const va = freqA[w] || 0
    const vb = freqB[w] || 0
    dot += va * vb
    magA += va * va
    magB += vb * vb
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}

function sentenceBoost(sentence: string): number {
  let boost = 0
  const s = sentence.toLowerCase()

  if (/\d{1,2}[\s\-\/](jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*[\s\-\/,]?\s*\d{0,4}/i.test(sentence)) boost += 1.5
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i.test(sentence)) boost += 1.5
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(sentence)) boost += 1.5
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(sentence)) boost += 0.8
  if (/\bweek\s*\d+/i.test(sentence)) boost += 0.8

  if (/\d{1,2}[:.]\d{2}\s*(am|pm)?/i.test(sentence)) boost += 0.8
  if (/\d{1,2}\s*(am|pm)\b/i.test(sentence)) boost += 0.8

  if (/\b(deadline|due\s*date|submit\s*by|submission|due\s+on|due\s+by|latest\s+by|no\s+later\s+than)\b/i.test(sentence)) boost += 2.0

  if (/\b(assignment|quiz|exam|test|assessment|project|presentation|lab\s*report|tutorial|midterm|final)\b/i.test(sentence) && sentence.length > 40) boost += 1.5

  if (/\b(event|workshop|seminar|webinar|talk|session|ceremony|competition|conference|meeting|orientation)\b/i.test(sentence)) boost += 1.2

  if (/\b(venue|location|room|hall|auditorium|building|block|level|campus)\b/i.test(sentence)) boost += 0.8

  if (/\b(register|sign\s*up|enrol|submit|attend|complete|upload|download|fill\s*(in|out|up))\b/i.test(sentence)) boost += 1.0

  if (/\b(urgent|important|mandatory|compulsory|required|immediately|asap|reminder)\b/i.test(s)) boost += 1.2

  return boost
}

function textRank(sentences: string[], topN: number): string[] {
  if (sentences.length <= topN) return sentences

  const tokens = sentences.map(s => tokenize(s))
  const n = sentences.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(tokens[i], tokens[j])
      matrix[i][j] = sim
      matrix[j][i] = sim
    }
  }

  const damping = 0.85
  const iterations = 30
  let scores = Array(n).fill(1 / n)

  for (let iter = 0; iter < iterations; iter++) {
    const newScores = Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const outSum = matrix[j].reduce((a, b) => a + b, 0)
        if (outSum > 0) sum += (matrix[j][i] / outSum) * scores[j]
      }
      newScores[i] = (1 - damping) / n + damping * sum
    }
    scores = newScores
  }

  for (let i = 0; i < n; i++) {
    const boost = sentenceBoost(sentences[i])
    const positionBias = i < 3 ? 0.3 : 0
    const lengthPenalty = (sentences[i].length < 40 && boost < 1.5) ? 0.3 : 1
    scores[i] *= (1 + boost + positionBias) * lengthPenalty
  }

  const ranked = scores.map((score, idx) => ({ score, idx }))
  ranked.sort((a, b) => b.score - a.score)

  const topIndices = ranked.slice(0, topN).map(r => r.idx)
  topIndices.sort((a, b) => a - b)

  return topIndices.map(i => sentences[i])
}

function extractKeyInfo(body: string): KeyInfo {
  const text = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
  const lines = text.split(/(?:\r?\n|\.(?=\s)|;)/).map(l => l.trim()).filter(Boolean)
  const info: KeyInfo = {}

  const find = (pattern: RegExp): string | undefined => {
    for (const line of lines) {
      const m = line.match(pattern)
      if (m) return m[1]?.trim()
    }
    return undefined
  }

  // Date — text labels OR 📌/📅 emoji prefix OR bare "DD Month YYYY" / "Month DD, YYYY" / DD/MM/YYYY
  info.date = find(/(?:date|event\s*date|held\s+on|takes?\s+place\s+on)[:\s]+([^\n;,]{5,40})/i)
    ?? find(/(?:📌|📅)\s*(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})/i)
    ?? find(/\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})\b/i)
    ?? find(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}[,\s]+\d{4})\b/i)
    ?? find(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/)

  // Time — text labels OR ⏱️ emoji prefix OR bare HH:MM or H(AM/PM) range
  info.time = find(/(?:time|starts?\s+at|from)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?(?:\s*[-–to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?)/i)
    ?? find(/(?:⏱️|🕐|🕑|🕒|🕓|🕔|🕕|🕖|🕗|🕘|🕙|🕚|🕛)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?(?:\s*[-–to]+\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)?)/i)
    ?? find(/(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\s*[-–to]+\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))/i)

  // Location — text labels OR 📍 emoji prefix
  info.location = find(/(?:venue|location|place|held\s+at|room|hall)[:\s]+([^.\n;]{3,80})/i)
    ?? find(/📍\s*([^.\n;📌⏱️💰]{3,80})/)

  // Registration fee — text labels OR 💰 emoji prefix OR bare RM/$ amount
  info.registrationFee = find(/(?:registration\s*fee|entry\s*fee|ticket\s*price|fee)[:\s]+((?:rm|myr|usd|\$|free)[^\n;.]{0,60})/i)
    ?? find(/💰\s*([^\n;.📌⏱️📍]{3,80})/)
    ?? find(/\b(rm\d+[^\n;.]{0,60})/i)
    ?? find(/(?:free\s+of\s+charge|no\s+fee|complimentary)/i)?.replace(/.*/, 'Free')

  // Registration deadline
  info.registrationDeadline = find(/(?:register(?:ation)?\s*(?:by|before|deadline|closes?)|deadline\s+(?:to\s+)?register|sign[\s-]up\s+by)[:\s]+([^\n;.]{5,50})/i)

  // Speakers / guests
  const speakerMatches: string[] = []
  const speakerPattern = /(?:speaker|presenter|guest|keynote|panelist|facilitator|host)[:\s]+([A-Z][^.\n;,]{3,60})/gi
  let sm: RegExpExecArray | null
  while ((sm = speakerPattern.exec(text)) !== null) {
    const name = sm[1].trim()
    if (!speakerMatches.includes(name)) speakerMatches.push(name)
    if (speakerMatches.length >= 5) break
  }
  if (speakerMatches.length > 0) info.speakers = speakerMatches

  // Dress code
  info.dress = find(/(?:dress\s*code|attire|dress)[:\s]+([^\n;.]{3,50})/i)

  // Contact / RSVP
  info.contact = find(/(?:contact|rsvp|enquir(?:y|ies)|questions?)[:\s]+([^\n;]{5,80})/i)

  // Remove undefined keys
  const clean: KeyInfo = {}
  for (const [k, v] of Object.entries(info)) {
    if (v !== undefined && v !== '') (clean as Record<string, unknown>)[k] = v
  }
  return clean
}

function generateSummary(announcement: Announcement): string {
  let body = announcement.body.trim()
  body = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
  // Break at every emoji so emoji-delimited structured data (📌 date ⏱️ time 📍 venue 💰 fee)
  // becomes short isolated sentences that the TextRank length penalty will downrank.
  body = body.replace(/\p{Extended_Pictographic}/gu, '. ')
  body = body.replace(/\s+/g, ' ').trim()

  const sentences = body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10)

  const isGreeting = (s: string) => /^(dear\s+|hi\s+|hello\s+|good\s+(morning|afternoon|evening|day)|greetings?)/i.test(s)
  const isSignOff = (s: string) => /^(thank\s*you|regards|best\s+wishes|cheers|sincerely|stay\s+blessed|have\s+a\s+nice|have\s+a\s+good|all\s+the\s+best|good\s+luck|warm\s+regards)/i.test(s)
  const isFiller = (s: string) => /^(please\s+be\s+informed|kindly\s+note|this\s+is\s+to\s+inform|i\s+would\s+like\s+to\s+inform)/i.test(s)

  const kept = sentences.filter(s => !isGreeting(s) && !isSignOff(s) && !isFiller(s))

  if (kept.length === 0) return announcement.title

  const topSentences = textRank(kept, 3)
  let summary = topSentences.join(' ')

  summary = summary.replace(/please\s+be\s+informed\s+that\s*/gi, '')
  summary = summary.replace(/kindly\s+note\s+that\s*/gi, '')
  summary = summary.replace(/this\s+is\s+to\s+inform\s+you\s+that\s*/gi, '')
  summary = summary.replace(/\s+/g, ' ').trim()

  if (summary.length > 350) {
    summary = summary.slice(0, 350).replace(/\s+\S*$/, '') + '...'
  }

  return summary || announcement.title
}

export async function summarise(announcements: Announcement[]): Promise<SummarisedAnnouncement[]> {
  const results: SummarisedAnnouncement[] = []

  const existing: SummarisedAnnouncement[] = (await storageGet('summarised')) ?? []
  const existingMap = new Map(existing.map(s => [s.id, s]))

  const uncached: Announcement[] = []
  for (const announcement of announcements) {
    const cached = existingMap.get(announcement.id)
    if (cached?.summary) {
      const cachedDeadlines = cached.deadlines ?? []
      const category = categorizeAnnouncement(announcement.title, announcement.body, announcement.courseName)
      const priorityScore = computePriorityScore({ ...announcement, deadlines: cachedDeadlines })
      const keyInfo = cached.keyInfo ?? extractKeyInfo(announcement.body)
      results.push({ ...announcement, summary: cached.summary, deadlines: cachedDeadlines, category, priorityScore, keyInfo })
    } else {
      uncached.push(announcement)
    }
  }

  console.log(`[AI] ${results.length} cached, ${uncached.length} need summarisation`)

  for (const announcement of uncached) {
    const summary = generateSummary(announcement)

    const rawDate = announcement.date || ''
    const isoDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate

    let deadlines: Awaited<ReturnType<typeof extractDeadlines>> = []

    if (announcement.dateType === 'due' && isoDate) {
      deadlines.push({
        id: `dl-ann-${announcement.courseId}-${announcement.id}`,
        courseId: announcement.courseId,
        courseName: announcement.courseName,
        task: announcement.title,
        dueDate: isoDate,
        urgency: scoreUrgency(isoDate),
      })
    } else {
      deadlines = await extractDeadlines(
        announcement.body,
        announcement.courseId,
        announcement.courseName
      )
      const firstWithDate = deadlines.find(d => d.dueDate)
      if (firstWithDate) {
        announcement.date = firstWithDate.dueDate
        announcement.dateType = 'due'
      }
    }

    if (deadlines.length === 0) {
      let urgency: 'overdue' | 'soon' | 'upcoming' = 'upcoming'
      if (isoDate) {
        const posted = new Date(isoDate).getTime()
        const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
        if (posted < threeMonthsAgo) urgency = 'overdue'
      }
      deadlines.push({
        id: `dl-ann-${announcement.courseId}-${announcement.id}`,
        courseId: announcement.courseId,
        courseName: announcement.courseName,
        task: announcement.title,
        dueDate: '',
        urgency,
      })
    }

    const category = categorizeAnnouncement(announcement.title, announcement.body, announcement.courseName)
    const priorityScore = computePriorityScore({ ...announcement, deadlines })
    const keyInfo = extractKeyInfo(announcement.body)
    results.push({ ...announcement, summary, deadlines, category, priorityScore, keyInfo })
  }

  return results
}
