import { useState } from 'react';
import { t, type Lang } from '../lib/i18n';
import { trackEvent } from '../lib/analytics';

interface Props {
  lang: Lang;
}

const ROLES = [
  { value: 'grad', zh: '研究生', en: 'Graduate student' },
  { value: 'phd', zh: '博士生', en: 'PhD student' },
  { value: 'postdoc', zh: '博士后', en: 'Postdoc' },
  { value: 'pi', zh: 'PI / 教授', en: 'PI / Professor' },
  { value: 'clinician', zh: '临床医生', en: 'Clinician' },
  { value: 'other', zh: '其他', en: 'Other' },
];

export default function FeedbackButton({ lang }: Props) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('');
  const [completed, setCompleted] = useState('');
  const [stuck, setStuck] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleOpen = () => {
    setOpen(true);
    trackEvent('feedback_open');
  };

  const handleClose = () => {
    setOpen(false);
    if (status === 'sent') {
      setRole('');
      setCompleted('');
      setStuck('');
      setStatus('idle');
    }
  };

  const handleSubmit = async () => {
    if (!role && !completed && !stuck) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, completed, stuck }),
      });
      if (res.ok) {
        setStatus('sent');
        trackEvent('feedback_submit', { role });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={handleOpen}
        aria-label={t('feedback.trigger', lang)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontSize: 20,
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Feedback panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('feedback.title', lang)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 320,
            maxHeight: 'calc(100vh - 48px)',
            overflowY: 'auto',
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            zIndex: 10000,
            padding: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
              {t('feedback.title', lang)}
            </span>
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280', fontSize: 18, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>

          {status === 'sent' ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
              <p style={{ fontSize: 14, color: '#374151', margin: 0 }}>
                {t('feedback.thanks', lang)}
              </p>
            </div>
          ) : (
            <>
              {/* Q1: Role */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>
                  {t('feedback.q1', lang)}
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  style={selectSt}
                >
                  <option value="">{t('feedback.selectRole', lang)}</option>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {lang === 'zh' ? r.zh : r.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Q2: Completed */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>
                  {t('feedback.q2', lang)}
                </label>
                <textarea
                  value={completed}
                  onChange={e => setCompleted(e.target.value)}
                  placeholder={t('feedback.q2Placeholder', lang)}
                  rows={2}
                  style={textareaSt}
                />
              </div>

              {/* Q3: Stuck */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelSt}>
                  {t('feedback.q3', lang)}
                </label>
                <textarea
                  value={stuck}
                  onChange={e => setStuck(e.target.value)}
                  placeholder={t('feedback.q3Placeholder', lang)}
                  rows={2}
                  style={textareaSt}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={status === 'sending' || (!role && !completed && !stuck)}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: status === 'sending' ? 'wait' : 'pointer',
                  opacity: status === 'sending' || (!role && !completed && !stuck) ? 0.6 : 1,
                }}
              >
                {status === 'sending' ? t('feedback.sending', lang) : t('feedback.submit', lang)}
              </button>

              {status === 'error' && (
                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8, textAlign: 'center' }}>
                  {t('feedback.error', lang)}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

const labelSt: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 4,
};

const selectSt: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  background: '#fff',
};

const textareaSt: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  resize: 'vertical',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
