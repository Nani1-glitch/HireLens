import { Achievement } from '../types';

const STORAGE_KEY = 'hirelens_achievements';

const ACHIEVEMENT_DEFINITIONS = [
  { id: 'first_analysis', name: 'First Analysis', description: 'Analyzed your first job posting', icon: '🎯', category: 'milestone' as const },
  { id: 'resume_optimized', name: 'Resume Optimizer', description: 'Optimized your first resume bullet', icon: '✨', category: 'resume' as const },
  { id: 'cover_letter_master', name: 'Cover Letter Master', description: 'Generated your first cover letter', icon: '📝', category: 'application' as const },
  { id: 'high_score_80', name: 'High Achiever', description: 'Achieved a resume score of 80+', icon: '🏆', category: 'improvement' as const },
  { id: 'high_score_90', name: 'Elite Performer', description: 'Achieved a resume score of 90+', icon: '⭐', category: 'improvement' as const },
  { id: 'perfect_score', name: 'Perfect Match', description: 'Achieved a perfect resume score of 100', icon: '💯', category: 'improvement' as const },
  { id: 'five_applications', name: 'Job Hunter', description: 'Tracked 5 job applications', icon: '🎯', category: 'application' as const },
  { id: 'ten_applications', name: 'Application Pro', description: 'Tracked 10 job applications', icon: '🚀', category: 'application' as const },
  { id: 'skill_gap_analyzed', name: 'Skill Builder', description: 'Analyzed your skill gaps', icon: '📚', category: 'improvement' as const },
  { id: 'salary_negotiated', name: 'Negotiator', description: 'Used salary negotiation advisor', icon: '💰', category: 'milestone' as const },
];

export const getAchievements = (): Achievement[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading achievements:', error);
    return [];
  }
};

export const checkAndAwardAchievement = (achievementId: string): Achievement | null => {
  const earned = getAchievements();
  if (earned.find(a => a.id === achievementId)) {
    return null; // Already earned
  }
  
  const definition = ACHIEVEMENT_DEFINITIONS.find(a => a.id === achievementId);
  if (!definition) {
    return null;
  }
  
  const achievement: Achievement = {
    ...definition,
    earnedDate: new Date().toISOString()
  };
  
  earned.push(achievement);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
  return achievement;
};

export const getAllAchievementDefinitions = () => ACHIEVEMENT_DEFINITIONS;

