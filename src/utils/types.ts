export interface Course {
  id: string    
  name: string 
  url: string 
}

/** Announcment page */
export interface Announcement {
  id: string
  courseId: string
  courseName: string
  title: string
  body: string
  rawBody?: string
  date: string
  dateType?: 'posted' | 'due'
  linkUrl?: string
  isAssignment?: boolean
}

/** Assignment or gradebook item with a due date */
export interface Deadline {
  id: string
  courseId: string
  courseName: string
  task: string
  dueDate: string
  createdDate?: string
  contentId?: string
  urgency: 'overdue' | 'soon' | 'upcoming'
}

export type AnnouncementCategory = 'Deadline' | 'Academic' | 'Event' | 'Administrative'

export interface KeyInfo {
  date?: string
  time?: string
  location?: string
  registrationFee?: string
  registrationDeadline?: string
  speakers?: string[]
  dress?: string
  contact?: string
}

export interface SummarisedAnnouncement extends Announcement {
  summary: string
  deadlines: Deadline[]
  category: AnnouncementCategory
  priorityScore: number
  keyInfo?: KeyInfo
}

export type NotificationTiming = '1day' | '3days' | '1week' | '2weeks'

export interface NotificationPreferences {
  deadlineReminders: boolean
  newAnnouncements: boolean
  urgentOnly: boolean
}

/** User-configurable settings stored in chrome.storage */
export interface AppSettings {
  refreshInterval: number
  notificationsEnabled: boolean
  notificationTiming: NotificationTiming[]
  notificationTypes: NotificationPreferences
}


export type Urgency = 'overdue' | 'soon' | 'upcoming'

export const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; dotColor: string }> = {
  overdue: { label: 'Past', color: 'bg-green-100 text-green-700 border-green-300', dotColor: 'bg-green-500' },
  soon: { label: 'Soon', color: 'bg-red-100 text-red-700 border-red-300', dotColor: 'bg-red-500' },
  upcoming: { label: 'Upcoming', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dotColor: 'bg-yellow-500' },
}

/** Message types used between content script, background service worker, and popup. */
export type MessageType =
  | 'ANNOUNCEMENTS_SCRAPED'
  | 'SUMMARISED_READY'
  | 'TRIGGER_SCRAPE'
  | 'DO_SCRAPE'
  | 'DO_SUMMARISE'
  | 'SCRAPE_RESULT'
  | 'SCRAPE_STATUS'
  | 'ERROR'

export interface ChromeMessage {
  type: MessageType
  data: unknown
}
