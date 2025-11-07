import { LeaderboardEntry } from '../types';

const STORAGE_KEY = 'hirelens_leaderboard';
const USER_ID_KEY = 'hirelens_user_id';

// Generate or get anonymous user ID
export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

// Generate anonymous badge (first 2 letters of user ID)
export const getUserBadge = (): string => {
  const userId = getUserId();
  return userId.substring(5, 7).toUpperCase() + '***';
};

export const submitScore = (score: number): void => {
  try {
    const entries = getLeaderboard();
    const userId = getUserId();
    const badge = getUserBadge();
    
    // Remove old entry for this user
    const filtered = entries.filter(e => !e.isCurrentUser);
    
    // Add new entry
    filtered.push({
      rank: 0, // Will be calculated
      score,
      badge,
      isCurrentUser: true
    });
    
    // Sort by score and assign ranks
    filtered.sort((a, b) => b.score - a.score);
    filtered.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    // Keep top 100
    const trimmed = filtered.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error submitting score:', error);
  }
};

export const getLeaderboard = (): LeaderboardEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const entries: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];
    
    // Ensure current user is marked
    const userId = getUserId();
    const badge = getUserBadge();
    entries.forEach(entry => {
      if (entry.badge === badge) {
        entry.isCurrentUser = true;
      }
    });
    
    return entries;
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return [];
  }
};

// Generate some sample entries for demo (in real app, this would come from server)
export const getLeaderboardWithSamples = (): LeaderboardEntry[] => {
  const userEntries = getLeaderboard();
  const samples: LeaderboardEntry[] = [];
  
  // Generate sample entries if we have less than 10
  if (userEntries.length < 10) {
    const badges = ['AB***', 'CD***', 'EF***', 'GH***', 'IJ***', 'KL***', 'MN***', 'OP***', 'QR***', 'ST***'];
    const scores = [95, 92, 88, 85, 82, 80, 78, 75, 72, 70];
    
    badges.forEach((badge, index) => {
      if (!userEntries.find(e => e.badge === badge)) {
        samples.push({
          rank: index + 1,
          score: scores[index],
          badge
        });
      }
    });
  }
  
  // Combine and sort
  const combined = [...userEntries, ...samples];
  combined.sort((a, b) => b.score - a.score);
  combined.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  return combined.slice(0, 20); // Top 20
};

