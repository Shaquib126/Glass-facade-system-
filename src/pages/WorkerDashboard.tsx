import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore, useOfflineStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Camera, MapPin, CheckCircle2, XCircle, LogOut } from 'lucide-react';
import { getFaceDescriptor, compareDescriptors, loadModels } from '../lib/faceApi';
import { getCurrentLocation, getDistance, SITE_LOCATION, MAX_DISTANCE_METERS } from '../lib/geo';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkerDashboard() {
  const { user, token, logout, updateUser } = useAuthStore();
  const { addToQueue, queue, clearQueue } = useOfflineStore();
  const [status, setStatus] = useState<'idle' | 'camera' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [actionType, setActionType] = useState<'clock-in' | 'clock-out' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadModels().catch(console.error);
    syncOfflineData();
  }, []);

  const syncOfflineData = async () => {
    if (queue.length === 0 || !navigator.onLine) return;
    try {
      const res = await fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: queue }),
      });
      if (res.ok) clearQueue();
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  const startCamera = async (type: 'clock-in' | 'clock-out') => {
    setActionType(type);
    setStatus('camera');
    setMessage('Position your face in the frame');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setStatus('error');
      setMessage('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setStatus('processing');
    setMessage('Verifying identity and location...');

    try {
      // 1. Get Location
      let location;
      try {
        location = await getCurrentLocation();
        const distance = getDistance(location.lat, location.lng, SITE_LOCATION.lat, SITE_LOCATION.lng);
        if (distance > MAX_DISTANCE_METERS) {
          throw new Error(`Too far from site (${Math.round(distance)}m away)`);
        }
      } catch (geoErr: any) {
        throw new Error(geoErr.message || 'Location verification failed');
      }

      // 2. Get Face Descriptor
      const descriptor = await getFaceDescriptor(videoRef.current);
      stopCamera();

      if (!descriptor) {
        throw new Error('No face detected. Please try again.');
      }

      // 3. Verify Face
      if (!user?.hasFaceDescriptor) {
        // First time setup
        const res = await fetch('/api/users/me/descriptor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
        });
        if (!res.ok) throw new Error('Failed to save face profile');
        updateUser({ hasFaceDescriptor: true });
      } else {
        // Compare with stored
        const res = await fetch('/api/users/me/descriptor', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error('Failed to fetch face profile');
        
        const storedDescriptor = new Float32Array(Object.values(data.faceDescriptor));
        const isMatch = compareDescriptors(descriptor, storedDescriptor);
        
        if (!isMatch) throw new Error('Face verification failed');
      }

      // 4. Record Attendance
      const record = {
        status: actionType,
        location,
        timestamp: new Date().toISOString(),
      };

      if (navigator.onLine) {
        const attRes = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(record),
        });
        if (!attRes.ok) throw new Error('Failed to record attendance');
      } else {
        addToQueue(record);
      }

      setStatus('success');
      setMessage(`Successfully ${actionType === 'clock-in' ? 'Clocked In' : 'Clocked Out'}`);
      setTimeout(() => setStatus('idle'), 3000);

    } catch (err: any) {
      stopCamera();
      setStatus('error');
      setMessage(err.message);
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-p flex flex-col">
      <header className="p-6 flex justify-between items-center border-b border-card-border bg-card-bg backdrop-blur-md sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-bold">Hello, {user?.name}</h1>
          <p className="text-sm text-text-s">{new Date().toLocaleDateString()}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 p-6 flex flex-col justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <Button
                  size="lg"
                  className="h-32 flex-col gap-3 bg-success/10 text-success hover:bg-success/20 border border-success/20"
                  onClick={() => startCamera('clock-in')}
                >
                  <MapPin className="w-8 h-8" />
                  <span>Clock In</span>
                </Button>
                <Button
                  size="lg"
                  className="h-32 flex-col gap-3 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
                  onClick={() => startCamera('clock-out')}
                >
                  <LogOut className="w-8 h-8" />
                  <span>Clock Out</span>
                </Button>
              </div>
              
              {queue.length > 0 && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm flex items-center justify-between">
                  <span>{queue.length} offline records pending</span>
                  <Button variant="outline" size="sm" onClick={syncOfflineData}>Sync Now</Button>
                </div>
              )}
            </motion.div>
          )}

          {status === 'camera' && (
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
                <Button className="flex-1 bg-accent hover:bg-accent/90 text-black" onClick={handleCapture}>
                  <Camera className="w-5 h-5 mr-2" />
                  Verify
                </Button>
              </div>
            </motion.div>
          )}

          {(status === 'processing' || status === 'success' || status === 'error') && (
            <motion.div
              key="status"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-4"
            >
              {status === 'processing' && (
                <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
              )}
              {status === 'success' && <CheckCircle2 className="w-20 h-20 text-success" />}
              {status === 'error' && <XCircle className="w-20 h-20 text-red-500" />}
              <h2 className="text-xl font-medium">{message}</h2>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
