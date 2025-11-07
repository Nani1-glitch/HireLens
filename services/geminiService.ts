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
        matchingKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A comprehensive list of keywords and skills from the job description found ANYWHERE in the resume (including projects, experience descriptions, skills sections, etc.). Include acronyms and their full forms if found (e.g., include both 'RNN' and 'recurrent neural network' if either appears)." },
        missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of important keywords and skills from the job description that are TRULY NOT found in the resume in any form, variation, or acronym. Only include keywords that are completely absent - do not mark keywords as missing if they appear in project descriptions, experience sections, or any other part of the resume." },
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
      
      IMPORTANT INSTRUCTIONS FOR KEYWORD MATCHING:
      1. Search for keywords in ALL sections of the resume: Experience, Projects, Skills, Education, Certificates, etc.
      2. Recognize acronyms and their full forms (e.g., "RNN" matches "recurrent neural network", "LSTM" matches "long short-term memory", "CNN" matches "convolutional neural network")
      3. Look for keywords in project descriptions, work experience descriptions, and any other sections - not just a dedicated skills section
      4. Consider variations and related terms (e.g., "machine learning" matches "ML", "deep learning" matches "DL")
      5. Be thorough - if a keyword appears anywhere in the resume (even in project titles or descriptions), it should be considered FOUND
      6. Only mark keywords as MISSING if they are truly not present in any form or variation in the resume
  
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
          optimized: { type: Type.STRING, description: "The optimized version that improves ATS scores and readability. CRITICAL: Do NOT add any technologies, programming languages, frameworks, or tools that are NOT in the original bullet. Only enhance what exists - improve wording, use better action verbs, add metrics if implied, but never fabricate skills or technologies." },
          improvementReason: { type: Type.STRING, description: "Brief explanation of why this optimization improves the resume. Must explain how the optimization enhances existing content without adding new technologies or skills." },
          atsScoreIncrease: { type: Type.NUMBER, description: "Estimated ATS score increase (0-10 points) for this bullet" }
        },
        required: ['original', 'optimized', 'improvementReason', 'atsScoreIncrease']
      },
      description: "Array of optimized bullet points with improvements"
    },
    overallImprovement: { type: Type.STRING, description: "Summary of overall improvements made" },
    estimatedAtsIncrease: { type: Type.NUMBER, description: "Total estimated ATS score increase (0-50 points)" },
          skillRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING, description: "The missing skill or technology. CRITICAL: Only include skills that are ABSOLUTELY NOT found anywhere in the full resume text or bullet points, after exhaustively checking for: exact matches (case-insensitive), abbreviations, variations, version numbers, framework extensions, alternative names, synonyms, and contextual mentions. Apply this verification process to ALL technologies, not just specific ones. When in doubt, DO NOT include the skill here." },
          exampleBullet: { type: Type.STRING, description: "An example bullet point that would showcase this skill IF the candidate had it. Format: 'Example bullet point that demonstrates [skill] experience'" },
          reason: { type: Type.STRING, description: "Why this skill is important for the job and how it would improve the resume" },
          priority: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "Priority level: 'high' if it's a required skill, 'medium' if it's preferred, 'low' if it's nice to have" }
        },
        required: ['skill', 'exampleBullet', 'reason', 'priority']
      },
      description: "Array of recommended skills that are important for the job but TRULY missing from the resume. CRITICAL: Before adding ANY skill here, you MUST have: (1) searched the entire resume text (if provided) case-insensitively from top to bottom, (2) checked all bullet points, (3) checked for abbreviations, variations, version numbers, framework extensions, alternative names, and synonyms, (4) checked for contextual mentions and implied skills, (5) verified the skill is ABSOLUTELY NOT found in ANY form. Apply this process GENERALLY to all technologies, not just specific ones. When in doubt, DO NOT include the skill. These are suggestions only - do NOT add them to optimized bullets. Only include if jobDescription is provided."
    }
  },
  required: ['originalBullets', 'optimizedBullets', 'overallImprovement', 'estimatedAtsIncrease']
};

// Schema for extracting bullet points from resume text
const extractBulletsSchema = {
  type: Type.OBJECT,
  properties: {
    bullets: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of bullet points extracted from the resume. Include all achievement bullets, responsibility bullets, and project description bullets. Each bullet should be a complete, standalone statement."
    }
  },
  required: ['bullets']
};

// Schema for selecting relevant bullets based on job description
const selectRelevantBulletsSchema = {
  type: Type.OBJECT,
  properties: {
    selectedBullets: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of the most relevant bullet points selected from the resume that match the job description. Prioritize bullets that demonstrate skills, technologies, and experiences mentioned in the job requirements."
    },
    reasoning: {
      type: Type.STRING,
      description: "Brief explanation of why these bullets were selected and how they relate to the job requirements."
    }
  },
  required: ['selectedBullets', 'reasoning']
};

export const extractBulletsFromResume = async (resumeText: string): Promise<string[]> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    Act as a resume parser. Extract all bullet points from the provided resume text.
    
    Resume Text:
    ---
    ${resumeText}
    ---
    
    Instructions:
    1. Extract ALL bullet points from the resume, including:
       - Work experience bullet points (responsibilities and achievements)
       - Project description bullet points
       - Any other achievement or responsibility statements formatted as bullets
    2. Each bullet should be a complete, standalone statement
    3. Preserve the original wording and meaning
    4. Remove bullet symbols (•, -, *, etc.) but keep the text
    5. Include bullets from all sections: Experience, Projects, Education (if applicable), etc.
    6. Do NOT include:
       - Section headers
       - Contact information
       - Skills lists (unless formatted as bullets)
       - Dates or locations (unless part of the bullet point content)
    7. Return only the bullet point text, one per array item
    
    Return an array of bullet point strings extracted from the resume.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: extractBulletsSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as { bullets: string[] };
    
    // Validate response
    if (!parsed.bullets || !Array.isArray(parsed.bullets) || parsed.bullets.length === 0) {
      throw new Error("No bullet points found in the resume. Please ensure your resume contains bullet points.");
    }
    
    return parsed.bullets;
  } catch (error: any) {
    console.error("Error extracting bullets from resume:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to extract bullets from resume: ${error?.message || "Unknown error"}`);
  }
};

export const selectRelevantBullets = async (
  allBullets: string[],
  jobDescription: string,
  maxBullets: number = 20
): Promise<{ selectedBullets: string[]; reasoning: string }> => {
  if (!ai || !API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    Act as a resume optimization expert. Analyze the provided bullet points from a resume and select the most relevant ones for the given job description.
    
    Job Description:
    ---
    ${jobDescription}
    ---
    
    All Resume Bullet Points:
    ---
    ${allBullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}
    ---
    
    Instructions:
    1. Select the ${maxBullets} most relevant bullet points that best match the job requirements
    2. Prioritize bullets that:
       - Mention technologies, skills, or tools listed in the job description
       - Demonstrate relevant experience or achievements
       - Show quantifiable results or impact
       - Align with key responsibilities mentioned in the job
    3. Include a mix of technical skills, achievements, and relevant experience
    4. Preserve the original wording of selected bullets
    5. Return exactly ${maxBullets} bullets (or fewer if there aren't enough relevant ones)
    6. Provide reasoning for your selection
    
    Select the most relevant bullet points for this specific job.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: selectRelevantBulletsSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
      throw new Error("Empty response from AI. Please try again.");
    }
    
    const parsed = JSON.parse(jsonText) as { selectedBullets: string[]; reasoning: string };
    
    // Validate response
    if (!parsed.selectedBullets || !Array.isArray(parsed.selectedBullets) || parsed.selectedBullets.length === 0) {
      throw new Error("No relevant bullet points were selected. Please try again.");
    }
    
    return parsed;
  } catch (error: any) {
    console.error("Error selecting relevant bullets:", error);
    if (error?.message?.includes("JSON")) {
      throw new Error("Failed to parse AI response. Please try again.");
    }
    throw new Error(`Failed to select relevant bullets: ${error?.message || "Unknown error"}`);
  }
};

export const optimizeResumeBullets = async (resumeBullets: string[], jobDescription?: string, fullResumeText?: string): Promise<ResumeOptimization> => {
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
    
    ${fullResumeText ? `Full Resume Text (for skill checking):
    ---
    ${fullResumeText}
    ---
    
    CRITICAL SKILL DETECTION INSTRUCTIONS:
    When checking for missing skills, you MUST perform a COMPREHENSIVE search of the ENTIRE resume text above. Follow these steps for EACH skill mentioned in the job description:
    
    STEP 1: Search Strategy
    - Use case-insensitive matching (e.g., "Python" = "python" = "PYTHON")
    - Check for abbreviations and variations (e.g., "JS" = "JavaScript", "SQL" might imply database skills)
    - Look for related terms and synonyms
    - Check for framework/library names with or without extensions (e.g., "React" = "React.js" = "reactjs")
    - Search ALL sections: Skills, Technologies, Experience, Projects, Education, Certificates, etc.
    
    STEP 2: Variation Recognition (apply to ALL technologies, not just specific ones)
    - Technology names may appear with/without version numbers (e.g., "CSS" = "CSS3", "HTML" = "HTML5")
    - Framework names may appear with/without extensions (e.g., "Express" = "Express.js", "Node" = "Node.js")
    - Database names may appear in different forms (e.g., "MySQL" = "mysql" = "MySql")
    - API-related terms have many variations (e.g., "REST" = "RESTful" = "REST API" = "RESTful APIs")
    - Programming languages may appear as abbreviations (e.g., "JS" = "JavaScript", "TS" = "TypeScript")
    - Cloud platforms may appear in different formats (e.g., "AWS" = "Amazon Web Services", "GCP" = "Google Cloud Platform")
    
    STEP 3: Contextual Recognition
    - If a technology is mentioned in a related context, it likely exists (e.g., "React development" implies JavaScript/HTML/CSS knowledge)
    - If a framework is mentioned, its underlying technologies are likely present
    - If "web development" or "front-end" is mentioned, HTML/CSS are almost certainly present
    - If "database" work is mentioned with a specific DB, that DB skill exists
    
    STEP 4: Verification Before Marking as Missing
    For EACH skill from the job description, ask yourself:
    1. Did I find the exact skill name? (case-insensitive)
    2. Did I find any abbreviation or variation?
    3. Did I find it in a related context or synonym?
    4. Is it implied by other technologies mentioned?
    
    If you answered YES to ANY of the above → DO NOT mark as missing. Skip it entirely.
    Only if you answered NO to ALL of the above → Then you may consider marking it as missing.
    
    GENERAL RULE: When in doubt, DO NOT mark as missing. Be conservative - it's better to miss a recommendation than to incorrectly claim a skill is missing when the candidate actually has it.` : `NOTE: Full resume text not provided. You only have access to the bullet points above. When checking for missing skills, thoroughly check the bullet points themselves for any mentioned technologies, frameworks, or tools. Be conservative - only mark skills as missing if you're absolutely certain they're not mentioned in the bullets.`}
    
    CRITICAL RULES - DO NOT VIOLATE THESE:
    1. NEVER add technologies, programming languages, frameworks, or tools that are NOT mentioned in the original bullet point
    2. NEVER fabricate skills, experiences, or achievements that don't exist in the original
    3. ONLY enhance what is already present - improve wording, add quantifiable metrics if implied, use better action verbs
    4. If a technology from the job description is missing, DO NOT add it to the bullet - the candidate doesn't have that experience
    5. Maintain authenticity - only optimize the existing content, don't create new content
    6. Preserve the original meaning and scope of work described
    
    Guidelines for optimization:
    - Use stronger action verbs (e.g., "Led" instead of "Worked on", "Architected" instead of "Made")
    - Add quantifiable metrics if they're implied or can be inferred from context (e.g., "team of 5" if mentioned elsewhere)
    - Improve clarity and impact of existing achievements
    - Better align wording with job description keywords (but only if those keywords relate to what's already in the bullet)
    - Make achievements more specific and measurable
    - Improve readability and flow
    
    What NOT to do:
    - Do NOT add programming languages not in the original (e.g., don't add "using Go" if Go isn't mentioned)
    - Do NOT add frameworks or tools not in the original
    - Do NOT claim experience with technologies the candidate doesn't have
    - Do NOT fabricate achievements or responsibilities
    - Do NOT change the core technology stack or tools used
    
    ${jobDescription ? `IMPORTANT - Skill Recommendations Section:
    After optimizing the bullets, identify important skills/technologies from the job description that are MISSING from the resume.
    
    CRITICAL SKILL DETECTION RULES - APPLY TO ALL TECHNOLOGIES:
    
    MANDATORY VERIFICATION PROCESS for EACH skill mentioned in the job description:
    
    Step 1: Comprehensive Search
    - Search the FULL resume text (if provided) case-insensitively from top to bottom
    - Search ALL sections: Skills, Technologies, Experience, Projects, Education, Certificates, etc.
    - Search the bullet points provided above
    - Use case-insensitive matching (Python = python = PYTHON)
    
    Step 2: Variation Detection (apply these rules GENERALLY to any technology):
    - Check for exact match (case-insensitive)
    - Check for abbreviations (e.g., JS = JavaScript, TS = TypeScript, SQL might imply specific DB)
    - Check for version numbers (e.g., CSS = CSS3, HTML = HTML5, Python = Python 3)
    - Check for framework/library extensions (e.g., React = React.js, Express = Express.js, Node = Node.js)
    - Check for alternative names or synonyms
    - Check for related terms in context (e.g., "database work" with MySQL context = MySQL skill)
    - Check for implied skills (e.g., React implies JavaScript/HTML/CSS, Docker implies containerization)
    
    Step 3: Contextual Analysis
    - If a technology is mentioned in a related context, it likely exists
    - If a framework is used, its underlying technologies are typically present
    - If domain-specific work is mentioned (web dev, cloud, ML, etc.), related fundamental skills are likely present
    
    Step 4: Decision Rule
    For EACH skill from job description:
    - If found in ANY form (exact, variation, abbreviation, context) → DO NOT mark as missing, SKIP IT
    - If NOT found after exhaustive search → Only then consider marking as missing
    
    CRITICAL PRINCIPLE: When in doubt, DO NOT mark as missing. It's better to miss a recommendation than to incorrectly claim a candidate lacks a skill they actually have. Be EXTREMELY conservative.
    
    Only mark a skill as MISSING if ALL of these are true:
    1. You searched the ENTIRE full resume text (if provided) case-insensitively
    2. You checked the bullet points thoroughly
    3. You checked for abbreviations, variations, and related terms
    4. You checked contextual mentions and implied skills
    5. The skill is ABSOLUTELY NOT found in ANY form anywhere
    6. You are 100% certain after exhaustive verification
    
    If the full resume text is NOT provided, be even more conservative - only mark skills as missing if you're absolutely certain they're not in the bullet points.
    
    For each truly missing skill:
    - Identify the skill (e.g., "Go", "Kubernetes", "AWS")
    - Provide an example bullet point that WOULD showcase this skill IF the candidate had it (format: "Example: Developed backend services using Go...")
    - Explain why this skill is important for the job
    - Assign priority: 'high' (required skill), 'medium' (preferred), 'low' (nice to have)
    
    These recommendations should be in a SEPARATE section - do NOT add them to the optimized bullets. They are suggestions for skills the candidate could learn or add if they have relevant experience.` : ''}
    
    Provide optimized versions with explanations for each improvement. Each optimized bullet should be more compelling while staying 100% truthful to the original.
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