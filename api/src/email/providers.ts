/**
 * Provider presets — known IMAP/SMTP settings for the common email
 * providers we explicitly support. Lets the UI pre-fill the connection
 * details so users only need to type their email + app password.
 *
 * Each provider's `app_password_url` is the direct deep-link to where the
 * user generates the credential to paste here.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  /** Where the user clicks to generate an app-specific password. */
  app_password_url: string;
  /** Short user-facing setup notes. */
  notes: string;
  /** True when the provider mandates an app-specific password (the user's
   *  primary login password won't work for IMAP/SMTP). */
  requires_app_password: boolean;
}

export const PROVIDERS: Record<string, ProviderPreset> = {
  gmail: {
    id: 'gmail',
    label: 'Gmail',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_secure: true,
    app_password_url: 'https://myaccount.google.com/apppasswords',
    notes:
      'Gmail with 2-Step Verification requires an App Password — your normal Google password will not work. ' +
      'Go to the App Passwords page, generate one labeled "Furnish Hope", and paste it below.',
    requires_app_password: true,
  },
  icloud: {
    id: 'icloud',
    label: 'iCloud Mail',
    imap_host: 'imap.mail.me.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.mail.me.com',
    smtp_port: 587,
    smtp_secure: false, // STARTTLS on 587
    app_password_url: 'https://account.apple.com/account/manage',
    notes:
      'iCloud Mail requires an App-Specific Password. Sign in at appleid.apple.com → Sign-In and Security → ' +
      'App-Specific Passwords → "Generate a Password". Use your full @icloud.com address as the username.',
    requires_app_password: true,
  },
  outlook: {
    id: 'outlook',
    label: 'Outlook / Hotmail',
    imap_host: 'outlook.office365.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.office365.com',
    smtp_port: 587,
    smtp_secure: false, // STARTTLS on 587
    app_password_url: 'https://account.microsoft.com/security',
    notes:
      '⚠️ Microsoft disabled basic authentication for all personal Outlook.com / Hotmail accounts in September 2024 ' +
      '(Microsoft 365 work accounts since 2022). Password-based IMAP/SMTP — including app passwords — will fail with ' +
      '"535 5.7.139 Authentication unsuccessful, basic authentication is disabled." OAuth 2.0 is the only path forward; ' +
      'we have not implemented OAuth for Microsoft yet. Workaround: forward Outlook → Gmail and connect the Gmail ' +
      'account here, or use a different provider.',
    requires_app_password: true,
  },
  yahoo: {
    id: 'yahoo',
    label: 'Yahoo Mail',
    imap_host: 'imap.mail.yahoo.com',
    imap_port: 993,
    imap_secure: true,
    smtp_host: 'smtp.mail.yahoo.com',
    smtp_port: 465,
    smtp_secure: true,
    app_password_url: 'https://login.yahoo.com/account/security',
    notes:
      'Yahoo requires an App Password (their normal password is blocked for IMAP). At Account Security → ' +
      'Generate app password, label it "Furnish Hope", and paste below.',
    requires_app_password: true,
  },
  proton: {
    id: 'proton',
    label: 'Proton Mail',
    imap_host: '127.0.0.1',
    imap_port: 1143,
    imap_secure: false,
    smtp_host: '127.0.0.1',
    smtp_port: 1025,
    smtp_secure: false,
    app_password_url: 'https://proton.me/mail/bridge',
    notes:
      'Proton Mail requires Proton Bridge (paid plans only — Mail Plus, Essentials, or Pro). Install Bridge ' +
      'on the same machine that hosts this app, sign in, and Bridge will print local IMAP/SMTP credentials to ' +
      'use here. The hostnames default to 127.0.0.1 — change them if Bridge is on a different host.',
    requires_app_password: true,
  },
  imap: {
    id: 'imap',
    label: 'Other (IMAP / SMTP)',
    imap_host: '',
    imap_port: 993,
    imap_secure: true,
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    app_password_url: '',
    notes: 'Any other provider that exposes standard IMAP + SMTP. Fill in the host, port, and credentials manually.',
    requires_app_password: false,
  },
};

export function getProvider(id: string | null | undefined): ProviderPreset {
  return (id && PROVIDERS[id]) || PROVIDERS.imap;
}
