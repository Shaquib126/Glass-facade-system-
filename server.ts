import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Datastore from 'nedb-promises';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database setup
const db = {
  users: Datastore.create({ filename: path.join(__dirname, 'data', 'users.db'), autoload: true }),
  attendance: Datastore.create({ filename: path.join(__dirname, 'data', 'attendance.db'), autoload: true })
};

// Seed admin user
async function seedAdmin() {
  const adminExists = await db.users.findOne({ role: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.users.insert({
      email: 'admin@glassfacade.com',
      password: hashedPassword,
      role: 'admin',
      name: 'Admin User',
      createdAt: new Date()
    });
    console.log('Admin user seeded: admin@glassfacade.com / admin123');
  }
}
seedAdmin();

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
app.post('/api/auth/login', async (req: any, res: any) => {
  try {
    const { email, password } = req.body;
    const user: any = await db.users.findOne({ email });
    
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
        hasFaceDescriptor: !!user.faceDescriptor
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/register', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const { email, password, name, role, faceDescriptor } = req.body;
    
    const existingUser = await db.users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser: any = await db.users.insert({
      email,
      password: hashedPassword,
      name,
      role: role || 'user',
      faceDescriptor: faceDescriptor || null,
      createdAt: new Date()
    });

    res.status(201).json({ message: 'User created successfully', userId: newUser._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    const users = await db.users.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req: any, res: any) => {
  try {
    await db.users.remove({ _id: req.params.id }, {});
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/me/descriptor', authenticateToken, async (req: any, res: any) => {
  try {
    const user: any = await db.users.findOne({ _id: req.user.id });
    if (!user || !user.faceDescriptor) {
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
    await db.users.update({ _id: req.user.id }, { $set: { faceDescriptor } });
    res.json({ message: 'Face descriptor updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/attendance', authenticateToken, async (req: any, res: any) => {
  try {
    const { status, location, timestamp, offline } = req.body;
    
    const record = await db.attendance.insert({
      userId: req.user.id,
      userEmail: req.user.email,
      status, // 'clock-in' or 'clock-out'
      location, // { lat, lng }
      timestamp: timestamp || new Date().toISOString(),
      offline: !!offline,
      createdAt: new Date()
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
      const newRecord = await db.attendance.insert({
        userId: req.user.id,
        userEmail: req.user.email,
        status: record.status,
        location: record.location,
        timestamp: record.timestamp,
        offline: true,
        createdAt: new Date()
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
    const records = await db.attendance.find({}).sort({ timestamp: -1 }).limit(100);
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/attendance/me', authenticateToken, async (req: any, res: any) => {
  try {
    const records = await db.attendance.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(20);
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
