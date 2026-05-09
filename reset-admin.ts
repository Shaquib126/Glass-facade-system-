import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/glass-facade';
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://') && !MONGODB_URI.startsWith('localhost')) {
  if (MONGODB_URI.includes(',') && MONGODB_URI.includes('replicaSet=')) {
    MONGODB_URI = 'mongodb://' + MONGODB_URI;
  } else {
    MONGODB_URI = 'mongodb+srv://' + MONGODB_URI;
  }
}

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  name: String
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);

async function run() {
  console.log('Connecting to', MONGODB_URI.replace(/:([^:@]{3})[^:@]*@/, ':$1***@')); // Hide pass
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  // Let's delete all users with that email first so we avoid collisions
  await User.deleteMany({ email: 'adminglassfacade@gmail.com' });
  await User.deleteMany({ role: 'admin' });
  
  // Create a fresh admin entry
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await User.create({
    email: 'adminglassfacade@gmail.com',
    password: hashedPassword,
    role: 'admin',
    name: 'Admin User'
  });
  console.log('Fresh admin user created: adminglassfacade@gmail.com / admin123');
  process.exit(0);
}

run().catch(console.error);
