import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({apiKey: 'abc'});
try {
  const chat = ai.chats.create({
    model: 'gemini-3.6-flash',
    history: [{role: 'user', parts: [{text: 'Hi'}]}],
    config: {
      systemInstruction: 'You are a helpful assistant'
    }
  });
  console.log("History passed!");
} catch (e) {
  console.error("Error with history param:", e);
}
