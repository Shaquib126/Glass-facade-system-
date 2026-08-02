const fs = require('fs');
let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

// Add Settings to imports
code = code.replace(
  `import { Camera, MapPin, CheckCircle2, XCircle, LogOut, History, ChevronLeft, User as UserIcon, ScanFace, Moon, Sun, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Download } from 'lucide-react';`,
  `import { Camera, MapPin, CheckCircle2, XCircle, LogOut, History, ChevronLeft, User as UserIcon, ScanFace, Moon, Sun, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Download, Settings } from 'lucide-react';`
);

// Add the PermissionInstructions component before WorkerDashboard
const instructionsComponent = `
const PermissionInstructions = ({ message, onClose }: { message: string, onClose: () => void }) => {
  if (!message.toLowerCase().includes('denied')) return null;

  const isLocation = message.toLowerCase().includes('location');
  const type = isLocation ? 'Location' : 'Camera';
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-card-border flex flex-col">
        <div className="p-6 flex-1">
          <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 mx-auto">
            <Settings className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-text text-center">Allow Access</h2>
          <p className="text-sm text-text-s mb-6 text-center">
            {message}
          </p>
          
          <div className="space-y-4 bg-bg p-4 rounded-xl border border-card-border">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-xs mt-0.5">1</div>
              <p className="text-sm text-text-p">Tap the <strong>lock icon</strong> (🔒) or <strong>tune icon</strong> in your browser's address bar.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-xs mt-0.5">2</div>
              <p className="text-sm text-text-p">Select <strong>Permissions</strong> or <strong>Site settings</strong>.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-xs mt-0.5">3</div>
              <p className="text-sm text-text-p">Turn on the switch for <strong>{type}</strong>.</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-card-bg border-t border-card-border flex gap-3 mt-auto">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1 bg-accent hover:bg-accent/90 text-white" onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    </div>
  );
};
`;

code = code.replace(
  `export const WorkerDashboard = () => {`,
  instructionsComponent + `\nexport const WorkerDashboard = () => {`
);

// Prevent timeouts for permission errors
code = code.replace(
  `setTimeout(() => setStatus('idle'), 4000);`,
  `if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setStatus('idle'), 4000); }`
);

code = code.replace(
  `setTimeout(() => setEnrollStatus('idle'), 4000);`,
  `if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setEnrollStatus('idle'), 4000); }`
);

// Insert the overlay in the render tree for WorkerDashboard
// Under <div className="min-h-screen bg-bg text-text-p flex flex-col">
code = code.replace(
  `<div className="min-h-screen bg-bg text-text-p flex flex-col">`,
  `<div className="min-h-screen bg-bg text-text-p flex flex-col">
      {status === 'error' && message.toLowerCase().includes('denied') && (
        <PermissionInstructions message={message} onClose={() => setStatus('idle')} />
      )}
      {enrollStatus === 'error' && enrollMessage.toLowerCase().includes('denied') && (
        <PermissionInstructions message={enrollMessage} onClose={() => setEnrollStatus('idle')} />
      )}`
);

fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
