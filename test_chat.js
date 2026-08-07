import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({apiKey: 'abc'});
console.log(typeof ai.chats.create);
