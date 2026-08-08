import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let MONGODB_URI = process.env.MONGODB_URI || '';
MONGODB_URI = MONGODB_URI.split('";')[0]; // Quick fix
// wait, maybe the password itself is wrong? Let's check if it connects.
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected!');
    process.exit(0);
  })
  .catch(e => {
    console.error("Error:", e.message);
    process.exit(1);
  });
