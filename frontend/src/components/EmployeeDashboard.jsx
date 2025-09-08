import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { startTrip, stopTrip } from '../services/api';

// --- LEAFLET ICON FIX ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// *** CORRECTED: ChangeView is now defined OUTSIDE the main component ***
const ChangeView = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (map) {
            map.setView(center, zoom);
        }
    }, [center, zoom, map]);
    return null;
};

const EmployeeDashboard = ({ onLogout }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState([]);
  const [stops, setStops] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [startTime, setStartTime] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalWaitTime, setTotalWaitTime] = useState(0);
  const [tripDuration, setTripDuration] = useState(0);

  const watchId = useRef(null);
  const stopTimeout = useRef(null);
  const lastPosition = useRef(null);
  const durationInterval = useRef(null);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
  };

  useEffect(() => {
    if (path.length < 2) { setTotalDistance(0); return; }
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      distance += calculateDistance(path[i-1][0], path[i-1][1], path[i][0], path[i][1]);
    }
    setTotalDistance(distance);
  }, [path]);

  useEffect(() => {
    const total = stops.reduce((acc, stop) => acc + stop.duration, 0);
    setTotalWaitTime(total);
  }, [stops]);

  useEffect(() => {
    if (isTracking && startTime) {
      durationInterval.current = setInterval(() => setTripDuration(Date.now() - startTime), 1000);
    } else {
      clearInterval(durationInterval.current);
    }
    return () => clearInterval(durationInterval.current);
  }, [isTracking, startTime]);

  useEffect(() => {
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      if (stopTimeout.current) clearTimeout(stopTimeout.current);
      clearInterval(durationInterval.current);
    };
  }, []);

  const handleStartTracking = async () => {
    try {
      const data = await startTrip();
      setTripId(data.tripId);
      setIsTracking(true);
      setPath([]); setStops([]); setTotalDistance(0); setTotalWaitTime(0); setTripDuration(0);
      setStartTime(Date.now());
      if (!navigator.geolocation) return alert("Geolocation is not supported.");
      
      navigator.geolocation.getCurrentPosition(pos => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPosition(newPos); setMapCenter(newPos); setMapZoom(14); setPath(prev => [...prev, newPos]);
        lastPosition.current = { lat: newPos[0], lon: newPos[1], timestamp: Date.now() };
      }, (error) => console.error("Error getting initial position:", error), { enableHighAccuracy: true });

      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPos = [latitude, longitude];
          setCurrentPosition(newPos);
          if (!lastPosition.current) { lastPosition.current = { lat: latitude, lon: longitude, timestamp: Date.now() }; return; }
          const distance = calculateDistance(lastPosition.current.lat, lastPosition.current.lon, latitude, longitude);
          if (distance > 0.01) {
            setPath(prev => [...prev, newPos]);
            lastPosition.current = { lat: latitude, lon: longitude, timestamp: Date.now() };
            if (stopTimeout.current) clearTimeout(stopTimeout.current);
          }
          if (stopTimeout.current) clearTimeout(stopTimeout.current);
          stopTimeout.current = setTimeout(() => {
            const stopDuration = Date.now() - lastPosition.current.timestamp;
            if (stopDuration > 30000) {
              const newStop = { location: [lastPosition.current.lat, lastPosition.current.lon], startTime: lastPosition.current.timestamp, endTime: Date.now(), duration: stopDuration };
              setStops(prev => [...prev, newStop]);
              lastPosition.current.timestamp = Date.now();
            }
          }, 31000);
        },
        (error) => console.error(error), { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    } catch (err) { alert(`Error starting trip: ${err.message}`); }
  };

  const handleStopTracking = async () => {
    if (!tripId) return;
    setIsTracking(false);
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if (stopTimeout.current) clearTimeout(stopTimeout.current);
    watchId.current = null;
    try {
      await stopTrip({ tripId, path, stops });
      alert('Trip data saved successfully!');
    } catch (err) { alert(`Error saving trip: ${err.message}`); } 
    finally { setTripId(null); }
  };

  const formatDuration = (ms) => {
    if (!ms || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>Employee Dashboard</h1>
          <button onClick={onLogout} className="logout-btn" title="Logout">X</button>
        </div>
        <div className="card controls">{!isTracking ? <button onClick={handleStartTracking} className="start-tracking">Start Tracking</button> : <button onClick={handleStopTracking} className="stop-tracking">Stop Tracking</button>}</div>
        <div className="card">
          <h2>Live Status</h2>
          <div className="stats-grid">
            <div className="stat-item"><div className="label">STATUS</div><div className={`value ${isTracking ? 'tracking' : 'stopped'}`}>{isTracking ? 'Tracking' : 'Stopped'}</div></div>
            <div className="stat-item"><div className="label">TRIP DURATION</div><div className="value">{formatDuration(tripDuration)}</div></div>
          </div>
        </div>
        <div className="card">
          <h2>Trip Summary</h2>
          <div className="stats-grid">
            <div className="stat-item"><div className="label">TOTAL DISTANCE</div><div className="value">{totalDistance.toFixed(2)} km</div></div>
            <div className="stat-item"><div className="label">TOTAL STOPS</div><div className="value">{stops.length}</div></div>
            <div className="stat-item"><div className="label">TOTAL WAIT TIME</div><div className="value">{formatDuration(totalWaitTime)}</div></div>
            <div className="stat-item"><div className="label">POINTS LOGGED</div><div className="value">{path.length}</div></div>
          </div>
        </div>
        <div className="card">
          <h2>Path Details ({path.length} points)</h2>
          <div className="details-list"><ul>{path.map((pos, i) => <li key={i}><span>Point {i + 1}</span> {pos[0].toFixed(4)}, {pos[1].toFixed(4)}</li>)}</ul></div>
        </div>
        <div className="card">
          <h2>Stops Details ({stops.length} stops)</h2>
          <div className="details-list"><ul>{stops.map((stop, i) => <li key={i}><span>Stop {i + 1}</span> {formatDuration(stop.duration)}</li>)}</ul></div>
        </div>
      </div>
      <div className="map-container">
        <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={true}>
          <ChangeView center={mapCenter} zoom={mapZoom} />
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {path.length > 0 && <Polyline positions={path} color="#007BFF" weight={5} />}
          {path.length > 0 && <Marker position={path[0]}><Popup>Starting Point</Popup></Marker>}
          {stops.map((stop, i) => <Marker key={i} position={stop.location}><Popup><strong>Stop {i + 1}</strong><br />Waited for: {formatDuration(stop.duration)}</Popup></Marker>)}
          {isTracking && currentPosition && <Marker position={currentPosition}><Popup>Current Location</Popup></Marker>}
        </MapContainer>
      </div>
    </div>
  );
};

export default EmployeeDashboard;