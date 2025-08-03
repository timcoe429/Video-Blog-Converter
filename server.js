const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

// Add fetch for Node.js (for Node.js versions < 18)
if (!globalThis.fetch) {
  const fetch = require('node-fetch');
  globalThis.fetch = fetch;
}

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from React build
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
} else {
  console.warn('Build directory not found. Make sure to run "npm run build" first.');
}

// Helper function to make API calls with proper error handling
const makeOpenAIRequest = async (payload) => {
  console.log('Making OpenAI API request with payload:', {
    model: payload.model,
    max_tokens: payload.max_tokens,
    messageLength: payload.messages[0].content.length
  });
  
  // Validate API key format
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    throw new Error('Invalid OPENAI_API_KEY format. Should start with sk-');
  }
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  
  console.log('OpenAI API response status:', response.status, response.statusText);
  return response;
};

// Clean transcript endpoint
app.post('/api/clean-transcript', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    console.log('Cleaning transcript with ChatGPT...');
    console.log('API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('API Key format check:', process.env.OPENAI_API_KEY?.startsWith('sk-'));
    
    const response = await makeOpenAIRequest({
      model: "gpt-4o-mini",
      max_tokens: 16384,
      messages: [
        {
          role: "user",
          content: `Format this video transcript for blog readability while preserving ALL original transcribed content:

FORMATTING REQUIREMENTS:
1. Identify speakers and format as "Speaker Name:" 
2. Organize into logical sections with clear headings
3. Remove filler words (um, uh, you know, like, etc.)
4. Fix punctuation, capitalization, and obvious typos
5. Add proper paragraph breaks for readability

CRITICAL: Keep ALL the original transcribed words and content. Do NOT:
- Summarize or paraphrase anything
- Add new words or phrases not in the original
- Change the meaning or flow of what was actually said
- Skip any content from the original transcript

The goal is to make the EXACT transcribed content readable and well-organized, not to rewrite it.

Raw transcript:
${transcript}

Return the cleaned and formatted transcript with proper speaker identification and structure.`
        }
      ]
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: { message: 'Failed to parse error response' } };
      }
      
      console.error('OpenAI API error for transcript cleaning:', errorData);
      return res.status(response.status).json({ 
        error: `Failed to clean transcript: ${errorData.error?.message || 'Unknown error'}` 
      });
    }

    const data = await response.json();
    const cleanedTranscript = data.choices[0].message.content.trim();
    
    res.json({ cleanedTranscript });

  } catch (error) {
    console.error('Error cleaning transcript:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      apiKeyPresent: !!process.env.OPENAI_API_KEY,
      apiKeyValid: process.env.OPENAI_API_KEY?.startsWith('sk-')
    });
    
    res.status(500).json({ 
      error: `Failed to clean transcript: ${error.message}`
    });
  }
});

// Generate content endpoint
app.post('/api/generate-content', async (req, res) => {
  try {
    const { transcript, videoTitle } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    console.log('Making request to OpenAI API for content generation...');
    console.log('Transcript length:', transcript.length);
    
    const response = await makeOpenAIRequest({
      model: "gpt-4o-mini",
      max_tokens: 16384,
      messages: [
        {
          role: "user",
                               content: `Based on this clean, formatted video transcript, generate the following content in JSON format:

1. SEO-optimized title (60 characters max)
2. Meta description (150 characters max)
3. 5 FAQs with proper HTML schema markup
4. 4 key takeaways that are SEO-focused

Clean Transcript: ${transcript}

Video Title Context: ${videoTitle || 'Video content'}

Return ONLY a valid JSON object with this structure:
{
  "seoTitle": "string",
  "metaDescription": "string", 
  "faqs": [
    {
      "question": "string",
      "answer": "string"
    }
  ],
  "keyTakeaways": [
    "string"
  ],
  "schemaMarkup": "string containing HTML FAQ section with schema.org microdata"
}

IMPORTANT: The schemaMarkup field must be HTML FAQ section with microdata like:
<div itemscope itemtype="https://schema.org/FAQPage">
  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">Question here?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">Answer here</p>
    </div>
  </div>
</div>

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`
        }
      ]
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: { message: 'Failed to parse error response' } };
      }
      
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      
      // Provide more helpful error messages
      let errorMessage = 'Unknown error';
      if (response.status === 429) {
        errorMessage = 'OpenAI API rate limit exceeded. Please try again in a few minutes.';
      } else if (response.status === 401) {
        errorMessage = 'Invalid API key configuration';
      } else if (response.status === 400) {
        errorMessage = 'Invalid request format';
      } else {
        errorMessage = errorData.error?.message || errorData.message || 'Service temporarily unavailable';
      }
      
      return res.status(response.status).json({ 
        error: `API request failed (${response.status}): ${errorMessage}` 
      });
    }

    const data = await response.json();
    let responseText = data.choices[0].message.content;
    
    // Clean up any markdown formatting
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    try {
      const generatedContent = JSON.parse(responseText);
      res.json(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText);
      res.status(500).json({ error: 'Failed to parse generated content' });
    }

  } catch (error) {
    console.error('Error generating content:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      apiKeyPresent: !!process.env.OPENAI_API_KEY,
      apiKeyValid: process.env.OPENAI_API_KEY?.startsWith('sk-')
    });
    
    res.status(500).json({ 
      error: `Failed to generate content: ${error.message}`
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'build', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send('Application is building. Please try again in a few moments.');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 OpenAI API Key configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`📂 Build directory exists: ${fs.existsSync(path.join(__dirname, 'build'))}`);
  
  // Test API key format
  if (process.env.OPENAI_API_KEY) {
    const keyStart = process.env.OPENAI_API_KEY.substring(0, 15);
    const isValidFormat = process.env.OPENAI_API_KEY.startsWith('sk-');
    console.log(`🔍 API Key starts with: ${keyStart}...`);
    console.log(`✅ API Key format valid: ${isValidFormat}`);
    
    if (!isValidFormat) {
      console.error('❌ WARNING: API key does not start with sk- which is required for OpenAI API');
    }
  } else {
    console.error('❌ WARNING: No OPENAI_API_KEY found in environment variables');
  }
});