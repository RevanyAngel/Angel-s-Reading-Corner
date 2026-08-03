// ============================================
// Landing Page Logic — Angel's Reading Corner
// ============================================
import { db } from './firebase-config.js';
import { signInWithGoogle, signInAsGuest, onAuthChange, getCurrentUser } from './auth.js';
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// DOM Elements
const authSection = document.getElementById('auth-section');
const quoteSection = document.getElementById('quote-section');
const welcomeSection = document.getElementById('welcome-section');
const ctaSection = document.getElementById('cta-section');
const btnGoogleSignin = document.getElementById('btn-google-signin');
const btnGuestSignin = document.getElementById('btn-guest-signin');
const quoteCoverImg = document.getElementById('quote-cover-img');
const quoteNoteTitle = document.getElementById('quote-note-title');
const quoteNoteDesc = document.getElementById('quote-note-desc');
const quoteBookTitle = document.getElementById('quote-book-title');

// Google Sign-In handler
btnGoogleSignin.addEventListener('click', async () => {
  try {
    btnGoogleSignin.disabled = true;
    if (btnGuestSignin) btnGuestSignin.disabled = true;
    btnGoogleSignin.querySelector('span').textContent = 'Signing in...';
    await signInWithGoogle();
  } catch (error) {
    showToast('Sign-in failed. Please try again.');
    btnGoogleSignin.disabled = false;
    if (btnGuestSignin) btnGuestSignin.disabled = false;
    btnGoogleSignin.querySelector('span').textContent = 'Sign in with Google';
  }
});

// Guest (Anonymous) Sign-In handler
if (btnGuestSignin) {
  btnGuestSignin.addEventListener('click', async () => {
    try {
      btnGuestSignin.disabled = true;
      btnGoogleSignin.disabled = true;
      btnGuestSignin.querySelector('span').textContent = 'Entering as Guest...';
      await signInAsGuest();
    } catch (error) {
      showToast('Guest entry failed. Please try again.');
      btnGuestSignin.disabled = false;
      btnGoogleSignin.disabled = false;
      btnGuestSignin.querySelector('span').textContent = 'Masuk Tanpa Login (Tamu)';
    }
  });
}

// Auth state listener
onAuthChange(async (user) => {
  if (user) {
    authSection.style.display = 'none';
    ctaSection.style.display = 'block';
    await loadRandomQuote(user);
  } else {
    authSection.style.display = 'flex';
    quoteSection.style.display = 'none';
    welcomeSection.style.display = 'none';
    ctaSection.style.display = 'none';
  }
});

// Load a random note as quote of the day
async function loadRandomQuote(user) {
  try {
    const booksRef = collection(db, 'users', user.uid, 'books');
    const booksSnap = await getDocs(booksRef);

    if (booksSnap.empty) {
      welcomeSection.style.display = 'flex';
      quoteSection.style.display = 'none';
      return;
    }

    // Gather all notes/entries from all books
    const allNotes = [];
    for (const bookDoc of booksSnap.docs) {
      const bookData = bookDoc.data();
      const notesRef = collection(db, 'users', user.uid, 'books', bookDoc.id, 'notes');
      const notesSnap = await getDocs(notesRef);

      for (const noteDoc of notesSnap.docs) {
        const noteData = noteDoc.data();
        const chapterStr = noteData.chapter || noteData.pageOrChapter || '';
        const fullNoteTitle = chapterStr ? `${chapterStr}: ${noteData.title}` : (noteData.title || '');

        try {
          const entriesRef = collection(db, 'users', user.uid, 'books', bookDoc.id, 'notes', noteDoc.id, 'entries');
          const entriesSnap = await getDocs(entriesRef);
          if (!entriesSnap.empty) {
            entriesSnap.docs.forEach(entryDoc => {
              const entryData = entryDoc.data();
              if (entryData.description) {
                allNotes.push({
                  title: fullNoteTitle,
                  description: entryData.description,
                  bookTitle: bookData.title,
                  bookCover: bookData.coverUrl
                });
              }
            });
          }
        } catch (e) {
          // ignore
        }

      }
    }

    if (allNotes.length === 0) {
      welcomeSection.style.display = 'flex';
      quoteSection.style.display = 'none';
      return;
    }

    // Pick random note
    const randomNote = allNotes[Math.floor(Math.random() * allNotes.length)];

    // Display
    quoteNoteTitle.textContent = randomNote.title;
    quoteNoteDesc.textContent = randomNote.description;
    quoteBookTitle.textContent = randomNote.bookTitle;

    if (randomNote.bookCover) {
      quoteCoverImg.src = randomNote.bookCover;
      quoteCoverImg.alt = randomNote.bookTitle;
    } else {
      quoteCoverImg.src = '';
      quoteCoverImg.parentElement.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:1.5rem;color:var(--gray-400);">&#9998;</span>';
    }

    quoteSection.style.display = 'flex';
    welcomeSection.style.display = 'none';

  } catch (error) {
    console.error('Error loading quote:', error);
    welcomeSection.style.display = 'flex';
    quoteSection.style.display = 'none';
  }
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
