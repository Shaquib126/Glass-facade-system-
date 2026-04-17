import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { socket } from '../lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { format } from 'date-fns';
import { Edit2, Trash2, X, LogOut, Filter, Download } from 'lucide-react';

export default function AdminDashboard() {
  const { token, user, logout } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  
  // Filtering state
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newDailyWage, setNewDailyWage] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', dailyWage: '' });
  
  const [editingSite, setEditingSite] = useState<any>(null);
  const [siteForm, setSiteForm] = useState({ name: '', lat: '', lng: '', radius: '100' });
  const [isAddingSite, setIsAddingSite] = useState(false);

  useEffect(() => {
    fetchData();
    
    socket.connect();
    socket.on('attendance_update', (record) => {
      setAttendance((prev) => [record, ...prev].slice(0, 100));
    });

    return () => {
      socket.off('attendance_update');
      socket.disconnect();
    };
  }, []);

  const canManageUsers = user?.role === 'admin';
  const canManageSites = user?.role === 'admin' || user?.role === 'manager';

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = { 
        email: newEmail, 
        password: newPassword, 
        name: newName, 
        role: 'user', 
        dailyWage: newDailyWage ? Number(newDailyWage) : 0 
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
        setNewDailyWage('');
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
      dailyWage: user.dailyWage !== undefined ? String(user.dailyWage) : '0' 
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const payload = {
        ...editForm,
        dailyWage: editForm.dailyWage ? Number(editForm.dailyWage) : 0
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
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-card-border bg-card-bg z-10">
        <div className="text-[16px] font-extrabold tracking-tight text-accent uppercase">Glass Facade</div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Sidebar */}
      <div className="w-[240px] border-r border-card-border p-8 flex-col hidden md:flex">
        <div className="text-[18px] font-extrabold tracking-tight text-accent mb-12 uppercase">Glass Facade</div>
        <div className="py-3 text-[14px] text-text-p font-semibold flex items-center gap-3 cursor-pointer">
          <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
          Overview
        </div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Field Workers</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Site Geo-fencing</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Attendance Logs</div>
        <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">System Health</div>
        <div className="mt-auto">
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3">Settings</div>
          <div className="py-3 text-[14px] text-text-s cursor-pointer flex items-center gap-3" onClick={logout}>Logout</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-6xl mx-auto">
          
          <div className="col-span-1 md:col-span-4 flex justify-between items-end mb-2">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight">Command Center</h1>
              <p className="text-[14px] text-text-s">Glass Facade System</p>
            </div>
            <div className="bg-success/10 border border-success/20 text-success px-3 py-1.5 rounded-full text-xs font-semibold">
              System Live: 99.9%
            </div>
          </div>

          {/* Bento 1: Stats */}
          <Card className="col-span-1 md:col-span-2 flex justify-around items-center p-0 py-6">
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
              <div className="text-[36px] font-bold mb-1 text-accent">Online</div>
              <div className="text-[12px] text-text-s">Site Status</div>
            </div>
          </Card>

          {/* Bento 2: Live Activity Feed & Filters */}
          <Card className="col-span-1 md:col-span-1 md:row-span-2 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle>{isFiltering ? 'Filtered Records' : 'Live Activity Feed'}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 overflow-hidden p-0">
              {/* Filters Section */}
              <div className="px-6 pb-4 border-b border-card-border bg-card-bg/50">
                <form onSubmit={applyFilters} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                      type="date" 
                      className="h-8 text-xs bg-bg" 
                      value={filterStartDate}
                      onChange={e => setFilterStartDate(e.target.value)}
                    />
                    <Input 
                      type="date" 
                      className="h-8 text-xs bg-bg" 
                      value={filterEndDate}
                      onChange={e => setFilterEndDate(e.target.value)}
                    />
                  </div>
                  <select 
                    className="flex h-8 w-full rounded-md border border-card-border bg-bg px-2 py-1 text-xs text-text-p focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/20"
                    value={filterUserId}
                    onChange={e => setFilterUserId(e.target.value)}
                  >
                    <option value="all">All Workers</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="h-8 flex-1 text-xs bg-accent/10 text-accent hover:bg-accent/20">
                      <Filter className="w-3 h-3 mr-1" /> Filter
                    </Button>
                    {isFiltering && (
                      <Button type="button" size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={clearFilters}>
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
                    <div key={record._id || i} className="flex items-center gap-3 py-3 border-b border-card-border last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-[#222] border border-card-border flex items-center justify-center text-xs">
                      {record.userEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium truncate">{record.userEmail}</div>
                      <div className="text-[11px] text-text-s truncate">
                        {record.status === 'clock-in' ? 'Clocked In' : 'Clocked Out'} • {format(new Date(record.timestamp), 'hh:mm a')}
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-success mt-1">
                        <div className="w-3.5 h-3.5 border-2 border-success rounded-[3px]"></div>
                        Verified
                      </div>
                    </div>
                  </div>
                ))}
                {attendance.length === 0 && <p className="text-text-s text-center py-8 text-sm">No records found</p>}
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Bento 3: Personnel */}
          <Card className="col-span-1 md:col-span-1 md:row-span-2 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Personnel</CardTitle>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Button variant="ghost" size="sm" onClick={downloadSalaryReport} className="h-6 px-2 text-[10px] bg-accent/10 text-accent hover:bg-accent/20" title="Download Salary CSV">
                  <Download className="w-3 h-3 mr-1" /> EXPORT
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-0">
                {users.map((u) => (
                  <div key={u._id} className="flex items-center justify-between py-3 border-b border-card-border last:border-0 group">
                    <div>
                      <p className="font-medium text-[14px]">{u.name}</p>
                      <p className="text-[11px] text-text-s">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-accent/10 text-accent px-2 py-1 rounded font-mono">{u.role}</span>
                      {canManageUsers && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button onClick={() => startEditing(u)} className="p-1.5 hover:bg-card-border rounded-md text-text-s hover:text-text-p transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteUser(u._id)} className="p-1.5 hover:bg-red-500/20 rounded-md text-text-s hover:text-red-400 transition-colors">
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

          {/* Bento 4: Map / Geo-fencing */}
          <Card className="col-span-1 md:col-span-1 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Site Geo-fences</CardTitle>
              {canManageSites && (
                <Button variant="ghost" size="sm" onClick={openAddSite} className="h-8 text-xs bg-accent/10 text-accent hover:bg-accent/20">
                  + Add Site
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-0">
                {sites.map((s) => (
                  <div key={s._id} className="flex items-center justify-between py-3 border-b border-card-border last:border-0 group">
                    <div>
                      <p className="font-medium text-[14px]">{s.name}</p>
                      <p className="text-[10px] text-text-s font-mono">
                        {s.lat.toFixed(4)}, {s.lng.toFixed(4)} • {s.radius}m
                      </p>
                    </div>
                    {canManageSites && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button onClick={() => startEditingSite(s)} className="p-1.5 hover:bg-card-border rounded-md text-text-s hover:text-text-p transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteSite(s._id)} className="p-1.5 hover:bg-red-500/20 rounded-md text-text-s hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {sites.length === 0 && <p className="text-text-s text-center py-4 text-xs">No sites configured</p>}
              </div>
            </CardContent>
          </Card>

          {/* Bento 5: Add User */}
          {canManageUsers && (
            <Card className="col-span-1 md:col-span-1">
              <CardHeader>
                <CardTitle>Add Worker</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <Input 
                    placeholder="Full Name" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    required 
                    className="h-10 text-xs"
                  />
                  <Input 
                    type="email" 
                    placeholder="Email Address" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                    required 
                    className="h-10 text-xs"
                  />
                  <Input 
                    type="password" 
                    placeholder="Temporary Password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required 
                    className="h-10 text-xs"
                  />
                  <Input 
                    type="number" 
                    step="any"
                    placeholder="Daily Wage ($)" 
                    value={newDailyWage} 
                    onChange={e => setNewDailyWage(e.target.value)} 
                    className="h-10 text-xs"
                  />
                  <Button type="submit" className="w-full h-10 text-xs" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Account'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

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
                <label className="text-xs font-medium text-text-s uppercase tracking-wider">Daily Wage ($)</label>
                <Input 
                  type="number" 
                  step="any"
                  value={editForm.dailyWage} 
                  onChange={e => setEditForm({...editForm, dailyWage: e.target.value})} 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-accent hover:bg-accent/90 text-black">
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
                <Button type="submit" className="flex-1 bg-accent hover:bg-accent/90 text-black">
                  {editingSite ? 'Save Changes' : 'Create Site'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
