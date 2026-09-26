export interface Entry {
  id: string;
  raw_text?: string;
  raw_audio_url?: string;
  raw_image_url?: string;
  source: "text" | "voice" | "image";
  created_at: string; // ISO
  processed: boolean; // آیا پارس/طبقه‌بندی شده؟
}

export type ItemStatus = "open" | "done" | "dropped" | "migrated";

export interface Task {
  id: string;
  entry_id: string | null; // null یعنی مستقیم ساخته شده، نه از dump
  box_id?: string | null; // شناسه باکس متعلق به آن
  title: string;
  description?: string;
  status: ItemStatus;
  due_date?: string; // تاریخ شمسی YYYY/MM/DD یا ISO YYYY-MM-DD
  due_time?: string; // زمان مثلا 10:30 یا 10:30-11:30
  duration_minutes?: number; // مدت زمان به دقیقه
  priority?: 1 | 2 | 3; // ! / !! / !!!
  tag_ids: string[];
  recurrence_rule?: string; // RRULE-like string یا "daily", "weekly", etc.
  recurrence_start_date?: string; // تاریخ شروع تکرار (YYYY/MM/DD)
  recurrence_end_date?: string | null; // تاریخ پایان تکرار (YYYY/MM/DD) یا null
  done_dates?: string[]; // تاریخ‌هایی که این تسک تکرارشونده در آن‌ها انجام شده است
  migrated_from_id?: string; // زنجیره‌ی تاریخچه‌ی migrate
  pinned?: boolean;
  reminder?: string | null;
  image_url?: string;
  icon?: string;
  order?: number;
  created_at: string;
  updated_at: string;
}

export interface EventItem {
  id: string;
  entry_id: string | null;
  title: string;
  start_at: string; // زمان شروع مثلا 12:00 یا تاریخ-زمان
  end_at?: string;
  recurrence_rule?: string; // مثلا «هر روز» یا «هر هفته»
  tag_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  entry_id: string | null;
  box_id?: string | null; // شناسه باکس متعلق به آن
  type: "note" | "idea";
  title: string;
  body: string;
  description?: string;
  color?: string; // pastel color hex code or class
  date_key?: string; // e.g. "1404/10/30"
  tag_ids: string[];
  pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  title: string;
  recurrence_rule: string;
  log: { date: string; done: boolean }[];
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  source: "manual" | "ai";
}

export interface Box {
  id: string;
  title: string;
  image: string; // e.g. "/Boxs/Box 1.png"
  icon?: string; // e.g. "RiSunLine", "RiYoutubeLine"
  icon_color?: string;
  badge_icon?: string; // e.g. "RiGroupLine"
  badge_color?: string;
  description?: string;
  order?: number;
  created_at: string;
  updated_at: string;
}

export interface Relation {
  id: string;
  entry_id_1: string;
  entry_id_2: string;
  relation_type: "shared_tag" | "manual_link" | "ai_suggested";
  created_at: string;
}

export type StreamItem = 
  | ({ itemType: "task" } & Task)
  | ({ itemType: "event" } & EventItem)
  | ({ itemType: "note" } & Note);

export interface TaskFilter {
  status?: ItemStatus | ItemStatus[];
  due_date?: string;
  older_than_days?: number;
  search_query?: string;
  tag_id?: string;
  box_id?: string | null;
}

export interface FocusSession {
  id: string;
  task_id?: string | null;
  task_title?: string;
  date_key: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  completed: boolean;
  created_at: string;
}

