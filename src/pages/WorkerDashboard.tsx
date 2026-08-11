import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore, useOfflineStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Camera, MapPin, CheckCircle2, XCircle, LogOut, History, ChevronLeft, User as UserIcon, ScanFace, Moon, Sun, Upload, RotateCw, RotateCcw, ZoomIn, ZoomOut, Download, Settings, Cloud, CloudOff } from 'lucide-react';
import { getFaceDescriptor, compareDescriptors, loadModels } from '../lib/faceApi';
import { getCurrentLocation, getDistance, SITE_LOCATION, MAX_DISTANCE_METERS } from '../lib/geo';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isSameDay } from 'date-fns';
import Cropper from 'react-easy-crop';

export const getCroppedImg = async (imageSrc: string, pixelCrop: any, rotation = 0): Promise<string | null> => {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const MAX_TARGET = 300;
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  if (targetWidth > targetHeight) {
    if (targetWidth > MAX_TARGET) {
      targetHeight *= MAX_TARGET / targetWidth;
      targetWidth = MAX_TARGET;
    }
  } else {
    if (targetHeight > MAX_TARGET) {
      targetWidth *= MAX_TARGET / targetHeight;
      targetHeight = MAX_TARGET;
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.save();
  ctx.translate(targetWidth / 2, targetHeight / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-targetWidth / 2, -targetHeight / 2);

  // Instead of an intermediate huge canvas, draw image directly scaled and cropped
  // Note: For complex rotation, this may slighty differ if the bounds go out, but for standard face crops it's usually fine,
  // or a slightly larger intermediate context is used. Let's just create an intermediate context of exactly the unscaled crop size, not the full safe area.
  // actually, to handle rotation easily without a huge canvas:
  
  // Create an offscreen canvas large enough for the rotated *crop box*
  const safeCropArea = Math.max(pixelCrop.width, pixelCrop.height) * Math.sqrt(2);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = safeCropArea;
  tempCanvas.height = safeCropArea;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (!tempCtx) return null;
  tempCtx.translate(safeCropArea / 2, safeCropArea / 2);
  tempCtx.rotate((rotation * Math.PI) / 180);
  tempCtx.translate(-safeCropArea / 2, -safeCropArea / 2);

  // We draw the relevant part of the image
  tempCtx.drawImage(
    image,
    pixelCrop.x + pixelCrop.width/2 - safeCropArea/2,
    pixelCrop.y + pixelCrop.height/2 - safeCropArea/2,
    safeCropArea,
    safeCropArea,
    0,
    0,
    safeCropArea,
    safeCropArea
  );

  // Then draw it to our final resized canvas
  // the center of tempCanvas is our crop center
  ctx.restore();
  ctx.drawImage(
    tempCanvas,
    safeCropArea/2 - pixelCrop.width/2,
    safeCropArea/2 - pixelCrop.height/2,
    pixelCrop.width,
    pixelCrop.height,
    0, 0, targetWidth, targetHeight
  );

  return canvas.toDataURL('image/jpeg', 0.82);
};

const PermissionInstructions = ({ message, onClose }: { message: string; onClose: () => void }) => {
  if (!message.toLowerCase().includes('denied')) return null;

  const isLocation = message.toLowerCase().includes('location');
  const type = isLocation ? 'Location' : 'Camera';


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card-bg w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-card-border flex flex-col">
        <div className="p-6 flex-1">
          <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 mx-auto">
            <Settings className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-text-p text-center">Allow Access</h2>
          <p className="text-sm text-text-s mb-6 text-center">
            {message}
          </p>

          <div className="space-y-4 bg-bg p-4 rounded-xl border border-card-border">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center font-bold text-xs mt-0.5">1</div>
              <p className="text-sm text-text-p">Tap the <strong>lock icon</strong> (🔒) or <strong>tune icon</strong> in your browser address bar.</p>
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
          <Button className="flex-1 bg-accent hover:bg-accent/90 text-btn-text font-bold" onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    </div>
  );
};

export default function WorkerDashboard() {
  const { user, token, logout, updateUser } = useAuthStore();
  const { addToQueue, queue, clearQueue } = useOfflineStore();
  const [status, setStatus] = useState<'idle' | 'camera' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [actionType, setActionType] = useState<'clock-in' | 'clock-out' | null>(null);
  const [view, setView] = useState<'main' | 'history' | 'profile' | 'feedback' | 'slips'>('main');
  const [history, setHistory] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [slips, setSlips] = useState<any[]>([]);
  
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  
  const [editName, setEditName] = useState(user?.name || '');

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

  const [editMobile, setEditMobile] = useState((user as any)?.mobile || '');
  const [editPhoto, setEditPhoto] = useState((user as any)?.profilePhoto || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'camera' | 'processing' | 'success' | 'error'>('idle');
  const [enrollMessage, setEnrollMessage] = useState('');
  
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(document.documentElement.classList.contains('dark'));
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
    loadModels().catch(console.error);
    syncOfflineData();
    fetchHistory();
    fetchSites();
    fetchSlips();
    
    const handleOnline = () => {
      syncOfflineData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    const checkReminder = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const now = new Date();
        const hours = now.getHours();
        const isEndOfDay = hours >= 17; // Reminder at 5 PM or later
        
        const lastReminderDate = localStorage.getItem('lastClockOutReminder');
        const todayStr = now.toDateString();
        
        const isClockedIn = history[0] && history[0].status === 'clock-in';
        const clockedInToday = history[0] && new Date(history[0].timestamp).toDateString() === todayStr;

        if (isClockedIn && clockedInToday && isEndOfDay && lastReminderDate !== todayStr) {
          localStorage.setItem('lastClockOutReminder', todayStr);
          new Notification('Punch Out Reminder', {
            body: 'It is the end of the day. Please remember to punch out before you leave!',
          });
        }
      }
    };

    const intervalId = setInterval(checkReminder, 60000);
    checkReminder();
    
    return () => clearInterval(intervalId);
  }, [history]);

  const fetchSlips = async () => {
    try {
      const res = await fetch('/api/salary-slips/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          setSlips(JSON.parse(text));
        } catch (e) {
          console.error("Failed to parse fetching slips", e, text);
        }
      }
    } catch (e) {
      console.error('Failed to fetch slips', e);
    }
  };

  // Auto-logout on 15 minutes of inactivity
  useEffect(() => {
    const INACTIVITY_WARNING_MS = 14 * 60 * 1000; // 14 mins
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 mins
    let warningTimeoutId: NodeJS.Timeout;
    let logoutTimeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      if (logoutTimeoutId) clearTimeout(logoutTimeoutId);
      setShowLogoutWarning(false);

      warningTimeoutId = setTimeout(() => {
        setShowLogoutWarning(true);
      }, INACTIVITY_WARNING_MS);

      logoutTimeoutId = setTimeout(() => {
        setView('main');
        setMessage('You have been logged out due to inactivity.');
        setStatus('error');
        setTimeout(() => logout(), 2000);
        setShowLogoutWarning(false);
      }, INACTIVITY_LIMIT_MS);
    };

    const handleActivity = (e: any) => {
      // Only reset timer if the warning is NOT showing.
      // If warning is showing, we wait for explicit confirmation.
      if (e?.type === 'extend-session') {
        resetTimer();
      } else if (!showLogoutWarning) {
        resetTimer();
      }
    };

    // Attach listeners to detect user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('extend-session', handleActivity);

    // Init timer
    resetTimer();

    return () => {
      if (warningTimeoutId) clearTimeout(warningTimeoutId);
      if (logoutTimeoutId) clearTimeout(logoutTimeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('extend-session', handleActivity);
    };
  }, [logout, showLogoutWarning]);

  // removed auto-enroll
  // useEffect(() => {
  //   if (view === 'profile' && !user?.hasFaceDescriptor && enrollStatus === 'idle') {
  //     startEnrollCamera();
  //   }
  // }, [view, user?.hasFaceDescriptor, enrollStatus]);




  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setImageToCrop(ev.target.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // to allow selecting the same file again
  };

  const handleCropComplete = async () => {
    try {
      const croppedImageBase64 = await getCroppedImg(imageToCrop as string, croppedAreaPixels, rotation);
      if (croppedImageBase64) {
        setEditPhoto(croppedImageBase64);
        
        let faceDescriptorArray: number[] | undefined;
        try {
          const img = new Image();
          img.src = croppedImageBase64;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          const descriptor = await getFaceDescriptor(img);
          if (descriptor) {
            faceDescriptorArray = Array.from(descriptor);
          }
        } catch (err) {
          console.warn('Failed to extract face descriptor from uploaded photo', err);
        }

        const payload: any = { profilePhoto: croppedImageBase64 };
        if (faceDescriptorArray) {
          payload.faceDescriptor = faceDescriptorArray;
        }
        
        // Automatically save the cropped photo
        const res = await fetch('/api/users/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
           let data;
           const text = await res.text();
           try { data = JSON.parse(text); } catch (e) { data = null; }
           if (data) {
             updateUser(data);
             if (faceDescriptorArray) updateUser({ hasFaceDescriptor: true });
           }
           setProfileMessage('Profile photo updated successfully' + (faceDescriptorArray ? ' and face recognition data updated.' : ''));
        } else {
           let errMsg = 'Failed to save profile photo';
           try {
             const errData = await res.json();
             if (errData.message) errMsg += ': ' + errData.message;
           } catch (e) {}
           setProfileError(errMsg);
        }
      }
      setImageToCrop(null);
    } catch (e) {
      console.error(e);
      setProfileError('Failed to crop image');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    
    if (newPassword && newPassword !== confirmPassword) {
      return setProfileError('New passwords do not match');
    }

    setIsUpdatingProfile(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName, mobile: editMobile, currentPassword, newPassword, profilePhoto: editPhoto })
      });
      
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      
      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(text || res.statusText);
      }
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');
      
      updateUser(data);
      setProfileMessage('Profile updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingFeedback(true);
    setFeedbackMessage('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ feedback: feedbackText, rating: feedbackRating })
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      setFeedbackMessage('Feedback submitted successfully! Thank you.');
      setFeedbackText('');
      setFeedbackRating(5);
      setTimeout(() => {
        setFeedbackMessage('');
        setView('main');
      }, 2000);
    } catch (err) {
      console.error(err);
      setFeedbackMessage('Failed to submit feedback. Try again later.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/sites', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSites(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch sites', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/attendance/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      if (res.ok) {
        const serverHistory = await res.json();
        // Merge with current queue for offline optimistic UI
        const queueIds = new Set(queue.map((q: any) => q.timestamp));
        const merged = [...queue, ...serverHistory.filter((h: any) => !queueIds.has(h.timestamp))].sort(
          (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setHistory(merged);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const syncOfflineData = async () => {
    if (queue.length === 0 || !navigator.onLine) return;
    try {
      const res = await fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: queue }),
      });
      if (res.ok) {
        clearQueue();
        fetchHistory();
      }
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  
  const getCameraStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    } catch (e) {
      console.warn('[Camera] facingMode user failed, trying default video constraint:', e);
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e2) {
        console.error('[Camera] generic video constraint failed:', e2);
        throw e2;
      }
    }
  };

  const attachStream = (stream: MediaStream, attempts = 0) => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('muted', 'true');
      
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play().catch(e => console.warn('[Camera] Play on metadata error:', e));
        };
      }
      
      // Try playing immediately
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('[Camera] Autoplay prevented, waiting for interaction:', e);
        });
      }
    } else if (attempts < 50) {
      setTimeout(() => attachStream(stream, attempts + 1), 100);
    }
  };

  useEffect(() => {
    if (streamRef.current) attachStream(streamRef.current);
  }, [status, enrollStatus, view]);

  const handlePunchOut = async () => {
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
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
             body: JSON.stringify({ type: 'geo-breach', message: `Geo-fence breach attempt: Worker tried to punch out outside all active site bounds (Nearest was ${Math.round(closestDistance)}m away).` })
          }).catch(console.error);
          throw new Error(`Too far from any site (Closest is ${Math.round(closestDistance)}m away)`);
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
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const startCamera = async (type: 'clock-in' | 'clock-out') => {
    stopCamera();
    setActionType(type);
    setStatus('camera');
    setMessage('Position your face in the frame');
    try {
      const stream = await getCameraStream();
      streamRef.current = stream;
      attachStream(stream);
      

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

  const startEnrollCamera = async () => {
    stopCamera();
    setEnrollStatus('camera');
    setEnrollMessage('Position your face in the frame');
    try {
      const stream = await getCameraStream();
      streamRef.current = stream;
      attachStream(stream);
      

    } catch (err) {
      setEnrollStatus('error');
      setEnrollMessage('Camera access denied');
    }
  };

  const handleEnrollCapture = async () => {
    if (!videoRef.current) return;
    let video = videoRef.current;
    let attempts = 0;
    while ((!video.videoWidth || !video.videoHeight) && attempts < 15) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
      video = videoRef.current || video;
    }

    const canvas = document.createElement('canvas');
    const MAX_DIMENSION = 640;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    }

    setEnrollStatus('processing');
    setEnrollMessage('Scanning face...');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      const descriptor = await getFaceDescriptor(canvas);
      stopCamera();

      if (!descriptor) {
        throw new Error('No face detected. Please try again.');
      }

      const res = await fetch('/api/users/me/descriptor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
      });
      if (!res.ok) throw new Error('Failed to save face profile');
      
      updateUser({ hasFaceDescriptor: true });
      setEnrollStatus('success');
      setEnrollMessage('Face login configured successfully!');
      setTimeout(() => setEnrollStatus('idle'), 3000);
    } catch (err: any) {
      stopCamera();
      setEnrollStatus('error');
      setEnrollMessage(err.message);
      if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setEnrollStatus('idle'), 4000); }
    }
  };

  
  const processCapturedCanvas = async (canvas: HTMLCanvasElement | HTMLImageElement) => {
    setStatus('processing');
    setMessage('Verifying location...');
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
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
             body: JSON.stringify({ type: 'geo-breach', message: `Geo-fence breach attempt: Worker tried to punch ${actionType} outside active site bounds (Nearest was ${Math.round(closestDistance)}m away).` })
          }).catch(console.error);
          throw new Error(`Too far from any site (Closest is ${Math.round(closestDistance)}m away)`);
        }
      } catch (geoErr: any) {
        throw new Error(geoErr.message || 'Location verification failed');
      }

      setMessage('Analyzing face...');
      const descriptor = await getFaceDescriptor(canvas);
      stopCamera();

      if (!descriptor) {
        throw new Error('No face detected in photo. Please try again with clear lighting.');
      }

      let faceConfidence = 1;
      if (!user?.hasFaceDescriptor) {
        const res = await fetch('/api/users/me/descriptor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
        });
        if (!res.ok) throw new Error('Failed to save face profile');
        updateUser({ hasFaceDescriptor: true });
      } else {
        const res = await fetch('/api/users/me/descriptor', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error('Failed to fetch face profile');
        const storedDescriptor = new Float32Array(Object.values(data.faceDescriptor));
        const { isMatch, distance } = compareDescriptors(descriptor, storedDescriptor);
        faceConfidence = 1 - distance;
        if (!isMatch) throw new Error(`Face verification failed. Confidence: ${faceConfidence.toFixed(2)}`);
      }

      const record = {
        status: actionType,
        location,
        faceConfidence,
        timestamp: new Date().toISOString(),
      };

      if (navigator.onLine) {
        try {
          const attRes = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(record),
          });
          if (!attRes.ok) throw new Error('Failed to record attendance');
          setHistory(prev => [record, ...prev]);
          fetchHistory();
        } catch (fetchErr: any) {
          addToQueue(record);
          setHistory(prev => [record, ...prev]);
        }
      } else {
        addToQueue(record);
        setHistory(prev => [record, ...prev]);
      }
      setStatus('success');
      setMessage(`Successfully ${actionType === 'clock-in' ? 'Punched In' : 'Punched Out'}`);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      stopCamera();
      setStatus('error');
      setMessage(err.message || 'An unexpected error occurred');
      if (!err.message || !err.message.toLowerCase().includes('denied')) {
        setTimeout(() => setStatus('idle'), 4000);
      }
    }
  };

  const handleCameraFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        processCapturedCanvas(img);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEnrollFallbackFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        setEnrollStatus('processing');
        setEnrollMessage('Scanning face...');
        try {
          // Pass the image directly instead of a canvas to preserve EXIF orientation on mobile
          const descriptor = await getFaceDescriptor(img);
          stopCamera();
          if (!descriptor) {
            throw new Error('No face detected. Please try again.');
          }
          const res = await fetch('/api/users/me/descriptor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
          });
          if (!res.ok) throw new Error('Failed to save face profile');
          
          updateUser({ hasFaceDescriptor: true });
          setEnrollStatus('success');
          setEnrollMessage('Face login configured successfully!');
          setTimeout(() => setEnrollStatus('idle'), 3000);
        } catch (err: any) {
          stopCamera();
          setEnrollStatus('error');
          setEnrollMessage(err.message);
          if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setEnrollStatus('idle'), 4000); }
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;

    // Capture the current frame to a canvas before unmounting the video element
    const canvas = document.createElement('canvas');
    const MAX_DIMENSION = 640;
    let width = videoRef.current.videoWidth;
    let height = videoRef.current.videoHeight;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width > height) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    }

    setStatus('processing');
    setMessage('Verifying location...');
    console.log('[handleCapture] Started');

    try {
      if (!width || !height) throw new Error('Camera not fully initialized. Please try again.');
      // 1. Get Location
      let location;
      try {
        console.log('[handleCapture] Requesting location...');
        location = await getCurrentLocation();
        console.log('[handleCapture] Got location:', location);
        
        if (false) {
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

        console.log(`[handleCapture] Nearest site distance: ${closestDistance}m. isWithinAnySite: ${isWithinAnySite}`);

        if (!isWithinAnySite) {
          fetch('/api/alerts', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
             body: JSON.stringify({ type: 'geo-breach', message: `Geo-fence breach attempt: Worker tried to punch ${actionType} outside all active site bounds (Nearest was ${Math.round(closestDistance)}m away).` })
          }).catch(console.error);

          throw new Error(`Too far from any site (Closest is ${Math.round(closestDistance)}m away)`);
        }
      } catch (geoErr: any) {
        console.error('[handleCapture] Location error:', geoErr);
        throw new Error(geoErr.message || 'Location verification failed');
      }

      // Check for unusual activity hours (before 5 AM or after 8 PM)
      const currentHour = new Date().getHours();
      if (currentHour < 5 || currentHour > 20) {
          fetch('/api/alerts', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
             body: JSON.stringify({ type: 'unusual-time', message: `Unusual time: Worker clocked ${actionType} at ${format(new Date(), 'hh:mm a')}.` })
          }).catch(console.error);
      }

      setMessage('Analyzing face...');
      console.log('[handleCapture] Analyzing face...');
      // 2. Get Face Descriptor from the captured canvas
      const descriptor = await getFaceDescriptor(canvas);
      console.log('[handleCapture] Face descriptor result:', !!descriptor);
      stopCamera();

      if (!descriptor) {
        throw new Error('No face detected. Please try again.');
      }

      let faceConfidence = 1; // Default to 1 for first time setup
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
        const { isMatch, distance } = compareDescriptors(descriptor, storedDescriptor);
        
        faceConfidence = 1 - distance;
        console.log(`[WorkerDashboard] Face Verification Distance: ${distance.toFixed(4)}. Confidence: ${faceConfidence.toFixed(4)}.`);
        
        if (!isMatch) throw new Error(`Face verification failed. Confidence: ${faceConfidence.toFixed(2)} (Distance: ${distance.toFixed(2)})`);
      }

      // 4. Record Attendance
      const record = {
        status: actionType,
        location,
        faceConfidence,
        timestamp: new Date().toISOString(),
      };

      if (navigator.onLine) {
        try {
          const attRes = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(record),
          });
          if (!attRes.ok) throw new Error('Failed to record attendance');
          
          // Optimistic update for instant UI feedback
          setHistory(prev => [record, ...prev]);
          fetchHistory(); // Refresh history with server IDs
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
        setHistory(prev => [record, ...prev]); // optimistic update
      }

      setStatus('success');
      setMessage(`Successfully ${actionType === 'clock-in' ? 'Punched In' : 'Punched Out'}`);
      setTimeout(() => setStatus('idle'), 3000);

    } catch (err: any) {
      console.error('[handleCapture] Global error:', err);
      stopCamera();
      setStatus('error');
      setMessage(err.message || 'An unexpected error occurred');
      if (!err.message || !err.message.toLowerCase().includes('denied')) { setTimeout(() => setStatus('idle'), 4000); }
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text-p flex flex-col">
      {status === 'error' && message.toLowerCase().includes('denied') && (
        <PermissionInstructions message={message} onClose={() => setStatus('idle')} />
      )}
      {enrollStatus === 'error' && enrollMessage.toLowerCase().includes('denied') && (
        <PermissionInstructions message={enrollMessage} onClose={() => setEnrollStatus('idle')} />
      )}
      <header className="p-6 flex justify-between items-center border-b border-card-border bg-card-bg backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {(user as any)?.profilePhoto ? (
            <img src={(user as any).profilePhoto} alt="Profile" className="w-12 h-12 rounded-full border border-card-border object-cover bg-bg" />
          ) : (
            <div className="w-12 h-12 rounded-full border border-card-border bg-bg flex items-center justify-center text-text-s">
              <UserIcon className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-xl font-bold">Hello, {user?.name}</h1>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border w-max ${
                isOnline 
                  ? 'bg-success/10 text-success border-success/20' 
                  : 'bg-warning/10 text-warning border-warning/20'
              }`}>
                {isOnline ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
                {isOnline ? 'Sync Mode' : 'Offline Mode'}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <a href="https://www.glassfabsystems.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-accent uppercase hover:opacity-80 transition-opacity">Glass Fab Systems</a>
              <span className="text-text-s text-sm">• {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5 text-accent" />}
          </Button>
          {view !== 'main' ? (
            <Button variant="ghost" size="icon" onClick={() => setView('main')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => setView('history')}>
                <History className="w-5 h-5" />
              </Button>
              <Button variant="ghost" className="text-xs" onClick={() => setView('slips')}>
                Slips
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setView('profile')}>
                <UserIcon className="w-5 h-5" />
              </Button>
              <Button variant="ghost" className="text-xs" onClick={() => setView('feedback')}>
                Feedback
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {view === 'history' && (() => {
            const currentMonthDays = eachDayOfInterval({ 
              start: startOfMonth(new Date()), 
              end: endOfMonth(new Date()) 
            });
            const today = new Date();
            let presentDays = 0;
            let absentDays = 0;

            const monthlyData = currentMonthDays.map(day => {
              const dayRecords = history.filter(record => isSameDay(new Date(record.timestamp), day));
              const clockedIn = dayRecords.some(r => r.status === 'clock-in');
              const clockedOut = dayRecords.some(r => r.status === 'clock-out');
              const isPastDay = isBefore(day, today) && !isSameDay(day, today);
              
              if (clockedIn) presentDays++;
              else if (isPastDay && day.getDay() !== 0) absentDays++; // Assuming Sunday (0) is not counted as absent if no punch in

              return { day, clockedIn, clockedOut, isPastDay, dayRecords };
            });

            return (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <Card className="flex-1 flex flex-col max-h-[70vh]">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Monthly Attendance</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 px-3 text-[10px] text-accent hover:bg-accent/10 border-accent/30"
                    onClick={async () => {
                      try {
                        const params = new URLSearchParams();
                        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        if (tz) params.append('timezone', tz);
                        const res = await fetch(`/api/reports/attendance/export/me?${params.toString()}`, {
                          headers: { Authorization: `Bearer ${token}` }
                        });
                        if (!res.ok) throw new Error('Failed to download');
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `my_attendance_${new Date().getTime()}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> EXPORT CSV
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto pt-0 pb-4">
                  <div className="flex items-center justify-between p-3 mb-4 rounded-xl bg-card-bg border border-card-border">
                    <div className="text-center">
                      <p className="text-xs text-text-s font-medium uppercase tracking-wider">Present</p>
                      <p className="text-xl font-semibold text-success">{presentDays}</p>
                    </div>
                    <div className="w-[1px] h-8 bg-card-border"></div>
                    <div className="text-center">
                      <p className="text-xs text-text-s font-medium uppercase tracking-wider">Absent / Leave</p>
                      <p className="text-xl font-semibold text-destructive">{absentDays}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {monthlyData.filter(d => d.isPastDay || isSameDay(d.day, today)).reverse().map((data, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-card-border bg-card-bg hover:bg-accent/5 transition-colors">
                        <div>
                          <p className="font-medium text-[13px]">
                            {format(data.day, 'EEE, MMM d, yyyy')}
                          </p>
                          {data.clockedIn && data.dayRecords.map((r: any, rIdx: number) => (
                            <p key={rIdx} className="text-[11px] text-text-s mt-0.5">
                              {r.status === 'clock-in' ? 'In: ' : 'Out: '} {format(new Date(r.timestamp), 'hh:mm a')}
                              {r.workedHours && (
                                <span className="ml-2 text-text-p bg-bg px-1.5 py-0 rounded font-medium">
                                  {r.workedHours.toFixed(1)}h
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-bg">
                          {data.clockedIn ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : data.isPastDay ? (
                            <XCircle className="w-5 h-5 text-destructive" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-text-s opacity-30"></div>
                          )}
                        </div>
                      </div>
                    ))}
                    {monthlyData.length === 0 && (
                      <p className="text-text-s text-center py-8 text-sm">No records for this month.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            );
          })()}

          {view === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <Card className="flex-1 flex flex-col max-h-[80vh]">
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    {profileError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">{profileError}</div>}
                    {profileMessage && <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm text-center">{profileMessage}</div>}
                    
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-card-border bg-card-bg">
                           {editPhoto ? (
                             <img src={editPhoto} alt="Profile" className="w-full h-full object-cover" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-text-s bg-bg">
                               <Upload className="w-8 h-8 opacity-50" />
                             </div>
                           )}
                        </div>
                        <label className="cursor-pointer bg-accent/10 border border-accent/20 text-accent text-xs px-3 py-1.5 rounded uppercase font-semibold hover:bg-accent/20 transition-colors">
                          Upload Photo
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-s uppercase tracking-wider">Full Name</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} required />
                    </div>

                    {user?.employeeId && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-text-s uppercase tracking-wider">Employee ID</label>
                        <Input value={user.employeeId} readOnly className="opacity-70 cursor-not-allowed" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-s uppercase tracking-wider">Mobile Number (Optional)</label>
                      <Input value={editMobile} onChange={e => setEditMobile(e.target.value)} type="tel" />
                    </div>

                    <div className="pt-4 border-t border-card-border">
                      <h3 className="text-sm font-medium mb-4">Face Recognition Login</h3>
                      
                      {enrollStatus === 'idle' && (
                        <div className="space-y-4">
                          {!user?.hasFaceDescriptor ? (
                            <div className="bg-warning/10 border border-warning/20 rounded-xl p-6 text-center space-y-4">
                              <ScanFace className="w-12 h-12 text-warning mx-auto" />
                              <div>
                                <h4 className="text-lg font-semibold text-warning">Enroll Your Face</h4>
                                <p className="text-sm text-warning/80 mt-1">Set up facial recognition to quickly and securely log in and record your attendance.</p>
                              </div>
                              <Button type="button" className="w-full bg-warning hover:bg-warning/90 text-yellow-950 font-bold" size="lg" onClick={startEnrollCamera}>
                                Start Face Scan
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-4 rounded-xl border border-card-border bg-card-bg">
                              <div className="flex items-center gap-3">
                                <ScanFace className="w-5 h-5 text-accent" />
                                <div>
                                  <p className="text-sm font-medium">Face Login</p>
                                  <p className="text-xs text-text-s">Configured</p>
                                </div>
                              </div>
                              <Button type="button" variant="outline" size="sm" onClick={startEnrollCamera}>
                                Update Scan
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {enrollStatus === 'camera' && (
                        <div className="flex flex-col items-center space-y-4 mt-4">
                          <div className="relative w-full aspect-square max-w-[240px] rounded-2xl overflow-hidden bg-black border border-card-border" onClick={() => videoRef.current?.play()}>
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 border-2 border-accent/50 rounded-2xl pointer-events-none" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-32 h-40 border-2 border-dashed border-white/50 rounded-full" />
                            </div>
                          </div>
                          <p className="text-center text-text-s text-sm">{enrollMessage}</p>
                          <div className="flex flex-col gap-2 w-full max-w-[240px]">
                            <div className="flex gap-3 w-full">
                              <Button type="button" variant="outline" className="flex-1" onClick={() => { stopCamera(); setEnrollStatus('idle'); }}>
                                Cancel
                              </Button>
                              <Button type="button" className="flex-1 bg-accent hover:bg-accent/90 text-btn-text" onClick={handleEnrollCapture}>
                                <Camera className="w-4 h-4 mr-2" />
                                Capture
                              </Button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="w-full text-xs text-accent hover:bg-accent/10"
                              onClick={() => document.getElementById('enrollFallbackInput')?.click()}
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" /> Upload Photo Instead
                            </Button>
                            <input
                              id="enrollFallbackInput"
                              type="file"
                              accept="image/*"
                              capture="user"
                              onChange={handleEnrollFallbackFileSelect}
                              className="hidden"
                            />
                          </div>
                        </div>
                      )}

                      {(enrollStatus === 'processing' || enrollStatus === 'success' || enrollStatus === 'error') && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                          {enrollStatus === 'processing' && (
                            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                          )}
                          {enrollStatus === 'success' && <CheckCircle2 className="w-12 h-12 text-success" />}
                          {enrollStatus === 'error' && <XCircle className="w-12 h-12 text-red-500" />}
                          <p className="text-sm font-medium">{enrollMessage}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-card-border">
                      <h3 className="text-sm font-medium mb-4">Change Password (Optional)</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Input type="password" placeholder="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-btn-text font-semibold mt-6" disabled={isUpdatingProfile}>
                      {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Submit Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                    {feedbackMessage && (
                      <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm text-center">
                        {feedbackMessage}
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-s uppercase tracking-wider">Rating (1-5)</label>
                      <select 
                        required
                        value={feedbackRating}
                        onChange={(e) => setFeedbackRating(Number(e.target.value))}
                        className="flex h-10 w-full rounded-md border border-input bg-bg px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Good</option>
                        <option value="3">3 - Average</option>
                        <option value="2">2 - Poor</option>
                        <option value="1">1 - Terrible</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-s uppercase tracking-wider">Your Comments</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Tell us what you think..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="flex w-full rounded-md border border-input bg-bg px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-btn-text" disabled={isSubmittingFeedback}>
                      {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'slips' && (
            <motion.div
              key="slips"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <Card className="flex-1 flex flex-col max-h-[70vh]">
                <CardHeader>
                  <CardTitle>My Salary Slips</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
                  <div className="space-y-4">
                    {slips.length === 0 && <p className="text-text-s text-center py-8 text-sm">No salary slips found.</p>}
                    {slips.map((slip, i) => (
                      <div key={slip._id || i} className="p-4 border border-card-border bg-bg/50 rounded-xl space-y-2">
                        <div className="flex justify-between items-center border-b border-card-border pb-2">
                          <h4 className="font-bold text-sm tracking-tight text-accent uppercase">{slip.period}</h4>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-success/10 text-success rounded-full">
                            {slip.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-xs text-text-s">Amount</span>
                          <span className="text-sm font-bold font-mono">₹{slip.amount}</span>
                        </div>
                        {slip.notes && (
                          <div className="pt-2 text-xs text-text-p leading-relaxed border-t border-card-border/50">
                            <span className="text-text-s block mb-1">Notes:</span>
                            {slip.notes}
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-card-border/50">
                          <div className="text-[10px] text-text-s">
                            Issued: {format(new Date(slip.issuedAt), 'MMM d, yyyy')}
                          </div>
                          <button 
                            onClick={() => {
                              const rows = [];
                              rows.push(['SALARY SLIP REPORT']);
                              rows.push(['Period', slip.period]);
                              rows.push(['Amount (Rs)', slip.amount]);
                              rows.push(['Status', slip.status]);
                              rows.push(['Issued At', format(new Date(slip.issuedAt), 'MMM d, yyyy')]);
                              if (slip.notes) rows.push(['Notes', slip.notes]);
                              
                              rows.push([]);
                              rows.push(['ATTENDANCE LOGS FOR WORKER']);
                              rows.push(['Month', 'Date', 'Punch In', 'Punch Out', 'Total Hours', 'Daily Wage', 'OTT Allowance (Hours)']);
                              
                              // Group history by date
                              const grouped: Record<string, { month: string, date: string, clockIn: string, clockOut: string, hours: number, timestamp: number }> = {};
                              history.forEach(record => {
                                const d = new Date(record.timestamp);
                                const dateKey = d.toLocaleDateString();
                                if (!grouped[dateKey]) {
                                  grouped[dateKey] = {
                                    month: format(d, 'MMMM yyyy'),
                                    date: format(d, 'MMM d, yyyy'),
                                    clockIn: '-',
                                    clockOut: '-',
                                    hours: 0,
                                    timestamp: d.getTime()
                                  };
                                }
                                if (record.status === 'clock-in') {
                                  grouped[dateKey].clockIn = format(d, 'h:mm:ss a');
                                } else if (record.status === 'clock-out') {
                                  grouped[dateKey].clockOut = format(d, 'h:mm:ss a');
                                  if (record.workedHours) {
                                    grouped[dateKey].hours += record.workedHours;
                                  }
                                }
                              });
                              
                              // Filter logs by the period string (basic text match) or fallback to recent 30 days of the slip issue
                              let filteredDates = Object.keys(grouped).filter(dateKey => {
                                const itemMonth = grouped[dateKey].month.toLowerCase();
                                const slipPeriod = slip.period.toLowerCase();
                                // check if the month or year appears in the slip period string
                                const words = slipPeriod.split(/[\s,-/]+/);
                                return words.some(w => w.length >= 3 && itemMonth.includes(w));
                              });
                              
                              // If no logs match the period name directly, just include all logs (user can filter in excel)
                              if (filteredDates.length === 0) {
                                filteredDates = Object.keys(grouped);
                              }

                              const sortedDates = filteredDates.sort((a, b) => grouped[b].timestamp - grouped[a].timestamp);

                              sortedDates.forEach(dateKey => {
                                const data = grouped[dateKey];
                                rows.push([
                                  data.month,
                                  data.date,
                                  data.clockIn,
                                  data.clockOut,
                                  data.hours > 0 ? data.hours.toFixed(2) : '0',
                                  (user as any)?.dailyWage || 0,
                                  (user as any)?.ottHours || 0
                                ]);
                              });

                              const csvContent = rows.map(r => r.join(',')).join('\n');
                              const blob = new Blob([csvContent], { type: 'text/csv' });
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Salary_Slip_${slip.period.replace(/ /g, '_')}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                            }}
                            className="bg-accent/10 border border-accent/20 text-accent text-[10px] px-3 py-1 font-semibold rounded hover:bg-accent/20 transition-colors uppercase"
                          >
                            Download CSV
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'main' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {!user?.hasFaceDescriptor && (
                 <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex flex-col items-center text-center gap-3">
                    <ScanFace className="w-10 h-10 text-warning" />
                    <div>
                      <h3 className="font-semibold text-warning text-sm">Face Login Missing</h3>
                      <p className="text-xs text-text-s mt-1">Enroll your face to securely log in and record your attendance.</p>
                    </div>
                    <Button onClick={() => setView('profile')} size="sm" className="bg-warning hover:bg-warning/90 text-yellow-950 w-full font-bold">
                       Go To Enroll
                    </Button>
                 </div>
              )}

              <div className={`grid gap-4 ${(!history[0] || history[0].status !== 'clock-in') ? 'grid-cols-1' : 'grid-cols-1'}`}>
                {(!history[0] || history[0].status !== 'clock-in') ? (
                  <Button
                    size="lg"
                    className="h-32 flex-col gap-3 bg-success/10 text-success hover:bg-success/20 border border-success/20 w-full"
                    onClick={() => startCamera('clock-in')}
                  >
                    <MapPin className="w-8 h-8" />
                    <span>Punch In</span>
                  </Button>
                ) : (
                  <div>
                  <Button
                    size="lg"
                    className="h-32 flex-col gap-3 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 w-full"
                    onClick={() => handlePunchOut()}
                  >
                    <LogOut className="w-8 h-8" />
                    <span>Punch Out</span>
                  </Button>
                  <p className="text-center text-xs text-text-s mt-2">Click here Punch out without face</p>
                  </div>
                )}
              </div>
              
              {queue.length > 0 && (
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm flex items-center justify-between">
                  <span>{queue.length} offline records pending</span>
                  <Button variant="outline" size="sm" onClick={syncOfflineData}>Sync Now</Button>
                </div>
              )}
            </motion.div>
          )}

          {view === 'main' && status === 'camera' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div
                key="camera-modal"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card-bg border border-card-border rounded-3xl p-6 w-full max-w-sm flex flex-col items-center space-y-4 shadow-2xl"
              >
                <div className="w-full flex justify-between items-center mb-2">
                  <h2 className="text-lg font-bold text-text-p">Punch In Verification</h2>
                  <button onClick={() => { stopCamera(); setStatus('idle'); }} className="p-1 rounded-full hover:bg-bg/50 text-text-s">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-black shadow-inner" onClick={() => videoRef.current?.play()}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-accent/50 rounded-2xl pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
                  </div>
                </div>
                
                <p className="text-center text-text-s text-xs max-w-xs">{message}<br/><span className="text-text-muted">Tap the black frame if camera is stuck</span></p>
                
                <div className="flex flex-col gap-2.5 w-full">
                  <Button className="w-full bg-accent hover:bg-accent/90 text-btn-text font-bold py-6 text-lg" onClick={handleCapture}>
                    <Camera className="w-5 h-5 mr-2" />
                    Verify & Punch In
                  </Button>
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
                    
                    
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {view === 'main' && (status === 'processing' || status === 'success' || status === 'error') && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div
                key="status-modal"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card-bg border border-card-border rounded-3xl p-8 w-full max-w-sm flex flex-col items-center justify-center text-center space-y-4 shadow-2xl"
              >
                {status === 'processing' && (
                  <>
                    <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                    <p className="text-lg font-medium">{message}</p>
                  </>
                )}
                {status === 'success' && (
                  <>
                    <CheckCircle2 className="w-16 h-16 text-success" />
                    <p className="text-lg font-medium text-success">{message}</p>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <XCircle className="w-16 h-16 text-red-500" />
                    <p className="text-lg font-medium text-red-500">{message}</p>
                    <Button variant="outline" className="mt-4" onClick={() => setStatus('idle')}>
                      Try Again
                    </Button>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {imageToCrop && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
          <div className="relative flex-1 w-full bg-black">
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onRotationChange={setRotation}
              onZoomChange={setZoom}
              onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
            />
          </div>
          <div className="bg-card-bg sm:rounded-t-3xl p-6 border-t border-card-border space-y-6 shrink-0 h-auto w-full max-w-lg mx-auto shadow-2xl relative z-10 bottom-0">
             <div className="flex flex-col gap-3">
               <div className="flex items-center justify-between">
                 <label className="text-xs text-text-s uppercase tracking-wider font-semibold flex items-center gap-2">
                   <ZoomIn className="w-4 h-4" /> Zoom
                 </label>
                 <span className="text-xs font-mono bg-bg px-2 py-0.5 rounded text-text-p">{zoom.toFixed(1)}x</span>
               </div>
               <div className="flex items-center gap-3">
                 <ZoomOut className="w-4 h-4 text-text-s cursor-pointer hover:text-accent disabled:opacity-50" onClick={() => setZoom(Math.max(1, zoom - 0.1))} />
                 <input
                   type="range"
                   value={zoom}
                   min={1}
                   max={3}
                   step={0.1}
                   aria-labelledby="Zoom"
                   onChange={(e) => setZoom(Number(e.target.value))}
                   className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-accent"
                 />
                 <ZoomIn className="w-4 h-4 text-text-s cursor-pointer hover:text-accent disabled:opacity-50" onClick={() => setZoom(Math.min(3, zoom + 0.1))} />
               </div>
             </div>

             <div className="flex flex-col gap-3">
               <div className="flex items-center justify-between">
                 <label className="text-xs text-text-s uppercase tracking-wider font-semibold flex items-center gap-2">
                   <RotateCw className="w-4 h-4" /> Rotation
                 </label>
                 <span className="text-xs font-mono bg-bg px-2 py-0.5 rounded text-text-p">{rotation}°</span>
               </div>
               <div className="flex items-center gap-3">
                 <RotateCcw className="w-4 h-4 text-text-s cursor-pointer hover:text-accent" onClick={() => setRotation((r) => (r - 90 + 360) % 360)} />
                 <input
                   type="range"
                   value={rotation}
                   min={0}
                   max={360}
                   step={1}
                   aria-labelledby="Rotation"
                   onChange={(e) => setRotation(Number(e.target.value))}
                   className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-accent"
                 />
                 <RotateCw className="w-4 h-4 text-text-s cursor-pointer hover:text-accent" onClick={() => setRotation((r) => (r + 90) % 360)} />
               </div>
             </div>
             
             <div className="flex justify-between items-center gap-3 pt-4 border-t border-card-border">
               <Button variant="outline" onClick={() => setImageToCrop(null)} className="flex-1 border-card-border hover:bg-bg">Cancel</Button>
               <Button onClick={handleCropComplete} className="flex-1 bg-accent hover:bg-accent/90 text-white font-semibold">Apply Crop</Button>
             </div>
          </div>
        </div>
      )}
      {showLogoutWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 text-center animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Session timeout warning</h3>
            <p className="text-text-s mb-6 text-sm">
              Your session is about to expire due to inactivity. Do you want to stay logged in?
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => logout()} 
                variant="outline" 
                className="flex-1"
              >
                Log Out
              </Button>
              <Button 
                onClick={() => {
                  setShowLogoutWarning(false);
                  window.dispatchEvent(new CustomEvent('extend-session', { detail: 'extend-session' }));
                }} 
                className="bg-accent text-btn-text hover:bg-accent/90 flex-1 font-semibold"
              >
                Continue Session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
