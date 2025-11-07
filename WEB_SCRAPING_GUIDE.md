# Web Scraping Guide for Real Job Postings

## Current Limitation

The Gemini API does **not** have real-time web scraping capabilities. When you request job postings, it generates realistic-looking jobs based on its training data, but these are **not actual, current job listings** from job boards.

## The Problem

- Gemini API cannot actually visit LinkedIn, Indeed, or other job boards in real-time
- It generates example jobs that look realistic but don't exist
- URLs provided may look correct but don't link to real postings
- Job descriptions are generated, not scraped from actual postings

## Solution: Integrate Real Web Scraping

To get **real, current job postings**, you need to integrate a web scraping service. Here are recommended options:

### Option 1: ScraperAPI (Recommended)

**Pros:**
- Handles proxies, CAPTCHAs, and anti-bot measures automatically
- Simple API
- Good for job boards

**Setup:**
1. Sign up at https://www.scraperapi.com/
2. Get your API key
3. Install: `npm install axios`
4. Update `services/geminiService.ts`:

```typescript
import axios from 'axios';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SCRAPER_API_URL = 'http://api.scraperapi.com';

async function scrapeLinkedInJobs(searchQuery: string) {
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchQuery)}`;
  const response = await axios.get(`${SCRAPER_API_URL}?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`);
  // Parse HTML response to extract job listings
  return parseJobListings(response.data);
}
```

### Option 2: Apify Actors

**Pros:**
- Pre-built actors for LinkedIn, Indeed, etc.
- Handles complex scraping scenarios
- More reliable for job boards

**Setup:**
1. Sign up at https://apify.com/
2. Use actors like:
   - LinkedIn Job Scraper: https://apify.com/apify/linkedin-jobs-scraper
   - Indeed Scraper: https://apify.com/apify/indeed-scraper
3. Install: `npm install apify-client`
4. Update `services/geminiService.ts`:

```typescript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

async function scrapeLinkedInJobs(searchQuery: string) {
  const run = await client.actor('apify/linkedin-jobs-scraper').call({
    searchKeywords: searchQuery,
    location: 'United States',
    maxItems: 20,
  });
  
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}
```

### Option 3: SerpAPI (Google Search Results)

**Pros:**
- Gets real-time Google search results
- Can search for jobs across multiple boards
- Simple integration

**Setup:**
1. Sign up at https://serpapi.com/
2. Install: `npm install google-search-results-nodejs`
3. Update `services/geminiService.ts`:

```typescript
import { getJson } from 'serpapi';

async function searchJobsOnGoogle(query: string) {
  const results = await getJson({
    engine: 'google',
    q: `${query} site:linkedin.com/jobs OR site:indeed.com`,
    api_key: process.env.SERPAPI_KEY,
  });
  
  return results.organic_results.map(result => ({
    title: result.title,
    url: result.link,
    snippet: result.snippet,
  }));
}
```

### Option 4: Direct Job Board APIs

Some job boards offer official APIs:

- **LinkedIn**: https://docs.microsoft.com/en-us/linkedin/
- **Indeed**: https://ads.indeed.com/jobroll/xmlfeed
- **Glassdoor**: Partner API (requires partnership)

## Implementation Steps

1. **Choose a scraping service** (recommend ScraperAPI or Apify)
2. **Add API key to `.env`**:
   ```
   SCRAPER_API_KEY=your_key_here
   # OR
   APIFY_TOKEN=your_token_here
   ```
3. **Create a new service file** `services/jobScraper.ts`:
   ```typescript
   export async function scrapeRealJobs(criteria: SearchCriteria): Promise<WebJobSearchResult[]> {
     // Implement scraping logic here
     // Return real job postings with valid URLs
   }
   ```
4. **Update `geminiService.ts`** to use the scraper instead of Gemini for job search
5. **Keep Gemini** for analyzing resumes against jobs (that still works!)

## Current Workaround

Until real scraping is implemented, the app:
- ✅ Validates URLs to ensure they match job board URL patterns
- ✅ Filters out generic descriptions and company names
- ✅ Shows warnings when jobs might not be real
- ⚠️ Still relies on Gemini generating jobs (not ideal)

## Next Steps

1. Integrate ScraperAPI or Apify
2. Replace `searchJobsOnWeb` and `searchJobsForResume` to use real scraping
3. Keep `analyzeResumeAgainstJob` using Gemini (this works well!)
4. Test with real job postings

## Cost Considerations

- **ScraperAPI**: ~$29/month for 100k requests
- **Apify**: Pay-per-use, ~$0.10-0.50 per actor run
- **SerpAPI**: ~$50/month for 5k searches

For MVP, ScraperAPI is the most cost-effective option.
