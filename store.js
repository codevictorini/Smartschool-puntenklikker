(() => {
  const coinCount = document.getElementById('coins');
  const status = document.getElementById('status');
  const message = document.getElementById('message');
  const figureShop = document.getElementById('figures');
  const toppingShop = document.getElementById('toppings');
  const boostTotal = document.getElementById('boost-total');
  const promoBanner = document.getElementById('promo-banner');
  const ownerEventCountdown = document.getElementById('owner-event-countdown');
  const ownerEventNameDisplay = document.getElementById('owner-event-name-display');
  const ownerEventTimer = document.getElementById('owner-event-timer');
  const ownerEventTarget = document.getElementById('owner-event-target');
  const ownerEventCountdownForm = document.getElementById('owner-event-countdown-form');
  const ownerEventCountdownClear = document.getElementById('owner-event-countdown-clear');
  const ownerEventCountdownStatus = document.getElementById('owner-event-countdown-status');
  const globalAnnouncement = document.getElementById('global-announcement');
  const storeEventForm = document.getElementById('store-event-form');
  const storeEventType = document.getElementById('store-event-type');
  const storeEventStatus = document.getElementById('store-event-status');
  const ownerFruitControls = document.getElementById('owner-fruit-controls');
  const announcementForm = document.getElementById('announcement-form');
  const announcementStatus = document.getElementById('announcement-status');
  const secretShopSection = document.getElementById('secret-shop-section');
  const secretShopStatus = document.getElementById('secret-shop-status');
  const secretShopList = document.getElementById('secret-shop-list');
  const secretInventory = document.getElementById('secret-inventory');
  const eventsWidget = document.getElementById('events-widget');
  const eventsTrigger = document.getElementById('events-trigger');
  const eventsList = document.getElementById('events-list');
  const settingsButton = document.getElementById('settings');
  const leaderboardLogin = document.getElementById('leaderboard-login');
  const leaderboardLogout = document.getElementById('leaderboard-logout');
  const nicknameForm = document.getElementById('nickname-form');
  const nicknameInput = document.getElementById('leaderboard-nickname');
  const leaderboardStatus = document.getElementById('leaderboard-status');
  const leaderboardList = document.getElementById('leaderboard-list');
  const ownerTools = document.getElementById('owner-tools');
  const ownerManageToggle = document.getElementById('owner-manage-toggle');
  const ownerManagement = document.getElementById('owner-management');
  const ownerStatus = document.getElementById('owner-status');
  const ownerPlayerList = document.getElementById('owner-player-list');
  const promoForm = document.getElementById('promo-form');
  const promoOwnerStatus = document.getElementById('promo-owner-status');
  const secretShopToggle = document.getElementById('secret-shop-toggle');
  const secretItemForm = document.getElementById('secret-item-form');
  const secretItemEffect = document.getElementById('secret-item-effect');
  const secretEffectFields = document.getElementById('secret-effect-fields');
  const secretOwnerStatus = document.getElementById('secret-owner-status');
  const ownerSecretItemList = document.getElementById('owner-secret-item-list');
  const leaderboardOwnerEmail = 'victorerauw@sint-jozefsinstituut.be';
  const supabaseConfig = window.PuntKlikSupabase;
  const supabaseUrl = supabaseConfig && supabaseConfig.url
    ? supabaseConfig.url.replace(/\/+$/, '')
    : '';
  const supabaseConfigured = Boolean(
    supabaseUrl &&
    supabaseConfig.publishableKey &&
    !supabaseUrl.includes('YOUR_') &&
    !supabaseConfig.publishableKey.startsWith('YOUR_')
  );
  const figures = [
    { id: 'classic', name: 'Koek', note: 'Startfiguur', price: 0 },
    { id: 'berry', name: 'Aardbei', note: 'Een losse aardbei', price: 15 },
    { id: 'mint', name: 'Muntblaadje', note: 'Een fris blaadje', price: 25 },
    { id: 'night', name: 'Ster', note: 'Een gouden ster', price: 40 },
    { id: 'watermelon', name: 'Watermeloen', note: 'Een sappig partje', price: 20 },
    { id: 'orange', name: 'Sinaasappel', note: 'Een citruswiel', price: 20 },
    { id: 'donut', name: 'Donut', note: 'Met roze glazuur', price: 30 },
    { id: 'cupcake', name: 'Cupcake', note: 'Met een kers erbovenop', price: 35 },
  ];
  const toppings = [
    { id: 'sprinkles', name: 'Regenboogsprinkles', note: `+${window.PuntKlikToppingBoosts.sprinkles}% coins`, price: 25 },
    { id: 'chocolate', name: 'Chocoladesaus', note: `+${window.PuntKlikToppingBoosts.chocolate}% coins`, price: 50 },
    { id: 'gold', name: 'Goudstof', note: `+${window.PuntKlikToppingBoosts.gold}% coins`, price: 100 },
  ];
  let coins = 0;
  let ownedFigures = ['classic'];
  let figure = 'classic';
  let ownedToppings = [];
  let equippedToppings = [];
  let clicksToSpin = 12;
  let storageFailed = false;
  let supabaseSession = null;
  let isLeaderboardOwner = false;
  let leaderboardNickname = '';
  let activePromo = null;
  let activeStoreEvents = [];
  let ownerFruitGrantInProgress = false;
  let ownerEventCountdownData = null;
  let secretShopOpen = false;
  let secretShopState = null;
  let secretShopItems = [];
  let ownedSecretPurchases = [];
  let activeSecretEffects = [];
  let storeRefreshTimer = 0;
  let announcementRefreshTimer = 0;
  let announcementHideTimer = 0;
  let ownerEventCountdownTimer = 0;
  let lastAnnouncementId = '';

  function showStorageError(error) {
    console.error('PuntKlik opslagfout:', error);
    storageFailed = true;
    message.textContent = 'Opslaan mislukt. Herlaad de winkel en probeer opnieuw.';
    settingsButton.disabled = true;
    [figureShop, toppingShop].forEach((list) => {
      list.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
    });
  }

  function saveSettings(settings, onSuccess) {
    chrome.storage.local.set(settings, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        showStorageError(error);
        return;
      }
      onSuccess();
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

  function getChromeIdentityRedirectUrl() {
    return chrome.identity.getRedirectURL('supabase');
  }

  function generateCodeVerifier() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function createCodeChallenge(verifier) {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    let binary = '';
    new Uint8Array(digest).forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function getChromeStorage(keys) {
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

  function setChromeStorage(items) {
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

  function removeChromeStorage(keys) {
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

  function launchSupabaseOAuth(url) {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!redirectUrl) {
          reject(new Error('Google heeft geen redirect teruggegeven.'));
          return;
        }
        resolve(redirectUrl);
      });
    });
  }

  async function persistSupabaseSession(data) {
    if (!data.access_token || !data.refresh_token || !data.user || !data.user.id) {
      throw new Error('Supabase heeft geen geldige gebruikerssessie teruggegeven.');
    }
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
      userId: data.user.id,
      userEmail: typeof data.user.email === 'string' ? data.user.email.toLowerCase() : '',
      userEmailVerified: Boolean(data.user.email_confirmed_at),
    };
    await setChromeStorage({ supabaseAuthSession: session });
    supabaseSession = session;
    updateOwnerAccess(session);
    return session;
  }

  function updateOwnerAccess(session) {
    isLeaderboardOwner = Boolean(
      session &&
      typeof session.userEmail === 'string' &&
      session.userEmail.toLowerCase() === leaderboardOwnerEmail &&
      session.userEmailVerified
    );
    ownerTools.hidden = !isLeaderboardOwner;
    if (!isLeaderboardOwner) {
      ownerManagement.hidden = true;
      ownerManageToggle.textContent = 'Ownerbeheer';
      ownerPlayerList.replaceChildren();
    }
  }

  async function createSupabaseSession() {
    const verifier = generateCodeVerifier();
    const challenge = await createCodeChallenge(verifier);
    await setChromeStorage({ supabasePkceVerifier: verifier });

    const authorizationUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorizationUrl.searchParams.set('provider', 'google');
    authorizationUrl.searchParams.set('redirect_to', getChromeIdentityRedirectUrl());
    authorizationUrl.searchParams.set('code_challenge', challenge);
    authorizationUrl.searchParams.set('code_challenge_method', 's256');

    try {
      const callbackUrl = new URL(await launchSupabaseOAuth(authorizationUrl.toString()));
      const authError = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error');
      if (authError) throw new Error(authError);
      const code = callbackUrl.searchParams.get('code');
      if (!code) throw new Error('De Google-login gaf geen autorisatiecode terug.');

      const saved = await getChromeStorage('supabasePkceVerifier');
      if (!saved.supabasePkceVerifier) {
        throw new Error('De tijdelijke loginverificatie is verlopen. Probeer opnieuw in te loggen.');
      }
      const session = await supabaseRequest(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseConfig.publishableKey,
        },
        body: JSON.stringify({
          auth_code: code,
          code_verifier: saved.supabasePkceVerifier,
        }),
      });
      return await persistSupabaseSession(session);
    } finally {
      await removeChromeStorage('supabasePkceVerifier');
    }
  }

  async function restoreSupabaseSession() {
    const saved = await getChromeStorage('supabaseAuthSession');
    const session = saved.supabaseAuthSession;
    if (!session) {
      updateOwnerAccess(null);
      return null;
    }
    if (
      typeof session.accessToken !== 'string' ||
      typeof session.refreshToken !== 'string' ||
      typeof session.userId !== 'string' ||
      !Number.isFinite(Number(session.expiresAt))
    ) {
      await removeChromeStorage('supabaseAuthSession');
      updateOwnerAccess(null);
      return null;
    }

    if (Number(session.expiresAt) <= Date.now() + 60000) {
      const refreshed = await supabaseRequest(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseConfig.publishableKey,
        },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      return await persistSupabaseSession(refreshed);
    }
    if (typeof session.userEmail !== 'string' || typeof session.userEmailVerified !== 'boolean') {
      const user = await supabaseRequest(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
      session.userEmail = typeof user.email === 'string' ? user.email.toLowerCase() : '';
      session.userEmailVerified = Boolean(user.email_confirmed_at);
      await setChromeStorage({ supabaseAuthSession: session });
    }
    supabaseSession = session;
    updateOwnerAccess(session);
    return session;
  }

  async function loadLeaderboard() {
    if (!supabaseSession) return;
    const session = await restoreSupabaseSession();
    if (!session) throw new Error('Je Supabase-sessie is verlopen. Log opnieuw in met Google.');
    const response = await supabaseRequest(
      `${supabaseUrl}/rest/v1/leaderboard?select=nickname,coins&nickname=not.is.null&order=coins.desc,nickname.asc&limit=10`,
      {
        headers: {
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );
    const entries = response
      .map((row) => {
        const score = Number(row.coins);
        return {
          nickname: typeof row.nickname === 'string' ? row.nickname : 'Speler',
          coins: Number.isSafeInteger(score) && score >= 0 ? score : 0,
        };
      })
      .sort((left, right) => right.coins - left.coins || left.nickname.localeCompare(right.nickname));
    leaderboardList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Nog geen spelers. Word de eerste!';
      leaderboardList.append(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const row = document.createElement('li');
      const rank = document.createElement('span');
      const name = document.createElement('span');
      const score = document.createElement('span');
      row.className = 'leaderboard-row';
      rank.className = 'leaderboard-rank';
      score.className = 'leaderboard-coins';
      rank.textContent = `${index + 1}.`;
      name.textContent = entry.nickname;
      score.textContent = `${entry.coins.toLocaleString('nl-BE')} ◉`;
      row.append(rank, name, score);
      leaderboardList.append(row);
    });
  }

  function getActivePromo() {
    if (!activePromo) return null;
    const now = Date.now();
    const startsAt = Date.parse(activePromo.starts_at);
    const endsAt = Date.parse(activePromo.ends_at);
    return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && now < endsAt
      ? activePromo
      : null;
  }

  function getActiveStoreEvent(eventType, itemKey) {
    const now = Date.now();
    return activeStoreEvents.find((event) =>
      event &&
      event.event_type === eventType &&
      Date.parse(event.starts_at) <= now &&
      Date.parse(event.ends_at) > now &&
      (!itemKey || (event.event_config && event.event_config.item_key === itemKey))
    ) || null;
  }

  function getActiveSecretEffects(effectType) {
    const now = Date.now();
    return ownedSecretPurchases.filter((purchase) =>
      purchase.effect_type === effectType &&
      Number.isFinite(Date.parse(purchase.expires_at)) &&
      Date.parse(purchase.expires_at) > now
    );
  }

  function currentShopDiscountPercent() {
    const promo = getActivePromo();
    const personalDiscount = getActiveSecretEffects('shop_discount')
      .reduce((total, effect) => total + Number(effect.effect_percent || 0), 0);
    return Math.min(100, (promo ? Number(promo.discount_percent) : 0) + personalDiscount);
  }

  function getPriceDetails(basePrice, itemKey) {
    const discountPercent = currentShopDiscountPercent();
    const discountCap = getActivePromo() ? Number(activePromo.max_discount_coins) : 5;
    const regularDiscount = Math.min(
      basePrice,
      discountCap,
      Math.floor(basePrice * discountPercent / 100)
    );
    const flashSale = itemKey ? getActiveStoreEvent('flash_sale', itemKey) : null;
    const saleDiscount = flashSale
      ? Math.min(
        basePrice - regularDiscount,
        Math.floor(basePrice * Number(flashSale.event_config.discount_percent) / 100)
      )
      : 0;
    const discount = regularDiscount + saleDiscount;
    return { price: basePrice - discount, discount, flashSale: Boolean(flashSale) };
  }

  function appendPromoBadge(element) {
    if (!getActivePromo()) return;
    const badge = document.createElement('span');
    badge.className = 'promo-badge';
    badge.textContent = 'PROMO';
    element.append(document.createTextNode(' '), badge);
  }

  function appendFlashSaleBadge(element, itemKey) {
    if (!getActiveStoreEvent('flash_sale', itemKey)) return;
    const badge = document.createElement('span');
    badge.className = 'promo-badge';
    badge.textContent = 'FLASH';
    element.append(document.createTextNode(' '), badge);
  }

  function storeItemName(itemKey) {
    const [type, id] = String(itemKey || '').split(':');
    const catalog = type === 'figure' ? figures : type === 'topping' ? toppings : [];
    return catalog.find((item) => item.id === id)?.name || 'winkelitem';
  }

  function formatEventTime(value) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp)
      ? new Date(timestamp).toLocaleString('nl-BE')
      : 'tijd onbekend';
  }

  function renderOwnerEventCountdown() {
    const eventName = ownerEventCountdownData && ownerEventCountdownData.event_name;
    const eventTime = ownerEventCountdownData && Date.parse(ownerEventCountdownData.event_at);
    if (typeof eventName !== 'string' || !Number.isFinite(eventTime)) {
      ownerEventCountdown.hidden = true;
      ownerEventNameDisplay.textContent = '';
      ownerEventTimer.textContent = '';
      ownerEventTarget.textContent = '';
      return;
    }

    ownerEventCountdown.hidden = false;
    ownerEventNameDisplay.textContent = eventName;
    ownerEventTarget.textContent = `Start: ${new Date(eventTime).toLocaleString('nl-BE')}`;
    const remaining = eventTime - Date.now();
    if (remaining <= 0) {
      ownerEventTimer.textContent = 'Het event is begonnen!';
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    ownerEventTimer.textContent = `Nog ${days}d ${hours}u ${minutes}m ${seconds}s`;
  }

  function renderEventsWidget() {
    eventsList.replaceChildren();
    renderOwnerFruitControls();
    const events = [];
    if (activePromo) {
      const active = Boolean(getActivePromo());
      const ending = formatEventTime(activePromo.ends_at);
      events.push({
        time: Date.parse(activePromo.starts_at) || 0,
        title: active ? `Promo actief · ${activePromo.discount_percent}% korting` : `Promo afgelopen · ${activePromo.discount_percent}%`,
        detail: `${activePromo.max_discount_coins} coins max. korting per item · gestart ${formatEventTime(activePromo.starts_at)} · ${active ? `eindigt ${ending}` : `eindigde ${ending}`}`,
        actor: leaderboardOwnerEmail,
        actorLabel: 'Gestart door',
      });
    }
    if (secretShopState && secretShopState.updated_by) {
      events.push({
        time: Date.parse(secretShopState.updated_at) || 0,
        title: secretShopState.is_open ? 'Secret shop gespawnd' : 'Secret shop gesloten',
        detail: `Gewijzigd ${formatEventTime(secretShopState.updated_at)}`,
        actor: leaderboardOwnerEmail,
        actorLabel: secretShopState.is_open ? 'Gespawnd door' : 'Gesloten door',
      });
    }
    if (secretShopOpen) {
      secretShopItems.filter((item) => item.is_active).forEach((item) => {
        events.push({
          time: Date.parse(item.created_at) || 0,
          title: `${item.emoji} ${item.name} gespawnd`,
          detail: `${item.price} coins · ${thisEffectDescription(item)} · ${formatEventTime(item.created_at)}`,
          actor: leaderboardOwnerEmail,
          actorLabel: 'Gespawnd door',
        });
      });
    }
    activeStoreEvents.forEach((event) => {
      const config = event.event_config || {};
      const ends = formatEventTime(event.ends_at);
      const detailByType = {
        double_coins: 'Dubbele coins bij punten',
        coin_gift: `${config.coins || 0} coins per account zolang het event actief is (login vereist)`,
        coin_shower: `${config.coins_per_bag || 0} coins per aangeklikt muntzakje`,
        flash_sale: `${config.discount_percent || 0}% korting op ${storeItemName(config.item_key)}`,
        lucky_drop: `${config.chance_percent || 0}% kans op ${config.reward_coins || 0} extra coins per punt`,
        points_challenge: `Doel per speler: ${config.target_points || 0} punten · beloning: ${config.reward_coins || 0} coins`,
        theme: `Thema: ${config.theme || 'onbekend'}`,
      };
      const titleByType = {
        double_coins: 'Dubbele-coins-event',
        coin_gift: 'Coinbonus-event',
        coin_shower: 'Muntjesregen',
        flash_sale: 'Flash sale',
        lucky_drop: 'Lucky-drop-event',
        points_challenge: 'Puntenchallenge',
        theme: 'Thema-event',
      };
      events.push({
        time: Date.parse(event.created_at) || 0,
        title: titleByType[event.event_type] || 'Winkel-event',
        detail: `${detailByType[event.event_type] || ''}${config.owner_fruit_granted ? ` · ownerfruit: +${config.fruit_bonus_percent || 60}% coins` : ''} · eindigt ${ends}`,
        actor: leaderboardOwnerEmail,
        actorLabel: 'Gestart door',
      });
    });
    events.sort((left, right) => right.time - left.time);
    if (!events.length) {
      const empty = document.createElement('li');
      empty.className = 'event-row';
      empty.textContent = 'Er zijn momenteel geen events.';
      eventsList.append(empty);
      return;
    }
    events.forEach((event) => {
      const row = document.createElement('li');
      const title = document.createElement('strong');
      const detail = document.createElement('small');
      const actor = document.createElement('small');
      row.className = 'event-row';
      title.textContent = event.title;
      detail.textContent = event.detail;
      actor.textContent = `${event.actorLabel} ${event.actor}`;
      row.append(title, detail, actor);
      eventsList.append(row);
    });
  }

  function renderOwnerFruitControls() {
    ownerFruitControls.replaceChildren();
    const now = Date.now();
    const availableEvents = isLeaderboardOwner
      ? activeStoreEvents.filter((event) =>
        event &&
        typeof event.id === 'string' &&
        Date.parse(event.starts_at) <= now &&
        Date.parse(event.ends_at) > now
      )
      : [];
    if (!availableEvents.length) {
      ownerFruitControls.hidden = true;
      return;
    }

    ownerFruitControls.hidden = false;
    const heading = document.createElement('h4');
    heading.textContent = 'Ownerfruit uitdelen';
    const hint = document.createElement('p');
    hint.textContent = 'Geef iedereen bij een actief event een 🍓 ownerfruit (+60% coins tot het event eindigt).';
    ownerFruitControls.append(heading, hint);

    availableEvents.forEach((event) => {
      const eventConfig = event.event_config || {};
      const row = document.createElement('div');
      row.className = 'owner-fruit-row';
      const label = document.createElement('span');
      label.textContent = event.event_type === 'coin_shower' ? 'Muntjesregen' : event.event_type.replaceAll('_', ' ');
      const button = document.createElement('button');
      button.type = 'button';
      if (eventConfig.owner_fruit_granted === true) {
        button.textContent = 'Ownerfruit gegeven';
        button.disabled = true;
      } else {
        button.textContent = ownerFruitGrantInProgress
          ? 'Ownerfruit uitdelen…'
          : 'Geef iedereen 🍓 ownerfruit';
        button.disabled = ownerFruitGrantInProgress;
        button.addEventListener('click', () => {
          ownerFruitGrantInProgress = true;
          renderOwnerFruitControls();
          button.disabled = true;
          void (async () => {
            const session = await restoreSupabaseSession();
            if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
            await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/grant_store_event_fruit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseConfig.publishableKey,
                Authorization: `Bearer ${session.accessToken}`,
              },
              body: JSON.stringify({ p_event_id: event.id }),
            });
            await loadStoreData();
          })().catch((error) => {
            storeEventStatus.textContent = `Ownerfruit uitdelen mislukt: ${error.message}`;
          }).finally(() => {
            ownerFruitGrantInProgress = false;
            renderOwnerFruitControls();
          });
        });
      }
      row.append(label, button);
      ownerFruitControls.append(row);
    });
  }

  function renderPromoBanner() {
    const promo = getActivePromo();
    if (!promo) {
      promoBanner.hidden = true;
      promoBanner.textContent = '';
      renderEventsWidget();
      return;
    }
    const minutes = Math.max(1, Math.ceil((Date.parse(promo.ends_at) - Date.now()) / 60000));
    promoBanner.hidden = false;
    promoBanner.textContent =
      `Promo actief: ${promo.discount_percent}% korting (max. ${promo.max_discount_coins} coins per item) · nog ${minutes} min`;
    renderEventsWidget();
  }

  function saveSecretCoinBonusEffects() {
    const effects = getActiveSecretEffects('coin_bonus').map((effect) => ({
      percent: Number(effect.effect_percent),
      expiresAt: effect.expires_at,
    }));
    return setChromeStorage({ secretCoinBonusEffects: effects });
  }

  async function loadStoreData() {
    const session = await restoreSupabaseSession();
    if (!session) return;
    const headers = {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${session.accessToken}`,
    };
    const now = encodeURIComponent(new Date().toISOString());
    const [promotions, settings, purchases, events, countdown] = await Promise.all([
      supabaseRequest(`${supabaseUrl}/rest/v1/store_promotions?select=*&id=eq.true&limit=1`, { headers }),
      supabaseRequest(`${supabaseUrl}/rest/v1/secret_shop_settings?select=is_open,updated_at,updated_by&id=eq.true&limit=1`, { headers }),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/secret_shop_purchases?select=id,item_id,item_name,item_emoji,item_description,effect_type,effect_percent,purchased_at,expires_at&user_id=eq.${encodeURIComponent(session.userId)}&order=purchased_at.desc`,
        { headers }
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/store_events?select=id,event_type,event_config,starts_at,ends_at,created_at&starts_at=lte.${now}&ends_at=gt.${now}&order=created_at.desc`,
        { headers }
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/owner_event_countdown?select=event_name,event_at,updated_at&id=eq.true&limit=1`,
        { headers }
      ),
    ]);
    activePromo = Array.isArray(promotions) ? promotions[0] || null : null;
    activeStoreEvents = Array.isArray(events) ? events : [];
    await setChromeStorage({ activeStoreEvents });
    secretShopState = Array.isArray(settings) ? settings[0] || null : null;
    ownerEventCountdownData = Array.isArray(countdown) ? countdown[0] || null : null;
    renderOwnerEventCountdown();
    secretShopOpen = Boolean(secretShopState && secretShopState.is_open);
    ownedSecretPurchases = Array.isArray(purchases) ? purchases : [];
    renderPromoBanner();
    await saveSecretCoinBonusEffects();
    if (activeStoreEvents.some((storeEvent) => storeEvent.event_type === 'coin_gift')) {
      const giftClaim = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/claim_store_event_coin_gifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: '{}',
      });
      const giftCoins = Number(giftClaim.coins_awarded);
      if (Number.isSafeInteger(giftCoins) && giftCoins > 0) {
        coins = Math.min(1000000000, coins + giftCoins);
        await setChromeStorage({ coins });
        render();
      }
    }

    if (!secretShopOpen && !isLeaderboardOwner) {
      secretShopSection.hidden = true;
      secretShopItems = [];
      secretShopList.replaceChildren();
      renderSecretInventory();
    } else {
      secretShopSection.hidden = false;
      const itemFilter = isLeaderboardOwner ? '' : '&is_active=eq.true';
      const items = await supabaseRequest(
        `${supabaseUrl}/rest/v1/secret_shop_items?select=*&order=created_at.desc${itemFilter}`,
        { headers }
      );
      secretShopItems = Array.isArray(items) ? items : [];
      renderSecretShop();
      if (isLeaderboardOwner) renderOwnerSecretItems();
    }
    renderEventsWidget();

    secretShopToggle.textContent = secretShopOpen ? 'Secret shop sluiten' : 'Secret shop spawnen';
    if (storeRefreshTimer) clearInterval(storeRefreshTimer);
    storeRefreshTimer = setInterval(() => {
      loadStoreData().catch((error) => {
        secretShopStatus.textContent = `Winkel bijwerken mislukt: ${error.message}`;
      });
    }, 15000);
  }

  async function loadPublicPromotion() {
    const headers = { apikey: supabaseConfig.publishableKey };
    const now = encodeURIComponent(new Date().toISOString());
    const [promotions, settings, events, countdown] = await Promise.all([
      supabaseRequest(
        `${supabaseUrl}/rest/v1/store_promotions?select=*&id=eq.true&limit=1`,
        { headers }
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/secret_shop_settings?select=is_open,updated_at,updated_by&id=eq.true&limit=1`,
        { headers }
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/store_events?select=id,event_type,event_config,starts_at,ends_at,created_at&starts_at=lte.${now}&ends_at=gt.${now}&order=created_at.desc`,
        { headers }
      ),
      supabaseRequest(
        `${supabaseUrl}/rest/v1/owner_event_countdown?select=event_name,event_at,updated_at&id=eq.true&limit=1`,
        { headers }
      ),
    ]);
    activePromo = Array.isArray(promotions) ? promotions[0] || null : null;
    activeStoreEvents = Array.isArray(events) ? events : [];
    await setChromeStorage({ activeStoreEvents });
    secretShopState = Array.isArray(settings) ? settings[0] || null : null;
    ownerEventCountdownData = Array.isArray(countdown) ? countdown[0] || null : null;
    renderOwnerEventCountdown();
    secretShopOpen = Boolean(secretShopState && secretShopState.is_open);
    renderPromoBanner();
    render();
  }

  async function loadGlobalAnnouncement() {
    const now = encodeURIComponent(new Date().toISOString());
    const rows = await supabaseRequest(
      `${supabaseUrl}/rest/v1/store_announcements?select=id,author_name,message,created_at,expires_at&expires_at=gt.${now}&order=created_at.desc&limit=1`,
      { headers: { apikey: supabaseConfig.publishableKey } }
    );
    const announcement = Array.isArray(rows) ? rows[0] : null;
    if (!announcement || announcement.id === lastAnnouncementId) return;
    lastAnnouncementId = announcement.id;
    globalAnnouncement.textContent = `${announcement.author_name}: ${announcement.message}`;
    globalAnnouncement.hidden = false;
    if (announcementHideTimer) clearTimeout(announcementHideTimer);
    const remaining = Math.max(0, Date.parse(announcement.expires_at) - Date.now());
    announcementHideTimer = setTimeout(() => {
      globalAnnouncement.hidden = true;
      globalAnnouncement.textContent = '';
    }, remaining);
  }

  function renderSecretShop() {
    renderPromoBanner();
    secretShopStatus.textContent = 'Tijdelijke items, alleen te koop zolang ze actief zijn.';
    secretShopList.replaceChildren();
    const ownedIds = new Set(ownedSecretPurchases
      .filter((purchase) => purchase.effect_type === 'cosmetic')
      .map((purchase) => purchase.item_id));
    secretShopItems.filter((item) => item.is_active).forEach((item) => {
      const row = document.createElement('div');
      const icon = document.createElement('span');
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      const details = document.createElement('small');
      const button = document.createElement('button');
      const owned = item.effect_type === 'cosmetic' && ownedIds.has(item.id);
      const price = getPriceDetails(Number(item.price));
      row.className = 'secret-shop-item';
      icon.className = 'secret-shop-emoji';
      icon.textContent = item.emoji;
      copy.className = 'secret-shop-copy';
      name.textContent = item.name;
      appendPromoBadge(name);
      details.textContent = `${item.description} · ${thisEffectDescription(item)}`;
      copy.append(name, details);
      button.type = 'button';
      button.className = 'secret-shop-price';
      button.textContent = owned ? 'In bezit' : `Koop ${price.price} ◉`;
      button.disabled = storageFailed || owned || coins < price.price || !secretShopOpen;
      button.addEventListener('click', () => {
        void purchaseSecretShopItem(item, button);
      });
      row.append(icon, copy, button);
      secretShopList.append(row);
    });
    renderSecretInventory();
  }

  function renderSecretInventory() {
    secretInventory.replaceChildren();
    if (!ownedSecretPurchases.length) {
      const empty = document.createElement('p');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Je hebt nog geen geheime items.';
      secretInventory.append(empty);
      return;
    }
    ownedSecretPurchases.forEach((purchase) => {
      const row = document.createElement('div');
      const icon = document.createElement('span');
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      const details = document.createElement('small');
      row.className = 'secret-shop-item';
      icon.className = 'secret-shop-emoji';
      icon.textContent = purchase.item_emoji;
      copy.className = 'secret-shop-copy';
      name.textContent = purchase.item_name;
      details.textContent = purchase.effect_type === 'cosmetic'
        ? 'Permanent collectible'
        : `${thisEffectDescription(purchase)} · tot ${new Date(purchase.expires_at).toLocaleString('nl-BE')}`;
      copy.append(name, details);
      row.append(icon, copy);
      secretInventory.append(row);
    });
  }

  function thisEffectDescription(item) {
    if (item.effect_type === 'coin_bonus') {
      return `+${item.effect_percent}% coins per punt, ${item.effect_duration_minutes || 'tijdelijk'} min`;
    }
    if (item.effect_type === 'shop_discount') {
      return `+${item.effect_percent}% winkelkorting, ${item.effect_duration_minutes || 'tijdelijk'} min`;
    }
    return 'Permanent collectible';
  }

  function renderOwnerSecretItems() {
    ownerSecretItemList.replaceChildren();
    if (!secretShopItems.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Nog geen secret-shopitems.';
      ownerSecretItemList.append(empty);
      return;
    }
    secretShopItems.forEach((item) => {
      const row = document.createElement('li');
      const icon = document.createElement('span');
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      const details = document.createElement('small');
      const toggle = document.createElement('button');
      row.className = 'owner-secret-item';
      icon.className = 'secret-shop-emoji';
      icon.textContent = item.emoji;
      copy.className = 'secret-shop-copy';
      name.textContent = item.name;
      appendPromoBadge(name);
      details.textContent = `${item.price} coins · ${thisEffectDescription(item)}`;
      copy.append(name, details);
      toggle.type = 'button';
      toggle.textContent = item.is_active ? 'Verbergen' : 'Activeren';
      toggle.addEventListener('click', () => {
        void setSecretItemActive(item, !item.is_active, toggle);
      });
      row.append(icon, copy, toggle);
      ownerSecretItemList.append(row);
    });
  }

  async function purchaseSecretShopItem(item, button) {
    if (!supabaseSession || !secretShopOpen || storageFailed) return;
    button.disabled = true;
    secretShopStatus.textContent = `${item.name} wordt gekocht…`;
    try {
      const session = await restoreSupabaseSession();
      if (!session) throw new Error('Log opnieuw in om geheime items te kopen.');
      const result = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/purchase_secret_shop_item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ p_item_id: item.id }),
      });
      if (
        !result ||
        typeof result !== 'object' ||
        !Number.isSafeInteger(Number(result.coins)) ||
        Number(result.coins) < 0 ||
        Number(result.coins) > 1000000000
      ) {
        throw new Error('Supabase gaf geen geldige aankoop terug.');
      }
      coins = Number(result.coins);
      await setChromeStorage({ coins });
      await Promise.all([loadStoreData(), loadLeaderboard()]);
      secretShopStatus.textContent = `${item.name} gekocht voor ${result.price} coins.`;
      if (result.effect_type !== 'cosmetic') {
        secretShopStatus.textContent += ` Effect actief: ${result.effect_percent}% voor ${item.effect_duration_minutes} minuten.`;
      }
    } catch (error) {
      secretShopStatus.textContent = `Aankoop mislukt: ${error.message}`;
      button.disabled = false;
    }
  }

  async function setSecretItemActive(item, isActive, button) {
    if (!isLeaderboardOwner) return;
    button.disabled = true;
    secretOwnerStatus.textContent = 'Item bijwerken…';
    try {
      const session = await restoreSupabaseSession();
      if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
      await supabaseRequest(
        `${supabaseUrl}/rest/v1/secret_shop_items?id=eq.${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${session.accessToken}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ is_active: isActive }),
        }
      );
      await loadStoreData();
      secretOwnerStatus.textContent = isActive ? 'Item geactiveerd.' : 'Item verborgen.';
    } catch (error) {
      secretOwnerStatus.textContent = `Item bijwerken mislukt: ${error.message}`;
      button.disabled = false;
    }
  }

  async function setSecretShopOpen(isOpen) {
    const session = await restoreSupabaseSession();
    if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
    await supabaseRequest(`${supabaseUrl}/rest/v1/secret_shop_settings?id=eq.true`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${session.accessToken}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        is_open: isOpen,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      }),
    });
    await loadStoreData();
  }

  async function loadOwnLeaderboardEntry() {
    const session = await restoreSupabaseSession();
    if (!session) throw new Error('Je Supabase-sessie is verlopen. Log opnieuw in met Google.');
    const entries = await supabaseRequest(
      `${supabaseUrl}/rest/v1/leaderboard?select=nickname,coins&user_id=eq.${encodeURIComponent(session.userId)}&limit=1`,
      {
        headers: {
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );
    if (!Array.isArray(entries)) throw new Error('Supabase gaf geen geldige accountscore terug.');
    if (!entries.length) return null;

    const score = Number(entries[0].coins);
    if (!Number.isSafeInteger(score) || score < 0 || score > 1000000000) {
      throw new Error('De opgeslagen accountscore is ongeldig.');
    }
    return {
      nickname: typeof entries[0].nickname === 'string' ? entries[0].nickname : '',
      coins: score,
    };
  }

  function isValidNickname(nickname) {
    return nickname.length >= 3 && nickname.length <= 20 && !/[\u0000-\u001f\u007f]/.test(nickname);
  }

  function renderOwnerPlayers(entries) {
    ownerPlayerList.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'Er zijn nog geen spelers.';
      ownerPlayerList.append(empty);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement('li');
      const id = document.createElement('code');
      const nicknameLabel = document.createElement('label');
      const nicknameInput = document.createElement('input');
      const coinsLabel = document.createElement('label');
      const coinsInput = document.createElement('input');
      const saveButton = document.createElement('button');
      row.className = 'owner-player';
      id.className = 'owner-player-id';
      id.textContent = `Account-ID: ${entry.user_id}`;
      nicknameLabel.textContent = 'Nickname';
      nicknameInput.type = 'text';
      nicknameInput.minLength = 3;
      nicknameInput.maxLength = 20;
      nicknameInput.value = entry.nickname || '';
      nicknameLabel.append(nicknameInput);
      coinsLabel.textContent = 'Coins';
      coinsInput.type = 'number';
      coinsInput.min = '0';
      coinsInput.max = '1000000000';
      coinsInput.step = '1';
      coinsInput.value = String(entry.coins);
      coinsLabel.append(coinsInput);
      saveButton.type = 'button';
      saveButton.textContent = 'Opslaan';
      saveButton.addEventListener('click', () => {
        const nickname = nicknameInput.value.trim();
        const score = Number(coinsInput.value);
        if (!isValidNickname(nickname)) {
          ownerStatus.textContent = 'Een nickname moet 3 tot 20 tekens bevatten.';
          nicknameInput.focus();
          return;
        }
        if (!Number.isSafeInteger(score) || score < 0 || score > 1000000000) {
          ownerStatus.textContent = 'De score moet een heel getal van 0 tot 1.000.000.000 zijn.';
          coinsInput.focus();
          return;
        }
        saveButton.disabled = true;
        ownerStatus.textContent = 'Wijzigingen opslaan…';
        void (async () => {
          const session = await restoreSupabaseSession();
          if (!session || !isLeaderboardOwner) {
            throw new Error('Je account heeft geen ownerrechten.');
          }
          await supabaseRequest(
            `${supabaseUrl}/rest/v1/leaderboard?user_id=eq.${encodeURIComponent(entry.user_id)}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseConfig.publishableKey,
                Authorization: `Bearer ${session.accessToken}`,
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                nickname,
                coins: score,
                updated_at: new Date().toISOString(),
              }),
            }
          );
          if (entry.user_id === session.userId) {
            coins = score;
            leaderboardNickname = nickname;
            nicknameInput.value = nickname;
            await setChromeStorage({ coins, leaderboardNickname });
            render();
          }
          await loadLeaderboard();
          await loadOwnerPlayers();
          ownerStatus.textContent = 'Speler bijgewerkt.';
        })().catch((error) => {
          ownerStatus.textContent = `Opslaan mislukt: ${error.message}`;
        }).finally(() => {
          saveButton.disabled = false;
        });
      });
      row.append(id, nicknameLabel, coinsLabel, saveButton);
      ownerPlayerList.append(row);
    });
  }

  async function loadOwnerPlayers() {
    const session = await restoreSupabaseSession();
    if (!session || !isLeaderboardOwner) {
      throw new Error('Je account heeft geen ownerrechten.');
    }
    ownerStatus.textContent = 'Spelers laden…';
    const entries = [];
    const pageSize = 500;
    let offset = 0;
    while (true) {
      const page = await supabaseRequest(
        `${supabaseUrl}/rest/v1/leaderboard?select=user_id,nickname,coins&order=nickname.asc&limit=${pageSize}&offset=${offset}`,
        {
          headers: {
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      entries.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    renderOwnerPlayers(entries);
    ownerStatus.textContent = `${entries.length} speler(s) geladen.`;
  }

  async function syncLeaderboardScore() {
    if (!supabaseSession) return;
    if (!Number.isSafeInteger(coins) || coins < 0 || coins > 1000000000) {
      throw new Error('Je coinstand valt buiten de limiet voor het leaderboard.');
    }
    const session = await restoreSupabaseSession();
    if (!session) throw new Error('Je Supabase-sessie is verlopen. Log opnieuw in met Google.');
    await supabaseRequest(`${supabaseUrl}/rest/v1/leaderboard?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${session.accessToken}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: session.userId,
        nickname: leaderboardNickname || null,
        coins,
        updated_at: new Date().toISOString(),
      }),
    });
    await loadLeaderboard();
  }

  async function signInToLeaderboard(interactive) {
    if (!supabaseConfigured) {
      leaderboardStatus.textContent = 'Supabase is nog niet ingesteld. Volg de Supabase-stappen in README.md.';
      return;
    }
    leaderboardLogin.disabled = true;
    leaderboardStatus.textContent = interactive ? 'Google-login openen…' : 'Google-sessie herstellen…';
    try {
      supabaseSession = interactive ? await createSupabaseSession() : await restoreSupabaseSession();
      if (!supabaseSession) {
        leaderboardLogin.hidden = false;
        leaderboardLogout.hidden = true;
        nicknameForm.hidden = true;
        leaderboardStatus.textContent = leaderboardNickname
          ? 'Je sessie is verlopen. Log opnieuw in met Google.'
          : 'Log in met Google om de top 10 te bekijken.';
        leaderboardLogin.disabled = !supabaseConfigured;
        return;
      }
    } catch (error) {
      supabaseSession = null;
      updateOwnerAccess(null);
      leaderboardLogin.hidden = false;
      leaderboardLogout.hidden = true;
      nicknameForm.hidden = true;
      leaderboardStatus.textContent = interactive
        ? `Google-login mislukt: ${error.message}`
        : `Supabase-sessie herstellen mislukt: ${error.message}`;
      leaderboardLogin.disabled = !supabaseConfigured;
      return;
    }

    leaderboardLogin.hidden = true;
    leaderboardLogout.hidden = false;
    nicknameForm.hidden = false;
    try {
      const accountEntry = await loadOwnLeaderboardEntry();
      if (accountEntry) {
        coins = accountEntry.coins;
        leaderboardNickname = accountEntry.nickname;
        nicknameInput.value = leaderboardNickname;
        await setChromeStorage({ coins, leaderboardNickname });
        render();
      } else {
        nicknameInput.value = leaderboardNickname;
      }
      await syncLeaderboardScore();
      await loadStoreData();
      if (leaderboardNickname) {
        leaderboardStatus.textContent = 'Ingelogd. Je accountcoins zijn gesynchroniseerd.';
      } else {
        leaderboardStatus.textContent = 'Kies een nickname om mee te doen.';
      }
    } catch (error) {
      leaderboardStatus.textContent = `Leaderboard bijwerken mislukt: ${error.message}`;
    } finally {
      leaderboardLogin.disabled = !supabaseConfigured;
    }
  }

  function toppingBoostPercent() {
    return equippedToppings.reduce((total, id) => total + window.PuntKlikToppingBoosts[id], 0);
  }

  function updateHeader() {
    coinCount.textContent = String(coins);
    status.textContent = `Tik ${clicksToSpin} keer. Daarna draaien je punten.`;
    const themeEvent = getActiveStoreEvent('theme');
    const eventTheme = themeEvent && themeEvent.event_config && themeEvent.event_config.theme;
    document.body.dataset.decoration = Object.hasOwn(window.PuntKlikFigures, eventTheme) ? eventTheme : figure;
    boostTotal.textContent = `Actieve toppingbonus: +${toppingBoostPercent()}% coins`;
  }

  function renderFigures() {
    figureShop.replaceChildren();
    for (const item of figures) {
      const row = document.createElement('div');
      row.className = 'store-item';
      const icon = document.createElement('span');
      const description = document.createElement('div');
      const name = document.createElement('span');
      const note = document.createElement('span');
      icon.className = 'item-icon';
      icon.innerHTML = `<svg viewBox="0 0 160 160" aria-hidden="true">${window.PuntKlikFigures[item.id]}</svg>`;
      name.className = 'item-name';
      note.className = 'item-note';
      name.textContent = item.name;
      appendPromoBadge(name);
      appendFlashSaleBadge(name, `figure:${item.id}`);
      note.textContent = item.note;
      description.append(name, note);

      const button = document.createElement('button');
      const owned = ownedFigures.includes(item.id);
      if (owned && figure === item.id) {
        button.textContent = 'Gekozen';
        button.classList.add('active');
        button.disabled = true;
      } else if (owned) {
        button.textContent = 'Kies';
        button.disabled = storageFailed;
        button.addEventListener('click', () => selectFigure(item.id));
      } else {
        const price = getPriceDetails(item.price, `figure:${item.id}`);
        button.textContent = `Koop ${price.price}${price.discount ? ` (was ${item.price})` : ''}`;
        button.disabled = storageFailed || coins < price.price;
        button.addEventListener('click', () => buyFigure(item));
      }
      row.append(icon, description, button);
      figureShop.append(row);
    }
  }

  function renderToppings() {
    toppingShop.replaceChildren();
    for (const item of toppings) {
      const row = document.createElement('div');
      row.className = 'store-item';
      const icon = document.createElement('span');
      const description = document.createElement('div');
      const name = document.createElement('span');
      const note = document.createElement('span');
      icon.className = 'item-icon';
      icon.innerHTML = `<svg viewBox="0 0 160 160" aria-hidden="true">${window.PuntKlikToppings[item.id]}</svg>`;
      name.className = 'item-name';
      note.className = 'item-note';
      name.textContent = item.name;
      appendPromoBadge(name);
      appendFlashSaleBadge(name, `topping:${item.id}`);
      note.textContent = item.note;
      description.append(name, note);

      const button = document.createElement('button');
      const owned = ownedToppings.includes(item.id);
      const equipped = equippedToppings.includes(item.id);
      if (!owned) {
        const price = getPriceDetails(item.price, `topping:${item.id}`);
        button.textContent = `Koop ${price.price}${price.discount ? ` (was ${item.price})` : ''}`;
        button.disabled = storageFailed || coins < price.price;
        button.addEventListener('click', () => buyTopping(item));
      } else {
        button.textContent = equipped ? 'Actief' : 'Toevoegen';
        button.classList.toggle('active', equipped);
        button.disabled = storageFailed;
        button.addEventListener('click', () => toggleTopping(item.id));
      }
      row.append(icon, description, button);
      toppingShop.append(row);
    }
  }

  function render() {
    updateHeader();
    renderOwnerEventCountdown();
    renderFigures();
    renderToppings();
    if (secretShopOpen || isLeaderboardOwner) renderSecretShop();
    renderEventsWidget();
  }

  function selectFigure(id) {
    saveSettings({ decoration: id }, () => {
      figure = id;
      message.textContent = `${figures.find((item) => item.id === id).name} gekozen.`;
      render();
    });
  }

  function buyFigure(item) {
    const price = getPriceDetails(item.price, `figure:${item.id}`).price;
    if (coins < price || ownedFigures.includes(item.id)) return;
    const nextCoins = coins - price;
    const nextOwnedFigures = [...ownedFigures, item.id];
    saveSettings(
      { coins: nextCoins, ownedDecorations: nextOwnedFigures, decoration: item.id },
      () => {
        coins = nextCoins;
        ownedFigures = nextOwnedFigures;
        figure = item.id;
        message.textContent = `${item.name} gekocht en gekozen.`;
        render();
      }
    );
  }

  function buyTopping(item) {
    const price = getPriceDetails(item.price, `topping:${item.id}`).price;
    if (coins < price || ownedToppings.includes(item.id)) return;
    const nextCoins = coins - price;
    const nextOwnedToppings = [...ownedToppings, item.id];
    const nextEquippedToppings = [...equippedToppings, item.id];
    saveSettings(
      { coins: nextCoins, ownedToppings: nextOwnedToppings, equippedToppings: nextEquippedToppings },
      () => {
        coins = nextCoins;
        ownedToppings = nextOwnedToppings;
        equippedToppings = nextEquippedToppings;
        message.textContent = `${item.name} gekocht en toegevoegd.`;
        render();
      }
    );
  }

  function toggleTopping(id) {
    const nextEquippedToppings = equippedToppings.includes(id)
      ? equippedToppings.filter((item) => item !== id)
      : [...equippedToppings, id];
    saveSettings({ equippedToppings: nextEquippedToppings }, () => {
      equippedToppings = nextEquippedToppings;
      const item = toppings.find((topping) => topping.id === id);
      message.textContent = equippedToppings.includes(id)
        ? `${item.name} toegevoegd.`
        : `${item.name} verwijderd.`;
      render();
    });
  }

  chrome.storage.local.get(
    ['coins', 'ownedDecorations', 'decoration', 'ownedToppings', 'equippedToppings', 'clicksToSpin', 'leaderboardNickname', 'supabaseSyncError'],
    (settings) => {
      const error = chrome.runtime.lastError;
      if (error) {
        showStorageError(error);
        return;
      }
      const data = settings || {};
      coins = Number.isSafeInteger(data.coins) && data.coins >= 0 ? data.coins : 0;
      ownedFigures = Array.isArray(data.ownedDecorations)
        ? [...new Set(['classic', ...data.ownedDecorations.filter((id) => figures.some((item) => item.id === id))])]
        : ['classic'];
      figure = ownedFigures.includes(data.decoration) ? data.decoration : 'classic';
      ownedToppings = Array.isArray(data.ownedToppings)
        ? [...new Set(data.ownedToppings.filter((id) => toppings.some((item) => item.id === id)))]
        : [];
      equippedToppings = Array.isArray(data.equippedToppings)
        ? [...new Set(data.equippedToppings.filter((id) => ownedToppings.includes(id)))]
        : [];
      clicksToSpin =
        Number.isSafeInteger(data.clicksToSpin) && data.clicksToSpin >= 1 && data.clicksToSpin <= 50
          ? data.clicksToSpin
          : 12;
      leaderboardNickname =
        typeof data.leaderboardNickname === 'string' ? data.leaderboardNickname.trim().slice(0, 20) : '';
      render();
      if (!supabaseConfigured) {
        leaderboardLogin.disabled = true;
        leaderboardStatus.textContent = 'Stel Supabase in volgens de stappen in README.md.';
      } else {
        void loadPublicPromotion().catch((error) => {
          console.error('PuntKlik promo kon niet worden opgehaald:', error);
          if (!getActivePromo()) {
            promoBanner.hidden = false;
            promoBanner.textContent = `Promo ophalen mislukt: ${error.message}`;
          }
        });
        void loadGlobalAnnouncement().catch((error) => {
          console.error('PuntKlik announcement kon niet worden opgehaald:', error);
        });
        if (announcementRefreshTimer) clearInterval(announcementRefreshTimer);
        announcementRefreshTimer = setInterval(() => {
          loadGlobalAnnouncement().catch((error) => {
            console.error('PuntKlik announcement kon niet worden opgehaald:', error);
          });
        }, 1000);
        if (storeRefreshTimer) clearInterval(storeRefreshTimer);
        storeRefreshTimer = setInterval(() => {
          if (supabaseSession) {
            loadStoreData().catch((error) => {
              secretShopStatus.textContent = `Winkel bijwerken mislukt: ${error.message}`;
            });
          } else {
            loadPublicPromotion().catch((error) => {
              console.error('PuntKlik promo kon niet worden opgehaald:', error);
              if (!getActivePromo()) {
                promoBanner.hidden = false;
                promoBanner.textContent = `Promo ophalen mislukt: ${error.message}`;
              }
            });
          }
        }, 15000);
        void getChromeStorage('supabaseAuthSession').then((saved) => {
          if (saved.supabaseAuthSession) {
            void signInToLeaderboard(false);
          } else {
            leaderboardStatus.textContent = data.supabaseSyncError
              ? `Coin opslaan mislukt: ${data.supabaseSyncError}`
              : 'Log in met Google om de top 10 te bekijken.';
          }
        }).catch((error) => {
          leaderboardStatus.textContent = `Supabase-sessie lezen mislukt: ${error.message}`;
        });
      }
    }
  );

  leaderboardLogin.addEventListener('click', () => {
    void signInToLeaderboard(true);
  });

  function updateEventsExpanded() {
    const expanded = eventsWidget.classList.contains('is-open')
      || eventsWidget.matches(':hover')
      || eventsWidget.contains(document.activeElement);
    eventsTrigger.setAttribute('aria-expanded', String(expanded));
  }

  eventsTrigger.addEventListener('click', () => {
    const isOpen = !eventsWidget.classList.contains('is-open');
    eventsWidget.classList.toggle('is-open', isOpen);
    updateEventsExpanded();
  });
  eventsWidget.addEventListener('mouseenter', updateEventsExpanded);
  eventsWidget.addEventListener('mouseleave', updateEventsExpanded);
  eventsWidget.addEventListener('focusin', updateEventsExpanded);
  eventsWidget.addEventListener('focusout', updateEventsExpanded);
  eventsWidget.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      eventsWidget.classList.remove('is-open');
      updateEventsExpanded();
      eventsTrigger.focus();
    }
  });

  nicknameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const nickname = nicknameInput.value.trim();
    if (!isValidNickname(nickname)) {
      leaderboardStatus.textContent = 'Kies een nickname van 3 tot 20 tekens.';
      nicknameInput.focus();
      return;
    }
    if (!supabaseSession) {
      leaderboardStatus.textContent = 'Log eerst in met Google.';
      return;
    }
    const submitButton = nicknameForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    chrome.storage.local.set({ leaderboardNickname: nickname }, async () => {
      const error = chrome.runtime.lastError;
      if (error) {
        submitButton.disabled = false;
        leaderboardStatus.textContent = `Nickname kon niet worden opgeslagen: ${error.message}`;
        console.error('PuntKlik nickname-opslagfout:', error);
        return;
      }
      leaderboardNickname = nickname;
      try {
        await syncLeaderboardScore();
        await loadStoreData();
        leaderboardStatus.textContent = 'Je doet mee aan het leaderboard.';
      } catch (syncError) {
        leaderboardStatus.textContent = `Score uploaden mislukt: ${syncError.message}`;
      } finally {
        submitButton.disabled = false;
      }
    });
  });

  leaderboardLogout.addEventListener('click', () => {
    const session = supabaseSession;
    supabaseSession = null;
    updateOwnerAccess(null);
    activePromo = null;
    secretShopOpen = false;
    secretShopState = null;
    secretShopItems = [];
    ownedSecretPurchases = [];
    promoBanner.hidden = true;
    secretShopSection.hidden = true;
    secretShopList.replaceChildren();
    secretInventory.replaceChildren();
    renderEventsWidget();
    if (storeRefreshTimer) clearInterval(storeRefreshTimer);
    void loadPublicPromotion().catch((error) => {
      console.error('PuntKlik promo kon niet worden opgehaald:', error);
    });
    storeRefreshTimer = setInterval(() => {
      loadPublicPromotion().catch((error) => {
        console.error('PuntKlik promo kon niet worden opgehaald:', error);
      });
    }, 15000);
    void setChromeStorage({ secretCoinBonusEffects: [] }).catch((error) => {
      leaderboardStatus.textContent = `Uitloggen: bonus wissen mislukt: ${error.message}`;
    });
    leaderboardLogin.hidden = false;
    leaderboardLogout.hidden = true;
    nicknameForm.hidden = true;
    leaderboardList.replaceChildren();
    void (async () => {
      await removeChromeStorage('supabaseAuthSession');
      if (session) {
        await supabaseRequest(`${supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
      }
      leaderboardStatus.textContent = 'Uitgelogd.';
    })().catch((error) => {
      leaderboardStatus.textContent = `Lokaal uitgelogd, maar Supabase-uitloggen mislukte: ${error.message}`;
    });
  });

  ownerManageToggle.addEventListener('click', () => {
    if (!isLeaderboardOwner) return;
    ownerManagement.hidden = !ownerManagement.hidden;
    ownerManageToggle.textContent = ownerManagement.hidden ? 'Ownerbeheer' : 'Beheer sluiten';
    if (!ownerManagement.hidden) {
      void loadOwnerPlayers().catch((error) => {
        ownerStatus.textContent = `Spelers laden mislukt: ${error.message}`;
      });
    }
  });

  async function saveOwnerEventCountdown(eventName, eventAt) {
    const session = await restoreSupabaseSession();
    if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
    const result = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/set_owner_event_countdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ p_event_name: eventName, p_event_at: eventAt }),
    });
    if (eventName !== null && (!result || typeof result.event_name !== 'string')) {
      throw new Error('Supabase gaf geen geldige owner-eventcounter terug.');
    }
    await loadStoreData();
  }

  ownerEventCountdownForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const eventName = document.getElementById('owner-event-name-input').value.trim();
    const localDate = document.getElementById('owner-event-at-input').value;
    const eventAt = new Date(localDate);
    if (!eventName || eventName.length > 60 || /[\u0000-\u001f\u007f]/.test(eventName)) {
      ownerEventCountdownStatus.textContent = 'De eventnaam moet 1 tot 60 tekens bevatten.';
      return;
    }
    if (!localDate || !Number.isFinite(eventAt.getTime()) || eventAt.getTime() <= Date.now()) {
      ownerEventCountdownStatus.textContent = 'Kies een geldige starttijd in de toekomst.';
      return;
    }
    const submitButton = ownerEventCountdownForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    ownerEventCountdownStatus.textContent = 'Counter instellen…';
    void saveOwnerEventCountdown(eventName, eventAt.toISOString()).then(() => {
      ownerEventCountdownStatus.textContent = `Counter ingesteld voor ${eventName}.`;
      ownerEventCountdownForm.reset();
    }).catch((error) => {
      ownerEventCountdownStatus.textContent = `Counter instellen mislukt: ${error.message}`;
    }).finally(() => {
      submitButton.disabled = false;
    });
  });

  ownerEventCountdownClear.addEventListener('click', () => {
    ownerEventCountdownClear.disabled = true;
    ownerEventCountdownStatus.textContent = 'Counter wissen…';
    void saveOwnerEventCountdown(null, null).then(() => {
      ownerEventCountdownStatus.textContent = 'Owner-eventcounter gewist.';
    }).catch((error) => {
      ownerEventCountdownStatus.textContent = `Counter wissen mislukt: ${error.message}`;
    }).finally(() => {
      ownerEventCountdownClear.disabled = false;
    });
  });

  function updateStoreEventFields() {
    document.querySelectorAll('.event-fields').forEach((fields) => {
      fields.hidden = fields.id !== `event-fields-${storeEventType.value}`;
    });
  }

  function readEventNumber(id, label, min, max) {
    const value = Number(document.getElementById(id).value);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${label} moet tussen ${min} en ${max} liggen.`);
    }
    return value;
  }

  storeEventType.addEventListener('change', updateStoreEventFields);
  updateStoreEventFields();

  storeEventForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const eventType = storeEventType.value;
    let eventConfig;
    try {
      const durationMinutes = readEventNumber('store-event-duration', 'De duur in minuten', 1, 1440);
      switch (eventType) {
        case 'double_coins':
          eventConfig = {};
          break;
        case 'coin_gift':
          eventConfig = { coins: readEventNumber('coin-gift-amount', 'De coinbonus', 1, 1000000) };
          break;
        case 'coin_shower':
          eventConfig = {
            coins_per_bag: readEventNumber('coin-shower-amount', 'Coins per muntzakje', 1, 1000000),
          };
          break;
        case 'flash_sale':
          eventConfig = {
            item_key: document.getElementById('flash-sale-item').value,
            discount_percent: readEventNumber('flash-sale-percent', 'De korting', 1, 100),
          };
          break;
        case 'lucky_drop':
          eventConfig = {
            chance_percent: readEventNumber('lucky-drop-chance', 'De lucky-dropkans', 1, 100),
            reward_coins: readEventNumber('lucky-drop-reward', 'De lucky-dropbeloning', 1, 1000000),
          };
          break;
        case 'points_challenge':
          eventConfig = {
            target_points: readEventNumber('challenge-target', 'Het puntendoel', 1, 1000),
            reward_coins: readEventNumber('challenge-reward', 'De challengebeloning', 1, 1000000),
          };
          break;
        case 'theme':
          eventConfig = { theme: document.getElementById('theme-event-theme').value };
          break;
        default:
          throw new Error('Kies een geldige eventsoort.');
      }

      const submitButton = storeEventForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      storeEventStatus.textContent = 'Event starten…';
      void (async () => {
        const session = await restoreSupabaseSession();
        if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
        const result = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/start_store_event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({
            p_event_type: eventType,
            p_event_config: eventConfig,
            p_duration_minutes: durationMinutes,
          }),
        });
        if (!result || typeof result.id !== 'string') throw new Error('Supabase gaf geen geldig event terug.');
        await loadStoreData();
        const labels = {
          double_coins: 'Dubbele coins gestart',
          coin_gift: `Coinbonus van ${eventConfig.coins} coins per account gestart`,
          coin_shower: `Muntjesregen gestart (${eventConfig.coins_per_bag} coins per zakje)`,
          flash_sale: 'Flash sale gestart',
          lucky_drop: 'Lucky drop gestart',
          points_challenge: 'Puntenchallenge gestart',
          theme: 'Thema-event gestart',
        };
        storeEventStatus.textContent = `${labels[eventType]} voor ${durationMinutes} minuten.`;
      })().catch((error) => {
        storeEventStatus.textContent = `Event starten mislukt: ${error.message}`;
      }).finally(() => {
        submitButton.disabled = false;
      });
    } catch (error) {
      storeEventStatus.textContent = error.message;
    }
  });

  announcementForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const authorName = document.getElementById('announcement-name').value.trim();
    const text = document.getElementById('announcement-message').value.trim();
    if (!authorName || authorName.length > 30 || /[\u0000-\u001f\u007f]/.test(authorName)) {
      announcementStatus.textContent = 'De naam moet 1 tot 30 tekens bevatten.';
      return;
    }
    if (!text || text.length > 1000 || /[\u0000-\u001f\u007f]/.test(text)) {
      announcementStatus.textContent = 'Het bericht moet 1 tot 1.000 tekens bevatten.';
      return;
    }
    const submitButton = announcementForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    announcementStatus.textContent = 'Announcement verzenden…';
    void (async () => {
      const session = await restoreSupabaseSession();
      if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
      await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/send_global_announcement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ p_author_name: authorName, p_message: text }),
      });
      lastAnnouncementId = '';
      await loadGlobalAnnouncement();
      announcementStatus.textContent = 'Announcement verzonden (5 seconden zichtbaar).';
      announcementForm.reset();
    })().catch((error) => {
      announcementStatus.textContent = `Announcement verzenden mislukt: ${error.message}`;
    }).finally(() => {
      submitButton.disabled = false;
    });
  });

  promoForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const discountPercent = Number(document.getElementById('promo-percent').value);
    const durationMinutes = Number(document.getElementById('promo-duration').value);
    if (!Number.isSafeInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      promoOwnerStatus.textContent = 'Korting moet tussen 1 en 100% liggen.';
      return;
    }
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      promoOwnerStatus.textContent = 'Duur moet tussen 1 minuut en 24 uur liggen.';
      return;
    }
    const submitButton = promoForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    promoOwnerStatus.textContent = 'Promo starten…';
    void (async () => {
      const session = await restoreSupabaseSession();
      if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);
      await supabaseRequest(`${supabaseUrl}/rest/v1/store_promotions?on_conflict=id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: true,
          discount_percent: discountPercent,
          max_discount_coins: 5,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          created_by: session.userId,
        }),
      });
      await loadStoreData();
      promoOwnerStatus.textContent = `Promo gestart: ${discountPercent}% korting, maximaal 5 coins per item, ${durationMinutes} minuten.`;
    })().catch((error) => {
      promoOwnerStatus.textContent = `Promo starten mislukt: ${error.message}`;
    }).finally(() => {
      submitButton.disabled = false;
    });
  });

  secretItemEffect.addEventListener('change', () => {
    secretEffectFields.hidden = secretItemEffect.value === 'cosmetic';
  });

  secretShopToggle.addEventListener('click', () => {
    if (!isLeaderboardOwner) return;
    secretShopToggle.disabled = true;
    secretOwnerStatus.textContent = secretShopOpen ? 'Secret shop sluiten…' : 'Secret shop spawnen…';
    void setSecretShopOpen(!secretShopOpen).then(() => {
      secretOwnerStatus.textContent = secretShopOpen ? 'Secret shop gespawnd.' : 'Secret shop gesloten.';
    }).catch((error) => {
      secretOwnerStatus.textContent = `Secret shop wijzigen mislukt: ${error.message}`;
    }).finally(() => {
      secretShopToggle.disabled = false;
    });
  });

  secretItemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('secret-item-name').value.trim();
    const description = document.getElementById('secret-item-description').value.trim();
    const emoji = document.getElementById('secret-item-emoji').value.trim();
    const price = Number(document.getElementById('secret-item-price').value);
    const effectType = secretItemEffect.value;
    const effectPercent = Number(document.getElementById('secret-effect-percent').value);
    const effectDurationMinutes = Number(document.getElementById('secret-effect-duration').value);
    if (name.length < 2 || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) {
      secretOwnerStatus.textContent = 'De naam moet 2 tot 40 tekens bevatten.';
      return;
    }
    if (description.length < 2 || description.length > 120 || /[\u0000-\u001f\u007f]/.test(description)) {
      secretOwnerStatus.textContent = 'De beschrijving moet 2 tot 120 tekens bevatten.';
      return;
    }
    if (!emoji || emoji.length > 8 || /[\u0000-\u001f\u007f]/.test(emoji)) {
      secretOwnerStatus.textContent = 'Kies een emoji/badge van maximaal 8 tekens.';
      return;
    }
    if (!Number.isSafeInteger(price) || price < 1 || price > 1000000000) {
      secretOwnerStatus.textContent = 'De prijs moet tussen 1 en 1.000.000.000 coins liggen.';
      return;
    }
    if (
      effectType !== 'cosmetic' &&
      (!Number.isSafeInteger(effectPercent) || effectPercent < 1 || effectPercent > 100)
    ) {
      secretOwnerStatus.textContent = 'Het effect moet tussen 1 en 100% liggen.';
      return;
    }
    if (
      effectType !== 'cosmetic' &&
      (!Number.isSafeInteger(effectDurationMinutes) || effectDurationMinutes < 1 || effectDurationMinutes > 1440)
    ) {
      secretOwnerStatus.textContent = 'De effectduur moet tussen 1 minuut en 24 uur liggen.';
      return;
    }

    const submitButton = secretItemForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    secretOwnerStatus.textContent = 'Secret item aanmaken…';
    void (async () => {
      const session = await restoreSupabaseSession();
      if (!session || !isLeaderboardOwner) throw new Error('Je account heeft geen ownerrechten.');
      await supabaseRequest(`${supabaseUrl}/rest/v1/secret_shop_items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseConfig.publishableKey,
          Authorization: `Bearer ${session.accessToken}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          name,
          description,
          emoji,
          price,
          effect_type: effectType,
          effect_percent: effectType === 'cosmetic' ? null : effectPercent,
          effect_duration_minutes: effectType === 'cosmetic' ? null : effectDurationMinutes,
          created_by: session.userId,
        }),
      });
      secretItemForm.reset();
      secretEffectFields.hidden = secretItemEffect.value === 'cosmetic';
      await loadStoreData();
      secretOwnerStatus.textContent = 'Secret item aangemaakt.';
    })().catch((error) => {
      secretOwnerStatus.textContent = `Secret item aanmaken mislukt: ${error.message}`;
    }).finally(() => {
      submitButton.disabled = false;
    });
  });

  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage(() => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('PuntKlik instellingen konden niet worden geopend:', error);
        message.textContent = 'Instellingen konden niet worden geopend.';
      }
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area && area !== 'local') return;
    let rerender = false;
    if (changes.coins) {
      coins = Number.isSafeInteger(changes.coins.newValue) ? changes.coins.newValue : 0;
      rerender = true;
    }
    if (changes.ownedDecorations) {
      ownedFigures = Array.isArray(changes.ownedDecorations.newValue)
        ? [...new Set(['classic', ...changes.ownedDecorations.newValue.filter((id) => figures.some((item) => item.id === id))])]
        : ['classic'];
      rerender = true;
    }
    if (changes.decoration) {
      figure = ownedFigures.includes(changes.decoration.newValue) ? changes.decoration.newValue : 'classic';
      rerender = true;
    }
    if (changes.ownedToppings) {
      ownedToppings = Array.isArray(changes.ownedToppings.newValue)
        ? [...new Set(changes.ownedToppings.newValue.filter((id) => toppings.some((item) => item.id === id)))]
        : [];
      equippedToppings = equippedToppings.filter((id) => ownedToppings.includes(id));
      rerender = true;
    }
    if (changes.equippedToppings) {
      equippedToppings = Array.isArray(changes.equippedToppings.newValue)
        ? [...new Set(changes.equippedToppings.newValue.filter((id) => ownedToppings.includes(id)))]
        : [];
      rerender = true;
    }
    if (changes.clicksToSpin) {
      const next = changes.clicksToSpin.newValue;
      clicksToSpin = Number.isSafeInteger(next) && next >= 1 && next <= 50 ? next : 12;
      rerender = true;
    }
    if (changes.activeStoreEvents) {
      activeStoreEvents = Array.isArray(changes.activeStoreEvents.newValue)
        ? changes.activeStoreEvents.newValue
        : [];
      rerender = true;
    }
    if (changes.leaderboardNickname) {
      leaderboardNickname =
        typeof changes.leaderboardNickname.newValue === 'string'
          ? changes.leaderboardNickname.newValue.trim().slice(0, 20)
          : '';
      nicknameInput.value = leaderboardNickname;
    }
    if (changes.supabaseSyncError && changes.supabaseSyncError.newValue) {
      leaderboardStatus.textContent = `Coin opslaan mislukt: ${changes.supabaseSyncError.newValue}`;
    }
    if (rerender) render();
    if (changes.coins && supabaseSession) {
      syncLeaderboardScore().catch((error) => {
        leaderboardStatus.textContent = `Score uploaden mislukt: ${error.message}`;
      });
    }
  });

  if (!supabaseConfigured) {
    leaderboardLogin.disabled = true;
    leaderboardStatus.textContent = 'Stel Supabase in volgens de stappen in README.md.';
  }
  if (ownerEventCountdownTimer) clearInterval(ownerEventCountdownTimer);
  ownerEventCountdownTimer = setInterval(renderOwnerEventCountdown, 1000);
})();
