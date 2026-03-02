import { useState } from 'react';
import { useApp } from '../context/AppContext';

const STEPS = [
  {
    icon: '🌱',
    title: 'Create Your Farm',
    description: 'Start by setting up your growing zones and beds in the Beds tab. Define the layout, dimensions, and sun exposure for each area of your garden.',
    tip: 'Tip: Use the quick-start presets for a fast setup, then customize names and dimensions to match your farm.',
  },
  {
    icon: '🌾',
    title: 'Select Your Crops',
    description: 'Go to the Crops tab and check the crops you want to grow this season. Choose from 265+ varieties across all categories — greens, roots, fruiting, herbs, and more.',
    tip: 'Tip: Use the search and family filters to quickly find the crops you need.',
  },
  {
    icon: '🍽️',
    title: 'Add Demand',
    description: 'Tell the planner what you need to grow. Create events in the Demand tab (retreats, markets, CSA, dinners), add manual demand in Season Plan, or both.',
    tip: 'Tip: Event-driven farmers can let the system calculate everything. Manual growers can add demand in kg per crop category.',
  },
  {
    icon: '📋',
    title: 'Generate Your Plan',
    description: 'Head to the Season Plan tab to preview and apply your garden plan. The engine allocates crops to beds based on demand, available space, and sun requirements.',
    tip: 'Tip: Use Merge mode to keep manual plantings intact, or Replace mode for a fresh start.',
  },
  {
    icon: '🪴',
    title: 'Nursery & Orders',
    description: 'Check the Nursery tab for your sowing calendar — when to start seeds, when to transplant. Set propagation methods per crop and export order lists for seeds and seedlings.',
    tip: 'Tip: Export CSV files to share with your seed supplier or nursery.',
  },
];

export default function WorkflowGuide({ open, onClose }) {
  const { theme, updateState } = useApp();
  const [step, setStep] = useState(0);

  if (!open) return null;

  const headingFont = "'DM Serif Display', serif";
  const bodyFont = "'Libre Franklin', sans-serif";
  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleClose = () => {
    updateState(prev => ({
      ...prev,
      setupProgress: { ...prev.setupProgress, guideSeen: true },
    }));
    setStep(0);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: theme.bgCard,
        borderRadius: '16px',
        width: '90%',
        maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #5d4e37, #3e6b48)',
          padding: '24px 28px 20px',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontFamily: headingFont, fontSize: '20px', letterSpacing: '0.5px' }}>
              Welcome to BioGrow
            </h2>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                width: '28px', height: '28px', cursor: 'pointer', color: '#fff',
                fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', opacity: 0.85, fontFamily: bodyFont }}>
            5 steps to plan your bio-intensive market garden
          </p>
        </div>

        {/* Step indicator dots */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px 0 0',
        }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                border: 'none',
                background: i === step ? theme.accent : theme.border,
                cursor: 'pointer',
                transition: 'all 0.3s',
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Step Content */}
        <div style={{ padding: '20px 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>{currentStep.icon}</div>
            <h3 style={{
              margin: '0 0 4px', fontFamily: headingFont, color: theme.text,
              fontSize: '18px',
            }}>
              Step {step + 1}: {currentStep.title}
            </h3>
          </div>
          <p style={{
            fontSize: '13px', color: theme.text, lineHeight: '1.6',
            margin: '0 0 12px', fontFamily: bodyFont,
          }}>
            {currentStep.description}
          </p>
          <div style={{
            padding: '10px 14px', borderRadius: '8px',
            background: theme.accentLight || '#e8f5e9',
            fontSize: '12px', color: theme.accent,
            fontFamily: bodyFont, lineHeight: '1.5',
          }}>
            💡 {currentStep.tip}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '0 28px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          flexWrap: 'wrap', gap: '10px',
        }}>
          <span style={{ fontSize: '11px', color: theme.textMuted, fontFamily: bodyFont, marginRight: 'auto' }}>
            Reopen anytime with ❓ in the header
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isFirst && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  border: `1px solid ${theme.border}`, background: 'transparent',
                  color: theme.text, fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', fontFamily: bodyFont,
                }}
              >
                ← Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #5d4e37, #3e6b48)',
                  color: '#fff', fontSize: '13px', fontWeight: '700',
                  cursor: 'pointer', fontFamily: bodyFont,
                }}
              >
                Get Started 🌱
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #5d4e37, #3e6b48)',
                  color: '#fff', fontSize: '13px', fontWeight: '700',
                  cursor: 'pointer', fontFamily: bodyFont,
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
