import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let MONGODB_URI = process.env.MONGODB_URI || '';
MONGODB_URI = MONGODB_URI.split('";')[0]; // Quick fix
console.log("Trimmed URI:", MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected!'))
  .catch(e => console.error(e));
