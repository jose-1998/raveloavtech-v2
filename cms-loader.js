(async function () {
  try {
    const r = await fetch('/images.json');
    if (!r.ok) return;
    const data = await r.json();

    // Gallery on home page (only dynamic content managed by CMS)
    const gc = document.getElementById('gallery-container');
    if (gc && Array.isArray(data.gallery) && data.gallery.length) {
      gc.innerHTML = data.gallery
        .map(item => {
          const url      = typeof item === 'string' ? item : item.url;
          const category = item.category || 'av';
          const categoryLabels = { av: 'Home Theater', network: 'Networks', security: 'Security', smart: 'Smart Home', wiring: 'Wiring', lowvoltage: 'Low Voltage', lutron: 'Lutron' };
          const label    = item.label || categoryLabels[category] || category;
          return `<div class="gal-item" data-category="${category}">` +
            `<img src="${url}" alt="${label}" onerror="this.closest('.gal-item').remove()" />` +
            `<div class="gal-overlay"><span>${label}</span></div>` +
            `</div>`;
        })
        .join('');
      // Reinit carousel with updated photos
      if (typeof window.initGalleryCarousel === 'function') window.initGalleryCarousel();
    }
  } catch (_) {}
})();
