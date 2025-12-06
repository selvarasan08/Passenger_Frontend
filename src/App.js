import React, { useState, useEffect, useRef } from 'react';
import { Bus, User, Clock, AlertCircle, Zap, MapPin, Navigation, Radio, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL ;

function App() {
  const [trackingBusId, setTrackingBusId] = useState('');
  const [busData, setBusData] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTrackInput, setShowTrackInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [mapType, setMapType] = useState('street'); // 'street', 'satellite', 'hybrid'
  const updateIntervalRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const layersRef = useRef({});

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  let trackBus = params.get('track');

  if (!trackBus) {
    // support /track/150 style URLs
    const pathParts = window.location.pathname.split('/').filter(Boolean); 
    // e.g. "/track/150" → ["track", "150"]
    if (pathParts[0] === 'track' && pathParts[1]) {
      trackBus = pathParts[1];
    }
  }

  if (trackBus) {
    startTrackingBus(trackBus.trim().toUpperCase());
  }
}, []);


  // Initialize Leaflet map ONCE when we get first location
  useEffect(() => {
    if (!currentLocation || mapRef.current || !window.L) return;

    const map = window.L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView(
      [currentLocation.lat, currentLocation.lng],
      16
    );

    // Define different map layers
    const streetLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    });

    const satelliteLayer = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19
    });

    const hybridLayer = window.L.layerGroup([
      window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
      }),
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', {
        attribution: '© CartoDB',
        maxZoom: 19
      })
    ]);

    // Store layers
    layersRef.current = {
      street: streetLayer,
      satellite: satelliteLayer,
      hybrid: hybridLayer
    };

    // Add initial layer
    streetLayer.addTo(map);

    // Custom unique bus marker - Diamond pulse design with glow
    const busIcon = window.L.divIcon({
      className: 'custom-bus-marker',
      html: `
        <div style="position: relative; width: 90px; height: 90px; display: flex; align-items: center; justify-content: center;">
          <!-- Outer glow pulse -->
          <div style="
            position: absolute;
            width: 90px;
            height: 90px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0) 70%);
            border-radius: 50%;
            animation: pulse-glow 2.5s infinite;
          "></div>
          
          <!-- Rotating ring -->
          <div style="
            position: absolute;
            width: 65px;
            height: 65px;
            border: 3px solid rgba(139, 92, 246, 0.4);
            border-top-color: rgba(139, 92, 246, 0.9);
            border-radius: 50%;
            animation: rotate-ring 3s linear infinite;
          "></div>
          
          <!-- Diamond container -->
          <div style="
            position: absolute;
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #8b5cf6 100%);
            transform: rotate(45deg);
            border-radius: 8px;
            box-shadow: 
              0 0 20px rgba(139, 92, 246, 0.6),
              0 0 40px rgba(139, 92, 246, 0.4),
              inset 0 0 10px rgba(255, 255, 255, 0.3);
            animation: float-diamond 3s ease-in-out infinite;
          "></div>
          
          <!-- Inner icon (bus emoji) -->
          <div style="
            position: relative;
            z-index: 10;
            color: white;
            font-size: 26px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
            animation: bounce-icon 2s ease-in-out infinite;
          ">🚌</div>
          
          <!-- Bottom pointer -->
          <div style="
            position: absolute;
            bottom: -10px;
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 14px solid #8b5cf6;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
            animation: pointer-pulse 2s ease-in-out infinite;
          "></div>
        </div>
        
        <style>
          @keyframes pulse-glow {
            0%, 100% {
              transform: scale(0.85);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.15);
              opacity: 0.3;
            }
          }
          
          @keyframes rotate-ring {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          
          @keyframes float-diamond {
            0%, 100% {
              transform: rotate(45deg) translateY(0px);
            }
            50% {
              transform: rotate(45deg) translateY(-6px);
            }
          }
          
          @keyframes bounce-icon {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          
          @keyframes pointer-pulse {
            0%, 100% {
              opacity: 1;
              transform: translateY(0px);
            }
            50% {
              opacity: 0.7;
              transform: translateY(2px);
            }
          }
        </style>
      `,
      iconSize: [90, 90],
      iconAnchor: [45, 90]
    });

    const marker = window.L.marker(
      [currentLocation.lat, currentLocation.lng],
      { icon: busIcon }
    ).addTo(map);

    const circle = window.L.circle(
      [currentLocation.lat, currentLocation.lng],
      {
        color: '#8b5cf6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.12,
        radius: 150,
        weight: 2,
        dashArray: '5, 10'
      }
    ).addTo(map);

    marker.bindPopup(`
      <div style="font-family: system-ui; padding: 10px; min-width: 220px;">
        <div style="font-size: 19px; font-weight: 700; color: #1e293b; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">
          🚌 ${busData?.busNumber || ''}
        </div>
        <div style="font-size: 13px; color: #64748b; line-height: 1.8;">
          <div style="margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 600; color: #475569;">Driver:</span> 
            <span>${busData?.driverName || 'N/A'}</span>
          </div>
          <div style="margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 600; color: #475569;">Status:</span> 
            <span>${busData?.isStale ? '⚠️ Stale' : '✅ Live'}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 600; color: #475569;">Updated:</span> 
            <span>${busData?.lastUpdate || 'N/A'}</span>
          </div>
        </div>
      </div>
    `).openPopup();

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;
  }, [currentLocation, busData]);

  // Change map type
  useEffect(() => {
    if (!mapRef.current || !layersRef.current.street) return;

    // Remove all layers
    Object.values(layersRef.current).forEach(layer => {
      if (mapRef.current.hasLayer(layer)) {
        mapRef.current.removeLayer(layer);
      }
    });

    // Add selected layer
    if (layersRef.current[mapType]) {
      layersRef.current[mapType].addTo(mapRef.current);
    }
  }, [mapType]);

  // Move marker when location updates
  useEffect(() => {
    if (!markerRef.current || !currentLocation || !mapRef.current) return;

    const newPos = [currentLocation.lat, currentLocation.lng];
    markerRef.current.setLatLng(newPos);
    if (circleRef.current) circleRef.current.setLatLng(newPos);
    mapRef.current.panTo(newPos, { animate: true, duration: 1 });
  }, [currentLocation]);

  // Start tracking a bus
  const startTrackingBus = (busId) => {
    if (!busId || !busId.trim()) {
      setError('Please enter a valid bus number');
      return;
    }

    const cleanId = busId.trim().toUpperCase();
    setError('');
    setTrackingBusId(cleanId);
    setShowTrackInput(false);
    fetchBusLocation(cleanId);

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    updateIntervalRef.current = setInterval(() => {
      fetchBusLocation(cleanId);
    }, 20000);
  };

  // Call backend to get bus location
  const fetchBusLocation = async (busId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/${busId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch bus location');
      }
      
      const responseData = await response.json();
      const data = responseData.bus;

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
      setError(error.message || 'Failed to fetch bus location');
      setBusData(null);
      setCurrentLocation(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualTrack = () => {
    setShowTrackInput(true);
  };

  const handleTrackSubmit = () => {
    if (inputValue.trim()) {
      startTrackingBus(inputValue);
      setInputValue('');
    }
  };

  // Cleanup intervals + map on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100">
      {/* Animated background blobs */}
      <div className="absolute inset-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Header - Fixed at top */}
      <header className="relative z-50 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl backdrop-blur-sm">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/25 backdrop-blur-md p-2.5 rounded-2xl shadow-lg">
                <Bus className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">BusTrackr</h1>
                <p className="text-xs text-white/90 hidden sm:block font-medium">Live Passenger Tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {trackingBusId && (
                <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-white/25 backdrop-blur-md rounded-full shadow-lg">
                  <div className="relative">
                    <Radio className="w-3.5 h-3.5 text-white" />
                    <div className="absolute inset-0 animate-ping">
                      <Radio className="w-3.5 h-3.5 text-white opacity-75" />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white">LIVE</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Alert - Fixed below header */}
      {error && (
        <div className="relative z-40 mx-3 sm:mx-4 mt-3 sm:mt-4 animate-in slide-in-from-top duration-300">
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 p-4 rounded-r-2xl shadow-2xl backdrop-blur-sm bg-white/95">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors p-1 hover:bg-red-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 h-[calc(100vh-64px)] sm:h-[calc(100vh-76px)]">
        {!trackingBusId ? (
          /* Landing View - Centered */
          <div className="flex items-center justify-center h-full px-4 py-8">
            <div className="w-full max-w-lg">
              {/* Hero Section */}
              <div className="text-center mb-10">
                <div className="relative inline-block mb-8">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[2rem] blur-2xl opacity-50 animate-pulse"></div>
                  <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-[2rem] shadow-2xl transform hover:rotate-12 hover:scale-110 transition-all duration-500">
                    <Navigation className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <h2 className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 leading-tight">
                  Track Your Bus
                </h2>
                <p className="text-slate-600 text-lg sm:text-xl font-medium max-w-md mx-auto">
                  Enter your bus number for real-time location tracking
                </p>
              </div>

              {/* Input Card */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2rem] blur-xl opacity-20"></div>
                <div className="relative bg-white/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-8 sm:p-10 border border-white/20">
                  {!showTrackInput ? (
                    <button
                      onClick={handleManualTrack}
                      className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold text-lg py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3 group"
                    >
                      <Bus className="w-6 h-6 group-hover:animate-bounce" strokeWidth={2.5} />
                      Enter Bus Number
                    </button>
                  ) : (
                    <div className="space-y-5">
                      <div className="relative">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                          onKeyPress={(e) => e.key === 'Enter' && handleTrackSubmit()}
                          placeholder="e.g., TN01AB1234"
                          className="w-full px-6 py-5 border-3 border-indigo-200 rounded-2xl text-lg font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all bg-white shadow-inner"
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleTrackSubmit}
                          disabled={!inputValue.trim()}
                          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none disabled:hover:scale-100 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <Zap className="w-5 h-5" strokeWidth={2.5} />
                          Track Now
                        </button>
                        <button
                          onClick={() => {
                            setShowTrackInput(false);
                            setInputValue('');
                          }}
                          className="px-6 py-4 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <p className="text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      Updates every 20 seconds automatically
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Map View - Full screen with minimal UI */
          <div className="h-full flex flex-col">
            {/* Compact Bus Info Bar */}
            <div className="relative bg-gradient-to-r from-white/98 to-indigo-50/98 backdrop-blur-xl border-b-2 border-indigo-200/50 px-3 py-2.5 sm:px-6 sm:py-3 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 p-2 sm:p-2.5 rounded-xl shadow-lg">
                    <Bus className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      Bus {trackingBusId}
                    </h3>
                    {busData && (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600 mt-0.5">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[100px] sm:max-w-none">{busData.driverName}</span>
                        </span>
                        <span className="hidden sm:flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {busData.lastUpdate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full shadow-md">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
                    <span className="text-[10px] sm:text-xs font-extrabold text-emerald-700 uppercase tracking-wide">Live</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      setTrackingBusId('');
                      setBusData(null);
                      setCurrentLocation(null);
                      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
                      if (mapRef.current) {
                        mapRef.current.remove();
                        mapRef.current = null;
                      }
                    }}
                    className="px-3 sm:px-4 py-1 sm:py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-full transition-all shadow-md hover:shadow-lg"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>

            {/* Map Container - Takes all remaining space */}
            <div className="flex-1 relative">
              <div id="map" className="w-full h-full"></div>
              
              {/* Map Type Switcher - Floating on map */}
              <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                <button
                  onClick={() => setMapType('street')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all backdrop-blur-md ${
                    mapType === 'street'
                      ? 'bg-indigo-600 text-white scale-105'
                      : 'bg-white/90 text-slate-700 hover:bg-white'
                  }`}
                  title="Street Map"
                >
                  🗺️ Street
                </button>
                <button
                  onClick={() => setMapType('satellite')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all backdrop-blur-md ${
                    mapType === 'satellite'
                      ? 'bg-indigo-600 text-white scale-105'
                      : 'bg-white/90 text-slate-700 hover:bg-white'
                  }`}
                  title="Satellite View"
                >
                  🛰️ Satellite
                </button>
                <button
                  onClick={() => setMapType('hybrid')}
                  className={`px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all backdrop-blur-md ${
                    mapType === 'hybrid'
                      ? 'bg-indigo-600 text-white scale-105'
                      : 'bg-white/90 text-slate-700 hover:bg-white'
                  }`}
                  title="Hybrid View"
                >
                  🌐 Hybrid
                </button>
              </div>
              
              {!window.L && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100/90 to-indigo-100/90 backdrop-blur-md">
                  <div className="text-center">
                    <div className="relative inline-block mb-6">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 shadow-2xl"></div>
                      <div className="absolute inset-0 animate-ping rounded-full border-4 border-indigo-400 opacity-20"></div>
                    </div>
                    <p className="text-slate-700 font-bold text-lg">Loading map...</p>
                    <p className="text-slate-500 text-sm mt-2">Please wait</p>
                  </div>
                </div>
              )}
            </div>

            {/* Minimal Footer Info - Floating */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
              <div className="bg-gradient-to-r from-indigo-600/95 via-purple-600/95 to-pink-600/95 backdrop-blur-xl px-5 py-2.5 rounded-full shadow-2xl border border-white/20">
                <div className="flex items-center justify-center gap-2 text-sm">
                  {loading ? (
                    <>
                      <div className="relative">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                        <div className="absolute inset-0 w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <span className="text-white font-bold text-xs sm:text-sm">Updating...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
                      <span className="text-white font-bold text-xs sm:text-sm">Auto-refresh: 20s</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;