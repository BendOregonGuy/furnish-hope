# Email OAuth setup — Google & Microsoft

Connecting Gmail / Outlook via "Sign in with…" instead of an app password. Lower friction for staff, and the **only** way to connect Outlook now (Microsoft killed basic auth).

Setup is a one-time job per provider (~15 min each), done by an admin in the provider's console. After that, every staff member can connect their own inbox with a single click.

---

## Google (Gmail)

### 1. Create a Google Cloud project

- Go to https://console.cloud.google.com
- Click the project picker → **New Project**
- Name: `Furnish Hope` (or anything)
- Create

### 2. Enable the Gmail API

- Left sidebar → **APIs & Services → Library**
- Search "Gmail API" → click it → **Enable**

### 3. Configure the OAuth consent screen

- Left sidebar → **APIs & Services → OAuth consent screen**
- User type: **External** (staff use personal/work Google accounts) → Create
- Fill in:
  - **App name:** `Furnish Hope`
  - **User support email:** your email
  - **Developer contact:** your email
- **Save and Continue**
- **Scopes** page → **Save and Continue** (we add scopes via code, not here)
- **Test users** page → click **+ Add Users** and add the email of every staff member who'll connect a Gmail account. Up to 100 users allowed while the app is in "Testing" mode. Save and continue.
- Back to the consent screen — keep the app in **Testing** mode (no verification needed for staff-only access).

### 4. Create the OAuth client credentials

- Left sidebar → **APIs & Services → Credentials**
- **+ Create Credentials → OAuth client ID**
- Application type: **Web application**
- Name: `Furnish Hope server`
- **Authorized redirect URIs** — add this URL exactly (no trailing slash):
  ```
  https://hammerhead-app-tk838.ondigitalocean.app/api/email/oauth/callback
  ```
  (Also add `http://localhost:4000/api/email/oauth/callback` if you ever run locally.)
- Click **Create**
- Copy the **Client ID** and **Client secret** that appear in the popup.

### 5. Set the env vars in DigitalOcean

In your DO App settings → Components → API → Environment Variables, add:

| Name | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | the client ID from step 4 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | the client secret from step 4 |

Save → DO redeploys the app.

### 6. Connect a Gmail account

- In the app: **Email → Accounts → Connect a new account → Gmail**
- Click **Sign in with Google →**
- Google's normal account picker / consent screen appears
- After approving, you're bounced back with a connected account ready to use

---

## Microsoft (Outlook / Office 365)

### 1. Register an app in Microsoft Entra (Azure AD)

- Go to https://entra.microsoft.com (or portal.azure.com → Microsoft Entra ID)
- Left sidebar → **App registrations**
- Click **+ New registration**
- Name: `Furnish Hope`
- Supported account types: **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)**
- Redirect URI:
  - Platform: **Web**
  - URL: `https://hammerhead-app-tk838.ondigitalocean.app/api/email/oauth/callback`
- Click **Register**

### 2. Add API permissions

- In the app's left sidebar → **API permissions**
- Click **+ Add a permission**
- Select **Microsoft Graph**
- Choose **Delegated permissions**
- Add:
  - `IMAP.AccessAsUser.All`
  - `SMTP.Send`
  - `offline_access`
  - `openid`
  - `profile`
  - `User.Read` (already there)
- Click **Add permissions**

### 3. Create a client secret

- Left sidebar → **Certificates & secrets**
- Click **+ New client secret**
- Description: `Furnish Hope server`
- Expires: **24 months** (or whatever your policy allows; mark a calendar reminder to rotate before expiry)
- Click **Add**
- **Copy the secret VALUE now** — Microsoft only shows it once. (The "Secret ID" is not what you want; you want the **Value** column.)

### 4. Note the Application (client) ID

- Left sidebar → **Overview**
- Copy the **Application (client) ID** GUID.

### 5. Set the env vars in DigitalOcean

| Name | Value |
|---|---|
| `MICROSOFT_OAUTH_CLIENT_ID` | the Application (client) ID from step 4 |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | the secret value from step 3 |

Save → DO redeploys.

### 6. Connect an Outlook account

- In the app: **Email → Accounts → Connect a new account → Outlook / Hotmail**
- Click **Sign in with Microsoft →**
- Microsoft's normal sign-in / consent screen appears
- After approving, you're bounced back with a connected account ready to use

---

## Common env var you also need

Both providers need to know what the redirect URL base is, in case the request's host header is unreliable (which it can be behind some load balancers):

| Name | Value |
|---|---|
| `APP_BASE_URL` | `https://hammerhead-app-tk838.ondigitalocean.app` |

If your DO app URL changes, update both:
- `APP_BASE_URL` env var, AND
- The Authorized Redirect URI in Google Cloud Console AND
- The Redirect URI in Microsoft Entra

The redirect URIs must match what the server sends to the provider EXACTLY (including https vs http, trailing slash or not).

---

## Troubleshooting

### "Google OAuth is not configured"

You haven't set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` yet, or the app hasn't redeployed since you set them.

### "redirect_uri_mismatch" (Google)

The URI registered in Google Cloud doesn't match exactly what the server is sending. Check:
- Trailing slash? (No)
- http vs https? (Production must be https)
- Exact hostname? (Including `hammerhead-app-tk838.ondigitalocean.app`)

### "AADSTS50011" / reply URL mismatch (Microsoft)

Same as Google — exact-match redirect URI is required. Update in Microsoft Entra → App registrations → your app → Authentication.

### "No refresh token received"

For Google: the user already granted consent and Google didn't re-issue a refresh_token. Disconnect the account in our app AND revoke at https://myaccount.google.com/permissions, then reconnect.

### Tokens expire and can't refresh

Probably the refresh_token was revoked (user changed password, admin revoked it, etc). The user has to disconnect + reconnect the account.

### "Access blocked: Furnish Hope has not completed the Google verification process"

Add the staff member's email as a test user in the Google Cloud OAuth consent screen (step 3). Up to 100 users allowed in Testing mode without going through Google's verification process.
