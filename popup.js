(() => {
  const toggle = document.getElementById('sw');
  const status = document.getElementById('st');
  const label = document.getElementById('label');
  const reset = document.getElementById('reset');
  const message = document.getElementById('msg');
  const coinCount = document.getElementById('coins');
  const shop = document.getElementById('shop');
  const items = [
    { id: 'classic', name: 'Koek', note: 'Startfiguur', price: 0 },
    { id: 'berry', name: 'Aardbei', note: 'Een losse aardbei', price: 15 },
    { id: 'mint', name: 'Muntblaadje', note: 'Een fris blaadje', price: 25 },
    { id: 'night', name: 'Ster', note: 'Een gouden ster', price: 40 },
    { id: 'watermelon', name: 'Watermeloen', note: 'Een sappig partje', price: 20 },
    { id: 'orange', name: 'Sinaasappel', note: 'Een citruswiel', price: 20 },
    { id: 'donut', name: 'Donut', note: 'Met roze glazuur', price: 30 },
    { id: 'cupcake', name: 'Cupcake', note: 'Met een kers erbovenop', price: 35 },
  ];
  let enabled = true;
  let coins = 0;
  let ownedDecorations = ['classic'];
  let decoration = 'classic';
  let confirmTimer = 0;
  let storageFailed = false;

  function showStorageError(error) {
    console.error('PuntKlik opslagfout:', error);
    storageFailed = true;
    message.style.color = '#9e3327';
    message.textContent = 'Instellingen konden niet worden opgeslagen. Herlaad de extensie en probeer opnieuw.';
    toggle.disabled = true;
    reset.disabled = true;
    shop.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
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

  function renderState() {
    toggle.checked = enabled;
    label.textContent = enabled ? 'PuntKlik staat aan' : 'PuntKlik staat uit';
    status.textContent = enabled
      ? 'Tik 12 keer op de figuur. Daarna draaien je punten.'
      : 'Je punten blijven zichtbaar op Smartschool.';
    coinCount.textContent = String(coins);
    document.body.dataset.decoration = decoration;
  }

  function renderShop() {
    shop.replaceChildren();
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      const description = document.createElement('div');
      const swatch = document.createElement('span');
      const name = document.createElement('span');
      const note = document.createElement('span');
      swatch.className = 'item-swatch';
      swatch.dataset.decoration = item.id;
      swatch.setAttribute('aria-hidden', 'true');
      name.className = 'item-name';
      note.className = 'item-note';
      swatch.innerHTML = `<svg viewBox="0 0 160 160" aria-hidden="true">${window.PuntKlikFigures[item.id]}</svg>`;
      name.textContent = item.name;
      note.textContent = item.note;
      description.append(name, note);

      const button = document.createElement('button');
      const owned = ownedDecorations.includes(item.id);
      if (owned && decoration === item.id) {
        button.textContent = 'Gekozen';
        button.classList.add('equipped');
        button.disabled = true;
      } else if (owned) {
        button.textContent = 'Kies';
        button.disabled = storageFailed;
        button.addEventListener('click', () => selectDecoration(item.id));
      } else {
        button.textContent = `Koop ${item.price}`;
        button.disabled = storageFailed || coins < item.price;
        button.addEventListener('click', () => buyDecoration(item));
      }
      row.append(swatch, description, button);
      shop.append(row);
    }
  }

  function selectDecoration(id) {
    saveSettings({ decoration: id }, () => {
      decoration = id;
      message.style.color = '';
      message.textContent = 'Versiering aangepast.';
      renderState();
      renderShop();
    });
  }

  function buyDecoration(item) {
    if (coins < item.price || ownedDecorations.includes(item.id)) return;
    const nextCoins = coins - item.price;
    const nextOwned = [...ownedDecorations, item.id];
    saveSettings(
      { coins: nextCoins, ownedDecorations: nextOwned, decoration: item.id },
      () => {
        coins = nextCoins;
        ownedDecorations = nextOwned;
        decoration = item.id;
        message.style.color = '';
        message.textContent = `${item.name} gekocht en gekozen.`;
        renderState();
        renderShop();
      }
    );
  }

  chrome.storage.local.get(
    ['enabled', 'coins', 'ownedDecorations', 'decoration'],
    (settings) => {
      const error = chrome.runtime.lastError;
      if (error) {
        showStorageError(error);
        return;
      }
      const data = settings || {};
      enabled = data.enabled !== false;
      coins = Number.isSafeInteger(data.coins) && data.coins >= 0 ? data.coins : 0;
      ownedDecorations = Array.isArray(data.ownedDecorations)
        ? [...new Set(['classic', ...data.ownedDecorations.filter((id) => items.some((item) => item.id === id))])]
        : ['classic'];
      decoration = ownedDecorations.includes(data.decoration) ? data.decoration : 'classic';
      renderState();
      renderShop();
    }
  );

  toggle.addEventListener('change', () => {
    const nextEnabled = toggle.checked;
    toggle.disabled = true;
    saveSettings({ enabled: nextEnabled }, () => {
      enabled = nextEnabled;
      toggle.disabled = false;
      message.textContent = '';
      message.style.color = '';
      renderState();
    });
  });

  reset.addEventListener('click', () => {
    if (reset.classList.contains('confirm')) {
      clearTimeout(confirmTimer);
      reset.classList.remove('confirm');
      reset.textContent = 'Punten opnieuw verstoppen';
      reset.disabled = true;
      message.textContent = 'Bezig…';
      saveSettings({ revealedV2: {} }, () => {
        reset.disabled = false;
        message.style.color = '';
        message.textContent = 'De punten zijn opnieuw verstopt.';
      });
      return;
    }

    reset.classList.add('confirm');
    reset.textContent = 'Nog eens klikken om te bevestigen';
    message.textContent = '';
    confirmTimer = setTimeout(() => {
      reset.classList.remove('confirm');
      reset.textContent = 'Punten opnieuw verstoppen';
    }, 3500);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area && area !== 'local') return;
    if (changes.coins) {
      coins = Number.isSafeInteger(changes.coins.newValue) ? changes.coins.newValue : 0;
      renderState();
      renderShop();
    }
    if (changes.ownedDecorations) {
      ownedDecorations = Array.isArray(changes.ownedDecorations.newValue)
        ? changes.ownedDecorations.newValue
        : ['classic'];
      renderShop();
    }
    if (changes.decoration) {
      decoration = changes.decoration.newValue || 'classic';
      renderState();
      renderShop();
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      renderState();
    }
  });
})();
