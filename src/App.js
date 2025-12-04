import React, { useEffect, useRef, useState } from 'react';
import { Bus, User, Clock, Zap, AlertCircle } from 'lucide-react';
import { fetchBusLocation } from './api';
import './App.css';

function App() {
  const [trackingBusId, setTrackingBusId] = useState('');
  const [busData, setBusData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const intervalRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const promptBusIfNeeded = () => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('track');
    if (fromQuery) {
      setTrackingBusId(fromQuery.trim().toUpperCase());
      return;
    }
    const busId = prompt('Enter bus number to track (e.g., TN01AB1234):');
    if (busId) setTrackingBusId(busId.trim().toUpperCase());
  };

  useEffect(() => {
    promptBusIfNeeded();
  }, []);

  // fetch loop
  useEffect(() => {
    if (!trackingBusId) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchBusLocation(trackingBusId);
        const data = res.data.bus;

        setBusData({
          busNumber: data.busNumber,
          driverName: data.driverName,
          lastUpdate: new Date(data.lastUpdated).toLocaleTimeString(),
          isStale: data.isStale,
        });

        setCurrentLocation({
          lat: data.location.latitude,
          lng: data.location.longitude,
        });

        setError('');
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to fetch bus location');
        setLoading(false);
      }
    };

    load();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(load, 20000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [trackingBusId]);

  // init Leaflet map once location available
  useEffect(() => {
    if (!currentLocation || mapRef.current || !window.L) return;

    const map = window.L.map('map').setView(
      [currentLocation.lat, currentLocation.lng],
      15
    );

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const busIcon = window.L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="position: relative;">
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            border: 3px solid white;
            animation: markerBounce 2s infinite;
          ">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80px;
            height: 80px;
            border: 2px solid #667eea;
            border-radius: 50%;
            animation: markerPulse 2s infinite;
          "></div>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 50],
    });

    const marker = window.L.marker(
      [currentLocation.lat, currentLocation.lng],
      { icon: busIcon }
    ).addTo(map);

    const circle = window.L.circle(
      [currentLocation.lat, currentLocation.lng],
      {
        color: '#667eea',
        fillColor: '#667eea',
        fillOpacity: 0.1,
        radius: 100,
      }
    ).addTo(map);

    marker.bindPopup(`
      <div style="text-align: center; font-family: system-ui;">
        <strong style="color: #667eea; font-size: 16px;">🚌 ${busData?.busNumber || 'Bus'}</strong>
        <br/>
        <span style="font-size: 12px; color: #666;">Driver: ${busData?.driverName || 'N/A'}</span>
      </div>
    `).openPopup();

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [currentLocation, busData]);

  // update marker on location change
  useEffect(() => {
    if (!currentLocation || !mapRef.current || !markerRef.current) return;
    const pos = [currentLocation.lat, currentLocation.lng];
    markerRef.current.setLatLng(pos);
    if (circleRef.current) circleRef.current.setLatLng(pos);
    mapRef.current.panTo(pos);
  }, [currentLocation]);

  return (
    <div className="App min-h-screen" style={{ padding: '2rem', background: '#eef2ff' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bus /> BusTrack – Passenger
        </h1>
      </header>

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '2px solid #fca5a5',
            borderRadius: '1rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <AlertCircle color="#dc2626" size={24} />
          <p style={{ color: '#991b1b', fontWeight: 600 }}>{error}</p>
          <button
            onClick={() => setError('')}
            style={{
              marginLeft: 'auto',
              color: '#991b1b',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div
        style={{
          background: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background:
              'linear-gradient(to right,#4f46e5,#7c3aed,#db2777)',
            color: 'white',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Bus size={28} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  Bus {trackingBusId || '(not selected)'}
                </h2>
              </div>
              {busData && (
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <User size={14} /> {busData.driverName}
                  </span>
                  <span style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <Clock size={14} /> Updated: {busData.lastUpdate}
                  </span>
                </div>
              )}
            </div>
            <div
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span
                style={{
                  width: '0.6rem',
                  height: '0.6rem',
                  borderRadius: '9999px',
                  background: '#4ade80',
                }}
              ></span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {loading ? 'Updating...' : 'Live'}
              </span>
            </div>
          </div>
        </div>

        <div
          id="map"
          style={{ width: '100%', height: '500px', background: '#f3f4f6' }}
        >
          {!window.L && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <p>Loading map...</p>
            </div>
          )}
        </div>

        <div
          style={{
            background: 'linear-gradient(to right,#eef2ff,#f5f3ff)',
            padding: '0.75rem',
            textAlign: 'center',
            borderTop: '1px solid #e0e7ff',
          }}
        >
          <p
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#5b21b6',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            <Zap size={16} /> Location updates every 20 seconds
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
