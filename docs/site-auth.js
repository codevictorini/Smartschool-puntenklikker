(() => {
  'use strict';

  const config = window.PuntKlikSupabase;
  const supabaseUrl = config && typeof config.url === 'string' ? config.url.replace(/\/+$/, '') : '';
  const sessionKey = 'puntklikWebsiteAuthSession';
  const verifierKey = 'puntklikWebsitePkceVerifier';

  function ensureConfiguration() {
    if (
      !supabaseUrl ||
      !config.publishableKey ||
      supabaseUrl.includes('YOUR_') ||
      config.publishableKey.startsWith('YOUR_')
    ) {
      throw new Error('De Supabase-configuratie ontbreekt.');
    }
  }

  async function request(path, options) {
    ensureConfiguration();
    const requestOptions = options || {};
    const headers = new Headers(requestOptions.headers || {});
    headers.set('apikey', config.publishableKey);
    if (requestOptions.session) {
      headers.set('Authorization', `Bearer ${requestOptions.session.accessToken}`);
    }
    if (requestOptions.body !== undefined) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${supabaseUrl}${path}`, {
      method: requestOptions.method || 'GET',
      headers,
      body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
    });
    const responseText = await response.text();
    let data = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Supabase gaf een onleesbaar antwoord.');
      }
    }
    if (!response.ok) {
      const detail = data && (data.message || data.msg || data.error_description || data.error);
      throw new Error(detail || `Supabase-verzoek mislukt (${response.status}).`);
    }
    return data;
  }

  function encodeBase64Url(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function createCodeChallenge(verifier) {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return encodeBase64Url(new Uint8Array(digest));
  }

  async function login() {
    ensureConfiguration();
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      throw new Error('Google-login werkt via de gepubliceerde HTTPS-website.');
    }
    const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(verifierKey, verifier);
    try {
      const authorizationUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
      authorizationUrl.searchParams.set('provider', 'google');
      authorizationUrl.searchParams.set('redirect_to', `${location.origin}${location.pathname}`);
      authorizationUrl.searchParams.set('code_challenge', await createCodeChallenge(verifier));
      authorizationUrl.searchParams.set('code_challenge_method', 's256');
      location.assign(authorizationUrl.toString());
    } catch (error) {
      sessionStorage.removeItem(verifierKey);
      throw error;
    }
  }

  function saveSession(data) {
    if (!data || !data.access_token || !data.refresh_token || !data.user || !data.user.id) {
      throw new Error('Supabase heeft geen geldige gebruikerssessie teruggegeven.');
    }
    const expiresIn = Number(data.expires_in);
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
      userId: data.user.id,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
    return session;
  }

  function clearOAuthParameters() {
    const url = new URL(location.href);
    ['code', 'error', 'error_description', 'error_code', 'state'].forEach((key) => url.searchParams.delete(key));
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  async function finishLogin() {
    const url = new URL(location.href);
    const code = url.searchParams.get('code');
    const authError = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (!code && !authError) return;
    clearOAuthParameters();
    if (authError) {
      sessionStorage.removeItem(verifierKey);
      throw new Error(authError);
    }

    const verifier = sessionStorage.getItem(verifierKey);
    if (!verifier) throw new Error('De tijdelijke loginverificatie is verlopen. Log opnieuw in.');
    try {
      const data = await request('/auth/v1/token?grant_type=pkce', {
        method: 'POST',
        body: { auth_code: code, code_verifier: verifier },
      });
      saveSession(data);
    } finally {
      sessionStorage.removeItem(verifierKey);
    }
  }

  function readSession() {
    const stored = localStorage.getItem(sessionKey);
    if (!stored) return null;
    let value;
    try {
      value = JSON.parse(stored);
    } catch {
      localStorage.removeItem(sessionKey);
      throw new Error('De opgeslagen login is beschadigd. Log opnieuw in.');
    }
    if (
      !value ||
      typeof value.accessToken !== 'string' ||
      typeof value.refreshToken !== 'string' ||
      typeof value.userId !== 'string' ||
      !Number.isFinite(Number(value.expiresAt))
    ) {
      localStorage.removeItem(sessionKey);
      throw new Error('De opgeslagen login is ongeldig. Log opnieuw in.');
    }
    return value;
  }

  async function restoreSession() {
    let stored = readSession();
    if (!stored) return null;
    if (Number(stored.expiresAt) <= Date.now() + 60000) {
      const refreshed = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: stored.refreshToken },
      });
      stored = saveSession(refreshed);
    }
    const user = await request('/auth/v1/user', { session: stored });
    if (!user || user.id !== stored.userId) {
      throw new Error('De opgeslagen login hoort niet bij deze gebruiker. Log opnieuw in.');
    }
    return stored;
  }

  async function initialize() {
    await finishLogin();
    return restoreSession();
  }

  async function isOwner(session) {
    const result = await request('/rest/v1/rpc/is_puntklik_leaderboard_owner', {
      method: 'POST',
      session,
      body: {},
    });
    if (typeof result !== 'boolean') throw new Error('Ownerrechten konden niet worden gecontroleerd.');
    return result;
  }

  async function logout(session) {
    await request('/auth/v1/logout', { method: 'POST', session });
    localStorage.removeItem(sessionKey);
  }

  window.PuntKlikSiteAuth = Object.freeze({
    request,
    login,
    initialize,
    isOwner,
    logout,
  });
})();
