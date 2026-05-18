(async function () {
  try {
    const r = await fetch('/images.json?_=' + Date.now());
    if (!r.ok) return;
    const data = await r.json();
    const path = location.pathname;

    // Gallery on home page
    const gc = document.getElementById('gallery-container');
    if (gc && Array.isArray(data.gallery) && data.gallery.length) {
      gc.innerHTML = data.gallery
        .map(item => {
          const url      = typeof item === 'string' ? item : item.url;
          const category = item.category || 'av';
          const label    = item.label    || 'Install';
          return `<div class="gal-item" data-category="${category}">` +
            `<img src="${url}" alt="${label}" loading="lazy" />` +
            `<div class="gal-overlay"><span>${label}</span></div>` +
            `</div>`;
        })
        .join('');
    }

    // About page hero photo
    const aboutImg = document.querySelector('.about-right-img img');
    if (aboutImg && data.about_hero) aboutImg.src = data.about_hero;

    // Service pages
    const heroImg = document.querySelector('.page-hero-bg img');
    const asideImg = document.querySelector('.aside-img img');
    const pageMap = {
      'audiovisual':       ['audiovisual_hero',  'audiovisual_aside'],
      'smart-homes':       ['smart_homes_hero',  'smart_homes_aside'],
      'security-systems':  ['security_hero',     'security_aside'],
      'soho-networks':     ['soho_hero',         'soho_aside'],
      'wireless-network':  ['wireless_hero',     'wireless_aside'],
      'lutron':            ['lutron_hero',        'lutron_aside'],
      'wiring':            ['wiring_hero',        'wiring_aside'],
      'low-voltage':       ['low_voltage_hero',   'low_voltage_aside'],
    };
    for (const [slug, [hk, ak]] of Object.entries(pageMap)) {
      if (path.includes(slug)) {
        if (heroImg && data[hk])  heroImg.src  = data[hk];
        if (asideImg && data[ak]) asideImg.src = data[ak];
        break;
      }
    }
  } catch (_) {}
})();
