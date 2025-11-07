# Hirelens Application - MCP Description

## Application Overview

**Name:** Hirelens  
**Type:** Single Page Application (SPA)  
**Purpose:** AI-powered job posting quality analyzer and resume-to-job matching tool  
**Technology Stack:** React 19.2.0, TypeScript, Vite 6.2.0, Tailwind CSS (CDN), Google Gemini AI API

## Architecture

### Application Structure
```
hirelens/
├── App.tsx                 # Main application component
├── index.tsx              # Application entry point
├── index.html             # HTML template
├── index.css              # Global styles (Tailwind directives)
├── vite.config.ts         # Vite build configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── types.ts               # TypeScript type definitions
├── components/            # React UI components
│   ├── ScoreGauge.tsx     # Circular progress gauge component
│   └── icons.tsx          # SVG icon components
├── services/              # External service integrations
│   └── geminiService.ts   # Google Gemini AI API client
├── utils/                 # Utility functions
│   └── scorer.ts          # Job posting scoring algorithm
└── public/                # Static assets
    ├── hirelens-icon.svg
    └── hirelens-logo-stacked.svg
```

## Core Functionality

### Primary Features

1. **Job Posting Quality Analysis**
   - Analyzes job posting text for quality metrics
   - Extracts structured data: salary, location, posting age, work type
   - Calculates quality scores across multiple dimensions
   - Provides cost-of-living analysis

2. **Resume ATS Matching**
   - Compares resume (PDF) against job description
   - Identifies matching and missing keywords
   - Provides match score (0-100)
   - Generates improvement suggestions

### User Interface Components

**Main Layout:**
- Header with logo and branding
- Two-column layout (input | results)
- Tabbed interface (Job Analysis | ATS Check)

**Input Section:**
- Text area for job posting text
- Example job postings (Excellent, Average, Poor)
- File upload for PDF resumes

**Results Section:**
- Score gauge visualization (circular progress)
- Info cards with categorized metrics
- Keyword lists (matching/missing)
- Summary and suggestions

## Data Models

### Type Definitions

**ExtractedData:**
```typescript
{
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
```

**ScoredAnalysis:**
```typescript
ExtractedData & {
  scores: {
    overall: number;        // 0-100
    salary: number;         // 0-100
    location: number;       // 0-100
    costOfLiving: number;  // 0-100
    redFlags: number;      // 0-100 (posting age)
  };
}
```

**AtsAnalysis:**
```typescript
{
  matchScore: number;           // 0-100
  matchingKeywords: string[];   // Found keywords
  missingKeywords: string[];   // Missing keywords
  summary: string;              // Overall assessment
  suggestions: string;          // Improvement recommendations
}
```

## Services & Tools

### Gemini AI Service (`services/geminiService.ts`)

**Configuration:**
- API Client: `@google/genai` SDK v1.29.0
- Model: `gemini-2.0-flash`
- Authentication: API key via environment variable (`GEMINI_API_KEY`)
- Response Format: JSON with structured schemas

**Functions:**

1. **analyzeJobPosting(jobText: string): Promise<ExtractedData>**
   - Input: Raw job posting text
   - Process: Sends prompt to Gemini with JSON schema
   - Output: Structured extracted data
   - Schema: Defines required fields and types for extraction

2. **analyzeResumeAgainstJob(resumeText: string, jobText: string): Promise<AtsAnalysis>**
   - Input: Resume text (extracted from PDF) and job description
   - Process: ATS-style analysis via Gemini
   - Output: Match score, keywords, suggestions
   - Schema: Defines ATS analysis structure

### Scoring Utility (`utils/scorer.ts`)

**Function: calculateScores(data: ExtractedData): ScoredAnalysis**

Scoring Algorithm:
- **Salary Score (0-35 points):**
  - Base: 25 points if salary range provided
  - Spread bonus: +10 for <15% spread, +5 for <30% spread
  
- **Location Score (0-20 points):**
  - Remote: 20 points
  - Hybrid: 15 points
  - Onsite: 5 points
  - Unspecified: 0 points
  
- **Cost of Living Score (0-30 points):**
  - Uses AI-provided costOfLivingScore (0-100)
  - Normalized: (score / 100) * 30
  
- **Posting Age Score (0-15 points):**
  - <7 days: 100% (15 points)
  - <14 days: 80% (12 points)
  - <30 days: 50% (7.5 points)
  - <60 days: 20% (3 points)
  - 60+ days: 0% (0 points)

- **Overall Score:** Sum of all points normalized to 0-100

### PDF Processing

**Library:** `pdfjs-dist` v4.4.168  
**Worker:** CDN-hosted worker (`https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`)

**Process:**
1. User uploads PDF file
2. FileReader reads as ArrayBuffer
3. pdfjs-dist extracts text from all pages
4. Text concatenated and passed to ATS analysis

## User Flows

### Flow 1: Job Posting Analysis

1. User pastes job posting text OR selects example
2. User clicks "Analyze Posting"
3. App sends job text to `analyzeJobPosting()`
4. Gemini extracts structured data
5. `calculateScores()` processes data
6. UI displays:
   - Overall quality score (gauge)
   - Category scores (info cards)
   - Summary and details

### Flow 2: Resume ATS Check

1. User provides job description (from Flow 1 or new)
2. User uploads PDF resume
3. App extracts text from PDF
4. User clicks "Check Resume Match"
5. App sends resume + job to `analyzeResumeAgainstJob()`
6. Gemini performs ATS analysis
7. UI displays:
   - Match score (gauge)
   - Matching keywords (green badges)
   - Missing keywords (amber badges)
   - Summary and suggestions

## Environment Configuration

**Required Environment Variables:**
- `GEMINI_API_KEY`: Google Gemini API key (required)

**Configuration Files:**
- `.env` or `.env.local`: Contains API key
- `vite.config.ts`: Loads env vars and injects via `define`

**Build Process:**
- Vite loads `.env` files using `loadEnv()`
- Environment variables injected at build time via `define`
- Client-side code accesses via `process.env.GEMINI_API_KEY`

## UI Components

### ScoreGauge Component
- **Type:** Circular progress indicator
- **Props:** `score: number`, `label: string`
- **Features:**
  - Animated score transitions (800ms)
  - Color-coded: red (<50), amber (50-75), green (75+)
  - SVG-based rendering

### Icon Components
- DollarSignIcon
- LocationMarkerIcon
- BuildingIcon
- ClockIcon
- QuestionMarkCircleIcon
- DocumentTextIcon

## Styling

- **Framework:** Tailwind CSS (via CDN)
- **Theme:** Dark mode (slate-900 background)
- **Colors:**
  - Primary: Blue/Indigo gradient
  - Success: Green (text-green-500)
  - Warning: Amber (text-amber-400)
  - Error: Red (text-red-500)
- **Responsive:** Mobile-first design with breakpoints

## Error Handling

**API Errors:**
- Invalid API key detection
- Network error handling
- JSON parsing errors
- User-friendly error messages

**File Processing Errors:**
- PDF extraction failures
- Empty file detection
- Invalid file type validation

## State Management

**React Hooks Used:**
- `useState`: Component state
- `useCallback`: Memoized handlers
- `useEffect`: Side effects (not currently used)

**State Variables:**
- `jobText`: Current job posting text
- `analysis`: Job analysis results
- `isLoading`: Loading state
- `error`: Error messages
- `activeTab`: Current tab ('job' | 'ats')
- `selectedFile`: Uploaded PDF file
- `atsAnalysis`: ATS analysis results

## Dependencies

**Runtime:**
- react: ^19.2.0
- react-dom: ^19.2.0
- @google/genai: ^1.29.0
- pdfjs-dist: 4.4.168

**Development:**
- vite: ^6.2.0
- typescript: ~5.8.2
- @vitejs/plugin-react: ^5.0.0
- @types/react: ^19.0.0
- @types/react-dom: ^19.0.0
- @types/node: ^22.14.0

## API Integration Points

**Google Gemini API:**
- Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Authentication: API key via `X-goog-api-key` header
- Request Format: JSON with structured schema
- Response Format: JSON matching defined schema

## Security Considerations

- API key stored in `.env` file (not committed to git)
- `.env` and `.env.local` in `.gitignore`
- API key injected at build time (not exposed in source)
- Client-side validation for file types
- Error messages don't expose sensitive data

## Performance Optimizations

- Memoized callbacks with `useCallback`
- Lazy loading of PDF.js worker
- Conditional rendering based on state
- Efficient state updates

## Future Enhancement Opportunities

1. Backend API for API key security
2. User authentication and saved analyses
3. Export results as PDF/CSV
4. Historical comparison of job postings
5. Resume template suggestions
6. Integration with job boards
7. Batch processing for multiple resumes

