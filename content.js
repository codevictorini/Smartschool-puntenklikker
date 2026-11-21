(() => {
  'use strict';

  const PATH_HINT = /result|skore|punten/i;
  const isActivePage = () => PATH_HINT.test(location.pathname + location.search + location.hash);
  const UI_SELECTOR = '.pc-overlay, .pc-toast, .pc-coin-bag, .pc-tour-overlay';
  const SCORE_RE = /^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/;
  const PERCENT_RE = /^(\d+(?:[.,]\d+)?)\s*%$/;
  const SCORES_RE = /(?<![\d.,])\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?(?!\d|[.,]\d)/g;
  const PERCENTS_RE = /(?<![\d.,])\d+(?:[.,]\d+)?\s*%/g;
  const GROUP_TEXT_RE = /^[\d\s.,/%]+$/;
  const SCORE_SELECTOR = 'span, div, td, b, strong, p, a, li, small, em, text, tspan';
  const DATE_RE = /(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+\d{1,2}\s+[a-zç]+\s+\d{4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/i;
  const RARITIES = [
    { min: 100, name: 'Mythic', range: '100%', coins: 20, color: '#d99f19' },
    { min: 95, name: 'Legendary', range: '95–99%', coins: 12, color: '#bd6039' },
    { min: 85, name: 'Epic', range: '85–94%', coins: 8, color: '#8751a7' },
    { min: 70, name: 'Rare', range: '70–84%', coins: 5, color: '#347cad' },
    { min: 50, name: 'Uncommon', range: '50–69%', coins: 3, color: '#408252' },
    { min: 0, name: 'Common', range: '0–49%', coins: 1, color: '#81796f' },
  ];
  const FIGURES = window.PuntKlikFigures;
  const TOPPINGS = window.PuntKlikToppings;
  const TOPPING_BOOSTS = window.PuntKlikToppingBoosts;
  const DECORATIONS = new Set(Object.keys(FIGURES));
  const DEFAULT_CLICKS_TO_SPIN = 12;
  const MIN_CLICKS_TO_SPIN = 1;
  const MAX_CLICKS_TO_SPIN = 50;
  const SPIN_DURATION_MS = 2000;

  let revealed = {};
  let rewardedPoints = {};
  let coins = 0;
  let decoration = 'classic';
  let equippedToppings = [];
  let secretCoinBonusEffects = [];
  let activeStoreEvents = [];
  let clicksToSpin = DEFAULT_CLICKS_TO_SPIN;
  let storageLoaded = false;
  let enabled = true;
  let activeClose = null;
  let storageErrorShown = false;
  let challengeLoginNoticeShown = false;
  let announcementErrorShown = false;
  let lastAnnouncementId = '';
  let syncQueued = false;
  let onboardingPending = false;
  let onboardingTourRunning = false;
  let onboardingStep = 0;

  function loadSettings() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(
          [
            'revealedV2',
            'rewardedPoints',
            'coins',
            'decoration',
            'enabled',
            'equippedToppings',
            'clicksToSpin',
            'secretCoinBonusEffects',
            'activeStoreEvents',
            'onboardingPending',
            'onboardingCompleted',
            'onboardingStep',
          ],
          (data) => {
            const error = chrome.runtime.lastError;
            if (error) {
              reject(new Error(error.message));
              return;
            }
            const settings = data || {};
            const saved = settings.revealedV2;
            revealed = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
            const rewards = settings.rewardedPoints;
            rewardedPoints =
              rewards && typeof rewards === 'object' && !Array.isArray(rewards) ? rewards : {};
            coins = Number.isSafeInteger(settings.coins) && settings.coins >= 0 ? settings.coins : 0;
            decoration = DECORATIONS.has(settings.decoration) ? settings.decoration : 'classic';
            equippedToppings = Array.isArray(settings.equippedToppings)
              ? [...new Set(settings.equippedToppings.filter((id) => Object.hasOwn(TOPPINGS, id)))]
              : [];
            secretCoinBonusEffects = Array.isArray(settings.secretCoinBonusEffects)
              ? settings.secretCoinBonusEffects.filter((effect) =>
                effect &&
                Number.isSafeInteger(effect.percent) &&
                effect.percent > 0 &&
                typeof effect.expiresAt === 'string'
              )
              : [];
            activeStoreEvents = Array.isArray(settings.activeStoreEvents) ? settings.activeStoreEvents : [];
            onboardingPending =
              settings.onboardingPending === true &&
              settings.onboardingCompleted !== true;
            onboardingStep =
              Number.isSafeInteger(settings.onboardingStep) &&
              settings.onboardingStep >= 0 &&
              settings.onboardingStep < 7
                ? settings.onboardingStep
                : 0;
            clicksToSpin =
              Number.isSafeInteger(settings.clicksToSpin) &&
              settings.clicksToSpin >= MIN_CLICKS_TO_SPIN &&
              settings.clicksToSpin <= MAX_CLICKS_TO_SPIN
                ? settings.clicksToSpin
                : DEFAULT_CLICKS_TO_SPIN;
            enabled = settings.enabled !== false;
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  function refreshGlobalAnnouncement() {
    if (window !== window.top) return;
    chrome.runtime.sendMessage({ type: 'puntklik:get-announcement' }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        if (!announcementErrorShown) {
          console.error('PuntKlik: announcement kon niet worden geladen.', error);
          announcementErrorShown = true;
        }
        return;
      }
      if (response && response.error) {
        if (!announcementErrorShown) {
          console.error('PuntKlik: announcement kon niet worden geladen.', response.error);
          announcementErrorShown = true;
        }
        return;
      }
      announcementErrorShown = false;
      const announcement = response && response.announcement;
      if (
        !announcement ||
        typeof announcement.id !== 'string' ||
        typeof announcement.author_name !== 'string' ||
        typeof announcement.message !== 'string' ||
        announcement.id === lastAnnouncementId
      ) {
        return;
      }
      const remaining = Date.parse(announcement.expires_at) - Date.now();
      if (!(remaining > 0)) return;
      if (!document.body) return;
      lastAnnouncementId = announcement.id;
      toast(`${announcement.author_name}: ${announcement.message}`, remaining);
    });
  }

  function toast(message, durationMs) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => toast(message, durationMs), { once: true });
      return;
    }
    document.querySelectorAll('.pc-toast').forEach((notice) => notice.remove());
    const notice = document.createElement('div');
    notice.className = 'pc-toast';
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), Number.isFinite(durationMs) ? durationMs : 3000);
  }

  function reportStorageError(context, error) {
    console.error(`PuntKlik: ${context}`, error);
    if (storageErrorShown) return;
    storageErrorShown = true;
    const notify = () => toast('PuntKlik kon de instelling niet bewaren. Herlaad de pagina.');
    if (document.body) notify();
    else document.addEventListener('DOMContentLoaded', notify, { once: true });
  }

  function startOnboardingTour() {
    if (window !== window.top || !onboardingPending || !document.body || onboardingTourRunning) return;
    onboardingTourRunning = true;

    const steps = [
      {
        emoji: '👋',
        title: 'Welkom bij PuntKlik',
        text: 'Volg de aanwijzingen: ik wijs aan waar je in Smartschool moet kijken en wat je daar kunt doen.',
      },
      {
        emoji: '🧭',
        title: 'Klik op ‘Ga naar’',
        text: 'Klik in de Smartschool-balk op Ga naar. Klik daarna op Volgende; dan wijs ik Resultaten aan.',
        anchor: 'go-to',
      },
      {
        emoji: '📋',
        title: 'Kies ‘Resultaten’',
        text: 'Klik in het menu op Resultaten om je punten te bekijken. Klik daarna op Volgende.',
        anchor: 'results',
      },
      {
        emoji: '👆',
        title: 'Zoek een verborgen punt',
        text: 'Op de puntenpagina wordt een punt vervangen door het PuntKlik-logo. Het omkaderde punt is klikbaar.',
        anchor: 'score',
      },
      {
        emoji: '👆',
        title: 'Speel de minigame',
        text: `Klik op een verborgen punt om de minigame te openen. Tik daar ${clicksToSpin} keer op de figuur; daarna draait en onthult PuntKlik je punt.`,
        anchor: 'score',
      },
      {
        emoji: '🪙',
        title: 'Verdien coins',
        text: 'Na het onthullen krijg je coins. De zeldzaamheid en beloning hangen af van je score. Open daarna de PuntKlik-popup via het puzzelstukje of het PuntKlik-icoon rechtsboven in je browser.',
        anchor: 'toolbar',
      },
      {
        emoji: '🎨',
        title: 'Pas PuntKlik aan',
        text: 'In de popup kun je coins bekijken, figuren en toppings kiezen en via Instellingen het aantal tikken aanpassen.',
        anchor: 'toolbar',
      },
    ];

    let stepIndex = onboardingStep;
    const overlay = document.createElement('div');
    overlay.className = 'pc-tour-overlay';
    const card = document.createElement('section');
    card.className = 'pc-tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'pc-tour-title');
    overlay.appendChild(card);

    function findTarget(anchor) {
      if (anchor === 'score') {
        return document.querySelector('[data-ss-case="locked"]');
      }
      const exactLabels = {
        'go-to': 'ga naar',
        results: 'resultaten',
      };
      const expectedLabel = exactLabels[anchor];
      if (expectedLabel) {
        const interactiveSelector = 'a, button, [role="button"], [role="menuitem"], [tabindex]';
        const candidates = [...document.querySelectorAll(
          `${interactiveSelector}, li, span, div`
        )].filter((element) => {
          if (!element.getClientRects().length || element.closest(UI_SELECTOR)) return false;
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const labels = [
            element.textContent,
            element.getAttribute('aria-label'),
            element.getAttribute('title'),
          ];
          return labels.some((label) => (label || '').replace(/\s+/g, ' ').trim().toLowerCase() === expectedLabel);
        });
        candidates.sort((first, second) => {
          const firstInteractive = first.matches(interactiveSelector) ? 0 : 1;
          const secondInteractive = second.matches(interactiveSelector) ? 0 : 1;
          if (firstInteractive !== secondInteractive) return firstInteractive - secondInteractive;
          const firstRect = first.getBoundingClientRect();
          const secondRect = second.getBoundingClientRect();
          return firstRect.width * firstRect.height - secondRect.width * secondRect.height;
        });
        return candidates[0] || null;
      }
      return null;
    }

    function positionCard(target, anchor) {
      const cardRect = card.getBoundingClientRect();
      const margin = 12;
      if (['toolbar', 'go-to', 'results'].includes(anchor)) {
        card.style.top = `${Math.max(margin, window.innerHeight - cardRect.height - 24)}px`;
        card.style.left = `${Math.max(margin, window.innerWidth - cardRect.width - 18)}px`;
        return;
      }
      if (!target) {
        card.style.top = `${Math.max(margin, (window.innerHeight - cardRect.height) / 2)}px`;
        card.style.left = `${Math.max(margin, (window.innerWidth - cardRect.width) / 2)}px`;
        return;
      }

      const rect = target.getBoundingClientRect();
      const left = Math.min(
        window.innerWidth - cardRect.width - margin,
        Math.max(margin, rect.left + rect.width / 2 - cardRect.width / 2)
      );
      const below = rect.bottom + 14;
      const top = below + cardRect.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, rect.top - cardRect.height - 14);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }

    function updateSpotlight() {
      const step = steps[stepIndex];
      const target = findTarget(step.anchor);
      if (target) {
        const rect = target.getBoundingClientRect();
        overlay.dataset.hasTarget = 'true';
        overlay.style.setProperty('--target-top', `${Math.max(0, rect.top - 5)}px`);
        overlay.style.setProperty('--target-left', `${Math.max(0, rect.left - 5)}px`);
        overlay.style.setProperty('--target-width', `${rect.width + 10}px`);
        overlay.style.setProperty('--target-height', `${rect.height + 10}px`);
      } else {
        overlay.dataset.hasTarget = 'false';
      }
      positionCard(target, step.anchor);
    }

    function finishTour() {
      onboardingPending = false;
      onboardingTourRunning = false;
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
      overlay.remove();
      chrome.storage.local.set({
        onboardingPending: false,
        onboardingCompleted: true,
        onboardingStep: 0,
      }, () => {
        const error = chrome.runtime.lastError;
        if (error) reportStorageError('rondleiding kon niet worden afgerond.', error);
      });
    }

    function render() {
      const step = steps[stepIndex];
      card.dataset.anchor = step.anchor || '';
      const missingTargetText = step.anchor === 'go-to'
        ? 'Zoek in de Smartschool-balk naar Ga naar. Klik daarop en daarna op Volgende.'
        : step.anchor === 'results'
          ? 'Klik eerst op Ga naar zodat het menu opent. Kies daarna Resultaten en klik op Volgende.'
        : step.anchor === 'score'
          ? 'Ga naar een Smartschool-puntenpagina met resultaten. PuntKlik wijst daar een verborgen punt aan.'
          : step.anchor === 'toolbar'
            ? 'De browserbalk staat buiten de pagina; kijk rechtsboven in je browser.'
            : step.text;
      card.innerHTML = `
          ${step.anchor === 'toolbar' ? '<div class="pc-tour-pointer" aria-hidden="true">↗</div>' : ''}
          <button type="button" class="pc-tour-close" aria-label="Rondleiding sluiten">×</button>
          <div class="pc-tour-emoji">${step.emoji}</div>
          <h2 id="pc-tour-title">${step.title}</h2>
          <p>${step.anchor && !findTarget(step.anchor) ? missingTargetText : step.text}</p>
          <div class="pc-tour-dots" aria-label="Stap ${stepIndex + 1} van ${steps.length}">
            ${steps.map((_, index) => `<span class="${index === stepIndex ? 'active' : ''}"></span>`).join('')}
          </div>
          <div class="pc-tour-actions">
            <button type="button" class="pc-tour-skip">Overslaan</button>
            <button type="button" class="pc-tour-next">${stepIndex === steps.length - 1 ? 'Klaar' : 'Volgende'}</button>
          </div>
        `;

      card.querySelector('.pc-tour-close').addEventListener('click', finishTour);
      card.querySelector('.pc-tour-skip').addEventListener('click', finishTour);
      card.querySelector('.pc-tour-next').addEventListener('click', () => {
        if (stepIndex === steps.length - 1) finishTour();
        else {
          stepIndex += 1;
          onboardingStep = stepIndex;
          chrome.storage.local.set({ onboardingStep }, () => {
            const error = chrome.runtime.lastError;
            if (error) reportStorageError('rondleiding kon niet worden bewaard.', error);
          });
          render();
        }
      });
      requestAnimationFrame(updateSpotlight);
    }

    render();
    document.body.appendChild(overlay);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
  }

  function flushSave() {
    try {
      chrome.storage.local.set({ revealedV2: revealed }, () => {
        const error = chrome.runtime.lastError;
        if (error) reportStorageError('punten konden niet worden bewaard.', error);
      });
    } catch (error) {
      reportStorageError('punten konden niet worden bewaard.', error);
    }
  }
  function saveRevealed(keys) {
    for (const key of keys) revealed[key] = 1;
    flushSave();
  }

  function rarityFor(percent) {
    return RARITIES.find((rarity) => percent >= rarity.min);
  }

  function toppingBoostPercent() {
    return equippedToppings.reduce((total, id) => total + TOPPING_BOOSTS[id], 0);
  }

  function secretCoinBonusPercent() {
    const now = Date.now();
    return secretCoinBonusEffects.reduce((total, effect) =>
      Date.parse(effect.expiresAt) > now ? total + effect.percent : total, 0);
  }

  function getActiveStoreEvent(eventType) {
    const now = Date.now();
    return activeStoreEvents.find((event) =>
      event &&
      event.event_type === eventType &&
      Date.parse(event.starts_at) <= now &&
      Date.parse(event.ends_at) > now
    ) || null;
  }

  function currentDecoration() {
    const themeEvent = getActiveStoreEvent('theme');
    const eventTheme = themeEvent && themeEvent.event_config && themeEvent.event_config.theme;
    return DECORATIONS.has(eventTheme) ? eventTheme : decoration;
  }

  function describeStoreEvent(event) {
    const config = event.event_config || {};
    const descriptions = {
      double_coins: 'Dubbele coins',
      coin_gift: `Coinbonus: ${config.coins || 0} coins`,
      coin_shower: `Muntjesregen: ${config.coins_per_bag || 0} coins per zakje`,
      flash_sale: 'Flash sale',
      lucky_drop: `Lucky drop: ${config.chance_percent || 0}% kans op ${config.reward_coins || 0} coins`,
      points_challenge: `Puntenchallenge: ${config.target_points || 0} punten voor ${config.reward_coins || 0} coins`,
      theme: `Thema-event: ${config.theme || ''}`,
    };
    return descriptions[event.event_type] || 'Winkel-event';
  }

  function updateActiveStoreEvents(events, announceNewEvents) {
    const nextEvents = Array.isArray(events)
      ? events.filter((event) => event && typeof event.id === 'string')
      : [];
    const previousIds = new Set(activeStoreEvents.map((event) => event && event.id).filter(Boolean));
    const newlyStarted = nextEvents.filter((event) => !previousIds.has(event.id));
    const previousFruitEventIds = new Set(activeStoreEvents
      .filter((event) => event && event.event_config && event.event_config.owner_fruit_granted === true)
      .map((event) => event.id));
    const newlyGrantedFruit = nextEvents.some((event) =>
      event &&
      event.event_config &&
      event.event_config.owner_fruit_granted === true &&
      !previousFruitEventIds.has(event.id) &&
      previousIds.has(event.id)
    );
    activeStoreEvents = nextEvents;
    document.querySelectorAll('.pc-overlay').forEach((overlay) => {
      overlay.dataset.decoration = currentDecoration();
    });
    if (announceNewEvents && newlyStarted.length && window === window.top) {
      toast(`Event geactiveerd: ${newlyStarted.map(describeStoreEvent).join(' · ')}`, 4500);
    } else if (announceNewEvents && newlyGrantedFruit && window === window.top) {
      toast('🍓 Ownerfruit gekregen: +60% coins zolang het event actief is!', 4500);
    }
  }

  function ownerFruitBonusPercent() {
    const now = Date.now();
    const eventWithFruit = activeStoreEvents.find((event) =>
      event &&
      event.event_config &&
      event.event_config.owner_fruit_granted === true &&
      Date.parse(event.starts_at) <= now &&
      Date.parse(event.ends_at) > now
    );
    const percent = Number(eventWithFruit && eventWithFruit.event_config.fruit_bonus_percent);
    return Number.isSafeInteger(percent) && percent > 0 && percent <= 100 ? percent : 0;
  }

  function spawnCoinBag() {
    if (!enabled || window !== window.top || !document.body) return;
    const event = getActiveStoreEvent('coin_shower');
    if (!event || !event.event_config) return;
    const amount = Number(event.event_config.coins_per_bag);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) return;

    const bag = document.createElement('button');
    bag.type = 'button';
    bag.className = 'pc-coin-bag';
    bag.textContent = '💰';
    bag.setAttribute('aria-label', `Pak het muntzakje: ${amount} coins`);
    bag.style.left = `${Math.floor(Math.random() * Math.max(1, window.innerWidth - 58))}px`;
    const bagEventId = event.id;
    bag.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      const currentEvent = getActiveStoreEvent('coin_shower');
      if (!currentEvent || currentEvent.id !== bagEventId || !bag.isConnected) {
        bag.remove();
        return;
      }
      const fruitBonus = ownerFruitBonusPercent();
      const reward = amount + (fruitBonus ? Math.max(1, Math.round(amount * fruitBonus / 100)) : 0);
      coins = Math.min(1000000000, coins + reward);
      bag.remove();
      chrome.storage.local.set({ coins }, () => {
        const error = chrome.runtime.lastError;
        if (error) reportStorageError('muntzakjes konden niet worden bewaard.', error);
      });
      toast(`Muntzakje geopend: +${reward} coins!`);
    }, { once: true });
    document.body.append(bag);
    setTimeout(() => bag.remove(), 8000);
  }

  function refreshStoreEvents() {
    if (window !== window.top) return;
    chrome.runtime.sendMessage({ type: 'puntklik:get-store-events' }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('PuntKlik: actieve events konden niet worden geladen.', error);
        return;
      }
      if (response && response.error) {
        console.error('PuntKlik: actieve events konden niet worden geladen.', response.error);
        return;
      }
      updateActiveStoreEvents(response && response.events, true);
      chrome.storage.local.set({ activeStoreEvents }, () => {
        const storageError = chrome.runtime.lastError;
        if (storageError) reportStorageError('events konden niet worden bewaard.', storageError);
      });
    });
  }

  async function recordChallengePoint(key) {
    const challenge = getActiveStoreEvent('points_challenge');
    if (!challenge || !challenge.id) return;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const pointHash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    chrome.runtime.sendMessage({
      type: 'puntklik:record-challenge-point',
      eventId: challenge.id,
      pointHash,
    }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('PuntKlik: puntenchallenge kon niet worden bijgewerkt.', error);
        toast('Puntenchallenge kon niet worden bijgewerkt. Log in en probeer later opnieuw.');
        return;
      }
      if (response && response.error) {
        console.error('PuntKlik: puntenchallenge kon niet worden bijgewerkt.', response.error);
        if (response.error.includes('Log in om mee te doen')) {
          if (!challengeLoginNoticeShown) toast('Log in met Google om de puntenchallenge mee te spelen.');
          challengeLoginNoticeShown = true;
          return;
        }
        toast(`Puntenchallenge mislukt: ${response.error}`);
        return;
      }
      if (!response || !response.result) return;
      challengeLoginNoticeShown = false;
      const result = response.result;
      toast(Number(result.coins_awarded) > 0
        ? `Challenge gehaald: +${result.coins_awarded} coins!`
        : `Puntenchallenge: ${result.points_count}/${result.target_points} punten.`);
    });
  }

  function awardCoins(info, keys) {
    const key = keys[Math.min(1, keys.length - 1)];
    if (!key || rewardedPoints[key]) return 0;
    const baseReward = rarityFor(info.percent).coins * (getActiveStoreEvent('double_coins') ? 2 : 1);
    const boostPercent = toppingBoostPercent() + secretCoinBonusPercent() + ownerFruitBonusPercent();
    const luckyDrop = getActiveStoreEvent('lucky_drop');
    const luckyBonus = luckyDrop &&
      Math.random() * 100 < Number(luckyDrop.event_config.chance_percent)
      ? Number(luckyDrop.event_config.reward_coins)
      : 0;
    const reward = baseReward +
      (boostPercent > 0 ? Math.max(1, Math.round(baseReward * boostPercent / 100)) : 0) +
      luckyBonus;
    rewardedPoints[key] = reward;
    coins += reward;
    try {
      chrome.storage.local.set({ coins, rewardedPoints }, () => {
        const error = chrome.runtime.lastError;
        if (error) reportStorageError('munten konden niet worden bewaard.', error);
      });
    } catch (error) {
      reportStorageError('munten konden niet worden bewaard.', error);
    }
    void recordChallengePoint(key).catch((error) => {
      console.error('PuntKlik: puntenchallenge kon niet worden bijgewerkt.', error);
      toast(`Puntenchallenge mislukt: ${error.message}`);
    });
    return reward;
  }

  function parseScore(text) {
    let match = text.match(SCORE_RE);
    if (match) {
      const score = Number.parseFloat(match[1].replace(',', '.'));
      const maximum = Number.parseFloat(match[2].replace(',', '.'));
      if (!(maximum > 0) || score > maximum) return null;
      return {
        kind: 'score',
        score,
        maximum,
        maximumText: match[2],
        percent: (score / maximum) * 100,
        label: text,
      };
    }

    match = text.match(PERCENT_RE);
    if (!match) return null;
    const percent = Number.parseFloat(match[1].replace(',', '.'));
    if (percent > 100) return null;
    return { kind: 'percent', percent, label: text };
  }

  function textOf(element) {
    const parts = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim()) parts.push(node.nodeValue.trim());
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function infoFromGroups(groups) {
    const text = groups.map(textOf).join(' ');
    const scores = text.match(SCORES_RE);
    const percents = text.match(PERCENTS_RE);
    let info = scores ? parseScore(scores[0].replace(/\s+/g, '')) : null;
    if (!info && percents) info = parseScore(percents[0].replace(/\s+/g, ''));
    if (info && info.kind === 'score' && percents) {
      info.extra = percents[0].replace(/\s+/g, '');
    }
    return info;
  }

  function dateOf(element) {
    let ancestor = element;
    for (let i = 0; i < 10; i++) {
      ancestor = ancestor.parentElement;
      if (!ancestor || ancestor === document.body || ancestor === document.documentElement) break;
      const text = (ancestor.textContent || '').replace(/\s+/g, ' ');
      if (text.length > 6000) break;
      const match = text.match(DATE_RE);
      if (match) return match[0].toLowerCase();
    }
    return '';
  }

  function contextOf(element) {
    const date = dateOf(element);
    if (date) return date;
    const row = element.closest('tr, li, [class*="row"], [class*="result"]');
    return row ? (row.innerText || '').replace(/\s+/g, ' ').slice(0, 100) : '';
  }

  function keysFor(element) {
    const info = infoFromGroups([element]);
    if (!info) return [];
    const rounded = new Set([
      Math.floor(info.percent),
      Math.round(info.percent),
      Math.ceil(info.percent),
    ]);
    return [...rounded].map((value) => `${value}|${contextOf(element)}`);
  }

  function isRevealed(element) {
    return keysFor(element).some((key) => revealed[key]);
  }

  function growGroup(element) {
    let group = element;
    for (let i = 0; i < 5; i++) {
      const parent = group.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) break;
      const text = textOf(parent);
      if (text.length > 30 || !GROUP_TEXT_RE.test(text)) break;
      if ((text.match(SCORES_RE) || []).length > 1 || (text.match(PERCENTS_RE) || []).length > 1) break;
      const rect = parent.getBoundingClientRect();
      if (rect.width > 420 || rect.height > 420) break;
      group = parent;
    }
    return group;
  }

  function findPeers(group) {
    const text = textOf(group);
    const hasScore = /\d\s*\/\s*\d/.test(text);
    const hasPercent = /%/.test(text);
    if (hasScore && hasPercent) return [];

    let ancestor = group;
    for (let i = 0; i < 6; i++) {
      ancestor = ancestor.parentElement;
      if (!ancestor || ancestor === document.body || ancestor === document.documentElement) return [];
      const ancestorText = textOf(ancestor);
      if (ancestorText.length > 400) return [];
      const scoreCount = (ancestorText.match(SCORES_RE) || []).length;
      const percentCount = (ancestorText.match(PERCENTS_RE) || []).length;
      if (scoreCount > 1 || percentCount > 1) return [];
      if (scoreCount === 1 && percentCount === 1) {
        for (const element of ancestor.querySelectorAll(SCORE_SELECTOR)) {
          if (group.contains(element) || element.contains(group)) continue;
          if (element.dataset && element.dataset.ssCase) continue;
          if (element.childElementCount > 6) continue;
          const info = parseScore(element.textContent.trim());
          if (!info || (info.kind === 'percent') === hasPercent) continue;
          const peer = growGroup(element);
          if (peer.contains(group) || group.contains(peer)) return [];
          return [peer];
        }
        return [];
      }
    }
    return [];
  }

  function setRevealed(element) {
    element.dataset.ssCase = 'revealed';
    delete element.dataset.ssInline;
    element.removeAttribute('title');
  }

  function setLocked(element) {
    element.dataset.ssCase = 'locked';
    element.title = 'Klik om PuntKlik te starten';
    if (getComputedStyle(element).display === 'inline') element.dataset.ssInline = '1';
  }

  function onScoreClick(element, event) {
    if (!enabled || element.dataset.ssCase !== 'locked') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (activeClose) return;
    const info = infoFromGroups([element, ...(element._peers || [])]);
    if (info) openClicker(element, info, keysFor(element));
  }

  function markGroup(group) {
    const peers = findPeers(group);
    const related = [group, ...peers];
    const alreadyRevealed = storageLoaded && isRevealed(group);

    for (const element of related) {
      element.dataset.ssText = textOf(element);
      element._peers = related.filter((peer) => peer !== element);
      if (alreadyRevealed) setRevealed(element);
      else setLocked(element);
      if (!element._puntpostBound) {
        element._puntpostBound = true;
        element.addEventListener('click', (event) => onScoreClick(element, event), true);
      }
    }
  }

  function clearMark(element) {
    delete element.dataset.ssCase;
    delete element.dataset.ssText;
    delete element.dataset.ssInline;
    element._peers = null;
    element.removeAttribute('title');
  }

  function unmark(group) {
    for (const element of [group, ...(group._peers || [])]) clearMark(element);
  }

  function isClassStatistic(element) {
    let ancestor = element;
    for (let i = 0; i < 3; i++) {
      ancestor = ancestor.parentElement;
      if (!ancestor) break;
      const text = ancestor.textContent || '';
      if (text.length < 60 && /gemiddelde|mediaan|klasgem/i.test(text)) return true;
    }
    return false;
  }

  function scanRoot(root) {
    if (!storageLoaded || !enabled || !root || root.nodeType !== 1) return;
    const elements = [];
    if (root.matches && root.matches(SCORE_SELECTOR)) elements.push(root);
    root.querySelectorAll(SCORE_SELECTOR).forEach((element) => elements.push(element));
    for (const element of elements) {
      if (!element.dataset || element.dataset.ssCase || element.childElementCount > 6) continue;
      if (element.closest(UI_SELECTOR) || element.closest('[data-ss-case]')) continue;
      const text = element.textContent.trim();
      if (!text || text.length > 12 || !parseScore(text) || isClassStatistic(element)) continue;
      markGroup(growGroup(element));
    }
  }

  function syncRevealed() {
    if (!storageLoaded || !enabled) return;
    document.querySelectorAll('[data-ss-case]').forEach((element) => {
      const wanted = isRevealed(element) ? 'revealed' : 'locked';
      if (element.dataset.ssCase === wanted) return;
      if (wanted === 'revealed') setRevealed(element);
      else setLocked(element);
    });
  }

  function scheduleSync() {
    if (syncQueued || !storageLoaded) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      syncRevealed();
    });
  }

  function handleMutations(mutations) {
    if (!storageLoaded || !enabled || !isActivePage()) {
      return;
    }
    const roots = new Set();
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        if (mutation.target.parentElement) roots.add(mutation.target.parentElement);
      } else {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) roots.add(node);
          else if (node.nodeType === 3 && node.parentElement) roots.add(node.parentElement);
        }
        if (mutation.removedNodes.length && mutation.target.nodeType === 1) roots.add(mutation.target);
      }
    }

    const rescan = new Set();
    for (const root of roots) {
      if (!root.isConnected || (root.closest && root.closest(UI_SELECTOR))) continue;
      const marked = root.closest ? root.closest('[data-ss-case]') : null;
      if (marked) {
        if (marked.dataset.ssText !== textOf(marked)) {
          unmark(marked);
          rescan.add(marked.parentElement || document.body);
        }
      } else {
        scanRoot(root);
      }
    }
    rescan.forEach(scanRoot);
    scheduleSync();
  }

  function fullScan() {
    if (storageLoaded && enabled && isActivePage() && document.body) scanRoot(document.body);
  }

  function applyEnabled() {
    if (!enabled) {
      if (activeClose) activeClose();
      document.querySelectorAll(UI_SELECTOR).forEach((element) => element.remove());
      document.querySelectorAll('[data-ss-case]').forEach(clearMark);
      return;
    }
    fullScan();
    syncRevealed();
  }

  function openClicker(element, info, keys) {
    if (activeClose) return;
    const overlay = document.createElement('div');
    overlay.className = 'pc-overlay';
    overlay.dataset.decoration = currentDecoration();
    overlay.dataset.toppings = equippedToppings.join(' ');
    const clicksRequired = clicksToSpin;
    const figureMarkup = Object.entries(FIGURES)
      .map(([id, markup]) => `<g class="pc-figure pc-figure-${id}">${markup}</g>`)
      .join('');
    const toppingMarkup = Object.entries(TOPPINGS)
      .map(([id, markup]) => `<g class="pc-topping pc-topping-${id}">${markup}</g>`)
      .join('');
    overlay.innerHTML = `
      <section class="pc-card" role="dialog" aria-modal="true" aria-labelledby="pc-title">
        <button type="button" class="pc-close" aria-label="Sluiten">×</button>
        <header class="pc-header">
          <img class="pc-logo" src="${chrome.runtime.getURL('logo.svg')}" alt="">
          <div>
            <h2 id="pc-title">PuntKlik</h2>
            <p class="pc-sub">Tik ${clicksRequired} keer. Daarna draaien je punten.</p>
          </div>
        </header>
        <button type="button" class="pc-target" aria-label="Tik op de figuur">
          <svg viewBox="0 0 160 160" aria-hidden="true">${figureMarkup}${toppingMarkup}</svg>
        </button>
        <p class="pc-counter" aria-live="polite"><strong class="pc-count">0</strong> / ${clicksRequired} tikken</p>
        <div class="pc-progress" aria-hidden="true"><span></span></div>
        <div class="pc-number" aria-live="off" aria-label="Puntenspin"></div>
        <p class="pc-subline">Tik op de figuur.</p>
        <div class="pc-result" hidden>
          <div class="pc-reward-line">
            <span class="pc-rarity"></span>
            <span class="pc-coins"></span>
          </div>
          <strong class="pc-score"></strong>
          <small class="pc-extra"></small>
        </div>`;
    document.body.appendChild(overlay);

    const target = overlay.querySelector('.pc-target');
    const countLabel = overlay.querySelector('.pc-count');
    const progress = overlay.querySelector('.pc-progress span');
    const number = overlay.querySelector('.pc-number');
    const subline = overlay.querySelector('.pc-subline');
    const result = overlay.querySelector('.pc-result');
    const score = overlay.querySelector('.pc-score');
    const extra = overlay.querySelector('.pc-extra');
    const rarityLabel = overlay.querySelector('.pc-rarity');
    const coinsLabel = overlay.querySelector('.pc-coins');
    let closed = false;
    let clickCount = 0;
    let rollTimer = 0;
    let revealTimer = 0;

    function close() {
      if (closed) return;
      closed = true;
      activeClose = null;
      clearInterval(rollTimer);
      clearTimeout(revealTimer);
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    }

    function reveal() {
      if (closed) return;
      clearInterval(rollTimer);
      target.disabled = true;
      number.classList.remove('pc-spinning');
      number.textContent = 'Klaar!';
      number.classList.add('pc-real');
      number.setAttribute('aria-live', 'polite');
      subline.textContent = 'Je punt staat hieronder.';
      result.hidden = false;
      score.textContent = info.label;
      extra.textContent = info.extra || '';
      const rarity = rarityFor(info.percent);
      const toppingPercent = toppingBoostPercent();
      const secretBonusPercent = secretCoinBonusPercent();
      const boostPercent = toppingPercent + secretBonusPercent;
      const reward = awardCoins(info, keys);
      rarityLabel.textContent = rarity.name;
      coinsLabel.textContent = reward
        ? `+${reward} coins`
        : 'Coins voor dit punt al gekregen';
      result.dataset.rarity = rarity.name.toLowerCase();
      result.style.setProperty('--rarity-color', rarity.color);
      rarityLabel.title = rarity.range;
      if (boostPercent) {
        extra.textContent = [
          info.extra,
          toppingPercent ? `+${toppingPercent}% toppingbonus` : '',
          secretBonusPercent ? `+${secretBonusPercent}% secret-shopbonus` : '',
        ].filter(Boolean).join(' · ');
      }
      [element, ...(element._peers || [])].forEach(setRevealed);
      saveRevealed(keys);
      syncRevealed();
    }

    function changingScore() {
      if (info.kind === 'percent') {
        const value = Math.floor(Math.random() * 101);
        const safeValue = value === Math.round(info.percent) ? (value === 100 ? 99 : value + 1) : value;
        return `${safeValue}%`;
      }

      const scoreText = info.label.split('/')[0];
      const decimals = (scoreText.split(/[.,]/)[1] || '').length;
      const step = 10 ** -decimals;
      const units = Math.round(info.maximum / step);
      let value = Math.round(Math.random() * units) * step;
      if (Math.abs(value - info.score) < step / 2) {
        value = value + step <= info.maximum ? value + step : Math.max(0, value - step);
      }
      return `${value.toFixed(decimals).replace('.', ',')}/${info.maximumText}`;
    }

    function clickTarget() {
      if (closed || target.disabled) return;
      clickCount = Math.min(clicksRequired, clickCount + 1);
      countLabel.textContent = String(clickCount);
      progress.style.width = `${(clickCount / clicksRequired) * 100}%`;
      target.classList.remove('pc-bump');
      void target.offsetWidth;
      target.classList.add('pc-bump');

      if (clickCount === clicksRequired) {
        target.disabled = true;
        number.classList.add('pc-spinning');
        number.textContent = changingScore();
        rollTimer = setInterval(() => {
          number.textContent = changingScore();
        }, 75);
        subline.textContent = 'Je punten draaien…';
        revealTimer = setTimeout(reveal, SPIN_DURATION_MS);
      } else {
        const remaining = clicksRequired - clickCount;
        subline.textContent = `Nog ${remaining} ${remaining === 1 ? 'tik' : 'tikken'} voor de spin…`;
      }
    }

    function onKey(event) {
      if (event.key === 'Escape') close();
    }

    activeClose = close;
    document.addEventListener('keydown', onKey, true);
    overlay.querySelector('.pc-close').addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    target.addEventListener('click', clickTarget);
    target.focus();
  }

  function observePage() {
    const observer = new MutationObserver(handleMutations);
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.documentElement) {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      }, { once: true });
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area && area !== 'local') return;
    if (changes.onboardingPending) {
      onboardingPending =
        changes.onboardingPending.newValue === true &&
        changes.onboardingCompleted?.newValue !== true;
      startOnboardingTour();
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      applyEnabled();
    }
    if (changes.revealedV2) {
      const next = changes.revealedV2.newValue || {};
      if (!Object.keys(next).length) {
        revealed = {};
      } else {
        Object.assign(revealed, next);
      }
      syncRevealed();
    }
    if (changes.rewardedPoints) rewardedPoints = changes.rewardedPoints.newValue || {};
    if (changes.coins) coins = changes.coins.newValue || 0;
    if (changes.equippedToppings) {
      equippedToppings = Array.isArray(changes.equippedToppings.newValue)
        ? [...new Set(changes.equippedToppings.newValue.filter((id) => Object.hasOwn(TOPPINGS, id)))]
        : [];
      document.querySelectorAll('.pc-overlay').forEach((overlay) => {
        overlay.dataset.toppings = equippedToppings.join(' ');
      });
    }
    if (changes.secretCoinBonusEffects) {
      secretCoinBonusEffects = Array.isArray(changes.secretCoinBonusEffects.newValue)
        ? changes.secretCoinBonusEffects.newValue.filter((effect) =>
          effect &&
          Number.isSafeInteger(effect.percent) &&
          effect.percent > 0 &&
          typeof effect.expiresAt === 'string'
        )
        : [];
    }
    if (changes.activeStoreEvents) {
      updateActiveStoreEvents(changes.activeStoreEvents.newValue, true);
    }
    if (changes.clicksToSpin) {
      const nextClicks = changes.clicksToSpin.newValue;
      clicksToSpin =
        Number.isSafeInteger(nextClicks) &&
        nextClicks >= MIN_CLICKS_TO_SPIN &&
        nextClicks <= MAX_CLICKS_TO_SPIN
          ? nextClicks
          : DEFAULT_CLICKS_TO_SPIN;
    }
    if (changes.decoration) {
      const nextDecoration = changes.decoration.newValue;
      decoration = DECORATIONS.has(nextDecoration) ? nextDecoration : 'classic';
      document.querySelectorAll('.pc-overlay').forEach((overlay) => {
        overlay.dataset.decoration = currentDecoration();
      });
    }
  });

  observePage();
  loadSettings().then(() => {
    storageLoaded = true;
    applyEnabled();
    startOnboardingTour();
    refreshStoreEvents();
    setInterval(refreshStoreEvents, 5000);
    setInterval(spawnCoinBag, 2800);
    refreshGlobalAnnouncement();
    setInterval(refreshGlobalAnnouncement, 1000);
  }).catch((error) => {
    console.error('PuntKlik: instellingen konden niet worden geladen.', error);
    const notify = () => toast('PuntKlik kon niet starten. Je punten blijven zichtbaar.');
    if (document.body) notify();
    else document.addEventListener('DOMContentLoaded', notify, { once: true });
  });

  document.addEventListener('DOMContentLoaded', fullScan);
  window.addEventListener('load', fullScan);
  window.addEventListener('hashchange', fullScan);
  window.addEventListener('popstate', fullScan);
})();
