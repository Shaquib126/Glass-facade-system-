const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const regex = /  const handlePunchOut = async \(\) => \{[\s\S]*?if \(!err\.message \|\| !err\.message\.toLowerCase\(\)\.includes\('denied'\)\) \{ setTimeout\(\(\) => setStatus\('idle'\), 4000\); \}\n    \}\n  \};\n/;

code = code.replace(regex, '');

const startCameraStr = "  const startCamera = async (type: 'clock-in' | 'clock-out') => {";

const handlePunchOutFn = `  const handlePunchOut = async () => {
    setActionType('clock-out');
    setStatus('processing');
    setMessage('Punching out...');
    try {
      let location;
      try {
        location = await getCurrentLocation();
        
        let isWithinAnySite = false;
        let closestDistance = Infinity;
        for (const site of sites) {
          const distance = getDistance(location.lat, location.lng, site.lat, site.lng);
          if (distance < closestDistance) closestDistance = distance;
          if (distance <= site.radius) {
            isWithinAnySite = true;
            break;
          }
        }
        
        if (!isWithinAnySite) {
          fetch('/api/alerts', { 
             method: 'POST', 
             headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` }, 
             body: JSON.stringify({ type: 'geo-breach', message: \`Geo-fence breach attempt: Worker tried to punch out outside all active site bounds (Nearest was \${Math.round(closestDistance)}m away).\` })
          }).catch(console.error);
          throw new Error(\`Too far from any site (Closest is \${Math.round(closestDistance)}m away)\`);
        }
      } catch (geoErr: any) {
        throw new Error(geoErr.message || 'Location verification failed');
      }

      const record = {
        status: 'clock-out' as const,
        location,
        faceConfidence: 1, // Bypassed face check
        timestamp: new Date().toISOString(),
      };

      if (navigator.onLine) {
        try {
          const attRes = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
            body: JSON.stringify(record),
          });
          if (!attRes.ok) throw new Error('Failed to record attendance');
          setHistory(prev => [record, ...prev]);
          fetchHistory();
        } catch (fetchErr: any) {
          if (fetchErr.message === 'Failed to fetch' || fetchErr.name === 'TypeError') {
            addToQueue(record);
            setHistory(prev => [record, ...prev]);
          } else {
            throw fetchErr;
          }
        }
      } else {
        addToQueue(record);
        setHistory(prev => [record, ...prev]);
      }
      
      setStatus('success');
      setMessage('Successfully Punched Out');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'An unexpected error occurred');
      if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setStatus('idle'), 4000); }
    }
  };

`;

code = code.replace(startCameraStr, handlePunchOutFn + startCameraStr);
fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
