// Kör med: node scripts/hitta-dubletter.js          → visar rapport
// Kör med: node scripts/hitta-dubletter.js --fixa   → tar automatiskt bort dubbletter och sparar pizzor.json

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'pizzor.json');
const raw = fs.readFileSync(dataPath, 'utf8').replace(/^\uFEFF/, '');
const pizzor = JSON.parse(raw);

// Bygg en exakt radnummer-karta: "pizzeria|||pizza_namn" -> radnummer
const rader = raw.split('\n');
const radIndex = {};
let nuvarandePizzeria = null;
let nuvarandePizzaNamn = null;
let postStartRad = null;
rader.forEach((rad, i) => {
    const radnr = i + 1;
    if (rad.includes('"pizzeria"')) {
        const m = rad.match(/"pizzeria"\s*:\s*"(.+?)"/);
        if (m) { nuvarandePizzeria = m[1]; postStartRad = radnr; }
    }
    if (rad.includes('"pizza_namn"')) {
        const m = rad.match(/"pizza_namn"\s*:\s*"(.+?)"/);
        if (m) {
            nuvarandePizzaNamn = m[1];
            const key = nuvarandePizzeria + '|||' + nuvarandePizzaNamn;
            if (!radIndex[key]) radIndex[key] = [];
            radIndex[key].push(postStartRad || radnr);
        }
    }
});

function norm(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Gruppera per pizzeria
const perPizzeria = {};
pizzor.forEach((p, index) => {
    const key = norm(p.pizzeria);
    if (!perPizzeria[key]) perPizzeria[key] = { namn: p.pizzeria, rätter: [] };
    perPizzeria[key].rätter.push({ namn: p.pizza_namn, pris: p.pris, index });
});

let totalDubbletter = 0;
let pizzeriorMedDubbletter = 0;

const resultat = [];

Object.values(perPizzeria).forEach(({ namn, rätter }) => {
    const räknare = {};
    rätter.forEach(r => {
        const n = norm(r.namn);
        if (!räknare[n]) räknare[n] = [];
        räknare[n].push(r);
    });

    const dubbletter = Object.entries(räknare).filter(([, arr]) => arr.length > 1);
    if (dubbletter.length === 0) return;

    pizzeriorMedDubbletter++;
    totalDubbletter += dubbletter.reduce((s, [, arr]) => s + arr.length - 1, 0);
    resultat.push({ pizzeria: namn, dubbletter });
});

if (resultat.length === 0) {
    console.log('\n✅ Inga dubbletter hittades!\n');
    // Skriv ändå en uppdaterad rapport så tidsstämpeln stämmer
    const ingenHtml = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><title>Dubbletter – pizzor.json</title>
<style>body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#222;margin:0;padding:24px;}h1{font-size:1.4rem;margin-bottom:4px;}.meta{color:#666;font-size:.9rem;margin-bottom:24px;}.ok{background:#e8fbe8;border:1px solid #66bb6a;border-radius:8px;padding:24px;font-size:1rem;}.guide{background:#e8f4fd;border:1px solid #90caf9;border-radius:8px;padding:18px 24px;margin-top:24px;font-size:.92rem;line-height:1.7;}.guide h2{font-size:1rem;margin:0 0 10px;color:#1565c0;}.guide code{background:#dbeafe;padding:1px 5px;border-radius:3px;font-size:.88rem;}.guide ul{margin:6px 0 0;padding-left:20px;}.guide li{margin-bottom:4px;}</style>
</head>
<body>
<h1>🔍 Dubbletter i pizzor.json</h1>
<p class="meta">Genererad: ${new Date().toLocaleString('sv-SE')}</p>
<div class="ok">✅ <strong>Inga dubbletter hittades!</strong> Allt ser bra ut.</div>
<div class="guide">
  <h2>📖 Hur uppdaterar du den här rapporten?</h2>
  <ul>
    <li>Öppna en terminal i VS Code: <strong>Terminal → New Terminal</strong> (eller <code>Ctrl+ö</code>).</li>
    <li>Kör: <code>node scripts/hitta-dubletter.js</code></li>
    <li>Öppna sedan den här filen igen i webbläsaren — den är nu uppdaterad.</li>
  </ul>
</div>
</body></html>`;
    fs.writeFileSync(path.join(__dirname, 'dubletter-rapport.html'), ingenHtml, 'utf8');
    console.log('📄 Rapport uppdaterad: scripts/dubletter-rapport.html\n');
    process.exit(0);
}

console.log(`\n🔍 Dubbletter i pizzor.json`);
console.log(`${'='.repeat(50)}`);
console.log(`Pizzerior med dubbletter : ${pizzeriorMedDubbletter}`);
console.log(`Totalt extra poster      : ${totalDubbletter}`);
console.log(`${'='.repeat(50)}\n`);

resultat.forEach(({ pizzeria, dubbletter }) => {
    console.log(`📍 ${pizzeria}`);
    dubbletter.forEach(([, kopior]) => {
        const visaNamn = kopior[0].namn;
        const key = pizzeria + '|||' + visaNamn;
        const raderForPost = radIndex[key] || kopior.map(k => `~${k.index * 13}`);
        const priser = kopior.map((k, i) => `${k.pris} kr  (rad ${raderForPost[i] || '?'})`).join('  |  ');
        console.log(`   ⚠  "${visaNamn}"  ×${kopior.length}  →  ${priser}`);
    });
    console.log('');
});

// --- Skapa HTML-rapport ---
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let htmlRader = '';
resultat.forEach(({ pizzeria, dubbletter }) => {
    let rätterHtml = '';
    dubbletter.forEach(([, kopior]) => {
        const visaNamn = kopior[0].namn;
        const key = pizzeria + '|||' + visaNamn;
        const raderForPost = radIndex[key] || kopior.map(k => `~${k.index * 13}`);
        const kopiorHtml = kopior.map((k, i) => {
            return `<div class="kopia"><span class="pris">${escHtml(k.pris)} kr</span> <span class="rad">rad ${raderForPost[i] || '?'}</span></div>`;
        }).join('');
        rätterHtml += `<tr><td class="pizzanamn">${escHtml(visaNamn)}</td><td>${kopiorHtml}</td></tr>`;
    });
    htmlRader += `
    <section>
      <h2>${escHtml(pizzeria)} <span class="badge">${dubbletter.length} dubblett${dubbletter.length > 1 ? 'er' : ''}</span></h2>
      <table><thead><tr><th>Pizzanamn</th><th>Kopior</th></tr></thead><tbody>${rätterHtml}</tbody></table>
    </section>`;
});

const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>Dubbletter – pizzor.json</title>
<style>
  body { font-family: system-ui, sans-serif; background:#f5f5f5; color:#222; margin:0; padding:24px; }
  h1 { font-size:1.4rem; margin-bottom:4px; }
  .meta { color:#666; font-size:.9rem; margin-bottom:16px; }
  .guide { background:#e8f4fd; border:1px solid #90caf9; border-radius:8px; padding:18px 24px; margin-bottom:24px; font-size:.92rem; line-height:1.7; }
  .guide h2 { font-size:1rem; margin:0 0 10px; color:#1565c0; }
  .guide p { margin:0 0 8px; }
  .guide ul { margin:6px 0 0 0; padding-left:20px; }
  .guide li { margin-bottom:4px; }
  .guide code { background:#dbeafe; padding:1px 5px; border-radius:3px; font-size:.88rem; }
  .fixa-box { background:#e8fbe8; border:1px solid #66bb6a; border-radius:8px; padding:18px 24px; margin-bottom:24px; }
  .fixa-box h2 { font-size:1rem; margin:0 0 10px; color:#2e7d32; }
  .fixa-box p { margin:0 0 10px; font-size:.92rem; }
  .cmd { display:flex; align-items:center; gap:10px; background:#1e1e1e; color:#d4d4d4; padding:10px 16px; border-radius:6px; font-family:monospace; font-size:.95rem; }
  .kopiera-btn { margin-left:auto; background:#66bb6a; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; font-size:.82rem; white-space:nowrap; }
  .kopiera-btn:hover { background:#43a047; }
  .varning { font-size:.82rem; color:#555; margin-top:8px !important; }
  section { background:#fff; border-radius:8px; padding:20px 24px; margin-bottom:20px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
  h2 { font-size:1.1rem; margin:0 0 12px; display:flex; align-items:center; gap:10px; }
  .badge { background:#e74c3c; color:#fff; font-size:.75rem; padding:2px 8px; border-radius:20px; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:.9rem; }
  th { text-align:left; padding:6px 10px; background:#f0f0f0; border-bottom:2px solid #ddd; }
  td { padding:6px 10px; border-bottom:1px solid #eee; vertical-align:top; }
  .pizzanamn { font-weight:600; white-space:nowrap; }
  .kopia { margin-bottom:4px; }
  .pris { font-weight:600; color:#2a9d8f; }
  .rad { color:#999; font-size:.8rem; margin-left:8px; }
  .summary { background:#fff3cd; border:1px solid #ffc107; border-radius:8px; padding:14px 20px; margin-bottom:24px; font-size:.95rem; }
</style>
</head>
<body>
<h1>🔍 Dubbletter i pizzor.json</h1>
<p class="meta">Genererad: ${new Date().toLocaleString('sv-SE')}</p>

<div class="guide">
  <h2>📖 Vad är det här och hur använder du det?</h2>
  <p><strong>Vad sidan gör:</strong> Den här rapporten visar alla pizza-poster i <code>data/pizzor.json</code> där samma <code>pizza_namn</code> förekommer mer än en gång inom samma pizzeria. Det kan bero på att data skrapats eller lagts in dubbelt av misstag.</p>
  <p><strong>Vad du ska leta efter:</strong> Varje rad i tabellen är ett pizzanamn som finns i duplicat. Du ser priset på varje kopia — om priserna är identiska är det troligen en ren dubblett som kan tas bort. Om priserna skiljer sig kan det vara en uppdatering där en gammal post glömts kvar.</p>
  <p><strong>Så här hittar du och tar bort en dubblett manuellt i VS Code:</strong></p>
  <ul>
    <li>Öppna filen <code>data/pizzor.json</code> i VS Code.</li>
    <li>Tryck <code>Ctrl+G</code>, skriv radnumret från rapporten och tryck Enter — du hoppar direkt dit.</li>
    <li>Markera hela posten (från <code>{</code> till <code>},</code>) och radera den.</li>
    <li>Spara filen med <code>Ctrl+S</code>.</li>
  </ul>
  <p><strong>Så här uppdaterar du den här rapporten:</strong></p>
  <ul>
    <li>Öppna en terminal i VS Code: <strong>Terminal → New Terminal</strong> (eller <code>Ctrl+ö</code>).</li>
    <li>Kör kommandot: <code>node scripts/hitta-dubletter.js</code></li>
    <li>Öppna sedan den här filen igen i webbläsaren — den är nu uppdaterad med nya resultat.</li>
    <li>Om det inte finns några dubbletter kvar visas ett grönt meddelande.</li>
  </ul>
</div>

<div class="fixa-box">
  <h2>🗑️ Ta bort alla dubbletter automatiskt</h2>
  <p>Kör kommandot nedan i terminalen i VS Code (<strong>Terminal → New Terminal</strong>). Scriptet behåller den <em>första</em> förekomsten av varje pizza och tar bort resten. En backup av pizzor.json skapas automatiskt om du vill ångra.</p>
  <div class="cmd">
    <span id="cmd-text">node scripts/hitta-dubletter.js --fixa</span>
    <button class="kopiera-btn" onclick="kopiera()">📋 Kopiera</button>
  </div>
  <p class="varning">⚠️ Kör sedan <code>node scripts/hitta-dubletter.js</code> igen för att uppdatera den här rapporten.</p>
</div>
<script>
function kopiera() {
  navigator.clipboard.writeText(document.getElementById('cmd-text').textContent).then(() => {
    const btn = document.querySelector('.kopiera-btn');
    btn.textContent = '✅ Kopierat!';
    setTimeout(() => btn.textContent = '📋 Kopiera', 2000);
  });
}
</script>

<div class="summary">
  <strong>${pizzeriorMedDubbletter}</strong> pizzerior har dubbletter &nbsp;·&nbsp;
  <strong>${totalDubbletter}</strong> extra poster totalt
</div>
${htmlRader}
</body>
</html>`;

const rapportPath = path.join(__dirname, 'dubletter-rapport.html');
fs.writeFileSync(rapportPath, html, 'utf8');
console.log(`\n📄 Rapport sparad: scripts/dubletter-rapport.html\n`);

// --- --fixa: ta bort dubbletter automatiskt ---
if (process.argv.includes('--fixa')) {
    const indexattTaBort = new Set();
    resultat.forEach(({ pizzeria, dubbletter }) => {
        dubbletter.forEach(([, kopior]) => {
            // Behåll första förekomsten, markera resten för borttagning
            kopior.slice(1).forEach(k => indexattTaBort.add(k.index));
        });
    });
    const rensad = pizzor.filter((_, i) => !indexattTaBort.has(i));
    const borttagna = pizzor.length - rensad.length;
    // Gör backup först
    const backupPath = dataPath + '.backup-' + Date.now() + '.json';
    fs.writeFileSync(backupPath, raw, 'utf8');
    fs.writeFileSync(dataPath, JSON.stringify(rensad, null, 2), 'utf8');
    console.log(`✅ Klart! Tog bort ${borttagna} dubbletter.`);
    console.log(`💾 Backup sparad: ${path.basename(backupPath)}`);
    console.log(`   (ligger i data/-mappen om du vill ångra)\n`);
}
