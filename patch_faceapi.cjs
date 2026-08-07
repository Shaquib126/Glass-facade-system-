const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

code = code.replace(
  `const MODEL_URL = '/models';`,
  `const MODEL_URL = \`\${window.location.origin}/models\`;`
);

fs.writeFileSync('src/lib/faceApi.ts', code);
console.log("Patched MODEL_URL");
