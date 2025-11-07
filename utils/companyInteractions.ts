import { CompanyInteraction, CompanyReachOut } from '../types';

const INTERACTIONS_KEY = 'hirelens_company_interactions';
const REACH_OUTS_KEY = 'hirelens_company_reach_outs';

// Track company-applicant interactions
export const trackInteraction = (
  jobId: string,
  jobTitle: string,
  company: string,
  interactionType: CompanyInteraction['interactionType']
): void => {
  try {
    const interactions = getInteractions();
    const interaction: CompanyInteraction = {
      jobId,
      jobTitle,
      company,
      interactionType,
      timestamp: new Date().toISOString()
    };
    
    interactions.push(interaction);
    // Keep only last 1000 interactions
    const trimmed = interactions.slice(-1000);
    localStorage.setItem(INTERACTIONS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error tracking interaction:', error);
  }
};

export const getInteractions = (): CompanyInteraction[] => {
  try {
    const stored = localStorage.getItem(INTERACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading interactions:', error);
    return [];
  }
};

// Get job activity level based on interactions
export const getJobActivityLevel = (jobId: string): {
  level: 'high' | 'medium' | 'low';
  interactionCount: number;
  lastInteraction?: string;
} => {
  const interactions = getInteractions();
  const jobInteractions = interactions.filter(i => i.jobId === jobId);
  
  const count = jobInteractions.length;
  const lastInteraction = jobInteractions.length > 0 
    ? jobInteractions[jobInteractions.length - 1].timestamp 
    : undefined;
  
  let level: 'high' | 'medium' | 'low' = 'low';
  if (count >= 10) level = 'high';
  else if (count >= 5) level = 'medium';
  
  return { level, interactionCount: count, lastInteraction };
};

// Get most active jobs
export const getMostActiveJobs = (limit: number = 10): Array<{
  jobId: string;
  jobTitle: string;
  company: string;
  interactionCount: number;
  level: 'high' | 'medium' | 'low';
}> => {
  const interactions = getInteractions();
  const jobCounts = new Map<string, { jobTitle: string; company: string; count: number }>();
  
  interactions.forEach(interaction => {
    const existing = jobCounts.get(interaction.jobId);
    if (existing) {
      existing.count++;
    } else {
      jobCounts.set(interaction.jobId, {
        jobTitle: interaction.jobTitle,
        company: interaction.company,
        count: 1
      });
    }
  });
  
  const jobs = Array.from(jobCounts.entries())
    .map(([jobId, data]) => ({
      jobId,
      jobTitle: data.jobTitle,
      company: data.company,
      interactionCount: data.count,
      level: data.count >= 10 ? 'high' as const : data.count >= 5 ? 'medium' as const : 'low' as const
    }))
    .sort((a, b) => b.interactionCount - a.interactionCount)
    .slice(0, limit);
  
  return jobs;
};

// Company Reach Outs
export const getReachOuts = (): CompanyReachOut[] => {
  try {
    const stored = localStorage.getItem(REACH_OUTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading reach outs:', error);
    return [];
  }
};

export const addReachOut = (reachOut: Omit<CompanyReachOut, 'id' | 'timestamp' | 'status'>): void => {
  try {
    const reachOuts = getReachOuts();
    const newReachOut: CompanyReachOut = {
      ...reachOut,
      id: `reachout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: 'unread'
    };
    
    reachOuts.unshift(newReachOut);
    // Keep only last 100 reach outs
    const trimmed = reachOuts.slice(0, 100);
    localStorage.setItem(REACH_OUTS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error adding reach out:', error);
  }
};

export const markReachOutAsRead = (id: string): void => {
  try {
    const reachOuts = getReachOuts();
    const reachOut = reachOuts.find(r => r.id === id);
    if (reachOut) {
      reachOut.status = 'read';
      localStorage.setItem(REACH_OUTS_KEY, JSON.stringify(reachOuts));
    }
  } catch (error) {
    console.error('Error marking reach out as read:', error);
  }
};

// Simulate company reach out based on match score
export const simulateCompanyReachOut = (
  jobTitle: string,
  company: string,
  matchScore: number,
  location?: string,
  salary?: string
): void => {
  // Only simulate reach out if match score is high (80+)
  if (matchScore >= 80) {
    const messages = [
      `Hi! We noticed your profile matches our ${jobTitle} position perfectly. We'd love to discuss this opportunity with you.`,
      `Hello! Your experience aligns well with our ${jobTitle} role. Would you be interested in a conversation?`,
      `We're impressed by your background for our ${jobTitle} position. Let's connect!`,
      `Your skills match our ${jobTitle} opening. We'd like to invite you for an interview.`
    ];
    
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    addReachOut({
      company,
      jobTitle,
      message,
      matchScore,
      location,
      salary
    });
  }
};

