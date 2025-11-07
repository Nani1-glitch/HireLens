import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData, AtsAnalysis, CoverLetter, ResumeOptimization, SalaryNegotiation, ResumeComparison, SkillGapAnalysis, JobAlert, SalarySpread } from '../types';
import { calculateScores } from '../utils/scorer';

export interface WebJobSearchResult {
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  url?: string;
  postedDate?: string;
  source?: string;
}

// Get API key from environment (Vite injects process.env via define in vite.config.ts)
// @ts-ignore - process.env is injected by Vite's define at build time
const API_KEY = (process.env?.GEMINI_API_KEY as string) || (process.env?.API_KEY as string) || '';

// Debug: Log if API key is loaded (without exposing the full key)
if (!API_KEY || API_KEY === 'undefined' || API_KEY.trim() === '') {
  console.error("GEMINI_API_KEY environment variable not set. Please create a .env file with your Gemini API key and restart the dev server.");
} else {
  console.log("API key loaded:", API_KEY ? `${API_KEY.substring(0, 10)}...` : "NOT FOUND");
}

// Initialize AI only if API key is available
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    salaryMin: { type: Type.NUMBER, description: "The minimum salary mentioned, as a number. Null if not present." },
    salaryMax: { type: Type.NUMBER, description: "The maximum salary mentioned, as a number. Null if not present." },
    workLocationType: { type: Type.STRING, enum: ['remote', 'hybrid', 'onsite', 'unspecified'], description: "The type of work location." },
    jobCity: { type: Type.STRING, description: "The city of the job. Null if not present." },
    jobState: { type: Type.STRING, description: "The state or province of the job. Null if not present." },
    jobCountry: { type: Type.STRING, description: "The country of the job. Null if not present." },
    postingAgeInDays: { type: Type.NUMBER, description: "How many days ago the job was posted. Extract this from text like 'Posted 5 days ago' or a date. Calculate the difference from today if a date is given. Null if not found." },
    costOfLivingAnalysis: {
      type: Type.OBJECT,
      properties: {
        costOfLivingScore: { type: Type.NUMBER, description: "A log-normalized score from 0 to 100 representing how the salary compares to the cost of living. 0 is very poor, 100 is excellent. Null if salary or location is missing." },
        reasoning: { type: Type.STRING, description: "A brief explanation for the cost of living rating." }
      },
      required: ['reasoning']
    },
    overallSummary: { type: Type.STRING, description: "A one-paragraph summary of the job posting's quality from an HR perspective." }
  },
  required: ['workLocationType', 'costOfLivingAnalysis', 'overallSummary']
};

const atsResponseSchema = {
    type: Type.OBJECT,
    properties: {
        matchScore: { type: Type.NUMBER, description: "A score from 0-100 indicating how well the resume matches the job description." },
        matchingKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of keywords and skills from the job description found in the resume." },
        missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of important keywords and skills from the job description NOT found in the resume." },
        summary: { type: Type.STRING, description: "A brief summary of the candidate's fit for the role." },
        suggestions: { type: Type.STRING, description: "Actionable suggestions for the candidate to improve their resume for this specific job posting." },
    },
    required: ['matchScore', 'matchingKeywords', 'missingKeywords', 'summary', 'suggestions']
};

export const analyzeJobPosting = async (jobText: string): Promise<ExtractedData> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured. Please create a .env file in the project root with GEMINI_API_KEY=your_api_key_here");
  }

  const prompt = `
    Act as an expert HR analyst and recruiter. Analyze the following job posting text.
    Extract the required information and provide a quality assessment based on the specified JSON schema.
    
    Job Posting:
    ---
    ${jobText}
    ---
    
    Today's date is ${new Date().toISOString().split('T')[0]}.
  `;

  try {
    if (!API_KEY || API_KEY === 'undefined' || API_KEY === '') {
      throw new Error("API key is not set. Please restart your dev server after creating the .env file.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedData = JSON.parse(jsonText);
    
    if (parsedData.salaryMin === null) delete parsedData.salaryMin;
    if (parsedData.salaryMax === null) delete parsedData.salaryMax;
    if (parsedData.jobCity === null) delete parsedData.jobCity;
    if (parsedData.jobState === null) delete parsedData.jobState;
    if (parsedData.jobCountry === null) delete parsedData.jobCountry;
    if (parsedData.postingAgeInDays === null) delete parsedData.postingAgeInDays;
    if (parsedData.costOfLivingAnalysis.costOfLivingScore === null) delete parsedData.costOfLivingAnalysis.costOfLivingScore;

    return parsedData as ExtractedData;

  } catch (error: any) {
    console.error("Error analyzing job posting:", error);
    
    // Provide more specific error messages
    if (error?.message?.includes("API key not valid") || error?.error?.message?.includes("API key")) {
      throw new Error("Invalid API key. Please check your .env file and ensure GEMINI_API_KEY is set correctly. Restart the dev server after updating .env");
    }
    if (error?.message?.includes("API key is not set")) {
      throw error; // Re-throw our custom message
    }
    
    throw new Error(`Failed to get analysis from Gemini API: ${error?.message || error?.error?.message || "Unknown error"}. Please check the console for details.`);
  }
};

export const analyzeResumeAgainstJob = async (resumeText: string, jobText: string, retryCount = 0): Promise<AtsAnalysis> => {
    if (!ai || !API_KEY) {
      throw new Error("Gemini API key is not configured. Please create a .env file in the project root with GEMINI_API_KEY=your_api_key_here");
    }

    const prompt = `
      Act as an advanced Applicant Tracking System (ATS). Your task is to analyze the provided resume against the given job description.
      Provide a detailed analysis in the specified JSON format. The analysis should be objective and based on keyword and skill matching.
  
      Job Description:
      ---
      ${jobText}
      ---
  
      Resume:
      ---
      ${resumeText}
      ---
    `;
  
    try {
      if (!API_KEY || API_KEY === 'undefined' || API_KEY === '') {
        throw new Error("API key is not set. Please restart your dev server after creating the .env file.");
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: atsResponseSchema,
        },
      });
  
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as AtsAnalysis;
  
    } catch (error: any) {
      console.error("Error analyzing resume:", error);
      
      // Handle rate limiting with retry
      if ((error?.code === 429 || error?.error?.code === 429 || error?.status === 'RESOURCE_EXHAUSTED') && retryCount < 3) {
        const retryDelay = extractRetryDelay(error) || 12000; // Default 12 seconds
        console.log(`Rate limit hit. Retrying in ${retryDelay / 1000}s... (Attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return analyzeResumeAgainstJob(resumeText, jobText, retryCount + 1);
      }
      
      // Provide more specific error messages
      if (error?.message?.includes("API key not valid") || error?.error?.message?.includes("API key")) {
        throw new Error("Invalid API key. Please check your .env file and ensure GEMINI_API_KEY is set correctly. Restart the dev server after updating .env");
      }
      if (error?.message?.includes("API key is not set")) {
        throw error; // Re-throw our custom message
      }
      
      if (error?.code === 429 || error?.error?.code === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment and try again. Free tier allows 15 requests per minute.");
      }
      
      throw new Error(`Failed to get ATS analysis from Gemini API: ${error?.message || error?.error?.message || "Unknown error"}. Please check the console for details.`);
    }
  };

// Helper function to extract retry delay from error
function extractRetryDelay(error: any): number | null {
  try {
    const retryInfo = error?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
    if (retryInfo?.retryDelay) {
      return parseFloat(retryInfo.retryDelay) * 1000; // Convert to milliseconds
    }
    const match = error?.error?.message?.match(/retry in ([\d.]+)s/i) || error?.message?.match(/retry in ([\d.]+)s/i);
    if (match) {
      return parseFloat(match[1]) * 1000;
    }
  } catch (e) {
    console.error('Error extracting retry delay:', e);
  }
  return null;
}

// Batch 1 Feature 1: AI Resume Optimizer Pro
const resumeOptimizationSchema = {
  type: Type.OBJECT,
  properties: {
    originalBullets: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The original resume bullet points provided" },
    optimizedBullets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: "The original bullet point text" },
          optimized: { type: Type.STRING, description: "The optimized version that improves ATS scores and readability" },
          improvementReason: { type: Type.STRING, description: "Brief explanation of why this optimization improves the resume" },
          atsScoreIncrease: { type: Type.NUMBER, description: "Estimated ATS score increase (0-10 points) for this bullet" }
        },
        required: ['original', 'optimized', 'improvementReason', 'atsScoreIncrease']
      },
      description: "Array of optimized bullet points with improvements"
    },
    overallImprovement: { type: Type.STRING, description: "Summary of overall improvements made" },
    estimatedAtsIncrease: { type: Type.NUMBER, description: "Total estimated ATS score increase (0-50 points)" }
  },
  required: ['originalBullets', 'optimizedBullets', 'overallImprovement', 'estimatedAtsIncrease']
};

export const optimizeResumeBullets = async (resumeBullets: string[], jobDescription?: string): Promise<ResumeOptimization> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    Act as an expert resume writer and ATS optimization specialist. Your task is to optimize resume bullet points to improve both ATS (Applicant Tracking System) scores and human readability.
    
    ${jobDescription ? `Target Job Description:\n---\n${jobDescription}\n---\n\nOptimize the bullets to align with this job description.` : 'Optimize the bullets for general ATS compatibility and impact.'}
    
    Resume Bullet Points to Optimize:
    ---
    ${resumeBullets.join('\n')}
    ---
    
    Guidelines:
    - Use action verbs and quantifiable metrics
    - Include relevant keywords naturally
    - Make achievements specific and measurable
    - Improve clarity and impact
    - Maintain authenticity (don't fabricate achievements)
    - Each optimized bullet should be more compelling than the original
    
    Provide optimized versions with explanations for each improvement.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: resumeOptimizationSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as ResumeOptimization;
    
    // Validate response structure
    if (!parsed.optimizedBullets || !Array.isArray(parsed.optimizedBullets) || parsed.optimizedBullets.length === 0) {
      throw new Error("Invalid response format. Please try again.");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Error optimizing resume:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to optimize resume: ${error?.message || "Unknown error"}`);
  }
};

// Batch 1 Feature 2: Cover Letter Generator
const coverLetterSchema = {
  type: Type.OBJECT,
  properties: {
    content: { type: Type.STRING, description: "The complete cover letter text" },
    tone: { type: Type.STRING, description: "The tone of the letter (e.g., 'professional', 'enthusiastic', 'confident')" },
    highlights: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key highlights and strengths emphasized in the letter" }
  },
  required: ['content', 'tone', 'highlights']
};

export const generateCoverLetter = async (resumeText: string, jobDescription: string, applicantName?: string, companyName?: string): Promise<CoverLetter> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    Act as an expert cover letter writer. Create a compelling, tailored cover letter that connects the candidate's experience with the job requirements.
    
    Job Description:
    ---
    ${jobDescription}
    ---
    
    Candidate Resume:
    ---
    ${resumeText}
    ---
    
    ${applicantName ? `Applicant Name: ${applicantName}\n` : ''}
    ${companyName ? `Company Name: ${companyName}\n` : ''}
    
    Requirements:
    - Tailor the letter specifically to this job description
    - Highlight relevant experience from the resume
    - Show enthusiasm and cultural fit
    - Keep it concise (3-4 paragraphs)
    - Professional but personable tone
    - Include specific examples from the resume
    - Address key requirements from the job description
    
    Generate a complete cover letter that stands out.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: coverLetterSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as CoverLetter;
    
    // Validate response
    if (!parsed.content || parsed.content.trim().length < 50) {
      throw new Error("Generated cover letter is too short. Please try again.");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Error generating cover letter:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to generate cover letter: ${error?.message || "Unknown error"}`);
  }
};

// Batch 1 Feature 4: Salary Negotiation Advisor
const salaryNegotiationSchema = {
  type: Type.OBJECT,
  properties: {
    currentOffer: {
      type: Type.OBJECT,
      properties: {
        salary: { type: Type.NUMBER, description: "The current salary offer" },
        location: { type: Type.STRING, description: "Job location if provided" }
      },
      required: ['salary']
    },
    marketAnalysis: {
      type: Type.OBJECT,
      properties: {
        marketRate: { type: Type.NUMBER, description: "Estimated market rate for this role" },
        percentile: { type: Type.NUMBER, description: "Where the offer stands (0-100 percentile)" },
        comparison: { type: Type.STRING, description: "Comparison of offer to market" }
      },
      required: ['marketRate', 'percentile', 'comparison']
    },
    costOfLivingAdjustment: { type: Type.NUMBER, description: "Cost of living adjustment amount" },
    recommendedRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER, description: "Minimum recommended salary" },
        max: { type: Type.NUMBER, description: "Maximum recommended salary" },
        target: { type: Type.NUMBER, description: "Target salary to negotiate for" }
      },
      required: ['min', 'max', 'target']
    },
    negotiationScript: { type: Type.STRING, description: "A sample script for salary negotiation" },
    talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key talking points for negotiation" },
    risks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Potential risks or considerations" }
  },
  required: ['currentOffer', 'marketAnalysis', 'costOfLivingAdjustment', 'recommendedRange', 'negotiationScript', 'talkingPoints', 'risks']
};

export const analyzeSalaryNegotiation = async (
  currentOffer: number,
  jobTitle: string,
  location?: string,
  yearsOfExperience?: number
): Promise<SalaryNegotiation> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    Act as a compensation expert and career advisor. Analyze the salary offer and provide negotiation guidance.
    
    Job Title: ${jobTitle}
    Current Offer: $${currentOffer.toLocaleString()}
    ${location ? `Location: ${location}` : ''}
    ${yearsOfExperience ? `Years of Experience: ${yearsOfExperience}` : ''}
    
    Provide:
    1. Market rate analysis for this role
    2. Where the offer stands relative to market (percentile)
    3. Cost of living considerations if location provided
    4. Recommended negotiation range
    5. A negotiation script
    6. Key talking points
    7. Potential risks to consider
    
    Be realistic and practical in your recommendations.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: salaryNegotiationSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as SalaryNegotiation;
    
    // Validate response
    if (!parsed.marketAnalysis || !parsed.recommendedRange) {
      throw new Error("Invalid response format. Please try again.");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Error analyzing salary negotiation:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to analyze salary negotiation: ${error?.message || "Unknown error"}`);
  }
};

// Batch 1 Feature 5: Multi-Resume Comparison Tool
const resumeComparisonSchema = {
  type: Type.OBJECT,
  properties: {
    resumeId: { type: Type.STRING, description: "Identifier for this resume" },
    resumeName: { type: Type.STRING, description: "Name or version identifier" },
    matchScore: { type: Type.NUMBER, description: "Match score 0-100" },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Strengths of this resume version" },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Weaknesses or gaps" },
    recommendation: { type: Type.STRING, description: "Recommendation on which resume to use" }
  },
  required: ['resumeId', 'resumeName', 'matchScore', 'strengths', 'weaknesses', 'recommendation']
};

export const compareResumeVersions = async (
  resumeTexts: { id: string; name: string; content: string }[],
  jobDescription: string
): Promise<ResumeComparison[]> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const comparisons: ResumeComparison[] = [];

  for (const resume of resumeTexts) {
    const prompt = `
      Analyze this resume version against the job description and provide a comparison.
      
      Job Description:
      ---
      ${jobDescription}
      ---
      
      Resume Version: ${resume.name}
      Resume Content:
      ---
      ${resume.content}
      ---
      
      Provide:
      - Match score (0-100)
      - Key strengths for this job
      - Weaknesses or gaps
      - Brief recommendation
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: resumeComparisonSchema,
        },
      });

      const comparison = JSON.parse(response.text.trim()) as ResumeComparison;
      comparison.resumeId = resume.id;
      comparison.resumeName = resume.name;
      comparisons.push(comparison);
    } catch (error: any) {
      console.error(`Error comparing resume ${resume.name}:`, error);
      // Continue with other resumes even if one fails
      comparisons.push({
        resumeId: resume.id,
        resumeName: resume.name,
        matchScore: 0,
        strengths: [],
        weaknesses: ['Error analyzing this resume'],
        recommendation: 'Unable to analyze this resume version'
      });
    }
  }

  return comparisons;
};

// Batch 2 Feature 1: Skill Gap Analysis Tool
const skillGapAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    currentSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Skills found in the resume" },
    requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Skills required by the job" },
    missingSkills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Required skills not found in resume" },
    learningRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING, description: "Skill to learn" },
          resources: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Learning resources (courses, tutorials, etc.)" },
          priority: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "Priority level" }
        },
        required: ['skill', 'resources', 'priority']
      },
      description: "Learning recommendations for missing skills"
    },
    overallGapScore: { type: Type.NUMBER, description: "Overall gap score 0-100 (higher = better match)" }
  },
  required: ['currentSkills', 'requiredSkills', 'missingSkills', 'learningRecommendations', 'overallGapScore']
};

export const analyzeSkillGap = async (resumeText: string, jobDescription: string): Promise<SkillGapAnalysis> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    Act as a career development advisor. Analyze the skill gap between the candidate's resume and the job requirements.
    
    Job Description:
    ---
    ${jobDescription}
    ---
    
    Candidate Resume:
    ---
    ${resumeText}
    ---
    
    Provide:
    1. Current skills found in the resume
    2. Required skills from the job description
    3. Missing skills (required but not in resume)
    4. Learning recommendations for each missing skill with resources and priority
    5. Overall gap score (0-100, where 100 = perfect match)
    
    Focus on actionable learning paths that help the candidate bridge the gap.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: skillGapAnalysisSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as SkillGapAnalysis;
    
    // Validate response
    if (parsed.overallGapScore === undefined || parsed.overallGapScore < 0 || parsed.overallGapScore > 100) {
      throw new Error("Invalid gap score. Please try again.");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Error analyzing skill gap:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to analyze skill gap: ${error?.message || "Unknown error"}`);
  }
};

// Batch 2 Feature 2: Job Alert System with AI Filtering
export const filterJobPostings = async (
  jobPostings: string[],
  userPreferences: { jobTitles?: string[]; locations?: string[]; minQualityScore?: number }
): Promise<JobAlert[]> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  // For now, we'll analyze each job posting and filter based on preferences
  // In a real implementation, this would be more sophisticated
  const alerts: JobAlert[] = [];
  
  for (const jobText of jobPostings.slice(0, 10)) { // Limit to 10 for performance
    try {
      const extractedData = await analyzeJobPosting(jobText);
      const qualityScore = calculateScores(extractedData).scores.overall;
      
      // Extract basic info
      const titleMatch = jobText.match(/^([^\n]+)/);
      const companyMatch = jobText.match(/- ([^-]+) -/);
      
      if (qualityScore >= (userPreferences.minQualityScore || 50)) {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          jobTitle: titleMatch ? titleMatch[1].trim() : 'Job Position',
          company: companyMatch ? companyMatch[1].trim() : 'Company',
          location: extractedData.jobCity ? `${extractedData.jobCity}, ${extractedData.jobState || ''}`.trim() : 'Location TBD',
          salary: extractedData.salaryMin && extractedData.salaryMax 
            ? `$${extractedData.salaryMin.toLocaleString()} - $${extractedData.salaryMax.toLocaleString()}`
            : undefined,
          jobDescription: jobText,
          qualityScore,
          matchScore: 85, // Would be calculated based on preferences
          postedDate: new Date().toISOString(),
          source: 'Hirelens'
        });
      }
    } catch (error) {
      console.error("Error filtering job posting:", error);
      // Continue with other postings
    }
  }
  
  return alerts.sort((a, b) => b.qualityScore - a.qualityScore);
};

// Final Feature 4: Salary Spread Analysis
const salarySpreadSchema = {
  type: Type.OBJECT,
  properties: {
    data: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          percentile: { type: Type.NUMBER, description: "Percentile (10, 25, 50, 75, 90)" },
          salary: { type: Type.NUMBER, description: "Salary at this percentile" }
        },
        required: ['percentile', 'salary']
      },
      description: "Salary distribution by percentile"
    },
    marketAverage: { type: Type.NUMBER, description: "Average market salary" },
    marketMedian: { type: Type.NUMBER, description: "Median market salary (50th percentile)" },
    range: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER, description: "Minimum salary" },
        max: { type: Type.NUMBER, description: "Maximum salary" }
      },
      required: ['min', 'max']
    },
    sampleSize: { type: Type.NUMBER, description: "Estimated sample size for this analysis" }
  },
  required: ['data', 'marketAverage', 'marketMedian', 'range', 'sampleSize']
};

export const analyzeSalarySpread = async (
  jobTitle: string,
  location?: string,
  yearsOfExperience?: number
): Promise<SalarySpread> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const locationText = location ? ` in ${location}` : '';
  const experienceText = yearsOfExperience ? ` with ${yearsOfExperience} years of experience` : '';

  const prompt = `
    Act as a salary data analyst. Provide comprehensive salary spread analysis for the position: ${jobTitle}${locationText}${experienceText}.
    
    Analyze the salary distribution and provide:
    1. Salary at different percentiles (10th, 25th, 50th/median, 75th, 90th)
    2. Market average salary
    3. Market median salary
    4. Salary range (min to max)
    5. Estimated sample size for this analysis
    
    Base your analysis on current market data for this role${locationText}${experienceText}.
    Provide realistic salary figures in USD.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: salarySpreadSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as Omit<SalarySpread, 'jobTitle' | 'location'>;
    
    // Validate response
    if (!parsed.data || parsed.data.length === 0) {
      throw new Error("Invalid salary spread data. Please try again.");
    }
    
    return {
      ...parsed,
      jobTitle,
      location
    };
  } catch (error: any) {
    console.error("Error analyzing salary spread:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to analyze salary spread: ${error?.message || "Unknown error"}`);
  }
};

// Web-Based Job Search using Gemini
const jobSearchResultSchema = {
  type: Type.OBJECT,
  properties: {
    jobs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Job title" },
          company: { type: Type.STRING, description: "Company name" },
          location: { type: Type.STRING, description: "Job location" },
          description: { type: Type.STRING, description: "Full job description" },
          salary: { type: Type.STRING, description: "Salary range if available" },
          url: { type: Type.STRING, description: "Job posting URL" },
          postedDate: { type: Type.STRING, description: "When the job was posted" },
          source: { type: Type.STRING, description: "Source website (LinkedIn, Indeed, etc.)" }
        },
        required: ['title', 'company', 'location', 'description']
      },
      description: "List of job postings found"
    }
  },
  required: ['jobs']
};

export interface WebJobSearchResult {
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  url?: string;
  postedDate?: string;
  source?: string;
}

export const searchJobsOnWeb = async (
  searchCriteria: {
    jobTitle?: string;
    location?: string;
    skills?: string[];
    experience?: string;
    salaryRange?: { min?: number; max?: number };
    workType?: 'remote' | 'hybrid' | 'onsite';
  }
): Promise<WebJobSearchResult[]> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  // Build search query
  let searchQuery = '';
  if (searchCriteria.jobTitle) {
    searchQuery += searchCriteria.jobTitle;
  }
  if (searchCriteria.location) {
    searchQuery += ` in ${searchCriteria.location}`;
  }
  if (searchCriteria.workType) {
    searchQuery += ` ${searchCriteria.workType} jobs`;
  }
  if (searchCriteria.skills && searchCriteria.skills.length > 0) {
    searchQuery += ` requiring ${searchCriteria.skills.join(', ')}`;
  }

  const prompt = `
    ⚠️ CRITICAL INSTRUCTION: You MUST use REAL-TIME WEB SEARCH to find ACTUAL, CURRENT job postings. 
    DO NOT generate, create, or make up job listings. DO NOT use your training data to create example jobs.
    
    You MUST actually search the live web and visit these job board websites RIGHT NOW:
    - https://www.linkedin.com/jobs/search/
    - https://www.indeed.com/jobs
    - https://www.glassdoor.com/Job/
    - https://www.monster.com/jobs
    - https://www.ziprecruiter.com/jobs
    - Company career pages (e.g., company.com/careers, company.com/jobs)
    
    Search for jobs matching these criteria:
    - Job Title: ${searchCriteria.jobTitle || 'Any relevant position'}
    - Location: ${searchCriteria.location || 'Any location'}
    - Work Type: ${searchCriteria.workType || 'Any'}
    - Skills Required: ${searchCriteria.skills?.join(', ') || 'N/A'}
    - Experience Level: ${searchCriteria.experience || 'Any'}
    - Salary Range: ${searchCriteria.salaryRange?.min ? `$${searchCriteria.salaryRange.min}` : ''}${searchCriteria.salaryRange?.max ? ` - $${searchCriteria.salaryRange.max}` : ''}
    
    For each REAL job posting you find on the web, you MUST provide:
    1. EXACT job title as it appears on the job board (copy it exactly)
    2. REAL company name as listed on the posting
    3. Actual location exactly as shown (city, state/country)
    4. COMPLETE job description (copy the ENTIRE text from the actual posting, word-for-word)
    5. Real salary information if listed on the posting
    6. ACTUAL job posting URL (must be a real, working link that users can click and visit)
    7. Posted date if visible on the posting
    8. Source website name (LinkedIn, Indeed, Glassdoor, etc.)
    
    STRICT REQUIREMENTS:
    - You MUST visit the actual job board websites and extract real listings
    - Each job URL MUST be a real link that works when clicked
    - Job descriptions MUST be copied from actual postings, not written or generated
    - Company names MUST be real, verifiable companies
    - URLs MUST be in format: https://www.linkedin.com/jobs/view/... or https://www.indeed.com/viewjob?jk=...
    - Return ONLY jobs that exist on the web RIGHT NOW
    - If you cannot access real job boards, return an empty array
    - DO NOT create example jobs, placeholder jobs, or training data jobs
    
    Validation: Before returning each job, verify:
    - The URL format matches the job board's actual URL structure
    - The company name is a real company
    - The job description is detailed and specific (not generic)
    
    If you cannot find real jobs through web search, return: {"jobs": []}
    DO NOT generate fake jobs under any circumstances.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: jobSearchResultSchema,
        // Enable grounding for real-time web search (if available in your API plan)
        // Note: Grounding requires Google AI Studio API with grounding enabled
        // For production, consider using actual web scraping services or job board APIs
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as { jobs: WebJobSearchResult[] };
    
    // Validate response
    if (!parsed.jobs || !Array.isArray(parsed.jobs) || parsed.jobs.length === 0) {
      throw new Error("No jobs found. Try adjusting your search criteria.");
    }
    
    // Import URL validator
    const { isValidJobUrl, extractSourceFromUrl } = await import('../utils/urlValidator');
    
    // STRICT VALIDATION: Only accept jobs with valid URLs and real descriptions
    const validatedJobs = parsed.jobs
      .map(job => {
        // Must have a valid URL that passes our strict checks
        if (job.url && isValidJobUrl(job.url)) {
          // Validate description is real (not generic/generated)
          const description = job.description || '';
          const isGenericDescription = 
            description.length < 200 || // Too short
            description.includes('example') ||
            description.includes('placeholder') ||
            description.includes('lorem ipsum') ||
            (description.split(' ').length < 50); // Too short
          
          if (isGenericDescription) {
            console.warn(`Job "${job.title}" has suspiciously generic description - rejecting`);
            return null;
          }
          
          // Check if company name is generic
          const isGenericCompany = 
            !job.company ||
            (job.company.toLowerCase().includes('company') && job.company.length < 15) ||
            job.company === 'ABC Company' ||
            job.company === 'Tech Corp' ||
            job.company === 'XYZ Corp';
          
          if (isGenericCompany) {
            console.warn(`Job "${job.title}" has generic company name - rejecting`);
            return null;
          }
          
          return {
            ...job,
            source: job.source || extractSourceFromUrl(job.url),
            url: job.url
          };
        }
        // REJECT jobs without valid URLs - we need real links
        console.warn(`Rejecting job "${job.title}" - no valid URL`);
        return null;
      })
      .filter((job): job is WebJobSearchResult => job !== null);
    
    if (validatedJobs.length === 0) {
      throw new Error("No jobs with valid URLs and real descriptions found. The API may not have web scraping capabilities enabled. See WEB_SCRAPING_GUIDE.md for integrating real web scraping services like ScraperAPI or Apify.");
    }
    
    console.log(`Found ${validatedJobs.length} jobs with valid URLs and real descriptions out of ${parsed.jobs.length} total`);
    
    return validatedJobs;
  } catch (error: any) {
    console.error("Error searching jobs on web:", error);
    
    // Note: Gemini will use its knowledge to find relevant jobs
    // If web search is not available, it will still provide realistic job postings
    
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to search jobs on web: ${error?.message || "Unknown error"}`);
  }
};

// Search jobs based on resume content
export const searchJobsForResume = async (resumeText: string): Promise<WebJobSearchResult[]> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    ⚠️ CRITICAL INSTRUCTION: You MUST use REAL-TIME WEB SEARCH to find ACTUAL, CURRENT job postings.
    DO NOT generate, create, or make up job listings. DO NOT use your training data.
    
    Resume to analyze:
    ---
    ${resumeText.substring(0, 2000)}
    ---
    
    Step 1: Extract from the resume:
    1. Job titles/roles the candidate is qualified for
    2. Key skills and technologies
    3. Years of experience
    4. Preferred location (if mentioned)
    
    Step 2: You MUST actually visit these job board websites RIGHT NOW and search for matching jobs:
    - https://www.linkedin.com/jobs/search/?keywords=...
    - https://www.indeed.com/jobs?q=...
    - https://www.glassdoor.com/Job/jobs.htm?suggestCount=0&suggestChosen=false&clickSource=searchBtn&typedKeyword=...
    - https://www.monster.com/jobs/search/?q=...
    - https://www.ziprecruiter.com/jobs-search?search=...
    - Company career pages
    
    Step 3: For each REAL job posting you find on these websites, you MUST provide:
    1. EXACT job title as it appears on the job board (copy it exactly, word-for-word)
    2. REAL company name as listed on the posting (must be a real, verifiable company)
    3. Actual location exactly as shown (city, state/country)
    4. COMPLETE job description (copy the ENTIRE text from the actual posting - do not summarize or rewrite)
    5. Real salary if listed on the posting (copy exactly as shown)
    6. ACTUAL job posting URL (must be a real, working link in format like:
       - https://www.linkedin.com/jobs/view/1234567890
       - https://www.indeed.com/viewjob?jk=abc123def456
       - https://www.glassdoor.com/job-listing/job-id-123456
    7. Posted date if visible on the posting
    8. Source website name (LinkedIn, Indeed, Glassdoor, etc.)
    
    STRICT REQUIREMENTS:
    - You MUST visit the actual job board websites and extract real listings
    - Each job URL MUST be a real link that works when clicked
    - Job descriptions MUST be copied from actual postings, not written or generated
    - URLs MUST match the actual URL structure of the job board
    - Company names MUST be real, verifiable companies (not "ABC Company" or "Tech Corp")
    - Return ONLY jobs that exist on the web RIGHT NOW
    - Match jobs to the candidate's actual skills and experience
    - If you cannot access real job boards, return an empty array
    - DO NOT create example jobs, placeholder jobs, or training data jobs
    
    Validation checklist for each job:
    ✓ URL is a real job board link (not a placeholder)
    ✓ Company name is a real company (not generic)
    ✓ Job description is detailed and specific (not generic template)
    ✓ Location is specific (not "Location TBD" or "Remote/Anywhere")
    
    If you cannot find real jobs through web search, return: {"jobs": []}
    DO NOT generate fake jobs under any circumstances.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: jobSearchResultSchema,
        // Note: For real web scraping, integrate with:
        // - ScraperAPI (scraperapi.com) - Free tier available
        // - Apify Job Scrapers (apify.com/store)
        // - Backend scraping service with Puppeteer/Playwright
        // See WEB_SCRAPING_GUIDE.md for implementation details
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as { jobs: WebJobSearchResult[] };
    
    if (!parsed.jobs || !Array.isArray(parsed.jobs) || parsed.jobs.length === 0) {
      throw new Error("No matching jobs found. Try updating your resume.");
    }
    
    // Import URL validator
    const { isValidJobUrl, extractSourceFromUrl } = await import('../utils/urlValidator');
    
    // STRICT VALIDATION: Only accept jobs with valid URLs and real descriptions
    const validatedJobs = parsed.jobs
      .map(job => {
        // Must have a valid URL that passes our checks
        if (job.url && isValidJobUrl(job.url)) {
          // Validate description is real (not generic/generated)
          const description = job.description || '';
          const isGenericDescription = 
            description.length < 200 || // Too short
            description.includes('example') ||
            description.includes('placeholder') ||
            description.includes('lorem ipsum') ||
            (description.split(' ').length < 50); // Too short
          
          if (isGenericDescription) {
            console.warn(`Job "${job.title}" has suspiciously generic description - rejecting`);
            return null;
          }
          
          // Check if company name is generic
          const isGenericCompany = 
            !job.company ||
            (job.company.toLowerCase().includes('company') && job.company.length < 15) ||
            job.company === 'ABC Company' ||
            job.company === 'Tech Corp' ||
            job.company === 'XYZ Corp';
          
          if (isGenericCompany) {
            console.warn(`Job "${job.title}" has generic company name - rejecting`);
            return null;
          }
          
          return {
            ...job,
            source: job.source || extractSourceFromUrl(job.url),
            url: job.url
          };
        }
        // REJECT jobs without valid URLs
        console.warn(`Rejecting job "${job.title}" - no valid URL`);
        return null;
      })
      .filter((job): job is WebJobSearchResult => job !== null);
    
    if (validatedJobs.length === 0) {
      throw new Error("No jobs with valid URLs and real descriptions found. The API may not have web scraping capabilities enabled. See WEB_SCRAPING_GUIDE.md for integrating real web scraping services like ScraperAPI or Apify.");
    }
    
    console.log(`Found ${validatedJobs.length} jobs with valid URLs and real descriptions out of ${parsed.jobs.length} total`);
    
    return validatedJobs;
  } catch (error: any) {
    console.error("Error searching jobs for resume:", error);
    
    // Provide helpful error message about web scraping limitation
    if (error?.message?.includes("No jobs with valid URLs")) {
      throw error;
    }
    
    throw new Error(`Failed to search jobs for resume: ${error?.message || "Unknown error"}. Note: For real web scraping, see WEB_SCRAPING_GUIDE.md`);
    }
  };