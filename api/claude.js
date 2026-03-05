export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { system, messages } = req.body;
    const userMsg = messages?.[0]?.content || '';
    const prompt = system ? `${system}\n\n${userMsg}` : userMsg;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            maxOutputTokens: 8192, 
            temperature: 0.7,
            responseMimeType: "text/plain"
          }
        })
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data).substring(0, 500));
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Text length:', text.length);

    return res.status(200).json({
      content: [{ type: 'text', text }]
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
