import { NextRequest } from 'next/server';

// This is a Vercel serverless function that acts as a proxy for Gemini API
// to avoid CORS issues with browser-based requests
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    // Only allow POST requests for actual API calls
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Get the API token from the headers
    const apiToken = req.headers.get('X-Gemini-API-Key');
    if (!apiToken) {
      console.error('Missing Gemini API key in headers');
      return new Response(JSON.stringify({
        error: 'Gemini API token is required',
        details: 'The X-Gemini-API-Key header is missing or empty'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Log that we received a key (mask most of it for security)
    const maskedKey = apiToken.substring(0, 8) + '...' + apiToken.substring(apiToken.length - 4);
    console.log(`Received API key in gemini-proxy: ${maskedKey}`);

    // Parse the request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to parse request body',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!requestData) {
      return new Response(JSON.stringify({
        error: 'Request body is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log('Alternative proxy handling request for Gemini API');

    // Extract parameters from the request
    const {
      model = 'gemini-2.0-flash',
      messages,
      temperature = 0.7,
      max_tokens = 2000
    } = requestData;

    // Convert OpenAI format messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    // Using direct fetch instead of OpenAI SDK for Edge compatibility
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    console.log(`Making request to Gemini endpoint: ${geminiEndpoint}`);

    const response = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: max_tokens,
        }
      })
    });

    // Check if the response is OK
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        console.error(`Gemini API error (${response.status}):`, errorText);
      } catch (error) {
        errorText = 'Could not read error response';
      }
      
      return new Response(JSON.stringify({
        error: `Gemini API returned ${response.status}`,
        details: errorText
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Get the response data
    let rawResponse;
    try {
      rawResponse = await response.json();
      console.log('Received response from Gemini API (direct fetch)');
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to parse Gemini API response',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Transform Gemini response to OpenAI format
    let content = '';
    try {
      content = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text';
    } catch (error) {
      console.error('Failed to extract content from response:', error);
      content = 'Error extracting content from response';
    }

    const formattedResponse = {
      id: 'gemini-' + Date.now(),
      object: 'chat.completion',
      created: Date.now(),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: -1,
        completion_tokens: -1,
        total_tokens: -1
      }
    };

    // Return the formatted response
    return new Response(JSON.stringify(formattedResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-API-Key'
      }
    });
  } catch (error) {
    console.error('Error in gemini-proxy:', error);
    
    return new Response(JSON.stringify({
      error: 'Proxy server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
} 