import { ResumeJobMatch } from '../types';
import { analyzeResumeAgainstJob, searchJobsForResume, WebJobSearchResult } from '../services/geminiService';
import { isValidJobUrl, extractSourceFromUrl, validateJobData } from './urlValidator';

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  postedDate: string;
}

export const matchResumeToJobs = async (
  resumeText: string,
  jobPostings: JobPosting[]
): Promise<ResumeJobMatch[]> => {
  const matches: ResumeJobMatch[] = [];
  
  // Match resume against each job posting
  for (const job of jobPostings) {
    try {
      const analysis = await analyzeResumeAgainstJob(resumeText, job.description);
      
      matches.push({
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        matchScore: analysis.matchScore,
        salary: job.salary,
        jobDescription: job.description,
        strengths: analysis.matchingKeywords.slice(0, 5), // Top 5 strengths
        weaknesses: analysis.missingKeywords.slice(0, 5), // Top 5 weaknesses
        recommendation: analysis.summary,
        postedDate: job.postedDate
      });
    } catch (error) {
      console.error(`Error matching resume to job ${job.id}:`, error);
      // Continue with other jobs even if one fails
    }
  }
  
  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
};

// Match resume to jobs from web search
export const matchResumeToWebJobs = async (
  resumeText: string,
  onProgress?: (current: number, total: number) => void
): Promise<ResumeJobMatch[]> => {
  try {
    // First, search the web for jobs matching the resume
    const webJobs = await searchJobsForResume(resumeText);
    
    if (!webJobs || webJobs.length === 0) {
      throw new Error("No jobs found. Try adjusting your search criteria or check your internet connection.");
    }
    
    // Limit to 8 jobs to avoid rate limits (free tier: 15 requests/min)
    // We use 8 to leave room for the initial search request
    const limitedJobs = webJobs.slice(0, 8);
    
    // Then match the resume against each found job with rate limiting
    const matches: ResumeJobMatch[] = [];
    let rateLimitHit = false;
    
    for (let i = 0; i < limitedJobs.length; i++) {
      const job = limitedJobs[i];
      
      if (onProgress) {
        onProgress(i + 1, limitedJobs.length);
      }
      
      // Add delay between requests to avoid rate limits
      // Wait 5 seconds between requests to stay under 15/min limit (allows 12 requests per minute)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      try {
        // Validate job data - only process jobs with valid URLs or sources
        const validation = validateJobData(job);
        if (!validation.isValid) {
          console.warn(`Skipping job "${job.title}" - no valid URL or source`);
          continue; // Skip jobs without valid sources
        }
        
        const analysis = await analyzeResumeAgainstJob(resumeText, job.description);
        
        matches.push({
          jobId: `web_${job.company}_${job.title}`.replace(/\s+/g, '_').toLowerCase(),
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          matchScore: analysis.matchScore,
          salary: job.salary,
          jobDescription: job.description,
          strengths: analysis.matchingKeywords.slice(0, 5),
          weaknesses: analysis.missingKeywords.slice(0, 5),
          recommendation: analysis.summary,
          postedDate: job.postedDate || new Date().toISOString(),
          source: validation.source || extractSourceFromUrl(job.url || '') || 'Web Search',
          url: validation.url || job.url // Only include if valid
        });
      } catch (error: any) {
        console.error(`Error matching resume to web job ${job.title}:`, error);
        
        // If it's a rate limit error, stop processing and return what we have
        if (error?.code === 429 || error?.error?.code === 429 || error?.message?.includes('Rate limit') || error?.message?.includes('quota')) {
          console.warn('Rate limit reached. Returning partial results.');
          rateLimitHit = true;
          
          // Validate before adding fallback job
          const validation = validateJobData(job);
          if (!validation.isValid) {
            console.warn(`Skipping job "${job.title}" - no valid URL or source`);
            break;
          }
          
          // Add the job without match score as a fallback
          matches.push({
            jobId: `web_${job.company}_${job.title}`.replace(/\s+/g, '_').toLowerCase(),
            jobTitle: job.title,
            company: job.company,
            location: job.location,
            matchScore: 0, // Unknown due to rate limit
            salary: job.salary,
            jobDescription: job.description,
            strengths: [],
            weaknesses: [],
            recommendation: "Match score unavailable due to API rate limits. Please try again in a moment.",
            postedDate: job.postedDate || new Date().toISOString(),
            source: validation.source || extractSourceFromUrl(job.url || '') || 'Web Search',
            url: validation.url || job.url // Only include if valid
          });
          break; // Stop processing more jobs
        }
        // Validate before adding job without match score
        const validation = validateJobData(job);
        if (!validation.isValid) {
          console.warn(`Skipping job "${job.title}" - no valid URL or source`);
          continue; // Skip jobs without valid sources
        }
        
        // For other errors, add job without match score
        matches.push({
          jobId: `web_${job.company}_${job.title}`.replace(/\s+/g, '_').toLowerCase(),
          jobTitle: job.title,
          company: job.company,
          location: job.location,
          matchScore: 0,
          salary: job.salary,
          jobDescription: job.description,
          strengths: [],
          weaknesses: [],
          recommendation: "Unable to calculate match score. You can still analyze this job manually.",
          postedDate: job.postedDate || new Date().toISOString(),
          source: validation.source || extractSourceFromUrl(job.url || '') || 'Web Search',
          url: validation.url || job.url // Only include if valid
        });
      }
    }
    
    // Final validation: Filter out jobs without valid sources or URLs
    const finalMatches = matches.filter(match => {
      // Must have either a valid URL or a recognized source
      const hasValidUrl = match.url && isValidJobUrl(match.url);
      const hasValidSource = match.source && ['LinkedIn', 'Indeed', 'Glassdoor', 'Monster', 'ZipRecruiter', 'Dice', 'SimplyHired', 'CareerBuilder'].includes(match.source);
      
      if (!hasValidUrl && !hasValidSource) {
        console.warn(`Filtering out job "${match.jobTitle}" - no valid source or URL`);
        return false;
      }
      return true;
    });
    
    // Sort by match score (highest first), but put jobs with score 0 at the end
    const sorted = finalMatches.sort((a, b) => {
      if (a.matchScore === 0 && b.matchScore === 0) return 0;
      if (a.matchScore === 0) return 1;
      if (b.matchScore === 0) return -1;
      return b.matchScore - a.matchScore;
    });
    
    if (rateLimitHit && sorted.length > 0) {
      console.warn(`Rate limit hit. Showing ${sorted.length} jobs (some without match scores).`);
    }
    
    if (sorted.length === 0) {
      throw new Error("No jobs with valid sources found. Please ensure jobs have valid URLs from known job boards (LinkedIn, Indeed, Glassdoor, etc.).");
    }
    
    return sorted;
  } catch (error) {
    console.error("Error in matchResumeToWebJobs:", error);
    throw error;
  }
};

