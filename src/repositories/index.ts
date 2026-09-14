import { DexieTaskRepository } from './dexie/DexieTaskRepository';
import { DexieEntryRepository } from './dexie/DexieEntryRepository';
import { DexieNoteRepository } from './dexie/DexieNoteRepository';
import { DexieEventRepository } from './dexie/DexieEventRepository';
import { DexieTagRepository } from './dexie/DexieTagRepository';
import { DexieBoxRepository } from './dexie/DexieBoxRepository';

export const taskRepo = new DexieTaskRepository();
export const entryRepo = new DexieEntryRepository();
export const noteRepo = new DexieNoteRepository();
export const eventRepo = new DexieEventRepository();
export const tagRepo = new DexieTagRepository();
export const boxRepo = new DexieBoxRepository();

export * from './interfaces';

