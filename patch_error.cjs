const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(
`      if (!res.ok) throw new Error('Failed to download report');

      const blob = await res.blob();`,
`      if (!res.ok) {
        let errMsg = 'Failed to download report';
        try {
          const errData = await res.json();
          errMsg = errData.message || errMsg;
        } catch(e){}
        throw new Error(errMsg);
      }

      const blob = await res.blob();`
);

code = code.replace(
`    } catch (err) {
      console.error(err);
      showToastMsg('Failed to download attendance report for this user');
    }`,
`    } catch (err: any) {
      console.error(err);
      showToastMsg(err.message || 'Failed to download attendance report for this user');
    }`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
console.log("Patched AdminDashboard.tsx");
