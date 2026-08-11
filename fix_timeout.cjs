const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

code = code.replace(/15000/g, '30000');
code = code.replace(/10000/g, '30000');

fs.writeFileSync('src/lib/faceApi.ts', code);
console.log('done updating timeouts');
