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
      setTimeout(() => reject(new Error('Face models load timeout. Please check your internet connection.')), 15000);
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

  if (mediaEl instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    const MAX_DIM = 640;
    let w = mediaEl.width || 640;
    let h = mediaEl.height || 640;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
      else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
    }

    // Try multiple rotations to account for mobile EXIF orientation
    for (let angle of [0, 90, 180, 270]) {
      if (angle === 0 || angle === 180) {
        canvas.width = w;
        canvas.height = h;
      } else {
        canvas.width = h;
        canvas.height = w;
      }
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(mediaEl, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      const detectionPromise = faceapi
        .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      const timeoutPromise = new Promise<undefined>((_, reject) => {
        setTimeout(() => reject(new Error('Face detection taking longer than expected. Please ensure your face is clearly visible and well-lit.')), 10000);
      });

      try {
        const detection = await Promise.race([detectionPromise, timeoutPromise]) as any;
        if (detection?.descriptor) {
          return detection.descriptor;
        }
      } catch (err: any) {
        // If there's a timeout error, we throw it right away to avoid waiting 40s
        if (err.message && err.message.includes('taking longer than expected')) {
          throw err;
        }
      }
    }
    return undefined;
  }

  // Fallback for Video or Canvas
  const detectionPromise = faceapi
    .detectSingleFace(mediaEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  const timeoutPromise = new Promise<undefined>((_, reject) => {
    setTimeout(() => reject(new Error('Face detection taking longer than expected. Please ensure your face is clearly visible and well-lit.')), 15000);
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
