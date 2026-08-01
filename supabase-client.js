/* Lightweight Supabase REST client: avoids shipping a large SDK for this static site. */
(() => {
  const config = window.FourInOneSupabaseConfig;
  const sessionKey = 'fourinone_supabase_auth_v1';
  const verifierKey = 'fourinone_supabase_pkce_verifier';

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const getSession = () => safeJson(localStorage.getItem(sessionKey));
  const setSession = (session) => {
    if (session?.access_token) localStorage.setItem(sessionKey, JSON.stringify(session));
    else localStorage.removeItem(sessionKey);
    return session;
  };
  const headers = (token, extras = {}) => ({
    apikey: config.publishableKey,
    Authorization: `Bearer ${token || config.publishableKey}`,
    ...extras
  });

  const request = async (path, { method = 'GET', body, token, prefer, headers: extraHeaders = {} } = {}) => {
    if (!config?.url || !config?.publishableKey) throw new Error('Supabase is not configured.');
    const requestHeaders = headers(token, extraHeaders);
    if (prefer) requestHeaders.Prefer = prefer;
    const options = { method, headers: requestHeaders };
    if (body !== undefined) {
      if (body instanceof FormData || body instanceof Blob) options.body = body;
      else {
        requestHeaders['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
    }
    const response = await fetch(`${config.url}${path}`, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => '');
    if (!response.ok) throw new Error(payload?.msg || payload?.message || payload?.error_description || `Supabase request failed (${response.status}).`);
    return payload;
  };

  const institutionEmail = (value) => value.includes('@') ? value.trim().toLowerCase() : `${value.trim().toLowerCase()}@drngpit.ac.in`;
  const base64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const createVerifier = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return base64Url(bytes);
  };

  const auth = {
    getSession,
    async signInWithPassword({ email, password }) {
      const session = await request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email, password }
      });
      return setSession(session);
    },
    async signUp({ email, password, registerNumber, fullName }) {
      const session = await request('/auth/v1/signup', {
        method: 'POST',
        body: { email, password, data: { register_number: registerNumber, full_name: fullName } }
      });
      if (session?.access_token) setSession(session);
      return session;
    },
    async beginGoogleLogin() {
      const verifier = createVerifier();
      localStorage.setItem(verifierKey, verifier);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const challenge = base64Url(digest);
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const address = new URL(`${config.url}/auth/v1/authorize`);
      address.searchParams.set('provider', 'google');
      address.searchParams.set('redirect_to', redirectTo);
      address.searchParams.set('code_challenge', challenge);
      address.searchParams.set('code_challenge_method', 's256');
      window.location.assign(address.toString());
    },
    async completeGoogleLogin() {
      const code = new URLSearchParams(window.location.search).get('code');
      if (!code) return null;
      const verifier = localStorage.getItem(verifierKey);
      if (!verifier) throw new Error('The Google sign-in session expired. Please try again.');
      const session = await request('/auth/v1/token?grant_type=pkce', {
        method: 'POST',
        body: { auth_code: code, code_verifier: verifier }
      });
      localStorage.removeItem(verifierKey);
      history.replaceState({}, document.title, window.location.pathname);
      return setSession(session);
    },
    async signOut() {
      const token = getSession()?.access_token;
      try { if (token) await request('/auth/v1/logout', { method: 'POST', token }); } finally { setSession(null); }
    }
  };

  const userToken = () => getSession()?.access_token || null;
  const data = {
    async getProfile() {
      const user = getSession()?.user;
      if (!user?.id) return null;
      const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,register_number,full_name,email`, { token: userToken() });
      return rows?.[0] || null;
    },
    async getActiveQr() {
      const rows = await request(`/rest/v1/payment_qr_config?provider=eq.${config.provider}&active=eq.true&select=public_url,storage_path,updated_at&limit=1`);
      return rows?.[0] || null;
    },
    async completePurchase({ bundleCodes, method, referenceHash, email }) {
      return request('/rest/v1/rpc/complete_bundle_purchase', {
        method: 'POST', token: userToken(), body: {
          p_bundle_codes: bundleCodes,
          p_method: method,
          p_reference_hash: referenceHash,
          p_email: email
        }
      });
    },
    async recordFeedback({ action, context = {}, rating = null, message = null }) {
      if (!userToken()) return null;
      return request('/rest/v1/rpc/record_action_feedback', {
        method: 'POST', token: userToken(), body: {
          p_action: action,
          p_context: context,
          p_rating: rating,
          p_message: message
        }
      });
    },
    async uploadActiveQr(file) {
      const profile = await data.getProfile();
      if (profile?.role !== 'admin') throw new Error('Only an administrator can replace the payment QR.');
      if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
        throw new Error('Upload a PNG, JPG, or WebP QR image smaller than 2 MB.');
      }
      const filename = `phonepe/current-${Date.now()}.${file.name.split('.').pop().toLowerCase()}`;
      await request(`/storage/v1/object/${config.storageBucket}/${filename}`, {
        method: 'POST', token: userToken(), body: file, headers: { 'x-upsert': 'true', 'content-type': file.type }
      });
      const publicUrl = `${config.url}/storage/v1/object/public/${config.storageBucket}/${filename}`;
      const result = await request('/rest/v1/payment_qr_config?on_conflict=provider', {
        method: 'POST', token: userToken(), prefer: 'resolution=merge-duplicates,return=representation',
        body: { provider: config.provider, storage_path: filename, public_url: publicUrl, active: true, updated_by: profile.id }
      });
      return result?.[0] || { public_url: publicUrl, storage_path: filename };
    }
  };

  window.FourInOneSupabase = Object.freeze({
    isConfigured: Boolean(config?.url && config?.publishableKey),
    institutionEmail,
    auth,
    data
  });
})();
