const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

code = code.replace(
`      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),`,
`      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),\n      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || ''),`
);

fs.writeFileSync('vite.config.ts', code);
