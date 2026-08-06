import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Line, ComposedChart 
} from 'recharts';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp, Filter, Calendar, Users, Download } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isAfter, isBefore, parseISO, isSameDay } from 'date-fns';

interface AttendanceRecord {
  _id?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  status: 'clock-in' | 'clock-out';
  timestamp: string;
  location?: { lat: number; lng: number };
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  attendance: AttendanceRecord[];
  users: User[];
}

export const AttendanceTrendsChart: React.FC<Props> = ({ attendance, users }) => {
  const [daysRange, setDaysRange] = useState<number>(14);
  const [thresholdTime, setThresholdTime] = useState<string>('09:00'); // HH:mm format (e.g. 09:00 AM)
  const [chartType, setChartType] = useState<'composed' | 'stacked' | 'grouped'>('composed');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [showLateDetails, setShowLateDetails] = useState<boolean>(false);

  // Parse threshold time into hours and minutes
  const [thresholdHour, thresholdMinute] = useMemo(() => {
    const parts = thresholdTime.split(':');
    return [parseInt(parts[0], 10) || 9, parseInt(parts[1], 10) || 0];
  }, [thresholdTime]);

  // Compute daily trend data
  const { chartData, metrics, lateList } = useMemo(() => {
    const now = new Date();
    const startDate = startOfDay(subDays(now, daysRange - 1));
    const endDate = endOfDay(now);

    // Filter relevant clock-in records
    const clockIns = attendance.filter((rec) => {
      if (rec.status !== 'clock-in') return false;
      const recDate = new Date(rec.timestamp);
      if (recDate < startDate || recDate > endDate) return false;
      if (selectedUserFilter !== 'all' && rec.userId !== selectedUserFilter) return false;
      return true;
    });

    // Create daily slots for the date range
    const daysMap: Record<string, {
      dateStr: string;
      rawDate: Date;
      onTime: number;
      late: number;
      total: number;
      lateWorkers: Array<{ name: string; time: string; delayMins: number; email: string }>;
    }> = {};

    for (let i = daysRange - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'MMM dd');
      daysMap[key] = {
        dateStr: key,
        rawDate: d,
        onTime: 0,
        late: 0,
        total: 0,
        lateWorkers: []
      };
    }

    const allLateRecords: Array<{
      dateStr: string;
      timestamp: string;
      userName: string;
      userEmail: string;
      delayMins: number;
      clockInTime: string;
    }> = [];

    // Map each clock in to its date slot
    clockIns.forEach((rec) => {
      const recDate = new Date(rec.timestamp);
      const key = format(recDate, 'MMM dd');

      if (!daysMap[key]) return; // Out of view bounds

      // Check against threshold
      const recHour = recDate.getHours();
      const recMinute = recDate.getMinutes();

      const isLate = recHour > thresholdHour || (recHour === thresholdHour && recMinute > thresholdMinute);

      const userObj = users.find(u => u._id === rec.userId || u.email === rec.userEmail);
      const userName = userObj?.name || rec.userName || rec.userEmail.split('@')[0];

      if (isLate) {
        daysMap[key].late += 1;
        const totalMinutesActual = recHour * 60 + recMinute;
        const totalMinutesThreshold = thresholdHour * 60 + thresholdMinute;
        const delayMins = Math.max(1, totalMinutesActual - totalMinutesThreshold);

        daysMap[key].lateWorkers.push({
          name: userName,
          time: format(recDate, 'hh:mm a'),
          delayMins,
          email: rec.userEmail
        });

        allLateRecords.push({
          dateStr: format(recDate, 'MMM dd, yyyy'),
          timestamp: rec.timestamp,
          userName,
          userEmail: rec.userEmail,
          delayMins,
          clockInTime: format(recDate, 'hh:mm a')
        });
      } else {
        daysMap[key].onTime += 1;
      }

      daysMap[key].total += 1;
    });

    // Format chart array
    const chartArray = Object.values(daysMap).map(slot => {
      const punctualityRate = slot.total > 0 ? Math.round((slot.onTime / slot.total) * 100) : 0;
      return {
        date: slot.dateStr,
        'On-Time': slot.onTime,
        'Late': slot.late,
        'Total Arrivals': slot.total,
        'Punctuality Rate (%)': punctualityRate,
        lateWorkers: slot.lateWorkers
      };
    });

    // Summary metrics
    const totalClockIns = chartArray.reduce((acc, curr) => acc + curr['Total Arrivals'], 0);
    const totalOnTime = chartArray.reduce((acc, curr) => acc + curr['On-Time'], 0);
    const totalLate = chartArray.reduce((acc, curr) => acc + curr['Late'], 0);
    const overallPunctuality = totalClockIns > 0 ? Math.round((totalOnTime / totalClockIns) * 100) : 100;

    const totalDelayMins = allLateRecords.reduce((acc, r) => acc + r.delayMins, 0);
    const avgDelayMins = totalLate > 0 ? Math.round(totalDelayMins / totalLate) : 0;

    return {
      chartData: chartArray,
      metrics: {
        totalClockIns,
        totalOnTime,
        totalLate,
        overallPunctuality,
        avgDelayMins
      },
      lateList: allLateRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    };
  }, [attendance, users, daysRange, thresholdHour, thresholdMinute, selectedUserFilter]);

  // Download CSV report for manager
  const exportTrendsCSV = () => {
    const rows: string[][] = [
      ['DAILY ATTENDANCE & PUNCTUALITY TRENDS REPORT'],
      ['Range', `Last ${daysRange} Days`],
      ['Threshold Shift Start', `${thresholdTime}`],
      ['Overall Punctuality Rate', `${metrics.overallPunctuality}%`],
      ['Total Clock-Ins', `${metrics.totalClockIns}`],
      ['On-Time Arrivals', `${metrics.totalOnTime}`],
      ['Late Arrivals', `${metrics.totalLate}`],
      ['Average Delay for Late Clock-ins', `${metrics.avgDelayMins} mins`],
      [],
      ['Date', 'On-Time Count', 'Late Count', 'Total Count', 'Punctuality Rate (%)']
    ];

    chartData.forEach((row) => {
      rows.push([
        row.date,
        String(row['On-Time']),
        String(row['Late']),
        String(row['Total Arrivals']),
        `${row['Punctuality Rate (%)']}%`
      ]);
    });

    rows.push([]);
    rows.push(['DETAILED LATE CLOCK-INS LIST']);
    rows.push(['Date', 'Worker Name', 'Worker Email', 'Clock-In Time', 'Delay (Minutes)']);

    lateList.forEach((item) => {
      rows.push([
        item.dateStr,
        item.userName,
        item.userEmail,
        item.clockInTime,
        `${item.delayMins} mins`
      ]);
    });

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_Punctuality_Trends_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className="shadow-sm border border-card-border overflow-hidden">
      <CardHeader className="pb-4 border-b border-card-border/50 bg-card-bg/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            <CardTitle className="text-lg font-bold">Daily Attendance Trends & Punctuality</CardTitle>
          </div>
          <p className="text-xs text-text-s mt-1">
            Analyze on-time arrivals vs late clock-ins across field teams to optimize shift performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportTrendsCSV}
            className="h-8 text-xs font-semibold gap-1.5 text-accent hover:bg-accent/10 border-accent/30"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Controls Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-bg/50 p-3 rounded-xl border border-card-border">
          {/* Range Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-s uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Time Horizon
            </label>
            <select
              value={daysRange}
              onChange={(e) => setDaysRange(Number(e.target.value))}
              className="h-8 text-xs bg-card-bg border border-card-border rounded-lg px-2 text-text-p focus:outline-none focus:border-accent"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          {/* Shift Threshold Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-s uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-warning" /> Expected Start Time
            </label>
            <select
              value={thresholdTime}
              onChange={(e) => setThresholdTime(e.target.value)}
              className="h-8 text-xs bg-card-bg border border-card-border rounded-lg px-2 text-text-p focus:outline-none focus:border-accent"
            >
              <option value="08:00">08:00 AM (Early Shift)</option>
              <option value="08:30">08:30 AM</option>
              <option value="09:00">09:00 AM (Standard)</option>
              <option value="09:30">09:30 AM</option>
              <option value="10:00">10:00 AM (Late Shift)</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-s uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-accent" /> Filter Worker
            </label>
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="h-8 text-xs bg-card-bg border border-card-border rounded-lg px-2 text-text-p focus:outline-none focus:border-accent truncate"
            >
              <option value="all">All Workers ({users.length})</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Chart Display Style */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-text-s uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" /> Visual Style
            </label>
            <select
              value={chartType}
              onChange={(e: any) => setChartType(e.target.value)}
              className="h-8 text-xs bg-card-bg border border-card-border rounded-lg px-2 text-text-p focus:outline-none focus:border-accent"
            >
              <option value="composed">Bars + Rate Line</option>
              <option value="stacked">Stacked Bars</option>
              <option value="grouped">Grouped Bars</option>
            </select>
          </div>
        </div>

        {/* Summary Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card-bg border border-card-border flex flex-col justify-between shadow-sm">
            <span className="text-xs text-text-s font-medium uppercase tracking-wider">Punctuality Rate</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-2xl font-bold ${metrics.overallPunctuality >= 80 ? 'text-emerald-500' : metrics.overallPunctuality >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                {metrics.overallPunctuality}%
              </span>
              <span className="text-[10px] text-text-s font-medium">target 85%+</span>
            </div>
            <div className="w-full bg-bg h-1.5 rounded-full mt-3 overflow-hidden border border-card-border/30">
              <div 
                className={`h-full transition-all duration-500 ${metrics.overallPunctuality >= 80 ? 'bg-emerald-500' : metrics.overallPunctuality >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, metrics.overallPunctuality)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card-bg border border-card-border flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-s font-medium uppercase tracking-wider">On-Time Arrivals</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-emerald-500">{metrics.totalOnTime}</span>
              <span className="text-xs text-text-s ml-2 font-medium">({metrics.totalClockIns > 0 ? Math.round((metrics.totalOnTime / metrics.totalClockIns) * 100) : 0}%)</span>
            </div>
            <p className="text-[11px] text-text-s mt-1">Clocked in ≤ {thresholdTime}</p>
          </div>

          <div className="p-4 rounded-xl bg-card-bg border border-card-border flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-s font-medium uppercase tracking-wider">Late Arrivals</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-amber-500">{metrics.totalLate}</span>
              <span className="text-xs text-text-s ml-2 font-medium">({metrics.totalClockIns > 0 ? Math.round((metrics.totalLate / metrics.totalClockIns) * 100) : 0}%)</span>
            </div>
            <p className="text-[11px] text-text-s mt-1">Clocked in &gt; {thresholdTime}</p>
          </div>

          <div className="p-4 rounded-xl bg-card-bg border border-card-border flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-s font-medium uppercase tracking-wider">Avg Delay</span>
              <Clock className="w-4 h-4 text-accent" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-accent">{metrics.avgDelayMins}</span>
              <span className="text-xs text-text-s ml-1 font-medium">mins</span>
            </div>
            <p className="text-[11px] text-text-s mt-1">Per late clock-in</p>
          </div>
        </div>

        {/* Recharts Chart Visualization */}
        <div className="h-[320px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'composed' ? (
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-card-border)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: 'var(--theme-text-s)' }} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'var(--theme-text-s)' }} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#3b82f6' }} 
                  tickLine={false} 
                  axisLine={false}
                  unit="%"
                />
                <Tooltip 
                  cursor={{ fill: 'var(--theme-bg)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card-bg border border-card-border p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[180px]">
                          <p className="font-bold text-text-p border-b border-card-border pb-1">{label}</p>
                          <div className="flex justify-between items-center text-emerald-500 font-semibold">
                            <span>On-Time Arrivals:</span>
                            <span>{data['On-Time']}</span>
                          </div>
                          <div className="flex justify-between items-center text-amber-500 font-semibold">
                            <span>Late Clock-Ins:</span>
                            <span>{data['Late']}</span>
                          </div>
                          <div className="flex justify-between items-center text-text-s border-t border-card-border/50 pt-1">
                            <span>Total Clock-Ins:</span>
                            <span className="font-bold text-text-p">{data['Total Arrivals']}</span>
                          </div>
                          <div className="flex justify-between items-center text-blue-500 font-bold">
                            <span>Punctuality Rate:</span>
                            <span>{data['Punctuality Rate (%)']}%</span>
                          </div>
                          {data.lateWorkers && data.lateWorkers.length > 0 && (
                            <div className="mt-2 pt-1 border-t border-card-border/50 text-[10px] text-text-s">
                              <span className="font-bold text-amber-500 block mb-0.5">Late Workers:</span>
                              {data.lateWorkers.map((w: any, idx: number) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{w.name}</span>
                                  <span className="text-amber-500">{w.time} ({w.delayMins}m late)</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar yAxisId="left" dataKey="On-Time" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="left" dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line yAxisId="right" type="monotone" dataKey="Punctuality Rate (%)" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
              </ComposedChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-card-border)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: 'var(--theme-text-s)' }} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: 'var(--theme-text-s)' }} 
                  tickLine={false} 
                  axisLine={false} 
                  allowDecimals={false}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--theme-bg)' }}
                  contentStyle={{ backgroundColor: 'var(--theme-card-bg)', border: '1px solid var(--theme-card-border)', borderRadius: '8px', fontSize: '12px', color: 'var(--theme-text-p)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="On-Time" stackId={chartType === 'stacked' ? 'a' : undefined} fill="#10b981" radius={chartType === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Late" stackId={chartType === 'stacked' ? 'a' : undefined} fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Late Arrivals List Drawer / Table Toggle */}
        <div className="pt-2 border-t border-card-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-p uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Late Clock-Ins Drilldown ({lateList.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLateDetails(!showLateDetails)}
              className="text-xs text-accent hover:bg-accent/10 h-7"
            >
              {showLateDetails ? 'Hide Records' : 'Show All Late Records'}
            </Button>
          </div>

          {showLateDetails && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-card-border">
              {lateList.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg text-text-s font-semibold uppercase border-b border-card-border">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Worker</th>
                      <th className="p-2.5">Clock-In Time</th>
                      <th className="p-2.5">Shift Threshold</th>
                      <th className="p-2.5">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border/50">
                    {lateList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-bg/50 transition-colors">
                        <td className="p-2.5 font-medium">{item.dateStr}</td>
                        <td className="p-2.5">
                          <div className="font-semibold text-text-p">{item.userName}</div>
                          <div className="text-[10px] text-text-s">{item.userEmail}</div>
                        </td>
                        <td className="p-2.5 font-mono text-amber-500 font-semibold">{item.clockInTime}</td>
                        <td className="p-2.5 font-mono text-text-s">{thresholdTime}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            +{item.delayMins} min late
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-text-s text-xs">
                  No late clock-ins recorded for the selected filter window! All workers were on-time.
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
