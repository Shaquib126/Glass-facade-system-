import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { socket } from '../lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { format } from 'date-fns';
import { Edit2, Trash2, X, LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const { token, logout } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' });

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

  const fetchData = async () => {
    try {
      const [usersRes, attRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/attendance', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (attRes.ok) setAttendance(await attRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: 'user' })
      });
      if (res.ok) {
        setNewEmail('');
        setNewPassword('');
        setNewName('');
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
    setEditForm({ name: user.name || '', email: user.email || '', role: user.role || 'user' });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
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

          {/* Bento 2: Live Activity Feed */}
          <Card className="col-span-1 md:col-span-1 md:row-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-0">
                {attendance.map((record, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-card-border last:border-0">
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
                {attendance.length === 0 && <p className="text-text-s text-center py-8 text-sm">No recent activity</p>}
              </div>
            </CardContent>
          </Card>

          {/* Bento 3: Personnel */}
          <Card className="col-span-1 md:col-span-1 md:row-span-2 flex flex-col">
            <CardHeader>
              <CardTitle>Personnel</CardTitle>
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
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button onClick={() => startEditing(u)} className="p-1.5 hover:bg-card-border rounded-md text-text-s hover:text-text-p transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteUser(u._id)} className="p-1.5 hover:bg-red-500/20 rounded-md text-text-s hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bento 4: Map / Geo-fencing */}
          <Card className="col-span-1 md:col-span-1">
            <CardHeader>
              <CardTitle>Site Geo-fence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[150px] bg-[#0A0C10] rounded-xl relative border border-card-border overflow-hidden">
                <div className="absolute top-1/2 left-1/2 w-[60px] h-[60px] bg-accent/20 rounded-full -translate-x-1/2 -translate-y-1/2 border border-accent animate-pulse"></div>
                <div className="absolute bottom-3 left-3 text-[10px] text-text-s font-mono">
                  LAT: 37.7749° N<br/>LNG: -122.4194° W
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bento 5: Add User */}
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
                <Button type="submit" className="w-full h-10 text-xs" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Account'}
                </Button>
              </form>
            </CardContent>
          </Card>

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
                  <option value="admin">Admin</option>
                </select>
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
    </div>
  );
}
