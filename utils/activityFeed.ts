import { ActivityFeedItem } from '../types';

const STORAGE_KEY = 'hirelens_activity_feed';
const MAX_ITEMS = 50;

export const getActivityFeed = (): ActivityFeedItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading activity feed:', error);
    return [];
  }
};

export const addActivity = (type: ActivityFeedItem['type'], description: string, score?: number): void => {
  try {
    const feed = getActivityFeed();
    const item: ActivityFeedItem = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      timestamp: new Date().toISOString(),
      score
    };
    
    feed.unshift(item); // Add to beginning
    const trimmed = feed.slice(0, MAX_ITEMS); // Keep only latest 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error adding activity:', error);
  }
};

export const clearActivityFeed = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing activity feed:', error);
  }
};

// Generate sample activities for demo
export const getActivityFeedWithSamples = (): ActivityFeedItem[] => {
  const userActivities = getActivityFeed();
  
  // Add some sample activities if feed is empty
  if (userActivities.length < 5) {
    const samples: ActivityFeedItem[] = [
      {
        id: 'sample_1',
        type: 'resume_optimized',
        description: 'Someone optimized their resume and improved their score by 15 points',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        score: 85
      },
      {
        id: 'sample_2',
        type: 'score_improved',
        description: 'A user achieved a new personal best score of 92',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        score: 92
      },
      {
        id: 'sample_3',
        type: 'badge_earned',
        description: 'Someone earned the "Elite Performer" badge',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sample_4',
        type: 'cover_letter_generated',
        description: 'A user generated a tailored cover letter',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sample_5',
        type: 'application_saved',
        description: 'Someone saved a new job application to their tracker',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    return [...userActivities, ...samples].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 20);
  }
  
  return userActivities.slice(0, 20);
};

