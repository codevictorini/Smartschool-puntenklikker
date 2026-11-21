(() => {
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#contact-status');
  const submitButton = form.querySelector('button[type="submit"]');
  const config = globalThis.PuntKlikSupabase;

  if (!config || !config.url || !config.publishableKey) {
    console.error('De Supabase-configuratie voor het contactformulier ontbreekt.');
    submitButton.disabled = true;
    status.textContent = 'Contact is tijdelijk niet beschikbaar.';
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      company: String(formData.get('company') || '').trim(),
    };

    submitButton.disabled = true;
    status.textContent = 'Bericht wordt verstuurd...';

    try {
      const response = await fetch(`${config.url}/functions/v1/contact-owner`, {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.publishableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        status.textContent = 'Je hebt net al een bericht verstuurd. Probeer het later opnieuw.';
        return;
      }
      if (!response.ok) throw new Error(`Contactfunctie antwoordde met status ${response.status}.`);

      form.reset();
      status.textContent = 'Bedankt! Je bericht is verstuurd.';
    } catch (error) {
      console.error('Het contactbericht kon niet worden verstuurd.', error);
      status.textContent = 'Versturen is niet gelukt. Probeer het later opnieuw.';
    } finally {
      submitButton.disabled = false;
    }
  });
})();
