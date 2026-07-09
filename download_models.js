import fs from 'fs';
import path from 'path';

const urlBase = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const dest = path.join(process.cwd(), 'public', 'models');

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

(async () => {
  for (const file of files) {
    const res = await fetch(urlBase + file);
    if (!res.ok) {
      console.error('Failed to download', file, res.status);
      continue;
    }
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(path.join(dest, file), Buffer.from(buffer));
    console.log('Downloaded', file);
  }
})();
