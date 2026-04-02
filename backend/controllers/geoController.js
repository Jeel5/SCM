import axios from 'axios';
import { asyncHandler } from '../errors/index.js';

export const reverseGeocode = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ success: false, error: 'lat and lon are required' });
    return;
  }

  const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: {
      format: 'jsonv2',
      lat,
      lon,
      zoom: 14,
      addressdetails: 1,
    },
    headers: {
      'User-Agent': 'SCM-Demo/1.0 (local development)',
      'Accept-Language': 'en',
    },
    timeout: 10000,
  });

  res.json({
    success: true,
    name: response.data?.name || response.data?.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    display_name: response.data?.display_name || response.data?.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    address: response.data?.address || {},
  });
});
