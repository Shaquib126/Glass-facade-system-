const fs = require('fs');

let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Add import
if (!code.includes('AttendanceTrendsChart')) {
  code = code.replace(
    `import { MapTab } from '../components/MapTab';`,
    `import { MapTab } from '../components/MapTab';\nimport { AttendanceTrendsChart } from '../components/AttendanceTrendsChart';`
  );

  // Insert component after Bento 1.5
  const targetStr = `              {/* Bento 1.5: Weekly Attendance Overview */}`;
  const replacementStr = `              {/* Manager Attendance Trends Component */}
              <AttendanceTrendsChart attendance={attendance} users={users} />

              {/* Bento 1.5: Weekly Attendance Overview */}`;

  if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
    console.log('AdminDashboard updated with AttendanceTrendsChart component');
  } else {
    console.error('Target string not found in AdminDashboard');
  }
} else {
  console.log('AttendanceTrendsChart already present in AdminDashboard');
}
