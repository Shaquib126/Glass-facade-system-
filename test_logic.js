const timezone = 'Asia/Calcutta';
const userId = '123';
const userName = 'Shaquib';

const lastMonth = new Date();
lastMonth.setDate(lastMonth.getDate() - 31);
const actualStartDate = lastMonth;
const actualEndDate = new Date();

const records = [
  { timestamp: new Date().toISOString(), status: 'clock-in', location: {lat:0,lng:0} },
  { timestamp: new Date().toISOString(), status: 'clock-out', location: {lat:0,lng:0}, workedHours: 10.26 }
];

const grouped = {};
for (const r of records) {
  const d = new Date(r.timestamp);
  
  const dateOpts = {};
  const timeOpts = { hour12: false, hour: '2-digit', minute: '2-digit' };
  if (timezone) {
    dateOpts.timeZone = timezone;
    timeOpts.timeZone = timezone;
  }
  
  const localDateStr = d.toLocaleDateString('en-CA', dateOpts);
  const key = localDateStr;
  
  if (!grouped[key]) {
    grouped[key] = {
       dateStr: localDateStr,
       clockIn: null,
       clockOut: null,
       workedHours: 0,
       locIn: '',
       locOut: ''
    };
  }
  
  const timeStr = d.toLocaleTimeString('en-US', timeOpts);
  
  if (r.status === 'clock-in') {
     grouped[key].clockIn = timeStr;
     grouped[key].locIn = (r.location && r.location.lat) ? `${r.location.lat}, ${r.location.lng}` : '';
  } else if (r.status === 'clock-out') {
     if (!grouped[key].clockOut) {
         grouped[key].clockOut = timeStr;
         grouped[key].locOut = (r.location && r.location.lat) ? `${r.location.lat}, ${r.location.lng}` : '';
     }
     if (r.workedHours) {
       grouped[key].workedHours += r.workedHours;
     }
  }
}

let loopStart = new Date(actualStartDate || new Date());
let loopEnd = new Date(actualEndDate || new Date());

loopStart.setHours(12, 0, 0, 0);
loopEnd.setHours(12, 0, 0, 0);

const rows = [];
let totalWorkingDays = 0;
let absentDays = 0;
let sundayShifts = 0;
let totalOTHours = 0;

let curr = new Date(loopStart);
while (curr <= loopEnd) {
  const dateOpts = {};
  if (timezone) dateOpts.timeZone = timezone;
  
  const dStr = curr.toLocaleDateString('en-CA', dateOpts);
  const dDay = parseInt(dStr.split('-')[2]);
  const isSunday = curr.getDay() === 0;
  
  let dayNote = isSunday ? 'Sun' : '-';
  let inTime = 'Absent';
  let outTime = 'Absent';
  let otHours = 0;
  
  if (grouped[dStr]) {
    const g = grouped[dStr];
    inTime = g.clockIn || 'Absent';
    outTime = g.clockOut || 'Absent';
    if (g.workedHours && g.workedHours > 9) {
      otHours = Math.floor(g.workedHours - 9);
    }
    
    if (isSunday) {
      sundayShifts++;
    } else {
      totalWorkingDays++;
    }
    totalOTHours += otHours;
  } else {
    if (!isSunday) {
      absentDays++;
    }
  }
  
  rows.push({
    dateNum: dDay,
    note: dayNote,
    in: inTime,
    out: outTime,
    ot: otHours
  });
  
  curr.setDate(curr.getDate() + 1);
}

const csvLines = [];
csvLines.push(`"${userName} OT & Attendance Tracker"`);
csvLines.push('');
csvLines.push('Total Working Days,Absent Days,Sunday Shifts,Total OT Hours');
csvLines.push(`${totalWorkingDays},${absentDays},${sundayShifts},${totalOTHours}`);
csvLines.push('Date,Day/Note,In Time,Out Time,OT Hours');

for (const r of rows) {
  csvLines.push(`${r.dateNum},${r.note},${r.in},${r.out},${r.ot}`);
}

const csvString = csvLines.join('\n');
console.log(csvString.substring(0, 200));
