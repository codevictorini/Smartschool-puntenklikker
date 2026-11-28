importScripts('supabase-config.js');

const supabaseConfig = globalThis.PuntKlikSupabase;
const supabaseUrl = supabaseConfig && supabaseConfig.url
  ? supabaseConfig.url.replace(/\/+$/, '')
  : '';
let syncQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== 'install') return;
  setLocalStorage({ onboardingPending: true }).catch((error) => {
    console.error('PuntKlik rondleiding kon niet worden voorbereid:', error);
  });
});

function getLocalStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(items || {});
    });
  });
}

function setLocalStorage(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function removeLocalStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

async function supabaseRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.text();
  let data = {};
  if (body) {
    try {
      data = JSON.parse(body);
    } catch (error) {
      throw new Error('Supabase gaf een onleesbaar antwoord.');
    }
  }
  if (!response.ok) {
    const detail = data.msg || data.message || data.error_description || data.error;
    throw new Error(detail || `Supabase-verzoek mislukt (${response.status}).`);
  }
  return data;
}

async function getValidSupabaseSession() {
  const stored = await getLocalStorage(['supabaseAuthSession']);
  const session = stored.supabaseAuthSession;
  if (!session || !session.refreshToken || !session.userId) {
    throw new Error('Log in om mee te doen aan de puntenchallenge.');
  }
  if (Number(session.expiresAt) > Date.now() + 60000) return session;

  const refreshed = await supabaseRequest(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseConfig.publishableKey,
    },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!refreshed.access_token || !refreshed.refresh_token || !refreshed.user || !refreshed.user.id) {
    throw new Error('Supabase heeft geen geldige gebruikerssessie teruggegeven.');
  }
  const nextSession = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
    userId: refreshed.user.id,
    userEmail: typeof refreshed.user.email === 'string' ? refreshed.user.email.toLowerCase() : '',
    userEmailVerified: Boolean(refreshed.user.email_confirmed_at),
  };
  await setLocalStorage({ supabaseAuthSession: nextSession });
  return nextSession;
}

async function loadActiveStoreEvents() {
  if (
    !supabaseUrl ||
    !supabaseConfig.publishableKey ||
    supabaseUrl.includes('YOUR_') ||
    supabaseConfig.publishableKey.startsWith('YOUR_')
  ) {
    return [];
  }
  const now = encodeURIComponent(new Date().toISOString());
  const events = await supabaseRequest(
    `${supabaseUrl}/rest/v1/store_events?select=id,event_type,event_config,starts_at,ends_at,created_at&starts_at=lte.${now}&ends_at=gt.${now}&order=created_at.desc`,
    { headers: { apikey: supabaseConfig.publishableKey } }
  );
  const activeEvents = Array.isArray(events) ? events : [];
  const stored = await getLocalStorage(['supabaseAuthSession']);
  if (
    stored.supabaseAuthSession &&
    activeEvents.some((event) => event.event_type === 'coin_gift')
  ) {
    const session = await getValidSupabaseSession();
    const claim = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/claim_store_event_coin_gifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: '{}',
    });
    const awarded = Number(claim.coins_awarded);
    if (Number.isSafeInteger(awarded) && awarded > 0) {
      const local = await getLocalStorage(['coins']);
      const coins = Number.isSafeInteger(local.coins) ? local.coins : 0;
      await setLocalStorage({ coins: Math.min(1000000000, coins + awarded) });
    }
  }
  return activeEvents;
}

async function loadActiveAnnouncement() {
  if (
    !supabaseUrl ||
    !supabaseConfig.publishableKey ||
    supabaseUrl.includes('YOUR_') ||
    supabaseConfig.publishableKey.startsWith('YOUR_')
  ) {
    return null;
  }
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await supabaseRequest(
    `${supabaseUrl}/rest/v1/store_announcements?select=id,author_name,message,created_at,expires_at&expires_at=gt.${now}&order=created_at.desc&limit=1`,
    { headers: { apikey: supabaseConfig.publishableKey } }
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function recordStoreEventPoint(eventId, pointHash) {
  if (!supabaseUrl || !supabaseConfig.publishableKey) {
    throw new Error('Supabase is niet ingesteld.');
  }
  const session = await getValidSupabaseSession();
  const result = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/record_store_event_point`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ p_event_id: eventId, p_point_hash: pointHash }),
  });
  const awarded = Number(result.coins_awarded);
  if (Number.isSafeInteger(awarded) && awarded > 0) {
    const stored = await getLocalStorage(['coins']);
    const coins = Number.isSafeInteger(stored.coins) ? stored.coins : 0;
    await setLocalStorage({ coins: Math.min(1000000000, coins + awarded) });
  }
  return result;
}

async function syncCoinsToSupabase() {
  if (
    !supabaseUrl ||
    !supabaseConfig.publishableKey ||
    supabaseUrl.includes('YOUR_') ||
    supabaseConfig.publishableKey.startsWith('YOUR_')
  ) {
    return;
  }

  const stored = await getLocalStorage([
    'coins',
    'leaderboardNickname',
    'supabaseAuthSession',
  ]);
  const session = stored.supabaseAuthSession;
  if (!session || !session.refreshToken || !session.userId) return;

  const coins = Number.isSafeInteger(stored.coins) && stored.coins >= 0 ? stored.coins : 0;
  if (coins > 1000000000) {
    throw new Error('Je coinstand valt buiten de limiet voor het leaderboard.');
  }

  let activeSession = session;
  if (Number(session.expiresAt) <= Date.now() + 60000) {
    const refreshed = await supabaseRequest(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.publishableKey,
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!refreshed.access_token || !refreshed.refresh_token || !refreshed.user || !refreshed.user.id) {
      throw new Error('Supabase heeft geen geldige gebruikerssessie teruggegeven.');
    }
    activeSession = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: Date.now() + (Number(refreshed.expires_in) || 3600) * 1000,
      userId: refreshed.user.id,
      userEmail: typeof refreshed.user.email === 'string' ? refreshed.user.email.toLowerCase() : '',
      userEmailVerified: Boolean(refreshed.user.email_confirmed_at),
    };
    await setLocalStorage({ supabaseAuthSession: activeSession });
  }

  await supabaseRequest(`${supabaseUrl}/rest/v1/leaderboard?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${activeSession.accessToken}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: activeSession.userId,
      nickname: typeof stored.leaderboardNickname === 'string' && stored.leaderboardNickname
        ? stored.leaderboardNickname
        : null,
      coins,
      updated_at: new Date().toISOString(),
    }),
  });
  await removeLocalStorage('supabaseSyncError');
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.coins) return;

  syncQueue = syncQueue
    .then(() => syncCoinsToSupabase())
    .catch(async (error) => {
      console.error('PuntKlik coin-synchronisatiefout:', error);
      try {
        await setLocalStorage({ supabaseSyncError: error.message });
      } catch (storageError) {
        console.error('PuntKlik synchronisatiefout kon niet worden opgeslagen:', storageError);
      }
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'puntklik:get-store-events') {
      loadActiveStoreEvents().then(
        (events) => sendResponse({ events }),
        (error) => sendResponse({ error: error.message })
      );
      return true;
    }
    if (message.type === 'puntklik:record-challenge-point') {
      recordStoreEventPoint(message.eventId, message.pointHash).then(
        (result) => sendResponse({ result }),
        (error) => sendResponse({ error: error.message })
      );
      return true;
    }
    if (message.type === 'puntklik:get-announcement') {
      loadActiveAnnouncement().then(
        (announcement) => sendResponse({ announcement }),
        (error) => sendResponse({ error: error.message })
      );
      return true;
    }
});
