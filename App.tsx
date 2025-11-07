import React, { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  analyzeJobPosting, 
  analyzeResumeAgainstJob, 
  optimizeResumeBullets,
  extractBulletsFromResume,
  selectRelevantBullets,
  generateCoverLetter, 
  analyzeSalaryNegotiation, 
  compareResumeVersions,
  analyzeSkillGap,
  filterJobPostings,
  analyzeSalarySpread
} from './services/geminiService';
import { calculateScores } from './utils/scorer';
import { extractTextFromPdf } from './utils/pdfExtractor';
import { 
  ScoredAnalysis, 
  AtsAnalysis, 
  ResumeOptimization, 
  CoverLetter, 
  SalaryNegotiation, 
  ResumeComparison,
  JobApplication,
  SkillGapAnalysis,
  JobAlert,
  Achievement,
  LeaderboardEntry,
  ActivityFeedItem,
  ResumeJobMatch,
  CompanyReachOut,
  SalarySpread
} from './types';
import { getApplications, saveApplication, deleteApplication, createApplication } from './utils/applicationTracker';
import { getScoreHistory, saveScoreHistory } from './utils/scoreHistory';
import { getAchievements, checkAndAwardAchievement } from './utils/achievements';
import { getLeaderboardWithSamples, submitScore, getUserBadge } from './utils/leaderboard';
import { getActivityFeedWithSamples, addActivity } from './utils/activityFeed';
import { matchResumeToJobs, matchResumeToWebJobs, JobPosting } from './utils/jobMatcher';
import { searchJobsOnWeb, WebJobSearchResult } from './services/geminiService';
import { trackInteraction, getReachOuts, markReachOutAsRead, simulateCompanyReachOut, getMostActiveJobs, getJobActivityLevel } from './utils/companyInteractions';
import ScoreGauge from './components/ScoreGauge';
import { DollarSignIcon, LocationMarkerIcon, BuildingIcon, ClockIcon, QuestionMarkCircleIcon, DocumentTextIcon } from './components/icons';

// Set worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

const jobPostingExamples = [
  {
    name: 'Excellent Example',
    content: `Senior Backend Engineer (Go)
CloudSphere Inc. - Remote (USA)
Salary: $180,000 - $200,000 per year
Posted: 1 day ago

CloudSphere is seeking a highly skilled Senior Backend Engineer with expertise in Go to join our distributed team. You will be responsible for designing, developing, and maintaining our core cloud infrastructure. We offer a comprehensive benefits package, unlimited PTO, and a strong culture of innovation and collaboration. This is a fully remote position open to candidates across the United States.`
  },
  {
    name: 'Average Example',
    content: `Marketing Associate
MarketPro LLC - Chicago, IL (Hybrid)
Salary: $65,000 - $85,000
Posted: 2 weeks ago

MarketPro LLC is looking for a creative Marketing Associate to support our campaign development and execution. The ideal candidate will have 2-3 years of marketing experience. This is a hybrid role, with 2 days per week in our Chicago office. Responsibilities include social media management, content creation, and event coordination.`
  },
  {
    name: 'Poor Example',
    content: `Junior Graphic Designer
Creative Solutions - New York, NY (Onsite)
Salary: Competitive

We are hiring a Junior Graphic Designer to join our team in NYC. Must be proficient in Adobe Creative Suite. This is a full-time, onsite position. The successful candidate will work on a variety of design projects.
Posted 2 months ago`
  },
  {
    name: 'VR Engineer - Meta Quest',
    content: `VR Software Engineer - Immersive Technologies
Meta Reality Labs - Remote (USA) / Menlo Park, CA (Hybrid)
Salary: $140,000 - $170,000 per year
Posted: 3 days ago

Meta Reality Labs is seeking a talented VR Software Engineer to join our immersive technologies team. You will work on cutting-edge virtual reality experiences using Meta Quest 3, haptic feedback systems, and advanced VR development tools.

Key Responsibilities:
- Develop and optimize VR applications using Unreal Engine 5
- Implement haptic feedback systems for immersive user experiences
- Design and develop fine-grain mesh manipulation techniques for real-time VR
- Build reinforcement learning algorithms for VR navigation and interaction
- Integrate VR hardware including Meta Quest 3, haptic gloves, and Vive Trackers
- Collaborate with cross-functional teams to deliver high-quality VR experiences

Required Qualifications:
- 2+ years of experience in VR development or related field
- Proficiency in Unreal Engine 5 and/or Unity
- Experience with VR hardware (Meta Quest, Vive, Oculus)
- Strong programming skills in C++, Python, or C#
- Knowledge of haptic feedback systems and VR interaction design
- Experience with reinforcement learning or AI/ML in VR contexts

Preferred Qualifications:
- Research experience in VR technologies
- Experience with mesh manipulation and 3D graphics programming
- Knowledge of raycasting and line tracing techniques
- Background in game development or simulation systems

We offer competitive compensation, comprehensive benefits, flexible work arrangements, and the opportunity to work on groundbreaking VR technology. This position can be fully remote or hybrid based in Menlo Park, CA.`
  },
  {
    name: 'Computer Vision Engineer',
    content: `Computer Vision Engineer - AI/ML
TechVision AI - Chicago, IL (Hybrid) / Remote
Salary: $130,000 - $160,000 per year
Posted: 5 days ago

TechVision AI is looking for a Computer Vision Engineer to join our AI/ML team. You will work on advanced computer vision projects including image classification, object detection, semantic segmentation, and deep learning model development.

Key Responsibilities:
- Design and implement convolutional neural networks (CNNs) for image classification and object detection
- Develop and optimize computer vision models using TensorFlow, PyTorch, and Keras
- Work with OpenCV for image processing and computer vision tasks
- Implement object detection models using YOLO (You Only Look Once) and Faster R-CNN architectures
- Work on advanced projects involving VGG16, Vision Transformers, and ensemble learning
- Implement image steganalysis and detection systems
- Build and train GANs for image synthesis and generation
- Perform semantic segmentation for image understanding tasks
- Apply transfer learning techniques to adapt pre-trained models
- Optimize model performance and accuracy through experimentation
- Collaborate with data scientists and ML engineers on production systems

Required Qualifications:
- Master's degree in Computer Science or related field with focus on AI/ML
- 2+ years of experience in computer vision or deep learning
- Strong proficiency in Python, TensorFlow, and PyTorch
- Experience with OpenCV for image processing
- Experience with CNN architectures (VGG16, ResNet, etc.)
- Knowledge of object detection frameworks (YOLO, Faster R-CNN)
- Experience with semantic segmentation techniques
- Knowledge of computer vision techniques and image processing
- Experience with datasets like CIFAR-10, MNIST, COCO, and custom datasets
- Strong understanding of neural networks, backpropagation, and optimization
- Experience with transfer learning and fine-tuning pre-trained models

Preferred Qualifications:
- Experience with Vision Transformers and attention mechanisms
- Knowledge of GANs, RNNs, and LSTM models
- Experience with ensemble learning and model optimization
- Research experience in computer vision or related fields
- Publications or projects in image classification, object detection, or deep learning
- Experience with cloud platforms (AWS, GCP, Azure) for model deployment

We offer a competitive salary, health benefits, flexible PTO, and opportunities for professional growth. This is a hybrid role with 2-3 days per week in our Chicago office, with remote flexibility.`
  },
  {
    name: 'Full-Stack Developer - React/Node',
    content: `Full-Stack Software Engineer
Digital Solutions Inc. - Remote (USA) / Chicago, IL (Hybrid)
Salary: $110,000 - $140,000 per year
Posted: 2 days ago

Digital Solutions Inc. is seeking an experienced Full-Stack Software Engineer to join our development team. You will work on building scalable web applications using modern JavaScript frameworks and technologies.

Key Responsibilities:
- Develop responsive web applications using React.js and Node.js
- Design and implement RESTful APIs and backend services
- Build and maintain database schemas using MySQL
- Integrate third-party services and APIs
- Implement automated testing using Selenium and other testing frameworks
- Collaborate with cross-functional teams using Agile/Scrum methodologies
- Mentor junior developers and contribute to code reviews
- Optimize application performance and user experience

Required Qualifications:
- 2+ years of professional experience in full-stack development
- Strong proficiency in JavaScript, React.js, and Node.js
- Experience with backend frameworks (Express.js, Flask, Spring Boot)
- Database experience with MySQL or similar relational databases
- Knowledge of HTML, CSS3, and modern web development practices
- Experience with version control (Git, GitHub)
- Understanding of RESTful API design and development

Preferred Qualifications:
- Experience with test automation tools (Selenium, Jenkins)
- Knowledge of PHP, Java, or Python
- Experience with LightningJS or similar frameworks
- Background in UI/UX development and optimization
- Experience with CI/CD pipelines and DevOps practices
- Agile/Scrum experience
- Experience leading small teams or mentoring developers

We offer competitive compensation, comprehensive health benefits, flexible work arrangements, professional development opportunities, and a collaborative team environment. This position offers full remote flexibility or hybrid work in our Chicago office.`
  }
];

const App: React.FC = () => {
  const [jobText, setJobText] = useState<string>(jobPostingExamples[0].content);
  const [analysis, setAnalysis] = useState<ScoredAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'job' | 'ats' | 'optimizer' | 'coverletter' | 'salary' | 'compare' | 'tracker' | 'skillgap' | 'alerts' | 'history' | 'badges' | 'leaderboard' | 'activity' | 'matcher' | 'reachouts' | 'salaryspread'>('job');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [atsAnalysis, setAtsAnalysis] = useState<AtsAnalysis | null>(null);
  const [isAtsLoading, setIsAtsLoading] = useState<boolean>(false);
  const [atsError, setAtsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Batch 1 Feature States
  const [resumeBullets, setResumeBullets] = useState<string>('');
  const [resumeOptimization, setResumeOptimization] = useState<ResumeOptimization | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);
  const [optimizerFile, setOptimizerFile] = useState<File | null>(null);
  const [isExtractingBullets, setIsExtractingBullets] = useState<boolean>(false);
  const optimizerFileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<'manual' | 'upload'>('manual');
  const [bulletSelectionReasoning, setBulletSelectionReasoning] = useState<string | null>(null);
  const [fullResumeText, setFullResumeText] = useState<string | null>(null);
  
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState<boolean>(false);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [applicantName, setApplicantName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  
  const [salaryOffer, setSalaryOffer] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [salaryLocation, setSalaryLocation] = useState<string>('');
  const [yearsExperience, setYearsExperience] = useState<string>('');
  const [salaryNegotiation, setSalaryNegotiation] = useState<SalaryNegotiation | null>(null);
  const [isAnalyzingSalary, setIsAnalyzingSalary] = useState<boolean>(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  
  const [resumeVersions, setResumeVersions] = useState<{ id: string; name: string; file: File | null }[]>([]);
  const [resumeComparisons, setResumeComparisons] = useState<ResumeComparison[]>([]);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  
  const [applications, setApplications] = useState<JobApplication[]>([]);
  
  // Batch 2 Feature States
  const [skillGapAnalysis, setSkillGapAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [isAnalyzingSkillGap, setIsAnalyzingSkillGap] = useState<boolean>(false);
  const [skillGapError, setSkillGapError] = useState<string | null>(null);
  
  const [jobAlerts, setJobAlerts] = useState<JobAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState<boolean>(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState({ 
    minQualityScore: 70,
    jobTitles: [] as string[],
    locations: [] as string[],
    workType: [] as ('remote' | 'hybrid' | 'onsite')[]
  });
  
  const [scoreHistory, setScoreHistory] = useState(getScoreHistory());
  const [achievements, setAchievements] = useState<Achievement[]>(getAchievements());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(getLeaderboardWithSamples());
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(getActivityFeedWithSamples());
  
  // Final Features States
  const [resumeMatches, setResumeMatches] = useState<ResumeJobMatch[]>([]);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [useWebSearch, setUseWebSearch] = useState<boolean>(true); // Default to web search
  
  const [companyReachOuts, setCompanyReachOuts] = useState<CompanyReachOut[]>(getReachOuts());
  const [activeJobs, setActiveJobs] = useState(getMostActiveJobs(10));
  
  const [salarySpread, setSalarySpread] = useState<SalarySpread | null>(null);
  const [isAnalyzingSalarySpread, setIsAnalyzingSalarySpread] = useState<boolean>(false);
  const [salarySpreadError, setSalarySpreadError] = useState<string | null>(null);
  const [salarySpreadJobTitle, setSalarySpreadJobTitle] = useState<string>('');
  const [salarySpreadLocation, setSalarySpreadLocation] = useState<string>('');

  // Load applications on mount
  useEffect(() => {
    setApplications(getApplications());
    setScoreHistory(getScoreHistory());
    setAchievements(getAchievements());
    setLeaderboard(getLeaderboardWithSamples());
    setActivityFeed(getActivityFeedWithSamples());
    setCompanyReachOuts(getReachOuts());
    setActiveJobs(getMostActiveJobs(10));
  }, []);
  
  // Update reach outs and active jobs periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCompanyReachOuts(getReachOuts());
      setActiveJobs(getMostActiveJobs(10));
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Reset file input when job description changes to allow uploading a new resume
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear previous analysis and selected file when job changes
    setAtsAnalysis(null);
    setAtsError(null);
    setSelectedFile(null);
    // Clear bullet selection reasoning when job changes
    setBulletSelectionReasoning(null);
  }, [jobText]);

  // Batch 1 Feature Handlers
  const handleOptimizerFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/pdf') {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          setOptimizerError("File size exceeds 10MB. Please upload a smaller file.");
          event.target.value = '';
          if (optimizerFileInputRef.current) {
            optimizerFileInputRef.current.value = '';
          }
          return;
        }
        setOptimizerFile(file);
        setOptimizerError(null);
        setResumeOptimization(null);
        
        // Automatically extract bullets from the uploaded resume
        setIsExtractingBullets(true);
        setBulletSelectionReasoning(null);
        try {
          const resumeText = await extractTextFromPdf(file);
          if (!resumeText.trim()) {
            throw new Error("Could not extract text from the PDF. The file might be empty, image-based, or password-protected.");
          }
          if (resumeText.length < 100) {
            throw new Error("The extracted resume text is too short. Please ensure your resume contains readable text.");
          }
          
          // Store full resume text for skill checking
          setFullResumeText(resumeText);
          
          // Extract all bullets from resume
          const allExtractedBullets = await extractBulletsFromResume(resumeText);
          if (allExtractedBullets.length === 0) {
            throw new Error("No bullet points found in the resume. Please ensure your resume contains bullet points.");
          }
          
          // If job description is present, select the most relevant bullets
          if (jobText.trim() && jobText.trim().length > 50) {
            try {
              const { selectedBullets, reasoning } = await selectRelevantBullets(
                allExtractedBullets,
                jobText.trim(),
                20 // Select top 20 most relevant bullets
              );
              setResumeBullets(selectedBullets.join('\n'));
              setBulletSelectionReasoning(reasoning);
            } catch (selectionError: any) {
              // If selection fails, fall back to all bullets
              console.warn("Failed to select relevant bullets, using all bullets:", selectionError);
              setResumeBullets(allExtractedBullets.join('\n'));
            }
          } else {
            // No job description, use all extracted bullets
            setResumeBullets(allExtractedBullets.join('\n'));
          }
          
          setInputMode('manual'); // Switch to manual mode to show the extracted bullets
        } catch (err: any) {
          console.error("Error extracting bullets:", err);
          setOptimizerError(err.message || "Failed to extract bullet points from resume. Please try again or enter bullets manually.");
          setOptimizerFile(null);
        } finally {
          setIsExtractingBullets(false);
          // Reset input to allow re-upload
          event.target.value = '';
          if (optimizerFileInputRef.current) {
            optimizerFileInputRef.current.value = '';
          }
        }
      } else {
        setOptimizerError("Please upload a PDF file. Other file types are not supported.");
        setOptimizerFile(null);
        event.target.value = '';
        if (optimizerFileInputRef.current) {
          optimizerFileInputRef.current.value = '';
        }
      }
    }
  };

  const handleOptimizeResume = useCallback(async () => {
    if (!resumeBullets.trim()) {
      setOptimizerError("Please enter resume bullet points to optimize.");
      return;
    }
    
    const bullets = resumeBullets.split('\n').filter(b => b.trim());
    if (bullets.length === 0) {
      setOptimizerError("Please enter at least one resume bullet point.");
      return;
    }
    
    setIsOptimizing(true);
    setOptimizerError(null);
    setResumeOptimization(null);

    try {
      // Pass full resume text if available (from uploaded file) so AI can check for skills across entire resume
      if (fullResumeText) {
        console.log("Passing full resume text to optimizer for skill checking");
      } else {
        console.log("No full resume text available - only checking bullet points for skills");
      }
      const result = await optimizeResumeBullets(bullets, jobText.trim() || undefined, fullResumeText || undefined);
      if (!result || !result.optimizedBullets || result.optimizedBullets.length === 0) {
        throw new Error("No optimizations were generated. Please try again with different bullet points.");
      }
      setResumeOptimization(result);
      
      // Track activity and check achievement
      addActivity('resume_optimized', `Optimized ${result.optimizedBullets.length} resume bullets`, result.estimatedAtsIncrease);
      setActivityFeed(getActivityFeedWithSamples());
      
      const achievement = checkAndAwardAchievement('resume_optimized');
      if (achievement) {
        setAchievements(getAchievements());
      }
    } catch (err: any) {
      console.error("Resume optimization error:", err);
      setOptimizerError(err.message || "Failed to optimize resume. Please check your input and try again.");
    } finally {
      setIsOptimizing(false);
    }
  }, [resumeBullets, jobText, fullResumeText]);

  const handleGenerateCoverLetter = useCallback(async () => {
    if (!jobText.trim()) {
      setCoverLetterError("Please provide a job description.");
      return;
    }
    if (jobText.trim().length < 50) {
      setCoverLetterError("Please provide a more detailed job description (at least 50 characters).");
      return;
    }
    if (!selectedFile) {
      setCoverLetterError("Please upload your resume PDF.");
      return;
    }

    setIsGeneratingCoverLetter(true);
    setCoverLetterError(null);
    setCoverLetter(null);

    try {
      const resumeText = await extractTextFromPdf(selectedFile);
      if (!resumeText.trim()) {
        throw new Error("Could not extract text from the PDF. The file might be empty, image-based, or password-protected.");
      }
      if (resumeText.length < 100) {
        throw new Error("The extracted resume text is too short. Please ensure your resume contains readable text.");
      }
      const result = await generateCoverLetter(
        resumeText,
        jobText,
        applicantName.trim() || undefined,
        companyName.trim() || undefined
      );
      if (!result || !result.content) {
        throw new Error("Failed to generate cover letter content. Please try again.");
      }
      setCoverLetter(result);
      
      // Track activity and check achievement
      addActivity('cover_letter_generated', 'Generated a tailored cover letter');
      setActivityFeed(getActivityFeedWithSamples());
      
      const achievement = checkAndAwardAchievement('cover_letter_master');
      if (achievement) {
        setAchievements(getAchievements());
      }
    } catch (err: any) {
      console.error("Cover letter generation error:", err);
      setCoverLetterError(err.message || "Failed to generate cover letter. Please check your inputs and try again.");
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }, [jobText, selectedFile, applicantName, companyName]);

  const handleAnalyzeSalary = useCallback(async () => {
    if (!salaryOffer.trim() || !jobTitle.trim()) {
      setSalaryError("Please provide salary offer and job title.");
      return;
    }

    const offer = parseFloat(salaryOffer.replace(/[^0-9.]/g, ''));
    if (isNaN(offer) || offer <= 0) {
      setSalaryError("Please enter a valid salary amount (e.g., $120000 or 120000).");
      return;
    }
    
    if (offer > 10000000) {
      setSalaryError("Please enter a realistic salary amount (under $10M).");
      return;
    }
    
    if (jobTitle.trim().length < 3) {
      setSalaryError("Please provide a more specific job title.");
      return;
    }
    
    const years = yearsExperience.trim() ? parseInt(yearsExperience) : undefined;
    if (years !== undefined && (years < 0 || years > 50)) {
      setSalaryError("Please enter a valid years of experience (0-50).");
      return;
    }

    setIsAnalyzingSalary(true);
    setSalaryError(null);
    setSalaryNegotiation(null);

    try {
      const result = await analyzeSalaryNegotiation(
        offer,
        jobTitle,
        salaryLocation.trim() || undefined,
        years
      );
      if (!result || !result.marketAnalysis) {
        throw new Error("Failed to get salary analysis. Please try again.");
      }
      setSalaryNegotiation(result);
    } catch (err: any) {
      console.error("Salary analysis error:", err);
      setSalaryError(err.message || "Failed to analyze salary negotiation. Please check your inputs and try again.");
    } finally {
      setIsAnalyzingSalary(false);
    }
  }, [salaryOffer, jobTitle, salaryLocation, yearsExperience]);

  const handleCompareResumes = useCallback(async () => {
    if (!jobText.trim()) {
      setCompareError("Please provide a job description.");
      return;
    }
    if (jobText.trim().length < 50) {
      setCompareError("Please provide a more detailed job description (at least 50 characters).");
      return;
    }
    if (resumeVersions.length < 2) {
      setCompareError("Please upload at least 2 resume versions to compare.");
      return;
    }
    
    if (resumeVersions.length > 5) {
      setCompareError("Please limit to 5 resume versions at a time for best performance.");
      return;
    }

    setIsComparing(true);
    setCompareError(null);
    setResumeComparisons([]);

    try {
      const resumeTexts = await Promise.all(
        resumeVersions.map(async (version) => {
          if (!version.file) throw new Error(`No file for ${version.name}`);
          try {
            const text = await extractTextFromPdf(version.file);
            if (!text.trim() || text.length < 50) {
              throw new Error(`${version.name}: Could not extract sufficient text from PDF.`);
            }
            return { id: version.id, name: version.name, content: text };
          } catch (err: any) {
            throw new Error(`${version.name}: ${err.message}`);
          }
        })
      );

      const comparisons = await compareResumeVersions(resumeTexts, jobText);
      if (!comparisons || comparisons.length === 0) {
        throw new Error("No comparison results generated. Please try again.");
      }
      setResumeComparisons(comparisons);
    } catch (err: any) {
      console.error("Resume comparison error:", err);
      setCompareError(err.message || "Failed to compare resumes. Please check your files and try again.");
    } finally {
      setIsComparing(false);
    }
  }, [jobText, resumeVersions]);

  const handleAddResumeVersion = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'application/pdf') {
        // Check file size
        if (file.size > 10 * 1024 * 1024) {
          setCompareError("File size exceeds 10MB. Please upload a smaller file.");
          event.target.value = '';
          return;
        }
        
        // Check if we already have 5 versions
        if (resumeVersions.length >= 5) {
          setCompareError("Maximum 5 resume versions allowed. Please remove one first.");
          event.target.value = '';
          return;
        }
        
        const newVersion = {
          id: `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name.replace(/\.pdf$/i, ''),
          file: file
        };
        setResumeVersions([...resumeVersions, newVersion]);
        setCompareError(null); // Clear any previous errors
      } else {
        setCompareError("Please upload PDF files only.");
        event.target.value = '';
      }
    }
  };

  const handleRemoveResumeVersion = (id: string) => {
    setResumeVersions(resumeVersions.filter(v => v.id !== id));
  };

  const handleSaveApplication = useCallback(() => {
    if (!jobText.trim()) {
      setError("Please analyze a job posting first.");
      return;
    }
    if (!analysis) {
      setError("Please analyze the job posting before saving.");
      return;
    }

    try {
      // Extract job title and company from job text or use defaults
      const jobTitleMatch = jobText.match(/^([^\n]+)/);
      const companyMatch = jobText.match(/- ([^-]+) -/);
      const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Job Position';
      const company = companyMatch ? companyMatch[1].trim() : (analysis.jobCity ? `${analysis.jobCity}, ${analysis.jobState || ''}`.trim() : 'Company');

      const app = createApplication(jobTitle, company, jobText);
      app.resumeScore = analysis.scores.overall;
      saveApplication(app);
      setApplications(getApplications());
      setActiveTab('tracker');
      setError(null); // Clear any errors
      
      // Track company interaction
      const jobId = `job_${jobTitle}_${company}`.replace(/\s+/g, '_').toLowerCase();
      trackInteraction(jobId, jobTitle, company, 'apply');
      setActiveJobs(getMostActiveJobs(10));
      
      // Track activity
      addActivity('application_saved', `Saved application for ${jobTitle} at ${company}`);
      
      // Check achievements
      const appCount = getApplications().length;
      if (appCount === 5) {
        const achievement = checkAndAwardAchievement('five_applications');
        if (achievement) {
          setAchievements(getAchievements());
          addActivity('badge_earned', `Earned badge: ${achievement.name}`);
        }
      } else if (appCount === 10) {
        const achievement = checkAndAwardAchievement('ten_applications');
        if (achievement) {
          setAchievements(getAchievements());
          addActivity('badge_earned', `Earned badge: ${achievement.name}`);
        }
      }
    } catch (err: any) {
      console.error("Error saving application:", err);
      setError("Failed to save application. Please try again.");
    }
  }, [jobText, analysis]);

  const handleAnalyzeClick = useCallback(async () => {
    if (!jobText.trim()) {
      setError("Job posting text cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const extractedData = await analyzeJobPosting(jobText);
      const scoredData = calculateScores(extractedData);
      setAnalysis(scoredData);
      setActiveTab('job');
      
      // Track company interaction
      const jobTitleMatch = jobText.match(/^([^\n]+)/);
      const companyMatch = jobText.match(/- ([^-]+) -/);
      const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Job Position';
      const company = companyMatch ? companyMatch[1].trim() : 'Company';
      const jobId = `job_${jobTitle}_${company}`.replace(/\s+/g, '_').toLowerCase();
      trackInteraction(jobId, jobTitle, company, 'analyze');
      setActiveJobs(getMostActiveJobs(10));
      
      // Save to score history
      saveScoreHistory({
        date: new Date().toISOString(),
        overallScore: scoredData.scores.overall,
        jobTitle: extractedData.jobCity || 'Job Analysis',
        company: extractedData.jobState || 'Company'
      });
      setScoreHistory(getScoreHistory());
      
      // Submit to leaderboard
      submitScore(scoredData.scores.overall);
      setLeaderboard(getLeaderboardWithSamples());
      
      // Check achievements
      if (scoredData.scores.overall >= 80 && scoredData.scores.overall < 90) {
        const achievement = checkAndAwardAchievement('high_score_80');
        if (achievement) {
          setAchievements(getAchievements());
          addActivity('badge_earned', `Earned badge: ${achievement.name}`);
        }
      } else if (scoredData.scores.overall >= 90 && scoredData.scores.overall < 100) {
        const achievement = checkAndAwardAchievement('high_score_90');
        if (achievement) {
          setAchievements(getAchievements());
          addActivity('badge_earned', `Earned badge: ${achievement.name}`);
        }
      } else if (scoredData.scores.overall === 100) {
        const achievement = checkAndAwardAchievement('perfect_score');
        if (achievement) {
          setAchievements(getAchievements());
          addActivity('badge_earned', `Earned badge: ${achievement.name}`);
        }
      }
      
      // Track activity
      addActivity('score_improved', `Analyzed job posting with score of ${scoredData.scores.overall}`, scoredData.scores.overall);
      setActivityFeed(getActivityFeedWithSamples());
      
      // Check first analysis achievement
      const achievement = checkAndAwardAchievement('first_analysis');
      if (achievement) {
        setAchievements(getAchievements());
      }
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [jobText]);

  const loadExample = (content: string) => {
    setJobText(content);
    setAnalysis(null);
    setError(null);
    setAtsAnalysis(null);
    setAtsError(null);
    setSelectedFile(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        if (file.type === 'application/pdf') {
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                setAtsError("File size exceeds 10MB. Please upload a smaller file.");
                event.target.value = ''; // Clear the input
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                return;
            }
            setSelectedFile(file);
            setAtsError(null);
            setAtsAnalysis(null);
            // Reset input value to allow selecting the same file again
            event.target.value = '';
        } else {
            setAtsError("Please upload a PDF file. Other file types are not supported.");
            setSelectedFile(null);
            event.target.value = ''; // Clear the input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
        }
    }
  };


  const handleAtsCheckClick = async () => {
    if (!jobText.trim()) {
        setAtsError("Please provide a job description first.");
        return;
    }
    if (!selectedFile) {
        setAtsError("Please upload a resume PDF.");
        return;
    }

    setIsAtsLoading(true);
    setAtsError(null);
    setAtsAnalysis(null);

    try {
        const resumeText = await extractTextFromPdf(selectedFile);
        if (!resumeText.trim()) {
            throw new Error("Could not extract text from the PDF. The file might be empty, image-based, or password-protected.");
        }
        if (resumeText.length < 50) {
            throw new Error("The extracted text is too short. Please ensure your resume contains readable text.");
        }
        const result = await analyzeResumeAgainstJob(resumeText, jobText);
        setAtsAnalysis(result);
        
        // Track company interaction
        const jobTitleMatch = jobText.match(/^([^\n]+)/);
        const companyMatch = jobText.match(/- ([^-]+) -/);
        const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Job Position';
        const company = companyMatch ? companyMatch[1].trim() : 'Company';
        const jobId = `job_${jobTitle}_${company}`.replace(/\s+/g, '_').toLowerCase();
        trackInteraction(jobId, jobTitle, company, 'analyze');
        setActiveJobs(getMostActiveJobs(10));
        
        // Simulate company reach out if match score is high
        if (result.matchScore >= 80) {
          simulateCompanyReachOut(jobTitle, company, result.matchScore);
          setCompanyReachOuts(getReachOuts());
        }
        
        // Save to score history
        saveScoreHistory({
          date: new Date().toISOString(),
          overallScore: result.matchScore,
          jobTitle: 'Resume Analysis',
          company: 'ATS Check'
        });
        setScoreHistory(getScoreHistory());
        
        // Submit to leaderboard
        submitScore(result.matchScore);
        setLeaderboard(getLeaderboardWithSamples());
        
        // Check achievements based on match score
        if (result.matchScore >= 80 && result.matchScore < 90) {
          const achievement = checkAndAwardAchievement('high_score_80');
          if (achievement) {
            setAchievements(getAchievements());
            addActivity('badge_earned', `Earned badge: ${achievement.name}`);
          }
        } else if (result.matchScore >= 90 && result.matchScore < 100) {
          const achievement = checkAndAwardAchievement('high_score_90');
          if (achievement) {
            setAchievements(getAchievements());
            addActivity('badge_earned', `Earned badge: ${achievement.name}`);
          }
        } else if (result.matchScore === 100) {
          const achievement = checkAndAwardAchievement('perfect_score');
          if (achievement) {
            setAchievements(getAchievements());
            addActivity('badge_earned', `Earned badge: ${achievement.name}`);
          }
        }
        
        // Track activity
        addActivity('score_improved', `Resume match score: ${result.matchScore}`, result.matchScore);
        setActivityFeed(getActivityFeedWithSamples());
    } catch (err: any) {
        console.error("ATS analysis error:", err);
        setAtsError(err.message || "An unknown error occurred during ATS analysis. Please try again.");
    } finally {
        setIsAtsLoading(false);
        // Reset file input to allow uploading again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
    }
  };

  // Batch 2 Feature Handlers
  const handleAnalyzeSkillGap = useCallback(async () => {
    if (!jobText.trim()) {
      setSkillGapError("Please provide a job description.");
      return;
    }
    if (!selectedFile) {
      setSkillGapError("Please upload your resume PDF.");
      return;
    }

    setIsAnalyzingSkillGap(true);
    setSkillGapError(null);
    setSkillGapAnalysis(null);

    try {
      const resumeText = await extractTextFromPdf(selectedFile);
      if (!resumeText.trim() || resumeText.length < 100) {
        throw new Error("Could not extract sufficient text from the PDF.");
      }
      
      const result = await analyzeSkillGap(resumeText, jobText);
      setSkillGapAnalysis(result);
      
      // Track activity and check achievement
      addActivity('score_improved', `Analyzed skill gaps with gap score of ${result.overallGapScore}`, result.overallGapScore);
      setActivityFeed(getActivityFeedWithSamples());
      
      const achievement = checkAndAwardAchievement('skill_gap_analyzed');
      if (achievement) {
        setAchievements(getAchievements());
      }
    } catch (err: any) {
      console.error("Skill gap analysis error:", err);
      setSkillGapError(err.message || "Failed to analyze skill gap. Please check your inputs and try again.");
    } finally {
      setIsAnalyzingSkillGap(false);
    }
  }, [jobText, selectedFile]);
  
  // Final Feature Handlers
  const handleMatchResumeToJobs = useCallback(async () => {
    if (!selectedFile) {
      setMatchError("Please upload your resume PDF.");
      return;
    }

    setIsMatching(true);
    setMatchError(null);
    setResumeMatches([]);

    try {
      const resumeText = await extractTextFromPdf(selectedFile);
      if (!resumeText.trim() || resumeText.length < 100) {
        throw new Error("Could not extract sufficient text from the PDF.");
      }
      
      let matches: ResumeJobMatch[] = [];
      
      if (useWebSearch) {
        // Use web search to find real jobs with progress tracking
        matches = await matchResumeToWebJobs(resumeText, (current, total) => {
          console.log(`Processing job ${current} of ${total}...`);
        });
      } else {
        // Fallback to example job postings
        const jobPostings: JobPosting[] = jobPostingExamples.map((ex, index) => {
          const titleMatch = ex.content.match(/^([^\n]+)/);
          const companyMatch = ex.content.match(/- ([^-]+) -/);
          return {
            id: `job_${index}_${Date.now()}`,
            title: titleMatch ? titleMatch[1].trim() : 'Job Position',
            company: companyMatch ? companyMatch[1].trim() : 'Company',
            location: 'Location TBD',
            description: ex.content,
            postedDate: new Date().toISOString()
          };
        });
        matches = await matchResumeToJobs(resumeText, jobPostings);
      }
      
      setResumeMatches(matches);
      
      // Track interactions for matched jobs
      matches.forEach(match => {
        trackInteraction(match.jobId, match.jobTitle, match.company, 'view');
        // Simulate company reach out for high matches
        if (match.matchScore >= 80) {
          simulateCompanyReachOut(match.jobTitle, match.company, match.matchScore, match.location, match.salary);
        }
      });
      setActiveJobs(getMostActiveJobs(10));
      setCompanyReachOuts(getReachOuts());
      
      // Track activity
      addActivity('score_improved', `Matched resume to ${matches.length} job${matches.length !== 1 ? 's' : ''} from ${useWebSearch ? 'web search' : 'examples'}`);
      setActivityFeed(getActivityFeedWithSamples());
    } catch (err: any) {
      console.error("Resume matching error:", err);
      setMatchError(err.message || "Failed to match resume to jobs. Please check your inputs and try again.");
    } finally {
      setIsMatching(false);
    }
  }, [selectedFile, useWebSearch]);
  
  const handleAnalyzeSalarySpread = useCallback(async () => {
    if (!salarySpreadJobTitle.trim()) {
      setSalarySpreadError("Please enter a job title.");
      return;
    }

    setIsAnalyzingSalarySpread(true);
    setSalarySpreadError(null);
    setSalarySpread(null);

    try {
      const result = await analyzeSalarySpread(
        salarySpreadJobTitle,
        salarySpreadLocation.trim() || undefined
      );
      setSalarySpread(result);
    } catch (err: any) {
      console.error("Salary spread analysis error:", err);
      setSalarySpreadError(err.message || "Failed to analyze salary spread. Please try again.");
    } finally {
      setIsAnalyzingSalarySpread(false);
    }
  }, [salarySpreadJobTitle, salarySpreadLocation]);
  
  const InfoCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    score: number;
    children: React.ReactNode;
    scoreColorClass: string;
  }> = ({ icon, title, score, children, scoreColorClass }) => (
    <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col backdrop-blur-sm border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-200">{title}</h3>
        </div>
        <span className={`font-bold text-lg ${scoreColorClass}`}>{score}/100</span>
      </div>
      <div className="text-sm text-slate-400 space-y-2">{children}</div>
    </div>
  );
  
  const getScoreColorClass = (score: number) => {
    if (score < 50) return 'text-red-500';
    if (score < 75) return 'text-amber-400';
    return 'text-green-500';
  }

  const renderAnalysis = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-400">Analyzing job posting...</p>
        </div>
      );
    }

    if (error) {
      return <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>;
    }

    if (!analysis) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-slate-400 mb-2">Analysis Results</h2>
            <p>Results from your job posting analysis will appear here.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-sm border border-slate-700">
          <ScoreGauge score={analysis.scores.overall} label="Quality Score" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Overall Quality Analysis</h2>
            <p className="text-slate-400">{analysis.overallSummary}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={<DollarSignIcon className="w-6 h-6 text-green-400" />} title="Salary" score={analysis.scores.salary} scoreColorClass={getScoreColorClass(analysis.scores.salary)}>
                {analysis.salaryMin && analysis.salaryMax ? ( <p>Range: ${analysis.salaryMin.toLocaleString()} - ${analysis.salaryMax.toLocaleString()}</p> ) : ( <p>No salary range provided.</p> )}
            </InfoCard>
            <InfoCard icon={<LocationMarkerIcon className="w-6 h-6 text-blue-400" />} title="Work Location" score={analysis.scores.location} scoreColorClass={getScoreColorClass(analysis.scores.location)}>
                <p>Type: <span className="font-semibold capitalize text-slate-300">{analysis.workLocationType}</span></p>
                {analysis.jobCity && <p>Location: {analysis.jobCity}, {analysis.jobState} {analysis.jobCountry}</p>}
            </InfoCard>
            <InfoCard icon={<BuildingIcon className="w-6 h-6 text-indigo-400" />} title="Cost of Living" score={analysis.scores.costOfLiving} scoreColorClass={getScoreColorClass(analysis.scores.costOfLiving)}>
                {typeof analysis.costOfLivingAnalysis.costOfLivingScore === 'number' && <p>Salary vs CoL Score: <span className="font-semibold text-slate-300">{analysis.costOfLivingAnalysis.costOfLivingScore} / 100</span></p>}
                <p>{analysis.costOfLivingAnalysis.reasoning}</p>
            </InfoCard>
            <InfoCard icon={<ClockIcon className="w-6 h-6 text-cyan-400" />} title="Posting Age" score={analysis.scores.redFlags} scoreColorClass={getScoreColorClass(analysis.scores.redFlags)}>
                {typeof analysis.postingAgeInDays === 'number' ? <p>Posted <span className="font-bold">{analysis.postingAgeInDays}</span> day{analysis.postingAgeInDays === 1 ? '' : 's'} ago.</p> : <p>Posting date not found.</p>}
            </InfoCard>
        </div>
      </div>
    );
  };
  
  const renderAtsUi = () => {
    return (
        <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                    <DocumentTextIcon className="w-8 h-8 text-indigo-400" />
                    <div>
                        <h2 className="text-xl font-bold">ATS Resume Check</h2>
                        <p className="text-slate-400 text-sm">Upload your PDF resume to see how it matches the job description.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <label htmlFor="resume-upload" className="w-full sm:w-auto flex-shrink-0 cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors text-center">
                        {selectedFile ? 'Change File' : 'Upload PDF'}
                    </label>
                    <input id="resume-upload" ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                    <span className="text-slate-400 truncate w-full text-center sm:text-left">{selectedFile ? selectedFile.name : 'No file selected.'}</span>
                </div>
                 <button onClick={handleAtsCheckClick} disabled={isAtsLoading || !selectedFile} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center">
                    {isAtsLoading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>Checking...</> : 'Check Resume Match'}
                </button>
            </div>
            {renderAtsAnalysis()}
        </div>
    )
  }

  const renderAtsAnalysis = () => {
    if (isAtsLoading) {
        return (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400">Performing ATS analysis...</p>
          </div>
        );
    }
    if (atsError) {
        return <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{atsError}</div>;
    }
    if (!atsAnalysis) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center text-slate-500 border-2 border-dashed border-slate-700 rounded-lg p-8">
                <h2 className="text-2xl font-semibold text-slate-400 mb-2">Resume Analysis</h2>
                <p>Upload a resume to compare it against the job description.</p>
            </div>
        );
    }
    return (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-sm border border-slate-700">
                <ScoreGauge score={atsAnalysis.matchScore} label="Match Score" />
                <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">ATS Summary</h2>
                    <p className="text-slate-400">{atsAnalysis.summary}</p>
                </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
                <h3 className="text-lg font-bold mb-3">Suggestions for Improvement</h3>
                <p className="text-slate-400 whitespace-pre-line">{atsAnalysis.suggestions}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
                    <h3 className="font-semibold text-green-400 mb-2">Matching Keywords</h3>
                    <ul className="flex flex-wrap gap-2">{atsAnalysis.matchingKeywords.map(k => <li key={k} className="bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">{k}</li>)}</ul>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
                    <h3 className="font-semibold text-amber-400 mb-2">Missing Keywords</h3>
                    <ul className="flex flex-wrap gap-2">{atsAnalysis.missingKeywords.map(k => <li key={k} className="bg-amber-900/50 text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">{k}</li>)}</ul>
                </div>
            </div>
        </div>
    )
  }

  // Batch 1 Feature Render Functions
  const renderResumeOptimizer = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
        <h2 className="text-xl font-bold mb-4">AI Resume Optimizer Pro</h2>
        <p className="text-slate-400 text-sm mb-4">Upload your resume PDF to automatically extract bullet points, or paste them manually.</p>
        {jobText.trim() && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <p className="text-xs text-blue-300">💡 Tip: Using the job description from the left panel to optimize bullets for this specific role.</p>
          </div>
        )}
        
        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setInputMode('manual');
              setOptimizerError(null);
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              inputMode === 'manual'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => {
              setInputMode('upload');
              setOptimizerError(null);
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              inputMode === 'upload'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Upload Resume PDF
          </button>
        </div>

        {inputMode === 'upload' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <label htmlFor="optimizer-resume-upload" className="w-full sm:w-auto flex-shrink-0 cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors text-center">
                {optimizerFile ? 'Change File' : 'Upload PDF Resume'}
              </label>
              <input 
                id="optimizer-resume-upload" 
                ref={optimizerFileInputRef}
                type="file" 
                accept=".pdf" 
                onChange={handleOptimizerFileChange} 
                className="hidden" 
              />
              <span className="text-slate-400 truncate w-full text-center sm:text-left">
                {optimizerFile ? optimizerFile.name : 'No file selected.'}
              </span>
            </div>
            {isExtractingBullets && (
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-slate-400">
                  {jobText.trim() && jobText.trim().length > 50 
                    ? "Extracting and selecting most relevant bullet points for this job..." 
                    : "Extracting bullet points from resume..."}
                </span>
              </div>
            )}
            {optimizerFile && !isExtractingBullets && (
              <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                <p className="text-xs text-green-300">✓ Resume uploaded. Bullet points extracted and displayed below.</p>
                {bulletSelectionReasoning && (
                  <div className="mt-2 pt-2 border-t border-green-700/30">
                    <p className="text-xs text-green-200 font-semibold mb-1">Selected bullets for this job:</p>
                    <p className="text-xs text-green-300/80">{bulletSelectionReasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <textarea
          value={resumeBullets}
          onChange={(e) => {
            setResumeBullets(e.target.value);
            setOptimizerError(null); // Clear errors when typing
          }}
          placeholder={inputMode === 'upload' 
            ? "Bullet points will appear here after uploading your resume PDF..." 
            : "Paste resume bullet points here, one per line...\nExample:\n• Managed a team of 5 developers\n• Increased sales by 20%\n• Built REST APIs using Node.js"}
          className="w-full p-4 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[200px] text-slate-300 mb-4"
          disabled={isExtractingBullets}
        />
        <div className="flex items-center justify-between mb-4 text-xs text-slate-500">
          <span>{resumeBullets.split('\n').filter(b => b.trim()).length} bullet point{resumeBullets.split('\n').filter(b => b.trim()).length !== 1 ? 's' : ''}</span>
          {resumeBullets.length > 0 && (
            <button
              onClick={() => {
                setResumeBullets('');
                setOptimizerFile(null);
                setBulletSelectionReasoning(null);
                setFullResumeText(null);
              }}
              className="text-slate-400 hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={handleOptimizeResume}
          disabled={isOptimizing || !resumeBullets.trim() || isExtractingBullets}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
        >
          {isOptimizing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Optimizing...
            </>
          ) : (
            'Optimize Resume Bullets'
          )}
        </button>
        {optimizerError && <div className="mt-4 text-red-400 bg-red-900/50 p-4 rounded-lg">{optimizerError}</div>}
      </div>
      {resumeOptimization && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Optimization Results</h3>
              <span className="text-green-400 font-bold">+{resumeOptimization.estimatedAtsIncrease} ATS Points</span>
            </div>
            <p className="text-slate-400 mb-4">{resumeOptimization.overallImprovement}</p>
          </div>
          {resumeOptimization.optimizedBullets.map((bullet, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
              <div className="mb-2">
                <span className="text-xs text-slate-500">Original:</span>
                <p className="text-slate-300">{bullet.original}</p>
              </div>
              <div className="mb-2">
                <span className="text-xs text-green-400">Optimized (+{bullet.atsScoreIncrease} pts):</span>
                <p className="text-green-300 font-medium">{bullet.optimized}</p>
              </div>
              <p className="text-xs text-slate-400 italic">{bullet.improvementReason}</p>
            </div>
          ))}
          
          {resumeOptimization.skillRecommendations && resumeOptimization.skillRecommendations.length > 0 && (
            <div className="bg-amber-900/20 rounded-lg p-6 backdrop-blur-sm border border-amber-700/50">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">💡</span>
                <h3 className="text-lg font-bold text-amber-300">Recommended Skills to Consider</h3>
              </div>
              <p className="text-sm text-amber-200/80 mb-4">
                These skills are important for this job but aren't currently in your resume. If you have experience with any of these, consider adding them. These are suggestions only - do not add them unless you actually have this experience.
              </p>
              <div className="space-y-4">
                {resumeOptimization.skillRecommendations.map((rec, idx) => (
                  <div key={idx} className="bg-slate-800/50 rounded-lg p-4 border border-amber-700/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-amber-400">{rec.skill}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          rec.priority === 'high' ? 'bg-red-900/50 text-red-300' :
                          rec.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-300' :
                          'bg-blue-900/50 text-blue-300'
                        }`}>
                          {rec.priority === 'high' ? 'High Priority' : rec.priority === 'medium' ? 'Medium Priority' : 'Low Priority'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 mb-3">{rec.reason}</p>
                    <div className="bg-slate-900/50 rounded p-3 border border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">Example bullet (if you have this experience):</p>
                      <p className="text-sm text-amber-200 italic">"{rec.exampleBullet}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCoverLetter = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
        <h2 className="text-xl font-bold">Cover Letter Generator</h2>
        <p className="text-slate-400 text-sm">Generate a tailored cover letter from your resume and job description.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            placeholder="Your name (optional)"
            className="p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
          />
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name (optional)"
            className="p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
          />
        </div>
        <label htmlFor="cover-letter-resume" className="block">
          <span className="text-slate-300 mb-2 block">Upload Resume PDF:</span>
          <input
            id="cover-letter-resume"
            type="file"
            accept=".pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
            }}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            <label
              htmlFor="cover-letter-resume"
              className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {selectedFile ? 'Change File' : 'Upload PDF'}
            </label>
            <span className="text-slate-400">{selectedFile ? selectedFile.name : 'No file selected'}</span>
          </div>
        </label>
        <button
          onClick={handleGenerateCoverLetter}
          disabled={isGeneratingCoverLetter || !selectedFile || !jobText.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all"
        >
          {isGeneratingCoverLetter ? 'Generating...' : 'Generate Cover Letter'}
        </button>
        {coverLetterError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{coverLetterError}</div>}
      </div>
      {coverLetter && (
        <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 animate-fade-in">
          <div className="mb-4">
            <span className="text-xs text-slate-500">Tone: {coverLetter.tone}</span>
          </div>
          <div className="prose prose-invert max-w-none">
            <div className="text-slate-300 whitespace-pre-line mb-4">{coverLetter.content}</div>
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Key Highlights:</h4>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              {coverLetter.highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
          </div>
          <button
            onClick={async (e) => {
              try {
                await navigator.clipboard.writeText(coverLetter.content);
                // Show temporary success feedback
                const button = e.currentTarget;
                const originalText = button.textContent;
                button.textContent = '✓ Copied!';
                button.classList.add('bg-green-600');
                setTimeout(() => {
                  button.textContent = originalText;
                  button.classList.remove('bg-green-600');
                }, 2000);
              } catch (err) {
                console.error('Failed to copy:', err);
                alert('Failed to copy to clipboard. Please select and copy manually.');
              }
            }}
            className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all"
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );

  const renderSalaryNegotiation = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
        <h2 className="text-xl font-bold">Salary Negotiation Advisor</h2>
        <p className="text-slate-400 text-sm">Get market analysis and negotiation strategies for your job offer.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 mb-2">Job Title *</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2">Salary Offer *</label>
            <input
              type="text"
              value={salaryOffer}
              onChange={(e) => setSalaryOffer(e.target.value)}
              placeholder="e.g., $120,000"
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2">Location (optional)</label>
            <input
              type="text"
              value={salaryLocation}
              onChange={(e) => setSalaryLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA"
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2">Years of Experience (optional)</label>
            <input
              type="number"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder="e.g., 5"
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
            />
          </div>
        </div>
        <button
          onClick={handleAnalyzeSalary}
          disabled={isAnalyzingSalary || !salaryOffer.trim() || !jobTitle.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all"
        >
          {isAnalyzingSalary ? 'Analyzing...' : 'Analyze Offer'}
        </button>
        {salaryError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{salaryError}</div>}
      </div>
      {salaryNegotiation && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Market Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <span className="text-slate-400 text-sm">Market Rate</span>
                <p className="text-2xl font-bold text-green-400">${salaryNegotiation.marketAnalysis.marketRate.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Your Offer</span>
                <p className="text-2xl font-bold text-blue-400">${salaryNegotiation.currentOffer.salary.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Percentile</span>
                <p className="text-2xl font-bold text-amber-400">{salaryNegotiation.marketAnalysis.percentile}%</p>
              </div>
            </div>
            <p className="text-slate-300">{salaryNegotiation.marketAnalysis.comparison}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Recommended Range</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-slate-400 text-sm">Minimum</span>
                <p className="text-xl font-bold text-slate-300">${salaryNegotiation.recommendedRange.min.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Target</span>
                <p className="text-xl font-bold text-green-400">${salaryNegotiation.recommendedRange.target.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Maximum</span>
                <p className="text-xl font-bold text-slate-300">${salaryNegotiation.recommendedRange.max.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Negotiation Script</h3>
            <p className="text-slate-300 whitespace-pre-line mb-4">{salaryNegotiation.negotiationScript}</p>
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Talking Points:</h4>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                {salaryNegotiation.talkingPoints.map((point, i) => <li key={i}>{point}</li>)}
              </ul>
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-amber-400 mb-2">Risks to Consider:</h4>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                {salaryNegotiation.risks.map((risk, i) => <li key={i}>{risk}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderResumeComparison = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
        <h2 className="text-xl font-bold">Multi-Resume Comparison Tool</h2>
        <p className="text-slate-400 text-sm">Upload multiple resume versions to see which best matches the job description.</p>
        <label htmlFor="resume-version-upload" className="block">
          <input
            id="resume-version-upload"
            type="file"
            accept=".pdf"
            onChange={handleAddResumeVersion}
            className="hidden"
          />
          <div className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors inline-block">
            Add Resume Version
          </div>
        </label>
        {resumeVersions.length > 0 && (
          <div className="space-y-2">
            {resumeVersions.map((version) => (
              <div key={version.id} className="flex items-center justify-between bg-slate-700 p-3 rounded-lg">
                <span className="text-slate-300">{version.name}</span>
                <button
                  onClick={() => handleRemoveResumeVersion(version.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleCompareResumes}
          disabled={isComparing || resumeVersions.length < 2 || !jobText.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all"
        >
          {isComparing ? 'Comparing...' : `Compare ${resumeVersions.length} Resume${resumeVersions.length !== 1 ? 's' : ''}`}
        </button>
        {compareError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{compareError}</div>}
      </div>
      {resumeComparisons.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          {resumeComparisons
            .sort((a, b) => b.matchScore - a.matchScore)
            .map((comparison) => (
              <div key={comparison.resumeId} className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">{comparison.resumeName}</h3>
                  <ScoreGauge score={comparison.matchScore} label="Match Score" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-2">Strengths:</h4>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {comparison.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-2">Weaknesses:</h4>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {comparison.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
                <p className="text-slate-300 italic">{comparison.recommendation}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  const renderApplicationTracker = () => {
    const statusCounts = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Job Application Tracker</h2>
              {applications.length > 0 && (
                <p className="text-slate-400 text-sm mt-1">
                  {applications.length} application{applications.length !== 1 ? 's' : ''} tracked
                </p>
              )}
            </div>
            {analysis && (
              <div className="flex items-center justify-end gap-3 mb-4 flex-wrap">
                <button
                  onClick={() => {
                    const shareText = `I just analyzed a job posting with Hirelens and got a score of ${analysis.scores.overall}/100! 🎯\n\nCheck out Hirelens for AI-powered job analysis and resume optimization.`;
                    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
                    window.open(linkedInUrl, '_blank');
                    addActivity('score_improved', 'Shared analysis on LinkedIn');
                    setActivityFeed(getActivityFeedWithSamples());
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Share on LinkedIn
                </button>
                <button
                  onClick={handleSaveApplication}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition-all whitespace-nowrap"
                >
                  Save Current Job
                </button>
              </div>
            )}
          </div>
          <p className="text-slate-400 text-sm">Track all your job applications, interviews, and follow-ups in one place.</p>
          {Object.keys(statusCounts).length > 0 && (
            <div className="flex gap-4 mt-4 text-sm">
              {statusCounts.applied && <span className="text-blue-300">Applied: {statusCounts.applied}</span>}
              {statusCounts.interview && <span className="text-amber-300">Interview: {statusCounts.interview}</span>}
              {statusCounts.offer && <span className="text-green-300">Offer: {statusCounts.offer}</span>}
              {statusCounts.rejected && <span className="text-red-300">Rejected: {statusCounts.rejected}</span>}
            </div>
          )}
        </div>
        {applications.length === 0 ? (
          <div className="bg-slate-800/50 rounded-lg p-8 backdrop-blur-sm border border-slate-700 text-center">
            <p className="text-slate-400">No applications tracked yet. Analyze a job posting and click "Save Current Job" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications
              .sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime())
              .map((app) => (
                <div key={app.id} className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{app.jobTitle}</h3>
                      <p className="text-slate-400">{app.company}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        app.status === 'applied' ? 'bg-blue-900/50 text-blue-300' :
                        app.status === 'interview' ? 'bg-amber-900/50 text-amber-300' :
                        app.status === 'offer' ? 'bg-green-900/50 text-green-300' :
                        app.status === 'rejected' ? 'bg-red-900/50 text-red-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {app.status.toUpperCase()}
                      </span>
                      {app.resumeScore !== undefined && (
                        <ScoreGauge score={app.resumeScore} label="Score" />
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this application?')) {
                            deleteApplication(app.id);
                            setApplications(getApplications());
                          }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete application"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-400 space-y-1">
                    <p>Applied: {new Date(app.appliedDate).toLocaleDateString()}</p>
                    {app.interviewDate && <p>Interview: {new Date(app.interviewDate).toLocaleDateString()}</p>}
                    {app.followUpDate && <p>Follow-up: {new Date(app.followUpDate).toLocaleDateString()}</p>}
                    {app.notes && <p className="text-slate-300 mt-2">{app.notes}</p>}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  // Batch 2 Feature Render Functions
  const renderSkillGapAnalysis = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
        <h2 className="text-xl font-bold">Skill Gap Analysis Tool</h2>
        <p className="text-slate-400 text-sm">Compare your resume skills with job requirements and get personalized learning recommendations.</p>
        <label htmlFor="skill-gap-resume" className="block">
          <span className="text-slate-300 mb-2 block">Upload Resume PDF:</span>
          <input
            id="skill-gap-resume"
            type="file"
            accept=".pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
            }}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            <label
              htmlFor="skill-gap-resume"
              className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {selectedFile ? 'Change File' : 'Upload PDF'}
            </label>
            <span className="text-slate-400">{selectedFile ? selectedFile.name : 'No file selected'}</span>
          </div>
        </label>
        <button
          onClick={handleAnalyzeSkillGap}
          disabled={isAnalyzingSkillGap || !selectedFile || !jobText.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
        >
          {isAnalyzingSkillGap ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Analyzing...
            </>
          ) : (
            'Analyze Skill Gap'
          )}
        </button>
        {skillGapError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{skillGapError}</div>}
      </div>
      {skillGapAnalysis && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 backdrop-blur-sm border border-slate-700">
            <ScoreGauge score={skillGapAnalysis.overallGapScore} label="Gap Score" />
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">Overall Skill Match</h3>
              <p className="text-slate-400">Higher score means better skill alignment with job requirements.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
              <h4 className="font-semibold text-green-400 mb-2">Your Current Skills</h4>
              <ul className="flex flex-wrap gap-2">
                {skillGapAnalysis.currentSkills.map((skill, i) => (
                  <li key={i} className="bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
              <h4 className="font-semibold text-blue-400 mb-2">Required Skills</h4>
              <ul className="flex flex-wrap gap-2">
                {skillGapAnalysis.requiredSkills.map((skill, i) => (
                  <li key={i} className="bg-blue-900/50 text-blue-300 text-xs font-medium px-2.5 py-1 rounded-full">
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {skillGapAnalysis.missingSkills.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
              <h4 className="font-semibold text-amber-400 mb-4">Missing Skills</h4>
              <ul className="flex flex-wrap gap-2 mb-6">
                {skillGapAnalysis.missingSkills.map((skill, i) => (
                  <li key={i} className="bg-amber-900/50 text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">
                    {skill}
                  </li>
                ))}
              </ul>
              <h4 className="font-semibold text-slate-300 mb-4">Learning Recommendations</h4>
              <div className="space-y-4">
                {skillGapAnalysis.learningRecommendations.map((rec, i) => (
                  <div key={i} className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-slate-200">{rec.skill}</h5>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        rec.priority === 'high' ? 'bg-red-900/50 text-red-300' :
                        rec.priority === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                        'bg-blue-900/50 text-blue-300'
                      }`}>
                        {rec.priority.toUpperCase()} PRIORITY
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-slate-400 text-sm space-y-1">
                      {rec.resources.map((resource, j) => <li key={j}>{resource}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderJobAlerts = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Job Alert System</h2>
        <p className="text-slate-400 text-sm mb-4">Get AI-filtered job postings that match your preferences.</p>
        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Minimum Quality Score</label>
          <input
            type="number"
            min="0"
            max="100"
            value={userPreferences.minQualityScore}
            onChange={(e) => setUserPreferences({ ...userPreferences, minQualityScore: parseInt(e.target.value) || 70 })}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300"
          />
        </div>
        <button
          onClick={async () => {
            setIsLoadingAlerts(true);
            setAlertsError(null);
            try {
              // Search web for jobs based on preferences
              const webJobs = await searchJobsOnWeb({
                jobTitle: userPreferences.jobTitles?.[0],
                location: userPreferences.locations?.[0],
                workType: userPreferences.workType?.[0]
              });
              
              // Import URL validator
              const { isValidJobUrl } = await import('./utils/urlValidator');
              
              // Convert to JobAlert format and analyze quality
              // Only process jobs with valid sources/URLs
              const alerts: JobAlert[] = [];
              const validJobs = webJobs.filter(job => {
                const hasValidUrl = job.url && isValidJobUrl(job.url);
                const hasValidSource = job.source && ['LinkedIn', 'Indeed', 'Glassdoor', 'Monster', 'ZipRecruiter', 'Dice'].includes(job.source);
                return hasValidUrl || hasValidSource;
              });
              
              for (const job of validJobs.slice(0, 15)) { // Limit to 15 for performance
                try {
                  const extractedData = await analyzeJobPosting(job.description);
                  const qualityScore = calculateScores(extractedData).scores.overall;
                  
                  if (qualityScore >= userPreferences.minQualityScore) {
                    alerts.push({
                      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      jobTitle: job.title,
                      company: job.company,
                      location: job.location,
                      salary: job.salary,
                      jobDescription: job.description,
                      qualityScore,
                      matchScore: 85, // Would be calculated based on user profile
                      postedDate: job.postedDate || new Date().toISOString(),
                      source: job.source || 'Web Search',
                      url: job.url && isValidJobUrl(job.url) ? job.url : undefined // Only include valid URLs
                    });
                  }
                } catch (error) {
                  console.error("Error analyzing job:", error);
                  // Continue with other jobs
                }
              }
              
              setJobAlerts(alerts.sort((a, b) => b.qualityScore - a.qualityScore));
            } catch (err: any) {
              setAlertsError(err.message || "Failed to load job alerts.");
            } finally {
              setIsLoadingAlerts(false);
            }
          }}
          disabled={isLoadingAlerts}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
        >
          {isLoadingAlerts ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Loading Alerts...
            </>
          ) : (
            'Load Job Alerts'
          )}
        </button>
        {alertsError && <div className="mt-4 text-red-400 bg-red-900/50 p-4 rounded-lg">{alertsError}</div>}
      </div>
      {jobAlerts.length > 0 && (
        <div className="space-y-4">
          {jobAlerts.map((alert) => (
            <div key={alert.id} className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-lg font-bold">{alert.jobTitle}</h3>
                    {alert.source && (
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-900/50 text-blue-300 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {alert.source}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400">{alert.company} • {alert.location}</p>
                  {alert.salary && <p className="text-green-400 font-semibold mt-1">{alert.salary}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <ScoreGauge score={alert.qualityScore} label="Quality" />
                  <ScoreGauge score={alert.matchScore} label="Match" />
                </div>
              </div>
              <p className="text-slate-300 text-sm line-clamp-3 mb-4">{alert.jobDescription.substring(0, 200)}...</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setJobText(alert.jobDescription);
                    setActiveTab('job');
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all"
                >
                  Analyze This Job
                </button>
                {alert.url && alert.url.startsWith('http') && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition-all"
                    onClick={(e) => {
                      // Validate URL before opening
                      try {
                        new URL(alert.url!);
                      } catch {
                        e.preventDefault();
                        window.alert('Invalid job URL. This job may not have a valid source link.');
                      }
                    }}
                  >
                    View Original Posting
                  </a>
                )}
                {alert.source && !alert.url && (
                  <span className="text-xs text-slate-400 italic">
                    Source: {alert.source} (link unavailable)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScoreHistory = () => {
    const sortedHistory = [...scoreHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const maxScore = Math.max(...scoreHistory.map(h => h.overallScore), 0);
    const minScore = Math.min(...scoreHistory.map(h => h.overallScore), 100);
    const avgScore = scoreHistory.length > 0 
      ? Math.round(scoreHistory.reduce((sum, h) => sum + h.overallScore, 0) / scoreHistory.length)
      : 0;

    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Resume Score History & Progress</h2>
          {scoreHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <span className="text-slate-400 text-sm">Highest Score</span>
                <p className="text-2xl font-bold text-green-400">{maxScore}</p>
              </div>
              <div className="text-center">
                <span className="text-slate-400 text-sm">Average Score</span>
                <p className="text-2xl font-bold text-blue-400">{avgScore}</p>
              </div>
              <div className="text-center">
                <span className="text-slate-400 text-sm">Total Analyses</span>
                <p className="text-2xl font-bold text-slate-300">{scoreHistory.length}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No score history yet. Analyze job postings or resumes to start tracking your progress.</p>
          )}
        </div>
        {sortedHistory.length > 0 && (
          <div className="space-y-3">
            {sortedHistory.map((entry, index) => (
              <div key={index} className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <ScoreGauge score={entry.overallScore} label="" />
                      <div>
                        <p className="font-semibold text-slate-200">
                          {entry.jobTitle || 'Resume Analysis'}
                        </p>
                        {entry.company && <p className="text-sm text-slate-400">{entry.company}</p>}
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAchievements = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Achievement Badges</h2>
        <p className="text-slate-400 text-sm mb-4">Earn badges by reaching milestones and improving your resume.</p>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{achievements.length > 0 ? achievements.map(a => a.icon).join(' ') : '🎯'}</span>
          <span className="text-slate-300 font-semibold">{achievements.length} Badge{achievements.length !== 1 ? 's' : ''} Earned</span>
        </div>
      </div>
      {achievements.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((achievement) => (
            <div key={achievement.id} className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{achievement.icon}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-200">{achievement.name}</h3>
                  <p className="text-sm text-slate-400">{achievement.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Earned: {new Date(achievement.earnedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-lg p-8 backdrop-blur-sm border border-slate-700 text-center">
          <p className="text-slate-400">No badges earned yet. Start using the app to earn your first badge!</p>
        </div>
      )}
    </div>
  );

  const renderLeaderboard = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Anonymous Leaderboard</h2>
        <p className="text-slate-400 text-sm mb-4">Compare your resume quality with other users anonymously.</p>
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Your Badge:</span>
          <span className="font-bold text-blue-400">{getUserBadge()}</span>
        </div>
      </div>
      {leaderboard.length > 0 ? (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div
              key={index}
              className={`bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border ${
                entry.isCurrentUser ? 'border-blue-500' : 'border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold w-8 text-center ${
                    entry.rank === 1 ? 'text-yellow-400' :
                    entry.rank === 2 ? 'text-slate-300' :
                    entry.rank === 3 ? 'text-amber-600' :
                    'text-slate-400'
                  }`}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                  </span>
                  <span className="font-mono text-slate-300">{entry.badge}</span>
                  {entry.isCurrentUser && (
                    <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">You</span>
                  )}
                </div>
                <ScoreGauge score={entry.score} label="" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-lg p-8 backdrop-blur-sm border border-slate-700 text-center">
          <p className="text-slate-400">No leaderboard entries yet. Submit a score to get started!</p>
        </div>
      )}
    </div>
  );

  const renderActivityFeed = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
        <h2 className="text-xl font-bold mb-4">Real-Time Activity Feed</h2>
        <p className="text-slate-400 text-sm">See what's happening on the platform (anonymized for privacy).</p>
      </div>
      {activityFeed.length > 0 ? (
        <div className="space-y-3">
          {activityFeed.map((item) => (
            <div key={item.id} className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-slate-300">{item.description}</p>
                  {item.score !== undefined && (
                    <div className="mt-2">
                      <ScoreGauge score={item.score} label="" />
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-500 ml-4">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-lg p-8 backdrop-blur-sm border border-slate-700 text-center">
          <p className="text-slate-400">No recent activity. Start using the app to see activity!</p>
        </div>
      )}
    </div>
  );

  // Final Feature Render Functions
  const renderResumeJobMatcher = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
        <h2 className="text-xl font-bold">Resume to Job Matcher</h2>
        <p className="text-slate-400 text-sm">Upload your resume to find the best matching job opportunities from the web.</p>
        <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <input
            type="checkbox"
            id="use-web-search"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
          />
          <label htmlFor="use-web-search" className="text-sm text-blue-300 cursor-pointer">
            Search real jobs from the web (LinkedIn, Indeed, Glassdoor, etc.)
          </label>
        </div>
        <label htmlFor="matcher-resume" className="block">
          <span className="text-slate-300 mb-2 block">Upload Resume PDF:</span>
          <input
            id="matcher-resume"
            type="file"
            accept=".pdf"
            onChange={(e) => {
              if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
            }}
            className="hidden"
          />
          <div className="flex items-center gap-4">
            <label
              htmlFor="matcher-resume"
              className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {selectedFile ? 'Change File' : 'Upload PDF'}
            </label>
            <span className="text-slate-400">{selectedFile ? selectedFile.name : 'No file selected'}</span>
          </div>
        </label>
        <button
          onClick={handleMatchResumeToJobs}
          disabled={isMatching || !selectedFile}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
        >
          {isMatching ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              {useWebSearch ? 'Searching web and matching jobs (this may take a minute)...' : 'Matching...'}
            </>
          ) : (
            'Find Matching Jobs'
          )}
        </button>
        {useWebSearch && (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 space-y-2">
            <p className="text-xs text-amber-300">
              ⚠️ Note: Web search processes up to 8 jobs with 5-second delays to respect API rate limits (15 requests/min). This may take up to 1 minute.
            </p>
            <p className="text-xs text-amber-400">
              💡 For production, consider integrating with job board APIs (LinkedIn, Indeed) or web scraping services (Apify, ScraperAPI) for real-time job data.
            </p>
          </div>
        )}
        {matchError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{matchError}</div>}
      </div>
      {resumeMatches.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-bold mb-2">Found {resumeMatches.length} Matching Job{resumeMatches.length !== 1 ? 's' : ''}</h3>
            <p className="text-slate-400 text-sm">Sorted by best match</p>
          </div>
          {resumeMatches.map((match, index) => {
            const activityLevel = getJobActivityLevel(match.jobId);
            return (
              <div key={index} className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-bold">{match.jobTitle}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        activityLevel.level === 'high' ? 'bg-green-900/50 text-green-300' :
                        activityLevel.level === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {activityLevel.level.toUpperCase()} ACTIVITY ({activityLevel.interactionCount} interactions)
                      </span>
                      {match.source && (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-900/50 text-blue-300 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          {match.source}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400">{match.company} • {match.location}</p>
                    {match.salary && <p className="text-green-400 font-semibold mt-1">{match.salary}</p>}
                  </div>
                  <ScoreGauge score={match.matchScore} label="Match" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-2">Strengths</h4>
                    <ul className="flex flex-wrap gap-2">
                      {match.strengths.map((strength, i) => (
                        <li key={i} className="bg-green-900/50 text-green-300 text-xs font-medium px-2.5 py-1 rounded-full">
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {match.weaknesses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-amber-400 mb-2">Areas to Improve</h4>
                      <ul className="flex flex-wrap gap-2">
                        {match.weaknesses.map((weakness, i) => (
                          <li key={i} className="bg-amber-900/50 text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">
                            {weakness}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <p className="text-slate-300 text-sm mb-4">{match.recommendation}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      // Validate job description before setting
                      if (!match.jobDescription || match.jobDescription.length < 100) {
                        alert('This job does not have a valid description. It may not be a real job posting.');
                        return;
                      }
                      // Check if description seems generic
                      if (match.jobDescription.toLowerCase().includes('example') || 
                          match.jobDescription.toLowerCase().includes('placeholder')) {
                        alert('Warning: This job description appears to be generic. It may not be a real job posting.');
                      }
                      setJobText(match.jobDescription);
                      setActiveTab('job');
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all"
                  >
                    Analyze This Job
                  </button>
                  {match.url && match.url.startsWith('http') && (
                    <a
                      href={match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2"
                      onClick={(e) => {
                        // Validate URL before opening
                        try {
                          new URL(match.url!);
                        } catch {
                          e.preventDefault();
                          alert('Invalid job URL. This job may not have a valid source link.');
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on {match.source || 'Source'}
                    </a>
                  )}
                  {match.source && !match.url && (
                    <span className="text-xs text-slate-400 italic">
                      Source: {match.source} (link unavailable)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderCompanyReachOuts = () => {
    const unreadCount = companyReachOuts.filter(r => r.status === 'unread').length;
    
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Company Reach Outs</h2>
              <p className="text-slate-400 text-sm">Companies reaching out to you based on your profile match</p>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>
        </div>
        {companyReachOuts.length > 0 ? (
          <div className="space-y-4">
            {companyReachOuts.map((reachOut) => (
              <div
                key={reachOut.id}
                className={`bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border ${
                  reachOut.status === 'unread' ? 'border-blue-500' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{reachOut.company}</h3>
                      {reachOut.status === 'unread' && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">NEW</span>
                      )}
                    </div>
                    <p className="text-slate-400">{reachOut.jobTitle}</p>
                    {reachOut.location && <p className="text-slate-400 text-sm">{reachOut.location}</p>}
                    {reachOut.salary && <p className="text-green-400 font-semibold mt-1">{reachOut.salary}</p>}
                  </div>
                  <ScoreGauge score={reachOut.matchScore} label="Match" />
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg mb-4">
                  <p className="text-slate-300">{reachOut.message}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {new Date(reachOut.timestamp).toLocaleString()}
                  </span>
                  {reachOut.status === 'unread' && (
                    <button
                      onClick={() => {
                        markReachOutAsRead(reachOut.id);
                        setCompanyReachOuts(getReachOuts());
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg p-8 backdrop-blur-sm border border-slate-700 text-center">
            <p className="text-slate-400">No company reach outs yet. Keep improving your resume match scores to get noticed!</p>
          </div>
        )}
        {activeJobs.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Most Active Job Postings</h3>
            <p className="text-slate-400 text-sm mb-4">Jobs with the most applicant interactions</p>
            <div className="space-y-2">
              {activeJobs.map((job, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-200">{job.jobTitle}</p>
                    <p className="text-sm text-slate-400">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      job.level === 'high' ? 'bg-green-900/50 text-green-300' :
                      job.level === 'medium' ? 'bg-amber-900/50 text-amber-300' :
                      'bg-slate-600 text-slate-400'
                    }`}>
                      {job.level.toUpperCase()}
                    </span>
                    <span className="text-slate-400 text-sm">{job.interactionCount} interactions</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSalarySpread = () => (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700 space-y-4">
        <h2 className="text-xl font-bold">Salary Spread Analysis</h2>
        <p className="text-slate-400 text-sm">Get comprehensive salary distribution data for any job title and location.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 mb-2">Job Title *</label>
            <input
              type="text"
              value={salarySpreadJobTitle}
              onChange={(e) => {
                setSalarySpreadJobTitle(e.target.value);
                setSalarySpreadError(null);
              }}
              placeholder="e.g., Software Engineer"
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-300 mb-2">Location (Optional)</label>
            <input
              type="text"
              value={salarySpreadLocation}
              onChange={(e) => {
                setSalarySpreadLocation(e.target.value);
                setSalarySpreadError(null);
              }}
              placeholder="e.g., San Francisco, CA"
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleAnalyzeSalarySpread}
          disabled={isAnalyzingSalarySpread || !salarySpreadJobTitle.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
        >
          {isAnalyzingSalarySpread ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Analyzing...
            </>
          ) : (
            'Analyze Salary Spread'
          )}
        </button>
        {salarySpreadError && <div className="text-red-400 bg-red-900/50 p-4 rounded-lg">{salarySpreadError}</div>}
      </div>
      {salarySpread && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-slate-800/50 rounded-lg p-6 backdrop-blur-sm border border-slate-700">
            <h3 className="text-lg font-bold mb-4">
              Salary Spread: {salarySpread.jobTitle}
              {salarySpread.location && ` in ${salarySpread.location}`}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <span className="text-slate-400 text-sm block">10th Percentile</span>
                <p className="text-xl font-bold text-slate-300">
                  ${salarySpread.data.find(d => d.percentile === 10)?.salary.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <span className="text-slate-400 text-sm block">25th Percentile</span>
                <p className="text-xl font-bold text-blue-400">
                  ${salarySpread.data.find(d => d.percentile === 25)?.salary.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="text-center">
                <span className="text-slate-400 text-sm block">Median (50th)</span>
                <p className="text-xl font-bold text-green-400">
                  ${salarySpread.marketMedian.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <span className="text-slate-400 text-sm block">75th Percentile</span>
                <p className="text-xl font-bold text-blue-400">
                  ${salarySpread.data.find(d => d.percentile === 75)?.salary.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <span className="text-slate-400 text-sm block">Average</span>
                <p className="text-2xl font-bold text-blue-400">${salarySpread.marketAverage.toLocaleString()}</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <span className="text-slate-400 text-sm block">Range</span>
                <p className="text-lg font-bold text-slate-300">
                  ${salarySpread.range.min.toLocaleString()} - ${salarySpread.range.max.toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <span className="text-slate-400 text-sm block">Sample Size</span>
                <p className="text-2xl font-bold text-slate-300">{salarySpread.sampleSize.toLocaleString()}</p>
              </div>
            </div>
            {/* Visual salary distribution bar */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Salary Distribution</h4>
              <div className="relative h-8 bg-slate-700 rounded-lg overflow-hidden">
                <div className="absolute inset-0 flex">
                  {salarySpread.data.map((point, index) => {
                    const prevPoint = index > 0 ? salarySpread.data[index - 1] : { percentile: 0, salary: salarySpread.range.min };
                    const width = ((point.salary - prevPoint.salary) / (salarySpread.range.max - salarySpread.range.min)) * 100;
                    const left = ((prevPoint.salary - salarySpread.range.min) / (salarySpread.range.max - salarySpread.range.min)) * 100;
                    return (
                      <div
                        key={point.percentile}
                        className="h-full"
                        style={{
                          width: `${width}%`,
                          left: `${left}%`,
                          backgroundColor: point.percentile === 50 ? '#10b981' : point.percentile >= 75 ? '#3b82f6' : '#64748b'
                        }}
                        title={`${point.percentile}th percentile: $${point.salary.toLocaleString()}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>${salarySpread.range.min.toLocaleString()}</span>
                <span>${salarySpread.range.max.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-semibold rounded-t-lg transition-colors ${
        isActive
          ? 'bg-slate-800/50 border-b-2 border-blue-500 text-white'
          : 'text-slate-400 hover:bg-slate-700/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <img 
              src="/hirelens-icon.svg" 
              alt="Hirelens Logo" 
              className="h-14 sm:h-16 w-14 sm:w-16 flex-shrink-0"
            />
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600 leading-tight">
              Hirelens
            </h1>
          </div>
          <p className="text-center mt-2 text-slate-400 max-w-2xl mx-auto">
            Analyze job descriptions and check your resume's match with our AI-powered tools.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col">
            <div className="mb-4">
              <label className="mb-2 font-semibold text-slate-300 block">Load an Example</label>
              <div className="flex flex-wrap gap-2">{jobPostingExamples.map((example) => <button key={example.name} onClick={() => loadExample(example.content)} className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-colors">{example.name}</button>)}</div>
            </div>
            <textarea 
              id="job-posting" 
              value={jobText} 
              onChange={(e) => {
                setJobText(e.target.value);
                setError(null); // Clear errors when user types
              }} 
              placeholder="Paste job description here..." 
              className="flex-grow w-full p-4 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow min-h-[500px] text-slate-300" 
              aria-label="Job Posting Text Input"
            />
            {error && (
              <div className="mt-2 text-red-400 bg-red-900/50 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <button 
              onClick={handleAnalyzeClick} 
              disabled={isLoading || !jobText.trim()} 
              className="mt-4 w-full bg-brand-secondary hover:bg-brand-primary disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-blue-500/50"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Analyzing...
                </>
              ) : (
                'Analyze Posting'
              )}
            </button>
          </div>

          <div className="w-full">
            <div className="border-b border-slate-700 mb-6 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                <TabButton label="Job Analysis" isActive={activeTab === 'job'} onClick={() => setActiveTab('job')} />
                <TabButton label="ATS Check" isActive={activeTab === 'ats'} onClick={() => setActiveTab('ats')} />
                <TabButton label="Resume Optimizer" isActive={activeTab === 'optimizer'} onClick={() => setActiveTab('optimizer')} />
                <TabButton label="Cover Letter" isActive={activeTab === 'coverletter'} onClick={() => setActiveTab('coverletter')} />
                <TabButton label="Salary Advisor" isActive={activeTab === 'salary'} onClick={() => setActiveTab('salary')} />
                <TabButton label="Compare Resumes" isActive={activeTab === 'compare'} onClick={() => setActiveTab('compare')} />
                <TabButton label="Skill Gap" isActive={activeTab === 'skillgap'} onClick={() => setActiveTab('skillgap')} />
                <TabButton label="Job Alerts" isActive={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} />
                <TabButton label="History" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <TabButton label="Badges" isActive={activeTab === 'badges'} onClick={() => setActiveTab('badges')} />
                <TabButton label="Leaderboard" isActive={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} />
                <TabButton label="Activity" isActive={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
                <TabButton label="Job Matcher" isActive={activeTab === 'matcher'} onClick={() => setActiveTab('matcher')} />
                <TabButton label="Reach Outs" isActive={activeTab === 'reachouts'} onClick={() => setActiveTab('reachouts')} />
                <TabButton label="Salary Spread" isActive={activeTab === 'salaryspread'} onClick={() => setActiveTab('salaryspread')} />
                <TabButton label="Tracker" isActive={activeTab === 'tracker'} onClick={() => setActiveTab('tracker')} />
              </div>
            </div>
            {activeTab === 'job' && renderAnalysis()}
            {activeTab === 'ats' && renderAtsUi()}
            {activeTab === 'optimizer' && renderResumeOptimizer()}
            {activeTab === 'coverletter' && renderCoverLetter()}
            {activeTab === 'salary' && renderSalaryNegotiation()}
            {activeTab === 'compare' && renderResumeComparison()}
            {activeTab === 'skillgap' && renderSkillGapAnalysis()}
            {activeTab === 'alerts' && renderJobAlerts()}
            {activeTab === 'history' && renderScoreHistory()}
            {activeTab === 'badges' && renderAchievements()}
            {activeTab === 'leaderboard' && renderLeaderboard()}
            {activeTab === 'activity' && renderActivityFeed()}
            {activeTab === 'matcher' && renderResumeJobMatcher()}
            {activeTab === 'reachouts' && renderCompanyReachOuts()}
            {activeTab === 'salaryspread' && renderSalarySpread()}
            {activeTab === 'tracker' && renderApplicationTracker()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
