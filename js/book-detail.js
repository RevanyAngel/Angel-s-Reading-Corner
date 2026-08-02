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
// For note entry modal: which note group we're adding to
let entryTargetNoteId = null;

// ---- DOM Elements ----
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const detailContainer = document.getElementById('detail-container');

// Hero elements
const detailCoverBox = document.getElementById('detail-cover-box');
const detailTitle = document.getElementById('detail-title');
const detailGenre = document.getElementById('detail-genre');
const detailRating = document.getElementById('detail-rating');
const detailDate = document.getElementById('detail-date');
const detailPages = document.getElementById('detail-pages');
const btnEditBook = document.getElementById('btn-edit-book');
const btnDeleteBook = document.getElementById('btn-delete-book');
const btnToggleEdit = document.getElementById('btn-toggle-edit');
const readingProgressWrap = document.getElementById('reading-progress-wrap');
const progressPercent = document.getElementById('progress-percent');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPagesInfo = document.getElementById('progress-pages-info');

// Mode state
let isEditMode = false;

// Notes elements
const notesCountBadge = document.getElementById('notes-count-badge');
const btnAddNote = document.getElementById('btn-add-note');
const notesList = document.getElementById('notes-list');
const notesEmpty = document.getElementById('notes-empty');
const notesSortSelect = document.getElementById('notes-sort-select');

if (notesSortSelect) {
  notesSortSelect.addEventListener('change', () => {
    loadNotes();
  });
}


// Modal: Add Note (title + chapter)
const modalAddNote = document.getElementById('modal-add-note');
const formAddNote = document.getElementById('form-add-note');
const newNoteTitleInput = document.getElementById('new-note-title');
const newNoteChapterInput = document.getElementById('new-note-chapter');

// Modal: Note Entry (description only)
const modalNoteEntry = document.getElementById('modal-note-entry');
const formNoteEntry = document.getElementById('form-note-entry');
const modalNoteEntryTitle = document.getElementById('modal-note-entry-title');
const noteEntryNoteId = document.getElementById('note-entry-note-id');
const noteEntryEntryId = document.getElementById('note-entry-entry-id');
const noteEntryDesc = document.getElementById('note-entry-desc');
const noteEntryDateDisplay = document.getElementById('note-entry-date-display');

// Edit Book Modal elements
const modalAddBook = document.getElementById('modal-add-book');
const formBook = document.getElementById('form-book');
const bookEditId = document.getElementById('book-edit-id');
const bookTitleInput = document.getElementById('book-title');
const bookCoverInput = document.getElementById('book-cover-input');
const coverUploadArea = document.getElementById('cover-upload-area');
const coverPreview = document.getElementById('cover-preview');
const bookDateInput = document.getElementById('book-date');
const bookTotalPagesInput = document.getElementById('book-total-pages');
const bookPagesDoneInput = document.getElementById('book-pages-done');
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
// EDIT MODE TOGGLE — top-right button
// ============================================
function updateEditModeUI() {
  if (isEditMode) {
    detailContainer.classList.remove('reading-mode');
    btnToggleEdit.textContent = 'Done';
    btnToggleEdit.classList.add('active');
  } else {
    detailContainer.classList.add('reading-mode');
    btnToggleEdit.textContent = 'Edit';
    btnToggleEdit.classList.remove('active');
  }
}

btnToggleEdit.addEventListener('click', () => {
  isEditMode = !isEditMode;
  updateEditModeUI();
});

// Hero card Edit Details button
if (btnEditBook) {
  btnEditBook.addEventListener('click', () => {
    if (!currentBook) return;
    resetBookForm();
    bookEditId.value = currentBookId;
    bookTotalPagesInput.value = currentBook.totalPages || '';
    bookPagesDoneInput.value = currentBook.pagesDone || '';
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
}


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

    const totalPages = currentBook.totalPages || 0;
    const pagesDone = currentBook.pagesDone || 0;

    // Show pages info
    if (totalPages > 0) {
      detailPages.querySelector('span').textContent = `${totalPages} pages`;
      // Show progress
      const pct = Math.min(Math.round((pagesDone / totalPages) * 100), 100);
      progressPercent.textContent = `${pct}%`;
      progressBarFill.style.width = `${pct}%`;
      progressPagesInfo.textContent = `${pagesDone} of ${totalPages} pages`;
      readingProgressWrap.style.display = 'block';
    } else {
      detailPages.querySelector('span').textContent = 'Pages N/A';
      readingProgressWrap.style.display = 'none';
    }

    if (currentBook.coverUrl) {
      detailCoverBox.innerHTML = `<img id="detail-cover-img" src="${currentBook.coverUrl}" alt="${escapeHtml(currentBook.title)}">`;
    } else {
      detailCoverBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:2.5rem;background:linear-gradient(135deg, var(--beige-100), var(--beige-200));color:var(--gray-400);">&#9998;</div>`;
    }

    // Show edit button & set Reading Mode by default
    btnToggleEdit.style.display = 'inline-flex';
    updateEditModeUI();

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
// LOAD & RENDER NOTES (grouped by chapter)
// ============================================
async function loadNotes() {
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  notesList.innerHTML = '';
  notesEmpty.style.display = 'none';

  try {
    const sortOrder = notesSortSelect ? notesSortSelect.value : 'asc';
    const notesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes');
    const notesSnap = await getDocs(query(notesRef, orderBy('createdAt', sortOrder)));


    notesCountBadge.textContent = `${notesSnap.size} ${notesSnap.size === 1 ? 'note' : 'notes'}`;

    if (notesSnap.empty) {
      notesEmpty.style.display = 'block';
      return;
    }

    for (const noteDoc of notesSnap.docs) {
      const note = noteDoc.data();
      await renderNoteGroup(noteDoc.id, note, user);
    }
  } catch (error) {
    console.error('Error loading notes:', error);
    showToast('Failed to load notes');
  }
}

async function renderNoteGroup(noteId, note, user) {
  const groupEl = document.createElement('div');
  groupEl.className = 'note-group';
  groupEl.dataset.noteId = noteId;

  // Load entries sub-collection
  let entriesHtml = '';
  let entriesData = [];
  try {
    const sortOrder = notesSortSelect ? notesSortSelect.value : 'asc';
    const entriesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes', noteId, 'entries');
    const entriesSnap = await getDocs(query(entriesRef, orderBy('createdAt', sortOrder)));

    entriesData = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const entry of entriesData) {
      const entryDate = entry.createdAt
        ? (entry.createdAt.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt))
        : null;
      const dateStr = entryDate
        ? entryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

      entriesHtml += `
        <div class="note-entry" data-entry-id="${entry.id}">
          <p class="note-entry-desc">${escapeHtml(entry.description)}</p>
          ${dateStr ? `<span class="note-entry-date">${dateStr}</span>` : ''}
          <div class="note-entry-actions edit-mode-only">
            <button class="btn-entry-edit" data-note-id="${noteId}" data-entry-id="${entry.id}" title="Edit">Edit</button>
            <button class="btn-entry-delete" data-note-id="${noteId}" data-entry-id="${entry.id}" title="Delete">Delete</button>
          </div>
        </div>
      `;
    }
  } catch (e) {
    // no entries subcollection
  }

  // Fallback for legacy notes created before the new chapter/entry structure
  if (entriesData.length === 0 && note.description) {
    const legacyDate = note.createdAt
      ? (note.createdAt.toDate ? note.createdAt.toDate() : new Date(note.createdAt))
      : null;
    const legacyDateStr = legacyDate
      ? legacyDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';

    entriesHtml = `
      <div class="note-entry legacy-entry">
        <p class="note-entry-desc">${escapeHtml(note.description)}</p>
        ${legacyDateStr ? `<span class="note-entry-date">${legacyDateStr}</span>` : ''}
      </div>
    `;
  }

  const chapterDisplay = note.chapter || note.pageOrChapter || '';

  groupEl.innerHTML = `
    <div class="note-group-header">
      <div class="note-group-title-wrap">
        ${chapterDisplay ? `<span class="note-group-chapter">${escapeHtml(chapterDisplay)}</span>` : ''}
        <span class="note-group-title">${escapeHtml(note.title)}</span>
      </div>
      <div class="note-group-actions">
        <button class="btn-note-add-entry btn btn-primary btn-sm edit-mode-only" data-note-id="${noteId}">+ Entry</button>
        <button class="btn-note-delete-group btn-icon-text edit-mode-only" data-note-id="${noteId}" title="Delete note">Delete</button>
      </div>
    </div>
    <div class="note-entries">
      ${entriesHtml || '<p class="note-entries-empty">No entries yet.</p>'}
    </div>
  `;

  // Add entry button
  groupEl.querySelector('.btn-note-add-entry').addEventListener('click', () => {
    openNoteEntryModal(noteId, note.title, note.chapter, null, null);
  });

  // Delete note group
  groupEl.querySelector('.btn-note-delete-group').addEventListener('click', () => {
    deleteTarget = { type: 'note', noteId };
    confirmTitle.textContent = 'Delete this note?';
    confirmDesc.textContent = 'This note and all its entries will be permanently removed.';
    openModal(modalConfirmDelete);
  });

  // Edit entry buttons
  groupEl.querySelectorAll('.btn-entry-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const eNoteId = btn.dataset.noteId;
      const eEntryId = btn.dataset.entryId;
      const entry = entriesData.find(e => e.id === eEntryId);
      if (entry) {
        openNoteEntryModal(eNoteId, note.title, note.chapter, eEntryId, entry.description);
      }
    });
  });

  // Delete entry buttons
  groupEl.querySelectorAll('.btn-entry-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const eNoteId = btn.dataset.noteId;
      const eEntryId = btn.dataset.entryId;
      deleteTarget = { type: 'entry', noteId: eNoteId, entryId: eEntryId };
      confirmTitle.textContent = 'Delete this entry?';
      confirmDesc.textContent = 'This entry will be permanently removed.';
      openModal(modalConfirmDelete);
    });
  });

  notesList.appendChild(groupEl);
}

// ============================================
// NOTE ENTRY MODAL
// ============================================
function openNoteEntryModal(noteId, noteTitle, chapter, entryId, existingDesc) {
  entryTargetNoteId = noteId;
  noteEntryNoteId.value = noteId;
  noteEntryEntryId.value = entryId || '';
  noteEntryDesc.value = existingDesc || '';

  const isEdit = !!entryId;
  modalNoteEntryTitle.textContent = isEdit ? 'Edit Entry' : `Add Entry — ${chapter || noteTitle}`;

  // Show auto date
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  noteEntryDateDisplay.textContent = isEdit ? 'Existing entry' : dateStr;

  document.getElementById('btn-save-note-entry').textContent = isEdit ? 'Update' : 'Save';

  openModal(modalNoteEntry);
}

formNoteEntry.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  const btnSave = document.getElementById('btn-save-note-entry');
  btnSave.disabled = true;
  btnSave.textContent = 'Saving...';

  const nId = noteEntryNoteId.value;
  const eId = noteEntryEntryId.value;
  const desc = noteEntryDesc.value.trim();

  try {
    const entriesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes', nId, 'entries');

    if (eId) {
      const entryRef = doc(db, 'users', user.uid, 'books', currentBookId, 'notes', nId, 'entries', eId);
      await updateDoc(entryRef, { description: desc });
      showToast('Entry updated');
    } else {
      await addDoc(entriesRef, {
        description: desc,
        createdAt: serverTimestamp()
      });
      showToast('Entry added');
    }

    closeModal(modalNoteEntry);
    formNoteEntry.reset();
    await loadNotes();
  } catch (err) {
    console.error('Error saving entry:', err);
    showToast('Failed to save entry');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Save';
  }
});

// ============================================
// ADD NOTE (title + chapter)
// ============================================
btnAddNote.addEventListener('click', () => {
  formAddNote.reset();
  openModal(modalAddNote);
});

formAddNote.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  const btnSave = document.getElementById('btn-save-new-note');
  btnSave.disabled = true;
  btnSave.textContent = 'Creating...';

  try {
    const noteData = {
      title: newNoteTitleInput.value.trim(),
      chapter: newNoteChapterInput.value.trim(),
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'users', user.uid, 'books', currentBookId, 'notes'), noteData);
    showToast('Note created');
    closeModal(modalAddNote);
    formAddNote.reset();
    await loadNotes();
  } catch (err) {
    console.error('Error creating note:', err);
    showToast('Failed to create note');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Create';
  }
});

// ============================================
// EDIT BOOK LOGIC
// ============================================
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

    const totalPages = parseInt(bookTotalPagesInput.value) || 0;
    const pagesDone = parseInt(bookPagesDoneInput.value) || 0;

    const bookData = {
      title: bookTitleInput.value.trim(),
      dateRead: Timestamp.fromDate(new Date(bookDateInput.value)),
      totalPages: totalPages,
      pagesDone: Math.min(pagesDone, totalPages),
      genre: bookGenreInput.value,
      rating: selectedRating,
      coverUrl: coverUrl
    };

    const bookRef = doc(db, 'users', user.uid, 'books', currentBookId);
    await updateDoc(bookRef, bookData);

    showToast('Book updated');
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
// DELETE BOOK / NOTE / ENTRY LOGIC
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
        // Delete entries sub-sub-collection
        const entriesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes', noteDoc.id, 'entries');
        const entriesSnap = await getDocs(entriesRef);
        for (const entryDoc of entriesSnap.docs) {
          await deleteDoc(entryDoc.ref);
        }
        await deleteDoc(noteDoc.ref);
      }
      // Delete book doc
      await deleteDoc(doc(db, 'users', user.uid, 'books', currentBookId));

      showToast('Book deleted');
      closeModal(modalConfirmDelete);
      window.location.href = 'library.html';

    } else if (deleteTarget.type === 'note') {
      // Delete entries sub-collection first
      const entriesRef = collection(db, 'users', user.uid, 'books', currentBookId, 'notes', deleteTarget.noteId, 'entries');
      const entriesSnap = await getDocs(entriesRef);
      for (const entryDoc of entriesSnap.docs) {
        await deleteDoc(entryDoc.ref);
      }
      const noteRef = doc(db, 'users', user.uid, 'books', currentBookId, 'notes', deleteTarget.noteId);
      await deleteDoc(noteRef);
      showToast('Note deleted');

      closeModal(modalConfirmDelete);
      await loadNotes();

    } else if (deleteTarget.type === 'entry') {
      const entryRef = doc(db, 'users', user.uid, 'books', currentBookId, 'notes', deleteTarget.noteId, 'entries', deleteTarget.entryId);
      await deleteDoc(entryRef);
      showToast('Entry deleted');

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
