import type { RunRecord } from '../core/types';

const PROFILE_KEY = 'bm:profile';
const RUN_INDEX_KEY = 'bm:runIndex';
const RUN_PREFIX = 'bm:run:';

export interface Profile {
  identifier: string;
  nickname: string;
  createdAt: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Quota or private-mode failure: data still lives in memory and the CSV
    // download path is unaffected.
    console.warn(`localStorage write failed for ${key}`, err);
  }
}

export function loadProfile(): Profile | null {
  return readJson<Profile>(PROFILE_KEY);
}

export function saveProfile(profile: Profile): void {
  writeJson(PROFILE_KEY, profile);
}

export function listRunIds(): string[] {
  return readJson<string[]>(RUN_INDEX_KEY) ?? [];
}

export function loadRun(id: string): RunRecord | null {
  return readJson<RunRecord>(RUN_PREFIX + id);
}

/** Insert/update a run; used incrementally during a run for crash safety. */
export function saveRun(record: RunRecord): void {
  writeJson(RUN_PREFIX + record.id, record);
  const ids = listRunIds();
  if (!ids.includes(record.id)) {
    ids.push(record.id);
    writeJson(RUN_INDEX_KEY, ids);
  }
}

export function deleteRun(id: string): void {
  localStorage.removeItem(RUN_PREFIX + id);
  writeJson(RUN_INDEX_KEY, listRunIds().filter((x) => x !== id));
}
