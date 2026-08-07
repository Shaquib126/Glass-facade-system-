const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
`    aiClient = new GoogleGenAI({ apiKey: key });`,
`    aiClient = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });`
);

code = code.replace(
`    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: 'You are a helpful, professional AI assistant for the Glass Fab Attendance and Site Management system. Your role is to help admins and workers understand how to use the dashboard, manage site geofences, and review attendance logs. Keep your answers concise and highly relevant.',
      }
    });`,
`    const chat = ai.chats.create({
      model: 'gemini-3.6-flash',
      history: history,
      config: {
        systemInstruction: 'You are a helpful, professional AI assistant for the Glass Fab Attendance and Site Management system. Your role is to help admins and workers understand how to use the dashboard, manage site geofences, and review attendance logs. Keep your answers concise and highly relevant.',
      }
    });`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
