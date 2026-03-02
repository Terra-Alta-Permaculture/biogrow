/**
 * Shared weather service — centralized Open-Meteo API access with caching.
 * Used by WeatherTab, IrrigationTab, WeatherAlertBanner.
 */

const CACHE_KEY = 'biogrow-weather-cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let memoryCache = null; // { data, timestamp, lat, lng }

// --- WMO weather codes (extracted from WeatherTab) ---
export const WMO_CODES = {
  0: { icon: '☀️', desc: 'Clear sky' }, 1: { icon: '🌤️', desc: 'Mainly clear' },
  2: { icon: '⛅', desc: 'Partly cloudy' }, 3: { icon: '☁️', desc: 'Overcast' },
  45: { icon: '🌫️', desc: 'Foggy' }, 48: { icon: '🌫️', desc: 'Rime fog' },
  51: { icon: '🌦️', desc: 'Light drizzle' }, 53: { icon: '🌦️', desc: 'Drizzle' },
  55: { icon: '🌧️', desc: 'Heavy drizzle' }, 61: { icon: '🌧️', desc: 'Light rain' },
  63: { icon: '🌧️', desc: 'Rain' }, 65: { icon: '🌧️', desc: 'Heavy rain' },
  71: { icon: '🌨️', desc: 'Light snow' }, 73: { icon: '🌨️', desc: 'Snow' },
  75: { icon: '❄️', desc: 'Heavy snow' }, 80: { icon: '🌦️', desc: 'Rain showers' },
  81: { icon: '🌧️', desc: 'Moderate showers' }, 82: { icon: '⛈️', desc: 'Heavy showers' },
  95: { icon: '⛈️', desc: 'Thunderstorm' }, 96: { icon: '⛈️', desc: 'Storm w/ hail' },
  99: { icon: '⛈️', desc: 'Storm w/ heavy hail' },
};

export function getWmo(code) {
  return WMO_CODES[code] || { icon: '❓', desc: 'Unknown' };
}

// --- Alert thresholds ---
export const THRESHOLDS = {
  frost: 2,       // tempMin <= 2°C
  heatStress: 32, // tempMax > 32°C
  heavyRain: 15,  // precipitation > 15mm
  strongWind: 40, // wind > 40 km/h
};

// --- Farm condition badges for a forecast day ---
export function getFarmConditions(day) {
  const conditions = [];
  if (day.tempMin <= THRESHOLDS.frost) conditions.push({ icon: '🥶', label: 'Frost Risk', color: '#90caf9' });
  if (day.tempMax > THRESHOLDS.heatStress) conditions.push({ icon: '🔥', label: 'Heat Stress', color: '#ef5350' });
  if (day.rain > THRESHOLDS.heavyRain) conditions.push({ icon: '🌊', label: 'Heavy Rain', color: '#42a5f5' });
  if (day.wind > THRESHOLDS.strongWind) conditions.push({ icon: '💨', label: 'Strong Wind', color: '#78909c' });
  if (day.tempMin > 5 && day.tempMax < 28 && day.rain < 5 && day.wind < 20) {
    conditions.push({ icon: '🌱', label: 'Good Planting Day', color: '#66bb6a' });
  }
  if (day.tempMin > 10 && day.tempMax < 26 && day.rain < 2 && day.wind < 15) {
    conditions.push({ icon: '✨', label: 'Perfect Day', color: '#ffd54f' });
  }
  return conditions;
}

// --- Core fetch with dual cache ---
export async function fetchWeatherData(lat, lng, options = {}) {
  const { forceRefresh = false } = options;

  // 1. Check memory cache
  if (!forceRefresh && memoryCache
      && memoryCache.lat === lat && memoryCache.lng === lng
      && (Date.now() - memoryCache.timestamp) < CACHE_TTL) {
    return { data: memoryCache.data, source: 'memory' };
  }

  // 2. Check localStorage cache
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached && cached.lat === lat && cached.lng === lng
          && (Date.now() - cached.timestamp) < CACHE_TTL) {
        memoryCache = cached;
        return { data: cached.data, source: 'localStorage' };
      }
    } catch {}
  }

  // 3. Fetch from Open-Meteo
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
      + `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,et0_fao_evapotranspiration`
      + `&current_weather=true&timezone=auto&forecast_days=10`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entry = { data, lat, lng, timestamp: Date.now() };
    memoryCache = entry;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch {}
    return { data, source: 'api' };
  } catch (err) {
    // 4. Offline fallback: return stale cache
    if (memoryCache?.data) return { data: memoryCache.data, source: 'stale' };
    try {
      const stale = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (stale?.data) return { data: stale.data, source: 'stale' };
    } catch {}
    throw err;
  }
}

// --- Parse daily array into day objects ---
export function parseDailyForecast(weatherData) {
  if (!weatherData?.daily) return [];
  return weatherData.daily.time.map((date, i) => ({
    date,
    code: weatherData.daily.weathercode[i],
    tempMax: weatherData.daily.temperature_2m_max[i],
    tempMin: weatherData.daily.temperature_2m_min[i],
    rain: weatherData.daily.precipitation_sum[i],
    wind: weatherData.daily.windspeed_10m_max[i],
    et0: weatherData.daily.et0_fao_evapotranspiration[i],
  }));
}

// --- Get weather alerts for next N days ---
export function getWeatherAlerts(days, maxDays = 3) {
  return days.slice(0, maxDays).filter(d =>
    d.tempMin <= THRESHOLDS.frost ||
    d.tempMax > THRESHOLDS.heatStress ||
    d.rain > THRESHOLDS.heavyRain ||
    d.wind > THRESHOLDS.strongWind
  ).map(d => {
    const types = [];
    if (d.tempMin <= THRESHOLDS.frost) types.push({ type: 'frost', icon: '🥶', label: 'Frost risk', detail: `${d.tempMin}°C min` });
    if (d.tempMax > THRESHOLDS.heatStress) types.push({ type: 'heat', icon: '🔥', label: 'Heat stress', detail: `${d.tempMax}°C max` });
    if (d.rain > THRESHOLDS.heavyRain) types.push({ type: 'rain', icon: '🌊', label: 'Heavy rain', detail: `${d.rain}mm` });
    if (d.wind > THRESHOLDS.strongWind) types.push({ type: 'wind', icon: '💨', label: 'Strong wind', detail: `${d.wind}km/h` });
    return { ...d, alerts: types };
  });
}
