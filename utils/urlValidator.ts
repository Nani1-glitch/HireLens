// URL validation utility for job postings

/**
 * Validates if a URL is properly formatted and from a known job board
 * Also checks URL structure to ensure it's a real job posting link
 */
export const isValidJobUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Must be HTTPS
    if (urlObj.protocol !== 'https:') {
      return false;
    }
    
    // Check if URL is from a known job board with proper structure
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // LinkedIn Jobs: must have /jobs/view/ or /jobs/collection/
    if (hostname.includes('linkedin.com')) {
      return pathname.includes('/jobs/view/') || 
             pathname.includes('/jobs/collection/') ||
             pathname.includes('/jobs/search/');
    }
    
    // Indeed: must have /viewjob or /jobs/view
    if (hostname.includes('indeed.com')) {
      return pathname.includes('/viewjob') || 
             pathname.includes('/jobs/view') ||
             (urlObj.searchParams.has('jk') && urlObj.searchParams.has('from'));
    }
    
    // Glassdoor: must have /Job/job-listing/ or /Job/
    if (hostname.includes('glassdoor.com')) {
      return pathname.includes('/job-listing/') || 
             pathname.includes('/Job/') ||
             pathname.includes('/job/');
    }
    
    // Monster: must have /jobs/ or /job/
    if (hostname.includes('monster.com')) {
      return pathname.includes('/jobs/') || pathname.includes('/job/');
    }
    
    // ZipRecruiter: must have /job/ or /jobs/
    if (hostname.includes('ziprecruiter.com')) {
      return pathname.includes('/job/') || pathname.includes('/jobs/');
    }
    
    // Other known job boards
    const validJobBoardDomains = [
      'dice.com',
      'simplyhired.com',
      'careerbuilder.com',
      'jobs.com',
      'snagajob.com',
      'flexjobs.com',
      'remote.co',
      'weworkremotely.com',
      'angel.co',
      'stackoverflow.com',
      'github.com'
    ];
    
    const isValidDomain = validJobBoardDomains.some(domain => 
      hostname.includes(domain) || hostname.endsWith(`.${domain}`)
    );
    
    if (isValidDomain) {
      // Must have job-related path
      return pathname.includes('/job') || 
             pathname.includes('/jobs') || 
             pathname.includes('/career') ||
             pathname.includes('/careers');
    }
    
    // Company career pages: must have /jobs, /careers, /career, /opportunities, /openings
    const isCareerPage = pathname.match(/\/(jobs?|careers?|opportunities?|openings?)/);
    if (isCareerPage && urlObj.protocol === 'https:') {
      // Additional check: should not be just homepage
      return pathname !== '/' && pathname.length > 1;
    }
    
    return false;
  } catch (error) {
    // Invalid URL format
    return false;
  }
};

/**
 * Extracts the source name from a URL
 */
export const extractSourceFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Map domains to source names
    if (hostname.includes('linkedin.com')) return 'LinkedIn';
    if (hostname.includes('indeed.com')) return 'Indeed';
    if (hostname.includes('glassdoor.com')) return 'Glassdoor';
    if (hostname.includes('monster.com')) return 'Monster';
    if (hostname.includes('ziprecruiter.com')) return 'ZipRecruiter';
    if (hostname.includes('dice.com')) return 'Dice';
    if (hostname.includes('simplyhired.com')) return 'SimplyHired';
    if (hostname.includes('careerbuilder.com')) return 'CareerBuilder';
    if (hostname.includes('stackoverflow.com')) return 'Stack Overflow';
    if (hostname.includes('github.com')) return 'GitHub Jobs';
    if (hostname.includes('angel.co')) return 'AngelList';
    if (hostname.includes('remote.co')) return 'Remote.co';
    if (hostname.includes('weworkremotely.com')) return 'We Work Remotely';
    if (hostname.includes('flexjobs.com')) return 'FlexJobs';
    
    // Extract company name from career pages
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const companyName = parts[parts.length - 2];
      if (companyName && companyName !== 'www') {
        return companyName.charAt(0).toUpperCase() + companyName.slice(1);
      }
    }
    
    return 'Company Website';
  } catch {
    return 'Web Search';
  }
};

/**
 * Validates and normalizes job data
 */
export const validateJobData = (job: {
  url?: string;
  source?: string;
  title?: string;
  company?: string;
}): {
  isValid: boolean;
  url?: string;
  source?: string;
} => {
  // If URL exists and is valid, use it
  if (job.url && isValidJobUrl(job.url)) {
    return {
      isValid: true,
      url: job.url,
      source: job.source || extractSourceFromUrl(job.url)
    };
  }
  
  // If no URL but has a valid source name, still consider it (but no link)
  if (job.source && ['LinkedIn', 'Indeed', 'Glassdoor', 'Monster', 'ZipRecruiter'].includes(job.source)) {
    return {
      isValid: true,
      source: job.source
      // No URL, so no link will be shown
    };
  }
  
  // Invalid - no valid URL or source
  return {
    isValid: false
  };
};

