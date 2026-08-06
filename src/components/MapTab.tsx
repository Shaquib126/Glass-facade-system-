import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { format } from 'date-fns';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function MarkerWithInfoWindow({ record, children }: { record: any, children?: React.ReactNode, key?: any }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker ref={markerRef} position={record.location} onClick={() => setOpen(true)}>
        {children}
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-1 max-w-[200px]">
            <strong className="block mb-1 text-sm font-medium">{record.userEmail}</strong>
            <p className="text-xs text-text-s mb-1">Status: {record.status}</p>
            <p className="text-xs text-text-s mb-1">Time: {format(new Date(record.timestamp), 'PP p')}</p>
            {record.workedHours && <p className="text-xs text-text-s mb-1">Worked: {record.workedHours}h</p>}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// Circle component to draw geofences using standard Google Maps JS API since @vis.gl doesn't have a specific <Circle> component yet
const MapCircle = ({ center, radius, color = '#2563eb' }: { center: google.maps.LatLngLiteral, radius: number, color?: string, key?: any }) => {
  const map = require('@vis.gl/react-google-maps').useMap();
  const circleRef = React.useRef<google.maps.Circle | null>(null);

  React.useEffect(() => {
    if (!map) return;
    circleRef.current = new google.maps.Circle({
      map,
      center,
      radius,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.35,
    });
    return () => {
      if (circleRef.current) circleRef.current.setMap(null);
    };
  }, [map, center, radius, color]);

  return null;
};

export const MapTab = ({ sites, attendance, users }: { sites: any[], attendance: any[], users: any[] }) => {
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center h-[600px] font-sans bg-card rounded-3xl border border-card-border p-8">
        <div className="text-center max-w-lg">
          <h2 className="text-xl font-semibold mb-4 text-text">Google Maps API Key Required</h2>
          <p className="text-text-s mb-4 text-left"><strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener" className="text-accent hover:underline">Get an API Key</a></p>
          <p className="text-text-s mb-2 text-left"><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
          <ul className="text-left leading-relaxed text-text-s list-disc pl-8 mb-6">
            <li>Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Type <code className="bg-background px-1 py-0.5 rounded text-sm">GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, press <strong>Enter</strong></li>
            <li>Paste your API key as the value, press <strong>Enter</strong></li>
          </ul>
          <p className="text-sm text-accent bg-accent/10 py-2 px-4 rounded-full inline-block">The app rebuilds automatically after you add the secret.</p>
        </div>
      </div>
    );
  }

  // Calculate default center based on first site or fallback
  const defaultCenter = sites.length > 0 
    ? { lat: sites[0].lat, lng: sites[0].lng } 
    : { lat: 37.42, lng: -122.08 }; // Default to Google HQ if no sites

  // Filter attendance records to only those with locations
  const recordsWithLocation = attendance.filter(r => r.location && r.location.lat && r.location.lng);

  return (
    <div className="h-[600px] w-full rounded-3xl overflow-hidden border border-card-border">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={sites.length > 0 ? 15 : 12}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{width: '100%', height: '100%'}}
        >
          {/* Draw Geofences */}
          {sites.map(site => (
            <MapCircle 
              key={site._id} 
              center={{lat: site.lat, lng: site.lng}} 
              radius={site.radius || 100} 
            />
          ))}

          {/* Draw Worker Check-ins */}
          {recordsWithLocation.map(record => {
             const isClockIn = record.status === 'clock-in';
             return (
               <MarkerWithInfoWindow key={record._id} record={record}>
                  <Pin background={isClockIn ? "#22c55e" : "#f59e0b"} glyphColor="#fff" borderColor={isClockIn ? "#16a34a" : "#d97706"} />
               </MarkerWithInfoWindow>
             );
          })}
        </Map>
      </APIProvider>
    </div>
  );
};
