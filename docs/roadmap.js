(() => {
  'use strict';

  const config = window.PuntKlikSupabase;
  const supabaseUrl = config && typeof config.url === 'string' ? config.url.replace(/\/+$/, '') : '';
  const sessionKey = 'puntklikWebsiteAuthSession';
  const verifierKey = 'puntklikWebsitePkceVerifier';
  const statusLabels = {
    planned: 'Gepland',
    in_progress: 'Bezig',
    done: 'Afgerond',
  };
  const roadmapStatus = document.getElementById('roadmap-status');
  const roadmapList = document.getElementById('roadmap-list');
  const loginButton = document.getElementById('site-login');
  const logoutButton = document.getElementById('site-logout');
  const loginHint = document.getElementById('leaderboard-login-hint');
  const nicknameForm = document.getElementById('nickname-form');
  const nicknameInput = document.getElementById('leaderboard-nickname');
  const leaderboardStatus = document.getElementById('leaderboard-status');
  const leaderboardList = document.getElementById('leaderboard-list');
  const ownerLoginHint = document.getElementById('owner-login-hint');
  const ownerPanel = document.getElementById('owner-panel');
  const ownerStatus = document.getElementById('owner-status');
  const roadmapForm = document.getElementById('roadmap-form');
  const roadmapTitleInput = document.getElementById('roadmap-title-input');
  const roadmapDescriptionInput = document.getElementById('roadmap-description-input');
  const roadmapStatusInput = document.getElementById('roadmap-status-input');
  const roadmapOrderInput = document.getElementById('roadmap-order-input');
  const roadmapSaveButton = document.getElementById('roadmap-save');
  const roadmapCancelButton = document.getElementById('roadmap-cancel');
  const roadmapManageList = document.getElementById('roadmap-manage-list');

  let session = null;
  let isOwner = false;
  let accountEntry = null;
  let roadmapItems = [];
  let editingId = null;

  function setStatus(element, message, isError) {
    element.textContent = message;
    element.classList.toggle('roadmap-error', Boolean(isError));
  }

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

  async function supabaseRequest(path, options) {
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

  async function startGoogleLogin() {
    ensureConfiguration();
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      throw new Error('Google-login werkt via de gepubliceerde HTTPS-website.');
    }
    const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    sessionStorage.setItem(verifierKey, verifier);
    const authorizationUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizationUrl.searchParams.set('provider', 'google');
    authorizationUrl.searchParams.set('redirect_to', `${location.origin}${location.pathname}`);
    authorizationUrl.searchParams.set('code_challenge', await createCodeChallenge(verifier));
    authorizationUrl.searchParams.set('code_challenge_method', 's256');
    location.assign(authorizationUrl.toString());
  }

  function saveSession(data) {
    if (!data || !data.access_token || !data.refresh_token || !data.user || !data.user.id) {
      throw new Error('Supabase heeft geen geldige gebruikerssessie teruggegeven.');
    }
    const expiresIn = Number(data.expires_in);
    session = {
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

  async function finishGoogleLogin() {
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
      const data = await supabaseRequest('/auth/v1/token?grant_type=pkce', {
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
      const refreshed = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: stored.refreshToken },
      });
      stored = saveSession(refreshed);
    }
    const user = await supabaseRequest('/auth/v1/user', { session: stored });
    if (!user || user.id !== stored.userId) {
      throw new Error('De opgeslagen login hoort niet bij deze gebruiker. Log opnieuw in.');
    }
    return stored;
  }

  async function checkOwnerAccess(activeSession) {
    const result = await supabaseRequest('/rest/v1/rpc/is_puntklik_leaderboard_owner', {
      method: 'POST',
      session: activeSession,
      body: {},
    });
    if (typeof result !== 'boolean') throw new Error('Ownerrechten konden niet worden gecontroleerd.');
    return result;
  }

  function updateAuthControls() {
    const signedIn = Boolean(session);
    loginButton.hidden = signedIn;
    logoutButton.hidden = !signedIn;
    nicknameForm.hidden = !signedIn;
    ownerPanel.hidden = !isOwner;
    ownerLoginHint.hidden = isOwner;
    loginHint.textContent = signedIn
      ? 'Je bent ingelogd. Je nickname en coinstand worden met het leaderboard gedeeld.'
      : 'Log in met Google om de top 10 te bekijken en je nickname te beheren.';
    if (signedIn && !isOwner) {
      ownerLoginHint.textContent = 'Je bent ingelogd, maar dit account heeft geen ownerrechten.';
    }
  }

  function renderLeaderboard(entries) {
    leaderboardList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'website-leaderboard-empty';
      empty.textContent = 'Nog geen spelers. Word de eerste!';
      leaderboardList.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement('li');
      row.className = 'website-leaderboard-row';
      const rank = document.createElement('span');
      rank.className = 'website-leaderboard-rank';
      rank.textContent = `${index + 1}.`;
      const nickname = document.createElement('span');
      nickname.textContent = entry.nickname;
      const coins = document.createElement('span');
      coins.className = 'website-leaderboard-coins';
      coins.textContent = `${entry.coins.toLocaleString('nl-BE')} ◉`;
      row.append(rank, nickname, coins);
      leaderboardList.appendChild(row);
    });
  }

  async function loadLeaderboard() {
    if (!session) return;
    setStatus(leaderboardStatus, 'Leaderboard laden…', false);
    const userId = encodeURIComponent(session.userId);
    const [topRows, ownRows] = await Promise.all([
      supabaseRequest(
        '/rest/v1/leaderboard?select=nickname,coins&nickname=not.is.null&order=coins.desc,nickname.asc&limit=10',
        { session }
      ),
      supabaseRequest(
        `/rest/v1/leaderboard?select=user_id,nickname,coins&user_id=eq.${userId}&limit=1`,
        { session }
      ),
    ]);
    if (!Array.isArray(topRows) || !Array.isArray(ownRows)) {
      throw new Error('Supabase gaf geen geldige leaderboardgegevens terug.');
    }
    const entries = topRows.map((row) => {
      const coins = Number(row.coins);
      return {
        nickname: typeof row.nickname === 'string' ? row.nickname : 'Speler',
        coins: Number.isSafeInteger(coins) && coins >= 0 ? coins : 0,
      };
    });
    accountEntry = ownRows[0] || null;
    nicknameInput.value = accountEntry && typeof accountEntry.nickname === 'string'
      ? accountEntry.nickname
      : '';
    renderLeaderboard(entries);
    setStatus(leaderboardStatus, 'Leaderboard bijgewerkt.', false);
  }

  function formatStatus(status) {
    return statusLabels[status] || statusLabels.planned;
  }

  function renderRoadmap(items) {
    roadmapList.replaceChildren();
    if (!items.length) {
      setStatus(roadmapStatus, 'De owner heeft nog geen roadmap-items gepubliceerd.', false);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement('li');
      row.className = 'roadmap-item';
      const header = document.createElement('div');
      header.className = 'roadmap-item-header';
      const title = document.createElement('h3');
      title.textContent = item.title;
      const status = document.createElement('span');
      status.className = 'roadmap-status';
      status.dataset.status = item.status;
      status.textContent = formatStatus(item.status);
      header.append(title, status);
      row.appendChild(header);
      if (item.description) {
        const description = document.createElement('p');
        description.textContent = item.description;
        row.appendChild(description);
      }
      roadmapList.appendChild(row);
    });
    setStatus(roadmapStatus, `${items.length} roadmap-items.`, false);
  }

  function renderOwnerRoadmap() {
    roadmapManageList.replaceChildren();
    if (!roadmapItems.length) {
      const empty = document.createElement('li');
      empty.className = 'website-leaderboard-empty';
      empty.textContent = 'Er zijn nog geen roadmap-items om te beheren.';
      roadmapManageList.appendChild(empty);
      return;
    }

    roadmapItems.forEach((item) => {
      const row = document.createElement('li');
      row.className = 'roadmap-owner-item';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const detail = document.createElement('small');
      detail.textContent = `${formatStatus(item.status)} · volgorde ${item.sort_order}`;
      const actions = document.createElement('div');
      actions.className = 'roadmap-admin-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'secondary';
      editButton.textContent = 'Bewerken';
      editButton.addEventListener('click', () => {
        editingId = item.id;
        roadmapTitleInput.value = item.title;
        roadmapDescriptionInput.value = item.description || '';
        roadmapStatusInput.value = item.status;
        roadmapOrderInput.value = String(item.sort_order);
        roadmapSaveButton.textContent = 'Wijzigingen opslaan';
        roadmapCancelButton.hidden = false;
        ownerStatus.textContent = '';
        roadmapTitleInput.focus();
      });
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'secondary';
      deleteButton.textContent = 'Verwijderen';
      deleteButton.addEventListener('click', () => {
        void deleteRoadmapItem(item, deleteButton);
      });
      actions.append(editButton, deleteButton);
      row.append(title, detail, actions);
      roadmapManageList.appendChild(row);
    });
  }

  async function refreshRoadmap() {
    const items = await supabaseRequest(
      '/rest/v1/roadmap_items?select=id,title,description,status,sort_order,created_at&order=sort_order.asc,created_at.asc'
    );
    if (!Array.isArray(items)) throw new Error('Supabase gaf geen geldige roadmap terug.');
    roadmapItems = items;
    renderRoadmap(roadmapItems);
    if (isOwner) renderOwnerRoadmap();
  }

  async function deleteRoadmapItem(item, button) {
    if (!session || !isOwner) {
      setStatus(ownerStatus, 'Je account heeft geen ownerrechten.', true);
      return;
    }
    if (!window.confirm(`Verwijder "${item.title}" uit de roadmap?`)) return;
    button.disabled = true;
    setStatus(ownerStatus, 'Roadmap-item verwijderen…', false);
    try {
      await supabaseRequest(`/rest/v1/roadmap_items?id=eq.${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        session,
      });
      await refreshRoadmap();
      setStatus(ownerStatus, 'Roadmap-item verwijderd.', false);
    } catch (error) {
      console.error('Roadmap-item kon niet worden verwijderd.', error);
      setStatus(ownerStatus, `Verwijderen mislukt: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  function resetRoadmapForm() {
    editingId = null;
    roadmapForm.reset();
    roadmapStatusInput.value = 'planned';
    const nextOrder = roadmapItems.reduce(
      (maximum, item) => Math.max(maximum, Number(item.sort_order) || 0),
      0
    );
    roadmapOrderInput.value = String(Math.min(nextOrder + 10, 10000));
    roadmapSaveButton.textContent = 'Item toevoegen';
    roadmapCancelButton.hidden = true;
  }

  async function saveRoadmapItem(event) {
    event.preventDefault();
    if (!session || !isOwner) {
      setStatus(ownerStatus, 'Je account heeft geen ownerrechten.', true);
      return;
    }
    const title = roadmapTitleInput.value.trim();
    const description = roadmapDescriptionInput.value.trim();
    const sortOrder = Number(roadmapOrderInput.value);
    if (title.length < 2 || title.length > 100) {
      setStatus(ownerStatus, 'De titel moet 2 tot 100 tekens bevatten.', true);
      roadmapTitleInput.focus();
      return;
    }
    if (description.length > 600) {
      setStatus(ownerStatus, 'De beschrijving mag maximaal 600 tekens bevatten.', true);
      roadmapDescriptionInput.focus();
      return;
    }
    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      setStatus(ownerStatus, 'De volgorde moet een heel getal tussen 0 en 10.000 zijn.', true);
      roadmapOrderInput.focus();
      return;
    }

    roadmapSaveButton.disabled = true;
    setStatus(ownerStatus, 'Roadmap opslaan…', false);
    const item = {
      title,
      description,
      status: roadmapStatusInput.value,
      sort_order: sortOrder,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editingId) {
        await supabaseRequest(`/rest/v1/roadmap_items?id=eq.${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          session,
          body: item,
        });
      } else {
        await supabaseRequest('/rest/v1/roadmap_items', {
          method: 'POST',
          session,
          body: { ...item, created_by: session.userId },
        });
      }
      await refreshRoadmap();
      resetRoadmapForm();
      setStatus(ownerStatus, 'Roadmap opgeslagen en gepubliceerd.', false);
    } catch (error) {
      console.error('Roadmap kon niet worden opgeslagen.', error);
      setStatus(ownerStatus, `Opslaan mislukt: ${error.message}`, true);
    } finally {
      roadmapSaveButton.disabled = false;
    }
  }

  async function saveNickname(event) {
    event.preventDefault();
    if (!session) return;
    const nickname = nicknameInput.value.trim();
    if (nickname.length < 3 || nickname.length > 20 || /[\u0000-\u001f\u007f]/.test(nickname)) {
      setStatus(leaderboardStatus, 'Een nickname moet 3 tot 20 tekens bevatten.', true);
      nicknameInput.focus();
      return;
    }
    const button = nicknameForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(leaderboardStatus, 'Nickname opslaan…', false);
    try {
      if (accountEntry) {
        await supabaseRequest(
          `/rest/v1/leaderboard?user_id=eq.${encodeURIComponent(session.userId)}`,
          { method: 'PATCH', session, body: { nickname } }
        );
      } else {
        await supabaseRequest('/rest/v1/leaderboard', {
          method: 'POST',
          session,
          body: { user_id: session.userId, nickname, coins: 0 },
        });
      }
      await loadLeaderboard();
      setStatus(leaderboardStatus, 'Nickname opgeslagen.', false);
    } catch (error) {
      console.error('Nickname kon niet worden opgeslagen.', error);
      setStatus(leaderboardStatus, `Opslaan mislukt: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  loginButton.addEventListener('click', async () => {
    loginButton.disabled = true;
    setStatus(leaderboardStatus, 'Google-login openen…', false);
    try {
      await startGoogleLogin();
    } catch (error) {
      sessionStorage.removeItem(verifierKey);
      console.error('Google-login kon niet worden gestart.', error);
      setStatus(leaderboardStatus, `Inloggen mislukt: ${error.message}`, true);
      loginButton.disabled = false;
    }
  });

  logoutButton.addEventListener('click', async () => {
    if (!session) return;
    logoutButton.disabled = true;
    setStatus(leaderboardStatus, 'Uitloggen…', false);
    try {
      await supabaseRequest('/auth/v1/logout', { method: 'POST', session });
      localStorage.removeItem(sessionKey);
      session = null;
      isOwner = false;
      accountEntry = null;
      updateAuthControls();
      leaderboardList.replaceChildren();
      setStatus(leaderboardStatus, 'Je bent uitgelogd.', false);
    } catch (error) {
      console.error('Uitloggen is mislukt.', error);
      setStatus(leaderboardStatus, `Uitloggen mislukt: ${error.message}`, true);
    } finally {
      logoutButton.disabled = false;
    }
  });

  nicknameForm.addEventListener('submit', (event) => {
    void saveNickname(event);
  });
  roadmapForm.addEventListener('submit', (event) => {
    void saveRoadmapItem(event);
  });
  roadmapCancelButton.addEventListener('click', () => {
    resetRoadmapForm();
    setStatus(ownerStatus, 'Bewerken geannuleerd.', false);
  });

  async function initialize() {
    try {
      await refreshRoadmap();
    } catch (error) {
      console.error('Roadmap kon niet worden geladen.', error);
      setStatus(roadmapStatus, `Roadmap laden mislukt: ${error.message}`, true);
    }

    try {
      await finishGoogleLogin();
      session = await restoreSession();
      isOwner = session ? await checkOwnerAccess(session) : false;
      updateAuthControls();
      if (isOwner) renderOwnerRoadmap();
    } catch (error) {
      console.error('Website-login kon niet worden hersteld.', error);
      setStatus(leaderboardStatus, `Inloggen mislukt: ${error.message}`, true);
      loginButton.hidden = false;
      logoutButton.hidden = true;
      nicknameForm.hidden = true;
      ownerPanel.hidden = true;
      isOwner = false;
      return;
    }

    if (session) {
      try {
        await loadLeaderboard();
      } catch (error) {
        console.error('Leaderboard kon niet worden geladen.', error);
        setStatus(leaderboardStatus, `Leaderboard laden mislukt: ${error.message}`, true);
      }
    }
  }

  void initialize();
})();
