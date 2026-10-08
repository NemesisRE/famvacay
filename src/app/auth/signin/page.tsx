'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Key, Shield, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function SignInPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isRegisterMode) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
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
      setMessage({ type: 'error', text: err.message || 'Authentication error.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email to register a passkey.' });
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
      const credential = await startRegistration(options);

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
        text: 'Passkey enrolled successfully!',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Passkey enrollment cancelled.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isRegisterMode ? t.auth.createAccount : t.auth.welcome}
          </h1>
          <p className="text-xs text-slate-500">
            {isRegisterMode ? t.auth.createSubtitle : t.auth.welcomeSubtitle}
          </p>
        </div>

        {message && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Social Authentication buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {t.auth.continueGoogle}
          </button>

          <button
            type="button"
            onClick={() => signIn('apple', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.73-7.98-12.13-14.68-6.19-9.5-11.04-20.2-14.56-32.09-3.52-11.89-5.28-23.23-5.28-34.02 0-14.68 3.69-26.96 11.07-36.85 7.37-9.89 16.79-14.96 28.24-15.22 5.06 0 10.74 1.34 17.06 4.02 6.32 2.68 10.23 4.08 11.75 4.19 1.12 0 5.17-1.46 12.16-4.37 6.99-2.92 12.91-4.22 17.78-3.9 13.06.63 23.36 5.43 30.9 14.41-11.45 6.99-17.06 16.59-16.84 28.81.22 9.61 3.97 17.58 11.26 23.91 7.29 6.32 15.93 9.94 25.93 10.84-2.18 6.47-4.74 13-7.69 19.57zM119.22 31.81c0-7.72 2.76-14.88 8.28-21.49 5.52-6.61 12.44-10.72 20.76-12.32.22 1.13.33 2.14.33 3.03 0 7.83-2.93 15.15-8.79 21.95-5.87 6.8-13 10.89-21.4 12.26-.23-1.12-.34-2.26-.34-3.43z" />
            </svg>
            {t.auth.continueApple}
          </button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-medium">{t.auth.orCredentials}</span>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          {isRegisterMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t.auth.fullName}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t.auth.email}</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@example.com"
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 pl-9 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t.auth.password}</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 pl-9 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                {isRegisterMode ? t.auth.createBtn : t.auth.signInBtn}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Passkey enrollment option */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handlePasskeyRegister}
            disabled={loading}
            className="w-full py-2 px-3 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 text-indigo-700 font-semibold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            {t.auth.passkeyBtn}
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
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
          >
            {isRegisterMode ? t.auth.alreadyHaveAccount : t.auth.dontHaveAccount}
          </button>
        </div>
      </div>
    </div>
  );
}
