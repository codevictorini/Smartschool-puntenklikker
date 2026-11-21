(() => {
  'use strict';

  const siteAuth = window.PuntKlikSiteAuth;
  const pages = [
    { file: 'index.html', title: 'Home' },
    { file: 'download.html', title: 'Download' },
    { file: 'roadmap.html', title: 'Roadmap' },
    { file: 'about.html', title: 'About us' },
    { file: 'privacy.html', title: 'Privacy' },
    { file: 'contact.html', title: 'Contact' },
    { file: 'owner.html', title: 'Ownerpanel' },
  ];
  const eventLabels = {
    double_coins: 'Dubbele coins',
    coin_gift: 'Coinbonus per speler',
    coin_shower: 'Muntjesregen',
    flash_sale: 'Flash sale',
    lucky_drop: 'Lucky drop',
    points_challenge: 'Puntenchallenge',
    theme: 'Thema-event',
  };
  const contentForm = document.getElementById('content-form');
  const contentFields = document.getElementById('content-fields');
  const contentStatus = document.getElementById('content-status');
  const contentSave = document.getElementById('content-save');
  const catalogForm = document.getElementById('catalog-form');
  const catalogList = document.getElementById('catalog-list');
  const catalogStatus = document.getElementById('catalog-status');
  const playersList = document.getElementById('players-list');
  const playersStatus = document.getElementById('players-status');
  const playersPrevious = document.getElementById('players-previous');
  const playersNext = document.getElementById('players-next');
  const ownerTools = document.getElementById('owner-tools');
  const ownerLogin = document.getElementById('owner-login');
  const ownerLogout = document.getElementById('owner-logout');
  const ownerAccessHint = document.getElementById('owner-access-hint');
  const ownerAuthStatus = document.getElementById('owner-auth-status');
  const secretItemsList = document.getElementById('secret-items-list');
  const secretItemForm = document.getElementById('secret-item-form');
  const secretItemId = document.getElementById('secret-item-id');
  const secretItemName = document.getElementById('secret-item-name');
  const secretItemDescription = document.getElementById('secret-item-description');
  const secretItemEmoji = document.getElementById('secret-item-emoji');
  const secretItemPrice = document.getElementById('secret-item-price');
  const secretItemEffect = document.getElementById('secret-item-effect');
  const secretEffectFields = document.getElementById('secret-effect-fields');
  const secretEffectPercent = document.getElementById('secret-effect-percent');
  const secretEffectDuration = document.getElementById('secret-effect-duration');
  const secretItemSave = document.getElementById('secret-item-save');
  const secretItemCancel = document.getElementById('secret-item-cancel');
  const eventTypeInput = document.getElementById('event-type');
  const eventStatus = document.getElementById('event-status');
  const eventsList = document.getElementById('events-list');
  const ownerFruitControls = document.getElementById('owner-fruit-controls');

  let session = null;
  let isOwner = false;
  let contentEntries = [];
  let catalogEntries = [];
  let secretItems = [];
  let activeEvents = [];
  let playerOffset = 0;
  const playerPageSize = 50;

  function setStatus(element, message, isError) {
    element.textContent = message;
    element.classList.toggle('roadmap-error', Boolean(isError));
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  async function requireOwner() {
    if (session && isOwner && Number(session.expiresAt) > Date.now() + 60000) return session;
    const currentSession = await siteAuth.initialize();
    if (!currentSession || !await siteAuth.isOwner(currentSession)) {
      session = null;
      isOwner = false;
      updateAccess();
      throw new Error('Je account heeft geen ownerrechten.');
    }
    session = currentSession;
    isOwner = true;
    return currentSession;
  }

  function updateAccess() {
    ownerTools.hidden = !isOwner;
    ownerLogin.hidden = Boolean(session);
    ownerLogout.hidden = !session;
    if (session && !isOwner) {
      ownerAccessHint.textContent = 'Je bent ingelogd, maar dit account heeft geen ownerrechten.';
    } else if (!session) {
      ownerAccessHint.textContent = 'Log in met het geverifieerde owneraccount om de beheerfuncties te openen.';
    } else {
      ownerAccessHint.textContent = 'Ownerrechten bevestigd. Je kunt de website en winkel beheren.';
    }
  }

  async function loadContentDefinitions() {
    const entries = new Map();
    for (const page of pages) {
      const response = await fetch(page.file, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${page.title} kon niet worden gelezen (${response.status}).`);
      const source = await response.text();
      const pageDocument = new DOMParser().parseFromString(source, 'text/html');
      pageDocument.querySelectorAll('[data-site-content], [data-site-link]').forEach((element) => {
        const textKey = element.dataset.siteContent;
        const linkKey = element.dataset.siteLink;
        if (textKey) {
          addContentEntry(entries, {
            key: textKey,
            label: element.dataset.siteLabel || `${page.title}: ${textKey}`,
            page: page.title,
            type: 'text',
            defaultValue: element.textContent,
          });
        }
        if (linkKey) {
          addContentEntry(entries, {
            key: linkKey,
            label: element.dataset.siteLabel || `${page.title}: ${linkKey}`,
            page: page.title,
            type: 'url',
            defaultValue: element.getAttribute('href') || '',
          });
        }
      });
    }
    contentEntries = [...entries.values()].sort((left, right) =>
      left.page.localeCompare(right.page, 'nl') ||
      left.label.localeCompare(right.label, 'nl') ||
      left.key.localeCompare(right.key, 'nl')
    );
    const rows = await siteAuth.request('/rest/v1/site_content?select=content_key,content_value', { session });
    if (!Array.isArray(rows)) throw new Error('Supabase gaf geen geldige website-inhoud terug.');
    const overrides = new Map(rows.map((row) => [row.content_key, row.content_value]));
    contentEntries.forEach((entry) => {
      entry.value = overrides.has(entry.key) ? overrides.get(entry.key) : entry.defaultValue;
    });
    renderContentFields();
    setStatus(contentStatus, `${contentEntries.length} tekst- en linkvelden geladen.`, false);
  }

  function addContentEntry(entries, entry) {
    if (!/^[a-z0-9._-]{1,100}$/.test(entry.key)) {
      throw new Error(`Ongeldige website-inhoudsleutel: ${entry.key}`);
    }
    const existing = entries.get(entry.key);
    if (existing) {
      if (existing.type !== entry.type || existing.defaultValue !== entry.defaultValue) {
        throw new Error(`De standaardwaarde van "${entry.key}" verschilt tussen pagina’s.`);
      }
      return;
    }
    entries.set(entry.key, entry);
  }

  function renderContentFields() {
    contentFields.replaceChildren();
    let activePage = '';
    let pageList = null;
    contentEntries.forEach((entry, index) => {
      if (entry.page !== activePage) {
        activePage = entry.page;
        const section = createElement('section', 'site-admin-page');
        section.appendChild(createElement('h3', '', activePage));
        pageList = createElement('div', 'site-admin-page-fields');
        section.appendChild(pageList);
        contentFields.appendChild(section);
      }

      const wrapper = createElement('label', 'site-admin-content-field');
      wrapper.appendChild(createElement('span', '', entry.label));
      const input = entry.type === 'text' && entry.value.length <= 120
        ? document.createElement('input')
        : document.createElement('textarea');
      input.dataset.contentIndex = String(index);
      input.value = entry.value;
      input.maxLength = 2000;
      if (entry.type === 'url') {
        input.autocapitalize = 'off';
        input.placeholder = 'https://… of relatief pad';
      }
      wrapper.appendChild(input);
      pageList.appendChild(wrapper);
    });
  }

  async function saveContent(event) {
    event.preventDefault();
    let inputs;
    try {
      await requireOwner();
      inputs = [...contentFields.querySelectorAll('[data-content-index]')];
      inputs.forEach((input) => {
        const entry = contentEntries[Number(input.dataset.contentIndex)];
        const value = input.value.trim();
        if (value.length > 2000) throw new Error(`"${entry.label}" is te lang.`);
        if (entry.type === 'url' && !window.PuntKlikSiteContent.isSafeLink(value)) {
          throw new Error(`"${entry.label}" moet een veilige HTTPS-link of een geldig relatief pad zijn.`);
        }
        entry.value = value;
      });
      contentSave.disabled = true;
      setStatus(contentStatus, 'Website-inhoud opslaan…', false);
      const payload = contentEntries.map((entry) => ({
        content_key: entry.key,
        content_value: entry.value,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      }));
      await siteAuth.request('/rest/v1/site_content?on_conflict=content_key', {
        method: 'POST',
        session,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: payload,
      });
      setStatus(contentStatus, 'Website-inhoud opgeslagen. Herlaad de publieke pagina’s om de wijzigingen te zien.', false);
    } catch (error) {
      console.error('Website-inhoud kon niet worden opgeslagen.', error);
      setStatus(contentStatus, `Opslaan mislukt: ${error.message}`, true);
    } finally {
      contentSave.disabled = false;
    }
  }

  function resetContent() {
    contentEntries.forEach((entry) => {
      entry.value = entry.defaultValue;
    });
    renderContentFields();
    setStatus(contentStatus, 'Standaardwaarden klaargezet. Sla op om ze op de website toe te passen.', false);
  }

  async function loadCatalog() {
    const rows = await siteAuth.request(
      '/rest/v1/store_catalog?select=item_key,name,note,price,is_active',
      { session }
    );
    if (!Array.isArray(rows)) throw new Error('Supabase gaf geen geldige winkelcatalogus terug.');
    const overrides = new Map(rows.map((row) => [row.item_key, row]));
    catalogEntries = window.PuntKlikStoreCatalog.map((item) => {
      const override = overrides.get(item.key);
      const entry = {
        ...item,
        isActive: true,
        price: item.price,
      };
      if (override) {
        const price = Number(override.price);
        if (
          typeof override.name !== 'string' ||
          typeof override.note !== 'string' ||
          !Number.isSafeInteger(price) ||
          price < 0 ||
          price > 1000000000 ||
          typeof override.is_active !== 'boolean'
        ) {
          throw new Error(`Winkelitem "${item.key}" bevat ongeldige gegevens.`);
        }
        entry.name = override.name;
        entry.note = override.note;
        entry.price = price;
        entry.isActive = override.is_active;
      }
      return entry;
    });
    renderCatalog();
    renderFlashSaleOptions();
    setStatus(catalogStatus, 'Winkelcatalogus geladen.', false);
  }

  function renderCatalog() {
    catalogList.replaceChildren();
    catalogEntries.forEach((item, index) => {
      const row = createElement('li', 'site-admin-item');
      row.appendChild(createElement('h3', '', `${item.type === 'figure' ? 'Figuur' : 'Topping'} · ${item.name}`));
      const grid = createElement('div', 'site-admin-field-grid');
      const nameLabel = createElement('label', '', 'Naam');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.maxLength = 60;
      nameInput.required = true;
      nameInput.value = item.name;
      nameInput.dataset.catalogIndex = String(index);
      nameInput.dataset.catalogField = 'name';
      nameLabel.appendChild(nameInput);
      const noteLabel = createElement('label', '', 'Beschrijving');
      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.maxLength = 120;
      noteInput.value = item.note;
      noteInput.dataset.catalogIndex = String(index);
      noteInput.dataset.catalogField = 'note';
      noteLabel.appendChild(noteInput);
      const priceLabel = createElement('label', '', 'Prijs (coins)');
      const priceInput = document.createElement('input');
      priceInput.type = 'number';
      priceInput.min = '0';
      priceInput.max = '1000000000';
      priceInput.step = '1';
      priceInput.required = true;
      priceInput.value = String(item.price);
      priceInput.dataset.catalogIndex = String(index);
      priceInput.dataset.catalogField = 'price';
      priceLabel.appendChild(priceInput);
      grid.append(nameLabel, noteLabel, priceLabel);
      const activeLabel = createElement('label', 'site-admin-check', 'Beschikbaar in de winkel');
      const activeInput = document.createElement('input');
      activeInput.type = 'checkbox';
      activeInput.checked = item.isActive;
      activeInput.dataset.catalogIndex = String(index);
      activeInput.dataset.catalogField = 'isActive';
      if (item.key === 'figure:classic') {
        activeInput.disabled = true;
        activeInput.checked = true;
      }
      activeLabel.prepend(activeInput);
      row.append(grid, activeLabel);
      catalogList.appendChild(row);
    });
  }

  function renderFlashSaleOptions() {
    const select = document.getElementById('event-item-key');
    select.replaceChildren();
    catalogEntries.filter((item) => item.key !== 'figure:classic').forEach((item) => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.name;
      select.appendChild(option);
    });
  }

  async function saveCatalog(event) {
    event.preventDefault();
    const saveButton = document.getElementById('catalog-save');
    try {
      await requireOwner();
      const inputs = [...catalogList.querySelectorAll('[data-catalog-index]')];
      const changed = catalogEntries.map((item) => ({ ...item }));
      inputs.forEach((input) => {
        const index = Number(input.dataset.catalogIndex);
        const field = input.dataset.catalogField;
        if (field === 'isActive') {
          changed[index].isActive = input.checked;
        } else if (field === 'price') {
          const value = Number(input.value);
          if (!Number.isSafeInteger(value) || value < 0 || value > 1000000000) {
            throw new Error(`De prijs van "${changed[index].name}" moet een heel getal van 0 tot 1.000.000.000 zijn.`);
          }
          changed[index].price = value;
        } else {
          const value = input.value.trim();
          const limit = field === 'name' ? 60 : 120;
          if ((field === 'name' && !value) || value.length > limit) {
            throw new Error(`Controleer de ${field === 'name' ? 'naam' : 'beschrijving'} van "${changed[index].name}".`);
          }
          changed[index][field] = value;
        }
      });
      if (!changed.find((item) => item.key === 'figure:classic').isActive) {
        throw new Error('De startfiguur moet beschikbaar blijven.');
      }
      saveButton.disabled = true;
      setStatus(catalogStatus, 'Winkelcatalogus opslaan…', false);
      const payload = changed.map((item) => ({
        item_key: item.key,
        name: item.name,
        note: item.note,
        price: item.price,
        is_active: item.isActive,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      }));
      await siteAuth.request('/rest/v1/store_catalog?on_conflict=item_key', {
        method: 'POST',
        session,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: payload,
      });
      await loadCatalog();
      setStatus(catalogStatus, 'Winkelcatalogus opgeslagen en gepubliceerd.', false);
    } catch (error) {
      console.error('Winkelcatalogus kon niet worden opgeslagen.', error);
      setStatus(catalogStatus, `Opslaan mislukt: ${error.message}`, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function loadPlayers() {
    const currentSession = await requireOwner();
    setStatus(playersStatus, 'Spelers laden…', false);
    const rows = await siteAuth.request(
      `/rest/v1/leaderboard?select=user_id,nickname,coins&order=user_id.asc&limit=${playerPageSize}&offset=${playerOffset}`,
      { session: currentSession }
    );
    if (!Array.isArray(rows)) throw new Error('Supabase gaf geen geldige spelerslijst terug.');
    renderPlayers(rows);
    playersPrevious.disabled = playerOffset === 0;
    playersNext.disabled = rows.length < playerPageSize;
    setStatus(playersStatus, `${rows.length} speler(s) · pagina ${Math.floor(playerOffset / playerPageSize) + 1}.`, false);
  }

  function renderPlayers(rows) {
    playersList.replaceChildren();
    if (!rows.length) {
      playersList.appendChild(createElement('li', 'site-admin-empty', 'Geen spelers op deze pagina.'));
      return;
    }
    rows.forEach((player) => {
      const row = createElement('li', 'site-admin-item');
      const id = createElement('small', 'site-admin-subtle', `Account-ID: ${player.user_id}`);
      const grid = createElement('div', 'site-admin-field-grid');
      const nicknameLabel = createElement('label', '', 'Nickname (leeg = verborgen)');
      const nicknameInput = document.createElement('input');
      nicknameInput.type = 'text';
      nicknameInput.maxLength = 20;
      nicknameInput.value = typeof player.nickname === 'string' ? player.nickname : '';
      nicknameLabel.appendChild(nicknameInput);
      const coinsLabel = createElement('label', '', 'Coins');
      const coinsInput = document.createElement('input');
      coinsInput.type = 'number';
      coinsInput.min = '0';
      coinsInput.max = '1000000000';
      coinsInput.step = '1';
      coinsInput.value = String(player.coins);
      coinsLabel.appendChild(coinsInput);
      grid.append(nicknameLabel, coinsLabel);
      const button = createElement('button', 'community-button secondary', 'Speler opslaan');
      button.type = 'button';
      button.addEventListener('click', () => {
        void savePlayer(player, nicknameInput, coinsInput, button);
      });
      row.append(id, grid, button);
      playersList.appendChild(row);
    });
  }

  async function savePlayer(player, nicknameInput, coinsInput, button) {
    const nickname = nicknameInput.value.trim();
    const coins = Number(coinsInput.value);
    if (
      nickname &&
      (nickname.length < 3 || nickname.length > 20 || /[\u0000-\u001f\u007f]/.test(nickname))
    ) {
      setStatus(playersStatus, 'Een nickname moet leeg zijn of 3 tot 20 tekens bevatten.', true);
      nicknameInput.focus();
      return;
    }
    if (!Number.isSafeInteger(coins) || coins < 0 || coins > 1000000000) {
      setStatus(playersStatus, 'De coinstand moet een heel getal van 0 tot 1.000.000.000 zijn.', true);
      coinsInput.focus();
      return;
    }
    button.disabled = true;
    setStatus(playersStatus, 'Speler opslaan…', false);
    try {
      const currentSession = await requireOwner();
      await siteAuth.request(`/rest/v1/leaderboard?user_id=eq.${encodeURIComponent(player.user_id)}`, {
        method: 'PATCH',
        session: currentSession,
        headers: { Prefer: 'return=minimal' },
        body: { nickname: nickname || null, coins, updated_at: new Date().toISOString() },
      });
      await loadPlayers();
      setStatus(playersStatus, 'Speler bijgewerkt.', false);
    } catch (error) {
      console.error('Leaderboardspeler kon niet worden bijgewerkt.', error);
      setStatus(playersStatus, `Opslaan mislukt: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  async function rpc(name, body) {
    const currentSession = await requireOwner();
    return siteAuth.request(`/rest/v1/rpc/${name}`, {
      method: 'POST',
      session: currentSession,
      body,
    });
  }

  async function loadStoreAdminState() {
    const currentSession = await requireOwner();
    const [promotions, settings, items, events, countdown] = await Promise.all([
      siteAuth.request('/rest/v1/store_promotions?select=discount_percent,max_discount_coins,starts_at,ends_at&id=eq.true&limit=1', { session: currentSession }),
      siteAuth.request('/rest/v1/secret_shop_settings?select=is_open,updated_at&id=eq.true&limit=1', { session: currentSession }),
      siteAuth.request('/rest/v1/secret_shop_items?select=id,name,description,emoji,price,effect_type,effect_percent,effect_duration_minutes,is_active,created_at&order=created_at.desc', { session: currentSession }),
      siteAuth.request(`/rest/v1/store_events?select=id,event_type,event_config,starts_at,ends_at,created_at&starts_at=lte.${encodeURIComponent(new Date().toISOString())}&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc`, { session: currentSession }),
      siteAuth.request('/rest/v1/owner_event_countdown?select=event_name,event_at&id=eq.true&limit=1', { session: currentSession }),
    ]);
    if (![promotions, settings, items, events, countdown].every(Array.isArray)) {
      throw new Error('Supabase gaf ongeldige winkelbeheerinstellingen terug.');
    }
    const promotion = promotions[0];
    if (promotion) {
      document.getElementById('promo-percent').value = String(promotion.discount_percent);
      document.getElementById('promo-cap').value = String(promotion.max_discount_coins);
    }
    const secretState = settings[0];
    const secretShopToggle = document.getElementById('secret-shop-toggle');
    secretShopToggle.textContent = secretState && secretState.is_open
      ? 'Secret shop sluiten'
      : 'Secret shop openen';
    secretShopToggle.dataset.open = String(Boolean(secretState && secretState.is_open));
    secretItems = items;
    activeEvents = events;
    const countdownState = countdown[0];
    if (countdownState && countdownState.event_name && countdownState.event_at) {
      document.getElementById('countdown-name').value = countdownState.event_name;
      document.getElementById('countdown-at').value = toLocalDateTime(countdownState.event_at);
    }
    renderSecretItems();
    renderEvents();
  }

  function toLocalDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function renderSecretItems() {
    secretItemsList.replaceChildren();
    if (!secretItems.length) {
      secretItemsList.appendChild(createElement('li', 'site-admin-empty', 'Nog geen secret-shopitems.'));
      return;
    }
    secretItems.forEach((item) => {
      const row = createElement('li', 'site-admin-item');
      row.appendChild(createElement('h3', '', `${item.emoji} ${item.name}`));
      row.appendChild(createElement(
        'p',
        'site-admin-subtle',
        `${item.price} coins · ${item.description} · ${item.effect_type}${item.effect_percent ? ` +${item.effect_percent}%` : ''} · ${item.is_active ? 'actief' : 'verborgen'}`
      ));
      const actions = createElement('div', 'community-actions');
      const edit = createElement('button', 'community-button secondary', 'Bewerken');
      edit.type = 'button';
      edit.addEventListener('click', () => editSecretItem(item));
      const toggle = createElement('button', 'community-button secondary', item.is_active ? 'Verbergen' : 'Activeren');
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        void setSecretItemActive(item, !item.is_active, toggle);
      });
      actions.append(edit, toggle);
      row.appendChild(actions);
      secretItemsList.appendChild(row);
    });
  }

  function editSecretItem(item) {
    secretItemId.value = item.id;
    secretItemName.value = item.name;
    secretItemDescription.value = item.description;
    secretItemEmoji.value = item.emoji;
    secretItemPrice.value = String(item.price);
    secretItemEffect.value = item.effect_type;
    secretEffectPercent.value = String(item.effect_percent || 10);
    secretEffectDuration.value = String(item.effect_duration_minutes || 30);
    secretEffectFields.hidden = item.effect_type === 'cosmetic';
    secretItemSave.textContent = 'Wijzigingen opslaan';
    secretItemCancel.hidden = false;
    setStatus(document.getElementById('secret-item-status'), `Je bewerkt ${item.name}.`, false);
    secretItemForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetSecretItemForm() {
    secretItemForm.reset();
    secretItemId.value = '';
    secretItemEffect.value = 'cosmetic';
    secretEffectFields.hidden = true;
    secretItemSave.textContent = 'Secret item aanmaken';
    secretItemCancel.hidden = true;
  }

  async function setSecretItemActive(item, isActive, button) {
    button.disabled = true;
    try {
      const currentSession = await requireOwner();
      await siteAuth.request(`/rest/v1/secret_shop_items?id=eq.${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        session: currentSession,
        headers: { Prefer: 'return=minimal' },
        body: { is_active: isActive },
      });
      setStatus(document.getElementById('secret-item-status'), `Secret item ${isActive ? 'geactiveerd' : 'verborgen'}.`, false);
      await loadStoreAdminState();
    } catch (error) {
      console.error('Secret item kon niet worden gewijzigd.', error);
      setStatus(document.getElementById('secret-item-status'), `Wijzigen mislukt: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  async function saveSecretItem(event) {
    event.preventDefault();
    const name = secretItemName.value.trim();
    const description = secretItemDescription.value.trim();
    const emoji = secretItemEmoji.value.trim();
    const price = Number(secretItemPrice.value);
    const effectType = secretItemEffect.value;
    const effectPercent = Number(secretEffectPercent.value);
    const effectDuration = Number(secretEffectDuration.value);
    if (name.length < 2 || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name)) {
      setStatus(document.getElementById('secret-item-status'), 'De naam moet 2 tot 40 tekens bevatten.', true);
      return;
    }
    if (description.length < 2 || description.length > 120 || /[\u0000-\u001f\u007f]/.test(description)) {
      setStatus(document.getElementById('secret-item-status'), 'De beschrijving moet 2 tot 120 tekens bevatten.', true);
      return;
    }
    if (!emoji || emoji.length > 8 || /[\u0000-\u001f\u007f]/.test(emoji)) {
      setStatus(document.getElementById('secret-item-status'), 'Kies een emoji/badge van maximaal 8 tekens.', true);
      return;
    }
    if (!Number.isSafeInteger(price) || price < 1 || price > 1000000000) {
      setStatus(document.getElementById('secret-item-status'), 'De prijs moet tussen 1 en 1.000.000.000 coins liggen.', true);
      return;
    }
    if (!['cosmetic', 'coin_bonus', 'shop_discount'].includes(effectType)) {
      setStatus(document.getElementById('secret-item-status'), 'Kies een geldig effect.', true);
      return;
    }
    if (
      effectType !== 'cosmetic' &&
      (!Number.isSafeInteger(effectPercent) || effectPercent < 1 || effectPercent > 100)
    ) {
      setStatus(document.getElementById('secret-item-status'), 'Het effect moet tussen 1 en 100% liggen.', true);
      return;
    }
    if (
      effectType !== 'cosmetic' &&
      (!Number.isSafeInteger(effectDuration) || effectDuration < 1 || effectDuration > 1440)
    ) {
      setStatus(document.getElementById('secret-item-status'), 'De effectduur moet tussen 1 en 1440 minuten liggen.', true);
      return;
    }

    secretItemSave.disabled = true;
    setStatus(document.getElementById('secret-item-status'), 'Secret item opslaan…', false);
    try {
      const currentSession = await requireOwner();
      const body = {
        name,
        description,
        emoji,
        price,
        effect_type: effectType,
        effect_percent: effectType === 'cosmetic' ? null : effectPercent,
        effect_duration_minutes: effectType === 'cosmetic' ? null : effectDuration,
      };
      if (secretItemId.value) {
        await siteAuth.request(`/rest/v1/secret_shop_items?id=eq.${encodeURIComponent(secretItemId.value)}`, {
          method: 'PATCH',
          session: currentSession,
          headers: { Prefer: 'return=minimal' },
          body,
        });
      } else {
        body.created_by = currentSession.userId;
        await siteAuth.request('/rest/v1/secret_shop_items', {
          method: 'POST',
          session: currentSession,
          headers: { Prefer: 'return=minimal' },
          body,
        });
      }
      resetSecretItemForm();
      await loadStoreAdminState();
      setStatus(document.getElementById('secret-item-status'), 'Secret item opgeslagen.', false);
    } catch (error) {
      console.error('Secret item kon niet worden opgeslagen.', error);
      setStatus(document.getElementById('secret-item-status'), `Opslaan mislukt: ${error.message}`, true);
    } finally {
      secretItemSave.disabled = false;
    }
  }

  function renderEvents() {
    eventsList.replaceChildren();
    ownerFruitControls.replaceChildren();
    if (!activeEvents.length) {
      eventsList.appendChild(createElement('li', 'site-admin-empty', 'Geen actieve events.'));
      return;
    }
    activeEvents.forEach((storeEvent) => {
      const row = createElement('li', 'site-admin-item');
      const config = storeEvent.event_config || {};
      const label = eventLabels[storeEvent.event_type] || 'Winkel-event';
      row.appendChild(createElement('h3', '', label));
      row.appendChild(createElement(
        'p',
        'site-admin-subtle',
        `Actief tot ${new Date(storeEvent.ends_at).toLocaleString('nl-BE')}${storeEvent.event_type === 'flash_sale' ? ` · ${config.item_key || ''}` : ''}`
      ));
      const stop = createElement('button', 'community-button secondary', 'Event stoppen');
      stop.type = 'button';
      stop.addEventListener('click', () => {
        void stopStoreEvent(storeEvent, stop);
      });
      row.appendChild(stop);
      eventsList.appendChild(row);

      const fruitButton = createElement(
        'button',
        'community-button secondary',
        config.owner_fruit_granted ? 'Ownerfruit gegeven' : `Geef ownerfruit · ${label}`
      );
      fruitButton.type = 'button';
      fruitButton.disabled = Boolean(config.owner_fruit_granted);
      fruitButton.addEventListener('click', () => {
        void grantOwnerFruit(storeEvent, fruitButton);
      });
      ownerFruitControls.appendChild(fruitButton);
    });
  }

  async function stopStoreEvent(storeEvent, button) {
    if (!window.confirm(`Stop het event "${eventLabels[storeEvent.event_type] || storeEvent.event_type}"?`)) return;
    button.disabled = true;
    setStatus(eventStatus, 'Event stoppen…', false);
    try {
      await rpc('stop_store_event', { p_event_id: storeEvent.id });
      await loadStoreAdminState();
      setStatus(eventStatus, 'Event gestopt.', false);
    } catch (error) {
      console.error('Event kon niet worden gestopt.', error);
      setStatus(eventStatus, `Stoppen mislukt: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  async function grantOwnerFruit(storeEvent, button) {
    button.disabled = true;
    try {
      await rpc('grant_store_event_fruit', { p_event_id: storeEvent.id });
      await loadStoreAdminState();
      setStatus(eventStatus, 'Ownerfruit uitgedeeld.', false);
    } catch (error) {
      console.error('Ownerfruit kon niet worden uitgedeeld.', error);
      setStatus(eventStatus, `Ownerfruit uitdelen mislukt: ${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  function readNumber(id, label, min, max) {
    const value = Number(document.getElementById(id).value);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${label} moet tussen ${min} en ${max} liggen.`);
    }
    return value;
  }

  document.getElementById('owner-login').addEventListener('click', async () => {
    ownerLogin.disabled = true;
    setStatus(ownerAuthStatus, 'Google-login openen…', false);
    try {
      await siteAuth.login();
    } catch (error) {
      console.error('Google-login kon niet worden gestart.', error);
      setStatus(ownerAuthStatus, `Inloggen mislukt: ${error.message}`, true);
      ownerLogin.disabled = false;
    }
  });

  ownerLogout.addEventListener('click', async () => {
    if (!session) return;
    ownerLogout.disabled = true;
    try {
      await siteAuth.logout(session);
      session = null;
      isOwner = false;
      updateAccess();
      setStatus(ownerAuthStatus, 'Je bent uitgelogd.', false);
    } catch (error) {
      console.error('Uitloggen is mislukt.', error);
      setStatus(ownerAuthStatus, `Uitloggen mislukt: ${error.message}`, true);
    } finally {
      ownerLogout.disabled = false;
    }
  });

  contentForm.addEventListener('submit', (event) => {
    void saveContent(event);
  });
  document.getElementById('content-reset').addEventListener('click', resetContent);
  catalogForm.addEventListener('submit', (event) => {
    void saveCatalog(event);
  });
  playersPrevious.addEventListener('click', () => {
    playerOffset = Math.max(0, playerOffset - playerPageSize);
    void loadPlayers().catch((error) => {
      setStatus(playersStatus, `Spelers laden mislukt: ${error.message}`, true);
    });
  });
  playersNext.addEventListener('click', () => {
    playerOffset += playerPageSize;
    void loadPlayers().catch((error) => {
      setStatus(playersStatus, `Spelers laden mislukt: ${error.message}`, true);
    });
  });

  document.getElementById('countdown-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('countdown-name').value.trim();
    const localDate = document.getElementById('countdown-at').value;
    const eventAt = new Date(localDate);
    const status = document.getElementById('countdown-status');
    if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
      setStatus(status, 'De eventnaam moet 1 tot 60 tekens bevatten.', true);
      return;
    }
    if (!localDate || !Number.isFinite(eventAt.getTime()) || eventAt.getTime() <= Date.now()) {
      setStatus(status, 'Kies een geldige starttijd in de toekomst.', true);
      return;
    }
    void rpc('set_owner_event_countdown', { p_event_name: name, p_event_at: eventAt.toISOString() })
      .then(() => setStatus(status, `Afteller ingesteld voor ${name}.`, false))
      .catch((error) => setStatus(status, `Instellen mislukt: ${error.message}`, true));
  });
  document.getElementById('countdown-clear').addEventListener('click', () => {
    const status = document.getElementById('countdown-status');
    void rpc('set_owner_event_countdown', { p_event_name: null, p_event_at: null })
      .then(() => {
        document.getElementById('countdown-form').reset();
        setStatus(status, 'Owner-eventafteller gewist.', false);
      })
      .catch((error) => setStatus(status, `Wissen mislukt: ${error.message}`, true));
  });

  document.getElementById('promo-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const status = document.getElementById('promo-status');
    try {
      const discount = readNumber('promo-percent', 'Korting', 1, 100);
      const cap = readNumber('promo-cap', 'Maximale korting', 0, 5);
      const duration = readNumber('promo-duration', 'Duur', 1, 1440);
      void (async () => {
        const currentSession = await requireOwner();
        const startsAt = new Date();
        const endsAt = new Date(startsAt.getTime() + duration * 60000);
        await siteAuth.request('/rest/v1/store_promotions?on_conflict=id', {
          method: 'POST',
          session: currentSession,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: {
            id: true,
            discount_percent: discount,
            max_discount_coins: cap,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            created_by: currentSession.userId,
          },
        });
        setStatus(status, `Promo gestart: ${discount}% korting, max. ${cap} coins per item, ${duration} minuten.`, false);
      })().catch((error) => setStatus(status, `Promo starten mislukt: ${error.message}`, true));
    } catch (error) {
      setStatus(status, error.message, true);
    }
  });
  document.getElementById('promo-stop').addEventListener('click', () => {
    const status = document.getElementById('promo-status');
    void (async () => {
      const currentSession = await requireOwner();
      const now = new Date();
      const startsAt = new Date(now.getTime() - 1000);
      await siteAuth.request('/rest/v1/store_promotions?id=eq.true', {
        method: 'PATCH',
        session: currentSession,
        headers: { Prefer: 'return=minimal' },
        body: { starts_at: startsAt.toISOString(), ends_at: now.toISOString() },
      });
      setStatus(status, 'Promo gestopt.', false);
    })().catch((error) => setStatus(status, `Promo stoppen mislukt: ${error.message}`, true));
  });

  document.getElementById('secret-shop-toggle').addEventListener('click', () => {
    const button = document.getElementById('secret-shop-toggle');
    const status = document.getElementById('secret-shop-status');
    button.disabled = true;
    void (async () => {
      const currentSession = await requireOwner();
      const isOpen = button.dataset.open === 'true';
      await siteAuth.request('/rest/v1/secret_shop_settings?id=eq.true', {
        method: 'PATCH',
        session: currentSession,
        headers: { Prefer: 'return=minimal' },
        body: {
          is_open: !isOpen,
          updated_at: new Date().toISOString(),
          updated_by: currentSession.userId,
        },
      });
      await loadStoreAdminState();
      setStatus(status, !isOpen ? 'Secret shop geopend.' : 'Secret shop gesloten.', false);
    })().catch((error) => setStatus(status, `Secret shop wijzigen mislukt: ${error.message}`, true))
      .finally(() => {
        button.disabled = false;
      });
  });

  secretItemEffect.addEventListener('change', () => {
    secretEffectFields.hidden = secretItemEffect.value === 'cosmetic';
  });
  secretItemForm.addEventListener('submit', (event) => {
    void saveSecretItem(event);
  });
  secretItemCancel.addEventListener('click', () => {
    resetSecretItemForm();
    setStatus(document.getElementById('secret-item-status'), 'Bewerken geannuleerd.', false);
  });

  eventTypeInput.addEventListener('change', () => {
    document.querySelectorAll('.event-config-fields').forEach((field) => {
      field.hidden = field.dataset.eventType !== eventTypeInput.value;
    });
  });
  eventTypeInput.dispatchEvent(new Event('change'));
  document.getElementById('event-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const type = eventTypeInput.value;
    const status = eventStatus;
    try {
      const duration = readNumber('event-duration', 'Duur', 1, 1440);
      let config;
      switch (type) {
        case 'double_coins':
          config = {};
          break;
        case 'coin_gift':
          config = { coins: readNumber('event-coins', 'Coinbonus', 1, 1000000) };
          break;
        case 'coin_shower':
          config = { coins_per_bag: readNumber('event-coins-per-bag', 'Coins per muntzakje', 1, 1000000) };
          break;
        case 'flash_sale':
          config = {
            item_key: document.getElementById('event-item-key').value,
            discount_percent: readNumber('event-discount', 'Korting', 1, 100),
          };
          break;
        case 'lucky_drop':
          config = {
            chance_percent: readNumber('event-chance', 'Kans per punt', 1, 100),
            reward_coins: readNumber('event-reward', 'Beloning', 1, 1000000),
          };
          break;
        case 'points_challenge':
          config = {
            target_points: readNumber('event-target', 'Puntendoel', 1, 1000),
            reward_coins: readNumber('event-challenge-reward', 'Beloning', 1, 1000000),
          };
          break;
        case 'theme':
          config = { theme: document.getElementById('event-theme').value };
          break;
        default:
          throw new Error('Kies een geldige eventsoort.');
      }
      void rpc('start_store_event', {
        p_event_type: type,
        p_event_config: config,
        p_duration_minutes: duration,
      }).then(async (result) => {
        if (!result || typeof result.id !== 'string') throw new Error('Supabase gaf geen geldig event terug.');
        await loadStoreAdminState();
        setStatus(status, `${eventLabels[type]} gestart voor ${duration} minuten.`, false);
      }).catch((error) => setStatus(status, `Event starten mislukt: ${error.message}`, true));
    } catch (error) {
      setStatus(status, error.message, true);
    }
  });

  document.getElementById('announcement-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('announcement-name').value.trim();
    const message = document.getElementById('announcement-message').value.trim();
    const status = document.getElementById('announcement-status');
    if (!name || name.length > 30 || /[\u0000-\u001f\u007f]/.test(name)) {
      setStatus(status, 'De naam moet 1 tot 30 tekens bevatten.', true);
      return;
    }
    if (!message || message.length > 1000 || /[\u0000-\u001f\u007f]/.test(message)) {
      setStatus(status, 'Het bericht moet 1 tot 1.000 tekens bevatten.', true);
      return;
    }
    void rpc('send_global_announcement', {
      p_author_name: name,
      p_message: message,
    }).then(() => {
      document.getElementById('announcement-form').reset();
      setStatus(status, 'Announcement verzonden.', false);
    }).catch((error) => setStatus(status, `Verzenden mislukt: ${error.message}`, true));
  });

  async function loadOwnerData() {
    const initialLoads = [
      ['Website-inhoud', loadContentDefinitions(), contentStatus],
      ['Winkelcatalogus', loadCatalog(), catalogStatus],
      ['Leaderboardspelers', loadPlayers(), playersStatus],
      ['Winkelbeheer', loadStoreAdminState(), eventStatus],
    ];
    await Promise.all(initialLoads.map(async ([label, promise, status]) => {
      try {
        await promise;
      } catch (error) {
        console.error(`${label} kon niet worden geladen.`, error);
        setStatus(status, `${label} laden mislukt: ${error.message}`, true);
      }
    }));
  }

  async function initialize() {
    try {
      session = await siteAuth.initialize();
      isOwner = session ? await siteAuth.isOwner(session) : false;
      updateAccess();
      if (isOwner) {
        setStatus(ownerAuthStatus, 'Ownerrechten bevestigd.', false);
        await loadOwnerData();
      } else if (session) {
        setStatus(ownerAuthStatus, 'Dit Google-account heeft geen ownerrechten.', true);
      }
    } catch (error) {
      console.error('Ownerpanel kon niet worden geladen.', error);
      session = null;
      isOwner = false;
      updateAccess();
      setStatus(ownerAuthStatus, `Inloggen mislukt: ${error.message}`, true);
    }
  }

  void initialize();
})();
