const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
`  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint for global salary report`,
`  } catch (error: any) {
    console.error('Export Error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// Endpoint for global salary report`
);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts error");
