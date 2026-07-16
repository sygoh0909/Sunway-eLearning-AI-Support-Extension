// SHARED TYPES — everyone imports from here

/** eLearn Course page */
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
  rawBody?: string      // used to extract embedded links
  date: string
  dateType?: 'posted' | 'due'  // tells UI whether date is when it was posted or when it's due
}

/** Assignment or gradebook item with a due date */
export interface Deadline {
  id: string
  courseId: string
  courseName: string
  task: string          
  dueDate: string       
  createdDate?: string  
  urgency: 'overdue' | 'soon' | 'upcoming'
}

/** Announcement after AI summarisation (with summary and extracted deadlines) */
export interface SummarisedAnnouncement extends Announcement {
  summary: string
  deadlines: Deadline[]
  category: AnnouncementCategory
  priorityScore: number
}

/** User-configurable settings stored in chrome.storage */
export interface AppSettings {
  ollamaUrl: string
  ollamaModel: string
  refreshInterval: number
  notificationsEnabled: boolean
}

/** Category label for an announcement */
export type AnnouncementCategory = 'Deadline' | 'Academic' | 'Event'

/** Urgency level of a deadline */
export type Urgency = 'overdue' | 'soon' | 'upcoming'

/** UI for urgency level */
export const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; dotColor: string }> = {
  overdue:  { label: 'Past',     color: 'bg-green-100 text-green-700 border-green-300',    dotColor: 'bg-green-500'  },
  soon:     { label: 'Soon',     color: 'bg-red-100 text-red-700 border-red-300',          dotColor: 'bg-red-500'    },
  upcoming: { label: 'Upcoming', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dotColor: 'bg-yellow-500' },
}

/** Message types used between content script, background service worker, and popup. */
export type MessageType =
  | 'ANNOUNCEMENTS_SCRAPED'
  | 'SUMMARISED_READY'
  | 'TRIGGER_SCRAPE'
  | 'DO_SCRAPE'
  | 'SCRAPE_RESULT'
  | 'SCRAPE_STATUS'
  | 'ERROR'

export interface ChromeMessage {
  type: MessageType
  data: unknown
}
