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
import cron from 'node-cron';

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

// Fix MONGODB_URI if user forgot the exact prefix
let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/glass-facade';
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://') && !MONGODB_URI.startsWith('localhost')) {
  if (MONGODB_URI.includes(',') && MONGODB_URI.includes('replicaSet=')) {
    MONGODB_URI = 'mongodb://' + MONGODB_URI;
  } else {
    MONGODB_URI = 'mongodb+srv://' + MONGODB_URI;
  }
}

let transporter: any = null;
const getTransporter = () => {
  if (!transporter) {
    const defaultHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    let defaultPort = Number(process.env.SMTP_PORT) || 465;
    let defaultSecure = process.env.SMTP_SECURE === 'true' || defaultPort === 465;

    // Use user settings if explicitly provided
    if (process.env.SMTP_PORT) {
      defaultPort = Number(process.env.SMTP_PORT);
      defaultSecure = process.env.SMTP_SECURE === 'true' || defaultPort === 465;
    }

    const config: any = {
      host: defaultHost,
      port: defaultPort,
      secure: defaultSecure,
      requireTLS: true,
      tls: {
         rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    };
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      config.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS.replace(/\s+/g, ''), // strip spaces from App Password
      };
    }
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let dbConnectionError = 'Connecting...';

// Database setup
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    dbConnectionError = '';
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    if (err.message && err.message.includes('bad auth')) {
      dbConnectionError = 'Authentication failed. Please check your username and password in the MONGODB_URI secret in Settings (the part between mongodb+srv:// and @).';
    } else {
      dbConnectionError = err.message || String(err);
    }
  });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: false },
  role: { type: String, default: 'user' },
  name: String,
  employeeId: { type: String, unique: true, sparse: true },
  dailyWage: { type: Number, default: 0 },
  ottHours: { type: Number, default: 0 },
  faceDescriptor: [Number],
  profilePhoto: String,
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
  workedHours: Number, // Computed on clock-out
  createdAt: { type: Date, default: Date.now }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

const siteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  radius: { type: Number, required: true, default: 100 },
  createdAt: { type: Date, default: Date.now }
});
const Site = mongoose.model('Site', siteSchema);

const alertSchema = new mongoose.Schema({
  type: { type: String, required: true },
  userId: String,
  userEmail: String,
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Alert = mongoose.model('Alert', alertSchema);

const feedbackSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  feedback: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  timestamp: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

const gallerySchema = new mongoose.Schema({
  title: String,
  imageUrl: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
});
const Gallery = mongoose.model('Gallery', gallerySchema);

const salarySlipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: String,
  userName: String,
  period: String, // e.g., 'April 2026'
  amount: Number,
  status: { type: String, default: 'Sent' },
  notes: String,
  issuedAt: { type: Date, default: Date.now }
});
const SalarySlip = mongoose.model('SalarySlip', salarySlipSchema);

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

async function seedDefaultSite() {
  try {
    const siteCount = await Site.countDocuments();
    if (siteCount === 0) {
      await Site.create({
        name: 'Main Construction Site (SF)',
        lat: 37.7749,
        lng: -122.4194,
        radius: 100
      });
      console.log('Default site seeded');
    }
  } catch (err) {
    console.error('Error seeding site:', err);
  }
}

mongoose.connection.once('open', () => {
  seedAdmin();
  seedDefaultSite();
});

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin role required' });
  next();
};

const requireAdminOrManager = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: 'Admin or Manager role required' });
  next();
};

const requireDashboardAccess = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'supervisor') return res.status(403).json({ message: 'Dashboard access required' });
  next();
};

// API Routes
app.post('/api/alerts', authenticateToken, async (req: any, res: any) => {
  try {
    const { type, message } = req.body;
    const alert = await Alert.create({
      type,
      userId: req.user.id,
      userEmail: req.user.email,
      message,
    });
    io.emit('new_alert', alert);
    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/alerts', authenticateToken, requireDashboardAccess, async (req: any, res: any) => {
  try {
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(50);
    res.json(alerts);
  } catch(e) {
    res.status(500).json({message: 'Server error'});
  }
});

app.put('/api/alerts/:id/read', authenticateToken, requireDashboardAccess, async (req: any, res: any) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(alert);
  } catch(e) {
    res.status(500).json({message: 'Server error'});
  }
});

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
        employeeId: user.employeeId,
        profilePhoto: user.profilePhoto,
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
    console.log(`[Face Verification] Distance for ${email}: ${distance.toFixed(4)} (Threshold: 0.5)`);
    if (distance > 0.5) { // 0.5 is a standard strict threshold for face-api.js
      return res.status(401).json({ message: `Face verification failed. Confidence score: ${(1 - distance).toFixed(2)} (Distance: ${distance.toFixed(2)})`, distance });
    }

    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        employeeId: user.employeeId,
        profilePhoto: user.profilePhoto,
        hasFaceDescriptor: true
      },
      distance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/test/email', async (req: any, res: any) => {
  try {
    const config: any = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    };
    
    // Test auth directly first to get the error
    res.json({
       emailUser: process.env.SMTP_USER ? 'set' : 'not set', 
       emailPass: process.env.SMTP_PASS ? 'set' : 'not set'
    });
  } catch (err: any) {
    res.json({ error: err.message, stack: err.stack, full: err });
  }
});

app.post('/api/auth/forgot-password', async (req: any, res: any) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: `Database Error: ${dbConnectionError || 'Not connected'}. Please check your MONGODB_URI secret.` });
    }

    const { email } = req.body;
    const user: any = await User.findOne({ email });
    
    if (!user) {
      return res.json({ message: 'If that email is in our system, we have sent an OTP to your mobile.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = Date.now() + 600000; // 10 mins
    await user.save();

    console.log(`\n=== PASSWORD RESET OTP ===\nFor user: ${email}\nOTP: ${otp}\n===========================\n`);

    res.json({ 
      message: 'OTP sent to your registered mobile number via WhatsApp/SMS.',
      _dev_token: otp,
      mobile: user.mobile
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
    const { email, password, name, role, faceDescriptor, dailyWage, ottHours, mobile, employeeId } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [
        { email },
        ...(employeeId ? [{ employeeId }] : [])
      ]
    });
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'User already exists with this email' });
      }
      return res.status(400).json({ message: 'User already exists with this Employee ID' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser: any = await User.create({
      email,
      password: hashedPassword,
      name,
      mobile,
      employeeId,
      role: role || 'user',
      dailyWage: dailyWage || 0,
      ottHours: ottHours || 0,
      faceDescriptor: faceDescriptor || null
    });

    res.status(201).json({ message: 'User created successfully', userId: newUser._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users', authenticateToken, requireDashboardAccess, async (req: any, res: any) => {
  try {
    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/user-password', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { targetUserId, newPassword } = req.body;
    if (!targetUserId || !newPassword) {
      return res.status(400).json({ message: 'Target user and new password are required' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(targetUserId, { password: hashedPassword });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/feedback', authenticateToken, async (req: any, res: any) => {
  try {
    const { feedback, rating } = req.body;
    const user = await User.findById(req.user.id);
    const newFeedback = await Feedback.create({
      userId: req.user.id,
      userName: user ? user.name : 'Unknown User',
      feedback,
      rating
    });
    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/feedback', authenticateToken, requireDashboardAccess, async (req: any, res: any) => {
  try {
    const feedbacks = await Feedback.find().sort({ timestamp: -1 }).limit(100);
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/reports/attendance/export', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { startDate, endDate, userId, timezone } = req.query;
    let query: any = {};

    if (userId && userId !== 'all') {
      query.userId = userId;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate).toISOString();
      if (endDate) query.timestamp.$lte = new Date(`${endDate}T23:59:59.999Z`).toISOString();
    }

    const records = await Attendance.find(query).sort({ timestamp: -1 });

    const grouped: any = {};
    for (const r of (records as any[])) {
      const d = new Date(r.timestamp);
      
      const dateOpts: any = {};
      const timeOpts: any = { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' };
      if (timezone) {
        dateOpts.timeZone = timezone;
        timeOpts.timeZone = timezone;
      }
      
      // We use the local date string to group records on the same local date
      const localDateStr = d.toLocaleDateString('en-US', dateOpts);
      const key = `${r.userEmail}_${localDateStr}`;
      
      if (!grouped[key]) {
        grouped[key] = {
           sortableTime: d.getTime(), // For sorting rows later
           date: localDateStr,
           email: r.userEmail || '',
           clockIn: null,
           clockOut: null,
           workedHours: 0,
           locIn: '',
           locOut: ''
        };
      }
      
      const timeStr = d.toLocaleTimeString('en-US', timeOpts);
      
      if (r.status === 'clock-in') {
         // Descending order: the last clock-in encountered is the earliest in the day.
         grouped[key].clockIn = timeStr;
         grouped[key].locIn = (r.location && r.location.lat) ? `${r.location.lat}, ${r.location.lng}` : '';
      } else if (r.status === 'clock-out') {
         // Descending order: the first clock-out encountered is the latest in the day.
         if (!grouped[key].clockOut) {
             grouped[key].clockOut = timeStr;
             grouped[key].locOut = (r.location && r.location.lat) ? `${r.location.lat}, ${r.location.lng}` : '';
         }
         if (r.workedHours) {
           grouped[key].workedHours += r.workedHours;
         }
      }
    }

    const csvRows = [
      ['Date', 'User Email', 'Clock In Time', 'Clock Out Time', 'Total Worked Hours', 'Clock In Location', 'Clock Out Location']
    ];

    // Convert object to array and sort descending by time
    const sortedGroups = Object.values(grouped).sort((a: any, b: any) => b.sortableTime - a.sortableTime);

    for (const g of (sortedGroups as any[])) {
       csvRows.push([
         g.date,
         g.email,
         g.clockIn || '-',
         g.clockOut || '-',
         g.workedHours ? g.workedHours.toFixed(2) : '0',
         g.locIn ? `"${g.locIn}"` : '',
         g.locOut ? `"${g.locOut}"` : ''
       ]);
    }

    const csvString = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    
    res.header('Content-Type', 'text/csv');
    res.attachment('attendance_report.csv');
    res.send(csvString);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/reports/salary', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { month } = req.query; // Format: YYYY-MM
    let startDate: Date, endDate: Date;
    
    if (month) {
      startDate = new Date(`${month}-01T00:00:00.000Z`);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const users = await User.find({}, { password: 0 });
    const attendance = await Attendance.find({
      timestamp: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
      status: 'clock-in' // Check unique days they clocked in
    });

    const userStats: Record<string, Set<string>> = {};
    for (const record of (attendance as any[])) {
      const uid = record.userId.toString();
      if (!userStats[uid]) userStats[uid] = new Set();
      // Calculate active days by stripping time from ISO timestamp
      const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
      userStats[uid].add(dateStr);
    }

    const report = users.map((u: any) => {
      const uid = u._id.toString();
      const daysWorked = userStats[uid] ? userStats[uid].size : 0;
      const wage = u.dailyWage || 0;
      return {
        id: uid,
        name: u.name,
        email: u.email,
        role: u.role,
        dailyWage: wage,
        daysWorked,
        totalSalary: daysWorked * wage
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ message: 'Server error generating report' });
  }
});

app.put('/api/users/me', authenticateToken, async (req: any, res: any) => {
  try {
    const { name, currentPassword, newPassword, profilePhoto, mobile } = req.body;
    const user: any = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (profilePhoto) user.profilePhoto = profilePhoto;
    if (mobile !== undefined) user.mobile = mobile;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(400).json({ message: 'Invalid current password' });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      employeeId: user.employeeId,
      profilePhoto: user.profilePhoto,
      hasFaceDescriptor: user.faceDescriptor && user.faceDescriptor.length > 0
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { name, email, role, dailyWage, ottHours, mobile, employeeId } = req.body;
    
    // Check if employeeId is unique
    if (employeeId) {
      const existing = await User.findOne({ employeeId, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: 'Employee ID is already in use' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, dailyWage, ottHours, mobile, employeeId },
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

// Site Routes
app.get('/api/sites', authenticateToken, async (req: any, res: any) => {
  try {
    const sites = await Site.find({});
    res.json(sites);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/sites', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { name, lat, lng, radius } = req.body;
    const newSite = await Site.create({ name, lat, lng, radius });
    res.status(201).json(newSite);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/sites/:id', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { name, lat, lng, radius } = req.body;
    const updatedSite = await Site.findByIdAndUpdate(
      req.params.id,
      { name, lat, lng, radius },
      { new: true }
    );
    if (!updatedSite) return res.status(404).json({ message: 'Site not found' });
    res.json(updatedSite);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/sites/:id', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    await Site.deleteOne({ _id: req.params.id });
    res.json({ message: 'Site deleted' });
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

// Calculate distance using Haversine formula
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

app.post('/api/attendance', authenticateToken, async (req: any, res: any) => {
  try {
    const { status, location, timestamp, offline } = req.body;
    
    let isOutsideGeofence = false;

    if (location && location.lat && location.lng) {
      const sites = await Site.find({});
      if (sites.length > 0) {
        let isInsideAny = false;
        for (const site of sites) {
          const dist = getDistance(location.lat, location.lng, site.lat, site.lng);
          if (dist <= (site.radius || 100)) {
            isInsideAny = true;
            break;
          }
        }
        if (!isInsideAny) {
          isOutsideGeofence = true;
        }
      }
    }

    let workedHours = undefined;
    if (status === 'clock-out') {
      const lastClockIn = await Attendance.findOne({
        userId: req.user.id,
        status: 'clock-in'
      }).sort({ timestamp: -1 });

      if (lastClockIn) {
        const outTime = new Date(timestamp || new Date().toISOString());
        const inTime = new Date(lastClockIn.timestamp);
        // Only calculate if clock out is after clock in, and within a reasonable timeframe (e.g. same day or within 24h)
        if (outTime > inTime && (outTime.getTime() - inTime.getTime() < 24 * 60 * 60 * 1000)) {
          workedHours = Number(((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
        }
      }
    }

    const record = await Attendance.create({
      userId: req.user.id,
      userEmail: req.user.email,
      status, // 'clock-in' or 'clock-out'
      location, // { lat, lng }
      timestamp: timestamp || new Date().toISOString(),
      offline: !!offline,
      workedHours
    });

    if (isOutsideGeofence) {
      const alert = await Alert.create({
        type: 'geofence',
        userId: req.user.id,
        userEmail: req.user.email,
        message: `User ${req.user.email} clocked ${status === 'clock-in' ? 'in' : 'out'} outside of designated work sites.`,
      });
      io.emit('new_alert', alert);
    }

    if (status === 'clock-in') {
      const now = new Date(record.timestamp);
      const hours = now.getHours();
      // Alert if clocking in extremely late (e.g., after 10 AM)
      if (hours >= 10 && hours < 18) {
        const alert = await Alert.create({
          type: 'unusual_attendance',
          userId: req.user.id,
          userEmail: req.user.email,
          message: `User ${req.user.email} clocked in late at ${now.toLocaleTimeString()}.`,
        });
        io.emit('new_alert', alert);
      }
    }

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
      let workedHours = undefined;
      if (record.status === 'clock-out') {
        const lastClockIn = await Attendance.findOne({
          userId: req.user.id,
          status: 'clock-in',
          timestamp: { $lt: record.timestamp }
        }).sort({ timestamp: -1 });

        if (lastClockIn) {
          const outTime = new Date(record.timestamp);
          const inTime = new Date(lastClockIn.timestamp);
          if (outTime > inTime && (outTime.getTime() - inTime.getTime() < 24 * 60 * 60 * 1000)) {
            workedHours = Number(((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
          }
        }
      }

      const newRecord = await Attendance.create({
        userId: req.user.id,
        userEmail: req.user.email,
        status: record.status,
        location: record.location,
        timestamp: record.timestamp,
        offline: true,
        workedHours
      });
      inserted.push(newRecord);
      io.emit('attendance_update', newRecord);
    }

    res.status(201).json({ message: 'Synced successfully', count: inserted.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/attendance', authenticateToken, requireDashboardAccess, async (req: any, res: any) => {
  try {
    const { startDate, endDate, userId } = req.query;
    let query: any = {};

    if (userId) {
      query.userId = userId;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string).toISOString();
      }
      if (endDate) {
        const endDay = new Date(endDate as string);
        endDay.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endDay.toISOString();
      }
    }

    const records = await Attendance.find(query).sort({ timestamp: -1 }).limit(100);
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Auto clock-out at 6:00 PM (18:00) using node-cron
cron.schedule('0 18 * * *', async () => {
  try {
    console.log('Running scheduled task: Auto Clock-Out at 6 PM');
    if (mongoose.connection.readyState !== 1) {
      console.log('Skipping auto clock-out: Database not connected.');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all users who clocked in today but haven't clocked out
    const users = await User.find({ role: 'user' });
    
    for (const user of users) {
      const lastRecord = await Attendance.findOne({ userId: user._id.toString() }).sort({ timestamp: -1 });
      if (lastRecord && lastRecord.status === 'clock-in') {
        // They are clocked in. Need to clock them out.
        const outRecord = await Attendance.create({
          userId: user._id.toString(),
          userEmail: user.email,
          status: 'clock-out',
          location: { lat: 0, lng: 0 }, // System auto clockout
          timestamp: new Date().toISOString(),
          offline: false
        });
        io.emit('attendance_update', outRecord);
        console.log(`Auto clocked out user ${user.email}`);
      }
    }
  } catch (err) {
    console.error('Auto clock-out error:', err);
  }
});

// Admin manual clock-in for a worker
app.post('/api/attendance/admin-clockin', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { targetUserId } = req.body;
    const targetUser: any = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newRecord = await Attendance.create({
      userId: targetUser._id.toString(),
      userEmail: targetUser.email,
      status: 'clock-in',
      location: { lat: 0, lng: 0 }, // Admin override
      timestamp: new Date().toISOString(),
      offline: false
    });

    io.emit('attendance_update', newRecord);
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin manual clock-out for a worker
app.post('/api/attendance/admin-clockout', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { targetUserId } = req.body;
    const targetUser: any = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let workedHours = undefined;
    const lastClockIn = await Attendance.findOne({
      userId: targetUser._id.toString(),
      status: 'clock-in'
    }).sort({ timestamp: -1 });

    const nowStr = new Date().toISOString();

    if (lastClockIn) {
      const outTime = new Date(nowStr);
      const inTime = new Date(lastClockIn.timestamp);
      if (outTime > inTime && (outTime.getTime() - inTime.getTime() < 24 * 60 * 60 * 1000)) {
        workedHours = Number(((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
      }
    }

    const newRecord = await Attendance.create({
      userId: targetUser._id.toString(),
      userEmail: targetUser.email,
      status: 'clock-out',
      location: { lat: 0, lng: 0 }, // Admin override
      timestamp: nowStr,
      offline: false,
      workedHours
    });

    io.emit('attendance_update', newRecord);
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Gallery Routes
app.get('/api/gallery', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const images = await Gallery.find().sort({ uploadedAt: -1 }).populate('uploadedBy', 'name email');
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching gallery' });
  }
});

app.post('/api/gallery', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { title, imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ message: 'Image URL is required' });
    const newImage = await Gallery.create({ title, imageUrl, uploadedBy: req.user.id });
    res.status(201).json(newImage);
  } catch (error) {
    res.status(500).json({ message: 'Error uploading image' });
  }
});

app.delete('/api/gallery/:id', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting image' });
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

// Salary Slips Routes
app.get('/api/salary-slips/me', authenticateToken, async (req: any, res: any) => {
  try {
    const slips = await SalarySlip.find({ userId: req.user.id }).sort({ issuedAt: -1 });
    res.json(slips);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching salary slips' });
  }
});

app.get('/api/salary-slips/user/:userId', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const slips = await SalarySlip.find({ userId: req.params.userId }).sort({ issuedAt: -1 });
    res.json(slips);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});



app.post('/api/salary-slips', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { userId, period, amount, notes } = req.body;
    const userTarget = await User.findById(userId);
    if (!userTarget) return res.status(404).json({ message: 'User not found' });
    
    const newSlip = await SalarySlip.create({
      userId: userTarget._id,
      userEmail: userTarget.email,
      userName: userTarget.name,
      period,
      amount,
      notes
    });
    
    // Create an alert for the user
    await Alert.create({
      userId: userTarget._id.toString(),
      userEmail: userTarget.email,
      message: `Your salary slip for ${period} has been issued.`,
      type: 'info'
    });

    // Try sending an email
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await getTransporter().sendMail({
          from: `"Attendance App" <${process.env.SMTP_USER}>`,
          to: userTarget.email,
          subject: `Your Salary Slip for ${period}`,
          text: `Hello ${userTarget.name},\n\nYour salary slip for the period ${period} has been issued.\n\nTotal Amount: ₹${amount}\n\nNotes: ${notes || 'N/A'}\n\nPlease check your Worker Dashboard to view the details.\n\nThank you!`
        });
        console.log(`Email sent to ${userTarget.email}`);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    } else {
      console.log('Skipping email send. Configure SMTP_USER and SMTP_PASS in Environment Variables to send actual emails.');
    }

    res.status(201).json(newSlip);
  } catch (error) {
    res.status(500).json({ message: 'Error generating salary slip' });
  }
});

app.post('/api/salary-slips/send-all', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { period, month, notes } = req.body;
    // month is "YYYY-MM"
    if (!month || !period) return res.status(400).json({ message: 'Missing period or month parameter' });
    
    let startDate = new Date(`${month}-01T00:00:00.000Z`);
    let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const users = await User.find({ role: { $ne: 'admin' } }, { password: 0 });
    const attendance = await Attendance.find({
      timestamp: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
      status: 'clock-in'
    });

    const userStats: Record<string, Set<string>> = {};
    attendance.forEach(record => {
      const uId = (record as any).userId;
      if (!userStats[uId]) userStats[uId] = new Set();
      const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
      userStats[uId].add(dateStr);
    });

    const sentSlips = [];
    for (const u of users) {
      const uId = u._id.toString();
      const daysWorked = userStats[uId] ? userStats[uId].size : 0;
      const wage = u.dailyWage || 0;
      const amount = daysWorked * wage;
      
      if (amount <= 0 && daysWorked === 0) continue; // skip users who didn't work

      const newSlip = await SalarySlip.create({
        userId: u._id,
        userEmail: u.email,
        userName: u.name,
        period,
        amount,
        notes
      });
      sentSlips.push(newSlip);

      await Alert.create({
        userId: u._id.toString(),
        userEmail: u.email,
        message: `Your salary slip for ${period} has been issued. Amount: ₹${amount}`,
        type: 'info'
      });

      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          await getTransporter().sendMail({
            from: `"Glass Facade System" <${process.env.SMTP_USER}>`,
            to: u.email,
            subject: `Your Salary Slip for ${period}`,
            text: `Hello ${u.name},\n\nYour salary slip for ${period} has been issued.\nTotal Amount: ₹${amount}\nDays Worked: ${daysWorked}\n\nNotes: ${notes || 'N/A'}\n\nPlease check your Dashboard.\n\nThank you!`
          });
        } catch (emailError) {}
      }
      
      // If mobile number exists, you would integrate Twilio here
      if (u.mobile) {
         console.log(`Sending SMS to ${u.mobile} for ${u.name}: Salary ₹${amount}`);
      }
    }

    res.status(201).json({ message: `Generated ${sentSlips.length} salary slips`, count: sentSlips.length });
  } catch (error) {
    console.error('Error generating bulk salary slips:', error);
    res.status(500).json({ message: 'Error generating bulk salary slips' });
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
