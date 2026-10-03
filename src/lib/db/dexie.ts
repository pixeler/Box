import Dexie, { type EntityTable } from 'dexie';
import type { Entry, Task, EventItem, Note, Habit, Tag, Relation, Box, FocusSession } from '@/types/models';

export interface UserSettingRecord {
  key: string;
  value: string;
}

export class SecondBrainDatabase extends Dexie {
  entries!: EntityTable<Entry, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<EventItem, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  relations!: EntityTable<Relation, 'id'>;
  settings!: EntityTable<UserSettingRecord, 'key'>;
  boxes!: EntityTable<Box, 'id'>;
  focus_sessions!: EntityTable<FocusSession, 'id'>;

  constructor() {
    super('SecondBrainDB');
    this.version(1).stores({
      entries: 'id, source, processed, created_at',
      tasks: 'id, entry_id, status, due_date, priority, migrated_from_id, created_at, updated_at, *tag_ids',
      events: 'id, entry_id, start_at, created_at, updated_at, *tag_ids',
      notes: 'id, entry_id, type, created_at, updated_at, *tag_ids',
      habits: 'id, title, created_at',
      tags: 'id, &name, source',
      relations: 'id, entry_id_1, entry_id_2, relation_type, created_at',
      settings: '&key',
    });

    this.version(2).stores({
      boxes: 'id, title, order, created_at, updated_at',
      tasks: 'id, entry_id, box_id, status, due_date, priority, migrated_from_id, created_at, updated_at, *tag_ids',
      notes: 'id, entry_id, box_id, type, created_at, updated_at, *tag_ids',
    });

    this.version(3).stores({
      focus_sessions: 'id, task_id, date_key, start_at, created_at',
    });

    this.version(4).stores({
      tags: 'id, name, source',
    });
  }
}

export const db = new SecondBrainDatabase();

