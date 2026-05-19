const https = require('https');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const MAP = {
  'Logo_mininal_light_7ac82b3c-2279-4ce4-bff6-a2bc8cdf9c5f.png': { local: 'logo.png', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/Logo_mininal_light_7ac82b3c-2279-4ce4-bff6-a2bc8cdf9c5f.png?v=1668914062' },
  'favicon.png': { local: 'favicon.png', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/favicon.png' },
  'shutterstock_2183648381_8594fc46-f1bc-4b94-8c95-b0094a6722f3.jpg': { local: 'hero-home.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_2183648381_8594fc46-f1bc-4b94-8c95-b0094a6722f3.jpg?v=1669830340&width=1400' },
  'shutterstock_1935896365.jpg': { local: 'hero-security.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_1935896365.jpg?v=1669830403&width=1400' },
  'shutterstock_547272463.jpg': { local: 'about-service.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_547272463.jpg?v=1669832890&width=1000' },
  'shutterstock_496566607.jpg': { local: 'service-audiovisual.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_496566607.jpg?v=1669830879&width=1000' },
  'shutterstock_675102319.jpg': { local: 'service-smart-homes.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_675102319.jpg?v=1669831092&width=1000' },
  'shutterstock_721549570.jpg': { local: 'service-security.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_721549570.jpg?v=1669831181&width=1000' },
  'shutterstock_311303981.jpg': { local: 'service-networks.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_311303981.jpg?v=1669831346&width=900' },
  'shutterstock_1021312720.jpg': { local: 'service-wireless.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/shutterstock_1021312720.jpg?v=1669831414&width=900' },
  'WhatsApp_Image_2026-01-26_at_12.01.47_5_1200x.jpg': { local: 'gallery-theater-1.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/WhatsApp_Image_2026-01-26_at_12.01.47_5_1200x.jpg?v=1769455642' },
  'WhatsApp_Image_2025-09-13_at_15.14.50_1200x.jpg': { local: 'gallery-network-1.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/WhatsApp_Image_2025-09-13_at_15.14.50_1200x.jpg?v=1769457331' },
  '3BF3BB51-CD64-4B02-9538-3627531C117A_1_201_a_1200x.jpg': { local: 'gallery-theater-2.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/3BF3BB51-CD64-4B02-9538-3627531C117A_1_201_a_1200x.jpg?v=1769462302' },
  '60235C0D-5AC5-4261-B3FB-3DC352C1D6C9.jpg': { local: 'gallery-security-1.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/60235C0D-5AC5-4261-B3FB-3DC352C1D6C9.jpg?v=1769462498&width=2048' },
  'WhatsApp_Image_2026-01-26_at_12.01.46_1200x.jpg': { local: 'gallery-wiring-1.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/WhatsApp_Image_2026-01-26_at_12.01.46_1200x.jpg?v=1769455597' },
  '5360493423264513379_1200x.jpg': { local: 'gallery-smart-1.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/5360493423264513379_1200x.jpg?v=1769462609' },
  '1683680728038671265_1200x.jpg': { local: 'gallery-network-2.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/1683680728038671265_1200x.jpg?v=1769462644' },
  '5694658739303646542_1200x.jpg': { local: 'gallery-wiring-2.jpg', downloadUrl: 'https://cdn.shopify.com/s/files/1/0675/5568/8732/files/5694658739303646542_1200x.jpg?v=1769462687' },
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log('  cached:', path.basename(dest));
      return resolve();
    }
    const file = fs.createWriteStream(dest);
    const req = (u, depth) => {
      https.get(u, res => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (depth > 5) return reject(new Error('Too many redirects'));
          return req(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(dest, () => {});
          return reject(new Error('HTTP ' + res.statusCode));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', e => { file.close(); fs.unlink(dest, () => {}); reject(e); });
    };
    req(url, 0);
  });
}

async function run() {
  console.log('\n=== Downloading images ===');
  for (const [, { local, downloadUrl }] of Object.entries(MAP)) {
    const dest = 'uploads/' + local;
    process.stdout.write('  ' + local + ' ... ');
    try { await download(downloadUrl, dest); console.log('OK'); }
    catch(e) { console.log('FAILED:', e.message); }
  }

  console.log('\n=== Updating HTML files ===');
  const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));

  htmlFiles.forEach(file => {
    let html = fs.readFileSync(file, 'utf8');

    for (const [basename, { local }] of Object.entries(MAP)) {
      // Escape special regex chars in the filename
      const esc = basename.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      // Match full Shopify CDN URL for this file, including any ?query params
      const rx = new RegExp('https://cdn\\.shopify\\.com/s/files/[\\w/.%+@-]*' + esc + '[^"\'\\s<)]*', 'g');
      html = html.replace(rx, '/uploads/' + local);
    }

    // Restore logo src that was wiped by earlier broken script
    html = html.replace(
      /<img decoding="async" alt="Ravelo AV Tech" \/>/g,
      '<img decoding="async" src="/uploads/logo.png" alt="Ravelo AV Tech" />'
    );
    html = html.replace(
      /<img loading="lazy" decoding="async" alt="Ravelo AV Tech" \/>/g,
      '<img loading="lazy" decoding="async" src="/uploads/logo.png" alt="Ravelo AV Tech" />'
    );

    fs.writeFileSync(file, html, 'utf8');
    process.stdout.write('  ' + file);
    const remaining = (html.match(/cdn\.shopify\.com/g) || []).length;
    const logoOk = html.includes('src="/uploads/logo.png"');
    console.log(' — shopify_refs=' + remaining + ' logo=' + (logoOk ? 'OK' : 'MISSING'));
  });

  // Also update favicon link tags
  console.log('\n=== Checking file sizes ===');
  Object.values(MAP).forEach(({ local }) => {
    const p = 'uploads/' + local;
    if (fs.existsSync(p)) {
      const kb = Math.round(fs.statSync(p).size / 1024);
      console.log('  ' + local + ': ' + kb + ' KB');
    } else {
      console.log('  ' + local + ': MISSING');
    }
  });
}

run().catch(console.error);
