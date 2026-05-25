// SHARED TYPES — everyone imports from here 

export interface Course {
  id: string
  name: string
  url: string
}

export interface Announcement {
  id: string
  courseId: string
  courseName: string
  title: string
  body: string
  date: string
}

export interface Deadline {
  id: string
  courseId: string
  courseName: string
  task: string
  dueDate: string
  urgency: 'overdue' | 'soon' | 'upcoming'
}

export interface SummarisedAnnouncement extends Announcement {
  summary: string
  deadlines: Deadline[]
}

export interface AppSettings {
  ollamaUrl: string
  refreshInterval: number
}

export type MessageType =
  | 'ANNOUNCEMENTS_SCRAPED'
  | 'SUMMARISED_READY'
  | 'TRIGGER_SCRAPE'
  | 'ERROR'

export interface ChromeMessage {
  type: MessageType
  data: unknown
}
