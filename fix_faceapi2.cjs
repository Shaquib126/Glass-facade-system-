const fs = require('fs');
let code = fs.readFileSync('src/lib/faceApi.ts', 'utf8');

const oldCheck = `  // Scale down image if it's too large to prevent memory issues and speed up landmark/descriptor extraction
  if (mediaEl instanceof HTMLImageElement) {`;

const newCheck = `  // Scale down input if it's too large to prevent memory issues and speed up landmark/descriptor extraction
  if (mediaEl instanceof HTMLImageElement || mediaEl instanceof HTMLCanvasElement || mediaEl instanceof HTMLVideoElement) {`;

code = code.replace(oldCheck, newCheck);

const oldWidthHeight = `    // Always use naturalWidth/naturalHeight for images not in DOM
    let w = mediaEl.naturalWidth || mediaEl.width || 640;
    let h = mediaEl.naturalHeight || mediaEl.height || 640;`;

const newWidthHeight = `    let w = 640;
    let h = 640;
    if (mediaEl instanceof HTMLImageElement) {
      w = mediaEl.naturalWidth || mediaEl.width || 640;
      h = mediaEl.naturalHeight || mediaEl.height || 640;
    } else if (mediaEl instanceof HTMLVideoElement) {
      w = mediaEl.videoWidth || 640;
      h = mediaEl.videoHeight || 640;
    } else if (mediaEl instanceof HTMLCanvasElement) {
      w = mediaEl.width || 640;
      h = mediaEl.height || 640;
    }`;

code = code.replace(oldWidthHeight, newWidthHeight);

fs.writeFileSync('src/lib/faceApi.ts', code);
console.log('done updating faceApi 2');
