const http = require('http');

const req = http.get('http://localhost:3000/api/reports/attendance/export?userId=all', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Body:", data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
