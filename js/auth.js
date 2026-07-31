// ============================================
// Authentication — Angel's Reading Corner
// ============================================
import { auth } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const provider = new GoogleAuthProvider();

export const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236E6A64'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-.99 2.01-1.8 4.84-1.8s4.81.81 4.84 1.8c-1.04 1.56-2.81 2.6-4.84 2.6z'/%3E%3C/svg%3E";

// Local Guest Storage & Listeners
const LOCAL_GUEST_KEY = 'arc_guest_user';
const authListeners = [];

function getLocalGuestUser() {
  const data = localStorage.getItem(LOCAL_GUEST_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

function createLocalGuestUser() {
  let guestId = localStorage.getItem('arc_guest_id');
  if (!guestId) {
    guestId = 'guest_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('arc_guest_id', guestId);
  }
  const guestUser = {
    uid: guestId,
    isAnonymous: true,
    displayName: 'Tamu',
    email: '',
    photoURL: null
  };
  localStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(guestUser));
  return guestUser;
}

function clearLocalGuestUser() {
  localStorage.removeItem(LOCAL_GUEST_KEY);
}

function notifyListeners(user) {
  authListeners.forEach(cb => cb(user));
}

// Sign in with Google popup
export async function signInWithGoogle() {
  try {
    clearLocalGuestUser();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  }
}

// Sign in anonymously (Guest with fallback)
export async function signInAsGuest() {
  try {
    const result = await signInAnonymously(auth);
    clearLocalGuestUser();
    return result.user;
  } catch (error) {
    console.warn('Firebase Anonymous auth failed (likely disabled in console). Using Local Guest fallback:', error);
    const guestUser = createLocalGuestUser();
    notifyListeners(guestUser);
    return guestUser;
  }
}

// Sign out
export async function logOut() {
  try {
    clearLocalGuestUser();
    await signOut(auth);
    notifyListeners(null);
  } catch (error) {
    console.error('Sign-out error:', error);
    clearLocalGuestUser();
    notifyListeners(null);
    throw error;
  }
}

// Listen to auth state changes
export function onAuthChange(callback) {
  if (!authListeners.includes(callback)) {
    authListeners.push(callback);
  }

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      clearLocalGuestUser();
      callback(user);
    } else {
      const localGuest = getLocalGuestUser();
      if (localGuest) {
        callback(localGuest);
      } else {
        callback(null);
      }
    }
  });
}

// Get current user
export function getCurrentUser() {
  return auth.currentUser || getLocalGuestUser();
}

// Get formatted user profile (handles guest fallback)
export function getUserProfile(user) {
  if (!user) return null;
  return {
    photoURL: user.photoURL || DEFAULT_AVATAR,
    displayName: user.displayName || (user.isAnonymous ? 'Tamu' : 'User'),
    email: user.email || (user.isAnonymous ? 'Akun Tamu (Anonymous)' : '')
  };
}

