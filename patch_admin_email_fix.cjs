const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
`async function notifyAdminsOfAttendance(record, user) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    const admins = await User.find({ role: 'admin' });
    if (admins.length === 0) return;

    const adminEmails = admins.map((a) => a.email).join(',');
    const action = record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out';
    
    await getTransporter().sendMail({
      from: '"Attendance System" <' + process.env.SMTP_USER + '>',
      to: adminEmails,
      subject: 'Attendance Alert: ' + user.name + ' ' + action,
      text: 'Hello Admin,\\n\\nWorker ' + user.name + ' (' + user.email + ') just ' + action.toLowerCase() + '.\\n\\nTime: ' + new Date(record.timestamp).toLocaleString() + '\\nLocation: ' + (record.location ? record.location.lat + ', ' + record.location.lng : 'N/A') + '\\n\\nPlease check the dashboard for more details.\\n\\nThank you!'
    });
    console.log('[Email] Attendance alert sent to admins for ' + user.name);
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
}`,
`async function notifyAdminsOfAttendance(record, userPayload) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    const worker = await User.findById(userPayload.id);
    const workerName = worker ? worker.name : userPayload.email;
    const workerEmail = userPayload.email;

    const admins = await User.find({ role: 'admin' });
    if (admins.length === 0) return;

    const adminEmails = admins.map((a) => a.email).join(',');
    const action = record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out';
    
    await getTransporter().sendMail({
      from: '"Attendance System" <' + process.env.SMTP_USER + '>',
      to: adminEmails,
      subject: 'Attendance Alert: ' + workerName + ' ' + action,
      text: 'Hello Admin,\\n\\nWorker ' + workerName + ' (' + workerEmail + ') just ' + action.toLowerCase() + '.\\n\\nTime: ' + new Date(record.timestamp).toLocaleString() + '\\nLocation: ' + (record.location ? record.location.lat + ', ' + record.location.lng : 'N/A') + '\\n\\nPlease check the dashboard for more details.\\n\\nThank you!'
    });
    console.log('[Email] Attendance alert sent to admins for ' + workerName);
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
}`
);

fs.writeFileSync('server.ts', code);
