import { useApp } from '../context/AppContext';

export default function StepProgressBar({ steps, currentStep, onStepClick }) {
  const { theme } = useApp();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 0',
      gap: '0',
    }}>
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isComplete = step.complete;
        const isActive = stepNum === currentStep;
        const isLocked = stepNum > 1 && !steps[i - 1].complete && stepNum !== currentStep;
        const canClick = isComplete || isActive || (stepNum <= currentStep);

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            {/* Step circle + label */}
            <div
              onClick={() => canClick && onStepClick(stepNum)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: canClick ? 'pointer' : 'default',
                opacity: isLocked ? 0.4 : 1,
                minWidth: '70px',
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isComplete ? '16px' : '14px',
                fontWeight: '700',
                fontFamily: "'Libre Franklin', sans-serif",
                background: isComplete ? theme.accent : isActive ? 'transparent' : 'transparent',
                color: isComplete ? '#fff' : isActive ? theme.accent : theme.textMuted,
                border: isComplete ? 'none' : `2px solid ${isActive ? theme.accent : theme.border}`,
                transition: 'all 0.3s',
              }}>
                {isComplete ? '✓' : step.icon || stepNum}
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? theme.accent : isComplete ? theme.text : theme.textMuted,
                marginTop: '6px',
                fontFamily: "'Libre Franklin', sans-serif",
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: '2px',
                background: steps[i].complete ? theme.accent : theme.border,
                margin: '0 8px',
                marginBottom: '20px',
                transition: 'background 0.3s',
                minWidth: '20px',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
