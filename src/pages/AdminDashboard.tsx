import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { socket } from '../lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { format } from 'date-fns';
import { Edit2, Trash2, X, LogOut, Filter, Download, Bell, AlertTriangle, Moon, Sun, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboard() {
  const { token, user, logout } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showNotificationToast, setShowNotificationToast] = useState<{message: string, show: boolean}>({message: '', show: false});
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  
  // Filtering state
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newDailyWage, setNewDailyWage] = useState('');
  const [newOttHours, setNewOttHours] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', dailyWage: '', ottHours: '' });
  
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
      const [usersRes, attRes, sitesRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/attendance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/sites', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
      if (sitesRes.ok) setSites(await sitesRes.json());
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
        alert(data.message || 'Failed to clock in user');
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
        alert(data.message || 'Failed to clock out user');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = { 
        email: newEmail, 
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
        setNewPassword('');
        setNewName('');
        setNewRole('user');
        setNewDailyWage('');
        setNewOttHours('');
        fetchData(); // Refresh user list
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to create user');
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

  const startEditing = (user: any) => {
    setEditingUser(user);
    setEditForm({ 
      name: user.name || '', 
      email: user.email || '', 
      role: user.role || 'user',
      dailyWage: user.dailyWage !== undefined ? String(user.dailyWage) : '0',
      ottHours: user.ottHours !== undefined ? String(user.ottHours) : '0' 
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
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
        alert(data.message || 'Failed to update user');
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
       alert("Failed to download salary report.");
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
        alert(data.message || 'Failed to save site');
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

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-card-border bg-card-bg z-10">
        <div className="text-[16px] font-extrabold tracking-tight text-accent uppercase">Glass Facade</div>
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
        <div className="text-[18px] font-extrabold tracking-tight text-accent mb-12 uppercase">Glass Facade</div>
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
              <p className="text-[14px] text-text-s">Glass Facade System</p>
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
                        <Input 
                          type="date" 
                          className="h-9 text-xs bg-bg flex-1" 
                          value={filterStartDate}
                          onChange={e => setFilterStartDate(e.target.value)}
                        />
                        <Input 
                          type="date" 
                          className="h-9 text-xs bg-bg flex-1" 
                          value={filterEndDate}
                          onChange={e => setFilterEndDate(e.target.value)}
                        />
                      </div>
                      <select 
                        className="flex h-9 w-full sm:w-40 rounded-md border border-card-border bg-bg px-2 py-1 text-xs text-text-p focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/20"
                        value={filterUserId}
                        onChange={e => setFilterUserId(e.target.value)}
                      >
                        <option value="all">All Workers</option>
                        {users.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" className="h-9 px-4 text-xs bg-accent/10 text-accent hover:bg-accent/20">
                          <Filter className="w-3.5 h-3.5 mr-1" /> Filter
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
                            <div className="text-[12px] text-text-s truncate">
                              {record.status === 'clock-in' ? (
                                <span className="text-success font-medium">Clocked In</span>
                              ) : (
                                <span className="text-red-400 font-medium">Clocked Out</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/10 px-2 py-0.5 rounded pl-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                              Verified
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
                        type="email" 
                        placeholder="Email Address" 
                        value={newEmail} 
                        onChange={e => setNewEmail(e.target.value)} 
                        required 
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
                    <Button variant="outline" size="sm" onClick={downloadSalaryReport} className="h-8 px-3 text-[10px] text-text-p hover:text-accent hover:border-accent/50 shadow-sm" title="Download Salary CSV">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> EXPORT
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto px-0 py-0">
                  <div className="space-y-0">
                    {users.map((u) => (
                      <div key={u._id} className="flex items-center justify-between px-6 py-4 border-b border-card-border last:border-0 group hover:bg-card-border/10 transition-colors">
                        <div>
                          <p className="font-semibold text-[14px] flex items-center gap-2">
                            {u.name}
                            <span className="text-[9px] uppercase tracking-wider bg-accent/10 border border-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">
                              {u.role}
                            </span>
                          </p>
                          <p className="text-[11px] text-text-s mt-0.5">{u.email}</p>
                          <div className="flex gap-2">
                            {u.dailyWage > 0 && <p className="text-[10px] text-success/80 mt-1 font-mono">₹{u.dailyWage}/day</p>}
                            {u.ottHours > 0 && <p className="text-[10px] text-accent mt-1 font-mono">{u.ottHours}h OTT Allow</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {canManageUsers && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                              {/* Admin Clock-in Button (if not clocked in today) */}
                              {!attendance.some(a => a.userId === u._id && a.status === 'clock-in' && new Date(a.timestamp).toDateString() === new Date().toDateString()) ? (
                                <button 
                                  onClick={() => handleAdminClockIn(u._id)} 
                                  title="Force Clock In"
                                  className="p-1.5 bg-bg border border-success/30 rounded-lg text-success hover:bg-success/10 shadow-sm transition-colors"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleAdminClockOut(u._id)} 
                                  title="Force Clock Out"
                                  className="p-1.5 bg-bg border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/10 shadow-sm transition-colors"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => startEditing(u)} className="p-1.5 bg-bg border border-card-border rounded-lg text-text-s hover:text-accent shadow-sm transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteUser(u._id)} className="p-1.5 bg-bg border border-card-border rounded-lg text-text-s hover:text-red-400 shadow-sm transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>

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
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Email Address</label>
                <Input 
                  type="email" 
                  value={editForm.email} 
                  onChange={e => setEditForm({...editForm, email: e.target.value})} 
                  required 
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
