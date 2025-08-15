import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'gemini-2.0-flash-exp' } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    console.log(`[gemma-ai] Processing ${messages.length} messages`);

    // Use the free Gemini API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY || ''
      },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gemma-ai] Gemini API error:`, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    return NextResponse.json({
      success: true,
      response: aiResponse,
      model: model
    });

  } catch (error: any) {
    console.error('[gemma-ai] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process AI request' 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Free AI API endpoint is available',
    endpoint: '/api/gemma-ai',
    method: 'POST',
    body: {
      messages: [
        { role: 'user', content: 'Your message here' }
      ],
      model: 'gemini-2.0-flash-exp'
    }
  });
}
