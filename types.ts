export interface ExtractedData {
  salaryMin?: number;
  salaryMax?: number;
  workLocationType: 'remote' | 'hybrid' | 'onsite' | 'unspecified';
  jobCity?: string;
  jobState?: string;
  jobCountry?: string;
  postingAgeInDays?: number;
  costOfLivingAnalysis: {
    costOfLivingScore?: number;
    reasoning: string;
  };
  overallSummary: string;
}

export interface ScoredAnalysis extends ExtractedData {
  scores: {
    overall: number;
    salary: number;
    location: number;
    costOfLiving: number;
    redFlags: number;
  };
}

export interface AtsAnalysis {
  matchScore: number;
  matchingKeywords: string[];
  missingKeywords: string[];
  summary: string;
  suggestions: string;
}

export interface CoverLetter {
  content: string;
  tone: string;
  highlights: string[];
}

export interface SkillGapAnalysis {
  currentSkills: string[];
  requiredSkills: string[];
  missingSkills: string[];
  learningRecommendations: {
    skill: string;
    resources: string[];
    priority: 'high' | 'medium' | 'low';
  }[];
  overallGapScore: number; // 0-100
}

export interface JobApplication {
  id: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  appliedDate: string;
  status: 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
  resumeScore?: number;
  coverLetterGenerated?: boolean;
  notes?: string;
  followUpDate?: string;
  interviewDate?: string;
}

export interface ResumeComparison {
  resumeId: string;
  resumeName: string;
  matchScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

export interface ResumeScoreHistory {
  date: string;
  overallScore: number;
  jobTitle?: string;
  company?: string;
  resumeVersion?: string;
}

export interface OptimizedResumeBullet {
  original: string;
  optimized: string;
  improvementReason: string;
  atsScoreIncrease: number; // Estimated increase in ATS score
}

export interface ResumeOptimization {
  originalBullets: string[];
  optimizedBullets: OptimizedResumeBullet[];
  overallImprovement: string;
  estimatedAtsIncrease: number;
}

export interface SalaryNegotiation {
  currentOffer: {
    salary: number;
    location?: string;
  };
  marketAnalysis: {
    marketRate: number;
    percentile: number; // 0-100, where they stand
    comparison: string;
  };
  costOfLivingAdjustment: number;
  recommendedRange: {
    min: number;
    max: number;
    target: number;
  };
  negotiationScript: string;
  talkingPoints: string[];
  risks: string[];
}

export interface JobAlert {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  salary?: string;
  jobDescription: string;
  qualityScore: number;
  matchScore: number;
  postedDate: string;
  source: string;
  url?: string;
}

export interface UserPreferences {
  jobTitles: string[];
  locations: string[];
  salaryRange?: {
    min: number;
    max: number;
  };
  workType: ('remote' | 'hybrid' | 'onsite')[];
  minQualityScore: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate: string;
  category: 'resume' | 'application' | 'improvement' | 'milestone';
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  badge: string; // Anonymous identifier
  isCurrentUser?: boolean;
}

export interface ActivityFeedItem {
  id: string;
  type: 'resume_optimized' | 'cover_letter_generated' | 'application_saved' | 'score_improved' | 'badge_earned';
  description: string;
  timestamp: string;
  score?: number;
}

export interface ResumeJobMatch {
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  matchScore: number;
  salary?: string;
  jobDescription: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  postedDate: string;
  source?: string; // Source website (LinkedIn, Indeed, Glassdoor, etc.)
  url?: string; // Direct link to the job posting
}

export interface CompanyInteraction {
  jobId: string;
  jobTitle: string;
  company: string;
  interactionType: 'view' | 'apply' | 'save' | 'analyze' | 'reach_out';
  timestamp: string;
  applicantId?: string;
}

export interface CompanyReachOut {
  id: string;
  company: string;
  jobTitle: string;
  message: string;
  timestamp: string;
  status: 'unread' | 'read' | 'responded';
  matchScore: number;
  salary?: string;
  location?: string;
}

export interface SalarySpread {
  jobTitle: string;
  location?: string;
  data: {
    percentile: number; // 10, 25, 50 (median), 75, 90
    salary: number;
  }[];
  marketAverage: number;
  marketMedian: number;
  range: {
    min: number;
    max: number;
  };
  sampleSize: number;
}