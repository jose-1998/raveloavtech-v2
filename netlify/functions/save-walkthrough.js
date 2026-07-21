// save-walkthrough.js
// Saves a site walkthrough to Netlify Blobs and emails a summary to the team.
// Protected by Netlify Identity JWT.

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const FROM = 'Ravelo AV Tech <support@raveloavtech.com>';
const TO   = ['jose.rojas@raveloavtech.com', 'gaven.certeza@raveloavtech.com']; // 'support@raveloavtech.com' — add back when ready

const TYPE_LABELS = { cameras: 'Security Cameras', network: 'Network', av: 'Audio / Visual' };
const TYPE_ICONS  = { cameras: '📷', network: '🌐', av: '📺' };

// Full checklist structure (mirrors admin/walkthrough.html)
const CHECKLISTS = {
  cameras: {
    sections: [
      { title: 'Camera Locations', items: [
        { id: 'cam-num',      type: 'field', label: 'Number of cameras' },
        { id: 'cam-indoor',   label: 'Indoor camera positions marked' },
        { id: 'cam-outdoor',  label: 'Outdoor camera positions marked' },
        { id: 'cam-fov',      label: 'Field of view verified at each location' },
        { id: 'cam-lighting', label: 'Lighting conditions assessed' },
      ]},
      { title: 'Mounting & Cabling', items: [
        { id: 'cam-attic',    label: 'Attic access available' },
        { id: 'cam-crawl',    label: 'Crawl space accessible' },
        { id: 'cam-surface',  label: 'Mounting surface identified at each point' },
        { id: 'cam-power',    label: 'Power outlet accessible near each camera' },
        { id: 'cam-routing',  label: 'Cable routing path mapped from camera to NVR' },
        { id: 'cam-existing', label: 'Existing cable runs checked and labeled' },
        { id: 'cam-distance', label: 'Max cable run distance measured' },
      ]},
      { title: 'Recorder (NVR / DVR)', items: [
        { id: 'nvr-location', label: 'NVR/DVR location confirmed' },
        { id: 'nvr-power',    label: 'Power outlet at NVR location' },
        { id: 'nvr-network',  label: 'Network / internet access at NVR' },
        { id: 'nvr-monitor',  label: 'Monitor or TV for local view decided' },
        { id: 'nvr-storage',  label: 'Storage size / retention days confirmed' },
      ]},
      { title: 'Client Requirements', items: [
        { id: 'cam-app',       label: 'Mobile app access needed' },
        { id: 'cam-alerts',    label: 'Motion zone alerts configured' },
        { id: 'cam-existing2', label: 'Client has existing system to integrate or replace' },
        { id: 'cam-photos',    label: 'Photos taken of all camera locations' },
      ]},
    ]
  },
  network: {
    sections: [
      { title: 'ISP & Core', items: [
        { id: 'net-isp',    label: 'ISP modem / ONT location marked' },
        { id: 'net-speed',  label: 'Internet speed confirmed with client' },
        { id: 'net-router', label: 'Main router location decided' },
        { id: 'net-panel',  label: 'Structured media center or closet identified' },
        { id: 'net-coax',   label: 'Existing coax or Ethernet runs noted' },
      ]},
      { title: 'Wired Drops', items: [
        { id: 'net-drops',   label: 'Rooms needing Ethernet drops listed' },
        { id: 'net-routing', label: 'Cable routing path planned per room' },
        { id: 'net-switch',  label: 'Switch location and rack space confirmed' },
        { id: 'net-poe',     label: 'PoE switch needed' },
      ]},
      { title: 'Wireless Coverage', items: [
        { id: 'net-dead',     label: 'Dead zones identified and walked' },
        { id: 'net-aps',      label: 'Number of access points determined' },
        { id: 'net-apmount',  label: 'AP mounting locations confirmed' },
        { id: 'net-backhaul', label: 'Wired backhaul to each AP possible' },
      ]},
      { title: 'Protection & Finish', items: [
        { id: 'net-ups',    label: 'UPS / battery backup for router + modem' },
        { id: 'net-surge',  label: 'Surge protection at main panel location' },
        { id: 'net-label',  label: 'Labeling plan for all drops and ports' },
        { id: 'net-photos', label: 'Photos taken of key infrastructure locations' },
      ]},
    ]
  },
  av: {
    sections: [
      { title: 'Displays & Mounting', items: [
        { id: 'av-tvloc',    label: 'TV / display locations confirmed' },
        { id: 'av-tvsize',   label: 'TV sizes agreed — wall space measured' },
        { id: 'av-walltype', label: 'Wall type at each mount' },
        { id: 'av-studs',    label: 'Stud locations found — blocking needed?' },
        { id: 'av-height',   label: 'Viewing height and angle confirmed with client' },
        { id: 'av-outlet',   label: 'Power outlet behind or near each TV' },
      ]},
      { title: 'Audio', items: [
        { id: 'av-soundbar',  label: 'Soundbar location and clearance confirmed' },
        { id: 'av-speakers',  label: 'In-ceiling / in-wall speaker positions marked' },
        { id: 'av-ceiling',   label: 'Ceiling type confirmed at each speaker location' },
        { id: 'av-attic',     label: 'Attic access available for speaker wire routing' },
        { id: 'av-spksurf',   label: 'Mounting surface confirmed at each speaker' },
        { id: 'av-spksize',   type: 'field', label: 'Speaker size' },
        { id: 'av-amp',       label: 'Receiver / amplifier location decided' },
        { id: 'av-subwoofer', label: 'Subwoofer placement confirmed' },
        { id: 'av-zones',     label: 'Multi-zone audio areas noted' },
      ]},
      { title: 'Sources & Cabling', items: [
        { id: 'av-sources',  label: 'HDMI sources listed' },
        { id: 'av-inwall',   label: 'In-wall cable routing possible' },
        { id: 'av-raceway',  label: 'Surface raceway acceptable where in-wall not possible' },
        { id: 'av-hdmirun',  label: 'HDMI run length noted' },
      ]},
      { title: 'Control & Finish', items: [
        { id: 'av-rackloc',   type: 'field', label: 'Rack / closet location' },
        { id: 'av-rackpower', label: 'Power available at rack / closet location' },
        { id: 'av-rack',      label: 'Rack size and ventilation confirmed' },
        { id: 'av-remote',    label: 'Universal remote or smart home control decided' },
        { id: 'av-existing',  label: 'Existing equipment inventoried' },
        { id: 'av-photos',    label: 'Photos taken of all TV walls and equipment areas' },
      ]},
    ]
  }
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  // Auth
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const SITE_URL   = process.env.URL || 'https://raveloavtech.com';
  const authed     = await validateJWT(authHeader, SITE_URL);
  if (!authed) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { clientName, jobAddress, type, checks, fields, item_notes = {}, notes, photos = [] } = body;
  const typeLabel = TYPE_LABELS[type] || type;
  const typeIcon  = TYPE_ICONS[type]  || '🔧';
  const savedAt   = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short'
  });

  // Save to Blobs as a record
  try {
    const store = getStore({ name: 'walkthroughs', consistency: 'strong', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_API_TOKEN });
    const key   = `walkthrough-${Date.now()}`;
    await store.setJSON(key, { clientName, jobAddress, type, checks, fields, item_notes, notes, photoCount: photos.length, savedAt });
  } catch (e) {
    console.warn('Blob save failed:', e.message);
  }

  // Build email with photos as attachments
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const html    = buildEmailHTML({ clientName, jobAddress, type, typeLabel, typeIcon, checks, fields, item_notes, notes, savedAt, photos });
    const subject = `${typeIcon} Walkthrough — ${clientName || 'Unknown client'}${jobAddress ? ' · ' + jobAddress : ''}`;

    // Convert base64 data URLs to Resend attachment format
    // photos is [{data, section}, ...] keyed by section
    const sectionCounters = {};
    const attachments = photos.map(function (p) {
      const sec = (p.section || 'photo').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      sectionCounters[sec] = (sectionCounters[sec] || 0) + 1;
      const base64 = (p.data || p).replace(/^data:image\/\w+;base64,/, '');
      return { filename: `${sec}-${sectionCounters[sec]}.jpg`, content: base64 };
    });

    const payload = { from: FROM, to: TO, subject, html };
    if (attachments.length) payload.attachments = attachments;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error('Resend error:', await res.text());
  }

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};

function buildEmailHTML({ clientName, jobAddress, type, typeLabel, typeIcon, checks, fields, item_notes = {}, notes, savedAt, photos = [] }) {
  const photoCount = photos.length;
  // Build section → count map for display
  const photosBySec = {};
  photos.forEach(function (p) { const s = p.section || 'General'; photosBySec[s] = (photosBySec[s] || 0) + 1; });
  const cl = CHECKLISTS[type];
  if (!cl) return '<p>Unknown job type</p>';

  const sectionRows = cl.sections.map(sec => {
    const itemRows = sec.items.map(item => {
      if (item.type === 'field') {
        const val = (fields && fields[item.id]) || '—';
        return `<tr>
          <td style="padding:7px 0;font-size:13px;color:#888;padding-right:12px;white-space:nowrap;">📝</td>
          <td style="padding:7px 0;font-size:14px;color:#222;">${item.label}: <strong>${val}</strong></td>
        </tr>`;
      }
      const done = checks && checks[item.id];
      if (!done) return '';
      const itemNote = item_notes && item_notes[item.id] ? item_notes[item.id].trim() : '';
      return `<tr>
        <td style="padding:5px 0;font-size:13px;padding-right:12px;vertical-align:top;">✅</td>
        <td style="padding:5px 0;font-size:14px;color:#222;">
          ${item.label}
          ${itemNote ? `<div style="font-size:12px;color:#666;margin-top:2px;font-style:italic;">${itemNote}</div>` : ''}
        </td>
      </tr>`;
    }).join('');

    const hasContent = sec.items.some(i => i.type === 'field' || (checks && checks[i.id]));
    if (!hasContent) return '';

    return `
      <p style="margin:20px 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#82A0CC;">${sec.title}</p>
      <table style="border-collapse:collapse;width:100%;">${itemRows}</table>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#eef1f4;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto 60px;">

  <div style="background:#072b3e;padding:32px 40px 28px;border-radius:4px 4px 0 0;">
    <p style="margin:0 0 12px;color:#82A0CC;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">
      Ravelo AV Tech — Site Walkthrough
    </p>
    <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-weight:700;">
      ${typeIcon} ${typeLabel}
    </h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.45);font-size:12px;">${savedAt} (CT)</p>
  </div>

  <div style="background:#fff;padding:32px 40px;">
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px;">
      ${clientName ? `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:9px 16px 9px 0;color:#888;width:90px;">Client</td>
        <td style="padding:9px 0;color:#111;font-weight:700;">${clientName}</td>
      </tr>` : ''}
      ${jobAddress ? `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:9px 16px 9px 0;color:#888;">Location</td>
        <td style="padding:9px 0;color:#222;">${jobAddress}</td>
      </tr>` : ''}
    </table>

    ${sectionRows || '<p style="color:#888;font-size:14px;">No items checked.</p>'}

    ${notes ? `
    <div style="margin-top:24px;padding:16px 18px;background:#f7f9fc;border-left:3px solid #82A0CC;border-radius:3px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#82A0CC;">Field Notes</p>
      <p style="margin:0;font-size:14px;color:#444;white-space:pre-wrap;line-height:1.6;">${notes}</p>
    </div>` : ''}

    ${photoCount ? `
    <div style="margin-top:20px;padding:14px 18px;background:#f0f9f4;border-left:3px solid #34c759;border-radius:3px;">
      <p style="margin:0 0 6px;font-size:13px;color:#1a7a3a;font-weight:700;">
        📷 ${photoCount} photo${photoCount > 1 ? 's' : ''} attached
      </p>
      ${Object.keys(photosBySec).map(s => `<p style="margin:2px 0;font-size:12px;color:#2a6a3a;">· ${s} — ${photosBySec[s]}</p>`).join('')}
    </div>` : ''}
  </div>

  <div style="background:#072b3e;padding:18px 40px;border-radius:0 0 4px 4px;">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">
      Ravelo AV Technologies LLC · raveloavtech.com
    </p>
  </div>
</div>
</body></html>`;
}

async function validateJWT(authHeader, siteUrl) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  try {
    const res = await fetch(`${siteUrl}/.netlify/identity/user`, { headers: { Authorization: authHeader } });
    return res.ok;
  } catch { return false; }
}
