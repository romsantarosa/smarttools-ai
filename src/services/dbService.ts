import {
  db,
  doc,
  setDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  FIREBASE_COLLECTIONS,
  auth,
} from './firebase';
import { BerthTurnUpdate } from '../types';

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
