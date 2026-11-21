(() => {
  'use strict';

  function isSafeLink(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const url = new URL(value.trim(), location.href);
      return (
        (url.protocol === 'https:' && !url.username && !url.password) ||
        (location.hostname === 'localhost' && url.protocol === 'http:' && url.origin === location.origin)
      );
    } catch {
      return false;
    }
  }

  async function applyContent() {
    const rows = await window.PuntKlikSiteAuth.request(
      '/rest/v1/site_content?select=content_key,content_value'
    );
    if (!Array.isArray(rows)) throw new Error('Supabase gaf geen geldige website-inhoud terug.');
    const values = new Map();
    rows.forEach((row) => {
      if (
        row &&
        typeof row.content_key === 'string' &&
        typeof row.content_value === 'string' &&
        row.content_value.length <= 2000
      ) {
        values.set(row.content_key, row.content_value);
      }
    });

    document.querySelectorAll('[data-site-content]').forEach((element) => {
      const value = values.get(element.dataset.siteContent);
      if (value !== undefined) element.textContent = value;
    });
    document.querySelectorAll('[data-site-link]').forEach((element) => {
      const value = values.get(element.dataset.siteLink);
      if (value === undefined) return;
      if (!isSafeLink(value)) {
        console.error(`Website-link "${element.dataset.siteLink}" is ongeldig en is niet toegepast.`);
        return;
      }
      element.setAttribute('href', value);
    });
  }

  window.PuntKlikSiteContent = Object.freeze({ isSafeLink, applyContent });
  void applyContent().catch((error) => {
    console.error('Website-inhoud kon niet worden bijgewerkt.', error);
  });
})();
