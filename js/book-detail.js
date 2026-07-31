// ============================================
// Book Detail Page Logic — Angel's Reading Corner
// ============================================
import { db } from './firebase-config.js';
import { logOut, onAuthChange, getCurrentUser, getUserProfile } from './auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// ---- Get Book ID from URL ----
const urlParams = new URLSearchParams(window.location.search);
const currentBookId = urlParams.get('id');

// ---- State ----
let currentBook = null;
let deleteTarget = null; // { type: 'book'|'note', noteId? }
let selectedRating = 0;
let selectedCoverFile = null;

// ---- DOM Elements ----
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const detailContainer = document.getElementById('detail-container');

// Hero elements
const detailCoverBox = document.getElementById('detail-cover-box');
const detailCoverImg = document.getElementById('detail-cover-img');
const detailTitle = document.getElementById('detail-title');
const detailGenre = document.getElementById('detail-genre');
const detailRating = document.getElementById('detail-rating');
const detailDate = document.getElementById('detail-date');
const detailPages = document.getElementById('detail-pages');
const btnEditBook = document.getElementById('btn-edit-book');
const btnDeleteBook = document.getElementById('btn-delete-book');

// Notes elements
const notesCountBadge = document.getElementById('notes-count-badge');
const btnAddNote = document.getElementById('btn-add-note');
const noteFormWrap = document.getElementById('note-form-wrap');
const noteFormTitle = document.getElementById('note-form-title');
const formNote = document.getElementById('form-note');
const noteEditId = document.getElementById('note-edit-id');
const noteTitleInput = document.getElementById('note-title');
const noteDescInput = document.getElementById('note-desc');
const notePageInput = document.getElementById('note-page');
const btnCancelNote = document.getElementById('btn-cancel-note');
const btnSaveNote = document.getElementById('btn-save-note');
const notesList = document.getElementById('notes-list');
const notesEmpty = document.getElementById('notes-empty');

// Edit Book Modal elements
const modalAddBook = document.getElementById('modal-add-book');
const formBook = document.getElementById('form-book');
const bookEditId = document.getElementById('book-edit-id');
const bookTitleInput = document.getElementById('book-title');
const bookCoverInput = document.getElementById('book-cover-input');
const coverUploadArea = document.getElementById('cover-upload-area');
const coverPreview = document.getElementById('cover-preview');
const bookDateInput = document.getElementById('book-date');
const bookPagesInput = document.getElementById('book-pages');
const bookGenreInput = document.getElementById('book-genre');
const bookRatingEl = document.getElementById('book-rating');
const btnSaveBookText = document.getElementById('btn-save-book-text');

// Confirm Delete elements
const modalConfirmDelete = document.getElementById('modal-confirm-delete');
const confirmTitle = document.getElementById('confirm-title');
const confirmDesc = document.getElementById('confirm-desc');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

// User Menu elements
const userAvatar = document.getElementById('user-avatar');
const userAvatarImg = document.getElementById('user-avatar-img');
const userMenu = document.getElementById('user-menu');
const menuAvatar = document.getElementById('menu-avatar');
const menuName = document.getElementById('menu-name');
const menuEmail = document.getElementById('menu-email');

// ============================================
// AUTH & INITIALIZATION
// ============================================
onAuthChange(async (user) => {
  if (user) {
    const profile = getUserProfile(user);
    userAvatarImg.src = profile.photoURL;
    menuAvatar.src = profile.photoURL;
    menuName.textContent = profile.displayName;
    menuEmail.textContent = profile.email;

    if (!currentBookId) {
      showErrorState();
      return;
    }
    await loadBookDetails();
  } else {
    window.location.href = 'index.html';
  }
});

// User menu toggle
userAvatar.addEventListener('click', (e) => {
  e.stopPropagation();
  userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('click', (e) => {
  if (!userMenu.contains(e.target) && e.target !== userAvatar) {
    userMenu.style.display = 'none';
  }
});

document.getElementById('btn-menu-logout').addEventListener('click', async () => {
  await logOut();
});

// ============================================
// MODALS LOGIC
// ============================================
function openModal(modal) {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    closeModal(document.getElementById(modalId));
  });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// ============================================
// LOAD BOOK & NOTES
// ============================================
async function loadBookDetails() {
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  loadingState.style.display = 'block';
  errorState.style.display = 'none';
  detailContainer.style.display = 'none';

  try {
    const bookRef = doc(db, 'users', user.uid, 'books', currentBookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      showErrorState();
      return;
    }

    currentBook = bookSnap.data();

    // Populate Book Info
    detailTitle.textContent = currentBook.title;
    detailGenre.textContent = currentBook.genre || 'General';
    detailRating.innerHTML = generateStars(currentBook.rating || 0);

    const dateRead = currentBook.dateRead
      ? (currentBook.dateRead.toDate ? currentBook.dateRead.toDate() : new Date(currentBook.dateRead))
      : null;
    detailDate.querySelector('span').textContent = dateRead
      ? dateRead.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'Date N/A';

    detailPages.querySelector('span').textContent = currentBook.pageCount
      ? `${currentBook.pageCount} pages`
      : 'Pages N/A';

    if (currentBook.coverUrl) {
      detailCoverBox.innerHTML = `<img id="detail-cover-img" src="${currentBook.coverUrl}" alt="${escapeHtml(currentBook.title)}">`;
    } else {
      detailCoverBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:3rem;background:linear-gradient(135deg, var(--beige-100), var(--beige-200));">📖</div>`;
    }

    // Load Notes
    await loadNotes();

    loadingState.style.display = 'none';
    detailContainer.style.display = 'block';
  } catch (error) {
    console.error('Error loading book details:', error);
    showErrorState();
  }
}

function showErrorState() {
  loadingState.style.display = 'none';
  detailContainer.style.display = 'none';
  errorState.style.display = 'block';
}

// ============================================
// LOAD & RENDER NOTES
// ============================================
async function loadNotes() {
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  notesList.innerHTML = '';
  notesEmpty.style.display = 'none';

  try {
    const notesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes');
    const notesSnap = await getDocs(query(notesRef, orderBy('createdAt', 'desc')));

    notesCountBadge.textContent = `${notesSnap.size} ${notesSnap.size === 1 ? 'note' : 'notes'}`;

    if (notesSnap.empty) {
      notesEmpty.style.display = 'block';
      return;
    }

    notesSnap.docs.forEach((noteDoc, index) => {
      const note = noteDoc.data();
      const noteEl = document.createElement('div');
      noteEl.className = 'note-card';
      noteEl.style.animationDelay = `${index * 0.05}s`;

      const createdAt = note.createdAt
        ? (note.createdAt.toDate ? note.createdAt.toDate() : new Date(note.createdAt))
        : null;
      const dateStr = createdAt
        ? createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

      noteEl.innerHTML = `
        <div class="note-card-header">
          <span class="note-card-title">${escapeHtml(note.title)}</span>
          <div class="note-card-actions">
            <button class="btn-note-edit" data-note-id="${noteDoc.id}" title="Edit Note">✏️</button>
            <button class="btn-note-delete" data-note-id="${noteDoc.id}" title="Delete Note">🗑️</button>
          </div>
        </div>
        <p class="note-card-desc">${escapeHtml(note.description)}</p>
        <div class="note-card-footer">
          ${note.pageOrChapter ? `<span>📄 ${escapeHtml(note.pageOrChapter)}</span>` : ''}
          ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
        </div>
      `;

      // Edit Note button
      noteEl.querySelector('.btn-note-edit').addEventListener('click', () => {
        noteFormTitle.textContent = 'Edit Note';
        noteEditId.value = noteDoc.id;
        noteTitleInput.value = note.title;
        noteDescInput.value = note.description;
        notePageInput.value = note.pageOrChapter || '';
        noteFormWrap.style.display = 'block';
        noteFormWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      // Delete Note button
      noteEl.querySelector('.btn-note-delete').addEventListener('click', () => {
        deleteTarget = { type: 'note', noteId: noteDoc.id };
        confirmTitle.textContent = 'Delete this note?';
        confirmDesc.textContent = 'This note will be permanently removed.';
        openModal(modalConfirmDelete);
      });

      notesList.appendChild(noteEl);
    });
  } catch (error) {
    console.error('Error loading notes:', error);
    showToast('Failed to load notes');
  }
}

// ============================================
// ADD / EDIT NOTE FORM
// ============================================
btnAddNote.addEventListener('click', () => {
  formNote.reset();
  noteEditId.value = '';
  noteFormTitle.textContent = 'New Note';
  noteFormWrap.style.display = 'block';
  noteFormWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

btnCancelNote.addEventListener('click', () => {
  noteFormWrap.style.display = 'none';
  formNote.reset();
  noteEditId.value = '';
});

formNote.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  btnSaveNote.disabled = true;
  btnSaveNote.textContent = 'Saving...';

  try {
    const noteData = {
      title: noteTitleInput.value.trim(),
      description: noteDescInput.value.trim(),
      pageOrChapter: notePageInput.value.trim(),
    };

    const editId = noteEditId.value;

    if (editId) {
      const noteRef = doc(db, 'users', user.uid, 'books', currentBookId, 'notes', editId);
      await updateDoc(noteRef, noteData);
      showToast('Note updated! ✏️');
    } else {
      noteData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'users', user.uid, 'books', currentBookId, 'notes'), noteData);
      showToast('Note added! 📝');
    }

    noteFormWrap.style.display = 'none';
    formNote.reset();
    noteEditId.value = '';
    await loadNotes();
  } catch (error) {
    console.error('Error saving note:', error);
    showToast('Failed to save note');
  } finally {
    btnSaveNote.disabled = false;
    btnSaveNote.textContent = 'Save Note';
  }
});

// ============================================
// EDIT BOOK LOGIC
// ============================================
btnEditBook.addEventListener('click', () => {
  if (!currentBook) return;

  resetBookForm();
  bookEditId.value = currentBookId;
  bookTitleInput.value = currentBook.title || '';
  bookPagesInput.value = currentBook.pageCount || '';
  bookGenreInput.value = currentBook.genre || '';
  selectedRating = currentBook.rating || 0;
  updateStarDisplay();

  const dateRead = currentBook.dateRead
    ? (currentBook.dateRead.toDate ? currentBook.dateRead.toDate() : new Date(currentBook.dateRead))
    : null;
  if (dateRead) {
    bookDateInput.value = dateRead.toISOString().split('T')[0];
  }

  if (currentBook.coverUrl) {
    coverPreview.innerHTML = `<img src="${currentBook.coverUrl}" alt="Cover preview">`;
    coverPreview.classList.add('has-image');
  }

  openModal(modalAddBook);
});

// Cover upload interaction
coverUploadArea.addEventListener('click', () => bookCoverInput.click());

bookCoverInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedCoverFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      coverPreview.innerHTML = `<img src="${ev.target.result}" alt="Cover preview">`;
      coverPreview.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  }
});

// Rating stars interaction
bookRatingEl.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.value);
    updateStarDisplay();
  });
  star.addEventListener('mouseenter', () => {
    const val = parseInt(star.dataset.value);
    bookRatingEl.querySelectorAll('.star').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.value) <= val);
    });
  });
});
bookRatingEl.addEventListener('mouseleave', updateStarDisplay);

function updateStarDisplay() {
  bookRatingEl.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
  });
}

function resetBookForm() {
  formBook.reset();
  bookEditId.value = '';
  selectedRating = 0;
  selectedCoverFile = null;
  coverPreview.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span>Tap to change cover</span>
  `;
  coverPreview.classList.remove('has-image');
  updateStarDisplay();
}

// Compress Image to Base64
function compressImage(file, maxWidth = 300, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Save edited book
formBook.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  const btnSave = document.getElementById('btn-save-book');
  btnSave.disabled = true;
  btnSaveBookText.textContent = 'Saving...';

  try {
    let coverUrl = currentBook.coverUrl || '';
    if (selectedCoverFile) {
      coverUrl = await compressImage(selectedCoverFile);
    }

    const bookData = {
      title: bookTitleInput.value.trim(),
      dateRead: Timestamp.fromDate(new Date(bookDateInput.value)),
      pageCount: parseInt(bookPagesInput.value) || 0,
      genre: bookGenreInput.value,
      rating: selectedRating,
      coverUrl: coverUrl
    };

    const bookRef = doc(db, 'users', user.uid, 'books', currentBookId);
    await updateDoc(bookRef, bookData);

    showToast('Book updated! ✏️');
    closeModal(modalAddBook);
    await loadBookDetails();
  } catch (error) {
    console.error('Error updating book:', error);
    showToast('Failed to update book');
  } finally {
    btnSave.disabled = false;
    btnSaveBookText.textContent = 'Update Book';
  }
});

// ============================================
// DELETE BOOK LOGIC
// ============================================
btnDeleteBook.addEventListener('click', () => {
  deleteTarget = { type: 'book' };
  confirmTitle.textContent = 'Delete this book?';
  confirmDesc.textContent = 'This will permanently delete the book and all its notes.';
  openModal(modalConfirmDelete);
});

btnConfirmDelete.addEventListener('click', async () => {
  if (!deleteTarget) return;
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  btnConfirmDelete.disabled = true;
  btnConfirmDelete.textContent = 'Deleting...';

  try {
    if (deleteTarget.type === 'book') {
      // Delete notes subcollection first
      const notesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes');
      const notesSnap = await getDocs(notesRef);
      for (const noteDoc of notesSnap.docs) {
        await deleteDoc(noteDoc.ref);
      }
      // Delete book doc
      await deleteDoc(doc(db, 'users', user.uid, 'books', currentBookId));

      showToast('Book deleted 🗑️');
      closeModal(modalConfirmDelete);
      // Redirect back to library
      window.location.href = 'library.html';

    } else if (deleteTarget.type === 'note') {
      const noteRef = doc(db, 'users', user.uid, 'books', currentBookId, 'notes', deleteTarget.noteId);
      await deleteDoc(noteRef);
      showToast('Note deleted 🗑️');

      closeModal(modalConfirmDelete);
      await loadNotes();
    }
  } catch (error) {
    console.error('Error deleting:', error);
    showToast('Failed to delete');
  } finally {
    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = 'Delete';
    deleteTarget = null;
  }
});

// ============================================
// HELPERS
// ============================================
function generateStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= rating ? 'active' : ''}">★</span>`;
  }
  return html;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
