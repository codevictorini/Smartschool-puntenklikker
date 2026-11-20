(() => {
  'use strict';

  const PATH_HINT = /result|skore|punten/i;
  const isActivePage = () => PATH_HINT.test(location.pathname + location.search + location.hash);
  const UI_SELECTOR = '.pc-overlay, .pc-toast';
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
  const DECORATIONS = new Set(Object.keys(FIGURES));
  const CLICKS_TO_REVEAL = 12;
  const SPIN_DURATION_MS = 2000;

  let revealed = {};
  let rewardedPoints = {};
  let coins = 0;
  let decoration = 'classic';
  let storageLoaded = false;
  let enabled = true;
  let activeClose = null;
  let storageErrorShown = false;
  let syncQueued = false;

  function loadSettings() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(
          ['revealedV2', 'rewardedPoints', 'coins', 'decoration', 'enabled'],
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
            enabled = settings.enabled !== false;
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  function toast(message) {
    if (!document.body) return;
    const notice = document.createElement('div');
    notice.className = 'pc-toast';
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 3000);
  }

  function reportStorageError(context, error) {
    console.error(`PuntKlik: ${context}`, error);
    if (storageErrorShown) return;
    storageErrorShown = true;
    const notify = () => toast('PuntKlik kon de instelling niet bewaren. Herlaad de pagina.');
    if (document.body) notify();
    else document.addEventListener('DOMContentLoaded', notify, { once: true });
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

  function awardCoins(info, keys) {
    const key = keys[Math.min(1, keys.length - 1)];
    if (!key || rewardedPoints[key]) return 0;
    const reward = rarityFor(info.percent).coins;
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
    overlay.dataset.decoration = decoration;
    const figureMarkup = Object.entries(FIGURES)
      .map(([id, markup]) => `<g class="pc-figure pc-figure-${id}">${markup}</g>`)
      .join('');
    overlay.innerHTML = `
      <section class="pc-card" role="dialog" aria-modal="true" aria-labelledby="pc-title">
        <button type="button" class="pc-close" aria-label="Sluiten">×</button>
        <header class="pc-header">
          <img class="pc-logo" src="${chrome.runtime.getURL('logo.svg')}" alt="">
          <div>
            <h2 id="pc-title">PuntKlik</h2>
            <p class="pc-sub">Tik ${CLICKS_TO_REVEAL} keer. Daarna draaien je punten.</p>
          </div>
        </header>
        <button type="button" class="pc-target" aria-label="Tik op de figuur">
          <svg viewBox="0 0 160 160" aria-hidden="true">${figureMarkup}</svg>
        </button>
        <p class="pc-counter" aria-live="polite"><strong class="pc-count">0</strong> / ${CLICKS_TO_REVEAL} tikken</p>
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
      const reward = awardCoins(info, keys);
      rarityLabel.textContent = rarity.name;
      coinsLabel.textContent = reward
        ? `+${reward} coins`
        : 'Coins voor dit punt al gekregen';
      result.dataset.rarity = rarity.name.toLowerCase();
      result.style.setProperty('--rarity-color', rarity.color);
      rarityLabel.title = rarity.range;
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

    function clickCookie() {
      if (closed || target.disabled) return;
      clickCount = Math.min(CLICKS_TO_REVEAL, clickCount + 1);
      countLabel.textContent = String(clickCount);
      progress.style.width = `${(clickCount / CLICKS_TO_REVEAL) * 100}%`;
      target.classList.remove('pc-bump');
      void target.offsetWidth;
      target.classList.add('pc-bump');

      if (clickCount === CLICKS_TO_REVEAL) {
        target.disabled = true;
        number.classList.add('pc-spinning');
        number.textContent = changingScore();
        rollTimer = setInterval(() => {
          number.textContent = changingScore();
        }, 75);
        subline.textContent = 'Je punten draaien…';
        revealTimer = setTimeout(reveal, SPIN_DURATION_MS);
      } else {
        const remaining = CLICKS_TO_REVEAL - clickCount;
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
    target.addEventListener('click', clickCookie);
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
    if (changes.decoration) {
      const nextDecoration = changes.decoration.newValue;
      decoration = DECORATIONS.has(nextDecoration) ? nextDecoration : 'classic';
      document.querySelectorAll('.pc-overlay').forEach((overlay) => {
        overlay.dataset.decoration = decoration;
      });
    }
  });

  observePage();
  loadSettings().then(() => {
    storageLoaded = true;
    applyEnabled();
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
