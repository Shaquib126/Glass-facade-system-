import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let MONGODB_URI = process.env.MONGODB_URI || '';
MONGODB_URI = MONGODB_URI.split('";')[0]; // Quick fix
MONGODB_URI = MONGODB_URI.replace('.net/?', '.net/glass-facade?');
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected!');
    process.exit(0);
  })
  .catch(e => {
    console.error("Error:", e.message);
    process.exit(1);
  });
