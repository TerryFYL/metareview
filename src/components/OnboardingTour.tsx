import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { t, type Lang } from '../lib/i18n';
import { trackFeature } from '../lib/analytics';

interface TourStep {
  target: string; // data-tour attribute value
  titleKey: string;
  descKey: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  tabSwitch?: string; // tab to switch to before showing this step
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'tab-search',
    titleKey: 'tour.step1.title',
    descKey: 'tour.step1.desc',
    placement: 'bottom',
  },
  {
    target: 'tab-input',
    titleKey: 'tour.step2.title',
    descKey: 'tour.step2.desc',
    placement: 'bottom',
    tabSwitch: 'input',
  },
  {
    target: 'import-csv',
    titleKey: 'tour.step3.title',
    descKey: 'tour.step3.desc',
    placement: 'top',
    tabSwitch: 'input',
  },
  {
    target: 'run-analysis',
    titleKey: 'tour.step4.title',
    descKey: 'tour.step4.desc',
    placement: 'top',
    tabSwitch: 'input',
  },
  {
    target: 'tab-forest',
    titleKey: 'tour.step5.title',
    descKey: 'tour.step5.desc',
    placement: 'bottom',
  },
];

interface OnboardingTourProps {
  lang: Lang;
  onComplete: () => void;
  onTabSwitch?: (tab: string) => void;
}

export default function OnboardingTour({ lang, onComplete, onTabSwitch }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 300,
    zIndex: 10002,
  });
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -999, left: -999, zIndex: 10003 });
  const [arrowDir, setArrowDir] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onTabSwitchRef = useRef(onTabSwitch);
  onTabSwitchRef.current = onTabSwitch;

  const currentStep = TOUR_STEPS[step];

  const positionTooltip = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    const tooltipW = 300;
    const tooltipH = tooltipRef.current?.offsetHeight || 140;
    const gap = 12;

    let top = 0;
    let left = 0;
    const placement = currentStep.placement;

    switch (placement) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case 'top':
        top = rect.top - tooltipH - gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + gap;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - tooltipW - gap;
        break;
    }

    // Clamp within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: tooltipW,
      zIndex: 10002,
    });

    // Arrow pointing at target
    const arrowSize = 8;
    let aTop = 0;
    let aLeft = 0;
    let aDir: 'top' | 'bottom' | 'left' | 'right' = 'top';

    switch (placement) {
      case 'bottom':
        aTop = top - arrowSize;
        aLeft = rect.left + rect.width / 2 - arrowSize;
        aDir = 'top';
        break;
      case 'top':
        aTop = top + tooltipH;
        aLeft = rect.left + rect.width / 2 - arrowSize;
        aDir = 'bottom';
        break;
      case 'right':
        aTop = rect.top + rect.height / 2 - arrowSize;
        aLeft = left - arrowSize;
        aDir = 'left';
        break;
      case 'left':
        aTop = rect.top + rect.height / 2 - arrowSize;
        aLeft = left + tooltipW;
        aDir = 'right';
        break;
    }

    setArrowStyle({ position: 'fixed', top: aTop, left: aLeft, zIndex: 10003 });
    setArrowDir(aDir);

    // Highlight target element
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentStep]);

  // Handle tab switching separately with stable ref
  useEffect(() => {
    if (currentStep?.tabSwitch && onTabSwitchRef.current) {
      onTabSwitchRef.current(currentStep.tabSwitch);
    }
  }, [step, currentStep]);

  // Position tooltip: immediately after DOM commit + delayed for tab switch content
  useLayoutEffect(() => {
    positionTooltip();
    // Also run after delay to handle tab switch content rendering
    const timer = setTimeout(positionTooltip, 200);
    window.addEventListener('resize', positionTooltip);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', positionTooltip);
    };
  }, [step, positionTooltip]);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      trackFeature('tour_completed');
      onComplete();
    }
  };

  const handleSkip = useCallback(() => {
    trackFeature('tour_skipped');
    onComplete();
  }, [onComplete]);

  // Focus trap: Escape to close + Tab cycling within tooltip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
        return;
      }
      if (e.key === 'Tab') {
        const tooltip = tooltipRef.current;
        if (!tooltip) return;
        const focusable = tooltip.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // Auto-focus tooltip on step change
  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const timer = setTimeout(() => {
      const firstBtn = tooltip.querySelector<HTMLElement>('button');
      firstBtn?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, [step]);

  if (!currentStep) return null;

  const arrowBorders: Record<string, React.CSSProperties> = {
    top: { borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid #fff' },
    bottom: { borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid #fff' },
    left: { borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderRight: '8px solid #fff' },
    right: { borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '8px solid #fff' },
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 10000,
        }}
        onClick={handleSkip}
      />

      {/* Spotlight cutout on target */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 6,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            zIndex: 10001,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Arrow */}
      <div style={{ ...arrowStyle, width: 0, height: 0, ...arrowBorders[arrowDir] }} />

      {/* Tooltip */}
      <div ref={tooltipRef} role="dialog" aria-modal="true" aria-label={t(currentStep.titleKey, lang)} style={{ ...tooltipStyle, background: '#fff', borderRadius: 10, padding: '18px 20px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 3,
                borderRadius: 2,
                background: i <= step ? '#2563eb' : '#e5e7eb',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
          {t(currentStep.titleKey, lang)}
        </h4>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>
          {t(currentStep.descKey, lang)}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={handleSkip} style={skipBtnStyle}>
            {t('tour.skip', lang)}
          </button>
          <button onClick={handleNext} style={nextBtnStyle}>
            {step < TOUR_STEPS.length - 1 ? t('tour.next', lang) : t('tour.done', lang)}
          </button>
        </div>
      </div>
    </>
  );
}

const skipBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#9ca3af',
  fontSize: 12,
  cursor: 'pointer',
  padding: '4px 8px',
};

const nextBtnStyle: React.CSSProperties = {
  padding: '7px 18px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
