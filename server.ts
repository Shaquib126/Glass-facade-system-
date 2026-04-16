import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-glass-facade';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/glass-facade';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let dbConnectionError = 'Connecting...';

// Database setup
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    dbConnectionError = '';
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    dbConnectionError = err.message || String(err);
  });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  name: String,
  faceDescriptor: [Number],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const attendanceSchema = new mongoose.Schema({
  userId: String,
  userEmail: String,
  status: String,
  location: {
    lat: Number,
    lng: Number
  },
  timestamp: String,
  offline: Boolean,
  createdAt: { type: Date, default: Date.now }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

// Seed admin user
async function seedAdmin() {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        email: 'admin@glassfacade.com',
        password: hashedPassword,
        role: 'admin',
        name: 'Admin User'
      });
      console.log('Admin user seeded: admin@glassfacade.com / admin123');
    }
  } catch (err) {
    console.error('Error seeding admin:', err);
  }
}
mongoose.connection.once('open', () => {
  seedAdmin();
});

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  next();
};

// API Routes
function euclideanDistance(desc1: number[], desc2: number[]) {
  if (desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return Math.sqrt(sum);
}

app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: `Database Error: ${dbConnectionError || 'Not connected'}. Please check your MONGODB_URI secret.` });
    }

    const { email, password } = req.body;
    const user: any = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        hasFaceDescriptor: user.faceDescriptor && user.faceDescriptor.length > 0
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

app.post('/api/auth/login-face', async (req: any, res: any) => {
  try {
    const { email, faceDescriptor } = req.body;
    if (!email || !faceDescriptor) {
      return res.status(400).json({ message: 'Email and face scan required' });
    }

    const user: any = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (!user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(400).json({ message: 'No face profile set up for this user' });
    }

    const distance = euclideanDistance(faceDescriptor, user.faceDescriptor);
    if (distance > 0.5) { // 0.5 is a standard strict threshold for face-api.js
      return res.status(401).json({ message: 'Face verification failed' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        hasFaceDescriptor: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/forgot-password', async (req: any, res: any) => {
  try {
    const { email } = req.body;
    const user: any = await User.findOne({ email });
    
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return res.json({ message: 'If that email is in our system, we have sent a password reset link.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

            // Yahan se aapka naya Nodemailer code shuru hoga (Line 213 ki jagah par)
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Live website ka link
        const liveResetUrl = `https://em.onrender.com/reset-password/${token}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Glass Facade - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h3>Password Reset</h3>
                    <p>Aapne apna password reset karne ki request ki hai. Naya password set karne ke liye neeche diye gaye link par click karein:</p>
                    <br>
                    <a href="${liveResetUrl}" style="background-color: #00e5ff; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    <br><br>
                    <p style="color: #555;">Agar aapne yeh request nahi ki hai, toh is email ko ignore karein.</p>
                </div>
            `
        };

        // Email send karna
        await transporter.sendMail(mailOptions);

        // Frontend ko success message bhejna (yeh res.json line 220/221 ki jagah le lega)
        res.json({ 
            message: 'If that email is in our system, we have sent a password reset link.' 
        });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req: any, res: any) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user: any = await User.findOne({ 
      resetPasswordToken: token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Your password has been successfully reset. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/register', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { email, password, name, role, faceDescriptor } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser: any = await User.create({
      email,
      password: hashedPassword,
      name,
      role: role || 'user',
      faceDescriptor: faceDescriptor || null
    });

    res.status(201).json({ message: 'User created successfully', userId: newUser._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { name, email, role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role },
      { new: true, select: '-password' }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/me/descriptor', authenticateToken, async (req: any, res: any) => {
  try {
    const user: any = await User.findOne({ _id: req.user.id });
    if (!user || !user.faceDescriptor || user.faceDescriptor.length === 0) {
      return res.status(404).json({ message: 'Face descriptor not found' });
    }
    res.json({ faceDescriptor: user.faceDescriptor });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/users/me/descriptor', authenticateToken, async (req: any, res: any) => {
  try {
    const { faceDescriptor } = req.body;
    await User.updateOne({ _id: req.user.id }, { $set: { faceDescriptor } });
    res.json({ message: 'Face descriptor updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/attendance', authenticateToken, async (req: any, res: any) => {
  try {
    const { status, location, timestamp, offline } = req.body;
    
    const record = await Attendance.create({
      userId: req.user.id,
      userEmail: req.user.email,
      status, // 'clock-in' or 'clock-out'
      location, // { lat, lng }
      timestamp: timestamp || new Date().toISOString(),
      offline: !!offline
    });

    // Broadcast to admins
    io.emit('attendance_update', record);

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/attendance/sync', authenticateToken, async (req: any, res: any) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ message: 'Invalid format' });

    const inserted = [];
    for (const record of records) {
      const newRecord = await Attendance.create({
        userId: req.user.id,
        userEmail: req.user.email,
        status: record.status,
        location: record.location,
        timestamp: record.timestamp,
        offline: true
      });
      inserted.push(newRecord);
      io.emit('attendance_update', newRecord);
    }

    res.status(201).json({ message: 'Synced successfully', count: inserted.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/attendance', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const records = await Attendance.find({}).sort({ timestamp: -1 }).limit(100);
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/attendance/me', authenticateToken, async (req: any, res: any) => {
  try {
    const records = await Attendance.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(20);
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
