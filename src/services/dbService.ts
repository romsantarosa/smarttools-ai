import {
  db,
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  FIREBASE_COLLECTIONS,
  auth,
} from './firebase';
import { BerthTurnUpdate, ShipInfo } from '../types';
import { SHIPS_CATALOG, inferCompanyByShipName } from '../data/shipsCatalog';

function resolveShipCompany(ship: Partial<ShipInfo>): string {
  const inferred = ship.name ? inferCompanyByShipName(ship.name) : 'OUTROS';
  const current = ship.company?.trim();

  if (!current) return inferred;
  if (current === 'OUTROS' && inferred !== 'OUTROS') return inferred;
  return current;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection
export async function testFirestoreConnection() {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn('Firestore is offline or unreachable.');
    }
    return false;
  }
}

// Helper to construct deterministic document ID for a date + turn + berth
export function getBerthTurnDocId(date: string, turn: string, berth: string): string {
  // sanitize
  const cleanBerth = berth.replace(/\s+/g, '_');
  return `${date}_${turn}_${cleanBerth}`;
}

// Save Berth Turn Update to Firestore
export async function saveBerthTurnUpdateToFirestore(update: BerthTurnUpdate): Promise<void> {
  if (!db) return;
  const path = FIREBASE_COLLECTIONS.BERTH_TURN_UPDATES;
  const docId = getBerthTurnDocId(update.date, update.turn, update.berth);

  try {
    const docRef = doc(db, path, docId);
    await setDoc(docRef, {
      ...update,
      id: docId,
      updatedAt: update.updatedAt || new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${docId}`);
  }
}

// Subscribe to real-time updates for berth_turn_updates
export function subscribeBerthTurnUpdates(
  onData: (updates: BerthTurnUpdate[]) => void
): () => void {
  if (!db) return () => {};

  const path = FIREBASE_COLLECTIONS.BERTH_TURN_UPDATES;
  try {
    const colRef = collection(db, path);
    const unsubscribe = onSnapshot(
      colRef,
      snapshot => {
        const list: BerthTurnUpdate[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as BerthTurnUpdate;
          if (data && data.date && data.turn && data.berth) {
            list.push(data);
          }
        });
        onData(list);
      },
      error => {
        console.warn('Error subscribing to berth_turn_updates:', error);
      }
    );
    return unsubscribe;
  } catch (error) {
    console.warn('Could not subscribe to berth_turn_updates:', error);
    return () => {};
  }
}

// Save ship into Firestore ships_btp collection
export async function saveShipToFirestore(ship: ShipInfo): Promise<void> {
  if (!db) return;

  const path = FIREBASE_COLLECTIONS.SHIPS;
  try {
    const shipRef = doc(db, path, ship.id);
    await setDoc(
      shipRef,
      {
        ...ship,
        updatedAt: ship.updatedAt || new Date().toISOString().split('T')[0],
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${ship.id}`);
  }
}

export async function deleteShipFromFirestore(shipId: string): Promise<void> {
  if (!db) return;

  const path = FIREBASE_COLLECTIONS.SHIPS;
  try {
    await deleteDoc(doc(db, path, shipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${shipId}`);
  }
}

export function subscribeShips(
  onData: (ships: ShipInfo[]) => void
): () => void {
  if (!db) return () => {};

  const path = FIREBASE_COLLECTIONS.SHIPS;
  try {
    const colRef = collection(db, path);
    const unsubscribe = onSnapshot(
      colRef,
      snapshot => {
        const list: ShipInfo[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as ShipInfo;
          if (data && data.name) {
            list.push({
              ...data,
              id: data.id || docSnap.id,
              company: resolveShipCompany(data),
            });
          }
        });

        list.sort((a, b) => a.name.localeCompare(b.name));
        onData(list);
      },
      error => {
        console.warn('Error subscribing to ships_btp:', error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.warn('Could not subscribe to ships_btp:', error);
    return () => {};
  }
}

export async function seedShipsCatalogIfEmpty(): Promise<void> {
  if (!db) return;

  const path = FIREBASE_COLLECTIONS.SHIPS;
  try {
    const colRef = collection(db, path);
    const snapshot = await getDocs(colRef);

    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const existingIds = new Set<string>();
    const existingNames = new Set<string>();
    const companyBackfills: Array<{ docId: string; company: string }> = [];
    const catalogCompanyByName = new Map(
      SHIPS_CATALOG.map(ship => [normalize(ship.name), ship.company || inferCompanyByShipName(ship.name)])
    );

    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Partial<ShipInfo>;
      existingIds.add(data.id || docSnap.id);
      if (data.name) {
        existingNames.add(normalize(data.name));

        const normalizedName = normalize(data.name);
        const inferredCompany = catalogCompanyByName.get(normalizedName) || inferCompanyByShipName(data.name);
        const currentCompany = data.company?.trim();

        if (!currentCompany || (currentCompany === 'OUTROS' && inferredCompany !== 'OUTROS')) {
          companyBackfills.push({ docId: docSnap.id, company: inferredCompany });
        }
      }
    });

    const missingShips = SHIPS_CATALOG.filter(ship => {
      const byIdExists = existingIds.has(ship.id);
      const byNameExists = existingNames.has(normalize(ship.name));
      return !byIdExists && !byNameExists;
    });

    const tasks: Promise<unknown>[] = [];

    if (missingShips.length > 0) {
      tasks.push(Promise.all(missingShips.map(ship => saveShipToFirestore(ship))));
    }

    if (companyBackfills.length > 0) {
      tasks.push(
        Promise.all(
          companyBackfills.map(item =>
            setDoc(doc(db, path, item.docId), { company: item.company }, { merge: true })
          )
        )
      );
    }

    if (tasks.length === 0) return;

    await Promise.all(tasks);
    console.log(
      `[Firestore Seed] ${missingShips.length} navios faltantes carregados e ${companyBackfills.length} company preenchidos em ${path}. Total catálogo: ${SHIPS_CATALOG.length}.`
    );
  } catch (error) {
    console.warn('Could not seed ships catalog to Firestore:', error);
  }
}
