import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Card, SummaryCard, Button, FormField, Input, Badge } from '../components/shared';
import { WMO_CODES, getWmo, getFarmConditions, fetchWeatherData, parseDailyForecast } from '../utils/weatherService';

export default function WeatherTab() {
  const { settings, updateState, theme } = useApp();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [latInput, setLatInput] = useState(settings.location?.lat?.toString() || '38.72');
  const [lngInput, setLngInput] = useState(settings.location?.lng?.toString() || '-9.14');

  const loadWeather = useCallback(async (lat, lng) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await fetchWeatherData(lat, lng);
      setWeather(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (settings.location?.lat && settings.location?.lng) {
      loadWeather(settings.location.lat, settings.location.lng);
    }
  }, [settings.location?.lat, settings.location?.lng, loadWeather]);

  const saveLocation = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) return;
    updateState(prev => ({ ...prev, settings: { ...prev.settings, location: { lat, lng } } }));
  };

  const useGeoLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setLatInput(lat);
        setLngInput(lng);
        updateState(prev => ({ ...prev, settings: { ...prev.settings, location: { lat: parseFloat(lat), lng: parseFloat(lng) } } }));
      },
      () => setError('Location access denied')
    );
  };

  const days = parseDailyForecast(weather);
  const alerts = days.filter(d => d.tempMin <= 2 || d.tempMax > 32 || d.rain > 15 || d.wind > 40);
  const weeklyET0 = days.slice(0, 7).reduce((s, d) => s + (d.et0 || 0), 0);
  const weeklyRain = days.slice(0, 7).reduce((s, d) => s + (d.rain || 0), 0);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontFamily: "'DM Serif Display', serif", color: theme.text }}>🌤️ Farm Weather</h2>

      {/* Location setup */}
      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>📍 Farm Location</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <FormField label="Latitude" style={{ marginBottom: 0, flex: '1 1 120px' }}>
            <Input value={latInput} onChange={e => setLatInput(e.target.value)} placeholder="38.72" />
          </FormField>
          <FormField label="Longitude" style={{ marginBottom: 0, flex: '1 1 120px' }}>
            <Input value={lngInput} onChange={e => setLngInput(e.target.value)} placeholder="-9.14" />
          </FormField>
          <Button onClick={saveLocation}>Update</Button>
          <Button variant="secondary" onClick={useGeoLocation}>📍 Use GPS</Button>
        </div>
        {settings.location && <p style={{ margin: '8px 0 0', fontSize: '12px', color: theme.textMuted }}>Current: {settings.location.lat}°N, {settings.location.lng}°E</p>}
      </Card>

      {loading && <Card><p style={{ color: theme.textMuted, textAlign: 'center' }}>Loading weather data...</p></Card>}
      {error && <Card><p style={{ color: theme.error, textAlign: 'center' }}>⚠️ {error}</p></Card>}

      {weather && !loading && (
        <>
          {/* Current conditions */}
          {weather.current_weather && (
            <Card style={{ marginBottom: '24px', background: theme.accentLight }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '48px' }}>{getWmo(weather.current_weather.weathercode).icon}</span>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: '700', color: theme.text, fontFamily: "'DM Serif Display', serif" }}>{weather.current_weather.temperature}°C</div>
                  <div style={{ fontSize: '14px', color: theme.textSecondary }}>{getWmo(weather.current_weather.weathercode).desc}</div>
                  <div style={{ fontSize: '12px', color: theme.textMuted }}>Wind: {weather.current_weather.windspeed} km/h</div>
                </div>
              </div>
            </Card>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <Card style={{ marginBottom: '24px', borderLeft: `4px solid ${theme.warning}` }}>
              <h3 style={{ margin: '0 0 8px', fontFamily: "'DM Serif Display', serif", color: theme.warning, fontSize: '16px' }}>⚠️ Farm Weather Alerts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {alerts.map(d => {
                  const issues = [];
                  if (d.tempMin <= 2) issues.push('🥶 Frost risk');
                  if (d.tempMax > 32) issues.push('🔥 Heat stress');
                  if (d.rain > 15) issues.push('🌊 Heavy rain');
                  if (d.wind > 40) issues.push('💨 Strong wind');
                  return (
                    <div key={d.date} style={{ fontSize: '13px', color: theme.text }}>
                      <strong>{new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}</strong>: {issues.join(', ')}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Weekly irrigation guidance */}
          <Card style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>💧 Weekly Irrigation Guidance</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>Weekly ET₀</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: theme.accent }}>{weeklyET0.toFixed(1)} mm</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>Expected Rainfall</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#42a5f5' }}>{weeklyRain.toFixed(1)} mm</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>Irrigation Deficit</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: weeklyET0 > weeklyRain ? theme.warning : theme.success }}>
                  {Math.max(0, weeklyET0 - weeklyRain).toFixed(1)} mm
                </div>
              </div>
            </div>
            {weeklyET0 > weeklyRain && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: theme.warning }}>
                ⚠️ Irrigation needed this week. Deficit of {(weeklyET0 - weeklyRain).toFixed(1)} mm.
              </p>
            )}
          </Card>

          {/* 10-day forecast */}
          <h3 style={{ margin: '0 0 12px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '16px' }}>10-Day Forecast</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {days.map((d, i) => {
              const wmo = getWmo(d.code);
              const conditions = getFarmConditions(d);
              const dateObj = new Date(d.date);
              return (
                <Card key={d.date} style={{ textAlign: 'center', border: i === 0 ? `2px solid ${theme.accent}` : undefined }}>
                  <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
                    {dateObj.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '36px', margin: '4px 0' }}>{wmo.icon}</div>
                  <div style={{ fontSize: '11px', color: theme.textSecondary, marginBottom: '6px' }}>{wmo.desc}</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: theme.text }}>
                    <span style={{ color: '#e53935' }}>{d.tempMax}°</span>
                    <span style={{ color: theme.textMuted, margin: '0 4px' }}>/</span>
                    <span style={{ color: '#42a5f5' }}>{d.tempMin}°</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '6px', fontSize: '12px', color: theme.textSecondary }}>
                    <span>🌧️ {d.rain}mm</span>
                    <span>💨 {d.wind}km/h</span>
                  </div>
                  {conditions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                      {conditions.map((c, j) => (
                        <Badge key={j} bg={c.color} color="#fff" style={{ fontSize: '10px' }}>{c.icon} {c.label}</Badge>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
