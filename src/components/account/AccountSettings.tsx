'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { startRegistration } from '@simplewebauthn/browser';
import {
  Mail,
  KeyRound,
  Fingerprint,
  Share2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Unlink,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/i18n-context';
import { useHistoryBack } from '@/lib/navigation/use-history-back';

export function AccountSettings() {
  const { data: session, update: updateSession } = useSession();
  const { t, locale } = useI18n();

  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<{
    hasPassword: boolean;
    linkedProviders: string[];
    passkeysCount: number;
    emailVerified: boolean;
    mailEnabled: boolean;
  }>({
    hasPassword: false,
    linkedProviders: [],
    passkeysCount: 0,
    emailVerified: false,
    mailEnabled: false,
  });

  const [passkeys, setPasskeys] = useState<any[]>([]);

  // Email form
  const [email, setEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Outcome of a confirmation link (/api/auth/verify-email redirects here with ?email=...)
  const emailLinkStatus = useSearchParams().get('email');
  const [shownLinkStatus, setShownLinkStatus] = useState<string | null>(null);
  if (emailLinkStatus && emailLinkStatus !== shownLinkStatus) {
    setShownLinkStatus(emailLinkStatus);
    const linkMessages: Record<string, { type: 'success' | 'error'; text: string }> = {
      verified: { type: 'success', text: t.account.emailVerifiedNotice },
      changed: { type: 'success', text: t.account.emailUpdateSuccess },
      expired: { type: 'error', text: t.account.emailVerifyExpired },
      taken: { type: 'error', text: t.account.emailTaken },
      invalid: { type: 'error', text: t.account.emailVerifyInvalid },
    };
    setEmailMsg(linkMessages[emailLinkStatus] ?? linkMessages.invalid);
  }
  // A confirmed address change: the session (and the form) pick up the new address
  useEffect(() => {
    if (emailLinkStatus === 'changed') void updateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link outcome
  }, [emailLinkStatus]);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Passkey state
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // The Back button closes the confirmation instead of leaving the page
  useHistoryBack(showDeleteModal, () => setShowDeleteModal(false));
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Loading (no state) and applying are separate, so the initial load only sets state once the data
  // arrived - not synchronously inside the effect
  const loadAccountData = async () => {
    const [accRes, passRes] = await Promise.all([fetch('/api/auth/linked-accounts'), fetch('/api/account/passkeys')]);
    return {
      account: accRes.ok ? await accRes.json() : null,
      passkeys: passRes.ok ? (await passRes.json()).passkeys || [] : null,
    };
  };
  const applyAccountData = (data: Awaited<ReturnType<typeof loadAccountData>>) => {
    if (data.account) {
      setAccountInfo({
        hasPassword: data.account.hasPassword,
        linkedProviders: data.account.linkedProviders || [],
        passkeysCount: data.account.passkeysCount || 0,
        emailVerified: Boolean(data.account.emailVerified),
        mailEnabled: Boolean(data.account.mailEnabled),
      });
    }
    if (data.passkeys) setPasskeys(data.passkeys);
  };

  // Reload after a change (link/unlink, passkey added, ...)
  const fetchAccountData = async () => {
    try {
      setLoading(true);
      applyAccountData(await loadAccountData());
    } catch (err) {
      console.error('Error fetching account settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // The session's address pre-fills the e-mail form (adopted while rendering, not in an effect)
  const sessionEmail = session?.user?.email || '';
  const [syncedSessionEmail, setSyncedSessionEmail] = useState('');
  if (sessionEmail && sessionEmail !== syncedSessionEmail) {
    setSyncedSessionEmail(sessionEmail);
    setEmail(sessionEmail);
  }

  // Initial load (loading already starts as true); reloads when the signed-in user changes
  useEffect(() => {
    let active = true;
    loadAccountData()
      .then((data) => {
        if (active) applyAccountData(data);
      })
      .catch((err) => console.error('Error fetching account settings:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the loaders only use stable state setters
  }, [sessionEmail]);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingEmail(true);
      setEmailMsg(null);

      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update email.');
      }

      // With mail configured the new address must be confirmed first: the form shows the current one
      if (data.pending) {
        setEmail(sessionEmail);
        setEmailMsg({ type: 'success', text: t.account.emailChangePending.replace('{email}', data.email) });
      } else {
        setEmailMsg({ type: 'success', text: t.account.emailUpdateSuccess });
        void fetchAccountData();
      }
    } catch (err: any) {
      setEmailMsg({ type: 'error', text: err.message });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setResendingVerification(true);
      setEmailMsg(null);
      const res = await fetch('/api/account/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send the link.');
      if (data.alreadyVerified) {
        setEmailMsg({ type: 'success', text: t.account.emailVerifiedNotice });
        void fetchAccountData();
      } else {
        setEmailMsg({ type: 'success', text: t.account.verificationSent });
      }
    } catch (err: any) {
      setEmailMsg({ type: 'error', text: err.message });
    } finally {
      setResendingVerification(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    try {
      setUpdatingPassword(true);
      setPasswordMsg(null);

      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setPasswordMsg({ type: 'success', text: t.account.passwordChangeSuccess });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      fetchAccountData();
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleRegisterPasskey = async () => {
    try {
      setRegisteringPasskey(true);
      setPasskeyMsg(null);

      const optRes = await fetch('/api/auth/passkeys/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session?.user?.email }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optData.error || 'Failed to get passkey options.');
      }

      const attResp = await startRegistration({ optionsJSON: optData });

      const verRes = await fetch('/api/auth/passkeys/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.user?.email,
          credential: attResp,
        }),
      });

      const verData = await verRes.json();
      if (!verRes.ok) {
        throw new Error(verData.error || 'Passkey verification failed.');
      }

      setPasskeyMsg({ type: 'success', text: t.account.passkeyCreated });
      fetchAccountData();
    } catch (err: any) {
      setPasskeyMsg({ type: 'error', text: err.message || 'Passkey enrollment cancelled.' });
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (credentialID: string) => {
    try {
      const res = await fetch('/api/account/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialID }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete passkey.');
      }

      setPasskeyMsg({ type: 'success', text: t.account.passkeyDeleted });
      fetchAccountData();
    } catch (err: any) {
      setPasskeyMsg({ type: 'error', text: err.message });
    }
  };

  const handleUnlinkProvider = async (provider: string) => {
    try {
      const res = await fetch('/api/account/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to unlink provider.');
      }

      alert(t.account.unlinkedSuccess);
      fetchAccountData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete account.');
      }
      signOut({ callbackUrl: '/' });
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
        <span className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin inline-block mb-2" />
        <p>{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Email Address */}
      <div className="p-6 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.account.emailSecTitle}</h3>
          {/* Confirmation status only where this server can send mail */}
          {!loading && accountInfo.mailEnabled && (
            <span
              data-testid="email-verification-badge"
              className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                accountInfo.emailVerified
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60'
              }`}
            >
              {accountInfo.emailVerified ? t.account.emailVerifiedBadge : t.account.emailUnverifiedBadge}
            </span>
          )}
        </div>

        {!loading && accountInfo.mailEnabled && !accountInfo.emailVerified && (
          <div className="p-3 rounded-lg text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">{t.account.emailUnverifiedHint}</span>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="shrink-0 text-xs font-bold py-1.5 px-3 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition disabled:opacity-50 cursor-pointer"
            >
              {t.account.resendVerificationBtn}
            </button>
          </div>
        )}

        {emailMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              emailMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60'
            }`}
          >
            {emailMsg.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            )}
            <span>{emailMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateEmail} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.account.emailLabel}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={updatingEmail}
              className="w-full text-xs font-bold py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition disabled:opacity-50 cursor-pointer"
            >
              {updatingEmail ? 'Saving...' : t.account.updateEmailBtn}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Password */}
      <div className="p-6 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.account.passwordSecTitle}</h3>
        </div>

        {passwordMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-3">
          {accountInfo.hasPassword && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.account.currentPasswordLabel}
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full sm:w-80 text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.account.newPasswordLabel}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.account.confirmPasswordLabel}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={updatingPassword}
            className="text-xs font-bold py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition disabled:opacity-50"
          >
            {updatingPassword ? 'Updating...' : t.account.changePasswordBtn}
          </button>
        </form>
      </div>

      {/* 3. Passkeys & WebAuthn */}
      <div className="p-6 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.account.passkeysSecTitle}</h3>
          </div>
          <button
            type="button"
            onClick={handleRegisterPasskey}
            disabled={registeringPasskey}
            className="self-start sm:self-auto text-xs font-bold py-1.5 px-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {registeringPasskey ? 'Enrolling...' : t.account.registerPasskeyBtn}
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">{t.account.passkeysDesc}</p>

        {passkeyMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              passkeyMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60'
            }`}
          >
            {passkeyMsg.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            )}
            <span>{passkeyMsg.text}</span>
          </div>
        )}

        <div className="space-y-2">
          {passkeys.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">{t.account.noPasskeys}</p>
          ) : (
            passkeys.map((p, idx) => (
              <div
                key={p.credentialID}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">
                      Device #{idx + 1} ({p.credentialDeviceType || 'platform'})
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      ID: {p.credentialID.substring(0, 16)}...
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePasskey(p.credentialID)}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded transition"
                  title={t.account.deletePasskey}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Connected Accounts (OAuth) */}
      <div className="p-6 bg-white dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Share2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.account.socialSecTitle}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t.account.socialDesc}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Google */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                G
              </span>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Google</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {accountInfo.linkedProviders.includes('google')
                    ? t.account.connectedBadge
                    : 'Not linked'}
                </span>
              </div>
            </div>
            {accountInfo.linkedProviders.includes('google') && (
              <button
                type="button"
                onClick={() => handleUnlinkProvider('google')}
                className="text-[11px] font-semibold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Unlink className="w-3 h-3" />
                {t.account.unlinkBtn}
              </button>
            )}
          </div>

          {/* Apple */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
                A
              </span>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">Apple</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {accountInfo.linkedProviders.includes('apple')
                    ? t.account.connectedBadge
                    : 'Not linked'}
                </span>
              </div>
            </div>
            {accountInfo.linkedProviders.includes('apple') && (
              <button
                type="button"
                onClick={() => handleUnlinkProvider('apple')}
                className="text-[11px] font-semibold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 cursor-pointer"
              >
                <Unlink className="w-3 h-3" />
                {t.account.unlinkBtn}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Danger Zone */}
      <div className="p-6 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/40 space-y-3">
        <div className="flex items-center gap-2 border-b border-red-200/80 dark:border-red-900/40 pb-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <h3 className="text-sm font-bold text-red-900 dark:text-red-200">{t.account.dangerZoneTitle}</h3>
        </div>
        <p className="text-xs text-red-800 dark:text-red-300">{t.account.dangerZoneDesc}</p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="text-xs font-bold py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t.account.deleteAccountBtn}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                {t.account.deleteConfirmModalTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.account.deleteConfirmModalDesc}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-xs font-semibold px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t.account.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="text-xs font-bold px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                {deletingAccount ? 'Deleting...' : t.account.confirmDeleteAccountBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

