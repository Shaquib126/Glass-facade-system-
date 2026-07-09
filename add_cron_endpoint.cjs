const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const endpointCode = `
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
`;

if (!code.includes('/api/cron/auto-clockout')) {
  code = code.replace("cron.schedule('0 18 * * *', async () => {", endpointCode + "\ncron.schedule('0 18 * * *', async () => {");
  fs.writeFileSync('server.ts', code);
  console.log("Endpoint added.");
} else {
  console.log("Endpoint already exists.");
}
