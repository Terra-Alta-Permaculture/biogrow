import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button } from './shared';
import { estimateFrostDates } from '../utils/frostDateEstimator';
import { weekToMonth } from '../utils/helpers';

const DISMISS_KEY = 'biogrow-frost-suggestion-dismissed';

function locationKey(lat, lng) {
  return `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
}

export default function FrostDateSuggestion() {
  const { settings, updateState, theme } = useApp();
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(true);

  const lat = settings.location?.lat;
  const lng = settings.location?.lng;

  useEffect(() => {
    if (!lat || !lng) return;

    // Already auto-detected for this location?
    if (settings.frostDatesSource === 'auto') {
      setHidden(true);
      return;
    }

    // Previously dismissed for this location?
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === locationKey(lat, lng)) {
        setHidden(true);
        return;
      }
    } catch {}

    setLoading(true);
    setHidden(false);
    estimateFrostDates(lat, lng)
      .then(result => {
        setEstimate(result);
        setLoading(false);
      })
      .catch(() => {
        setHidden(true);
        setLoading(false);
      });
  }, [lat, lng, settings.frostDatesSource]);

  const handleAccept = () => {
    if (!estimate) return;
    updateState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        lastFrostWeek: estimate.lastFrostWeek,
        firstFrostWeek: estimate.firstFrostWeek,
        frostDatesSource: 'auto',
      },
    }));
    setHidden(true);
  };

  const handleDismiss = () => {
    setHidden(true);
    if (lat && lng) {
      try { localStorage.setItem(DISMISS_KEY, locationKey(lat, lng)); } catch {}
    }
  };

  if (hidden || (!loading && !estimate)) return null;

  return (
    <Card style={{ marginBottom: '16px', borderLeft: '4px solid #90caf9', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <h4 style={{ margin: '0 0 6px', fontFamily: "'DM Serif Display', serif", color: theme.text, fontSize: '14px' }}>
          ❄️ Frost Date Suggestion
        </h4>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: '16px', padding: '0 2px', lineHeight: '1' }}
        >×</button>
      </div>

      {loading ? (
        <div style={{ fontSize: '12px', color: theme.textMuted, padding: '4px 0' }}>Analyzing historical weather data...</div>
      ) : estimate ? (
        <>
          <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '8px' }}>
            Based on {estimate.yearsAnalyzed} years of weather history for your location:
          </div>
          {estimate.frostFreeClimate ? (
            <div style={{ fontSize: '13px', color: theme.text, marginBottom: '8px' }}>
              🌴 No frost detected in historical records — your location appears frost-free. Current frost dates will be kept as defaults.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>Last Frost</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#42a5f5' }}>
                  ~Week {estimate.lastFrostWeek} <span style={{ fontSize: '12px', fontWeight: '400', color: theme.textSecondary }}>({weekToMonth(estimate.lastFrostWeek)})</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>First Frost</div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#ef5350' }}>
                  ~Week {estimate.firstFrostWeek} <span style={{ fontSize: '12px', fontWeight: '400', color: theme.textSecondary }}>({weekToMonth(estimate.firstFrostWeek)})</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>Confidence</div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: estimate.confidence === 'high' ? '#2e7d32' : estimate.confidence === 'medium' ? '#f9a825' : theme.textMuted }}>
                  {estimate.confidence === 'high' ? '🟢' : estimate.confidence === 'medium' ? '🟡' : '🔴'} {estimate.confidence.charAt(0).toUpperCase() + estimate.confidence.slice(1)}
                </div>
              </div>
            </div>
          )}
          {!estimate.frostFreeClimate && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={handleAccept} style={{ padding: '6px 16px', fontSize: '12px' }}>Accept</Button>
              <Button variant="secondary" onClick={handleDismiss} style={{ padding: '6px 16px', fontSize: '12px' }}>Keep Current</Button>
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}
