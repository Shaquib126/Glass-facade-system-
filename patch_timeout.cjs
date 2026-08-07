const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

code = code.replace(
  `setTimeout(() => reject(new Error('Face models load timeout. Please check your internet connection.')), 30000);`,
  `setTimeout(() => reject(new Error('Face models load timeout. Please check your internet connection.')), 60000);`
);

fs.writeFileSync('src/lib/faceApi.ts', code);
console.log("Patched timeout");
