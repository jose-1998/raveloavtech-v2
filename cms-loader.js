(async function () {
  try {
    const r = await fetch('/images.json');
    if (!r.ok) return; // keep hardcoded fallback

    const data = await r.json();
    const gc = document.getElementById('gallery-container');
    if (!gc || !Array.isArray(data.gallery) || !data.gallery.length) return;

    const categoryLabels = {
      av: 'Home Theater', network: 'Networks', security: 'Security',
      smart: 'Smart Home', wiring: 'Wiring', lowvoltage: 'Low Voltage', lutron: 'Lutron'
    };

    // Preload every image — only keep the ones that actually load
    const validItems = await Promise.all(
      data.gallery.map(item => {
        const url      = typeof item === 'string' ? item : item.url;
        const category = item.category || 'av';
        const label    = item.label || categoryLabels[category] || category;
        return new Promise(resolve => {
          const img = new Image();
          img.onload  = () => resolve({ url, category, label });
          img.onerror = () => resolve(null); // skip broken images silently
          img.src = url;
        });
      })
    );

    const items = validItems.filter(Boolean);
    if (!items.length) return; // all broken → keep hardcoded fallback

    gc.innerHTML = items
      .map(({ url, category, label }) =>
        `<div class="gal-item" data-category="${category}">` +
          `<img src="${url}" alt="${label}" />` +
          `<div class="gal-overlay"><span>${label}</span></div>` +
        `</div>`
      )
      .join('');

    if (typeof window.initGalleryCarousel === 'function') window.initGalleryCarousel();
  } catch (_) {} // any error → hardcoded fallback stays
})();
