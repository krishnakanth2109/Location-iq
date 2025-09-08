import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getEmployees, getTripsForEmployee } from '../services/api';

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

// Helper function for AdminDashboard to calculate distance for the trip list
const calculateTotalDistance = (path) => {
    let distance = 0;
    const calculate = (lat1, lon1, lat2, lon2) => {
        const R = 6371; const dLat = (lat2 - lat1) * (Math.PI / 180); const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
    };
    for (let i = 1; i < path.length; i++) {
        distance += calculate(path[i-1][0], path[i-1][1], path[i][0], path[i][1]);
    }
    return distance;
};

const AdminDashboard = ({ onLogout }) => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [trips, setTrips] = useState([]);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
    const [mapZoom, setMapZoom] = useState(5);
    
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const data = await getEmployees();
                setEmployees(data);
            } catch (error) {
                console.error("Failed to fetch employees", error);
                alert('Failed to fetch employees. Please try again.');
            }
        };
        fetchEmployees();
    }, []);

    const handleSelectEmployee = async (employee) => {
        setSelectedEmployee(employee);
        setSelectedTrip(null);
        setTrips([]); // Clear previous trips immediately
        try {
            const data = await getTripsForEmployee(employee._id);
            setTrips(data);
        } catch (error) {
            console.error("Failed to fetch trips", error);
            alert(`Failed to fetch trips for ${employee.name}.`);
        }
    };

    const handleSelectTrip = (trip) => {
        setSelectedTrip(trip);
        if (trip.path && trip.path.length > 0) {
            setMapCenter(trip.path[0]);
            setMapZoom(13);
        } else {
            setMapCenter([20.5937, 78.9629]);
            setMapZoom(5);
        }
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
                    <h1>Admin Dashboard</h1>
                    <button onClick={onLogout} className="logout-btn" title="Logout">X</button>
                </div>

                <div className="card">
                    <h2>Employees ({employees.length})</h2>
                    <div className="details-list">
                        <ul>
                            {employees.map(emp => (
                                <li key={emp._id} onClick={() => handleSelectEmployee(emp)} 
                                    style={{cursor: 'pointer', backgroundColor: selectedEmployee?._id === emp._id ? '#e0e0e0' : ''}}>
                                    <span>{emp.name}</span> {emp.email}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {selectedEmployee && (
                    <div className="card">
                        <h2>Trips for {selectedEmployee.name} ({trips.length})</h2>
                        <div className="details-list">
                           <ul>
                                {trips.length > 0 ? trips.map(trip => (
                                    <li key={trip._id} onClick={() => handleSelectTrip(trip)} 
                                        style={{cursor: 'pointer', backgroundColor: selectedTrip?._id === trip._id ? '#e0e0e0' : ''}}>
                                       <span>{new Date(trip.startTime).toLocaleString()}</span>
                                       <span>{((trip.path.length > 0 && calculateTotalDistance(trip.path)) || 0).toFixed(2)} km</span>
                                    </li>
                                )) : <li>No trips found for this employee.</li>}
                           </ul>
                        </div>
                    </div>
                )}
            </div>
            <div className="map-container">
                <MapContainer center={mapCenter} zoom={mapZoom}>
                    <ChangeView center={mapCenter} zoom={mapZoom} />
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {selectedTrip && selectedTrip.path.length > 0 && (
                        <>
                            <Polyline positions={selectedTrip.path} color="#dc3545" weight={5} />
                            <Marker position={selectedTrip.path[0]}><Popup>Trip Start</Popup></Marker>
                            {selectedTrip.path.length > 1 && <Marker position={selectedTrip.path[selectedTrip.path.length - 1]}><Popup>Trip End</Popup></Marker>}
                            {selectedTrip.stops.map((stop, i) => (
                                <Marker key={i} position={stop.location}>
                                    <Popup><strong>Stop {i+1}</strong><br/>Duration: {formatDuration(stop.duration)}</Popup>
                                </Marker>
                            ))}
                        </>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default AdminDashboard;