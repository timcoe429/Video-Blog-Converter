const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Generate content endpoint
app.post('/api/generate-content', async (req, res) => {
  try {
    const { transcript, videoTitle } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Based on this video transcript, generate the following content in JSON format:

1. SEO-optimized title (60 characters max)
2. Meta description (150 characters max)
3. 5 FAQs with schema markup ready for WordPress
4. 4 key takeaways that are SEO-focused

Transcript: ${transcript}

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
  "schemaMarkup": "string containing complete FAQ schema for WordPress"
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ 
        error: `API request failed: ${errorData.error?.message || 'Unknown error'}` 
      });
    }

    const data = await response.json();
    let responseText = data.content[0].text;
    
    // Clean up any markdown formatting
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    try {
      const generatedContent = JSON.parse(responseText);
      res.json(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      res.status(500).json({ error: 'Failed to parse generated content' });
    }

  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
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
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Anthropic API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});