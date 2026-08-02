const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

code = code.replace(
`        if (false) {
          throw new Error('No active sites configured by admin.');
        }

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
        
        console.log(\`[handleCapture] Nearest site distance: \${closestDistance}m. isWithinAnySite: \${isWithinAnySite}\`);

        if (!isWithinAnySite) {
          fetch('/api/alerts', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
             body: JSON.stringify({ type: 'geo-breach', message: \`Geo-fence breach attempt: Worker tried to clock \${actionType} outside all active site bounds (Nearest was \${Math.round(closestDistance)}m away).\` })
          }).catch(console.error);

          throw new Error(\`Too far from any site (Closest is \${Math.round(closestDistance)}m away)\`);
        }`, 
`        if (sites.length > 0) {
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
          
          console.log(\`[handleCapture] Nearest site distance: \${closestDistance}m. isWithinAnySite: \${isWithinAnySite}\`);

          if (!isWithinAnySite) {
            fetch('/api/alerts', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
               body: JSON.stringify({ type: 'geo-breach', message: \`Geo-fence breach attempt: Worker tried to clock \${actionType} outside all active site bounds (Nearest was \${Math.round(closestDistance)}m away).\` })
            }).catch(console.error);

            throw new Error(\`Too far from any site (Closest is \${Math.round(closestDistance)}m away)\`);
          }
        }`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
