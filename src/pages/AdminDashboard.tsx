import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store';
import { socket } from '../lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { format } from 'date-fns';
import { Edit2, Trash2, X, LogOut, Filter, Download, Bell, AlertTriangle, Moon, Sun, CheckCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { googleSignIn, getAccessToken } from '../lib/firebase';
import { createAndPopulateSheet } from '../lib/googleSheets';
import { MonthlyAttendanceTable } from '../components/MonthlyAttendanceTable';
import { AttendanceTrendsChart } from '../components/AttendanceTrendsChart';

const UserAutocomplete = ({ users, value, onChange }: { users: any[], value: string, onChange: (val: string) => void }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedUser = users.find(u => u._id === value);
  const displayValue = isOpen ? search : (value === 'all' ? '' : (selectedUser ? selectedUser.name : ''));

  return (
    <div className="relative w-full flex-1 sm:w-48 sm:flex-none" ref={wrapperRef}>
      <Input
        type="text"
        placeholder={value === 'all' && !isOpen ? 'All Workers' : 'Search worker...'}
        value={displayValue}
        onFocus={() => { setIsOpen(true); setSearch(''); }}
        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        className="h-9 text-xs bg-bg pr-8"
      />
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-card-bg border border-card-border rounded-md shadow-lg max-h-48 overflow-y-auto">
           <div className="px-3 py-2 text-xs hover:bg-bg cursor-pointer" onClick={() => { onChange('all'); setSearch(''); setIsOpen(false); }}>
             All Workers
           </div>
           {users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())).map(u => (
             <div key={u._id} className="px-3 py-2 text-xs hover:bg-bg cursor-pointer" onClick={() => { onChange(u._id); setSearch(''); setIsOpen(false); }}>
               {u.name} <span className="text-text-s ml-1 font-mono">({u.email})</span>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default function AdminDashboard() {
  const { token, user, logout } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showNotificationToast, setShowNotificationToast] = useState<{message: string, show: boolean}>({message: '', show: false});
  const [toast, setToast] = useState<{message: string, type: 'error'|'success'|'info', show: boolean}>({message: '', type: 'info', show: false});
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  
  const showToastMsg = (message: string, type: 'error'|'success'|'info' = 'error') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast(prev => ({...prev, show: false})), 4000);
  };

  // Filtering state
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute Daily Hours per Worker
  const dailyWorkerHours = React.useMemo(() => {
    const summary: Record<string, { email: string, date: string, totalHours: number }> = {};
    attendance.forEach(record => {
      if (record.status === 'clock-out' && record.workedHours !== undefined) {
        const dateStr = new Date(record.timestamp).toLocaleDateString();
        const key = `${record.userId}-${dateStr}`;
        if (!summary[key]) {
          summary[key] = { email: record.userEmail, date: dateStr, totalHours: 0 };
        }
        summary[key].totalHours += record.workedHours;
      }
    });
    return Object.values(summary).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendance]);

  const weeklyChartData = React.useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const workerHours: Record<string, { name: string; hours: number }> = {};

    attendance.forEach(record => {
      const recordDate = new Date(record.timestamp);
      if (record.status === 'clock-out' && record.workedHours && recordDate >= sevenDaysAgo) {
        const user = users.find(u => u._id === record.userId);
        const name = user ? user.name : record.userEmail;
        if (!workerHours[name]) {
          workerHours[name] = { name, hours: 0 };
        }
        workerHours[name].hours += record.workedHours;
      }
    });

    return Object.values(workerHours)
      .map(item => ({ name: item.name, 'Total Hours': Number(item.hours.toFixed(2)) }))
      .sort((a, b) => b['Total Hours'] - a['Total Hours']);
  }, [attendance, users]);

  const [newEmail, setNewEmail] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newDailyWage, setNewDailyWage] = useState('');
  const [newOttHours, setNewOttHours] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', dailyWage: '', ottHours: '', mobile: '', employeeId: '' });
  const [editingAttendance, setEditingAttendance] = useState<any>(null);
  const [attendanceEditForm, setAttendanceEditForm] = useState({ status: '', timestamp: '', workedHours: '' });

  const [makingSalarySlipForUser, setMakingSalarySlipForUser] = useState<any>(null);
  const [salarySlipForm, setSalarySlipForm] = useState({ period: '', amount: '', notes: '' });

  const [passwordResetUser, setPasswordResetUser] = useState<any>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(document.documentElement.classList.contains('dark'));
  };
  
  const [editingSite, setEditingSite] = useState<any>(null);
  const [siteForm, setSiteForm] = useState({ name: '', lat: '', lng: '', radius: '100' });
  const [isAddingSite, setIsAddingSite] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAlerts();
    
    socket.connect();
    socket.on('attendance_update', (record) => {
      setAttendance((prev) => [record, ...prev].slice(0, 100));
    });

    socket.on('new_alert', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      setShowNotificationToast({ message: alert.message, show: true });
      setTimeout(() => setShowNotificationToast({ message: '', show: false }), 5000);
    });

    return () => {
      socket.off('attendance_update');
      socket.off('new_alert');
      socket.disconnect();
    };
  }, []);

  const canManageUsers = user?.role === 'admin';
  const canManageSites = user?.role === 'admin' || user?.role === 'manager';

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAlerts(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const markAlertAsRead = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, attRes, sitesRes, fetchbacksRes, galleryRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/attendance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/sites', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/feedback', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/gallery', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if ([usersRes, attRes, sitesRes].some(res => res.status === 401 || res.status === 403)) {
        logout();
        return;
      }
      
      if (usersRes.ok) setUsers(await usersRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
      if (sitesRes.ok) setSites(await sitesRes.json());
      if (fetchbacksRes.ok) setFeedbacks(await fetchbacksRes.json());
      if (galleryRes && galleryRes.ok) setGalleryImages(await galleryRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFilteredAttendance = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterUserId && filterUserId !== 'all') params.append('userId', filterUserId);

      const res = await fetch(`/api/attendance?${params.toString()}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.ok) setAttendance(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setIsFiltering(true);
    fetchFilteredAttendance();
  };

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterUserId('all');
    setIsFiltering(false);
    fetchData(); // Reset to default top 100
  };

  const handleAdminClockIn = async (userId: string) => {
    try {
      const res = await fetch('/api/attendance/admin-clockin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: userId })
      });
      if (res.ok) {
        fetchFilteredAttendance();
        setShowNotificationToast({ message: 'Successfully clocked in user.', show: true });
        setTimeout(() => setShowNotificationToast({ message: '', show: false }), 3000);
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to clock in user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminClockOut = async (userId: string) => {
    try {
      const res = await fetch('/api/attendance/admin-clockout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: userId })
      });
      if (res.ok) {
        fetchFilteredAttendance();
        setShowNotificationToast({ message: 'Successfully clocked out user.', show: true });
        setTimeout(() => setShowNotificationToast({ message: '', show: false }), 3000);
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to clock out user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToastMsg("Image size must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch('/api/gallery', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            title: file.name,
            imageUrl: reader.result
          })
        });

        if (res.ok) {
          const newImage = await res.json();
          setGalleryImages([newImage, ...galleryImages]);
          setShowNotificationToast({ message: 'Image uploaded successfully.', show: true });
          setTimeout(() => setShowNotificationToast({ message: '', show: false }), 3000);
        } else {
          const data = await res.json();
          showToastMsg(data.message || 'Failed to upload image');
        }
      } catch (err) {
        console.error(err);
        showToastMsg('Failed to upload image');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      const res = await fetch(`/api/gallery/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setGalleryImages(galleryImages.filter(img => img._id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendSalarySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      if (makingSalarySlipForUser.isBulk) {
        // Assume period implies the month for now, e.g., "YYYY-MM" if they type format correctly or we pass month
        // Let's pass period as the month for bulk, or user enters "YYYY-MM" in period field?
        // Let's inform the user to use 'YYYY-MM' format or we just use current month if period isn't matching format
        const match = salarySlipForm.period.match(/\d{4}-\d{2}/);
        const monthParam = match ? match[0] : new Date().toISOString().substring(0, 7);
        res = await fetch('/api/salary-slips/send-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            period: salarySlipForm.period,
            month: monthParam,
            notes: salarySlipForm.notes
          })
        });
      } else {
        res = await fetch('/api/salary-slips', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: makingSalarySlipForUser._id,
            period: salarySlipForm.period,
            amount: Number(salarySlipForm.amount),
            notes: salarySlipForm.notes
          })
        });
      }
      if (res.ok) {
        const data = await res.json();
        const msg = makingSalarySlipForUser.isBulk ? `Bulk: Generated ${data.count} slips.` : 'Salary slip issued!';
        setShowNotificationToast({ message: `${msg} Email sent if SMTP configured.`, show: true });
        setTimeout(() => setShowNotificationToast({ message: '', show: false }), 4000);
        
        if (!makingSalarySlipForUser.isBulk && makingSalarySlipForUser.mobile) {
            let finalMobile = makingSalarySlipForUser.mobile.replace(/\D/g, '');
            if (!finalMobile.startsWith('91') && finalMobile.length === 10) {
                finalMobile = '91' + finalMobile;
            }
            const waMsg = encodeURIComponent(`Hello ${makingSalarySlipForUser.name},\nYour salary slip for ${salarySlipForm.period} has been issued.\nAmount: ₹${salarySlipForm.amount}\n${salarySlipForm.notes ? `Notes: ${salarySlipForm.notes}\n` : ''}You can view the full slip on your dashboard.\n\nThank you.`);
            window.open(`https://wa.me/${finalMobile}?text=${waMsg}`, '_blank');
        }

        setMakingSalarySlipForUser(null);
        setSalarySlipForm({ period: '', amount: '', notes: '' });
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to send slip');
      }
    } catch (err) {
      console.error(err);
      showToastMsg('Failed to send salary slip');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmployeeId && !/^[a-zA-Z0-9]+$/.test(newEmployeeId)) {
      showToastMsg('Employee ID must be alphanumeric');
      return;
    }
    setCreating(true);
    try {
      const payload = { 
        email: newEmail, 
        mobile: newMobile,
        employeeId: newEmployeeId,
        password: newPassword, 
        name: newName, 
        role: newRole, 
        dailyWage: newDailyWage ? Number(newDailyWage) : 0,
        ottHours: newOttHours ? Number(newOttHours) : 0
      };
      
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewEmail('');
        setNewEmployeeId('');
        setNewMobile('');
        setNewPassword('');
        setNewName('');
        setNewRole('user');
        setNewDailyWage('');
        setNewOttHours('');
        fetchData(); // Refresh user list
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;
    try {
      const isNew = editingAttendance._isNew;
      
      const payload: any = {
        status: attendanceEditForm.status,
        timestamp: new Date(attendanceEditForm.timestamp).toISOString(),
        workedHours: attendanceEditForm.workedHours ? Number(attendanceEditForm.workedHours) : undefined
      };

      if (isNew) {
        payload.userId = editingAttendance.userId;
      }

      const url = isNew ? `/api/attendance/manual` : `/api/attendance/${editingAttendance._id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditingAttendance(null);
        fetchData();
        showToastMsg(`Attendance ${isNew ? 'created' : 'updated'} successfully`, 'success');
      } else {
        const data = await res.json();
        showToastMsg(data.message || `Failed to ${isNew ? 'create' : 'update'} attendance`);
      }
    } catch (err) {
      console.error(err);
      showToastMsg(`Error ${editingAttendance._isNew ? 'creating' : 'updating'} attendance`);
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        showToastMsg('Attendance record deleted', 'success');
        setEditingAttendance(null);
      } else {
        showToastMsg('Failed to delete record');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUser || !adminNewPassword) return;
    try {
      const res = await fetch('/api/admin/user-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: passwordResetUser._id, newPassword: adminNewPassword })
      });
      if (res.ok) {
        setPasswordResetUser(null);
        setAdminNewPassword('');
        setShowNotificationToast({ message: 'Password reset successfully', show: true });
        setTimeout(() => setShowNotificationToast({ message: '', show: false }), 3000);
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to update password');
      }
    } catch (err) {
      console.error(err);
      showToastMsg('Error updating password');
    }
  };

  const downloadAttendanceReport = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterUserId && filterUserId !== 'all') params.append('userId', filterUserId);
      
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.append('timezone', tz);

      const res = await fetch(`/api/reports/attendance/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to download report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `attendance_report_${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showToastMsg('Failed to download attendance report');
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const syncToGoogleSheets = async () => {
    setIsSyncing(true);
    try {
      // Get data
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (filterUserId && filterUserId !== 'all') params.append('userId', filterUserId);
      
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.append('timezone', tz);

      const res = await fetch(`/api/reports/attendance/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch report for sync');
      
      const csvData = await res.text();

      // Ensure user is authenticated with Google
      let accessToken = await getAccessToken();
      if (!accessToken) {
        const authResult = await googleSignIn();
        if (authResult?.accessToken) {
          accessToken = authResult.accessToken;
        } else {
          throw new Error('Google Sign-In failed or was cancelled.');
        }
      }

      // Create and populate sheet
      const title = `Attendance Report - ${new Date().toLocaleDateString()}`;
      const sheetUrl = await createAndPopulateSheet(accessToken, title, csvData);
      
      showToastMsg(`Successfully synced to Google Sheets!\n\nLink: ${sheetUrl}`, 'success');
      window.open(sheetUrl, '_blank');
    } catch (err) {
      console.error(err);
      showToastMsg('Error syncing to Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const startEditing = (user: any) => {
    setEditingUser(user);
    setEditForm({ 
      name: user.name || '', 
      email: user.email || '', 
      employeeId: user.employeeId || '',
      mobile: user.mobile || '',
      role: user.role || 'user',
      dailyWage: user.dailyWage !== undefined ? String(user.dailyWage) : '0',
      ottHours: user.ottHours !== undefined ? String(user.ottHours) : '0' 
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editForm.employeeId && !/^[a-zA-Z0-9]+$/.test(editForm.employeeId)) {
      showToastMsg('Employee ID must be alphanumeric');
      return;
    }
    try {
      const payload = {
        ...editForm,
        dailyWage: editForm.dailyWage ? Number(editForm.dailyWage) : 0,
        ottHours: editForm.ottHours ? Number(editForm.ottHours) : 0
      };

      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditingUser(null);
        fetchData();
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to update user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const downloadSalaryReport = async () => {
    try {
       const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
       // allow picking a custom month if user provides filterStartDate maybe?
       // For now, let's use the current month
       const monthParam = filterStartDate ? filterStartDate.substring(0, 7) : currentMonth;
       const res = await fetch(`/api/reports/salary?month=${monthParam}`, {
          headers: { Authorization: `Bearer ${token}` }
       });
       
       if (!res.ok) throw new Error("Failed to fetch report");
       
       const data = await res.json();
       const headers = ["Name", "Email", "Role", "Daily Wage", "Days Worked", "Total Salary"];
       const rows = data.map((r: any) => [
         `"${r.name || ''}"`, 
         `"${r.email || ''}"`, 
         r.role, 
         r.dailyWage, 
         r.daysWorked, 
         r.totalSalary
       ]);
       
       const csvContent = "data:text/csv;charset=utf-8," 
           + [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");
           
       const encodedUri = encodeURI(csvContent);
       const link = document.createElement("a");
       link.setAttribute("href", encodedUri);
       link.setAttribute("download", `Salary_Report_${monthParam}.csv`);
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    } catch(err) {
       console.error(err);
       showToastMsg("Failed to download salary report.");
    }
  };

  const syncSalaryReportToSheets = async () => {
    setIsSyncing(true);
    try {
       const currentMonth = new Date().toISOString().slice(0, 7);
       const monthParam = filterStartDate ? filterStartDate.substring(0, 7) : currentMonth;
       const res = await fetch(`/api/reports/salary?month=${monthParam}`, {
          headers: { Authorization: `Bearer ${token}` }
       });
       
       if (!res.ok) throw new Error("Failed to fetch report");
       
       const data = await res.json();
       const headers = ["Name", "Email", "Role", "Daily Wage", "Days Worked", "Total Salary"];
       const rows = data.map((r: any) => [
         `"${r.name || ''}"`, 
         `"${r.email || ''}"`, 
         r.role, 
         r.dailyWage, 
         r.daysWorked, 
         r.totalSalary
       ]);
       
       const csvData = [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");

       let accessToken = await getAccessToken();
       if (!accessToken) {
         const authResult = await googleSignIn();
         if (authResult?.accessToken) {
           accessToken = authResult.accessToken;
         } else {
           throw new Error('Google Sign-In failed or was cancelled.');
         }
       }

       const title = `Salary Report - ${monthParam}`;
       const sheetUrl = await createAndPopulateSheet(accessToken, title, csvData);
       
       showToastMsg(`Successfully synced Salary Report to Google Sheets!\n\nLink: ${sheetUrl}`, 'success');
       window.open(sheetUrl, '_blank');
    } catch (error) {
       console.error("Salary sync error:", error);
       showToastMsg("Could not sync salary report to Google Sheets");
    } finally {
       setIsSyncing(false);
    }
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: siteForm.name,
        lat: parseFloat(siteForm.lat),
        lng: parseFloat(siteForm.lng),
        radius: parseInt(siteForm.radius, 10)
      };

      const url = editingSite ? `/api/sites/${editingSite._id}` : '/api/sites';
      const method = editingSite ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setEditingSite(null);
        setIsAddingSite(false);
        fetchData();
      } else {
        const data = await res.json();
        showToastMsg(data.message || 'Failed to save site');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this site?')) return;
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const startEditingSite = (site: any) => {
    setEditingSite(site);
    setSiteForm({ name: site.name, lat: String(site.lat), lng: String(site.lng), radius: String(site.radius) });
    setIsAddingSite(true);
  };

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserTab, setSelectedUserTab] = useState('overview');

  const [userSalarySlips, setUserSalarySlips] = useState<any[]>([]);

  useEffect(() => {
    if (selectedUser && selectedUserTab === 'slips') {
      fetchUserSalarySlips(selectedUser._id);
    }
  }, [selectedUser, selectedUserTab]);

  const fetchUserSalarySlips = async (userId: string) => {
    try {
      const res = await fetch(`/api/salary-slips/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUserSalarySlips(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch user salary slips', e);
    }
  };

  const exportUserReport = async (userId: string, range?: '30-days' | 'previous-month' | 'this-month') => {
    try {
      const params = new URLSearchParams();
      params.append('userId', userId);
      
      if (range === 'previous-month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        params.append('startDate', start.toISOString());
        params.append('endDate', end.toISOString());
      } else if (range === 'this-month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        params.append('startDate', start.toISOString());
        params.append('endDate', end.toISOString());
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.append('timezone', tz);
      
      if (range === 'previous-month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        params.append('startDate', start.toISOString());
        params.append('endDate', end.toISOString());
      } else if (range === 'this-month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        params.append('startDate', start.toISOString());
        params.append('endDate', end.toISOString());
      }
      const res = await fetch(`/api/reports/attendance/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to download report');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `attendance_user_${userId}_${new Date().getTime()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showToastMsg('Failed to download attendance report for this user');
    }
  };

  const syncUserReportToSheets = async (userId: string, range?: '30-days' | 'previous-month' | 'this-month') => {
    setIsSyncing(true);
    try {
      const params = new URLSearchParams();
      params.append('userId', userId);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) params.append('timezone', tz);

      const res = await fetch(`/api/reports/attendance/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch user report for sync');
      
      const csvData = await res.text();

      let accessToken = await getAccessToken();
      if (!accessToken) {
        const authResult = await googleSignIn();
        if (authResult?.accessToken) {
          accessToken = authResult.accessToken;
        } else {
          throw new Error('Google Sign-In failed or was cancelled.');
        }
      }

      const userName = users.find(u => u._id === userId)?.name || 'Worker';
      const title = `${userName} - 30-Day Attendance - ${new Date().toLocaleDateString()}`;
      const sheetUrl = await createAndPopulateSheet(accessToken, title, csvData);
      
      showToastMsg(`Successfully synced ${userName}'s report to Google Sheets!\n\nLink: ${sheetUrl}`, 'success');
      window.open(sheetUrl, '_blank');
    } catch (err) {
      console.error(err);
      showToastMsg('Error syncing user report to Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const openAddSite = () => {
    setEditingSite(null);
    setSiteForm({ name: '', lat: '', lng: '', radius: '100' });
    setIsAddingSite(true);
  };

  const activeWorkers = attendance.filter(a => a.status === 'clock-in' && new Date(a.timestamp).toDateString() === new Date().toDateString()).length;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg text-text-p font-sans overflow-hidden">
      {/* Toast Notification for New Alerts */}
      <AnimatePresence>
        {showNotificationToast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 font-medium cursor-pointer"
            onClick={() => setIsAlertsOpen(true)}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{showNotificationToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-lg flex items-center gap-3 font-medium transition-colors ${
              toast.type === 'error' ? 'bg-red-500/90 text-white' : 
              toast.type === 'success' ? 'bg-success/90 text-white' : 
              'bg-card-bg border border-card-border text-text-p'
            }`}
          >
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm whitespace-pre-wrap">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-card-border bg-card-bg z-10">
        <a href="https://www.glassfabsystems.com/" target="_blank" rel="noopener noreferrer" className="text-[16px] font-extrabold tracking-tight text-accent uppercase hover:opacity-80 transition-opacity">Glass Fab System</a>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5 text-accent" />}
          </Button>
          <Button variant="ghost" size="icon" className="relative text-text-s" onClick={() => setIsAlertsOpen(true)}>
             <Bell className="w-5 h-5" />
             {alerts.filter(a => !a.read).length > 0 && (
               <span className="absolute top-1 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
             )}
          </Button>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-[240px] border-r border-card-border p-8 flex-col hidden md:flex">
        <a href="https://www.glassfabsystems.com/" target="_blank" rel="noopener noreferrer" className="text-[18px] font-extrabold tracking-tight text-accent mb-12 uppercase hover:opacity-80 transition-opacity">Glass Fab System</a>
        <div className="py-3 text-[14px] text-text-p font-semibold flex items-center gap-3 cursor-pointer">
          <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
          Overview
        </div>
        <div 
          className="py-3 text-[14px] text-text-s cursor-pointer flex items-center justify-between group hover:text-text-p transition-colors"
          onClick={() => setIsAlertsOpen(true)}
        >
          <div className="flex items-center gap-3">
             <Bell className="w-4 h-4" /> Alerts
          </div>
          {alerts.filter(a => !a.read).length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {alerts.filter(a => !a.read).length}
            </span>
          )}
        </div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Field Workers</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Site Geo-fencing</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Attendance Logs</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">System Health</div>
        <div className="mt-auto">
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center justify-between" onClick={toggleTheme}>
            <span className="flex items-center gap-3">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Theme 
            </span>
          </div>
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Settings</div>
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3" onClick={logout}>Logout</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight">Command Center</h1>
              <p className="text-[14px] text-text-s">Glass Fab System</p>
            </div>
            <div className="bg-success/10 border border-success/20 text-success px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              System Live
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: Takes up 2/3 of the space on large screens */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Bento 1: Stats */}
              <Card className="flex justify-around items-center p-0 py-6 bg-card-bg shadow-sm">
                <div className="text-center">
                  <div className="text-[36px] font-bold mb-1">{users.length}</div>
                  <div className="text-[12px] text-text-s">Total Users</div>
                </div>
                <div className="w-px h-10 bg-card-border"></div>
                <div className="text-center">
                  <div className="text-[36px] font-bold mb-1">{activeWorkers}</div>
                  <div className="text-[12px] text-text-s">Active Today</div>
                </div>
                <div className="w-px h-10 bg-card-border"></div>
                <div className="text-center">
                  <div className="text-[36px] font-bold mb-1 text-accent">99%</div>
                  <div className="text-[12px] text-text-s">Uptime</div>
                </div>
              </Card>

              {/* Manager Attendance Trends Component */}
              <AttendanceTrendsChart attendance={attendance} users={users} />

              {/* Bento 1.5: Weekly Attendance Overview */}
              <Card className="flex flex-col shadow-sm">
                <CardHeader className="pb-3 border-b border-card-border/50">
                  <CardTitle>Weekly Attendance Overview (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {weeklyChartData.length > 0 ? (
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-card-border)" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 10, fill: 'var(--theme-text-s)' }} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: 'var(--theme-text-s)' }} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip 
                            cursor={{ fill: 'var(--theme-bg)' }}
                            contentStyle={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', borderRadius: '6px', fontSize: '12px', color: 'var(--theme-text-p)' }}
                          />
                          <Bar 
                            dataKey="Total Hours" 
                            fill="var(--theme-accent)" 
                            radius={[4, 4, 0, 0]} 
                            barSize={30}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-text-s text-sm">
                      No attendance data for the last 7 days.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bento 2: Live Activity Feed & Filters */}
              <Card className="flex flex-col h-[450px] shadow-sm">
                <CardHeader className="pb-3 border-b border-card-border/50">
                  <CardTitle>{isFiltering ? 'Filtered Records' : 'Live Activity Feed'}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 overflow-hidden p-0">
                  {/* Filters Section */}
                  <div className="px-6 py-4 border-b border-card-border bg-card-bg/50">
                    <form onSubmit={applyFilters} className="flex flex-col sm:flex-row gap-3">
                      <div className="flex gap-2 flex-col sm:flex-row flex-1">
                        <div className="flex items-center gap-2 bg-bg border border-card-border rounded-md px-2 h-9 flex-1 group focus-within:ring-1 focus-within:ring-accent/20 focus-within:border-accent/40 transition-shadow">
                          <input 
                              type="date" 
                              className="bg-transparent text-xs outline-none text-text-p flex-1 min-w-[100px] cursor-pointer" 
                              value={filterStartDate}
                              onChange={e => setFilterStartDate(e.target.value)}
                              title="Start Date"
                          />
                          <span className="text-text-s text-xs font-mono">-</span>
                          <input 
                              type="date" 
                              className="bg-transparent text-xs outline-none text-text-p flex-1 min-w-[100px] cursor-pointer" 
                              value={filterEndDate}
                              onChange={e => setFilterEndDate(e.target.value)}
                              title="End Date"
                          />
                        </div>
                        <UserAutocomplete 
                          users={users} 
                          value={filterUserId} 
                          onChange={(val) => setFilterUserId(val)} 
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" className="h-9 px-4 text-xs bg-accent/10 text-accent hover:bg-accent/20">
                          <Filter className="w-3.5 h-3.5 mr-1" /> Filter
                        </Button>
                        <Button type="button" size="sm" onClick={downloadAttendanceReport} className="h-9 px-4 text-xs bg-success/10 text-success hover:bg-success/20">
                          <Download className="w-3.5 h-3.5 mr-1" /> Export
                        </Button>
                        <Button type="button" size="sm" onClick={syncToGoogleSheets} disabled={isSyncing} className="h-9 px-4 text-xs bg-success/10 text-success hover:bg-success/20">
                          <FileText className="w-3.5 h-3.5 mr-1" /> {isSyncing ? 'Syncing...' : 'Sync to Sheets'}
                        </Button>
                        {isFiltering && (
                          <Button type="button" size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={clearFilters}>
                            Clear
                          </Button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Feed Content */}
                  <div className="flex-1 overflow-y-auto px-6">
                    <div className="space-y-0">
                      {attendance.map((record, i) => (
                        <div key={record._id || i} className="flex items-center gap-3 py-3 border-b border-card-border last:border-0 hover:bg-card-border/10 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                          {record.userEmail.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div className="text-[14px] font-medium truncate">{record.userEmail}</div>
                            <div className="text-[11px] text-text-s whitespace-nowrap">
                              {format(new Date(record.timestamp), 'MMM dd, hh:mm a')}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2">
                              <div className="text-[12px] text-text-s truncate">
                                {record.status === 'clock-in' ? (
                                  <span className="text-success font-medium">Clocked In</span>
                                ) : (
                                  <span className="text-red-400 font-medium">Clocked Out</span>
                                )}
                              </div>
                              {record.workedHours !== undefined && (
                                <div className="text-[10px] text-text-p bg-bg px-2 py-0.5 rounded-md border border-card-border font-medium shadow-sm">
                                  {record.workedHours} hrs
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {record.faceConfidence !== undefined && record.faceConfidence > 0 && record.faceConfidence < 0.65 ? (
                                <div className="flex items-center gap-1.5 text-[10px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded pl-1 border border-orange-400/20" title="Low face recognition confidence">
                                  <AlertTriangle className="w-3 h-3" />
                                  Face Mismatch ({(record.faceConfidence * 100).toFixed(0)}%)
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 px-2 py-0.5 rounded pl-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                                  Verified
                                </div>
                              )}
                              {(user?.role === 'admin' || user?.role === 'manager') && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-text-s hover:text-accent ml-2" onClick={() => {
                                  setEditingAttendance(record);
                                  setAttendanceEditForm({
                                    status: record.status,
                                    timestamp: new Date(record.timestamp).toISOString().slice(0, 16),
                                    workedHours: record.workedHours?.toString() || ''
                                  });
                                }}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {attendance.length === 0 && <p className="text-text-s text-center py-8 text-sm">No recent activity detected</p>}
                  </div>
                </div>
                </CardContent>
              </Card>

              {/* Bento 3: Site Geo-fences */}
              <Card className="flex flex-col shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-card-border/50">
                  <CardTitle>Site Geo-fences</CardTitle>
                  {canManageSites && (
                    <Button variant="ghost" size="sm" onClick={openAddSite} className="h-8 px-3 text-xs bg-accent hover:bg-accent/90 text-btn-text shadow-sm font-semibold">
                      + Create Site
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto px-6 py-2 pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {sites.map((s) => (
                      <div key={s._id} className="flex relative items-start justify-between p-4 border border-card-border bg-bg/50 rounded-xl group hover:border-accent/40 transition-colors">
                        <div>
                          <p className="font-semibold text-[14px] mb-1">{s.name}</p>
                          <p className="text-[11px] text-text-s font-mono flex flex-col gap-0.5">
                            <span>Lat: {s.lat.toFixed(4)}</span>
                            <span>Lng: {s.lng.toFixed(4)}</span>
                            <span className="text-accent/80 mt-1">Radius: {s.radius}m</span>
                          </p>
                        </div>
                        {canManageSites && (
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditingSite(s)} className="p-1.5 hover:bg-card-bg border border-transparent hover:border-card-border rounded-lg text-text-s hover:text-accent transition-colors shadow-sm">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteSite(s._id)} className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-text-s hover:text-red-400 transition-colors shadow-sm">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {sites.length === 0 && <p className="text-text-s col-span-full text-center py-4 text-xs bg-bg/50 rounded-xl border border-dashed border-card-border">No sites currently configured.</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Bento 3.5: User Feedback Feed */}
              <Card className="flex flex-col h-[300px] shadow-sm">
                <CardHeader className="pb-3 border-b border-card-border/50">
                  <CardTitle>Worker Feedback</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto px-6 py-0">
                  <div className="space-y-0">
                    {feedbacks.length === 0 && <p className="text-text-s text-center py-8 text-sm">No feedback received yet</p>}
                    {feedbacks.map((fb, i) => (
                      <div key={fb._id || i} className="py-4 border-b border-card-border last:border-0 hover:bg-card-border/10 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-semibold text-sm">{fb.userName || 'Unknown User'}</p>
                          <span className="text-xs text-text-s">{format(new Date(fb.timestamp), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="text-xs text-accent mb-2 font-mono">Rating: {fb.rating}/5</div>
                        <p className="text-xs text-text-p leading-relaxed">{fb.feedback}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Bento Gallery: Documentations & Images */}
              <Card className="flex flex-col shadow-sm min-h-[300px]">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-card-border/50">
                  <CardTitle>Project Gallery</CardTitle>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        accept="image/*"
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={uploadingImage}
                        className="h-8 px-3 text-xs bg-accent hover:bg-accent/90 text-btn-text shadow-sm font-semibold"
                      >
                        {uploadingImage ? 'Uploading...' : '+ Upload Image'}
                      </Button>
                    </>
                  )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto px-6 py-6 border-bg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {galleryImages.map(img => (
                      <div key={img._id} className="relative group aspect-square rounded-xl overflow-hidden border border-card-border bg-bg/50">
                        <img 
                          src={img.imageUrl} 
                          alt={img.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                          <p className="text-white text-xs font-bold truncate w-full pointer-events-auto">{img.title}</p>
                          <p className="text-white/70 text-[10px] pointer-events-auto">{img.uploadedBy?.name || 'Admin'}</p>
                        </div>
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                          <button 
                            className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            onClick={() => handleDeleteImage(img._id)}
                            title="Delete Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {galleryImages.length === 0 && (
                      <div className="col-span-full py-12 text-center text-text-s text-sm border-2 border-dashed border-card-border rounded-xl">
                        No images in the gallery.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Bento: Monthly Attendance Statistics */}
              <MonthlyAttendanceTable />

            </div>

            {/* RIGHT COLUMN: Takes up 1/3 of the space */}
            <div className="lg:col-span-1 flex flex-col gap-6">

              {/* Bento 4: Add User Form (Only for admins) */}
              {canManageUsers && (
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-card-border/50 pb-3">
                    <CardTitle>Onboard New Worker</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <form onSubmit={handleCreateUser} className="space-y-3">
                      <Input 
                        placeholder="Full Name" 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)} 
                        required 
                        className="h-10 text-xs bg-bg"
                      />
                      <Input 
                        placeholder="Employee ID (Optional)" 
                        value={newEmployeeId} 
                        onChange={e => setNewEmployeeId(e.target.value)} 
                        className="h-10 text-xs bg-bg"
                      />
                      <Input 
                        type="email" 
                        placeholder="Email Address" 
                        value={newEmail} 
                        onChange={e => setNewEmail(e.target.value)} 
                        required 
                        className="h-10 text-xs bg-bg"
                      />
                      <Input 
                        type="tel" 
                        placeholder="Mobile Number (Optional)" 
                        value={newMobile} 
                        onChange={e => setNewMobile(e.target.value)} 
                        className="h-10 text-xs bg-bg"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input 
                          type="password" 
                          placeholder="Initial Password" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          required 
                          className="h-10 text-xs bg-bg"
                        />
                        <select
                           value={newRole}
                           onChange={e => setNewRole(e.target.value)}
                           className="flex h-10 w-full rounded-md border border-input bg-bg px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                           <option value="user">Worker</option>
                           <option value="supervisor">Supervisor</option>
                           <option value="manager">Manager</option>
                           <option value="admin">System Admin</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="Daily Wage (₹)" 
                          value={newDailyWage} 
                          onChange={e => setNewDailyWage(e.target.value)} 
                          className="h-10 text-xs bg-bg"
                        />
                        <Input 
                          type="number" 
                          step="any"
                          placeholder="Max OTT Hours" 
                          value={newOttHours} 
                          onChange={e => setNewOttHours(e.target.value)} 
                          className="h-10 text-xs bg-bg"
                        />
                      </div>
                      <Button type="submit" className="w-full h-10 text-xs mt-2" disabled={creating}>
                        {creating ? 'Provisioning...' : 'Provision Account'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Bento 5: Personnel */}
              <Card className="flex flex-col flex-1 min-h-[400px] shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-card-border/50">
                  <CardTitle>Personnel Registry</CardTitle>
                  {(user?.role === 'admin' || user?.role === 'manager') && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setMakingSalarySlipForUser({ name: 'All Workers', isBulk: true })} className="h-8 px-3 text-[10px] text-accent hover:bg-accent/10 border-accent/30 shadow-sm" title="Issue Salary Slips to All">
                        <FileText className="w-3.5 h-3.5 mr-1.5" /> BULK ISSUE
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadSalaryReport} className="h-8 px-3 text-[10px] text-text-p hover:text-accent hover:border-accent/50 shadow-sm" title="Download Salary CSV">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> EXPORT
                      </Button>
                      <Button variant="outline" size="sm" onClick={syncSalaryReportToSheets} disabled={isSyncing} className="h-8 px-3 text-[10px] text-success hover:bg-success/10 border-success/30 shadow-sm" title="Sync to Google Sheets">
                        <FileText className="w-3.5 h-3.5 mr-1.5" /> {isSyncing ? 'SYNCING...' : 'SYNC TO SHEETS'}
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto px-0 py-0">
                  <div className="space-y-0">
                    {users.map((u) => (
                      <div key={u._id} className="flex items-center justify-between px-6 py-4 border-b border-card-border last:border-0 group hover:bg-card-border/10 transition-colors cursor-pointer" onClick={() => { setSelectedUser(u); setSelectedUserTab('overview'); }}>
                        <div className="flex items-center gap-3">
                          {u.profilePhoto ? (
                            <img src={u.profilePhoto} alt={u.name} className="w-10 h-10 rounded-full border-2 border-accent/20 object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full border-2 border-card-border bg-card-bg flex items-center justify-center text-text-s font-bold flex-shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-[14px] flex items-center gap-2 group-hover:text-accent transition-colors">
                              {u.name}
                              <span className="text-[9px] uppercase tracking-wider bg-accent/10 border border-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">
                                {u.role}
                              </span>
                              {u.employeeId && (
                                <span className="text-[9px] text-text-p bg-bg border border-card-border px-1.5 py-0.5 rounded font-mono shadow-sm">
                                  ID: {u.employeeId}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-text-s mt-0.5">{u.email}</p>
                            <div className="flex gap-2 mt-1">
                              {u.dailyWage > 0 && <span className="text-[10px] text-success/80 font-mono">₹{u.dailyWage}/day</span>}
                              {u.ottHours > 0 && <span className="text-[10px] text-accent font-mono">{u.ottHours}h OTT</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedUser(u); setSelectedUserTab('overview'); }} className="p-1.5 text-text-s hover:text-accent transition-colors bg-bg border border-card-border rounded-lg shadow-sm font-semibold text-xs px-3">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Bento 6: Daily Hours Summary */}
              <Card className="flex flex-col shadow-sm max-h-[350px]">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-card-border/50">
                  <CardTitle>Daily Hours Summary</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto px-0 py-0">
                  <div className="space-y-0">
                    {dailyWorkerHours.map((record, i) => (
                      <div key={i} className="flex flex-col justify-center px-6 py-3 border-b border-card-border last:border-0 group hover:bg-card-border/10 transition-colors">
                        <div className="flex justify-between items-center w-full">
                          <p className="font-semibold text-[13px] truncate flex-1">{record.email}</p>
                          <div className="text-[12px] font-mono font-bold bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-md text-accent ml-3 shadow-sm">
                            {record.totalHours.toFixed(2)} hrs
                          </div>
                        </div>
                        <p className="text-[11px] text-text-s mt-1">{record.date}</p>
                      </div>
                    ))}
                    {dailyWorkerHours.length === 0 && (
                      <p className="text-text-s text-center py-6 text-[13px]">No completed multi-hour work shifts today.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>



        </div>
      </div>

      {/* Attendance Edit Modal */}
      {editingAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="text-lg font-bold">Edit Attendance Record</h2>
              <button onClick={() => setEditingAttendance(null)} className="text-text-s hover:text-text-p">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAttendance} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Status</label>
                <select 
                  className="w-full bg-bg border border-card-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-accent outline-none"
                  value={attendanceEditForm.status}
                  onChange={(e) => setAttendanceEditForm({...attendanceEditForm, status: e.target.value})}
                >
                  <option value="clock-in">Clock In</option>
                  <option value="clock-out">Clock Out</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Timestamp</label>
                <Input 
                  type="datetime-local" 
                  value={attendanceEditForm.timestamp}
                  onChange={(e) => setAttendanceEditForm({...attendanceEditForm, timestamp: e.target.value})}
                  required 
                />
              </div>
              {attendanceEditForm.status === 'clock-out' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-s uppercase tracking-wider">Worked Hours (Optional)</label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 8.5"
                    value={attendanceEditForm.workedHours}
                    onChange={(e) => setAttendanceEditForm({...attendanceEditForm, workedHours: e.target.value})}
                  />
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                {!editingAttendance._isNew ? (
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="text-red-500 hover:bg-red-500/10 hover:text-red-600 px-3" 
                    onClick={() => handleDeleteAttendance(editingAttendance._id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingAttendance(null)}>Cancel</Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90 text-btn-text">{editingAttendance._isNew ? 'Create Record' : 'Save Changes'}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="text-lg font-bold">Reset Password</h2>
              <button onClick={() => setPasswordResetUser(null)} className="text-text-s hover:text-text-p">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdminResetPassword} className="p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-text-s mb-4">Set a new password for <strong className="text-text-p">{passwordResetUser.name}</strong> ({passwordResetUser.email}).</p>
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">New Password</label>
                <Input 
                  type="text" 
                  value={adminNewPassword} 
                  onChange={e => setAdminNewPassword(e.target.value)} 
                  required 
                  placeholder="Enter new password"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setPasswordResetUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-warning/20 hover:bg-warning/30 text-warning">
                  Reset Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary Slip Modal */}
      {makingSalarySlipForUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="text-lg font-bold">Issue Salary Slip</h2>
              <button onClick={() => setMakingSalarySlipForUser(null)} className="text-text-s hover:text-text-p">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSendSalarySlip} className="p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-text-s mb-4">You are generating a salary slip for <strong className="text-text-p">{makingSalarySlipForUser.name}</strong>.</p>
                {!makingSalarySlipForUser.isBulk && (
                    <p className={`text-xs p-2 rounded ${makingSalarySlipForUser.mobile ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                       {makingSalarySlipForUser.mobile ? `Will open WhatsApp after generating (${makingSalarySlipForUser.mobile})` : 'User has no mobile number recorded, cannot send WhatsApp.'}
                    </p>
                )}
                {makingSalarySlipForUser.isBulk && (
                  <p className="text-xs text-accent bg-accent/10 p-2 rounded">
                    Amounts will be calculated automatically based on days worked and daily wage in the given month. For best results, use YYYY-MM format like '2026-04'.
                  </p>
                )}
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Period / Month</label>
                <Input 
                  type="text" 
                  placeholder={makingSalarySlipForUser.isBulk ? "e.g. 2026-04" : "e.g. April 2026"}
                  value={salarySlipForm.period} 
                  onChange={e => setSalarySlipForm({...salarySlipForm, period: e.target.value})} 
                  required 
                />
              </div>
              {!makingSalarySlipForUser.isBulk && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-s uppercase tracking-wider">Total Amount (₹)</label>
                  <Input 
                    type="number" 
                    step="any"
                    placeholder="e.g. 15000"
                    value={salarySlipForm.amount} 
                    onChange={e => setSalarySlipForm({...salarySlipForm, amount: e.target.value})} 
                    required={!makingSalarySlipForUser.isBulk}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Additional Notes (Optional)</label>
                <Input 
                  type="text" 
                  placeholder="Performance bonus, deductions, etc."
                  value={salarySlipForm.notes} 
                  onChange={e => setSalarySlipForm({...salarySlipForm, notes: e.target.value})} 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setMakingSalarySlipForUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-success/20 hover:bg-success/30 text-success">
                  Send Slip
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="text-lg font-bold">Worker Profile</h2>
              <button onClick={() => setSelectedUser(null)} className="text-text-s flex items-center justify-center p-2 rounded-full hover:bg-card-border/50 hover:text-text-p transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex bg-card-bg border-b border-card-border overflow-x-auto no-scrollbar">
              {['overview', 'actions', 'records', 'slips'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setSelectedUserTab(tab)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 ${selectedUserTab === tab ? 'border-accent text-accent' : 'border-transparent text-text-s hover:text-text-p'}`}
                >
                  {tab === 'records' ? 'Logs' : tab === 'slips' ? 'Salary Slips' : tab}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Profile Header */}
              <div className="flex items-start gap-4 border border-card-border bg-card-bg p-4 rounded-xl">
                 {selectedUser.profilePhoto ? (
                   <img src={selectedUser.profilePhoto} alt={selectedUser.name} className="w-16 h-16 rounded-full border border-card-border object-cover bg-bg flex-shrink-0" />
                 ) : (
                   <div className="w-16 h-16 rounded-full border border-card-border bg-bg flex items-center justify-center text-text-s font-bold text-2xl flex-shrink-0">
                     {selectedUser.name.charAt(0).toUpperCase()}
                   </div>
                 )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold truncate flex items-center gap-2">
                    {selectedUser.name}
                    <span className="text-[10px] uppercase tracking-wider bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded font-mono">
                      {selectedUser.role}
                    </span>
                    {selectedUser.employeeId && (
                      <span className="text-[10px] uppercase tracking-wider bg-bg border border-card-border text-text-p px-2 py-0.5 rounded font-mono shadow-sm">
                        ID: {selectedUser.employeeId}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-text-s mt-1 truncate">{selectedUser.email}</p>
                  
                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="bg-bg border border-card-border px-3 py-1.5 rounded-lg">
                      <p className="text-[10px] text-text-s uppercase tracking-wider mb-0.5">Daily Wage</p>
                      <p className="text-sm font-semibold font-mono">₹{selectedUser.dailyWage || 0}</p>
                    </div>
                    <div className="bg-bg border border-card-border px-3 py-1.5 rounded-lg">
                      <p className="text-[10px] text-text-s uppercase tracking-wider mb-0.5">OTT Allow</p>
                      <p className="text-sm font-semibold font-mono text-accent">{selectedUser.ottHours || 0} hrs</p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedUserTab === 'overview' && (
                <>
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-text-s uppercase tracking-wider">Reports & Data</h4>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 justify-center gap-1.5 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 text-xs px-2"
                          onClick={() => exportUserReport(selectedUser._id, '30-days')}
                        >
                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                          30 Days
                        </Button>
                        <Button 
                          className="flex-1 justify-center gap-1.5 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 text-xs px-2"
                          onClick={() => exportUserReport(selectedUser._id, 'previous-month')}
                        >
                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                          Prev Month
                        </Button>
                      </div>
                      <Button 
                        className="w-full justify-center gap-3 bg-success/10 text-success hover:bg-success/20 border border-success/20"
                        onClick={() => syncUserReportToSheets(selectedUser._id, '30-days')}
                        disabled={isSyncing}
                      >
                        <FileText className="w-4 h-4" />
                        {isSyncing ? 'Syncing...' : 'Sync to Google Sheets'}
                      </Button>
                    </div>
                  </div>

                  {/* Quick Log Overview */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-text-s uppercase tracking-wider">Recent Activity Overview</h4>
                    <div className="border border-card-border rounded-xl bg-card-bg/50 divide-y divide-card-border">
                      {attendance.filter(a => a.userId === selectedUser._id).slice(0, 5).map((record, i) => (
                        <div key={i} className="flex justify-between items-center p-3">
                          <div>
                            <p className={`text-xs font-medium ${record.status === 'clock-in' ? 'text-success' : 'text-red-400'}`}>
                              {record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out'}
                            </p>
                            <p className="text-[10px] text-text-s mt-0.5">{format(new Date(record.timestamp), 'MMM dd, yyyy hh:mm a')}</p>
                          </div>
                          {record.workedHours !== undefined && (
                            <div className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                              {record.workedHours} hrs
                            </div>
                          )}
                        </div>
                      ))}
                      {attendance.filter(a => a.userId === selectedUser._id).length === 0 && (
                        <div className="p-4 text-center text-xs text-text-s">No recent activity detected</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {selectedUserTab === 'actions' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-text-s uppercase tracking-wider">Administration Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {!attendance.some(a => a.userId === selectedUser._id && a.status === 'clock-in' && new Date(a.timestamp).toDateString() === new Date().toDateString()) ? (
                      <Button variant="outline" className="justify-start gap-2 border-success/30 text-success hover:bg-success/10" onClick={() => handleAdminClockIn(selectedUser._id)}>
                        <CheckCircle className="w-4 h-4" /> Force Clock In
                      </Button>
                    ) : (
                      <Button variant="outline" className="justify-start gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10" onClick={() => handleAdminClockOut(selectedUser._id)}>
                        <LogOut className="w-4 h-4" /> Force Clock Out
                      </Button>
                    )}
                    
                    <Button variant="outline" className="justify-start gap-2 border-card-border hover:bg-card-border/20" onClick={() => {
                      setSelectedUser(null);
                      startEditing(selectedUser);
                    }}>
                      <Edit2 className="w-4 h-4" /> Edit Details
                    </Button>
                    
                    <Button variant="outline" className="justify-start gap-2 border-card-border hover:bg-card-border/20" onClick={() => {
                      setSelectedUser(null);
                      setMakingSalarySlipForUser(selectedUser);
                    }}>
                      <FileText className="w-4 h-4" /> Issue Salary Slip
                    </Button>

                    <Button variant="outline" className="justify-start gap-2 border-card-border hover:bg-warning/10 text-warning" onClick={() => {
                      setSelectedUser(null);
                      setPasswordResetUser(selectedUser);
                    }}>
                      <LogOut className="w-4 h-4" style={{transform: "rotate(-90deg)"}} /> Reset Password
                    </Button>

                    <Button variant="outline" className="justify-start gap-2 border-red-500/30 hover:bg-red-500/10 text-red-500" onClick={() => {
                      setSelectedUser(null);
                      handleDeleteUser(selectedUser._id);
                    }}>
                      <Trash2 className="w-4 h-4" /> Delete Worker
                    </Button>
                  </div>
                </div>
              )}

              {selectedUserTab === 'records' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold text-text-s uppercase tracking-wider">Full Attendance Log</h4>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-accent/10 text-accent hover:bg-accent/20" onClick={() => {
                        setEditingAttendance({ userId: selectedUser._id, _isNew: true });
                        setAttendanceEditForm({
                          status: 'clock-in',
                          timestamp: new Date().toISOString().slice(0, 16),
                          workedHours: ''
                        });
                      }}>
                        + Add Record
                      </Button>
                    )}
                  </div>
                  <div className="border border-card-border rounded-xl bg-card-bg/50 divide-y divide-card-border max-h-[300px] overflow-y-auto">
                      {attendance.filter(a => a.userId === selectedUser._id).map((record, i) => (
                        <div key={i} className="flex justify-between items-center p-3 hover:bg-card-border/10 transition-colors">
                          <div>
                            <p className={`text-[13px] font-medium ${record.status === 'clock-in' ? 'text-success' : 'text-red-400'}`}>
                              {record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out'}
                            </p>
                            <p className="text-[11px] text-text-s mt-0.5">{format(new Date(record.timestamp), 'MMM dd, yyyy hh:mm a')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.faceConfidence !== undefined && record.faceConfidence > 0 && record.faceConfidence < 0.65 && (
                                <div className="text-[10px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded border border-orange-400/20 shadow-sm flex items-center gap-1" title="Low face recognition confidence">
                                  <AlertTriangle className="w-3 h-3" />
                                  {(record.faceConfidence * 100).toFixed(0)}%
                                </div>
                            )}
                            {record.workedHours !== undefined && (
                              <div className="text-[11px] font-mono font-bold text-accent bg-accent/10 flex items-center justify-center px-2 py-0.5 rounded border border-accent/20 shadow-sm">
                                {record.workedHours} hrs
                              </div>
                            )}
                            {(user?.role === 'admin' || user?.role === 'manager') && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-text-s hover:text-accent ml-2" onClick={() => {
                                setEditingAttendance(record);
                                setAttendanceEditForm({
                                  status: record.status,
                                  timestamp: new Date(record.timestamp).toISOString().slice(0, 16),
                                  workedHours: record.workedHours?.toString() || ''
                                });
                              }}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {attendance.filter(a => a.userId === selectedUser._id).length === 0 && (
                        <div className="p-8 text-center text-sm text-text-s">No logs available</div>
                      )}
                  </div>
                </div>
              )}

              {selectedUserTab === 'slips' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-text-s uppercase tracking-wider">Issued Salary Slips</h4>
                  <div className="border border-card-border rounded-xl bg-card-bg/50 divide-y divide-card-border max-h-[300px] overflow-y-auto">
                      {userSalarySlips.map((slip, i) => (
                        <div key={i} className="flex justify-between items-center p-3 hover:bg-card-border/10 transition-colors">
                          <div>
                            <p className="text-[13px] font-bold">{slip.period}</p>
                            <p className="text-[11px] text-text-s mt-0.5">₹{slip.amount} • Issued {format(new Date(slip.issuedAt), 'MMM dd, yyyy')}</p>
                            {slip.notes && <p className="text-[10px] text-text-s mt-0.5 italic">{slip.notes}</p>}
                          </div>
                          <div>
                            {selectedUser.mobile && (
                              <Button
                                size="sm"
                                className="h-7 text-[10px] px-2 bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20"
                                onClick={() => {
                                  let finalMobile = selectedUser.mobile.replace(/\D/g, '');
                                  if (!finalMobile.startsWith('91') && finalMobile.length === 10) {
                                      finalMobile = '91' + finalMobile;
                                  }
                                  const msg = encodeURIComponent(`Hello ${selectedUser.name},\nYour salary slip for ${slip.period} has been issued.\nAmount: ₹${slip.amount}\n${slip.notes ? `Notes: ${slip.notes}\n` : ''}You can view the full slip on your dashboard.\n\nThank you.`);
                                  window.open(`https://wa.me/${finalMobile}?text=${msg}`, '_blank');
                                }}
                              >
                                WhatsApp
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      {userSalarySlips.length === 0 && (
                        <div className="p-8 text-center text-sm text-text-s">No slips available</div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="text-lg font-bold">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-text-s hover:text-text-p">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Full Name</label>
                <Input 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Employee ID</label>
                <Input 
                  placeholder="Unique Alphanumeric ID (e.g. EMP123)" 
                  value={editForm.employeeId} 
                  onChange={e => setEditForm({...editForm, employeeId: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Email Address</label>
                <Input 
                  type="email" 
                  value={editForm.email} 
                  onChange={e => setEditForm({...editForm, email: e.target.value})} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Mobile Number (Optional)</label>
                <Input 
                  type="tel" 
                  value={editForm.mobile} 
                  onChange={e => setEditForm({...editForm, mobile: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Role</label>
                <select 
                  className="flex h-12 w-full rounded-xl border border-card-border bg-card-bg px-4 py-2 text-sm text-text-p focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                  value={editForm.role}
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                >
                  <option value="user">User (Field Worker)</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Daily Wage (₹)</label>
                <Input 
                  type="number" 
                  step="any"
                  value={editForm.dailyWage} 
                  onChange={e => setEditForm({...editForm, dailyWage: e.target.value})} 
                />
              </div>
              <div className="space-y-2 mt-3">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Max OTT Hours</label>
                <Input 
                  type="number" 
                  step="any"
                  value={editForm.ottHours} 
                  onChange={e => setEditForm({...editForm, ottHours: e.target.value})} 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-accent hover:bg-accent/90 text-btn-text">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Site Modal */}
      {isAddingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg border border-card-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-card-border">
              <h2 className="text-lg font-bold">{editingSite ? 'Edit Site' : 'Add New Site'}</h2>
              <button onClick={() => setIsAddingSite(false)} className="text-text-s hover:text-text-p">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSite} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Site Name</label>
                <Input 
                  value={siteForm.name} 
                  onChange={e => setSiteForm({...siteForm, name: e.target.value})} 
                  required 
                  placeholder="e.g. Downtown Highrise"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-s uppercase tracking-wider">Latitude</label>
                  <Input 
                    type="number" 
                    step="any"
                    value={siteForm.lat} 
                    onChange={e => setSiteForm({...siteForm, lat: e.target.value})} 
                    required 
                    placeholder="37.7749"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-text-s uppercase tracking-wider">Longitude</label>
                  <Input 
                    type="number" 
                    step="any"
                    value={siteForm.lng} 
                    onChange={e => setSiteForm({...siteForm, lng: e.target.value})} 
                    required 
                    placeholder="-122.4194"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Radius (Meters)</label>
                <Input 
                  type="number" 
                  value={siteForm.radius} 
                  onChange={e => setSiteForm({...siteForm, radius: e.target.value})} 
                  required 
                  min="10"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddingSite(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-accent hover:bg-accent/90 text-btn-text">
                  {editingSite ? 'Save Changes' : 'Create Site'}
              </Button>
            </div>
          </form>
        </div>
      </div>
     )}

      {/* Alerts Modal */}
      {isAlertsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="flex flex-col bg-bg border border-card-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-card-border bg-card-bg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold">System Alerts</h2>
              </div>
              <button onClick={() => setIsAlertsOpen(false)} className="text-text-s hover:text-text-p">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
               {alerts.length === 0 ? (
                 <div className="p-8 text-center text-text-s text-sm">No recent alerts.</div>
               ) : (
                 <div className="divide-y divide-card-border">
                   {alerts.map(alert => (
                     <div 
                       key={alert._id} 
                       className={`p-5 flex items-start gap-4 transition-colors ${alert.read ? 'bg-bg/50' : 'bg-red-500/5'}`}
                     >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${alert.read ? 'bg-card-border text-text-s' : 'bg-red-500/20 text-red-500'}`}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${alert.read ? 'text-text-s' : 'text-text-p font-medium'}`}>
                            {alert.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                             <span className="text-[11px] text-text-s flex items-center gap-2">
                               {alert.userEmail && <span className="font-mono bg-card-border/50 px-1.5 rounded">{alert.userEmail}</span>}
                               {format(new Date(alert.timestamp), 'MMM dd, hh:mm a')}
                             </span>
                             {!alert.read && (
                               <button 
                                 onClick={() => markAlertAsRead(alert._id)}
                                 className="text-[11px] font-semibold text-accent hover:underline"
                               >
                                 Mark read
                               </button>
                             )}
                          </div>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
