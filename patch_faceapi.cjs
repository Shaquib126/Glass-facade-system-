const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

code = code.replace(
`setTimeout(() => reject(new Error('Face detection taking longer than expected. Please ensure your face is clearly visible and well-lit.')), 30000);`,
`setTimeout(() => reject(new Error('Face detection taking longer than expected. Please ensure your face is clearly visible and well-lit.')), 60000);`
);

fs.writeFileSync('src/lib/faceApi.ts', code);
