<div align="center">
  <h1>🚀 HireLens</h1>
  <p><strong>AI-Powered Job Analysis & Resume Optimization Platform</strong></p>
  <p>Transform your job search with intelligent resume matching, real-time job discovery, and AI-powered career insights.</p>
  
  [![React](https://img.shields.io/badge/React-19.2.0-blue.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
  [![Vite](https://img.shields.io/badge/Vite-6.2.0-purple.svg)](https://vitejs.dev/)
  [![Gemini AI](https://img.shields.io/badge/Gemini-AI-orange.svg)](https://ai.google.dev/)
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [API Integration](#api-integration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**Hirelens** is a comprehensive AI-powered platform that revolutionizes the job search experience. It combines intelligent job analysis, resume optimization, and real-time job discovery to help job seekers make informed decisions and improve their application success rate.

### Key Capabilities

- **🔍 Smart Job Analysis**: Analyze job postings for quality, salary, location, and red flags
- **📄 ATS Optimization**: Improve resume compatibility with Applicant Tracking Systems
- **🎯 Resume Matching**: Find jobs that match your resume from across the web
- **💼 Career Development**: Track progress, identify skill gaps, and get personalized recommendations
- **📊 Data-Driven Insights**: Salary analysis, market trends, and negotiation strategies

---

## ✨ Features

### Core Job Analysis
- **AI-Powered Job Quality Analysis** - Instant quality scores for salary, location, cost of living, and red flags
- **Resume ATS Check** - Get ATS compatibility scores with keyword matching insights
- **AI Resume Optimizer Pro** - Transform resume bullets into ATS-friendly, impactful statements
- **AI Cover Letter Generator** - Generate personalized cover letters tailored to specific jobs
- **Salary Negotiation Advisor** - Analyze offers with market data and negotiation scripts
- **Multi-Resume Comparison** - Compare multiple resume versions side-by-side

### Career Development
- **Skill Gap Analysis** - Identify missing skills and get personalized learning recommendations
- **Resume Score History** - Track improvements over time with visual timelines
- **Job Application Tracker** - Organize applications with status tracking and reminders
- **Achievement Badges** - Gamified milestones for engagement and motivation

### Job Discovery
- **Resume to Job Matcher** - Find matching opportunities from across the web
- **Job Alert System** - AI-filtered notifications for high-quality postings
- **Salary Spread Analysis** - Comprehensive salary distribution data by title and location
- **Company Interaction Tracking** - See which jobs are most active based on engagement

### Social & Engagement
- **LinkedIn Sharing** - Share results and achievements with one click
- **Anonymous Leaderboard** - Compare resume quality with other users
- **Real-Time Activity Feed** - See platform activity and get inspired

---

## 🛠 Tech Stack

### Frontend
- **React 19** - Modern UI library with hooks and functional components
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework

### AI & APIs
- **Google Gemini AI** - AI-powered analysis and content generation
- **PDF.js** - PDF parsing for resume extraction

### Storage
- **LocalStorage** - Client-side data persistence
- **No Backend Required** - Fully client-side application

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hirelens.git
   cd hirelens
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the project root:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```
   
   > ⚠️ **Important**: Never commit your `.env` file. It's already in `.gitignore`.

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Your Google Gemini API key | ✅ Yes |

### API Key Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file

### Rate Limits

The free tier of Gemini API allows:
- **15 requests per minute**
- The app includes automatic rate limiting and retry logic

For production use, consider upgrading to a paid plan.

---

## 📖 Usage Guide

### Job Analysis

1. Navigate to the **Job Analysis** tab
2. Paste a job posting or use an example
3. Click **Analyze Job**
4. Review quality scores, salary analysis, and recommendations

### Resume ATS Check

1. Go to the **ATS Check** tab
2. Upload your resume (PDF) or paste text
3. Paste the job description
4. Click **Check ATS Compatibility**
5. Review match score, keywords, and improvement suggestions

### Resume Optimization

1. Open the **Resume Optimizer** tab
2. Enter your resume bullet points
3. Click **Optimize Resume**
4. Review AI-powered improvements with explanations

### Job Matching

1. Navigate to **Job Matcher**
2. Upload your resume
3. Toggle **Use Web Search** for real job postings
4. Review matched jobs ranked by compatibility
5. Click **View on Source** to visit the original posting

### Application Tracking

1. Go to the **Tracker** tab
2. Click **Save Current Job** after analyzing
3. Track application status, interviews, and follow-ups
4. View all applications in one dashboard

---

## 📁 Project Structure

```
hirelens/
├── components/          # React components
│   ├── ScoreGauge.tsx  # Circular score display
│   └── icons.tsx       # SVG icon components
├── services/           # API services
│   └── geminiService.ts # Gemini AI integration
├── utils/              # Utility functions
│   ├── scorer.ts              # Score calculation logic
│   ├── pdfExtractor.ts       # PDF text extraction
│   ├── applicationTracker.ts # Application management
│   ├── scoreHistory.ts       # Score tracking
│   ├── achievements.ts       # Badge system
│   ├── leaderboard.ts        # Leaderboard logic
│   ├── activityFeed.ts       # Activity feed
│   ├── jobMatcher.ts         # Job matching
│   ├── companyInteractions.ts # Company tracking
│   └── urlValidator.ts        # URL validation
├── types.ts            # TypeScript type definitions
├── App.tsx             # Main application component
├── index.tsx            # Application entry point
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json         # Dependencies and scripts
```

---

## 🔌 API Integration

### Google Gemini API

Hirelens uses Google Gemini 2.0 Flash for:
- Job posting analysis
- Resume optimization
- Cover letter generation
- Salary analysis
- Skill gap identification
- Job matching

### Web Scraping (Future Enhancement)

Currently, job discovery uses Gemini's knowledge base. For production use with real-time job scraping, see [WEB_SCRAPING_GUIDE.md](./WEB_SCRAPING_GUIDE.md) for integration options:
- ScraperAPI
- Apify
- SerpAPI

---

## 💻 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Code Style

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting (recommended)

### Adding New Features

1. Define types in `types.ts`
2. Add service functions in `services/geminiService.ts`
3. Create utility functions in `utils/`
4. Add UI components in `App.tsx`
5. Update tab navigation

---

## 🐛 Troubleshooting

### Common Issues

**API Key Not Working**
- Verify your API key in `.env`
- Restart the dev server after changing `.env`
- Check API key at [Google AI Studio](https://aistudio.google.com/app/apikey)

**Rate Limit Errors**
- The app includes automatic retry logic
- Wait 1 minute between large batches
- Consider upgrading API plan for production

**PDF Upload Issues**
- Ensure PDF is not password-protected
- Try a different PDF file
- Check browser console for errors

**Jobs Not Loading**
- Check internet connection
- Verify API key is valid
- See [WEB_SCRAPING_GUIDE.md](./WEB_SCRAPING_GUIDE.md) for real scraping options

### Getting Help

- Check the [Issues](https://github.com/yourusername/hirelens/issues) page
- Review [WEB_SCRAPING_GUIDE.md](./WEB_SCRAPING_GUIDE.md) for scraping setup
- See [FEATURES_MARKETING.md](./FEATURES_MARKETING.md) for feature details

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add type definitions for new features
- Update documentation for new features
- Test thoroughly before submitting

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) for powerful AI capabilities
- [React](https://reactjs.org/) for the amazing framework
- [Vite](https://vitejs.dev/) for the blazing-fast build tool
- [Tailwind CSS](https://tailwindcss.com/) for beautiful styling

---

## 📞 Support

- **Documentation**: See [FEATURES_MARKETING.md](./FEATURES_MARKETING.md) for feature details
- **Web Scraping**: See [WEB_SCRAPING_GUIDE.md](./WEB_SCRAPING_GUIDE.md) for real job scraping
- **Issues**: [GitHub Issues](https://github.com/yourusername/hirelens/issues)

---

<div align="center">
  <p>Made with ❤️ for job seekers everywhere</p>
  <p>⭐ Star this repo if you find it helpful!</p>
</div>
