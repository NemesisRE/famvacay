'use client';

/**
 * Last resort when the root layout itself fails: it replaces the whole document, so no providers,
 * translations or global styles are available - a minimal bilingual page with inline styles.
 */
export default function GlobalError({ error }: { error: unknown; retry: () => void }) {
  console.error('[app] root error:', error);
  return (
    <html lang="en" translate="no" className="notranslate">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        <div role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong · Etwas ist schiefgelaufen</h1>
          <p style={{ fontSize: 14, color: '#475569' }}>
            Please reload the page. If you use automatic browser translation, switch it off for this site.
          </p>
          <p style={{ fontSize: 14, color: '#475569' }}>
            Bitte lade die Seite neu. Falls die automatische Browser-Übersetzung aktiv ist, schalte sie für diese Seite aus.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 8, border: 0, background: '#0d9488', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload · Neu laden
          </button>
        </div>
      </body>
    </html>
  );
}
