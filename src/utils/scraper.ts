// REST API scraper for Blackboard Ultra eLearn

import type { Course, Announcement, Deadline } from './types'
import { scoreUrgency } from './deadlines'
// NOTE: scoreUrgency lives in SY's deadlines.ts — wait for sy-ai-summarizer-v2 to merge before raising PR

const BASE_URL = 'https://elearn.sunway.edu.my'

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Converts an HTML string to plain text using a temporary DOM element. */
function toPlainText(value: string): string {
  const div = document.createElement('div')
  div.innerHTML = value
  return (div.textContent ?? div.innerText ?? '').replace(/\s+/g, ' ').trim()
}

/** Handles string / object / null body — always returns clean plain text. */
function stripHtml(html: unknown): string {
  if (!html) return ''
  if (typeof html === 'string') return toPlainText(html)
  if (typeof html === 'object') {
    const obj = html as Record<string, unknown>
    const raw = obj.rawText ?? obj.displayText ?? obj.text ?? ''
    return typeof raw === 'string' ? toPlainText(raw) : ''
  }
  return ''
}

const KNOWN_DATE_FIELDS = [
  'created', 'modified', 'postedDate', 'startDate',
  'endDate', 'dueDate', 'availableFrom', 'availableUntil', 'lastModified',
]

/** Tries known date fields first, then scans ALL properties for ISO date strings. */
function extractDate(item: any): string {
  for (const field of KNOWN_DATE_FIELDS) {
    const val = item[field]

    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) return val
  }
  
  for (const value of Object.values(item)) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return value
  }
  console.warn('[Scraper] extractDate: no date found on item', item?.id ?? '(no id)')
  return ''
}

// ─── Course fetching ──────────────────────────────────────────────────────────

/** Fetches enrolled courses. Falls back to fetchCoursesFromStream() if memberships endpoint fails. */
export async function fetchCourses(): Promise<Course[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/users/me/memberships?expand=course&limit=100`,
      { credentials: 'include' }
    )
    if (!res.ok) {
      console.warn(`[Scraper] fetchCourses: memberships returned ${res.status}, falling back`)
      return fetchCoursesFromStream()
    }
    const data = await res.json()
    const courses: Course[] = (data.results ?? [])
      .filter((m: any) => m.course?.isAvailable === true && !m.course?.isClosed)
      .map((m: any) => ({
        id:   m.courseId,
        name: m.course?.name ?? m.courseId,
        url:  m.course?.externalAccessUrl ?? `${BASE_URL}/ultra/courses/${m.courseId}/outline`,
      }))
    console.log(`[Scraper] fetchCourses: ${courses.length} courses`)
    return courses
  } catch (e) {
    console.warn('[Scraper] fetchCourses threw, falling back:', e)
    return fetchCoursesFromStream()
  }
}

/** Fallback — calls /users/me/courses when the memberships endpoint is unavailable. */
async function fetchCoursesFromStream(): Promise<Course[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/users/me/courses?limit=100`,
      { credentials: 'include' }
    )
    if (!res.ok) throw new Error(`courses endpoint returned ${res.status}`)
    const data = await res.json()
    return (data.results ?? []).map((c: any) => ({
      id:   c.id,
      name: c.name ?? c.id,
      url:  `${BASE_URL}/ultra/courses/${c.id}/outline`,
    }))
  } catch (e) {
    console.error('[Scraper] fetchCoursesFromStream failed:', e)
    return []
  }
}

// ─── Announcement helpers ─────────────────────────────────────────────────────

/** Extracts raw HTML from item.body — stored as rawBody on Announcement for link extraction. */
function getRawBodyHtml(item: any): string {
  const body = item.body
  if (!body) return ''
  if (typeof body === 'string') return body
  if (typeof body === 'object') {
    return (body as any).rawText ?? (body as any).displayText ?? (body as any).text ?? ''
  }
  return ''
}

// ─── Announcement fetching ────────────────────────────────────────────────────

/** Fetches announcements for one course. Falls back to fetchFromContentItems() if 0 results. */
export async function fetchAnnouncements(course: Course): Promise<Announcement[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/announcements?limit=20`,
      { credentials: 'include' }
    )
    if (!res.ok) {
      console.warn(`[Scraper] fetchAnnouncements: ${course.name} → ${res.status}`)
      return []
    }
    const data = await res.json()
    const results = data.results ?? []
    if (results.length === 0) {
      console.log(`[Scraper] fetchAnnouncements: 0 for ${course.name}, trying content items`)
      return fetchFromContentItems(course)
    }
    return results.map((item: any) => ({
      id:         item.id,
      courseId:   course.id,
      courseName: course.name,
      title:      item.title ?? '',
      body:       stripHtml(item.body),
      rawBody:    getRawBodyHtml(item),
      date:       extractDate(item),
      dateType:   'posted' as const,
    }))
  } catch (e) {
    console.warn(`[Scraper] fetchAnnouncements failed for ${course.name}:`, e)
    return []
  }
}

/** Fallback — scans /contents for announcement-type items when announcements endpoint is empty. */
async function fetchFromContentItems(course: Course): Promise<Announcement[]> {
  const ANNOUNCEMENT_TYPES = [
    'resource/x-bb-announcement',
    'resource/x-bb-bltiplacement-Portal',
  ]
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/contents?limit=50`,
      { credentials: 'include' }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? [])
      .filter((item: any) => ANNOUNCEMENT_TYPES.includes(item.contentHandler?.id ?? ''))
      .map((item: any) => ({
        id:         item.id,
        courseId:   course.id,
        courseName: course.name,
        title:      item.title ?? '',
        body:       stripHtml(item.body),
        rawBody:    getRawBodyHtml(item),
        date:       extractDate(item),
        dateType:   'posted' as const,
      }))
  } catch (e) {
    console.warn(`[Scraper] fetchFromContentItems failed for ${course.name}:`, e)
    return []
  }
}

// ─── Assignment deadlines from gradebook ─────────────────────────────────────

/** Fetches gradebook columns with due dates. Skips auto-calculated columns (Total, Weighted Total). */
export async function fetchAssignmentDeadlines(course: Course): Promise<Deadline[]> {
  const SKIP_TITLES = ['total', 'weighted total', 'final grade']

  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/gradebook/columns?limit=50`,
      { credentials: 'include' }
    )

    if (!res.ok) {
      console.warn(`[Scraper] fetchAssignmentDeadlines: ${course.name} → ${res.status}`)
      return []
    }

    const data = await res.json()
    const deadlines: Deadline[] = []

    for (const col of data.results ?? []) {
      if (SKIP_TITLES.includes((col.name ?? '').toLowerCase())) continue
      const dueDate: string = col.grading?.due ?? ''
      
      if (!dueDate) continue
      deadlines.push({
        id:          `${course.id}-${col.id}`,
        courseId:    course.id,
        courseName:  course.name,
        task:        col.name ?? 'Assignment',
        dueDate,
        createdDate: extractDate(col),
        urgency:     scoreUrgency(dueDate),
      })
    }
    console.log(`[Scraper] fetchAssignmentDeadlines: ${course.name} → ${deadlines.length}`)
    return deadlines
  } catch (e) {
    console.warn(`[Scraper] fetchAssignmentDeadlines failed for ${course.name}:`, e)
    return []
  }
}

// ─── Content type constants ───────────────────────────────────────────────────

const ASSIGNMENT_CONTENT_TYPES = [
  'resource/x-bb-assignment',
  'resource/x-bb-courseassessment',
  'resource/x-bb-externalassessment',
  'resource/x-bb-syllabus',
  'resource/x-turnitin-assignment',
  'resource/x-bb-bltiplacement-Assessment',
]

const DISCUSSION_CONTENT_TYPES = [
  'resource/x-bb-forumlink',
  'resource/x-bb-discussionboard',
  'resource/x-bb-groupdiscussionboard',
]

const FOLDER_CONTENT_TYPES = [
  'resource/x-bb-folder',
  'resource/x-bb-module',
  'resource/x-bb-lessonplan',
]

// ─── Content tree walker ──────────────────────────────────────────────────────

/** Walks the course content tree for assignments and discussions. Drills into folders recursively. */
export async function fetchContentAssignments(course: Course): Promise<Deadline[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/contents?limit=100`,
      { credentials: 'include' }
    )
    if (!res.ok) return []
    const items: any[] = (await res.json()).results ?? []

    const assignments = extractAssignmentItems(items, course)

    const folderDeadlines = (
      await Promise.allSettled(
        items
          .filter(item => FOLDER_CONTENT_TYPES.includes(item.contentHandler?.id ?? ''))
          .map(f => fetchFolderContents(course, f.id))
      )
    )
      .filter((r): r is PromiseFulfilledResult<Deadline[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    const discussionDeadlines = await fetchDiscussions(course)

    return [...assignments, ...folderDeadlines, ...discussionDeadlines]
  } catch (e) {
    console.warn(`[Scraper] fetchContentAssignments failed for ${course.name}:`, e)
    return []
  }
}

/** Fetches a folder's children and recurses into sub-folders. */
async function fetchFolderContents(course: Course, folderId: string): Promise<Deadline[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/contents/${folderId}/children?limit=100`,
      { credentials: 'include' }
    )
    if (!res.ok) return []
    const items: any[] = (await res.json()).results ?? []

    const assignments = extractAssignmentItems(items, course)
    const nested = (
      await Promise.allSettled(
        items
          .filter(item => FOLDER_CONTENT_TYPES.includes(item.contentHandler?.id ?? ''))
          .map(f => fetchFolderContents(course, f.id))
      )
    )
      .filter((r): r is PromiseFulfilledResult<Deadline[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    return [...assignments, ...nested]
  } catch (e) {
    console.warn(`[Scraper] fetchFolderContents failed (${folderId}):`, e)
    return []
  }
}

/** Fetches discussion board posts that have due dates. */
async function fetchDiscussions(course: Course): Promise<Deadline[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/discussions?limit=50`,
      { credentials: 'include' }
    )
    if (!res.ok) return []
    const deadlines: Deadline[] = []
    for (const item of (await res.json()).results ?? []) {
      const dueDate: string = item.dueDate ?? item.settings?.dueDate ?? ''
      if (!dueDate) continue
      deadlines.push({
        id:          `disc-${course.id}-${item.id}`,
        courseId:    course.id,
        courseName:  course.name,
        task:        item.title ?? 'Discussion',
        dueDate,
        createdDate: extractDate(item),
        urgency:     scoreUrgency(dueDate),
      })
    }
    return deadlines
  } catch (e) {
    console.warn(`[Scraper] fetchDiscussions failed for ${course.name}:`, e)
    return []
  }
}

// ─── Assignment item extractor ────────────────────────────────────────────────

const ASSIGNMENT_KEYWORDS = /assignment|quiz|test|exam|lab|project|report|submission|practical|assessment/i

/** Filters content items for assignments — checks handler type OR title keywords. */
function extractAssignmentItems(items: any[], course: Course): Deadline[] {
  const deadlines: Deadline[] = []
  for (const item of items) {
    const handlerId: string = item.contentHandler?.id ?? ''
    const isAssignmentType =
      ASSIGNMENT_CONTENT_TYPES.includes(handlerId) ||
      DISCUSSION_CONTENT_TYPES.includes(handlerId)
    const hasKeyword = ASSIGNMENT_KEYWORDS.test(item.title ?? '')
    if (!isAssignmentType && !hasKeyword) continue
    const dueDate: string = item.grading?.due ?? item.availability?.adaptive?.end ?? ''
    if (!dueDate) continue
    deadlines.push({
      id:          `content-${course.id}-${item.id}`,
      courseId:    course.id,
      courseName:  course.name,
      task:        item.title ?? 'Assignment',
      dueDate,
      createdDate: extractDate(item),
      urgency:     scoreUrgency(dueDate),
    })
  }
  return deadlines
}

// ─── Linked deadline extraction ───────────────────────────────────────────────

/** Scans raw HTML for eLearn deep links (/ultra/courses/.../outline/assessment/...). */
function extractElearnLinks(text: string): Array<{ courseId: string; contentId: string }> {
  const links: Array<{ courseId: string; contentId: string }> = []
  const pattern = /\/ultra\/courses\/([^/]+)\/outline\/(?:assessment|content)\/([^/"'\s]+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    links.push({ courseId: match[1], contentId: match[2] })
  }
  return links
}

/** Tries to fetch a linked item's deadline via gradebook columns, then content items. */
async function fetchLinkedItemDeadline(
  courseId: string,
  contentId: string,
  courseName: string
): Promise<Deadline | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${courseId}/gradebook/columns/${contentId}`,
      { credentials: 'include' }
    )
    if (res.ok) {
      const col = await res.json()
      const dueDate: string = col.grading?.due ?? ''
      if (dueDate) return {
        id: `linked-${courseId}-${contentId}`, courseId, courseName,
        task: col.name ?? 'Assignment', dueDate,
        createdDate: extractDate(col), urgency: scoreUrgency(dueDate),
      }
    }
  } catch { /* fall through */ }

  try {
    const res = await fetch(
      `${BASE_URL}/learn/api/v1/courses/${courseId}/contents/${contentId}`,
      { credentials: 'include' }
    )
    if (res.ok) {
      const item = await res.json()
      const dueDate: string = item.grading?.due ?? ''
      if (dueDate) return {
        id: `linked-${courseId}-${contentId}`, courseId, courseName,
        task: item.title ?? 'Assignment', dueDate,
        createdDate: extractDate(item), urgency: scoreUrgency(dueDate),
      }
    }
  } catch { /* not found */ }

  return null
}

/** Scans all announcement bodies for eLearn deep links and fetches their deadlines. */
export async function fetchLinkedDeadlines(announcements: Announcement[]): Promise<Deadline[]> {
  const seen = new Set<string>()
  const fetches: Promise<Deadline | null>[] = []

  for (const ann of announcements) {
    const text = `${ann.rawBody ?? ''} ${ann.body}`
    for (const { courseId, contentId } of extractElearnLinks(text)) {
      const key = `${courseId}|${contentId}`
      if (seen.has(key)) continue
      seen.add(key)
      fetches.push(fetchLinkedItemDeadline(courseId, contentId, ann.courseName))
    }
  }

  const results = await Promise.allSettled(fetches)
  return results
    .filter((r): r is PromiseFulfilledResult<Deadline> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Orchestrates a full scrape:
 * 1. fetchCourses()
 * 2. For each course: fetchAnnouncements + fetchAssignmentDeadlines + fetchContentAssignments
 * 3. fetchLinkedDeadlines from announcement bodies
 * 4. Deduplicates by courseId|task|dueDate
 * 5. Creates synthetic announcement cards for assignments with no matching announcement
 */
export async function scrapeAllCourses(): Promise<{
  courses: Course[]
  announcements: Announcement[]
  assignmentDeadlines: Deadline[]
}> {
  console.log('[Scraper] scrapeAllCourses() started')

  const courses = await fetchCourses()
  if (courses.length === 0) {
    console.warn('[Scraper] No courses found — returning empty')
    return { courses: [], announcements: [], assignmentDeadlines: [] }
  }

  const [announcementResults, deadlineResults, contentResults] = await Promise.all([
    Promise.allSettled(courses.map(c => fetchAnnouncements(c))),
    Promise.allSettled(courses.map(c => fetchAssignmentDeadlines(c))),
    Promise.allSettled(courses.map(c => fetchContentAssignments(c))),
  ])

  const announcements = announcementResults
    .filter((r): r is PromiseFulfilledResult<Announcement[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  const gradebookDeadlines = deadlineResults
    .filter((r): r is PromiseFulfilledResult<Deadline[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  const contentDeadlines = contentResults
    .filter((r): r is PromiseFulfilledResult<Deadline[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  const linkedDeadlines = await fetchLinkedDeadlines(announcements)

  // Deduplicate by courseId|task|dueDate
  const seen = new Set<string>()
  const allDeadlines: Deadline[] = []
  for (const d of [...gradebookDeadlines, ...contentDeadlines, ...linkedDeadlines]) {
    const key = `${d.courseId}|${d.task.toLowerCase().trim()}|${d.dueDate}`
    if (seen.has(key)) continue
    seen.add(key)
    allDeadlines.push(d)
  }

  // Synthetic announcement cards for assignments with no matching announcement
  const announcedTasks = new Set(
    announcements.map(a => `${a.courseId}|${a.title.toLowerCase().trim()}`)
  )
  for (const d of allDeadlines) {
    if (announcedTasks.has(`${d.courseId}|${d.task.toLowerCase().trim()}`)) continue
    announcements.push({
      id:         `synthetic-${d.id}`,
      courseId:   d.courseId,
      courseName: d.courseName,
      title:      d.task,
      body:       `Due: ${d.dueDate}`,
      date:       d.dueDate,
      dateType:   'due',
    })
  }

  console.log(`[Scraper] done — ${courses.length} courses, ${announcements.length} announcements, ${allDeadlines.length} deadlines`)
  return { courses, announcements, assignmentDeadlines: allDeadlines }
}
