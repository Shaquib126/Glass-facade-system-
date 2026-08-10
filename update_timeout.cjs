const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

code = code.replace(/60000/g, '15000'); // Change timeouts to 15 seconds

fs.writeFileSync('src/lib/faceApi.ts', code);
console.log('done updating faceApi.ts');
