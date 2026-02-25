import { useState } from 'react';
import { t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';
import { trackEvent } from '../lib/analytics';

interface HeroSectionProps {
  lang: Lang;
  onGetStarted: () => void;
  onLoadDemo: () => void;
  onSwitchLang: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function HeroSection({ lang, onGetStarted, onLoadDemo, onSwitchLang }: HeroSectionProps) {
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'submitting' | 'success' | 'already' | 'error' | 'invalid'>('idle');

  const handleStart = () => {
    trackEvent('hero_cta_start');
    onGetStarted();
  };
  const handleDemo = () => {
    trackEvent('hero_cta_demo');
    onLoadDemo();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      setEmailState('invalid');
      return;
    }
    setEmailState('submitting');
    try {
      const res = await fetch('/api/emails/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'hero', lang }),
      });
      const data = await res.json();
      if (data.ok) {
        setEmailState(data.already ? 'already' : 'success');
        trackEvent('email_subscribe', { source: 'hero' });
      } else {
        setEmailState(data.error === 'invalid_email' ? 'invalid' : 'error');
      }
    } catch {
      setEmailState('error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Top bar */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>MetaReview</span>
        <button onClick={onSwitchLang} style={langBtnStyle}>
          {lang === 'zh' ? 'EN' : '\u4e2d\u6587'}
        </button>
      </div>

      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '80px 16px 48px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '4px 14px', background: '#eff6ff', borderRadius: 20, fontSize: 13, color: '#2563eb', fontWeight: 500, marginBottom: 20 }}>
          {t('hero.badge', lang)}
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 800, color: '#111827', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {t('hero.title', lang)}
        </h1>
        <p style={{ fontSize: 18, color: '#4b5563', margin: '0 0 12px', lineHeight: 1.6 }}>
          {t('hero.subtitle', lang)}
        </p>
        <p style={{ fontSize: 15, color: '#6b7280', margin: '0 0 36px', lineHeight: 1.6 }}>
          {t('hero.desc', lang)}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleStart} style={primaryBtnStyle}>
            {t('hero.cta', lang)}
          </button>
          <button onClick={handleDemo} style={secondaryBtnStyle}>
            {t('hero.demo', lang)}
          </button>
        </div>
        <p style={{ marginTop: 16 }}>
          <a href="/?s=6ae5971c" style={{ color: '#2563eb', fontSize: 14, textDecoration: 'underline' }}>
            {t('hero.liveExample', lang)}
          </a>
        </p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={featureCardStyle}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
                {t(f.titleKey, lang)}
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                {t(f.descKey, lang)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust indicators */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px 32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
          {TRUST_KEYS.map((key) => (
            <span key={key} style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#22c55e', fontSize: 14 }}>{'\u2713'}</span>
              {t(key, lang)}
            </span>
          ))}
        </div>
      </section>

      {/* Validation badge */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 16px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 24, fontSize: 13, color: '#166534', fontWeight: 500 }}>
          <span style={{ fontSize: 15 }}>{'\u2705'}</span>
          {t('hero.validated', lang)}
        </div>
      </section>

      {/* Comparison */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 64px', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: '#9ca3af', margin: '0 0 32px' }}>
          {t('hero.compare', lang)}
        </p>
        <button onClick={handleStart} style={{ ...primaryBtnStyle, padding: '14px 36px', fontSize: 16 }}>
          {t('hero.cta', lang)}
        </button>
      </section>

      {/* Email Collection */}
      <section style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 64px', textAlign: 'center' }}>
        <div style={{ background: '#f0f9ff', borderRadius: 16, padding: '32px 24px', border: '1px solid #bfdbfe' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            {t('email.title', lang)}
          </h3>
          <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 20px', lineHeight: 1.5 }}>
            {t('email.desc', lang)}
          </p>
          {emailState === 'success' || emailState === 'already' ? (
            <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: 8, color: '#065f46', fontSize: 14, fontWeight: 500 }}>
              {t(emailState === 'already' ? 'email.already' : 'email.success', lang)}
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailState === 'invalid' || emailState === 'error') setEmailState('idle'); }}
                placeholder={t('email.placeholder', lang)}
                style={emailInputStyle}
              />
              <button type="submit" disabled={emailState === 'submitting'} style={{ ...primaryBtnStyle, padding: '10px 24px', opacity: emailState === 'submitting' ? 0.7 : 1 }}>
                {t(emailState === 'submitting' ? 'email.submitting' : 'email.submit', lang)}
              </button>
            </form>
          )}
          {emailState === 'invalid' && (
            <p style={{ fontSize: 13, color: '#dc2626', margin: '8px 0 0' }}>{t('email.invalid', lang)}</p>
          )}
          {emailState === 'error' && (
            <p style={{ fontSize: 13, color: '#dc2626', margin: '8px 0 0' }}>{t('email.error', lang)}</p>
          )}
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '12px 0 0' }}>
            {t('email.privacy', lang)}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '16px 0', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
        <a href="https://github.com/TerryFYL/metareview" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}>
          GitHub
        </a>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: '\ud83d\udcda', titleKey: 'hero.feat1.title', descKey: 'hero.feat1.desc' },
  { icon: '\ud83d\udcc4', titleKey: 'hero.feat2.title', descKey: 'hero.feat2.desc' },
  { icon: '\ud83d\udcca', titleKey: 'hero.feat3.title', descKey: 'hero.feat3.desc' },
  { icon: '\ud83c\udf32', titleKey: 'hero.feat4.title', descKey: 'hero.feat4.desc' },
] as const;

const TRUST_KEYS = [
  'hero.trust1',
  'hero.trust2',
  'hero.trust3',
  'hero.trust4',
  'hero.trust5',
] as const;

const primaryBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '12px 28px',
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
};

const langBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#fff',
  color: '#2563eb',
  border: '1px solid #2563eb',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const emailInputStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  width: 260,
  maxWidth: '100%',
  outline: 'none',
};

const featureCardStyle: React.CSSProperties = {
  padding: '24px 20px',
  background: '#f9fafb',
  borderRadius: 12,
  border: '1px solid #f3f4f6',
};
