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
  // Split on newlines, periods, semicolons, AND emoji boundaries (common in Sunway announcements)
  const lines = text.split(/(?:\r?\n|\.(?=\s)|;|\s*(?=\p{Extended_Pictographic}))/u).map(l => l.trim()).filter(Boolean)
  const info: KeyInfo = {}

  const find = (pattern: RegExp): string | undefined => {
    for (const line of lines) {
      const m = line.match(pattern)
      if (m) return m[1]?.trim()
    }
    return undefined
  }

  // Date — text labels OR 📌/📅/🗓️ emoji prefix OR bare date formats
  // Supports ordinal suffixes (25th), day-of-week prefixes (Friday,), and date ranges (25 May – 5 June 2026)
  const DAY_PREFIX = '(?:(?:mon|tue|wed|thu|fri|sat|sun)\\w*[,\\s]+\\s*)?'
  const ORD = '(?:st|nd|rd|th)?'
  const DATE_CORE = `\\d{1,2}${ORD}\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*`
  const DATE_RANGE_SUFFIX = `(?:\\s+\\d{4})?(?:\\s*[-–]\\s*\\d{1,2}${ORD}\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*(?:\\s+\\d{4})?)?`
  const DATE_RANGE_SUFFIX_SAME_MONTH = `(?:\\s+\\d{4})?(?:\\s*[-–]\\s*\\d{1,2}${ORD}(?:\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*)?(?:\\s+\\d{4})?)?`
  info.date = find(new RegExp(`(?:date|event\\s*date|held\\s+on|takes?\\s+place\\s+on)[:\\s]+${DAY_PREFIX}(${DATE_CORE}${DATE_RANGE_SUFFIX})`, 'i'))
    ?? find(new RegExp(`(?:date|event\\s*date|held\\s+on|takes?\\s+place\\s+on)[:\\s]+${DAY_PREFIX}((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*\\s+\\d{1,2}${ORD}[,\\s]*\\d{0,4})`, 'i'))
    ?? find(/(?:date|event\s*date|held\s+on|takes?\s+place\s+on)[:\s]+(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*[,\s]+\s*)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)
    ?? find(new RegExp(`(?:📌|📅|🗓️)\\s*(?:date[:\\s]*)?\\s*${DAY_PREFIX}(${DATE_CORE}${DATE_RANGE_SUFFIX})`, 'i'))
    ?? find(new RegExp(`(?:📌|📅|🗓️)\\s*(?:date[:\\s]*)?\\s*${DAY_PREFIX}((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*\\s+\\d{1,2}${ORD}[,\\s]*\\d{0,4})`, 'i'))
    ?? find(new RegExp(`\\b(${DATE_CORE}\\s+\\d{4}(?:\\s*[-–]\\s*${DATE_CORE}(?:\\s+\\d{4})?)?)\\b`, 'i'))
    ?? find(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?[,\s]+\d{4})\b/i)
    ?? find(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/)

  // Time — text labels OR clock emoji prefix (all clock faces) OR bare time range
  info.time = find(/(?:time|starts?\s+at|from)[:\s]+(\d{1,2}[:.]\d{2}\s*(?:am|pm)?(?:\s*[-–to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?)/i)
    ?? find(/(?:⏱️|🕐|🕑|🕒|🕓|🕔|🕕|🕖|🕗|🕘|🕙|🕚|🕛|🕜|🕝|🕞|🕟|🕠|🕡|🕢|🕣|🕤|🕥|🕦|🕧)\s*(?:time[:\s]*)?\s*(\d{1,2}[:.]\d{2}\s*(?:am|pm)?(?:\s*[-–to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?)/i)
    ?? find(/(\d{1,2}[:.]\d{2}\s*(?:am|pm)\s*[-–to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm))/i)
    ?? find(/(\d{1,2}\s*(?:am|pm)\s*[-–to]+\s*\d{1,2}\s*(?:am|pm))/i)

  // Location / Platform / Mode — text labels OR 📍/💻 emoji prefix
  // Capture stops at emoji, period, semicolon, or field-starting keywords (deadline, registration, fee, etc.)
  const LOC_PAT = '([^\\p{Extended_Pictographic}.;]{3,80}?)(?=\\s*(?:\\p{Extended_Pictographic}|[.;]|$|(?:The\\s+)?(?:registration|deadline|fee|date|time|contact|dress|speaker|enquir|for\\s+any)))'
  info.location = find(new RegExp(`\\b(?:venue|location|place|platform|mode|held\\s+at|room|hall)[:\\s]+${LOC_PAT}`, 'iu'))
    ?? find(new RegExp(`(?:📍|💻)\\s*(?:(?:venue|location|platform|mode)[:\\s]*)?\\s*${LOC_PAT}`, 'u'))

  // Registration fee — text labels OR 💰 emoji with fee-related label, skip prize/win contexts
  info.registrationFee = find(/(?:registration\s*fees?|entry\s*fees?|ticket\s*prices?|participation\s*fees?)[:\s]+((?:rm|myr|usd|\$|free)[^\p{Extended_Pictographic};.!]{0,60})/iu)
    ?? find(/(?:admission|fees?|cost)[:\s]+((?:rm|myr|usd|\$|free)[^\p{Extended_Pictographic};.!]{0,60})/iu)
    ?? find(/💸\s*(?:(?:registration\s*)?fees?|admission|price|cost)[:\s]+((?:rm|myr|usd|\$|free)[^\p{Extended_Pictographic};.!]{0,60})/iu)
    ?? find(/💰\s*(?:admission|fees?|price|cost)[:\s]+((?:rm|myr|usd|\$|free)[^\p{Extended_Pictographic};.!]{0,60})/iu)
    ?? find(/(?:free\s+of\s+charge|no\s+fee|complimentary|free\s+admission|free\s+entry)/i)?.replace(/.*/, 'Free')

  // Registration/submission/nomination deadline — extract just the date (with optional day/parenthetical)
  const DEADLINE_DATE = `((?:(?:mon|tue|wed|thu|fri|sat|sun)\\w*[,\\s]+\\s*)?\\d{1,2}(?:st|nd|rd|th)?\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*(?:\\s+\\d{4})?(?:\\s*,\\s*\\d{1,2}[:.:]\\d{2}\\s*(?:am|pm)?)?(?:\\s*\\([^)]*\\))?)`
  info.registrationDeadline = find(new RegExp(`(?:register(?:ation)?\\s*(?:by|before|deadline|closes?)|(?:submission|nomination|sign[\\s-]?up)\\s+deadline|deadline\\s+(?:to\\s+)?(?:register|submit|nominate)|sign[\\s-]up\\s+by|registration\\s+deadline)[:\\s]+(?:[\\w\\s]*?(?:by|before|until|till)\\s+)?${DEADLINE_DATE}`, 'i'))
    ?? find(new RegExp(`(?:extended|moved)\\s+(?:to|until|till)\\s+${DEADLINE_DATE}`, 'i'))
    ?? find(new RegExp(`(?:📝|📌)\\s*(?:(?:registration|submission|nomination)\\s*(?:form\\s+)?deadline[:\\s]*)?\\s*(?:[\\w\\s]*?(?:by|before|until)\\s+)?${DEADLINE_DATE}`, 'i'))
    ?? find(/(?:register(?:ation)?|submission|nomination)\s*(?:by|before|deadline|closes?)[:\s]+(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*(?:\s+\d{4})?(?:\s*\([^)]*\))?)/i)
    ?? find(/(?:📝)\s*(?:(?:registration|submission|nomination)\s*deadline[:\s]*)?\s*(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*(?:\s+\d{4})?(?:\s*\([^)]*\))?)/i)

  // Speakers / guests — allow honorifics (Dr., Ir., Prof., Mr., Ms., etc.) which contain periods
  const speakerMatches: string[] = []
  const speakerPattern = /(?:speaker|presenter|guest|keynote|panelist|facilitator|host)[:\s]+((?:(?:Dr|Ir|Mr|Mrs|Ms|Prof|Assoc|Ts|Engr)\.?\s+)?[A-Z][A-Za-z'. -]{2,60})/g
  let sm: RegExpExecArray | null
  while ((sm = speakerPattern.exec(text)) !== null) {
    const name = sm[1].trim().replace(/\s+/g, ' ')
    if (!speakerMatches.includes(name)) speakerMatches.push(name)
    if (speakerMatches.length >= 5) break
  }
  if (speakerMatches.length > 0) info.speakers = speakerMatches

  // Dress code — require word boundary to avoid matching "address"
  info.dress = find(/(?:dress\s*code|attire|\bdress)[:\s]+([^\p{Extended_Pictographic};.]{3,50})/iu)

  // Contact / RSVP — prioritise email, phone, or name+email; avoid capturing sentence fragments
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i)
  const phoneMatch = text.match(/(?:contact|rsvp|enquir|phone|tel|call)[:\s]*[^a-z]*?(\+?\d[\d\s\-()]{7,15}\d)/i)
    ?? text.match(/(\+?6?0\d[\d\s\-]{7,12}\d)/)
  if (emailMatch) {
    const nameBeforeEmail = text.slice(Math.max(0, emailMatch.index! - 60), emailMatch.index!).match(/(?:(?:Dr|Ir|Mr|Mrs|Ms|Prof|Ts)\.?\s+)?([A-Z][A-Za-z'. -]{2,30})\s*[\(<]?$/)
    info.contact = nameBeforeEmail ? `${nameBeforeEmail[0].trim()} (${emailMatch[0]})` : emailMatch[0]
  } else if (phoneMatch) {
    info.contact = phoneMatch[1] ?? phoneMatch[0]
  }

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
  body = body.replace(/\p{Extended_Pictographic}/gu, '. ')
  body = body.replace(/\s+/g, ' ').trim()

  const sentences = body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10)

  const isGreeting = (s: string) => /^(dear\s+|hi\s+|hello\s+|good\s+(morning|afternoon|evening|day)|greetings?)/i.test(s)
  const isSignOff = (s: string) => /^(thank\s*you|regards|best\s+wishes|cheers|sincerely|stay\s+blessed|have\s+a\s+nice|have\s+a\s+good|all\s+the\s+best|good\s+luck|warm\s+regards)/i.test(s)
  const isFiller = (s: string) => /^(please\s+be\s+informed|kindly\s+note|this\s+is\s+to\s+inform|i\s+would\s+like\s+to\s+inform)/i.test(s)
  const isFragment = (s: string) => s.length < 30 && !/\b(invite|join|register|submit|attend|announce|welcome)\b/i.test(s)

  const kept = sentences.filter(s => !isGreeting(s) && !isSignOff(s) && !isFiller(s) && !isFragment(s))

  if (kept.length === 0) return announcement.title

  // Use the first meaningful sentence as the summary
  let summary = kept[0]
  summary = summary.replace(/please\s+be\s+informed\s+that\s*/gi, '')
  summary = summary.replace(/kindly\s+note\s+that\s*/gi, '')
  summary = summary.replace(/this\s+is\s+to\s+inform\s+you\s+that\s*/gi, '')
  summary = summary.replace(/\s+/g, ' ').trim()

  if (summary.length > 200) {
    summary = summary.slice(0, 200).replace(/\s+\S*$/, '') + '...'
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
