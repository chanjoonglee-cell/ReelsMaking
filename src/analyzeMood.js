/**
 * Step 2: Mood Analysis
 * Uses GPT-4o to analyze diary entries and determine the overall mood.
 * Output: one of → warm | calm | energetic | melancholic
 */

const { OpenAI } = require('openai');

const VALID_MOODS = ['warm', 'calm', 'energetic', 'melancholic'];

/**
 * Analyze the mood of diary entries using GPT-4o.
 * @param {Array<{date: string, text: string, photoFile: string}>} diaries
 * @returns {Promise<{mood: string, confidence: number, reasoning: string}>}
 */
async function analyzeMood(diaries) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const combinedText = diaries
    .map(d => `[${d.date}] ${d.text}`)
    .join('\n');

  const systemPrompt = `You are an emotional tone analyzer for a personal diary app.
Analyze the overall emotional tone across all diary entries and classify it as exactly one of:
- warm: happiness, gratitude, connection, love, comfort
- calm: peace, contentment, mindfulness, reflection, quiet joy
- energetic: excitement, motivation, productivity, enthusiasm, achievement
- melancholic: longing, nostalgia, sadness, introspection, bittersweet feelings

Respond with ONLY a JSON object in this exact format (no markdown, no extra text):
{"mood": "<mood>", "confidence": <0-100>, "reasoning": "<one sentence in Korean explaining why>"}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze the mood of these diary entries:\n\n${combinedText}`,
      },
    ],
    max_tokens: 150,
    temperature: 0.3,
  });

  const raw = response.choices[0].message.content.trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fallback: try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Unexpected mood API response: ${raw}`);
    parsed = JSON.parse(match[0]);
  }

  const mood = parsed.mood?.toLowerCase();
  if (!VALID_MOODS.includes(mood)) {
    throw new Error(`Invalid mood returned: ${mood}. Must be one of: ${VALID_MOODS.join(', ')}`);
  }

  return {
    mood,
    confidence: Math.round(parsed.confidence ?? 80),
    reasoning: parsed.reasoning ?? '',
  };
}

module.exports = { analyzeMood };
