import type { Course, Announcement, Deadline } from './types'
import { scoreUrgency } from './deadlines'

const BASE_URL = 'https://elearn.sunway.edu.my'
const FETCH_TIMEOUT = 15000
const CONCURRENCY = 3

function fetchWithTimeout(url: string, opts?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function toPlainText(value: string): string {
  const div = document.createElement('div')
  div.innerHTML = value
  return div.textContent?.trim() ?? ''
}

function stripHtml(html: unknown): string {
  if (!html) return ''
  if (typeof html === 'string') {
    return toPlainText(html)
  }
  if (typeof html === 'object' && html !== null) {
    const obj = html as Record<string, unknown>
    if (typeof obj.rawText === 'string') return toPlainText(obj.rawText)
    if (typeof obj.text === 'string') return toPlainText(obj.text)
    if (typeof obj.displayText === 'string') return toPlainText(obj.displayText)
    return ''
  }
  return String(html)
}

function extractDate(item: any): string {
  const knownFields = [
    item.modified,
    item.created,
    item.postedDate,
    item.startDate,
    item.startDateTime,
    item.endDateTime,
    item.availability?.adaptiveRelease?.start,
    item.availability?.available,
    item.datePosted,
    item.publishDate,
  ]
  for (const val of knownFields) {
    if (typeof val === 'string' && val.length > 0) return val
    if (typeof val === 'number' && val > 0) return new Date(val).toISOString()
  }

  // Scan all properties for ISO date strings (e.g. "2026-05-31T...")
  const isoPattern = /^\d{4}-\d{2}-\d{2}T/
  for (const key of Object.keys(item)) {
    const val = item[key]
    if (typeof val === 'string' && isoPattern.test(val)) return val
  }

  console.log('[Sunway Extension] No date found in announcement item, keys:', Object.keys(item))
  return ''
}

export async function fetchCourses(): Promise<Course[]> {
  const courses: Course[] = []

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/learn/api/v1/users/me/memberships?expand=course&limit=100`, {
      credentials: 'include',
    })
    if (!res.ok) return courses

    const data = await res.json()
    const results: any[] = data.results ?? []

    for (const membership of results) {
      const course = membership.course
      if (!course || !course.isAvailable) continue

      courses.push({
        id: course.id,
        name: course.name ?? course.courseId ?? `Course ${course.id}`,
        url: `${BASE_URL}/ultra/courses/${course.id}/outline`,
      })
    }
  } catch {
    const fallbackCourses = await fetchCoursesFromStream()
    courses.push(...fallbackCourses)
  }

  return courses
}

async function fetchCoursesFromStream(): Promise<Course[]> {
  const courses: Course[] = []

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/learn/api/v1/users/me/courses?limit=100`, {
      credentials: 'include',
    })
    if (!res.ok) return courses

    const data = await res.json()
    const results: any[] = data.results ?? []

    for (const course of results) {
      if (!course.isAvailable) continue
      courses.push({
        id: course.id,
        name: course.name ?? course.courseId ?? `Course ${course.id}`,
        url: `${BASE_URL}/ultra/courses/${course.id}/outline`,
      })
    }
  } catch {}

  return courses
}

function getRawBodyHtml(item: any): string {
  if (!item.body) return ''
  if (typeof item.body === 'string') return item.body
  if (typeof item.body === 'object') {
    const obj = item.body as Record<string, unknown>
    if (typeof obj.rawText === 'string') return obj.rawText
    if (typeof obj.text === 'string') return obj.text
    if (typeof obj.displayText === 'string') return obj.displayText
  }
  return ''
}

export async function fetchAnnouncements(course: Course): Promise<Announcement[]> {
  const announcements: Announcement[] = []

  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/announcements?limit=20`,
      { credentials: 'include' }
    )
    if (!res.ok) return announcements

    const data = await res.json()
    const results: any[] = data.results ?? []

    for (const item of results) {
      const rawBody = getRawBodyHtml(item)
      const body = stripHtml(item.body)
      const title = typeof item.title === 'string' ? item.title : 'Untitled Announcement'
      const date = extractDate(item)
      announcements.push({
        id: item.id ?? `${course.id}-ann-${announcements.length}`,
        courseId: course.id,
        courseName: course.name,
        title,
        body: body || title,
        rawBody,
        date: date || 'Unknown',
      })
    }
  } catch (e) {
    console.warn(`[Sunway Extension] Failed to fetch announcements for ${course.name}:`, e)
  }

  if (announcements.length === 0) {
    const forumAnnouncements = await fetchFromContentItems(course)
    announcements.push(...forumAnnouncements)
  }

  return announcements
}

async function fetchFromContentItems(course: Course): Promise<Announcement[]> {
  const announcements: Announcement[] = []

  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/contents?limit=50`,
      { credentials: 'include' }
    )
    if (!res.ok) return announcements

    const data = await res.json()
    const results: any[] = data.results ?? []

    for (const item of results) {
      if (item.contentHandler?.id === 'resource/x-bb-announcement' ||
          item.contentHandler?.id === 'resource/x-bb-forumlink' ||
          item.title?.toLowerCase().includes('announcement')) {
        const body = stripHtml(item.body)
        const title = typeof item.title === 'string' ? item.title : 'Untitled'
        const date = extractDate(item)
        announcements.push({
          id: item.id ?? `${course.id}-content-${announcements.length}`,
          courseId: course.id,
          courseName: course.name,
          title,
          body: body || title,
          date: date || 'Unknown',
        })
      }
    }
  } catch {}

  return announcements
}

export async function fetchAssignmentDeadlines(course: Course): Promise<Deadline[]> {
  const deadlines: Deadline[] = []

  try {
    let url: string | null = `${BASE_URL}/learn/api/v1/courses/${course.id}/gradebook/columns?limit=100`

    while (url) {
      const res = await fetchWithTimeout(url, { credentials: 'include' })
      if (!res.ok) break

      const data = await res.json()
      const results: any[] = data.results ?? []

      for (const col of results) {
        if (col.score?.possible === undefined && !col.contentId) continue

        let task = col.name ?? col.title ?? ''

        if (!task && col.contentId) {
          task = await fetchContentTitle(course.id, col.contentId)
        }
        if (!task) task = 'Assignment'

        const dueDate = col.dueDate ?? col.grading?.due ?? ''
        const isoDate = dueDate
          ? (typeof dueDate === 'string' ? dueDate.split('T')[0] : new Date(dueDate).toISOString().split('T')[0])
          : ''

        const created = col.created ?? col.modified ?? ''
        const createdDate = created
          ? (typeof created === 'string' ? created : new Date(created).toISOString())
          : ''

        deadlines.push({
          id: `dl-gb-${course.id}-${col.id}`,
          courseId: course.id,
          courseName: course.name,
          task,
          dueDate: isoDate,
          createdDate,
          contentId: col.contentId ?? col.id,
          urgency: scoreUrgency(isoDate),
        })
      }

      url = data.paging?.nextPage ? `${BASE_URL}${data.paging.nextPage}` : null
    }
  } catch (e) {
    console.warn(`[Sunway Extension] Failed to fetch gradebook for ${course.name}:`, e)
  }

  return deadlines
}

async function fetchContentTitle(courseId: string, contentId: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/learn/api/v1/courses/${courseId}/contents/${contentId}`,
      { credentials: 'include' }
    )
    if (!res.ok) return ''
    const data = await res.json()
    return data.title ?? data.name ?? ''
  } catch {
    return ''
  }
}

const ASSIGNMENT_CONTENT_TYPES = [
  'resource/x-bb-assignment',
  'resource/x-bb-assessment',
  'resource/x-bb-turnitin-assignment',
  'resource/x-turnitin-assignment',
  'resource/x-bb-courselink',
  'resource/x-bb-asmt-test-link',
  'resource/x-bb-blti-link',
]

const DISCUSSION_CONTENT_TYPES = [
  'resource/x-bb-forumlink',
  'resource/x-bb-discussionboard',
  'resource/x-bb-discussion',
]

const FOLDER_CONTENT_TYPES = [
  'resource/x-bb-folder',
  'resource/x-bb-lesson',
  'resource/x-bb-coursemodule',
]

export async function fetchContentAssignments(course: Course): Promise<Deadline[]> {
  const deadlines: Deadline[] = []

  try {
    let url: string | null = `${BASE_URL}/learn/api/v1/courses/${course.id}/contents?limit=200`
    const allResults: any[] = []

    while (url) {
      const res = await fetchWithTimeout(url, { credentials: 'include' })
      if (!res.ok) break
      const data = await res.json()
      allResults.push(...(data.results ?? []))
      url = data.paging?.nextPage ? `${BASE_URL}${data.paging.nextPage}` : null
    }


    deadlines.push(...extractAssignmentItems(allResults, course))

    const folders = allResults.filter(
      (item: any) => FOLDER_CONTENT_TYPES.includes(item.contentHandler?.id ?? '') && item.hasChildren
    )
    for (const folder of folders) {
      const childDeadlines = await fetchFolderContents(course, folder.id)
      deadlines.push(...childDeadlines)
    }
  } catch {}

  return deadlines
}

async function fetchFolderContents(course: Course, folderId: string): Promise<Deadline[]> {
  const deadlines: Deadline[] = []

  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/learn/api/v1/courses/${course.id}/contents/${folderId}/children?limit=100`,
      { credentials: 'include' }
    )
    if (!res.ok) return deadlines

    const data = await res.json()
    const results: any[] = data.results ?? []
    deadlines.push(...extractAssignmentItems(results, course))

    // Recurse into sub-folders
    const subFolders = results.filter(
      (item: any) => FOLDER_CONTENT_TYPES.includes(item.contentHandler?.id ?? '') && item.hasChildren
    )
    for (const folder of subFolders) {
      const childDeadlines = await fetchFolderContents(course, folder.id)
      deadlines.push(...childDeadlines)
    }
  } catch {}

  return deadlines
}


function extractAssignmentItems(items: any[], course: Course): Deadline[] {
  const deadlines: Deadline[] = []

  for (const item of items) {
    const handlerId = item.contentHandler?.id ?? ''
    const isAssignmentType = ASSIGNMENT_CONTENT_TYPES.includes(handlerId)
    const isDiscussionType = DISCUSSION_CONTENT_TYPES.includes(handlerId)
    const hasDueDate = !!(item.availability?.adaptiveRelease?.end || item.endDate || item.dueDate)
    const titleLooksLikeAssignment = /\b(assignment|submission|quiz|test|exam|lab report|project|discussion|group\s*work|coursework)\b/i.test(
      item.title ?? ''
    )

    if (!isAssignmentType && !isDiscussionType && !titleLooksLikeAssignment && !hasDueDate) continue

    const dueDate = item.availability?.adaptiveRelease?.end
      ?? item.endDate
      ?? item.dueDate
      ?? item.availability?.adaptiveRelease?.start
      ?? ''

    const isoDate = dueDate
      ? (typeof dueDate === 'string' ? dueDate.split('T')[0] : new Date(dueDate).toISOString().split('T')[0])
      : ''

    const created = item.created ?? item.modified ?? ''
    const createdDate = created
      ? (typeof created === 'string' ? created : new Date(created).toISOString())
      : ''

    deadlines.push({
      id: `dl-content-${course.id}-${item.id}`,
      courseId: course.id,
      courseName: course.name,
      task: item.title ?? 'Assignment',
      dueDate: isoDate,
      createdDate,
      contentId: item.id,
      urgency: scoreUrgency(isoDate),
    })
  }

  return deadlines
}

// Matches: /ultra/courses/{courseId}/outline/assessment/{contentId}
//          /ultra/courses/{courseId}/grades/assessment/{contentId}
const ELEARN_COURSE_LINK_PATTERN = /https?:\/\/elearn\.sunway\.edu\.my\/ultra\/courses\/(_\w+)\/(?:outline\/(?:assessment|discussion)|grades\/assessment)\/(_\w+)/g
// Matches: /ultra/stream/assessment/{contentId}/overview?courseId={courseId}
const ELEARN_STREAM_LINK_PATTERN = /https?:\/\/elearn\.sunway\.edu\.my\/ultra\/stream\/assessment\/(_\w+)\/overview\?courseId=(_\w+)/g

function extractElearnLinks(text: string): { courseId: string; contentId: string }[] {
  const links: { courseId: string; contentId: string }[] = []
  const seen = new Set<string>()

  // Also extract href values from raw HTML anchor tags
  const hrefPattern = /href=["']([^"']*elearn\.sunway\.edu\.my[^"']*)["']/gi
  const allText = text + ' ' + (text.match(hrefPattern) || []).map(m => m.replace(/href=["']|["']/g, '')).join(' ')

  let match: RegExpExecArray | null
  ELEARN_COURSE_LINK_PATTERN.lastIndex = 0
  while ((match = ELEARN_COURSE_LINK_PATTERN.exec(allText)) !== null) {
    const key = `${match[1]}|${match[2]}`
    if (!seen.has(key)) {
      seen.add(key)
      links.push({ courseId: match[1], contentId: match[2] })
    }
  }

  ELEARN_STREAM_LINK_PATTERN.lastIndex = 0
  while ((match = ELEARN_STREAM_LINK_PATTERN.exec(allText)) !== null) {
    // stream pattern: group 1 = contentId, group 2 = courseId
    const key = `${match[2]}|${match[1]}`
    if (!seen.has(key)) {
      seen.add(key)
      links.push({ courseId: match[2], contentId: match[1] })
    }
  }

  return links
}

async function fetchLinkedItemDeadline(courseId: string, contentId: string, courseName: string): Promise<Deadline | null> {
  // Try as assessment/content item
  for (const endpoint of [
    `${BASE_URL}/learn/api/v1/courses/${courseId}/contents/${contentId}`,
    `${BASE_URL}/learn/api/v1/courses/${courseId}/gradebook/columns?contentId=${contentId}`,
  ]) {
    try {
      const res = await fetchWithTimeout(endpoint, { credentials: 'include' })
      if (!res.ok) continue
      const data = await res.json()

      const item = data.results ? data.results[0] : data
      if (!item) continue

      const dueDate = item.dueDate
        ?? item.grading?.due
        ?? item.availability?.adaptiveRelease?.end
        ?? item.endDate
        ?? ''
      const title = item.name ?? item.title ?? 'Assignment'

      const isoDate = dueDate
        ? (typeof dueDate === 'string' ? dueDate.split('T')[0] : new Date(dueDate).toISOString().split('T')[0])
        : ''

      return {
        id: `dl-linked-${courseId}-${contentId}`,
        courseId,
        courseName,
        task: title,
        dueDate: isoDate,
        contentId,
        urgency: scoreUrgency(isoDate),
      }
    } catch {}
  }
  return null
}

export async function fetchLinkedDeadlines(announcements: Announcement[]): Promise<Deadline[]> {
  const allLinks: { courseId: string; contentId: string; courseName: string }[] = []

  for (const ann of announcements) {
    const searchText = (ann.rawBody || '') + ' ' + (ann.body || '')
    const links = extractElearnLinks(searchText)
    for (const link of links) {
      allLinks.push({ ...link, courseName: ann.courseName })
    }
  }

  if (allLinks.length === 0) return []

  const results = await runWithConcurrency(
    allLinks.map(link => () => fetchLinkedItemDeadline(link.courseId, link.contentId, link.courseName)),
    CONCURRENCY
  )

  return results.filter((d): d is Deadline => d !== null)
}


export async function scrapeAllCourses(): Promise<{ courses: Course[]; announcements: Announcement[]; assignmentDeadlines: Deadline[] }> {
  const courses = await fetchCourses()
  console.log(`[Sunway Extension] Fetched ${courses.length} courses, scraping in parallel...`)
  const announcements: Announcement[] = []
  const assignmentDeadlines: Deadline[] = []

  const results = await runWithConcurrency(
    courses.map(course => async () => {
      const [courseAnnouncements, gradebookDeadlines, contentDeadlines] = await Promise.allSettled([
        fetchAnnouncements(course),
        fetchAssignmentDeadlines(course),
        fetchContentAssignments(course),
      ])
      return {
        announcements: courseAnnouncements.status === 'fulfilled' ? courseAnnouncements.value : [],
        gradebook: gradebookDeadlines.status === 'fulfilled' ? gradebookDeadlines.value : [],
        content: contentDeadlines.status === 'fulfilled' ? contentDeadlines.value : [],
      }
    }),
    CONCURRENCY
  )

  for (const result of results) {
    announcements.push(...result.announcements)
    assignmentDeadlines.push(...result.gradebook)
    assignmentDeadlines.push(...result.content)
  }

  console.log(`[Sunway Extension] Got ${announcements.length} announcements, ${assignmentDeadlines.length} deadlines`)

  // Fetch deadlines from eLearn links embedded in announcement bodies
  const linkedDeadlines = await fetchLinkedDeadlines(announcements)
  assignmentDeadlines.push(...linkedDeadlines)

  // Deduplicate by matching course + task name + due date
  const seen = new Set<string>()
  const dedupedDeadlines: Deadline[] = []
  for (const dl of assignmentDeadlines) {
    const key = `${dl.courseId}|${dl.task.toLowerCase().trim()}|${dl.dueDate}`
    if (seen.has(key)) continue
    seen.add(key)
    dedupedDeadlines.push(dl)
  }

  // For real announcements that match a deadline by course+title, update their date to
  // the system due date and mark as 'due' so the urgency tag uses the correct date
  const deadlineByKey = new Map<string, Deadline>()
  for (const dl of dedupedDeadlines) {
    if (!dl.dueDate) continue
    deadlineByKey.set(`${dl.courseId}|${dl.task.toLowerCase().trim()}`, dl)
  }
  for (const ann of announcements) {
    const key = `${ann.courseId}|${ann.title.toLowerCase().trim()}`
    const dl = deadlineByKey.get(key)
    if (dl) {
      ann.date = dl.dueDate
      ann.dateType = 'due'
    }
  }

  // Create announcement cards for assignments that don't have a matching announcement
  const announcementKeys = new Set(
    announcements.map(a => `${a.courseId}|${a.title.toLowerCase().trim()}`)
  )
  for (const dl of dedupedDeadlines) {
    const key = `${dl.courseId}|${dl.task.toLowerCase().trim()}`
    if (announcementKeys.has(key)) continue
    announcementKeys.add(key)

    const dueDateText = dl.dueDate
      ? `Due: ${new Date(dl.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : 'No due date specified'

    const linkUrl = dl.contentId
      ? `${BASE_URL}/ultra/stream/assessment/${dl.contentId}/overview?courseId=${dl.courseId}`
      : `${BASE_URL}/ultra/courses/${dl.courseId}/outline`

    const hasDueDate = !!dl.dueDate

    announcements.push({
      id: `ann-${dl.id}`,
      courseId: dl.courseId,
      courseName: dl.courseName,
      title: dl.task,
      body: `${dl.task} — ${dueDateText}. This item requires submission.`,
      date: hasDueDate ? dl.dueDate : (dl.createdDate || ''),
      dateType: hasDueDate ? 'due' : 'posted',
      linkUrl,
      isAssignment: true,
    })
  }

  return { courses, announcements, assignmentDeadlines: dedupedDeadlines }
}
