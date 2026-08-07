import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
async function run() {
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: 'You are a helpful assistant'
      }
    });
    const response = await chat.sendMessage({ message: 'Hello' });
    console.log(response.text);
  } catch (e) {
    console.error(e);
  }
}
run();
