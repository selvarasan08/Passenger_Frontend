import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bus, QrCode, User, Clock, AlertCircle, Zap, MapPin, Route } from 'lucide-react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/bus';

function App() {
  const [trackingBusId, setTrackingBusId] = useState('');
  const [busData, setBusData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const updateIntervalRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  // Check URL for tracking parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trackBus = params.get('track');
    if (trackBus) {
      startTrackingBus(trackBus.trim().toUpperCase());
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      initMap();
    }
  }, [currentLocation, busData]);

  const initMap = () => {
    if (!window.L) {
      console.error('Leaflet not loaded');
      return;
    }

    const map = window.L.map('map').setView([currentLocation.lat, currentLocation.lng], 15);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const busIcon = window.L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="position: relative;">
          <div style="
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            width: 60px; height: 60px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
            border: 4px solid white;
            animation: markerBounce 2s infinite;
          ">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M4 13v2h2v-5.5A2.5 2.5 0 0 1 8.5 9H11v2H8.5A.5.5 0 0 0 8 11.5V13h5v-2h-1v-1.5c0-.8.7-1.5 1.5-1.5H15v-2h-1a3 3 0 0 0-3 3V11h-2v-1a2 2 0 0 1 4 0v1h-1v2h3v5H4v-2zm14-8h-2v2h2v11h2V7a3 3 0 0 0-3-3z"/>
            </svg>
          </div>
          <div style="
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 100px; height: 100px;
            border: 3px solid #10b981; border-radius: 50%;
            animation: markerPulse 2s infinite;
          "></div>
        </div>
      `,
      iconSize: [60, 60],
      iconAnchor: [30, 60]
    });

    const marker = window.L.marker([currentLocation.lat, currentLocation.lng], { icon: busIcon })
      .addTo(map);
    const circle = window.L.circle([currentLocation.lat, currentLocation.lng], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.15,
      radius: 150
    }).addTo(map);

    marker.bindPopup(`
      <div style="text-align: center; font-family: system-ui; min-width: 200px;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 1rem; border-radius: 12px; margin: -0.5rem -1rem 1rem;">
          <strong style="font-size: 18px;">🚌 ${busData?.busNumber}</strong>
        </div>
        <div style="font-size: 14px;">
          <strong>Driver:</strong> ${busData?.driverName || 'N/A'}<br/>
          <strong>Status:</strong> ${busData?.isStale ? '⚠️ Stale' : '✅ Live'}<br/>
          <strong>Last Update:</strong> ${busData?.lastUpdate || 'N/A'}
        </div>
      </div>
    `).openPopup();

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;
  };

  // Update marker position
  useEffect(() => {
    if (markerRef.current && currentLocation && mapRef.current) {
      const newPos = [currentLocation.lat, currentLocation.lng];
      markerRef.current.setLatLng(newPos);
      if (circleRef.current) circleRef.current.setLatLng(newPos);
      mapRef.current.panTo(newPos, { animate: true });
    }
  }, [currentLocation]);

  // Start tracking bus for passenger
  const startTrackingBus = (busId) => {
    if (!busId || !busId.trim()) {
      setError('Please enter a valid bus number');
      return;
    }

    setError('');
    setTrackingBusId(busId.trim().toUpperCase());
    fetchBusLocation(busId.trim().toUpperCase());

    // Update every 20 seconds
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
    updateIntervalRef.current = setInterval(() => {
      fetchBusLocation(busId.trim().toUpperCase());
    }, 20000);
  };

  // Fetch bus location
  const fetchBusLocation = async (busId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/${busId}`);
      const data = response.data.bus;

      setBusData({
        busNumber: data.busNumber,
        driverName: data.driverName,
        lastUpdate: new Date(data.lastUpdated).toLocaleTimeString(),
        isStale: data.isStale
      });
      setCurrentLocation({
        lat: data.location.latitude,
        lng: data.location.longitude
      });
      setError('');
    } catch (error) {
      console.error('Fetch bus location error:', error);
      setError(error.response?.data?.error || 'Failed to fetch bus location');
      setBusData(null);
      setCurrentLocation(null);
    } finally {
      setLoading(false);
    }
  };

  // Manual bus number input
  const handleManualTrack = () => {
    const busId = prompt('Enter bus number to track (e.g., TN01AB1234)');
    if (busId) {
      startTrackingBus(busId);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="App min-h-screen" style={{
      background: 'linear-gradient(to bottom right, #f0fdf4, #dcfce7, #d1fae5)'
    }}>
      {/* Animated Background */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', opacity: 0.2, zIndex: 0
      }}>
        <div className="animate-blob" style={{
          position: 'absolute', top: '5rem', left: '5rem',
          width: '16rem', height: '16rem', background: '#bbf7d0',
          borderRadius: '9999px', mixBlendMode: 'multiply', filter: 'blur(3rem)'
        }} />
        <div className="animate-blob animation-delay-2000" style={{
          position: 'absolute', top: '10rem', right: '5rem',
          width: '16rem', height: '16rem', background: '#86efac',
          borderRadius: '9999px', mixBlendMode: 'multiply', filter: 'blur(3rem)'
        }} />
        <div className="animate-blob animation-delay-4000" style={{
          position: 'absolute', bottom: '5rem', left: '10rem',
          width: '16rem', height: '16rem', background: '#4ade80',
          borderRadius: '9999px', mixBlendMode: 'multiply', filter: 'blur(3rem)'
        }} />
      </div>

      {/* Header */}
      <div style={{
        position: 'relative', background: 'linear-gradient(to right, #16a34a, #15803d, #166534)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', zIndex: 10
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'black', opacity: 0.1 }} />
        <div style={{
          position: 'relative', maxWidth: '90rem', margin: '0 auto',
          padding: '1.5rem 1rem'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div style={{ position: 'relative' }}>
                <Bus color="white" size={40} />
                <div style={{
                  position: 'absolute', top: '-0.25rem', right: '-0.25rem',
                  width: '0.75rem', height: '0.75rem', background: '#4ade80',
                  borderRadius: '9999px'
                }} className="animate-ping" />
                <div style={{
                  position: 'absolute', top: '-0.25rem', right: '-0.25rem',
                  width: '0.75rem', height: '0.75rem', background: '#4ade80',
                  borderRadius: '9999px'
                }} />
              </div>
              <div>
                <h1 style={{
                  fontSize: '1.875rem', fontWeight: 700, color: 'white',
                  letterSpacing: '-0.025em'
                }}>BusTrackr</h1>
                <p style={{ color: '#dcfce7', fontSize: '0.875rem' }}>
                  Passenger Tracking
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'relative', zIndex: 10, maxWidth: '90rem',
          margin: '1rem auto', padding: '0 1rem'
        }}>
          <div style={{
            background: '#fee2e2', border: '2px solid #fca5a5', borderRadius: '1rem',
            padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <AlertCircle color="#dc2626" size={24} />
            <p style={{ color: '#991b1b', fontWeight: 600 }}>{error}</p>
            <button onClick={() => setError('')} style={{
              marginLeft: 'auto', color: '#991b1b', background: 'transparent',
              border: 'none', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 700
            }}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tracker View */}
      <div style={{
        position: 'relative', zIndex: 1, maxWidth: '90rem',
        margin: '0 auto', padding: '2rem 1rem'
      }}>
        <div style={{
          background: 'white', borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
        }}>
          {/* Header */}
          {trackingBusId ? (
            <div style={{
              background: 'linear-gradient(to right, #16a34a, #15803d, #166534)',
              color: 'white', padding: '1.5rem'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bus size={32} />
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    Bus {trackingBusId}
                  </h2>
                </div>
                {busData && (
                  <div className="flex items-center gap-4" style={{ fontSize: '0.875rem', flexWrap: 'wrap' }}>
                    <span className="flex items-center gap-2">
                      <User size={16} /> {busData.driverName}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock size={16} /> {busData.lastUpdate}
                    </span>
                  </div>
                )}
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(12px)',
                padding: '0.5rem 1rem', borderRadius: '9999px', display: 'flex',
                alignItems: 'center', gap: '0.5rem', marginTop: '1rem', maxWidth: 'fit-content'
              }}>
                <div style={{
                  width: '0.75rem', height: '0.75rem', background: '#4ade80',
                  borderRadius: '9999px'
                }} className="animate-pulse" />
                <span style={{ fontWeight: 600 }}>Live</span>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(to right, #16a34a, #15803d)',
              color: 'white', padding: '2rem', textAlign: 'center'
            }}>
              <QrCode color="white" size={64} style={{ marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Track Your Bus
              </h2>
              <p style={{ fontSize: '1.125rem', opacity: 0.9 }}>
                Scan QR code or enter bus number
              </p>
            </div>
          )}

          {/* Tracking Content */}
          <div style={{ padding: '2rem' }}>
            {!trackingBusId ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  onClick={handleManualTrack}
                  className="card-hover"
                  style={{
                    background: 'white', borderRadius: '1.5rem',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '3rem 2rem',
                    cursor: 'pointer', display: 'inline-block', maxWidth: '400px'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    width: '10rem', height: '10rem',
                    background: 'linear-gradient(to bottom right, #4ade80, #10b981)',
                    borderRadius: '9999px', filter: 'blur(3rem)', opacity: 0.2
                  }} />
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    position: 'relative'
                  }}>
                    <div style={{
                      background: 'linear-gradient(to bottom right, #10b981, #059669)',
                      padding: '1.5rem', borderRadius: '1.5rem', marginBottom: '1.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <QrCode color="white" size={48} />
                    </div>
                    <h3 style={{
                      fontSize: '1.875rem', fontWeight: 700, color: '#1f2937',
                      marginBottom: '0.75rem'
                    }}>
                      Enter Bus Number
                    </h3>
                    <p style={{
                      color: '#4b5563', marginBottom: '1.5rem',
                      fontSize: '1rem'
                    }}>
                      Click to enter bus number manually (e.g., TN01AB1234)
                    </p>
                    <div className="flex items-center gap-2" style={{
                      color: '#10b981', fontWeight: 600
                    }}>
                      <span>Track Now</span>
                      <MapPin size={20} />
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '0.5rem',
                    background: 'linear-gradient(to right, #10b981, #059669)',
                    transform: 'scaleX(0)', transformOrigin: 'left', transition: 'transform 0.3s'
                  }} className="card-bar" />
                </div>
              </div>
            ) : (
              <>
                {/* Map */}
                <div id="map" style={{
                  width: '100%', height: '600px', background: '#f3f4f6',
                  borderRadius: '1rem', position: 'relative'
                }}>
                  {!window.L && (
                    <div className="flex items-center justify-center" style={{ height: '100%' }}>
                      <div style={{ textAlign: 'center' }}>
                        <Bus className="animate-bounce" color="#818cf8" size={64} style={{ margin: '0 auto 1rem' }} />
                        <p style={{ color: '#4b5563', fontWeight: 600, fontSize: '1.125rem' }}>
                          Loading map...
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div style={{
                  background: 'linear-gradient(to right, #eef2ff, #f5f3ff)',
                  padding: '1rem', textAlign: 'center', borderTop: '2px solid #e0e7ff',
                  borderRadius: '0 0 1.5rem 1.5rem'
                }}>
                  <p className="flex items-center justify-center gap-2" style={{
                    color: '#5b21b6', fontWeight: 600
                  }}>
                    <Zap size={18} className="animate-pulse" />
                    Location updates automatically every 20 seconds
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
