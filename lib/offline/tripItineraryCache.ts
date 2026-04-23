const DB_NAME = "bb-offline-v1";
const DB_VERSION = 1;
const STORE_TRIPS = "trips";
const STORE_GROUP_MAP = "groupTripId";

const CACHE_RECORD_VERSION = 1 as const;

export type CachedTripItineraryRecord = {
  tripId: string;
  groupId: string;
  payload: Record<string, unknown>;
  itineraryVersion: number;
  cacheRecordVersion: typeof CACHE_RECORD_VERSION;
  updatedAt: number;
  savedByUser: boolean;
  savedAt: number | null;
  lastSyncedAt: number | null;
};

function idb(): IDBFactory | null {
  if (typeof globalThis === "undefined") return null;
  return globalThis.indexedDB ?? null;
}

function openDb(): Promise<IDBDatabase> {
  const f = idb();
  if (!f) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  return new Promise((resolve, reject) => {
    const req = f.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = (ev.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        db.createObjectStore(STORE_TRIPS, { keyPath: "tripId" });
      }
      if (!db.objectStoreNames.contains(STORE_GROUP_MAP)) {
        db.createObjectStore(STORE_GROUP_MAP, { keyPath: "groupId" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function normalizeTripRow(
  row: CachedTripItineraryRecord | undefined,
): CachedTripItineraryRecord | null {
  if (!row) return null;
  const savedByUser = row.savedByUser === true;
  const savedAt = !savedByUser
    ? null
    : typeof row.savedAt === "number"
      ? row.savedAt
      : typeof row.updatedAt === "number"
        ? row.updatedAt
        : null;
  const lastSyncedAt =
    typeof row.lastSyncedAt === "number"
      ? row.lastSyncedAt
      : savedByUser && typeof row.updatedAt === "number"
        ? row.updatedAt
        : null;
  return {
    ...row,
    savedByUser,
    savedAt,
    lastSyncedAt,
  };
}

export function isItineraryCacheSupported(): boolean {
  return idb() != null;
}

export async function putGroupTripIdMapping(
  groupId: string,
  tripId: string,
): Promise<void> {
  if (!idb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE_GROUP_MAP, "readwrite");
  const store = tx.objectStore(STORE_GROUP_MAP);
  store.put({ groupId, tripId, updatedAt: Date.now() });
  await txDone(tx);
  db.close();
}

export async function getTripIdForGroup(groupId: string): Promise<string | null> {
  if (!idb()) return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_GROUP_MAP, "readonly");
    const store = tx.objectStore(STORE_GROUP_MAP);
    const p = new Promise<Record<string, unknown> | undefined>((res, rej) => {
      const r = store.get(groupId);
      r.onerror = () => rej(r.error);
      r.onsuccess = () => res(r.result as Record<string, unknown> | undefined);
    });
    const row = await p;
    await txDone(tx);
    db.close();
    const id = row?.tripId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

function payloadItineraryVersion(p: Record<string, unknown>): number {
  return typeof p.itineraryVersion === "number" ? p.itineraryVersion : 0;
}

async function putTripRecord(rec: CachedTripItineraryRecord): Promise<void> {
  if (!idb()) return;
  const db = await openDb();
  const tx = db.transaction(STORE_TRIPS, "readwrite");
  tx.objectStore(STORE_TRIPS).put(rec);
  await txDone(tx);
  db.close();
  await putGroupTripIdMapping(rec.groupId, rec.tripId);
}

export async function saveUserOfflineItinerary(
  tripId: string,
  groupId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!idb()) return;
  const now = Date.now();
  const prev = normalizeTripRow(
    (await getFullTripItineraryCacheRaw(tripId)) ?? undefined,
  );
  const firstSaveAt = prev?.savedByUser === true && prev.savedAt != null ? prev.savedAt : now;
  const rec: CachedTripItineraryRecord = {
    tripId,
    groupId,
    payload: { ...payload },
    itineraryVersion: payloadItineraryVersion(payload),
    cacheRecordVersion: CACHE_RECORD_VERSION,
    updatedAt: now,
    savedByUser: true,
    savedAt: firstSaveAt,
    lastSyncedAt: now,
  };
  await putTripRecord(rec);
}

export async function syncUserSavedOfflinePayload(
  tripId: string,
  groupId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!idb()) return false;
  const cur = normalizeTripRow(
    (await getFullTripItineraryCacheRaw(tripId)) ?? undefined,
  );
  if (!cur?.savedByUser) return false;
  const now = Date.now();
  const rec: CachedTripItineraryRecord = {
    ...cur,
    payload: { ...payload },
    itineraryVersion: payloadItineraryVersion(payload),
    updatedAt: now,
    lastSyncedAt: now,
  };
  await putTripRecord(rec);
  return true;
}

async function getFullTripItineraryCacheRaw(
  tripId: string,
): Promise<CachedTripItineraryRecord | undefined> {
  if (!idb()) return undefined;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_TRIPS, "readonly");
    const store = tx.objectStore(STORE_TRIPS);
    const row = await new Promise<CachedTripItineraryRecord | undefined>(
      (resolve, reject) => {
        const r = store.get(tripId);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => resolve(r.result as CachedTripItineraryRecord | undefined);
      },
    );
    await txDone(tx);
    db.close();
    return row;
  } catch {
    return undefined;
  }
}

export async function getFullTripItineraryCache(
  tripId: string,
): Promise<CachedTripItineraryRecord | null> {
  const raw = await getFullTripItineraryCacheRaw(tripId);
  return normalizeTripRow(raw);
}

function hasValidPayloadShape(p: Record<string, unknown>): boolean {
  return (
    p._id != null &&
    Array.isArray(p.primaryItinerary) &&
    Array.isArray(p.rainyDayItinerary)
  );
}

export async function hasUserSavedOfflineItineraryForGroup(
  groupId: string,
): Promise<boolean> {
  const tid = await getTripIdForGroup(groupId);
  if (!tid) return false;
  const r = await getFullTripItineraryCache(tid);
  if (!r?.savedByUser || !r.payload) return false;
  return hasValidPayloadShape(r.payload);
}

export async function patchItineraryInCache(
  tripId: string,
  groupId: string,
  update: {
    primaryItinerary: unknown;
    rainyDayItinerary: unknown;
    itineraryVersion: number;
  },
): Promise<void> {
  if (!idb()) return;
  const cur = await getFullTripItineraryCache(tripId);
  if (!cur?.savedByUser) return;
  const base: Record<string, unknown> = { ...cur.payload };
  const next: Record<string, unknown> = {
    ...base,
    primaryItinerary: update.primaryItinerary,
    rainyDayItinerary: update.rainyDayItinerary,
    itineraryVersion: update.itineraryVersion,
  };
  const now = Date.now();
  await putTripRecord({
    ...cur,
    payload: next,
    itineraryVersion: update.itineraryVersion,
    updatedAt: now,
    lastSyncedAt: now,
  });
}

export async function deleteTripItineraryCache(tripId: string, groupId: string) {
  if (!idb()) return;
  const db = await openDb();
  const tx = db.transaction([STORE_TRIPS, STORE_GROUP_MAP], "readwrite");
  tx.objectStore(STORE_TRIPS).delete(tripId);
  tx.objectStore(STORE_GROUP_MAP).delete(groupId);
  await txDone(tx);
  db.close();
}

export { CACHE_RECORD_VERSION };
