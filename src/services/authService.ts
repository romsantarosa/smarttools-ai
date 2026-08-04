import {
  auth,
  db,
  googleProvider,
  facebookProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  signOut,
  doc,
  setDoc,
  getDoc,
  FIREBASE_COLLECTIONS,
} from './firebase';
import { User } from '../types';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: 'Supervisor' | 'Operador';
}

/**
 * Format Firebase user into the App's User shape
 */
function buildAppUser(
  uid: string,
  email: string,
  displayName?: string | null,
  role: 'Supervisor' | 'Operador' = 'Supervisor',
  photoURL?: string | null
): User {
  const formattedName =
    displayName ||
    email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase() ||
    'Usuário BTP';

  return {
    id: uid,
    name: formattedName,
    email,
    role,
    registrationNumber: 'BTP-' + uid.slice(0, 4).toUpperCase(),
    shiftTurn: '07-13',
    avatarUrl: photoURL || undefined,
  };
}

/**
 * Save user profile to Firestore `users` collection
 */
export async function saveUserToFirestore(
  uid: string,
  email: string,
  name: string,
  role: 'Supervisor' | 'Operador' = 'Supervisor',
  provider: string = 'email'
) {
  if (!db) return;
  try {
    const userRef = doc(db, FIREBASE_COLLECTIONS.USERS, uid);
    await setDoc(
      userRef,
      {
        uid,
        email,
        name,
        role,
        provider,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore user save warning:', err);
  }
}

/**
 * Fetch user profile from Firestore if it exists
 */
export async function fetchUserFromFirestore(uid: string): Promise<Partial<User> | null> {
  if (!db) return null;
  try {
    const userRef = doc(db, FIREBASE_COLLECTIONS.USERS, uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as Partial<User>;
    }
  } catch (err) {
    console.warn('Firestore fetch user warning:', err);
  }
  return null;
}

/**
 * Register user in Firebase Authentication and Firestore.
 *
 * IMPORTANTE: contas novas SEMPRE nascem como 'Operador', mesmo que o
 * chamador peça 'Supervisor'. Não existe hoje um fluxo de aprovação/admin
 * para promover alguém a Supervisor — enquanto isso não existir, permitir
 * que o próprio formulário de cadastro defina o papel é uma brecha de
 * auto-promoção. As regras do Firestore também bloqueiam isso no banco,
 * mas a checagem aqui evita até a tentativa.
 */
export async function registerWithFirebase(data: RegisterData): Promise<User> {
  const safeRole: 'Operador' = 'Operador';

  if (!auth) {
    const name = data.name || data.email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase();
    return buildAppUser(`local_${Date.now()}`, data.email, name, safeRole);
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const fbUser = credential.user;

    // Save profile to Firestore
    await saveUserToFirestore(fbUser.uid, data.email, data.name, safeRole, 'password');

    return buildAppUser(fbUser.uid, data.email, data.name, safeRole, fbUser.photoURL);
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      // Conta já existe: o papel real vem do Firestore dentro de loginWithFirebase,
      // não do formulário de cadastro.
      return loginWithFirebase(data.email, data.password);
    }
    if (err?.code === 'auth/operation-not-allowed') {
      console.warn('Firebase Auth: O provedor E-mail/Senha não está ativado no Firebase Console. Alternando para sessão local.');
      const fallbackUid = 'local_' + Date.now();
      try {
        await saveUserToFirestore(fallbackUid, data.email, data.name, safeRole, 'password');
      } catch (e) {
        // Ignore Firestore write error if unauthenticated
      }
      return buildAppUser(fallbackUid, data.email, data.name, safeRole);
    }
    throw err;
  }
}

/**
 * Login with Email & Password in Firebase.
 *
 * `defaultRole` só é usado como fallback de exibição quando não existe
 * nenhum perfil no Firestore ainda (ex.: modo local sem Firebase
 * configurado). Para contas que acabam de ser criadas automaticamente
 * durante o login (usuário não existia), o papel é sempre 'Operador' —
 * nunca o valor vindo do formulário.
 */
export async function loginWithFirebase(
  email: string,
  password: string,
  defaultRole: 'Supervisor' | 'Operador' = 'Operador'
): Promise<User> {
  if (!auth) {
    const name = email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase() || 'Usuário BTP';
    return buildAppUser(`local_${Date.now()}`, email, name, defaultRole);
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const fbUser = credential.user;

    // Check Firestore for stored role/name
    const firestoreProfile = await fetchUserFromFirestore(fbUser.uid);
    const role = firestoreProfile?.role || defaultRole;
    const name = firestoreProfile?.name || fbUser.displayName;

    return buildAppUser(fbUser.uid, fbUser.email || email, name, role as any, fbUser.photoURL);
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') {
      console.warn('Firebase Auth: Provedor Email/Senha desativado no Firebase Console. Alternando para sessão local.');
      const name = email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase() || 'Usuário BTP';
      const fallbackUid = 'local_' + Math.abs(email.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0));
      return buildAppUser(fallbackUid, email, name, defaultRole);
    }
    // If account does not exist yet in Firebase Auth, automatically create it on the fly.
    // Papel sempre 'Operador' aqui — é criação de conta nova, mesma regra do registerWithFirebase.
    if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-credential') {
      const safeRole: 'Operador' = 'Operador';
      try {
        const newCredential = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = newCredential.user;
        const name = email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase() || 'Usuário BTP';

        await saveUserToFirestore(fbUser.uid, email, name, safeRole, 'password');
        return buildAppUser(fbUser.uid, email, name, safeRole, fbUser.photoURL);
      } catch (createErr: any) {
        if (createErr?.code === 'auth/operation-not-allowed') {
          const name = email.split('@')[0].replace(/[\._-]/g, ' ').toUpperCase() || 'Usuário BTP';
          const fallbackUid = 'local_' + Math.abs(email.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0));
          return buildAppUser(fallbackUid, email, name, safeRole);
        }
      }
    }
    throw err;
  }
}

/**
 * Login with Google / Gmail Popup.
 *
 * Antes: toda conta Google nova virava 'Supervisor' automaticamente — ou
 * seja, qualquer pessoa com conta Google ganhava acesso de supervisor só
 * clicando em "Entrar com Google". Agora: se já existe perfil no Firestore,
 * usa o papel real salvo lá; se é a primeira vez, nasce como 'Operador'.
 */
export async function loginWithGoogleFirebase(): Promise<User> {
  if (!auth) {
    return buildAppUser('google_local_' + Date.now(), 'usuario.google@btp.com.br', 'Usuário Google', 'Operador');
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    const email = fbUser.email || 'usuario.google@btp.com.br';
    const name = fbUser.displayName || 'Usuário Google';

    const firestoreProfile = await fetchUserFromFirestore(fbUser.uid);
    const role = (firestoreProfile?.role as 'Supervisor' | 'Operador' | undefined) || 'Operador';

    if (!firestoreProfile) {
      await saveUserToFirestore(fbUser.uid, email, name, role, 'google.com');
    }

    return buildAppUser(fbUser.uid, email, firestoreProfile?.name || name, role, fbUser.photoURL);
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') {
      console.warn('Firebase Auth: Login Google não ativado no Firebase Console. Alternando para login local Google.');
      return buildAppUser('google_local_' + Date.now(), 'usuario.google@btp.com.br', 'Usuário Google (Local)', 'Operador');
    }
    if (err?.code === 'auth/unauthorized-domain') {
      console.warn('Firebase Auth: Domínio não autorizado para Google Sign-In. Alternando para login local Google.');
      return buildAppUser('google_local_' + Date.now(), 'usuario.google@btp.com.br', 'Usuário Google (Local)', 'Operador');
    }
    throw err;
  }
}

/**
 * Login with Facebook Popup.
 *
 * Mesmo princípio do login Google: usa o papel já salvo no Firestore se a
 * conta já existir (evita rebaixar um Supervisor de volta a Operador a
 * cada login), e só define 'Operador' na primeira vez que a conta aparece.
 */
export async function loginWithFacebookFirebase(): Promise<User> {
  if (!auth) {
    return buildAppUser('facebook_local_' + Date.now(), 'usuario.facebook@btp.com.br', 'Usuário Facebook', 'Operador');
  }

  try {
    const result = await signInWithPopup(auth, facebookProvider);
    const fbUser = result.user;

    const email = fbUser.email || 'usuario.facebook@btp.com.br';
    const name = fbUser.displayName || 'Usuário Facebook';

    const firestoreProfile = await fetchUserFromFirestore(fbUser.uid);
    const role = (firestoreProfile?.role as 'Supervisor' | 'Operador' | undefined) || 'Operador';

    if (!firestoreProfile) {
      await saveUserToFirestore(fbUser.uid, email, name, role, 'facebook.com');
    }

    return buildAppUser(fbUser.uid, email, firestoreProfile?.name || name, role, fbUser.photoURL);
  } catch (err: any) {
    if (err?.code === 'auth/operation-not-allowed') {
      console.warn('Firebase Auth: Login Facebook não ativado no Firebase Console. Alternando para login local Facebook.');
      return buildAppUser('facebook_local_' + Date.now(), 'usuario.facebook@btp.com.br', 'Usuário Facebook (Local)', 'Operador');
    }
    if (err?.code === 'auth/unauthorized-domain') {
      console.warn('Firebase Auth: Domínio não autorizado para Facebook Sign-In. Alternando para login local Facebook.');
      return buildAppUser('facebook_local_' + Date.now(), 'usuario.facebook@btp.com.br', 'Usuário Facebook (Local)', 'Operador');
    }
    throw err;
  }
}

/**
 * Send Password Reset Email via Firebase
 */
export async function resetPasswordFirebase(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Auth não disponível.');
  }
  await sendPasswordResetEmail(auth, email);
}

/**
 * Change Password for logged in user
 */
export async function changePasswordFirebase(newPassword: string): Promise<void> {
  if (!auth || !auth.currentUser) {
    throw new Error('Nenhum usuário logado no Firebase para alterar a senha.');
  }
  await updatePassword(auth.currentUser, newPassword);
}

/**
 * Logout from Firebase Auth
 */
export async function logoutFirebase(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Helper to translate Firebase Auth Error codes to Portuguese
 */
export function getFirebaseErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail informado é inválido.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado no Firebase. Faça login ou solicite a redefinição de senha.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/popup-closed-by-user':
      return 'A janela de login com conta social foi fechada antes de concluir a autenticação.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela de login social. Permita popups para continuar.';
    case 'auth/cancelled-popup-request':
      return 'Solicitação de login popup cancelada.';
    case 'auth/operation-not-allowed':
      return 'O método de autenticação (E-mail/Senha, Google ou Facebook) precisa ser ativado no Firebase Console em "Authentication > Sign-in method". Você também pode usar o acesso local da instalação para continuar.';
    case 'auth/unauthorized-domain':
      return 'Este domínio não está autorizado no Console do Firebase (Authentication > Settings > Authorized Domains). Enquanto isso, use "Entrar como Supervisor (Modo Rápido / Local)".';
    case 'auth/requires-recent-login':
      return 'Por segurança, faça login novamente no sistema antes de alterar sua senha.';
    default:
      return error?.message || 'Ocorreu um erro ao autenticar no Firebase. Tente novamente.';
  }
}