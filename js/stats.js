// ============================================
// Stats Module — Angel's Reading Corner
// ============================================
import { db } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Calculate all reading statistics
export async function getReadingStats() {
  const user = getCurrentUser();
  if (!user) return null;

  const booksRef = collection(db, 'users', user.uid, 'books');
  const booksSnap = await getDocs(query(booksRef, orderBy('createdAt', 'desc')));

  let totalBooks = 0;
  let totalPages = 0;
  let totalNotes = 0;
  const booksByMonth = {};
  const allNoteDates = [];

  for (const bookDoc of booksSnap.docs) {
    totalBooks++;
    const bookData = bookDoc.data();
    totalPages += bookData.pageCount || 0;

    // Track books by month
    if (bookData.dateRead) {
      const date = bookData.dateRead.toDate ? bookData.dateRead.toDate() : new Date(bookData.dateRead);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      booksByMonth[monthKey] = (booksByMonth[monthKey] || 0) + 1;
    }

    // Count notes
    const notesRef = collection(db, 'users', user.uid, 'books', bookDoc.id, 'notes');
    const notesSnap = await getDocs(notesRef);
    totalNotes += notesSnap.size;

    notesSnap.docs.forEach(noteDoc => {
      const noteData = noteDoc.data();
      if (noteData.createdAt) {
        const date = noteData.createdAt.toDate ? noteData.createdAt.toDate() : new Date(noteData.createdAt);
        allNoteDates.push(date);
      }
    });
  }

  // Calculate reading streak
  const streak = calculateStreak(allNoteDates);

  // Get last 6 months data
  const monthlyData = getLast6Months(booksByMonth);

  return {
    totalBooks,
    totalPages,
    totalNotes,
    streak,
    monthlyData
  };
}

// Calculate consecutive days with activity
function calculateStreak(dates) {
  if (dates.length === 0) return 0;

  // Get unique dates (day level)
  const uniqueDays = new Set();
  dates.forEach(d => {
    uniqueDays.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  });

  const sortedDays = [...uniqueDays].sort().reverse();
  if (sortedDays.length === 0) return 0;

  // Check if today or yesterday is in the list
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (sortedDays[0] !== todayStr && sortedDays[0] !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// Get last 6 months with counts
function getLast6Months(booksByMonth) {
  const months = [];
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      label: monthNames[date.getMonth()],
      count: booksByMonth[key] || 0
    });
  }

  return months;
}
