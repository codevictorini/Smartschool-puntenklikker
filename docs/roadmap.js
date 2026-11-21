(() => {
  'use strict';

  const siteAuth = window.PuntKlikSiteAuth;
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
      siteAuth.request(
        '/rest/v1/leaderboard?select=nickname,coins&nickname=not.is.null&order=coins.desc,nickname.asc&limit=10',
        { session }
      ),
      siteAuth.request(
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
    const items = await siteAuth.request(
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
      await siteAuth.request(`/rest/v1/roadmap_items?id=eq.${encodeURIComponent(item.id)}`, {
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
        await siteAuth.request(`/rest/v1/roadmap_items?id=eq.${encodeURIComponent(editingId)}`, {
          method: 'PATCH',
          session,
          body: item,
        });
      } else {
        await siteAuth.request('/rest/v1/roadmap_items', {
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
        await siteAuth.request(
          `/rest/v1/leaderboard?user_id=eq.${encodeURIComponent(session.userId)}`,
          { method: 'PATCH', session, body: { nickname } }
        );
      } else {
        await siteAuth.request('/rest/v1/leaderboard', {
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
      await siteAuth.login();
    } catch (error) {
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
      await siteAuth.logout(session);
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
      session = await siteAuth.initialize();
      isOwner = session ? await siteAuth.isOwner(session) : false;
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
