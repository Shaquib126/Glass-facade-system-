const fs = require('fs');

const code = `import * as faceapi from 'face-api.js';

const MODEL_URL = \`\${window.location.origin}/models\`;

// Configurable threshold for face matching. Lower is stricter.
export const DEFAULT_MATCH_THRESHOLD = 0.55;

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  try {
    const loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Face models load timeout. Please check your internet connection.')), 30000);
    });

    await Promise.race([loadPromise, timeoutPromise]);
    modelsLoaded = true;
  } catch (error) {
    console.error('Error loading face-api models:', error);
    throw error;
  }
};

export const getFaceDescriptor = async (mediaEl: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => {
  if (!modelsLoaded) await loadModels();

  let targetEl: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement = mediaEl;

  // Scale down image if it's too large to prevent memory issues and speed up landmark/descriptor extraction
  if (mediaEl instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const MAX_DIM = 640;
    
    // Always use naturalWidth/naturalHeight for images not in DOM
    let w = mediaEl.naturalWidth || mediaEl.width || 640;
    let h = mediaEl.naturalHeight || mediaEl.height || 640;

    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
      else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(mediaEl, 0, 0, w, h);
      targetEl = canvas;
    }
  }

  const detectionPromise = faceapi
    .detectSingleFace(targetEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  const timeoutPromise = new Promise<undefined>((_, reject) => {
    setTimeout(() => reject(new Error('Face detection taking longer than expected. Please ensure your face is clearly visible and well-lit.')), 30000);
  });

  const detection = await Promise.race([detectionPromise, timeoutPromise]) as any;
  
  return detection?.descriptor;
};

export const compareDescriptors = (desc1: Float32Array, desc2: Float32Array, threshold: number = DEFAULT_MATCH_THRESHOLD) => {
  const distance = faceapi.euclideanDistance(desc1, desc2);
  return { isMatch: distance < threshold, distance };
};
`;

fs.writeFileSync('src/lib/faceApi.ts', code);
console.log('done updating faceApi');
