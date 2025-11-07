import { ResumeScoreHistory } from '../types';

const STORAGE_KEY = 'hirelens_score_history';

export const getScoreHistory = (): ResumeScoreHistory[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading score history:', error);
    return [];
  }
};

export const saveScoreHistory = (entry: ResumeScoreHistory): void => {
  try {
    const history = getScoreHistory();
    history.push(entry);
    // Keep only last 100 entries
    const trimmed = history.slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving score history:', error);
  }
};

export const clearScoreHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing score history:', error);
  }
};

