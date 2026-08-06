const fs = require('fs');

let code = fs.readFileSync('src/pages/WorkerDashboard.tsx', 'utf8');

const oldCameraBlock = `{view === 'main' && status === 'camera' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative w-full aspect-[3/4] max-w-sm rounded-3xl overflow-hidden bg-black border border-card-border">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-accent/50 rounded-3xl pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
                </div>
              </div>
              <p className="text-center text-text-s">{message}</p>
              <div className="flex gap-4 w-full max-w-sm">
                <Button variant="outline" className="flex-1" onClick={() => { stopCamera(); setStatus('idle'); }}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-accent hover:bg-accent/90 text-btn-text" onClick={handleCapture}>
                  <Camera className="w-5 h-5 mr-2" />
                  Verify
                </Button>
              </div>
            </motion.div>
          )}`;

const newCameraBlock = `{view === 'main' && status === 'camera' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="relative w-full aspect-[3/4] max-w-sm rounded-3xl overflow-hidden bg-black border border-card-border shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-accent/50 rounded-3xl pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
                </div>
              </div>
              
              <p className="text-center text-text-s text-xs max-w-xs">{message}</p>
              
              <input
                type="file"
                ref={cameraFileInputRef}
                accept="image/*"
                capture="user"
                onChange={handleCameraFallbackFileSelect}
                className="hidden"
              />

              <div className="flex flex-col gap-2.5 w-full max-w-sm">
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { stopCamera(); setStatus('idle'); }}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-accent hover:bg-accent/90 text-btn-text font-bold" onClick={handleCapture}>
                    <Camera className="w-4 h-4 mr-2" />
                    Verify Face
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 text-xs text-text-s hover:text-text-p"
                    onClick={() => {
                      if (actionType) startCamera(actionType);
                    }}
                  >
                    <RotateCw className="w-3.5 h-3.5 mr-1" /> Restart Camera
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 text-xs text-accent hover:bg-accent/10"
                    onClick={() => cameraFileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Photo Instead
                  </Button>
                </div>
              </div>
            </motion.div>
          )}`;

if (code.includes(oldCameraBlock)) {
  code = code.replace(oldCameraBlock, newCameraBlock);
  fs.writeFileSync('src/pages/WorkerDashboard.tsx', code);
  console.log('Camera UI updated with fallback photo options');
} else {
  console.log('Old camera block pattern not matched exactly, checking layout...');
}
