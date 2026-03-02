import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from './shared';
import { fetchWeatherData, parseDailyForecast, getWeatherAlerts } from '../utils/weatherService';
import { checkAndNotifyFrost } from '../utils/weatherAlertNotifier';

const DISMISS_KEY = 'biogrow-weather-alert-dismissed';

function getAlertHash(alertDays) {
  return alertDays.map(d => `${d.date}:${d.alerts.map(a => a.type).join(',')}`).join('|');
}

export default function WeatherAlertBanner({ onNavigate }) {
  const { zones, crops, settings, theme, showToast } = useApp();
  const [alertDays, setAlertDays] = useState([]);
  const [dataSource, setDataSource] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const toastFired = useRef(false);

  const lat = settings.location?.lat;
  const lng = settings.location?.lng;

  // Get warm-season plantings
  const warmPlantings = useMemo(() => {
    const currentYear = settings.currentYear || new Date().getFullYear();
    const result = [];
    zones.forEach(z => z.beds.forEach(b => {
      (b.plantings || []).forEach(p => {
        if (p.year !== currentYear) return;
        const crop = crops.find(c => c.id === p.cropId);
        if (crop?.season === 'warm') {
          result.push({ cropId: p.cropId, cropName: crop.name, cropIcon: crop.icon, bed: b.name, zone: z.name });
        }
      });
    }));
    return result;
  }, [zones, crops, settings.currentYear]);

  // Fetch weather and compute alerts
  useEffect(() => {
    if (!lat || !lng) return;
    let cancelled = false;
    fetchWeatherData(lat, lng)
      .then(({ data, source }) => {
        if (cancelled) return;
        const days = parseDailyForecast(data);
        const alerts = getWeatherAlerts(days, 3);
        setAlertDays(alerts);
        setDataSource(source);

        // Check dismiss state
        try {
          const stored = JSON.parse(localStorage.getItem(DISMISS_KEY));
          if (stored) {
            const hash = getAlertHash(alerts);
            const expired = (Date.now() - stored.timestamp) > 24 * 60 * 60 * 1000;
            if (!expired && stored.alertHash === hash) {
              setDismissed(true);
            }
          }
        } catch {}
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lng]);

  // Fire frost toast notification (once per session)
  useEffect(() => {
    if (toastFired.current || alertDays.length === 0 || !dataSource) return;
    // Need the full day data for the notifier
    if (!lat || !lng) return;
    fetchWeatherData(lat, lng).then(({ data, source }) => {
      if (toastFired.current) return;
      const days = parseDailyForecast(data);
      toastFired.current = true;
      checkAndNotifyFrost({ days, warmPlantings, showToast, source });
    }).catch(() => {});
  }, [alertDays, dataSource, warmPlantings, showToast, lat, lng]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({
        timestamp: Date.now(),
        alertHash: getAlertHash(alertDays),
      }));
    } catch {}
  };

  // Don't render if no alerts, dismissed, or no location
  if (!lat || !lng || alertDays.length === 0 || dismissed) return null;

  const hasFrost = alertDays.some(d => d.alerts.some(a => a.type === 'frost'));
  const borderColor = hasFrost ? '#90caf9' : '#ff9800';

  return (
    <Card style={{ marginBottom: '16px', borderLeft: `4px solid ${borderColor}`, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <h4 style={{ margin: '0 0 8px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '14px' }}>
          🌡️ Weather Alerts
          {dataSource === 'stale' && <span style={{ fontSize: '11px', fontWeight: '400', color: theme.textMuted }}> (last known data)</span>}
        </h4>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '16px', padding: '0 2px', lineHeight: '1' }}
        >×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {alertDays.map(d => {
          const dayName = new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
          return d.alerts.map((alert, j) => {
            let extra = '';
            if (alert.type === 'frost' && warmPlantings.length > 0) {
              const cropNames = [...new Set(warmPlantings.map(p => p.cropName))];
              const list = cropNames.length <= 3 ? cropNames.join(', ') : `${cropNames.slice(0, 3).join(', ')} +${cropNames.length - 3} more`;
              extra = ` — ${warmPlantings.length} warm crop${warmPlantings.length !== 1 ? 's' : ''} at risk (${list})`;
            }
            return (
              <div key={`${d.date}-${j}`} style={{ fontSize: '12px', color: theme.text, lineHeight: '1.5' }}>
                {alert.icon} <strong>{alert.label}</strong> {dayName} ({alert.detail}){extra}
              </div>
            );
          });
        })}
      </div>

      {onNavigate && (
        <div style={{ marginTop: '8px', textAlign: 'right' }}>
          <button
            onClick={() => onNavigate('weather')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: theme.accent, fontSize: '12px', fontWeight: '600',
              fontFamily: "'Libre Franklin', sans-serif", padding: 0,
              textDecoration: 'underline',
            }}
          >
            View Forecast →
          </button>
        </div>
      )}
    </Card>
  );
}
