const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

code = code.replace(
`new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })`,
`new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })`
);

fs.writeFileSync('src/lib/faceApi.ts', code);
