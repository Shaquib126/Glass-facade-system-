import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore, useOfflineStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Camera, MapPin, CheckCircle2, XCircle, LogOut, History, ChevronLeft, User as UserIcon, ScanFace, Moon, Sun } from 'lucide-react';
import { getFaceDescriptor, compareDescriptors, loadModels } from '../lib/faceApi';
import { getCurrentLocation, getDistance, SITE_LOCATION, MAX_DISTANCE_METERS } from '../lib/geo';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'camera' | 'processing' | 'success' | 'error'>('idle');
  const [enrollMessage, setEnrollMessage] = useState('');
  
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(document.documentElement.classList.contains('dark'));
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadModels().catch(console.error);
    syncOfflineData();
    fetchHistory();
    fetchSites();
    fetchSlips();
  }, []);

  const fetchSlips = async () => {
    try {
      const res = await fetch('/api/salary-slips/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSlips(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch slips', e);
    }
  };

  // Auto-logout on 15 minutes of inactivity
  useEffect(() => {
    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes configurable
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setMessage('You have been logged out due to inactivity.');
        setStatus('error');
        setTimeout(() => logout(), 2000);
      }, INACTIVITY_LIMIT_MS);
    };

    const handleActivity = () => {
      resetTimer();
    };

    // Attach listeners to detect user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Init timer
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [logout]);

  useEffect(() => {
    if (view === 'profile' && !user?.hasFaceDescriptor && enrollStatus === 'idle') {
      startEnrollCamera();
    }
  }, [view, user?.hasFaceDescriptor, enrollStatus]);

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
        body: JSON.stringify({ name: editName, currentPassword, newPassword })
      });
      
      const data = await res.json();
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
      if (res.ok) {
        setHistory(await res.json());
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

  const startEnrollCamera = async () => {
    setEnrollStatus('camera');
    setEnrollMessage('Position your face in the frame');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setEnrollStatus('error');
      setEnrollMessage('Camera access denied');
    }
  };

  const handleEnrollCapture = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    }

    setEnrollStatus('processing');
    setEnrollMessage('Scanning face...');

    try {
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
      setTimeout(() => setEnrollStatus('idle'), 4000);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;

    // Capture the current frame to a canvas before unmounting the video element
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    }

    setStatus('processing');
    setMessage('Verifying identity and location...');

    try {
      // 1. Get Location
      let location;
      try {
        location = await getCurrentLocation();
        
        if (sites.length === 0) {
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

        if (!isWithinAnySite) {
          fetch('/api/alerts', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
             body: JSON.stringify({ type: 'geo-breach', message: `Geo-fence breach attempt: Worker tried to clock ${actionType} outside all active site bounds (Nearest was ${Math.round(closestDistance)}m away).` })
          }).catch(console.error);

          throw new Error(`Too far from any site (Closest is ${Math.round(closestDistance)}m away)`);
        }
      } catch (geoErr: any) {
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

      // 2. Get Face Descriptor from the captured canvas
      const descriptor = await getFaceDescriptor(canvas);
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
        const { isMatch, distance } = compareDescriptors(descriptor, storedDescriptor);
        
        console.log(`[WorkerDashboard] Face Verification Distance: ${distance.toFixed(4)}. Confidence: ${(1 - distance).toFixed(4)}.`);
        
        if (!isMatch) throw new Error(`Face verification failed. Confidence: ${(1 - distance).toFixed(2)} (Distance: ${distance.toFixed(2)})`);
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
        
        // Optimistic update for instant UI feedback
        setHistory(prev => [record, ...prev]);
        fetchHistory(); // Refresh history with server IDs
      } else {
        addToQueue(record);
        setHistory(prev => [record, ...prev]); // optimistic update
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
          <div className="flex items-center gap-2 mt-1">
            <a href="https://www.glassfabsystems.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-accent uppercase hover:opacity-80 transition-opacity">Glass Fab Systems</a>
            <span className="text-text-s text-sm">• {new Date().toLocaleDateString()}</span>
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
          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <Card className="flex-1 flex flex-col max-h-[70vh]">
                <CardHeader>
                  <CardTitle>My Attendance History</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
                  <div className="space-y-0">
                    {history.map((record, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-card-border last:border-0">
                        <div>
                          <p className="font-medium text-[14px]">
                            {record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out'}
                            {record.workedHours !== undefined && (
                              <span className="ml-2 text-[10px] text-text-p bg-bg px-2 py-0.5 rounded-md border border-card-border font-medium shadow-sm">
                                {record.workedHours} hrs
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-text-s">
                            {format(new Date(record.timestamp), 'MMM d, yyyy • hh:mm a')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-success">
                          <MapPin className="w-3 h-3" />
                          Site Verified
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <p className="text-text-s text-center py-8 text-sm">No attendance records found.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

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
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-text-s uppercase tracking-wider">Full Name</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} required />
                    </div>

                    <div className="pt-4 border-t border-card-border">
                      <h3 className="text-sm font-medium mb-4">Face Recognition Login</h3>
                      
                      {enrollStatus === 'idle' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-xl border border-card-border bg-card-bg">
                            <div className="flex items-center gap-3">
                              <ScanFace className="w-5 h-5 text-accent" />
                              <div>
                                <p className="text-sm font-medium">Face Login</p>
                                <p className="text-xs text-text-s">
                                  {user?.hasFaceDescriptor ? 'Configured' : 'Not configured'}
                                </p>
                              </div>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={startEnrollCamera}>
                              {user?.hasFaceDescriptor ? 'Update Scan' : 'Set Up'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {enrollStatus === 'camera' && (
                        <div className="flex flex-col items-center space-y-4 mt-4">
                          <div className="relative w-full aspect-square max-w-[240px] rounded-2xl overflow-hidden bg-black border border-card-border">
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
                          <div className="flex gap-3 w-full max-w-[240px]">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => { stopCamera(); setEnrollStatus('idle'); }}>
                              Cancel
                            </Button>
                            <Button type="button" className="flex-1 bg-accent hover:bg-accent/90 text-btn-text" onClick={handleEnrollCapture}>
                              <Camera className="w-4 h-4 mr-2" />
                              Capture
                            </Button>
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
                              const slipContent = `SALARY SLIP\n--------------------\nPeriod: ${slip.period}\nAmount: ₹${slip.amount}\nStatus: ${slip.status}\nIssued: ${format(new Date(slip.issuedAt), 'MMM d, yyyy')}\n${slip.notes ? `\nNotes: ${slip.notes}` : ''}`;
                              const blob = new Blob([slipContent], { type: 'text/plain' });
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Salary_Slip_${slip.period.replace(/ /g, '_')}.txt`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                            }}
                            className="bg-accent/10 border border-accent/20 text-accent text-[10px] px-3 py-1 font-semibold rounded hover:bg-accent/20 transition-colors uppercase"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {view === 'main' && status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className={`grid gap-4 ${(!history[0] || history[0].status !== 'clock-in') ? 'grid-cols-1' : 'grid-cols-1'}`}>
                {(!history[0] || history[0].status !== 'clock-in') ? (
                  <Button
                    size="lg"
                    className="h-32 flex-col gap-3 bg-success/10 text-success hover:bg-success/20 border border-success/20 w-full"
                    onClick={() => startCamera('clock-in')}
                  >
                    <MapPin className="w-8 h-8" />
                    <span>Clock In</span>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="h-32 flex-col gap-3 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 w-full"
                    onClick={() => startCamera('clock-out')}
                  >
                    <LogOut className="w-8 h-8" />
                    <span>Clock Out</span>
                  </Button>
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
          )}

          {view === 'main' && (status === 'processing' || status === 'success' || status === 'error') && (
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
