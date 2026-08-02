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
import { Resend } from 'resend';
import { GoogleGenAI } from '@google/genai';

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
let resendClient: any = null;

const getTransporter = () => {
  if (process.env.RESEND_API_KEY) {
    if (!resendClient) {
      console.log('[SMTP init] Using Resend API');
      resendClient = new Resend(process.env.RESEND_API_KEY);
    }
    return {
      sendMail: async (options: any) => {
        // Resend free tier requires verifiable domains or testing from onboarding@resend.dev
        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'onboarding@resend.dev';
        console.log(`[Email] Sending via Resend API from ${fromAddress} to ${options.to}`);
        
        const { data, error } = await resendClient.emails.send({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        if (error) {
          console.error('[Resend Error]:', error);
          throw new Error(error.message);
        }
        
        console.log('[Resend Success]:', data);
        return data;
      }
    };
  }

  if (!transporter) {
    const defaultHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const isGmail = defaultHost.includes('gmail.com');
    let defaultPort = Number(process.env.SMTP_PORT) || (isGmail ? 465 : 587);
    let defaultSecure = process.env.SMTP_SECURE === 'true' || defaultPort === 465;

    // Use user settings if explicitly provided
    if (process.env.SMTP_PORT) {
      defaultPort = Number(process.env.SMTP_PORT);
      defaultSecure = (process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1') || defaultPort === 465;
    }

    console.log(`[SMTP init] Host: ${defaultHost}, Port: ${defaultPort}, Secure: ${defaultSecure}`);

    let config: any = {};
    
    if (isGmail) {
      console.log('[SMTP init] Using Gmail service configuration');
      config = {
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS?.replace(/\s+/g, ''), // strip spaces from App Password
        }
      };
    } else {
      config = {
        host: defaultHost,
        port: defaultPort,
        secure: defaultSecure,
        requireTLS: true,
        tls: {
           rejectUnauthorized: false
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 20000
      };
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        config.auth = {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
        };
      }
    }
    
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
};

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let dbConnectionError = 'Connecting...';

app.get('/api/debug/admin', async (req: any, res: any) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    const allAdmins = await User.find({ role: 'admin' });
    res.json({
      admin: admin ? { email: admin.email, role: admin.role, id: admin._id } : null,
      allAdmins: allAdmins.map(a => ({ email: a.email, id: a._id })),
      dbConnection: mongoose.connection.readyState
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
  faceConfidence: Number, // Stored on check-in
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
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminEmail = 'adminglassfacade@gmail.com';
    
    try {
      await User.findOneAndUpdate(
        { role: 'admin' }, 
        { 
          $set: { 
            email: adminEmail,
            password: hashedPassword,
            name: 'Admin User'
          } 
        }, 
        { upsert: true, new: true }
      );
      console.log(`Admin user ensured: ${adminEmail} / admin123`);
    } catch (upsertErr: any) {
      // If there's a duplicate key collision (usually email), delete the conflicting users and recreate
      if (upsertErr.code === 11000) {
        console.log('Collision detected. Resetting conflicting admin accounts...');
        await User.deleteMany({ email: adminEmail });
        await User.deleteMany({ role: 'admin' });
        
        await User.create({
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
          name: 'Admin User'
        });
        console.log(`Admin user forcefully recreated: ${adminEmail} / admin123`);
      } else {
        throw upsertErr;
      }
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

    const resetLink = `${req.headers.origin}/reset-password?token=${otp}`;

    // Send Email via SMTP
    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = getTransporter();
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject: 'Glass Fab System - Password Reset',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Password Reset</h1>
              </div>
              <div style="padding: 24px;">
                <p>Hello ${user.name || 'User'},</p>
                <p>You requested a password reset. Your OTP is: <strong>${otp}</strong></p>
                <p>You can enter this OTP on the site, or click the button below directly:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            </div>
          `
        });
        console.log(`Password reset email sent to ${user.email} via SMTP.`);
      } else {
        console.log('Skipping SMTP: SMTP_USER or SMTP_PASS not set.');
      }
    } catch (mailErr) {
      console.error('Failed to send SMTP email:', mailErr);
    }

    // Optional: Send WhatsApp automatically via Twilio if configured
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER && user.mobile) {
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        let twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;
        if (!twilioFrom.startsWith('whatsapp:')) {
           twilioFrom = `whatsapp:${twilioFrom}`;
        }
        
        let toMobile = user.mobile.replace(/[^0-9]/g, '');
        if (!toMobile.startsWith('+')) {
            // Assuming the standard international code if they used raw numbers (best bet)
            // or just prepend '+' and hope it has country code
            toMobile = '+' + toMobile;
        }

        const b64Auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', `whatsapp:${toMobile}`);
        params.append('From', twilioFrom);
        params.append('Body', `Glass Fab System\n\nYour password reset OTP is *${otp}*.\n\nOr click here to reset:\n${resetLink}`);

        const result = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${b64Auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });

        if (result.ok) {
          console.log(`WhatsApp message sent to ${user.mobile} via Twilio backend.`);
        } else {
          console.error('Failed to send Twilio WhatsApp message:', await result.text());
        }
      }
    } catch (waErr) {
      console.error('Failed to send WhatsApp message via Twilio:', waErr);
    }

    res.json({ 
      message: 'OTP sent! An email has been dispatched via SMTP' + (user.mobile ? ' and WhatsApp.' : '.'),
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


app.get('/api/reports/attendance/export/me', authenticateToken, async (req: any, res: any) => {
  try {
    const { timezone } = req.query;
    let query: any = { userId: req.user.id };

    // Default to last 31 days
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 31);
    query.timestamp = { $gte: lastMonth.toISOString() };

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
      const dateKey = d.toLocaleDateString('en-US', dateOpts);
      const timeStr = d.toLocaleTimeString('en-US', timeOpts);

      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: dateKey,
          email: req.user.email,
          clockIn: null,
          clockOut: null,
          locIn: '',
          locOut: '',
          workedHours: 0
        };
      }
      if (r.status === 'clock-in') {
        if (!grouped[dateKey].clockIn || new Date(r.timestamp) < new Date(grouped[dateKey].clockInTime)) {
          grouped[dateKey].clockIn = timeStr;
          grouped[dateKey].clockInTime = r.timestamp;
          if (r.location && r.location.lat) {
             grouped[dateKey].locIn = `"${r.location.lat}, ${r.location.lng}"`;
          }
        }
      } else {
        if (!grouped[dateKey].clockOut || new Date(r.timestamp) > new Date(grouped[dateKey].clockOutTime)) {
          grouped[dateKey].clockOut = timeStr;
          grouped[dateKey].clockOutTime = r.timestamp;
          if (r.location && r.location.lat) {
             grouped[dateKey].locOut = `"${r.location.lat}, ${r.location.lng}"`;
          }
        }
      }
      if (r.workedHours) {
        grouped[dateKey].workedHours = Math.max(grouped[dateKey].workedHours || 0, r.workedHours);
      }
    }

    const csvRows = [
      ['Date', 'User Email', 'Clock In Time', 'Clock Out Time', 'Total Worked Hours', 'OT Hours (Over 8h)', 'Clock In Location', 'Clock Out Location']
    ];

    const sortedGroups = Object.values(grouped).sort((a: any, b: any) => {
       return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    for (const g of (sortedGroups as any[])) {
       let otHours = 0;
       if (g.workedHours && g.workedHours > 8) {
         otHours = g.workedHours - 8;
       }
       csvRows.push([
         g.date,
         g.email,
         g.clockIn || '-',
         g.clockOut || '-',
         g.workedHours ? g.workedHours.toFixed(2) : '0',
         otHours ? otHours.toFixed(2) : '0',
         g.locIn ? `"${g.locIn}"` : '',
         g.locOut ? `"${g.locOut}"` : ''
       ]);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="my_attendance.csv"');
    res.send(csvRows.map(e => e.join(',')).join('\n'));

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
    } else {
      // Default to last 31 days
      const lastMonth = new Date();
      lastMonth.setDate(lastMonth.getDate() - 31);
      query.timestamp = { $gte: lastMonth.toISOString() };
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
      ['Date', 'User Email', 'Clock In Time', 'Clock Out Time', 'Total Worked Hours', 'OT Hours (Over 8h)', 'Clock In Location', 'Clock Out Location']
    ];

    // Convert object to array and sort descending by time
    const sortedGroups = Object.values(grouped).sort((a: any, b: any) => b.sortableTime - a.sortableTime);

    for (const g of (sortedGroups as any[])) {
       let otHours = 0;
       if (g.workedHours && g.workedHours > 8) {
         otHours = g.workedHours - 8;
       }
       csvRows.push([
         g.date,
         g.email,
         g.clockIn || '-',
         g.clockOut || '-',
         g.workedHours ? g.workedHours.toFixed(2) : '0',
         otHours ? otHours.toFixed(2) : '0',
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

app.get('/api/reports/monthly-stats', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
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
      timestamp: { $gte: startDate.toISOString(), $lte: endDate.toISOString() }
    });

    const userStats: Record<string, { daysWorked: Set<string>; totalHours: number; totalOvertime: number }> = {};
    
    for (const record of (attendance as any[])) {
      const uid = record.userId.toString();
      if (!userStats[uid]) {
         userStats[uid] = { daysWorked: new Set(), totalHours: 0, totalOvertime: 0 };
      }
      
      if (record.status === 'clock-in') {
        const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
        userStats[uid].daysWorked.add(dateStr);
      } else if (record.status === 'clock-out' && record.workedHours) {
        userStats[uid].totalHours += record.workedHours;
        if (record.workedHours > 8) {
           userStats[uid].totalOvertime += (record.workedHours - 8);
        }
      }
    }

    const report = users.map((u: any) => {
      const uid = u._id.toString();
      const stats = userStats[uid] || { daysWorked: new Set(), totalHours: 0, totalOvertime: 0 };
      const daysWorked = stats.daysWorked.size;
      return {
        id: uid,
        name: u.name,
        email: u.email,
        role: u.role,
        employeeId: u.employeeId || 'N/A',
        daysWorked,
        totalHours: Number(stats.totalHours.toFixed(2)),
        totalOvertime: Number(stats.totalOvertime.toFixed(2))
      };
    });

    res.json(report);
  } catch (error) {
    console.error('Monthly stats report generation error:', error);
    res.status(500).json({ message: 'Server error generating stats report' });
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
    const { status, location, timestamp, offline, faceConfidence } = req.body;
    
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
      workedHours,
      faceConfidence
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
    
    // Alert if face confidence is unusually low (e.g., between 0.5 and 0.65)
    if (faceConfidence !== undefined && faceConfidence < 0.65 && faceConfidence > 0) {
      const alert = await Alert.create({
        type: 'face_confidence',
        userId: req.user.id,
        userEmail: req.user.email,
        message: `User ${req.user.email} checked in with a low face recognition confidence score of ${(faceConfidence * 100).toFixed(1)}%.`,
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
    } else {
      // Default to last 31 days
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      query.timestamp = { $gte: thirtyOneDaysAgo.toISOString() };
    }

    const records = await Attendance.find(query).sort({ timestamp: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/attendance/:id', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { status, timestamp, workedHours } = req.body;
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    record.status = status;
    if (timestamp) record.timestamp = timestamp;
    if (workedHours !== undefined) record.workedHours = workedHours;

    await record.save();
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: 'Error updating attendance record' });
  }
});

app.post('/api/attendance/manual', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    const { userId, status, timestamp, workedHours } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const record = await Attendance.create({
      userId,
      userEmail: user.email,
      status,
      timestamp: timestamp || new Date().toISOString(),
      offline: false,
      workedHours
    });

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: 'Error creating attendance record' });
  }
});

app.delete('/api/attendance/:id', authenticateToken, requireAdminOrManager, async (req: any, res: any) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting attendance record' });
  }
});

// Auto clock-out at 6:00 PM (18:00) using node-cron

// Endpoint for external cron jobs (e.g., cron-job.org) to trigger auto clock-out on platforms like Render where the server sleeps
app.get('/api/cron/auto-clockout', async (req: any, res: any) => {
  try {
    console.log('Running triggered task: Auto Clock-Out');
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database not connected.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let count = 0;
    const users = await User.find({ role: 'user' });
    
    for (const user of users) {
      const lastRecord = await Attendance.findOne({ userId: user._id.toString() }).sort({ timestamp: -1 });
      if (lastRecord && lastRecord.status === 'clock-in') {
        const inTime = new Date(lastRecord.timestamp).getTime();
        const outTime = new Date().getTime();
        let hours = (outTime - inTime) / (1000 * 60 * 60);
        if (hours < 0) hours = 0;
        
        await Attendance.create({
          userId: user._id.toString(),
          userEmail: user.email,
          status: 'clock-out',
          location: { lat: 0, lng: 0 },
          timestamp: new Date().toISOString(),
          workedHours: hours
        });
        count++;
      }
    }
    res.json({ message: 'Auto clock-out completed', autoClockedOutUsers: count });
  } catch (error) {
    console.error('Error in auto clock-out endpoint:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

cron.schedule('0 22 * * *', async () => {
  try {
    console.log('Running scheduled task: Auto Clock-Out at 10 PM');
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
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    const records = await Attendance.find({ 
      userId: req.user.id,
      timestamp: { $gte: thirtyOneDaysAgo.toISOString() }
    }).sort({ timestamp: -1 });
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

    if (userTarget.mobile && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
       try {
         const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
         
         let toMobile = userTarget.mobile.replace(/[^0-9]/g, '');
         if (!toMobile.startsWith('+')) {
             toMobile = '+' + toMobile;
         }

         let twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;
         if (!twilioFrom.startsWith('whatsapp:')) {
             twilioFrom = `whatsapp:${twilioFrom}`;
         }
         await twilioClient.messages.create({
           body: `Glass Facade System\n\nHello ${userTarget.name},\nYour salary slip for the period ${period} has been issued.\nTotal Amount: ₹${amount}\nNotes: ${notes || 'N/A'}\n\nPlease check your Worker Dashboard to view the details.\nThank you!`,
           from: twilioFrom,
           to: `whatsapp:${toMobile}`
         });
         console.log(`WhatsApp salary slip sent to ${userTarget.mobile} for ${userTarget.name}`);
       } catch (waErr) {
         console.error(`Failed to send WhatsApp message to ${userTarget.mobile}:`, waErr);
       }
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
      
      if (u.mobile && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
         try {
           const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
           
           let toMobile = u.mobile.replace(/[^0-9]/g, '');
           if (!toMobile.startsWith('+')) {
               toMobile = '+' + toMobile;
           }

           let twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;
           if (!twilioFrom.startsWith('whatsapp:')) {
               twilioFrom = `whatsapp:${twilioFrom}`;
           }
           await twilioClient.messages.create({
             body: `Glass Facade System\n\nHello ${u.name},\nYour salary slip for ${period} has been issued.\nTotal Amount: ₹${amount}\nDays Worked: ${daysWorked}\n\nPlease check your Dashboard.`,
             from: twilioFrom,
             to: `whatsapp:${toMobile}`
           });
           console.log(`WhatsApp salary slip sent to ${u.mobile} for ${u.name}`);
         } catch (waErr) {
           console.error(`Failed to send WhatsApp message to ${u.mobile}:`, waErr);
         }
      } else if (u.mobile) {
         console.log(`Would send SMS to ${u.mobile} for ${u.name}: Salary ₹${amount} (Twilio not configured)`);
      }
    }

    res.status(201).json({ message: `Generated ${sentSlips.length} salary slips`, count: sentSlips.length });
  } catch (error) {
    console.error('Error generating bulk salary slips:', error);
    res.status(500).json({ message: 'Error generating bulk salary slips' });
  }
});

// Chatbot API
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

app.post('/api/chat', authenticateToken, async (req: any, res: any) => {
  try {
    const { history, message } = req.body;
    const ai = getAIClient();
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      config: {
        systemInstruction: 'You are a helpful, professional AI assistant for the Glass Fab Attendance and Site Management system. Your role is to help admins and workers understand how to use the dashboard, manage site geofences, and review attendance logs. Keep your answers concise and highly relevant.',
      }
    });
    
    // Convert client history to server format if needed
    // Actually, we can just send the new message and let the client maintain history
    // Wait, the client chat object needs history...
    // With @google/genai, we can pass history in chats.create.
    const response = await chat.sendMessage({ message });
    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process chat' });
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
