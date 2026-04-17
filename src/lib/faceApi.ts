import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

// Configurable threshold for face matching. Lower is stricter.
export const DEFAULT_MATCH_THRESHOLD = 0.5;

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
  } catch (error) {
    console.error('Error loading face-api models:', error);
    throw error;
  }
};

export const getFaceDescriptor = async (mediaEl: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => {
  if (!modelsLoaded) await loadModels();
  
  const detection = await faceapi
    .detectSingleFace(mediaEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  return detection?.descriptor;
};

export const compareDescriptors = (desc1: Float32Array, desc2: Float32Array, threshold: number = DEFAULT_MATCH_THRESHOLD) => {
  const distance = faceapi.euclideanDistance(desc1, desc2);
  return distance < threshold;
};
