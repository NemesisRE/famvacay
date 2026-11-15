'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { signIn, getProviders, ClientSafeProvider } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Key, Shield, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { useI18n } from '@/lib/i18n/i18n-context';
import { AppleIcon, GoogleIcon } from '@/components/auth/provider-icons';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const { t, locale } = useI18n();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const errorMap: Record<string, string> = {
    OAuthSignin: t.auth.errorOAuthSignin,
    OAuthCallback: t.auth.errorOAuthCallback,
    OAuthAccountNotLinked: t.auth.errorOAuthAccountNotLinked,
    AccessDenied: t.auth.errorAccessDenied,
    Configuration: t.auth.errorConfiguration,
    CredentialsSignin: t.auth.errorCredentialsSignin,
  };
  const urlErrorMessage = errorParam ? errorMap[errorParam] || `${t.auth.errorGeneric} (${errorParam})` : null;
  const activeMessage = message || (urlErrorMessage ? { type: 'error' as const, text: urlErrorMessage } : null);

  useEffect(() => {
    let mounted = true;
    getProviders()
      .then((p) => {
        if (mounted) setProviders(p);
      })
      .catch((err) => {
        console.error('Failed to load auth providers:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isRegisterMode) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The confirmation mail is written in the interface language
          body: JSON.stringify({ email, password, name, locale }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          throw new Error(regData.error || 'Registration failed');
        }

        setMessage({
          type: 'success',
          text: t.auth.signingIn,
        });
      }

      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        throw new Error(res.error);
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || t.auth.errorGeneric });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (providerId: string) => {
    setSocialLoading(providerId);
    setMessage(null);
    try {
      await signIn(providerId, { callbackUrl: '/' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || t.auth.errorSocialSignInFailed });
      setSocialLoading(null);
    }
  };

  const handlePasskeyRegister = async () => {
    if (!email) {
      setMessage({ type: 'error', text: t.auth.passkeyEmailRequired });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const optRes = await fetch('/api/auth/passkeys/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!optRes.ok) {
        const d = await optRes.json();
        throw new Error(d.error || 'Failed to retrieve passkey challenge.');
      }

      const options = await optRes.json();
      const credential = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/passkeys/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credential }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Passkey verification failed.');
      }

      setMessage({
        type: 'success',
        text: t.auth.passkeySuccess,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || t.auth.passkeyCancelled });
    } finally {
      setLoading(false);
    }
  };

  const hasGoogle = Boolean(providers?.google);
  const hasApple = Boolean(providers?.apple);
  const hasSocial = hasGoogle || hasApple;

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isRegisterMode ? t.auth.createAccount : t.auth.welcome}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isRegisterMode ? t.auth.createSubtitle : t.auth.welcomeSubtitle}
          </p>
        </div>

        {activeMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              activeMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
            }`}
          >
            {activeMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{activeMessage.text}</span>
          </div>
        )}

        {/* Social Authentication buttons (rendered only for configured providers) */}
        {hasSocial && (
          <>
            <div className="space-y-2">
              {hasGoogle && (
                <button
                  type="button"
                  disabled={loading || Boolean(socialLoading)}
                  onClick={() => handleSocialSignIn('google')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition disabled:opacity-60 cursor-pointer"
                >
                  {socialLoading === 'google' ? (
                    <span className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {t.auth.continueGoogle}
                </button>
              )}

              {hasApple && (
                <button
                  type="button"
                  disabled={loading || Boolean(socialLoading)}
                  onClick={() => handleSocialSignIn('apple')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition disabled:opacity-60 cursor-pointer"
                >
                  {socialLoading === 'apple' ? (
                    <span className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <AppleIcon />
                  )}
                  {t.auth.continueApple}
                </button>
              )}
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 font-medium">{t.auth.orCredentials}</span>
              </div>
            </div>
          </>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t.auth.fullName}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.fullNamePlaceholder}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t.auth.email}</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 pl-9 focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t.auth.password}</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 px-3 py-2.5 pl-9 focus:ring-2 focus:ring-teal-500 outline-hidden"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span>{isRegisterMode ? t.auth.createBtn : t.auth.signInBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Passkey enrollment option: responsive, wrap-safe layout */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handlePasskeyRegister}
            disabled={loading}
            className="w-full min-h-10 py-2 px-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition flex items-center justify-center gap-2 text-center cursor-pointer disabled:opacity-60"
          >
            <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="leading-snug wrap-break-word text-left sm:text-center">{t.auth.passkeyBtn}</span>
          </button>
        </div>

        {/* Mode switcher */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setMessage(null);
            }}
            className="text-xs text-teal-600 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            {isRegisterMode ? t.auth.alreadyHaveAccount : t.auth.dontHaveAccount}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
          <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs flex justify-center py-16">
            <span className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

