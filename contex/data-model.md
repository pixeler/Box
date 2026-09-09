# مدل داده (Data Model)

```ts
export type ItemStatus = "open" | "done" | "dropped" | "migrated";

export interface Task {
  id: string;
  entry_id: string | null;
  title: string;
  description?: string;
  status: ItemStatus;
  due_date?: string; // کلید جلالی YYYY/MM/DD
  priority?: 1 | 2 | 3; // 1: کم (آبی), 2: متوسط (کهربایی), 3: فوری (قرمز)
  pinned?: boolean;
  tag_ids: string[];
  migrated_from_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  entry_id: string | null;
  type: "note" | "idea";
  title: string;
  body: string;
  date_key?: string;
  pinned?: boolean;
  tag_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface EventItem {
  id: string;
  entry_id: string | null;
  title: string;
  start_at: string;
  end_at?: string;
  recurrence_rule?: string;
  tag_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  source: "manual" | "ai";
}

export interface Entry {
  id: string;
  raw_text?: string;
  source: "text" | "voice" | "image";
  created_at: string;
  processed: boolean;
}
```
