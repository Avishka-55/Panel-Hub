import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { authApi } from '../api/client';
import { ShieldCheck, Loader2 } from 'lucide-react';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Cloudflare Turnstile CAPTCHA widget component.
 * Integrates cleanly with Cloudflare Turnstile's explicit render API.
 * 
 * Props:
 * - onVerify(token): Callback when Turnstile token is generated
 * - onExpire(): Callback when token expires
 * - onError(code): Callback on challenge failure
 */
const TurnstileWidget = forwardRef(({ onVerify, onExpire, onError, className = '' }, ref) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  // Keep callback refs updated without re-running effects
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  });

  const [siteKey, setSiteKey] = useState(
    import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || ''
  );
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Fetch site configuration from backend if not present in env
  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      if (!siteKey) {
        const config = await authApi.getTurnstileConfig();
        if (isMounted) {
          if (config && config.siteKey) {
            setSiteKey(config.siteKey);
            setEnabled(config.enabled !== false);
          } else {
            setEnabled(false);
          }
        }
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [siteKey]);

  // Load Cloudflare Turnstile script and render widget once
  useEffect(() => {
    if (!siteKey || !enabled) {
      setLoading(false);
      return;
    }

    let script = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    let intervalId = null;

    const renderWidget = () => {
      if (window.turnstile && containerRef.current && widgetIdRef.current === null) {
        try {
          const id = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme: 'dark',
            size: 'normal',
            callback: (token) => {
              if (onVerifyRef.current) onVerifyRef.current(token);
            },
            'expired-callback': () => {
              if (onExpireRef.current) onExpireRef.current();
            },
            'error-callback': (code) => {
              console.warn('[Turnstile Error Code]:', code);
              if (onErrorRef.current) onErrorRef.current(code);
            }
          });
          widgetIdRef.current = id;
          setLoading(false);
        } catch (err) {
          console.warn('[Turnstile render error]:', err);
          setLoading(false);
        }
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      intervalId = setInterval(() => {
        if (window.turnstile) {
          clearInterval(intervalId);
          renderWidget();
        }
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, enabled]);

  // Expose imperative methods (reset, getResponse)
  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
          if (onExpireRef.current) onExpireRef.current();
        } catch (err) {
          console.warn('[Turnstile reset error]:', err);
        }
      }
    },
    getResponse: () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        return window.turnstile.getResponse(widgetIdRef.current);
      }
      return null;
    }
  }));

  if (!enabled || !siteKey) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center justify-center my-3 ${className}`}>
      {/* Sibling loading indicator so React virtual DOM never conflicts with Turnstile DOM */}
      {loading && (
        <div className="flex items-center gap-2 py-2.5 px-4 mb-2 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-xs animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span>Initializing Cloudflare security check...</span>
        </div>
      )}

      {/* Pure, untouched container for Cloudflare iframe */}
      <div
        ref={containerRef}
        className={`min-h-[65px] flex items-center justify-center ${loading ? 'invisible h-0 min-h-0' : ''}`}
      />

      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500 font-medium">
        <ShieldCheck className="w-3 h-3 text-indigo-400" />
        <span>Protected by Cloudflare Turnstile</span>
      </div>
    </div>
  );
});

TurnstileWidget.displayName = 'TurnstileWidget';

export default TurnstileWidget;
