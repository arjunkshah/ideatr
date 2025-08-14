import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Try to capture screenshot with optimized settings
    let firecrawlResponse;
    let attempt = 1;
    const maxAttempts = 2;
    
    while (attempt <= maxAttempts) {
      try {
        console.log(`[scrape-screenshot] Attempt ${attempt} for URL: ${url}`);
        
        // Use Firecrawl API to capture screenshot
        firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['screenshot'], // Regular viewport screenshot, not full page
        waitFor: 2000, // Reduced wait time
        timeout: 45000, // Increased timeout to 45 seconds
        blockAds: true,
        maxAge: 3600000, // Use cached data if available (1 hour)
        actions: [
          {
            type: 'wait',
            milliseconds: 1000 // Reduced additional wait
          }
        ]
      })
    });

        if (!firecrawlResponse.ok) {
          const error = await firecrawlResponse.text();
          console.error(`[scrape-screenshot] Attempt ${attempt} failed:`, error);
          
          // If this is the last attempt, throw the error
          if (attempt === maxAttempts) {
            if (error.includes('timeout') || error.includes('timed out')) {
              throw new Error('Screenshot capture timed out. Please try again with a simpler website or check if the URL is accessible.');
            }
            throw new Error(`Firecrawl API error: ${error}`);
          }
          
          // For first attempt failure, try with faster settings
          attempt++;
          continue;
        }

        const data = await firecrawlResponse.json();
        
        if (!data.success || !data.data?.screenshot) {
          if (attempt === maxAttempts) {
            throw new Error('Failed to capture screenshot');
          }
          attempt++;
          continue;
        }

        // Success! Return the screenshot
        return NextResponse.json({
          success: true,
          screenshot: data.data.screenshot,
          metadata: data.data.metadata
        });
        
      } catch (error: any) {
        console.error(`[scrape-screenshot] Attempt ${attempt} error:`, error);
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // For first attempt failure, try with faster settings
        attempt++;
        
        // Adjust settings for retry (faster, less waiting)
        const retrySettings = {
          url,
          formats: ['screenshot'],
          waitFor: 1000, // Even faster wait
          timeout: 25000, // Shorter timeout for retry
          blockAds: true,
          maxAge: 3600000,
          actions: [] // No additional actions for retry
        };
        
        // Update the request body for retry
        firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(retrySettings)
        });
      }
    }

  } catch (error: any) {
    console.error('Screenshot capture error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to capture screenshot' 
    }, { status: 500 });
  }
}