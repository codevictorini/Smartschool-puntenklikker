(() => {
  const form = document.getElementById('click-form');
  const clickInput = document.getElementById('clicks');
  const saveButton = document.getElementById('save-clicks');
  const enabledInput = document.getElementById('enabled');
  const resetButton = document.getElementById('reset');
  const status = document.getElementById('status');
  const currentCount = document.getElementById('current-count');
  const DEFAULT_CLICKS = 12;
  const MIN_CLICKS = 1;
  const MAX_CLICKS = 50;
  let clicksToSpin = DEFAULT_CLICKS;
  let enabled = true;
  let confirmTimer = 0;

  function showStorageError(error) {
    console.error('PuntKlik instellingen-opslagfout:', error);
    status.textContent = 'Opslaan mislukt. Herlaad de instellingenpagina en probeer opnieuw.';
    clickInput.disabled = true;
    saveButton.disabled = true;
    enabledInput.disabled = true;
    resetButton.disabled = true;
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

  function render() {
    clickInput.value = String(clicksToSpin);
    enabledInput.checked = enabled;
    currentCount.textContent = `Huidige instelling: ${clicksToSpin} tikken.`;
  }

  chrome.storage.local.get(['clicksToSpin', 'enabled'], (settings) => {
    const error = chrome.runtime.lastError;
    if (error) {
      showStorageError(error);
      return;
    }
    const data = settings || {};
    clicksToSpin =
      Number.isSafeInteger(data.clicksToSpin) && data.clicksToSpin >= MIN_CLICKS && data.clicksToSpin <= MAX_CLICKS
        ? data.clicksToSpin
        : DEFAULT_CLICKS;
    enabled = data.enabled !== false;
    render();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const nextClicks = Number(clickInput.value);
    if (!Number.isSafeInteger(nextClicks) || nextClicks < MIN_CLICKS || nextClicks > MAX_CLICKS) {
      status.textContent = 'Kies een heel getal tussen 1 en 50.';
      clickInput.focus();
      return;
    }
    saveButton.disabled = true;
    saveSettings({ clicksToSpin: nextClicks }, () => {
      clicksToSpin = nextClicks;
      saveButton.disabled = false;
      status.textContent = `Opgeslagen. De volgende spin start na ${clicksToSpin} tikken.`;
      render();
    });
  });

  enabledInput.addEventListener('change', () => {
    const nextEnabled = enabledInput.checked;
    enabledInput.disabled = true;
    saveSettings({ enabled: nextEnabled }, () => {
      enabled = nextEnabled;
      enabledInput.disabled = false;
      status.textContent = enabled ? 'PuntKlik staat aan.' : 'PuntKlik staat uit.';
      render();
    });
  });

  resetButton.addEventListener('click', () => {
    if (resetButton.classList.contains('confirm')) {
      clearTimeout(confirmTimer);
      resetButton.classList.remove('confirm');
      resetButton.textContent = 'Punten opnieuw verstoppen';
      resetButton.disabled = true;
      saveSettings({ revealedV2: {} }, () => {
        resetButton.disabled = false;
        status.textContent = 'De punten zijn opnieuw verstopt. Coins blijven behouden.';
      });
      return;
    }

    resetButton.classList.add('confirm');
    resetButton.textContent = 'Klik nog eens om te bevestigen';
    confirmTimer = setTimeout(() => {
      resetButton.classList.remove('confirm');
      resetButton.textContent = 'Punten opnieuw verstoppen';
    }, 3500);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area && area !== 'local') return;
    if (changes.clicksToSpin) {
      const next = changes.clicksToSpin.newValue;
      clicksToSpin = Number.isSafeInteger(next) && next >= MIN_CLICKS && next <= MAX_CLICKS
        ? next
        : DEFAULT_CLICKS;
      render();
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      render();
    }
  });

})();
