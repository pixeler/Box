import type { Entry, Task, EventItem, Note, Tag, TaskFilter, Box } from '@/types/models';

export interface TaskRepository {
  create(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task>;
  getById(id: string): Promise<Task | null>;
  list(filter?: TaskFilter): Promise<Task[]>;
  toggleDone(id: string, dateKey?: string): Promise<Task>;
  softDelete(id: string): Promise<void>; // status -> 'dropped'
  skipDate(id: string, dateKey: string): Promise<Task>;
  migrate(id: string, newDueDate: string): Promise<Task>;
  getOverdueOpen(beforeDate: string): Promise<Task[]>;
  getFutureOpen(afterDate: string): Promise<Task[]>;
  duplicate(id: string): Promise<Task>;
}

export interface EntryRepository {
  create(entry: Omit<Entry, 'id' | 'created_at'>): Promise<Entry>;
  getById(id: string): Promise<Entry | null>;
  listAll(): Promise<Entry[]>;
}

export interface NoteRepository {
  create(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note>;
  update(id: string, patch: Partial<Note>): Promise<Note>;
  getById(id: string): Promise<Note | null>;
  list(filter?: { type?: 'note' | 'idea'; tag_id?: string; box_id?: string | null }): Promise<Note[]>;
  softDelete(id: string): Promise<void>;
  duplicate(id: string): Promise<Note>;
}

export interface EventRepository {
  create(event: Omit<EventItem, 'id' | 'created_at' | 'updated_at'>): Promise<EventItem>;
  update(id: string, patch: Partial<EventItem>): Promise<EventItem>;
  getById(id: string): Promise<EventItem | null>;
  list(filter?: { dateStr?: string }): Promise<EventItem[]>;
}

export interface TagRepository {
  getOrCreate(name: string, source?: 'manual' | 'ai'): Promise<Tag>;
  listAll(): Promise<Tag[]>;
}

export interface BoxRepository {
  create(box: Omit<Box, 'id' | 'created_at' | 'updated_at'>): Promise<Box>;
  update(id: string, patch: Partial<Box>): Promise<Box>;
  getById(id: string): Promise<Box | null>;
  list(): Promise<Box[]>;
  delete(id: string): Promise<void>;
  getItems(boxId: string): Promise<{ tasks: Task[]; notes: Note[] }>;
}

export interface ExportData {
  entries: Entry[];
  tasks: Task[];
  events: EventItem[];
  notes: Note[];
  tags: Tag[];
  boxes?: Box[];
  exportedAt: string;
  version: string;
}

