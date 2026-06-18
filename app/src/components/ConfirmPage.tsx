import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Props {
  token: string;
}

type Status = 'pending' | 'ok' | 'invalid' | 'error';

export function ConfirmPage({ token }: Props) {
  const [status, setStatus] = useState<Status>('pending');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        if (!cancelled) setStatus('invalid');
        return;
      }
      try {
        const { data, error } = await supabase.rpc('confirm_subscriber', { p_token: token });
        if (cancelled) return;
        if (error) setStatus('error');
        else setStatus(data === true ? 'ok' : 'invalid');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="account-page">
      <div className="card account-card">
        <span className="logo" aria-hidden="true">🚗</span>
        {status === 'pending' ? (
          <p className="account-msg">Confirming your subscription…</p>
        ) : status === 'ok' ? (
          <p className="account-msg account-ok">✓ You&apos;re confirmed — your alerts are on.</p>
        ) : status === 'invalid' ? (
          <p className="account-msg">This link is invalid or already used.</p>
        ) : (
          <p className="account-msg">Something went wrong. Please try again in a moment.</p>
        )}
        <a className="btn account-home" href="#/">Back to Car TCO Compare</a>
        <a className="account-by" href="https://xuspark.com" target="_blank" rel="noopener noreferrer">a project by XuSpark&nbsp;↗</a>
      </div>
    </div>
  );
}
