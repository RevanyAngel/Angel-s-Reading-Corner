// ============================================
// Library Page Logic — Angel's Reading Corner
// ============================================
import { db } from './firebase-config.js';
import { signInWithGoogle, logOut, onAuthChange, getCurrentUser } from './auth.js';
import { getReadingStats } from './stats.js';
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
// Base64 image compression utility (replaces Firebase Storage — free!)
function compressImage(file, maxWidth = 300, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize proportionally
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG base64
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---- State ----
let allBooks = [];
let currentBookId = null;
let deleteTarget = null; // { type: 'book'|'note', bookId, noteId? }

// ---- DOM Elements ----
const bookGrid = document.getElementById('book-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const searchInput = document.getElementById('search-input');
const filterGenre = document.getElementById('filter-genre');
const sortBy = document.getElementById('sort-by');

// Add/Edit Book modal
const modalAddBook = document.getElementById('modal-add-book');
const formBook = document.getElementById('form-book');
const bookEditId = document.getElementById('book-edit-id');
const modalBookTitle = document.getElementById('modal-book-title');
const bookTitleInput = document.getElementById('book-title');
const bookCoverInput = document.getElementById('book-cover-input');
const coverUploadArea = document.getElementById('cover-upload-area');
const coverPreview = document.getElementById('cover-preview');
const bookDateInput = document.getElementById('book-date');
const bookPagesInput = document.getElementById('book-pages');
const bookGenreInput = document.getElementById('book-genre');
const bookRatingEl = document.getElementById('book-rating');
const btnSaveBookText = document.getElementById('btn-save-book-text');

// Book Detail modal
const modalBookDetail = document.getElementById('modal-book-detail');
const detailCoverImg = document.getElementById('detail-cover-img');
const detailTitle = document.getElementById('detail-title');
const detailGenre = document.getElementById('detail-genre');
const detailRating = document.getElementById('detail-rating');
const detailDate = document.getElementById('detail-date');
const detailPages = document.getElementById('detail-pages');
const notesList = document.getElementById('notes-list');
const notesEmpty = document.getElementById('notes-empty');

// Note form
const noteFormWrap = document.getElementById('note-form-wrap');
const formNote = document.getElementById('form-note');
const noteEditId = document.getElementById('note-edit-id');
const noteTitleInput = document.getElementById('note-title');
const noteDescInput = document.getElementById('note-desc');
const notePageInput = document.getElementById('note-page');

// Stats modal
const modalStats = document.getElementById('modal-stats');

// Delete confirm modal
const modalConfirmDelete = document.getElementById('modal-confirm-delete');
const confirmTitle = document.getElementById('confirm-title');
const confirmDesc = document.getElementById('confirm-desc');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');

// User menu
const userAvatar = document.getElementById('user-avatar');
const userAvatarImg = document.getElementById('user-avatar-img');
const userMenu = document.getElementById('user-menu');
const menuAvatar = document.getElementById('menu-avatar');
const menuName = document.getElementById('menu-name');
const menuEmail = document.getElementById('menu-email');

let selectedRating = 0;
let selectedCoverFile = null;

// ============================================
// AUTH
// ============================================
onAuthChange(async (user) => {
  if (user) {
    // Update user info
    userAvatarImg.src = user.photoURL || '';
    menuAvatar.src = user.photoURL || '';
    menuName.textContent = user.displayName || 'User';
    menuEmail.textContent = user.email || '';
    await loadBooks();
  } else {
    // Redirect to login page
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
// MODAL MANAGEMENT
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

// Close buttons
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    closeModal(document.getElementById(modalId));
  });
});

// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

// ============================================
// LOAD BOOKS
// ============================================
async function loadBooks() {
  const user = getCurrentUser();
  if (!user) return;

  loadingState.style.display = 'block';
  emptyState.style.display = 'none';
  bookGrid.innerHTML = '';

  try {
    const booksRef = collection(db, 'users', user.uid, 'books');
    const booksSnap = await getDocs(query(booksRef, orderBy('createdAt', 'desc')));

    allBooks = [];
    booksSnap.docs.forEach(docSnap => {
      allBooks.push({ id: docSnap.id, ...docSnap.data() });
    });

    loadingState.style.display = 'none';
    renderBooks();
  } catch (error) {
    console.error('Error loading books:', error);
    loadingState.style.display = 'none';
    showToast('Failed to load books');
  }
}

// ============================================
// RENDER BOOKS (with search/filter/sort)
// ============================================
function renderBooks() {
  let filtered = [...allBooks];

  // Search
  const searchTerm = searchInput.value.toLowerCase().trim();
  if (searchTerm) {
    filtered = filtered.filter(b =>
      b.title.toLowerCase().includes(searchTerm)
    );
  }

  // Filter genre
  const genre = filterGenre.value;
  if (genre) {
    filtered = filtered.filter(b => b.genre === genre);
  }

  // Sort
  const sort = sortBy.value;
  filtered.sort((a, b) => {
    switch (sort) {
      case 'newest':
        return (getTimestamp(b.dateRead)) - (getTimestamp(a.dateRead));
      case 'oldest':
        return (getTimestamp(a.dateRead)) - (getTimestamp(b.dateRead));
      case 'rating-high':
        return (b.rating || 0) - (a.rating || 0);
      case 'rating-low':
        return (a.rating || 0) - (b.rating || 0);
      case 'title-az':
        return a.title.localeCompare(b.title);
      case 'title-za':
        return b.title.localeCompare(a.title);
      default:
        return 0;
    }
  });

  bookGrid.innerHTML = '';

  if (filtered.length === 0 && allBooks.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
  if (filtered.length === 0) {
    emptyState.querySelector('h2').textContent = 'No books found';
    emptyState.querySelector('p').textContent = 'Try adjusting your search or filter.';
  } else if (allBooks.length > 0) {
    // Reset empty state text
    emptyState.querySelector('h2').textContent = 'Your library is empty';
    emptyState.querySelector('p').textContent = 'Start by adding your first book!';
  }

  filtered.forEach((book, index) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;

    const starsHTML = generateStars(book.rating || 0);
    const coverHTML = book.coverUrl
      ? `<img src="${book.coverUrl}" alt="${escapeHtml(book.title)}" loading="lazy">`
      : `<div class="cover-placeholder">📖<span>${escapeHtml(book.title)}</span></div>`;

    card.innerHTML = `
      <div class="book-card-cover">${coverHTML}</div>
      <div class="book-card-info">
        <p class="book-card-title">${escapeHtml(book.title)}</p>
        <div class="book-card-meta">
          <div class="star-rating-display">${starsHTML}</div>
          <span class="genre-badge">${escapeHtml(book.genre || '')}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `book-detail.html?id=${book.id}`;
    });
    bookGrid.appendChild(card);
  });
}

// Search, filter, sort listeners
searchInput.addEventListener('input', renderBooks);
filterGenre.addEventListener('change', renderBooks);
sortBy.addEventListener('change', renderBooks);

// ============================================
// ADD / EDIT BOOK
// ============================================
document.getElementById('btn-add-book').addEventListener('click', () => {
  resetBookForm();
  modalBookTitle.textContent = 'Add New Book';
  btnSaveBookText.textContent = 'Save Book';
  openModal(modalAddBook);
});

// Cover upload
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

// Star rating interaction
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

// Save Book
formBook.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const btnSave = document.getElementById('btn-save-book');
  btnSave.disabled = true;
  btnSaveBookText.textContent = 'Saving...';

  try {
    let coverUrl = '';
    const editId = bookEditId.value;

    // Compress cover to Base64 if new file selected
    if (selectedCoverFile) {
      coverUrl = await compressImage(selectedCoverFile);
    }

    const bookData = {
      title: bookTitleInput.value.trim(),
      dateRead: Timestamp.fromDate(new Date(bookDateInput.value)),
      pageCount: parseInt(bookPagesInput.value) || 0,
      genre: bookGenreInput.value,
      rating: selectedRating,
    };

    if (coverUrl) {
      bookData.coverUrl = coverUrl;
    }

    if (editId) {
      // Update existing book
      const bookRef = doc(db, 'users', user.uid, 'books', editId);
      await updateDoc(bookRef, bookData);
      showToast('Book updated! ✏️');
    } else {
      // Add new book
      bookData.coverUrl = coverUrl || '';
      bookData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'users', user.uid, 'books'), bookData);
      showToast('Book added! 📚');
    }

    closeModal(modalAddBook);
    await loadBooks();
  } catch (error) {
    console.error('Error saving book:', error);
    showToast('Failed to save book');
  } finally {
    btnSave.disabled = false;
    btnSaveBookText.textContent = editId ? 'Update Book' : 'Save Book';
  }
});

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
    <span>Tap to upload cover</span>
  `;
  coverPreview.classList.remove('has-image');
  updateStarDisplay();
}

// ============================================
// BOOK DETAIL
// ============================================
async function openBookDetail(bookId) {
  currentBookId = bookId;
  const user = getCurrentUser();
  if (!user) return;

  try {
    const bookRef = doc(db, 'users', user.uid, 'books', bookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      showToast('Book not found');
      return;
    }

    const book = bookSnap.data();

    // Populate detail
    detailTitle.textContent = book.title;
    detailGenre.textContent = book.genre || 'N/A';
    detailRating.innerHTML = generateStars(book.rating || 0);

    const dateRead = book.dateRead
      ? (book.dateRead.toDate ? book.dateRead.toDate() : new Date(book.dateRead))
      : null;
    detailDate.querySelector('span').textContent = dateRead
      ? dateRead.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : 'N/A';
    detailPages.querySelector('span').textContent = book.pageCount ? `${book.pageCount} pages` : 'N/A';

    if (book.coverUrl) {
      detailCoverImg.src = book.coverUrl;
      detailCoverImg.alt = book.title;
      detailCoverImg.style.display = 'block';
    } else {
      detailCoverImg.src = '';
      detailCoverImg.alt = '';
      detailCoverImg.parentElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:2.5rem;background:linear-gradient(135deg, var(--beige-100), var(--beige-200));">📖</div>`;
    }

    // Hide note form
    noteFormWrap.style.display = 'none';
    formNote.reset();
    noteEditId.value = '';

    // Load notes
    await loadNotes(bookId);

    openModal(modalBookDetail);
  } catch (error) {
    console.error('Error opening book detail:', error);
    showToast('Failed to load book details');
  }
}

// Edit book button
document.getElementById('btn-edit-book').addEventListener('click', async () => {
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  try {
    const bookRef = doc(db, 'users', user.uid, 'books', currentBookId);
    const bookSnap = await getDoc(bookRef);
    if (!bookSnap.exists()) return;

    const book = bookSnap.data();

    // Close detail, open edit modal
    closeModal(modalBookDetail);

    // Populate form
    resetBookForm();
    bookEditId.value = currentBookId;
    modalBookTitle.textContent = 'Edit Book';
    btnSaveBookText.textContent = 'Update Book';
    bookTitleInput.value = book.title || '';
    bookPagesInput.value = book.pageCount || '';
    bookGenreInput.value = book.genre || '';
    selectedRating = book.rating || 0;
    updateStarDisplay();

    const dateRead = book.dateRead
      ? (book.dateRead.toDate ? book.dateRead.toDate() : new Date(book.dateRead))
      : null;
    if (dateRead) {
      bookDateInput.value = dateRead.toISOString().split('T')[0];
    }

    if (book.coverUrl) {
      coverPreview.innerHTML = `<img src="${book.coverUrl}" alt="Cover preview">`;
      coverPreview.classList.add('has-image');
    }

    openModal(modalAddBook);
  } catch (error) {
    console.error('Error loading book for edit:', error);
    showToast('Failed to load book');
  }
});

// Delete book button
document.getElementById('btn-delete-book').addEventListener('click', () => {
  deleteTarget = { type: 'book', bookId: currentBookId };
  confirmTitle.textContent = 'Delete this book?';
  confirmDesc.textContent = 'This will permanently delete the book and all its notes.';
  openModal(modalConfirmDelete);
});

// ============================================
// NOTES CRUD
// ============================================
async function loadNotes(bookId) {
  const user = getCurrentUser();
  if (!user) return;

  notesList.innerHTML = '';
  notesEmpty.style.display = 'none';

  try {
    const notesRef = collection(db, 'users', user.uid, 'books', bookId, 'notes');
    const notesSnap = await getDocs(query(notesRef, orderBy('createdAt', 'desc')));

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
            <button class="btn-note-edit" data-note-id="${noteDoc.id}" title="Edit">✏️</button>
            <button class="btn-note-delete" data-note-id="${noteDoc.id}" title="Delete">🗑️</button>
          </div>
        </div>
        <p class="note-card-desc">${escapeHtml(note.description)}</p>
        <div class="note-card-footer">
          ${note.pageOrChapter ? `<span>📄 ${escapeHtml(note.pageOrChapter)}</span>` : ''}
          ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
        </div>
      `;

      // Edit note
      noteEl.querySelector('.btn-note-edit').addEventListener('click', () => {
        noteEditId.value = noteDoc.id;
        noteTitleInput.value = note.title;
        noteDescInput.value = note.description;
        notePageInput.value = note.pageOrChapter || '';
        noteFormWrap.style.display = 'block';
        noteFormWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      // Delete note
      noteEl.querySelector('.btn-note-delete').addEventListener('click', () => {
        deleteTarget = { type: 'note', bookId: currentBookId, noteId: noteDoc.id };
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

// Show add note form
document.getElementById('btn-add-note').addEventListener('click', () => {
  formNote.reset();
  noteEditId.value = '';
  noteFormWrap.style.display = 'block';
  noteFormWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// Cancel note form
document.getElementById('btn-cancel-note').addEventListener('click', () => {
  noteFormWrap.style.display = 'none';
  formNote.reset();
  noteEditId.value = '';
});

// Save note
formNote.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user || !currentBookId) return;

  const btnSaveNote = document.getElementById('btn-save-note');
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
    await loadNotes(currentBookId);
  } catch (error) {
    console.error('Error saving note:', error);
    showToast('Failed to save note');
  } finally {
    btnSaveNote.disabled = false;
    btnSaveNote.textContent = 'Save Note';
  }
});

// ============================================
// DELETE CONFIRM
// ============================================
btnConfirmDelete.addEventListener('click', async () => {
  if (!deleteTarget) return;
  const user = getCurrentUser();
  if (!user) return;

  btnConfirmDelete.disabled = true;
  btnConfirmDelete.textContent = 'Deleting...';

  try {
    if (deleteTarget.type === 'book') {
      // Delete all notes first
      const notesRef = collection(db, 'users', user.uid, 'books', deleteTarget.bookId, 'notes');
      const notesSnap = await getDocs(notesRef);
      for (const noteDoc of notesSnap.docs) {
        await deleteDoc(noteDoc.ref);
      }

      // Delete the book
      await deleteDoc(doc(db, 'users', user.uid, 'books', deleteTarget.bookId));
      showToast('Book deleted 🗑️');

      closeModal(modalConfirmDelete);
      closeModal(modalBookDetail);
      await loadBooks();
    } else if (deleteTarget.type === 'note') {
      const noteRef = doc(db, 'users', user.uid, 'books', deleteTarget.bookId, 'notes', deleteTarget.noteId);
      await deleteDoc(noteRef);
      showToast('Note deleted 🗑️');

      closeModal(modalConfirmDelete);
      await loadNotes(currentBookId);
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
// STATS
// ============================================
document.getElementById('btn-stats').addEventListener('click', async () => {
  openModal(modalStats);

  try {
    const stats = await getReadingStats();
    if (!stats) return;

    document.getElementById('stat-total-books').textContent = stats.totalBooks;
    document.getElementById('stat-total-pages').textContent = stats.totalPages.toLocaleString();
    document.getElementById('stat-total-notes').textContent = stats.totalNotes;
    document.getElementById('stat-streak').textContent = stats.streak;

    // Monthly chart
    renderMonthlyChart(stats.monthlyData);
  } catch (error) {
    console.error('Error loading stats:', error);
    showToast('Failed to load stats');
  }
});

function renderMonthlyChart(monthlyData) {
  const chart = document.getElementById('monthly-chart');
  chart.innerHTML = '';

  const maxCount = Math.max(...monthlyData.map(m => m.count), 1);

  monthlyData.forEach(month => {
    const heightPercent = month.count > 0 ? Math.max((month.count / maxCount) * 100, 8) : 4;

    const wrap = document.createElement('div');
    wrap.className = 'month-bar-wrap';
    wrap.innerHTML = `
      <div class="month-bar-container">
        <div class="month-bar" style="height: ${heightPercent}%;">
          ${month.count > 0 ? `<span class="month-bar-count">${month.count}</span>` : ''}
        </div>
      </div>
      <span class="month-label">${month.label}</span>
    `;
    chart.appendChild(wrap);
  });
}

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

function getTimestamp(dateField) {
  if (!dateField) return 0;
  if (dateField.toDate) return dateField.toDate().getTime();
  if (dateField.seconds) return dateField.seconds * 1000;
  return new Date(dateField).getTime();
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
