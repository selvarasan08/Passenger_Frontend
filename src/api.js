import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/bus';

export const startDriverTracking = (busNumber, driverName, lat, lng) =>
  axios.post(`${API_URL}/start-tracking`, {
    busNumber: busNumber.trim(),
    driverName: driverName.trim(),
    latitude: lat,
    longitude: lng,
  });

export const updateDriverLocation = (busNumber, lat, lng) =>
  axios.post(`${API_URL}/update-location`, {
    busNumber: busNumber.trim(),
    latitude: lat,
    longitude: lng,
  });

export const stopDriverTracking = (busNumber) =>
  axios.post(`${API_URL}/stop-tracking`, { busNumber: busNumber.trim() });

export const fetchBusLocation = (busId) =>
  axios.get(`${API_URL}/${busId.toUpperCase()}`);
