export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    const userMsg = messages?.[0]?.content || '';

    const prompt = `Crie uma página HTML completa de checkout para: ${userMsg}

IMPORTANTE: Responda APENAS com o código HTML puro, sem explicações, sem markdown, sem blocos de código.
O HTML deve começar com <!DOCTYPE html> e terminar com </html>.
Inclua CSS inline e JavaScript inline no mesmo arquivo.
A página deve ter formulário com campos: Nome, Email, Telefone, CPF (todos opcionais).
Inclua seção de benefícios, preço em destaque e botão de compra PIX.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.5 }
        })
      }
    );

    const data = await response.json();
    console.log('Gemini full response:', JSON.stringify(data).substring(0, 1000));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Text length:', text.length);

    const clean = text.replace(/```html?/gi, '').replace(/```/g, '').trim();

    return res.status(200).json({
      content: [{ type: 'text', text: clean }]
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
