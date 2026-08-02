import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

// Configurable threshold for face matching. Lower is stricter.
export const DEFAULT_MATCH_THRESHOLD = 0.5;

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
      setTimeout(() => reject(new Error('Face models load timeout')), 15000);
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
  
  const detectionPromise = faceapi
    .detectSingleFace(mediaEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  const timeoutPromise = new Promise<undefined>((_, reject) => {
    setTimeout(() => reject(new Error('Face detection timed out')), 10000);
  });

  const detection = await Promise.race([detectionPromise, timeoutPromise]) as any;
    
  return detection?.descriptor;
};

export const compareDescriptors = (desc1: Float32Array, desc2: Float32Array, threshold: number = DEFAULT_MATCH_THRESHOLD) => {
  const distance = faceapi.euclideanDistance(desc1, desc2);
  return { isMatch: distance < threshold, distance };
};
