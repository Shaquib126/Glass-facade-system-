import http from 'http';

const reqData = JSON.stringify({ email: 'admin@glassfab.com', password: 'admin' });

const req1 = http.request('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': reqData.length
  }
}, (res1) => {
  let body = '';
  res1.on('data', (c) => body += c);
  res1.on('end', () => {
    const data = JSON.parse(body);
    console.log("Login Status:", res1.statusCode);
    if (!data.token) {
      console.log("No token", data);
      return;
    }
    const req2 = http.get('http://localhost:3000/api/reports/attendance/export?userId=all', {
      headers: {
        'Authorization': `Bearer ${data.token}`
      }
    }, (res2) => {
      let b = '';
      res2.on('data', c => b += c);
      res2.on('end', () => {
        console.log("Export status:", res2.statusCode);
        console.log("Export body:", b.substring(0, 200));
      });
    });
    req2.end();
  });
});
req1.write(reqData);
req1.end();
