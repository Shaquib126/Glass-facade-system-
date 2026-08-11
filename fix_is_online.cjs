const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const importRegex = /import { Camera, [^}]+ } from 'lucide-react';/;
code = code.replace(importRegex, "import { Camera, MapPin, CheckCircle2, XCircle, LogOut, History, ChevronLeft, User as UserIcon, ScanFace, Moon, Sun, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Download, Settings, Cloud, CloudOff } from 'lucide-react';");

const stateInsertion = `  const [editName, setEditName] = useState(user?.name || '');

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
`;
code = code.replace("  const [editName, setEditName] = useState(user?.name || '');", stateInsertion);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
console.log('Done inserting state');
