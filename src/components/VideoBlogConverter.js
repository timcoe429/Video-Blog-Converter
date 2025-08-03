import React, { useState } from 'react';
import { Copy, Download, Video, FileText, Tag, MessageSquare } from 'lucide-react';

const VideoBlogConverter = () => {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [results, setResults] = useState(null);

  // Extract YouTube video ID from URL
  const extractVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  // Clean transcript using AI
  const formatTranscript = async (text) => {
    if (!text) return '';
    
    try {
      setProcessingStep('🤖 Cleaning transcript with AI...');
      const response = await fetch('/api/clean-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript: text })
      });

      if (!response.ok) {
        console.error('Failed to clean transcript, using original');
        return text;
      }

      const data = await response.json();
      
      // Log success
      console.log('Transcript cleaned successfully');
      
      return data.cleanedTranscript || text;
    } catch (error) {
      console.error('Error cleaning transcript:', error);
      return text;
    }
  };

  // Generate content using backend API
  const generateContent = async (transcript, videoTitle) => {
    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript,
          videoTitle
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating content:', error);
      throw new Error(error.message || 'Failed to generate content');
    }
  };

  const handleProcess = async () => {
    if (!url || !transcript) {
      alert('Please provide both URL and transcript');
      return;
    }

    setProcessing(true);
    setProcessingStep('🔍 Extracting video information...');
    
    try {
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Format the transcript
      const formattedTranscript = await formatTranscript(transcript);
      
      // Generate video title from URL or use default
      const videoTitle = `Video Content - ${videoId}`;
      
      setProcessingStep('✨ Generating SEO content with AI...');
      // Generate content using Claude (use the CLEANED transcript)
      const generatedContent = await generateContent(formattedTranscript, videoTitle);
      
      // Prepare results
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      
      setProcessingStep('📝 Finalizing content...');
      
      setResults({
        videoId,
        formattedTranscript,
        thumbnailUrl,
        seoTitle: generatedContent.seoTitle,
        metaDescription: generatedContent.metaDescription,
        faqs: generatedContent.faqs,
        keyTakeaways: generatedContent.keyTakeaways,
        schemaMarkup: generatedContent.schemaMarkup || generateFAQSchema(generatedContent.faqs)
      });

    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  // Generate FAQ Schema markup
  const generateFAQSchema = (faqs) => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    return `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Removed annoying alert - copy happens silently
  };

  const downloadThumbnail = async () => {
    if (!results) return;
    
    try {
      // Fetch the image as a blob
      const response = await fetch(results.thumbnailUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${results.seoTitle.replace(/[^a-zA-Z0-9\s]/g, '-').replace(/\s+/g, '-')}.jpg`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading thumbnail:', error);
      // Fallback to opening in new tab if download fails
      window.open(results.thumbnailUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-8">
            <Video className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Video to Blog Converter</h1>
            <p className="text-gray-600">Transform your video transcripts into blog-ready content</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                YouTube URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Transcript
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your video transcript here..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleProcess}
              disabled={processing}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <div className="flex flex-col items-center">
                    <span>Processing...</span>
                    {processingStep && (
                      <span className="text-xs text-blue-100 mt-1">{processingStep}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Convert to Blog Content
                </>
              )}
            </button>
          </div>

          {results && (
            <div className="mt-12 space-y-8">
              {/* SEO Section */}
              <div className="bg-green-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  SEO Content
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={results.seoTitle}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md"
                      />
                      <button
                        onClick={() => copyToClipboard(results.seoTitle)}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                    <div className="flex gap-2">
                      <textarea
                        value={results.metaDescription}
                        readOnly
                        rows={2}
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md"
                      />
                      <button
                        onClick={() => copyToClipboard(results.metaDescription)}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formatted Transcript */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Formatted Transcript
                </h2>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => copyToClipboard(results.formattedTranscript)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Transcript
                  </button>
                </div>
                <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{results.formattedTranscript}</pre>
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="bg-yellow-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Takeaways</h2>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => copyToClipboard(results.keyTakeaways.map((item, i) => `${i + 1}. ${item}`).join('\n'))}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy All Takeaways
                  </button>
                </div>
                <div className="bg-white p-4 rounded border">
                  <ol className="list-decimal list-inside space-y-2">
                    {results.keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="text-gray-800">{takeaway}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* FAQs */}
              <div className="bg-purple-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  FAQs with Schema
                </h2>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => copyToClipboard(results.schemaMarkup)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Schema Markup
                  </button>
                </div>
                
                <div className="space-y-4">
                  {results.faqs.map((faq, index) => (
                    <div key={index} className="bg-white p-4 rounded border">
                      <h3 className="font-semibold text-gray-900 mb-2">Q: {faq.question}</h3>
                      <p className="text-gray-700">A: {faq.answer}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schema Markup (Copy to WordPress text block)</label>
                  <textarea
                    value={results.schemaMarkup}
                    readOnly
                    rows={8}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              {/* Thumbnail Download */}
              <div className="bg-red-50 p-6 rounded-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Video Thumbnail</h2>
                <div className="flex items-center gap-4">
                  <img
                    src={results.thumbnailUrl}
                    alt="Video thumbnail"
                    className="w-32 h-18 object-cover rounded border"
                  />
                  <button
                    onClick={downloadThumbnail}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Thumbnail
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Filename: {results.seoTitle.replace(/[^a-zA-Z0-9]/g, '-')}.jpg
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoBlogConverter;
