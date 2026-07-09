const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const meRoute = `
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
             grouped[dateKey].locIn = \`"\${r.location.lat}, \${r.location.lng}"\`;
          }
        }
      } else {
        if (!grouped[dateKey].clockOut || new Date(r.timestamp) > new Date(grouped[dateKey].clockOutTime)) {
          grouped[dateKey].clockOut = timeStr;
          grouped[dateKey].clockOutTime = r.timestamp;
          if (r.location && r.location.lat) {
             grouped[dateKey].locOut = \`"\${r.location.lat}, \${r.location.lng}"\`;
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
         g.locIn ? \`"\${g.locIn}"\` : '',
         g.locOut ? \`"\${g.locOut}"\` : ''
       ]);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="my_attendance.csv"');
    res.send(csvRows.map(e => e.join(',')).join('\\n'));

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
`;

code = code.replace("app.get('/api/reports/attendance/export',", meRoute + "\napp.get('/api/reports/attendance/export',");
fs.writeFileSync('server.ts', code);
