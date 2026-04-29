(function initAiLage() {
  const chatLog = document.getElementById('ai-chat-log');
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  if (!chatLog || !form || !input) return;

  const KNOWLEDGE_CACHE_KEY = 'bp.siteKnowledge.v4';
  const KNOWLEDGE_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
  const COORD_CACHE_KEY = 'bp.addressCoords.v1';

  // Controlled source list: predictable, fast, and easier to validate.
  const KNOWLEDGE_PATHS = [
    '/index.html',
    '/faq.html',
    '/om-oss.html',
    '/integritetspolicy.html',
    '/pizzerior.html',
    '/pizzerior/bella-ciao-pizzeria-lindome.html',
    '/pizzerior/hempizza.html',
    '/pizzerior/kallereds-pizzeria.html',
    '/pizzerior/kebnekaise.html',
    '/pizzerior/nisses-pizzeria.html',
    '/pizzerior/pizza4you.html',
    '/pizzerior/pizzeria-druvan.html',
    '/pizzerior/pizzeria.html',
    '/pizzerior/restaurang-perla.html'
  ];

  const state = {
    allaPizzor: [],
    docs: [],
    ready: false
  };

  let messageQueue = Promise.resolve();
  let geocodeQueue = Promise.resolve();
  const pendingCoordLookups = new Map();

  let anvandarPosition = null;
  const GOOGLE_MAPS_SOK_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';

  // Samma koordinatunderlag som index-sidan for "Narmast mig".
  const ADRESS_COORDS = {
    'Konditorivagen 1, 437 33 Lindome': { lat: 57.5797, lng: 12.0742 },
    'Gamla riksvagen 38, 428 32 Kallered': { lat: 57.6110, lng: 12.0509 },
    'Gamla riksvagen 4, 428 32 Kallered': { lat: 57.6122, lng: 12.0492 },
    'Hagabacksleden 9, 428 32 Kallered': { lat: 57.6102, lng: 12.0540 },
    'Krokslatts Parkgata 57, 431 68 Molndal': { lat: 57.6787, lng: 11.9955 },
    'Almasgangen 1, 437 30 Lindome': { lat: 57.5776, lng: 12.0685 },
    'Gamla riksvagen 54, 428 30 Kallered': { lat: 57.6089, lng: 12.0526 }
  };

  const norm = (v) => String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const esc = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  function tokenize(v) {
    const stop = new Set(['och', 'att', 'det', 'som', 'for', 'med', 'till', 'hur', 'vad', 'vart', 'var', 'en', 'ett', 'den', 'det', 'de', 'av', 'pa', 'om', 'i', 'ni', 'er', 'oss']);
    return norm(v)
      .split(' ')
      .filter((t) => t.length >= 3 && !stop.has(t));
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    const out = [];
    items.forEach((x) => {
      const k = keyFn(x);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(x);
      }
    });
    return out;
  }

  function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function containsPhrase(haystackNorm, phraseNorm) {
    const cleanPhrase = norm(phraseNorm);
    if (!cleanPhrase) return false;
    const pattern = cleanPhrase
      .split(' ')
      .filter(Boolean)
      .map((part) => escapeRegex(part))
      .join('\\s+');
    const re = new RegExp(`(^|\\s)${pattern}(?=$|\\s)`);
    return re.test(norm(haystackNorm));
  }

  function normalizeQuestionForIntent(value) {
    let q = norm(value);

    // Common misspellings so plural pizza queries still trigger correctly.
    const typoFixes = [
      [/\bpuzzor\b/g, 'pizzor'],
      [/\bpizzir\b/g, 'pizzor'],
      [/\bpizor\b/g, 'pizzor'],
      [/\bpizzar\b/g, 'pizzor'],
      [/\bpizorna\b/g, 'pizzorna'],
      [/\bpizsa\b/g, 'pizza'],
      [/\bpizsor\b/g, 'pizzor']
    ];

    typoFixes.forEach(([re, replacement]) => {
      q = q.replace(re, replacement);
    });

    // Short-name aliases for common pizzeria mentions.
    q = q.replace(/\bnisse\b/g, 'nisses pizzeria');
    q = q.replace(/\bnisses\b/g, 'nisses pizzeria');

    return q;
  }

  function formatKr(n) {
    const rounded = Math.round(Number(n) || 0);
    const grouped = new Intl.NumberFormat('sv-SE', {
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(rounded).replace(/[\u00A0\u202F]/g, ' ');
    return `${grouped} kr`;
  }

  function skapaGoogleMapsSokLank(namn, adress) {
    return `${GOOGLE_MAPS_SOK_BASE_URL}${encodeURIComponent(`${namn || ''}, ${adress || ''}`)}`;
  }

  function getStaticCoordsForAdress(adress) {
    if (!adress) return null;
    const direkte = ADRESS_COORDS[adress];
    if (direkte) return direkte;

    const normaliseradAdress = norm(adress);
    const key = Object.keys(ADRESS_COORDS).find((k) => norm(k) === normaliseradAdress);
    return key ? ADRESS_COORDS[key] : null;
  }

  function calculateDistance(lat1, lng1, lat2, lng2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function readCoordCache() {
    try {
      const raw = localStorage.getItem(COORD_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed;
    } catch {
      return {};
    }
  }

  function writeCoordCache(cacheObj) {
    try {
      localStorage.setItem(COORD_CACHE_KEY, JSON.stringify(cacheObj));
    } catch {
      // Ignore storage errors.
    }
  }

  async function geocodeAdress(adress) {
    const query = `${adress}, Sweden`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept-Language': 'sv' }
    });
    if (!response.ok) return null;

    const results = await response.json();
    if (!Array.isArray(results) || !results[0]) return null;
    const lat = Number(results[0].lat);
    const lng = Number(results[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  function resolveCoordsForAdress(adress) {
    if (!adress) return Promise.resolve(null);

    const staticCoords = getStaticCoordsForAdress(adress);
    if (staticCoords) return Promise.resolve(staticCoords);

    const key = norm(adress);
    const cache = readCoordCache();
    if (cache[key] && Number.isFinite(cache[key].lat) && Number.isFinite(cache[key].lng)) {
      return Promise.resolve(cache[key]);
    }

    if (pendingCoordLookups.has(key)) {
      return pendingCoordLookups.get(key);
    }

    const lookupPromise = (async () => {
      const result = await (geocodeQueue = geocodeQueue.then(async () => {
        const hit = await geocodeAdress(adress).catch(() => null);
        await delay(900);
        return hit;
      }));

      if (result) {
        const nextCache = readCoordCache();
        nextCache[key] = result;
        writeCoordCache(nextCache);
      }

      return result;
    })();

    pendingCoordLookups.set(key, lookupPromise);
    return lookupPromise.finally(() => pendingCoordLookups.delete(key));
  }

  function getUserLocation(forceRefresh = false) {
    if (anvandarPosition && !forceRefresh) {
      return Promise.resolve(anvandarPosition);
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation stöds inte av webbläsaren.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          anvandarPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          resolve(anvandarPosition);
        },
        () => reject(new Error('Kunde inte hämta din position.')),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: forceRefresh ? 0 : 300000
        }
      );
    });
  }

  async function hamtaNarmastePizzorTop3() {
    const pos = await getUserLocation(false);
    const unikaAdresser = [...new Set(state.allaPizzor.map((p) => p.adress).filter(Boolean))];
    const coordsByAdress = new Map();

    for (const adress of unikaAdresser) {
      const coords = await resolveCoordsForAdress(adress);
      if (coords) coordsByAdress.set(norm(adress), coords);
    }

    const pizzorMedCoords = state.allaPizzor
      .map((pizza) => {
        const coords = coordsByAdress.get(norm(pizza.adress || '')) || null;
        return coords ? { ...pizza, coords } : null;
      })
      .filter(Boolean);

    return pizzorMedCoords
      .map((pizza) => ({
        ...pizza,
        distansKm: calculateDistance(pos.lat, pos.lng, pizza.coords.lat, pizza.coords.lng)
      }))
      .sort((a, b) => {
        if (a.distansKm !== b.distansKm) return a.distansKm - b.distansKm;
        return (a.pizza_namn || '').localeCompare((b.pizza_namn || ''), 'sv');
      })
      .slice(0, 3);
  }

  async function hamtaNarmastePizzeriorTop3() {
    const byPizzeria = indexByPizzeria(state.allaPizzor);
    const pos = await getUserLocation(false);
    const pizzeriorMedCoords = [];

    for (const pizzeria of [...byPizzeria.values()]) {
      const coords = await resolveCoordsForAdress(pizzeria.adress);
      if (coords) pizzeriorMedCoords.push({ ...pizzeria, coords });
    }

    return pizzeriorMedCoords
      .map((p) => ({
        ...p,
        distansKm: calculateDistance(pos.lat, pos.lng, p.coords.lat, p.coords.lng)
      }))
      .sort((a, b) => a.distansKm - b.distansKm)
      .slice(0, 3);
  }

  function addNearbyPizzaCardsMessage(top3) {
    const msg = skapaMessageElement('bot');
    const title = document.createElement('div');
    title.className = 'nearby-title';
    title.textContent = 'Top 3 närmaste pizzor just nu';
    msg.appendChild(title);

    const cards = document.createElement('div');
    cards.className = 'nearby-cards';

    top3.forEach((pizza, idx) => {
      const card = document.createElement('article');
      card.className = 'nearby-pizza-card';

      const heading = document.createElement('h4');
      heading.className = 'nearby-pizza-name';
      heading.textContent = `${idx + 1}. ${pizza.pizza_namn || 'Okänd pizza'}`;

      const pizzeria = document.createElement('p');
      pizzeria.className = 'nearby-pizza-meta';
      pizzeria.textContent = `${pizza.pizzeria || 'Okänd pizzeria'} • ${formatKr(pizza.pris)}`;

      const distance = document.createElement('p');
      distance.className = 'nearby-pizza-distance';
      distance.textContent = `Avstånd: ${pizza.distansKm.toFixed(1)} km${pizza.adress ? ` • ${pizza.adress}` : ''}`;

      const links = document.createElement('div');
      links.className = 'chat-links';

      const maps = document.createElement('a');
      maps.className = 'chat-link';
      maps.href = skapaGoogleMapsSokLank(pizza.pizzeria, pizza.adress);
      maps.target = '_blank';
      maps.rel = 'noopener noreferrer';
      maps.textContent = 'Öppna i Maps';

      const search = document.createElement('a');
      search.className = 'chat-link';
      search.href = `/index.html?sok=${encodeURIComponent(pizza.pizza_namn || '')}`;
      search.textContent = 'Visa i sök';

      links.appendChild(maps);
      links.appendChild(search);

      card.appendChild(heading);
      card.appendChild(pizzeria);
      card.appendChild(distance);
      card.appendChild(links);
      cards.appendChild(card);
    });

    msg.appendChild(cards);
    chatLog.scrollTop = chatLog.scrollHeight;
    return Promise.resolve();
  }

  function addNearbyPizzeriaCardsMessage(top3) {
    const msg = skapaMessageElement('bot');
    const title = document.createElement('div');
    title.className = 'nearby-title';
    title.textContent = 'Top 3 närmaste pizzerior just nu';
    msg.appendChild(title);

    const cards = document.createElement('div');
    cards.className = 'nearby-cards';

    top3.forEach((pizzeria, idx) => {
      const card = document.createElement('article');
      card.className = 'nearby-pizza-card';

      const heading = document.createElement('h4');
      heading.className = 'nearby-pizza-name';
      heading.textContent = `${idx + 1}. ${pizzeria.namn || 'Okänd pizzeria'}`;

      const meta = document.createElement('p');
      meta.className = 'nearby-pizza-meta';
      meta.textContent = `${pizzeria.pizzor?.length || 0} pizzor i menyn`;

      const distance = document.createElement('p');
      distance.className = 'nearby-pizza-distance';
      distance.textContent = `Avstånd: ${pizzeria.distansKm.toFixed(1)} km${pizzeria.adress ? ` • ${pizzeria.adress}` : ''}`;

      const links = document.createElement('div');
      links.className = 'chat-links';

      const maps = document.createElement('a');
      maps.className = 'chat-link';
      maps.href = skapaGoogleMapsSokLank(pizzeria.namn, pizzeria.adress);
      maps.target = '_blank';
      maps.rel = 'noopener noreferrer';
      maps.textContent = 'Öppna i Maps';

      const pizzeriorPage = document.createElement('a');
      pizzeriorPage.className = 'chat-link';
      pizzeriorPage.href = '/pizzerior.html';
      pizzeriorPage.textContent = 'Visa pizzeria';

      links.appendChild(maps);
      links.appendChild(pizzeriorPage);

      card.appendChild(heading);
      card.appendChild(meta);
      card.appendChild(distance);
      card.appendChild(links);
      cards.appendChild(card);
    });

    msg.appendChild(cards);
    chatLog.scrollTop = chatLog.scrollHeight;
    return Promise.resolve();
  }

  function skapaMessageElement(role) {
    const msg = document.createElement('div');
    msg.className = `chat-msg chat-msg--${role}`;
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
    return msg;
  }

  function appendMessageLinks(msg, role, links) {
    if (!(links && links.length && role === 'bot')) return;

    const linksWrap = document.createElement('div');
    linksWrap.className = 'chat-links';
    links.forEach((l) => {
      const a = document.createElement('a');
      a.className = 'chat-link';
      a.href = l.href || '#';
      a.textContent = l.label;
      if (l.action) a.dataset.action = l.action;
      if (l.external) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      linksWrap.appendChild(a);
    });
    msg.appendChild(linksWrap);
  }

  function addMessage(text, role, links) {
    const msg = skapaMessageElement(role);
    msg.textContent = text;
    appendMessageLinks(msg, role, links);

    chatLog.scrollTop = chatLog.scrollHeight;
    return Promise.resolve();
  }

  function addBotMessageTyped(text, links) {
    const msg = skapaMessageElement('bot');
    const fullText = String(text || '');
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return new Promise((resolve) => {
      if (!fullText || reducedMotion) {
        msg.textContent = fullText;
        appendMessageLinks(msg, 'bot', links);
        chatLog.scrollTop = chatLog.scrollHeight;
        resolve();
        return;
      }

      let i = 0;
      const speed = Math.min(28, Math.max(12, 2200 / Math.max(fullText.length, 1)));
      const timer = setInterval(() => {
        i += 1;
        msg.textContent = fullText.slice(0, i);
        chatLog.scrollTop = chatLog.scrollHeight;

        if (i >= fullText.length) {
          clearInterval(timer);
          appendMessageLinks(msg, 'bot', links);
          chatLog.scrollTop = chatLog.scrollHeight;
          resolve();
        }
      }, speed);
    });
  }

  function showThinkingIndicator() {
    const msg = skapaMessageElement('bot');
    msg.classList.add('chat-msg--thinking');

    const dots = document.createElement('span');
    dots.className = 'thinking-ellipsis';
    dots.setAttribute('aria-label', 'AI tänker');
    dots.textContent = '...';
    msg.appendChild(dots);

    chatLog.scrollTop = chatLog.scrollHeight;

    return () => {
      if (msg && msg.parentNode) {
        msg.parentNode.removeChild(msg);
      }
    };
  }

  // Track how many good (followCta) answers were given this session
  let goodAnswerCount = 0;

  function showFollowCtaBubble() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-follow-cta';

    const txt = document.createElement('p');
    txt.className = 'chat-follow-cta-text';
    txt.textContent = '\uD83D\uDCA1 Vill du f\u00E5 s\u00E5na h\u00E4r svar direkt?';
    wrap.appendChild(txt);

    const btns = document.createElement('div');
    btns.className = 'chat-follow-cta-btns';

    const fbBtn = document.createElement('a');
    fbBtn.className = 'chat-follow-btn chat-follow-btn--fb';
    fbBtn.href = 'https://www.facebook.com/profile.php?id=61588728802691';
    fbBtn.target = '_blank';
    fbBtn.rel = 'noopener noreferrer';
    fbBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9v-2.89h2.54V9.81c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99C18.34 21.12 22 16.99 22 12z"/></svg> F\u00F6lj p\u00E5 Facebook';
    btns.appendChild(fbBtn);

    const igBtn = document.createElement('a');
    igBtn.className = 'chat-follow-btn chat-follow-btn--ig';
    igBtn.href = 'https://www.instagram.com/billigapizzor/';
    igBtn.target = '_blank';
    igBtn.rel = 'noopener noreferrer';
    igBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> Följ p\u00E5 Instagram';
    btns.appendChild(igBtn);

    wrap.appendChild(btns);
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function queueBotMessage(text, links) {
    messageQueue = messageQueue.then(() => addBotMessageTyped(text, links));
    return messageQueue;
  }

  async function queueBotMessageWithThinking(text, links) {
    const clearThinking = showThinkingIndicator();
    try {
      await queueBotMessage(text, links);
    } finally {
      clearThinking();
    }
  }

  chatLog.addEventListener('click', async (e) => {
    const link = e.target.closest('.chat-link');
    if (!link) return;

    const action = link.dataset.action || '';
    if (action !== 'nearby_pizza' && action !== 'nearby_pizzeria') return;

    e.preventDefault();

    if (!state.allaPizzor.length) {
      queueBotMessage('Jag kan inte köra "Närmast mig" ännu eftersom pizzodatan inte är laddad.', [
        { label: 'Testa igen strax', href: '/ai-lage.html' }
      ]);
      return;
    }

    await queueBotMessageWithThinking(
      action === 'nearby_pizzeria'
        ? 'Hämtar din position och räknar ut närmaste pizzerior...'
        : 'Hämtar din position och räknar ut närmaste pizzor...',
      []
    );

    const clearThinking = showThinkingIndicator();
    try {
      const top3 = action === 'nearby_pizzeria'
        ? await hamtaNarmastePizzeriorTop3()
        : await hamtaNarmastePizzorTop3();
      if (!top3.length) {
        queueBotMessage('Jag hittar tyvärr inga pizzerior med koordinater just nu.', [
          { label: 'Se alla pizzerior', href: '/pizzerior.html' }
        ]);
        return;
      }

      if (action === 'nearby_pizzeria') {
        await addNearbyPizzeriaCardsMessage(top3);
      } else {
        await addNearbyPizzaCardsMessage(top3);
      }
    } catch {
      queueBotMessage('Jag kunde inte hämta din position. Tillåt platsdata och tryck på "Närmast mig" igen.', [
        { label: 'Se pizzerior istället', href: '/pizzerior.html' }
      ]);
    } finally {
      clearThinking();
    }
  });

  function extractControlledText(doc) {
    doc.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove());
    doc.querySelectorAll('[hidden], [aria-hidden="true"], .hidden, .sr-only').forEach((el) => el.remove());
    doc.querySelectorAll('[style*="display:none"], [style*="visibility:hidden"]').forEach((el) => el.remove());

    const root = doc.querySelector('main') || doc.querySelector('article') || doc.body;
    if (!root) return '';

    const pieces = [];
    const nodes = root.querySelectorAll('h1, h2, h3, p, li');
    nodes.forEach((n) => {
      const txt = esc(n.textContent || '');
      if (txt && txt.length >= 3) {
        pieces.push(txt);
      }
    });

    return esc(pieces.join(' ')).slice(0, 12000);
  }

  function readKnowledgeCache() {
    try {
      const raw = localStorage.getItem(KNOWLEDGE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.docs) || !parsed.ts) return null;
      if (Date.now() - parsed.ts > KNOWLEDGE_CACHE_TTL_MS) return null;
      return parsed.docs;
    } catch {
      return null;
    }
  }

  function writeKnowledgeCache(docs) {
    try {
      localStorage.setItem(KNOWLEDGE_CACHE_KEY, JSON.stringify({ ts: Date.now(), docs }));
    } catch {
      // Ignore cache write failures (e.g. private mode quotas).
    }
  }

  async function buildKnowledgeDocs() {
    const docs = [];

    await Promise.all(KNOWLEDGE_PATHS.map(async (path) => {
      try {
        const r = await fetch(path, { cache: 'no-store' });
        if (!r.ok) return;
        const html = await r.text();
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const title = esc(parsed.title || path);
        const text = extractControlledText(parsed);
        if (!text) return;

        const tokens = tokenize(`${title} ${text}`).slice(0, 1200);
        docs.push({
          path,
          title,
          text,
          tokens,
          normTitle: norm(title)
        });
      } catch {
        // Skip unreachable pages without breaking AI.
      }
    }));

    return docs;
  }

  async function loadKnowledgeDocs() {
    const cached = readKnowledgeCache();
    if (cached && cached.length) return cached;
    const docs = await buildKnowledgeDocs();
    writeKnowledgeCache(docs);
    return docs;
  }

  function indexByPizzeria(pizzor) {
    const byPizzeria = new Map();

    pizzor.forEach((p) => {
      const namn = esc(p.pizzeria || 'Okand pizzeria');
      if (!byPizzeria.has(namn)) {
        byPizzeria.set(namn, {
          namn,
          normNamn: norm(namn),
          pizzor: [],
          adress: esc(p.adress || ''),
          telefon: esc(p.telefon || ''),
          hemsida: esc(p.hemsida || ''),
          oppettider: p.oppettider || null
        });
      }
      byPizzeria.get(namn).pizzor.push(p);
    });

    return byPizzeria;
  }

  function findPizzeriorInQuestion(qNorm, byPizzeria) {
    const names = [...byPizzeria.values()];
    const picked = [];
    const stopAlias = new Set(['pizzeria', 'pizzerian', 'pizzerior', 'pizza', 'restaurang', 'grill']);

    names.forEach((p) => {
      const words = p.normNamn.split(' ').filter((w) => w.length >= 3);
      const reducedName = words.filter((w) => !stopAlias.has(w)).join(' ').trim();
      const aliases = [p.normNamn, reducedName, words[0]].filter((x) => x && x.length >= 3);
      const containsAlias = aliases.some((alias) => containsPhrase(qNorm, alias));
      if (containsAlias) picked.push(p);
    });

    return uniqueBy(picked, (p) => p.namn);
  }

  function bestDocMatch(question, docs) {
    const qTokens = tokenize(question);
    if (!qTokens.length) return null;

    let best = null;
    let bestScore = 0;

    docs.forEach((d) => {
      let score = 0;
      qTokens.forEach((t) => {
        if (d.tokens.includes(t)) score += 2;
        if (d.normTitle.includes(t)) score += 4;
      });
      if (score > bestScore) {
        best = d;
        bestScore = score;
      }
    });

    if (!best || bestScore < 3) return null;

    const sentence = (best.text.split(/[.!?]\s+/).find((s) => qTokens.some((t) => norm(s).includes(t))) || best.text).slice(0, 320);
    return { doc: best, snippet: sentence };
  }

  function extractMathNumbers(q) {
    return (q.match(/\d+/g) || []).map(Number).filter((n) => Number.isFinite(n));
  }

  const SECURITY_ABORT_TEXT = 'Jag ar har for att hjalpa dig hitta grymma pizzor. Vad ar du sugen pa?';
  const SECURITY_PATTERNS = [
    /ignore\s+(all|alla|previous|tidigare)\s+(instructions|instruktioner)/i,
    /(visa|show|skriv\s+ut).*(kallkod|source\s*code|systeminstruktioner|system\s*prompt|prompt)/i,
    /(dump|skriv\s+ut|visa).*(pizzor\.json|hela\s+json|raw\s+data)/i,
    /<\s*script\b/i,
    /javascript\s*:/i,
    /onerror\s*=|onload\s*=/i,
    /<\s*iframe\b|<\s*object\b|<\s*embed\b/i
  ];

  function securityInterceptor(rawInput) {
    const inputText = String(rawInput || '').slice(0, 800);
    if (!inputText.trim()) return null;
    const blocked = SECURITY_PATTERNS.some((re) => re.test(inputText));
    if (!blocked) return null;
    return {
      text: SECURITY_ABORT_TEXT,
      links: [{ label: 'Sok pizzor', href: '/index.html' }]
    };
  }

  function fuzzyTokenInText(token, textNorm, maxDistance = 1) {
    if (!token || !textNorm) return false;
    const words = String(textNorm).split(' ').filter(Boolean);
    return words.some((w) => Math.abs(w.length - token.length) <= 2 && levenshtein(token, w) <= maxDistance);
  }

  function buildLocationCandidates(pizzor) {
    const map = new Map();
    pizzor.forEach((p) => {
      const values = [p.omrade, p.stad];
      values.forEach((v) => {
        const cleaned = esc(v);
        const k = norm(cleaned);
        if (!k || k.length < 3) return;
        if (!map.has(k)) map.set(k, cleaned);
      });
    });

    // Ensure core local places always exist as candidates.
    ['Lindome', 'Molndal', 'Kallered'].forEach((v) => {
      const k = norm(v);
      if (!map.has(k)) map.set(k, v);
    });

    return [...map.entries()].map(([key, label]) => ({ key, label }));
  }

  function extractEntities(rawQuestion, pizzor) {
    const q = normalizeQuestionForIntent(rawQuestion || '');
    const tokens = tokenize(q);
    const byPizzeria = indexByPizzeria(pizzor || []);

    const entities = {
      rawQ: q,
      tokens,
      maxPrice: null,
      minPrice: null,
      wantsCheapest: /\bbilligast|billigaste\b/.test(q),
      wantsMostExpensive: /\bdyrast|dyraste\b/.test(q),
      includeIngredients: [],
      excludeIngredients: [],
      pizzaName: null,
      pizzeriaName: null,
      locationKey: null,
      locationLabel: null,
      asksOpenNow: /\b(oppet\s+nu|oppna\s+nu|har\s+oppet\s+nu|vilka\s+har\s+oppet)\b/.test(q),
      asksNearby: /\b(narmast|narmaste|near\s+me|closest|nara\s+mig)\b/.test(q)
    };

    const maxMatch = q.match(/(?:under|max|hogst|mindre\s+an)\s*(\d{2,4})\s*kr?/);
    if (maxMatch) entities.maxPrice = Number(maxMatch[1]);

    const minMatch = q.match(/(?:over|minst|lagst\s+over|fran)\s*(\d{2,4})\s*kr?/);
    if (minMatch) entities.minPrice = Number(minMatch[1]);

    const krMatch = q.match(/(\d{2,4})\s*kr\s*(?:eller\s+billigare|eller\s+mindre|max)?/);
    if (!entities.maxPrice && krMatch && /under|max|billigare/.test(q)) {
      entities.maxPrice = Number(krMatch[1]);
    }

    INGREDIENS_LIST.forEach((ing) => {
      const ingNorm = norm(ing);
      if (!ingNorm) return;
      if (new RegExp(`\\butan\\s+${escapeRegex(ingNorm)}\\b`).test(q)) {
        entities.excludeIngredients.push(ingNorm);
        return;
      }
      if (new RegExp(`\\bmed\\s+${escapeRegex(ingNorm)}\\b`).test(q) || q.includes(ingNorm)) {
        entities.includeIngredients.push(ingNorm);
      }
    });

    entities.includeIngredients = [...new Set(entities.includeIngredients)].filter((x) => !entities.excludeIngredients.includes(x));

    const locationCandidates = buildLocationCandidates(pizzor || []);
    const locationHit = locationCandidates.find((c) => containsPhrase(q, c.key));
    if (locationHit) {
      entities.locationKey = locationHit.key;
      entities.locationLabel = locationHit.label;
    }

    const named = findPizzeriorInQuestion(q, byPizzeria);
    if (named.length === 1) {
      entities.pizzeriaName = named[0].namn;
    } else {
      outerPizzeria: for (const t of tokens) {
        if (t.length < 4) continue;
        for (const p of byPizzeria.values()) {
          const firstWord = (p.normNamn || '').split(' ')[0] || '';
          if (firstWord && levenshtein(t, firstWord) <= 1) {
            entities.pizzeriaName = p.namn;
            break outerPizzeria;
          }
        }
      }
    }

    const uniquePizzaNames = uniqueBy((pizzor || []).map((p) => p.pizza_namn).filter(Boolean), (x) => norm(x));
    const exactPizza = uniquePizzaNames.find((name) => containsPhrase(q, norm(name)));
    if (exactPizza) {
      entities.pizzaName = exactPizza;
    } else {
      outerPizza: for (const t of tokens) {
        if (t.length < 4) continue;
        for (const name of uniquePizzaNames) {
          const nameNorm = norm(name);
          if (fuzzyTokenInText(t, nameNorm, 2)) {
            entities.pizzaName = name;
            break outerPizza;
          }
        }
      }
    }

    return entities;
  }

  function getTodayAliases(now = new Date()) {
    const day = now.getDay();
    const aliasesByDay = {
      0: ['sondag', 'son', 'sunday'],
      1: ['mandag', 'man', 'monday'],
      2: ['tisdag', 'tis', 'tuesday'],
      3: ['onsdag', 'ons', 'wednesday'],
      4: ['torsdag', 'tor', 'thursday'],
      5: ['fredag', 'fre', 'friday'],
      6: ['lordag', 'lor', 'saturday']
    };
    return aliasesByDay[day] || [];
  }

  function parseHourMinute(v) {
    const m = String(v || '').match(/^(\d{1,2})(?::|\.)?(\d{2})?$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2] || 0);
    if (hh > 23 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function isOpenByTimeRange(hoursText, now = new Date()) {
    const txt = norm(hoursText);
    if (!txt) return null;
    if (txt.includes('stangt') || txt.includes('stangd')) return false;
    if (txt.includes('dygnet runt') || txt.includes('24 7') || txt.includes('24/7')) return true;

    const current = now.getHours() * 60 + now.getMinutes();
    const ranges = txt.split(',').map((s) => s.trim()).filter(Boolean);
    for (const rangeText of ranges) {
      const m = rangeText.match(/(\d{1,2}(?::|\.)?\d{0,2})\s*-\s*(\d{1,2}(?::|\.)?\d{0,2})/);
      if (!m) continue;
      const start = parseHourMinute(m[1]);
      const end = parseHourMinute(m[2]);
      if (start === null || end === null) continue;

      if (start <= end) {
        if (current >= start && current <= end) return true;
      } else {
        // Overnight range, e.g. 16:00-02:00
        if (current >= start || current <= end) return true;
      }
    }

    return false;
  }

  function isPizzeriaOpenNow(oppettider, now = new Date()) {
    if (!oppettider || typeof oppettider !== 'object') return false;
    const aliases = getTodayAliases(now);
    const entries = Object.entries(oppettider);
    if (!entries.length) return false;

    const todayEntry = entries.find(([dayKey]) => aliases.some((a) => norm(dayKey).includes(a)));
    if (!todayEntry) return false;

    return isOpenByTimeRange(todayEntry[1], now);
  }

  function applyLocationHardFilter(pizzor, entities) {
    if (!entities.locationKey) return { filtered: pizzor, noHit: false };
    const filtered = pizzor.filter((p) => {
      const fields = [p.omrade, p.stad, p.adress, p.pizzeria].map((x) => norm(x));
      return fields.some((f) => containsPhrase(f, entities.locationKey));
    });
    return { filtered, noHit: filtered.length === 0 };
  }

  function scoreDocTfidf(question, docs) {
    const qTokens = tokenize(question);
    if (!qTokens.length || !docs.length) return null;

    const df = new Map();
    docs.forEach((d) => {
      const uniq = new Set(d.tokens || []);
      uniq.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
    });

    let best = null;
    let bestScore = 0;
    docs.forEach((d) => {
      const tf = new Map();
      (d.tokens || []).forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      let score = 0;
      qTokens.forEach((t) => {
        const termDf = df.get(t) || 0;
        if (!termDf) return;
        const idf = Math.log((docs.length + 1) / (termDf + 1)) + 1;
        score += (tf.get(t) || 0) * idf;
        if ((d.normTitle || '').includes(t)) score += 2.2 * idf;
      });
      if (score > bestScore) {
        best = d;
        bestScore = score;
      }
    });

    if (!best || bestScore < 2.2) return null;
    const sentence = (best.text.split(/[.!?]\s+/).find((s) => qTokens.some((t) => norm(s).includes(t))) || best.text).slice(0, 320);
    return { doc: best, snippet: sentence, score: bestScore };
  }

  function shouldUseExecutionLayer(entities, rawQ) {
    if (entities.maxPrice !== null || entities.minPrice !== null) return true;
    if (entities.wantsCheapest || entities.wantsMostExpensive) return true;
    if (entities.includeIngredients.length || entities.excludeIngredients.length) return true;
    if (entities.pizzaName || entities.pizzeriaName) return true;
    if (entities.locationKey || entities.asksOpenNow || entities.asksNearby) return true;
    return /\b(pizza|pizzor|pizzeria|pris|kr|oppet|narmast|billig|dyr)\b/.test(rawQ);
  }

  async function runExecutionLayer(entities, data, ctx) {
    let pool = [...data.pizzor];

    // HARD RULE: location filter always first, before any pricing logic.
    const locationStep = applyLocationHardFilter(pool, entities);
    pool = locationStep.filtered;
    if (locationStep.noHit) {
      const fallback = data.pizzor
        .filter((p) => Number(p.pris) > 0)
        .sort((a, b) => Number(a.pris) - Number(b.pris))
        .slice(0, 3)
        .map((p) => `${p.pizza_namn} hos ${p.pizzeria} (${formatKr(p.pris)})`)
        .join(', ');
      return {
        text: `Hittar ingen i ${entities.locationLabel || entities.locationKey}. Men i Molndal finns till exempel: ${fallback}.`,
        links: [{ label: 'Se alla pizzor', href: '/index.html' }]
      };
    }

    if (entities.pizzeriaName) {
      const wantedPizzeria = norm(entities.pizzeriaName);
      pool = pool.filter((p) => norm(p.pizzeria) === wantedPizzeria);
    }

    if (entities.pizzaName) {
      const wantedPizza = norm(entities.pizzaName);
      pool = pool.filter((p) => norm(p.pizza_namn) === wantedPizza || containsPhrase(norm(p.pizza_namn), wantedPizza));
    }

    if (entities.includeIngredients.length) {
      pool = pool.filter((p) => {
        const ingred = Array.isArray(p.ingredienser) ? p.ingredienser.map((x) => norm(x)) : [];
        const allText = `${norm(p.pizza_namn)} ${ingred.join(' ')}`;
        return entities.includeIngredients.every((ing) => allText.includes(ing));
      });
    }

    if (entities.excludeIngredients.length) {
      pool = pool.filter((p) => {
        const ingred = Array.isArray(p.ingredienser) ? p.ingredienser.map((x) => norm(x)) : [];
        const allText = `${norm(p.pizza_namn)} ${ingred.join(' ')}`;
        return entities.excludeIngredients.every((ing) => !allText.includes(ing));
      });
    }

    if (entities.asksOpenNow) {
      const byP = indexByPizzeria(pool);
      const openSet = new Set(
        [...byP.values()]
          .filter((p) => isPizzeriaOpenNow(p.oppettider, new Date()))
          .map((p) => p.namn)
      );
      pool = pool.filter((p) => openSet.has(p.pizzeria));
    }

    if (entities.minPrice !== null) {
      pool = pool.filter((p) => Number(p.pris) >= entities.minPrice);
    }
    if (entities.maxPrice !== null) {
      pool = pool.filter((p) => Number(p.pris) <= entities.maxPrice);
    }

    if (!pool.length) {
      return {
        text: 'Jag hittar ingen pizza som matchar alla filter. Prova att ta bort ett filter eller hoja maxpriset.',
        links: [{ label: 'Rensa och sok om', href: '/index.html' }]
      };
    }

    let withDistance = null;
    if (entities.asksNearby) {
      try {
        const pos = await getUserLocation(false);
        const uniqueAddresses = [...new Set(pool.map((p) => p.adress).filter(Boolean))];
        const coordsByAdress = new Map();
        for (const adr of uniqueAddresses) {
          const coords = await resolveCoordsForAdress(adr);
          if (coords) coordsByAdress.set(norm(adr), coords);
        }

        withDistance = pool
          .map((p) => {
            const coords = coordsByAdress.get(norm(p.adress || ''));
            if (!coords) return null;
            return {
              ...p,
              distanceKm: calculateDistance(pos.lat, pos.lng, coords.lat, coords.lng)
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.distanceKm - b.distanceKm);

        if (withDistance.length) pool = withDistance;
      } catch {
        // Keep non-distance results if geolocation fails.
      }
    }

    if (!entities.asksNearby) {
      if (entities.wantsMostExpensive) {
        pool.sort((a, b) => Number(b.pris) - Number(a.pris));
      } else {
        // Default to cheapest-first for filtered execution queries.
        pool.sort((a, b) => Number(a.pris) - Number(b.pris));
      }
    }

    const top = pool.slice(0, 3);
    ctx.lastResults = top;
    ctx.lastPizza = top[0] || null;
    if (top[0]) {
      const byP = indexByPizzeria(data.pizzor);
      ctx.lastPizzeria = byP.get(top[0].pizzeria) || ctx.lastPizzeria;
    }

    const filters = [];
    if (entities.locationLabel) filters.push(`plats: ${entities.locationLabel}`);
    if (entities.maxPrice !== null) filters.push(`max ${formatKr(entities.maxPrice)}`);
    if (entities.minPrice !== null) filters.push(`min ${formatKr(entities.minPrice)}`);
    if (entities.includeIngredients.length) filters.push(`med ${entities.includeIngredients.join(', ')}`);
    if (entities.excludeIngredients.length) filters.push(`utan ${entities.excludeIngredients.join(', ')}`);
    if (entities.asksOpenNow) filters.push('oppet nu');

    const lines = top.map((p, idx) => {
      const distTxt = Number.isFinite(p.distanceKm) ? `, ${p.distanceKm.toFixed(1)} km bort` : '';
      return `${idx + 1}. ${p.pizza_namn} hos ${p.pizzeria} (${formatKr(p.pris)}${distTxt})`;
    });

    return {
      text: `${filters.length ? `Filter (${filters.join(' | ')}). ` : ''}${lines.join(' | ')}.`,
      links: [{ label: 'Fortsatt sokning', href: '/index.html' }],
      followCta: true
    };
  }

  // ============================================================
  // PIZZA AI v2.0 — Intent Scoring Architecture
  // ============================================================

  // --- SYNONYM LEXICON ---
  const LEXICON = {
    billig:     ['billig','billigt','billigaste','billigast','cheap','budget','prisvärd','lågt pris','low price'],
    dyr:        ['dyr','dyrt','dyrast','dyraste','dyrare','expensive'],
    snitt:      ['snitt','snittpris','genomsnitt','medel','medelpris','average'],
    flest:      ['flest','mest','störst','flesta'],
    narmast:    ['närmast','närmaste','nara','narhet','nära','closest','near me','nearby'],
    oppettider: ['oppettider','öppettider','öppet','stänger','öppnar','tider','hours','öppning','stängning'],
    adress:     ['adress','address','var ligger','hitta dit'],
    telefon:    ['telefon','ringa','nummer','phone','ring'],
    budget:     ['budget','har','råd','räcker','kostar','kosta'],
  };

  function expandToCanonical(token) {
    for (const [key, synonyms] of Object.entries(LEXICON)) {
      if (synonyms.some(s => s === token || token.startsWith(s) || s.startsWith(token))) return key;
    }
    return token;
  }

  function expandToCanonical_any(tokens, keys) {
    return tokens.some(t => keys.includes(expandToCanonical(t)));
  }

  // --- LEVENSHTEIN FUZZY MATCH ---
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  // --- INGREDIENS EXTRACTOR ---
  const INGREDIENS_LIST = ['kebab','kyckling','skinka','tonfisk','champinjon','ananas','bacon','salami','räkor','mozzarella','halloumi','falafel','lax','pesto'];

  function extractIngrediens(tokens) {
    for (const t of tokens) {
      const exact = INGREDIENS_LIST.find(i => t.includes(i) || i.includes(t));
      if (exact) return exact;
      if (t.length >= 4) {
        const fuzzy = INGREDIENS_LIST.find(i => levenshtein(t, i) <= 2);
        if (fuzzy) return fuzzy;
      }
    }
    return null;
  }

  // --- CONVERSATION STATE (korttidsminne) ---
  const conversationState = {
    lastPizzeria: null,
    lastPizza:    null,
    lastIntent:   null,
    lastResults:  []
  };

  // --- INTENT DEFINITIONS ---
  const INTENTS = [

    // 1. CONTEXT FOLLOW-UP — "när stänger dom?" efter att ha frågat om Nisses
    {
      id: 'ContextFollowUp',
      matchScore(tokens, rawQ, ctx) {
        if (!ctx.lastPizzeria && !ctx.lastPizza) return 0;
        let score = 0;
        const ctxWords = ['dom','de','den','stänger','öppnar','öppet','adress','telefon','hemsida','ring','kostar','var'];
        tokens.forEach(t => { if (ctxWords.includes(t)) score += 10; });
        if (rawQ.split(' ').length <= 6 && ctx.lastPizzeria) score += 8;
        return score;
      },
      resolve({ tokens, rawQ, ctx }) {
        const p = ctx.lastPizzeria;
        const pizza = ctx.lastPizza;
        const q = rawQ.toLowerCase();
        if (p) {
          if (tokens.some(t => ['oppettider','stänger','öppnar','tider'].includes(expandToCanonical(t)))) {
            const tid = p.oppettider ? Object.entries(p.oppettider).map(([d,t]) => `${d}: ${t}`).join(', ') : 'saknas';
            return { text: `${p.namn} öppettider: ${tid}.`, links: [{ label: 'Pizzerior', href: '/pizzerior.html' }] };
          }
          if (tokens.some(t => expandToCanonical(t) === 'adress') || q.includes('var')) {
            return { text: `${p.namn} ligger på ${p.adress}.`, links: [{ label: 'Öppna i Maps', href: skapaGoogleMapsSokLank(p.namn, p.adress), external: true }] };
          }
          if (tokens.some(t => expandToCanonical(t) === 'telefon')) {
            return { text: p.telefon ? `Ring ${p.namn}: ${p.telefon}.` : `Inget telefonnummer registrerat för ${p.namn}.`, links: [] };
          }
        }
        if (pizza && tokens.some(t => expandToCanonical(t) === 'billig')) {
          return { text: `${pizza.pizza_namn} kostar ${formatKr(pizza.pris)} på ${pizza.pizzeria}.`, links: [{ label: 'Visa i sök', href: `/index.html?sok=${encodeURIComponent(pizza.pizza_namn)}` }] };
        }
        return null;
      }
    },

    // 2. COMPOUND FILTER — "billigaste kebabpizzan nära mig"
    {
      id: 'CompoundFilter',
      matchScore(tokens, rawQ) {
        const hasIng   = !!extractIngrediens(tokens);
        const hasPrice = expandToCanonical_any(tokens, ['billig','dyr']);
        const hasLoc   = tokens.some(t => expandToCanonical(t) === 'narmast');
        let score = 0;
        if (hasIng && hasPrice) score += 30;
        if (hasIng && hasLoc)   score += 30;
        if (hasPrice && hasLoc) score += 25;
        return score;
      },
      resolve({ tokens, rawQ, data, ctx }) {
        const ing       = extractIngrediens(tokens);
        const wantsCheap = expandToCanonical_any(tokens, ['billig']);
        const wantsNear  = tokens.some(t => expandToCanonical(t) === 'narmast');
        let pool = [...data.pizzor].filter(p => Number(p.pris) > 0);
        if (ing) pool = pool.filter(p =>
          (p.pizza_namn || '').toLowerCase().includes(ing) ||
          (Array.isArray(p.ingredienser) && p.ingredienser.some(i => i.toLowerCase().includes(ing)))
        );
        if (wantsCheap) pool.sort((a, b) => Number(a.pris) - Number(b.pris));
        if (wantsNear) {
          return {
            text: `Filtrerar på ${ing || 'pizza'}${wantsCheap ? ' (billigast)' : ''} och räknar avstånd. Tryck nedan!`,
            links: [{ label: '📍 Närmast mig', href: '#nearby_pizza', action: 'nearby_pizza' }]
          };
        }
        const top = pool.slice(0, 3);
        ctx.lastPizza = top[0] || null;
        ctx.lastIntent = 'CompoundFilter';
        const desc = `${wantsCheap ? 'Billigaste ' : ''}${ing ? ing + 'pizza' : 'pizza'}`;
        return {
          text: `${desc}: ${top.map(p => `${p.pizza_namn} hos ${p.pizzeria} (${formatKr(p.pris)})`).join(', ')}.`,
          links: [{ label: 'Sök i söket', href: `/index.html?sok=${encodeURIComponent(ing || '')}` }],
          followCta: true
        };
      }
    },

    // 3. NAMED PIZZERIA — "Nisses", "kebnekaise", "nises"
    {
      id: 'NamedPizzeria',
      matchScore(tokens, rawQ, ctx, data) {
        if (!data.pizzor.length) return 0;
        const byP = indexByPizzeria(data.pizzor);
        let score = 0;
        tokens.forEach(t => {
          for (const p of byP.values()) {
            const firstWord = p.normNamn.split(' ')[0];
            if (p.normNamn.includes(t)) { score += 20; break; }
            if (t.length >= 4 && levenshtein(t, firstWord) <= 1) { score += 15; break; }
          }
        });
        return score;
      },
      resolve({ tokens, rawQ, data, ctx }) {
        const byP = indexByPizzeria(data.pizzor);
        let pizzeria = null;
        // Exact name match first
        const named = findPizzeriorInQuestion(norm(rawQ), byP);
        if (named.length === 1) {
          pizzeria = named[0];
        } else if (named.length === 0) {
          // Fuzzy fallback
          outer: for (const t of tokens) {
            if (t.length < 4) continue;
            for (const p of byP.values()) {
              if (levenshtein(t, p.normNamn.split(' ')[0]) <= 1) { pizzeria = p; break outer; }
            }
          }
        }
        if (!pizzeria) return null;
        ctx.lastPizzeria = pizzeria;
        ctx.lastIntent = 'NamedPizzeria';
        const pPrices = pizzeria.pizzor.map(x => Number(x.pris)).filter(n => n > 0);
        const avg = pPrices.reduce((s, n) => s + n, 0) / pPrices.length;
        const oppettider = pizzeria.oppettider ? Object.entries(pizzeria.oppettider).map(([d, t]) => `${d}: ${t}`).join(', ') : '';
        const info = [
          `meny: ${pizzeria.pizzor.length} pizzor`,
          `pris: ${formatKr(Math.min(...pPrices))}–${formatKr(Math.max(...pPrices))}`,
          `snitt: ${formatKr(avg)}`,
          pizzeria.adress   ? `adress: ${pizzeria.adress}`   : '',
          pizzeria.telefon  ? `tel: ${pizzeria.telefon}`      : '',
          oppettider        ? `öppet: ${oppettider}`          : ''
        ].filter(Boolean).join(' | ');
        return {
          text: `${pizzeria.namn} → ${info}.`,
          links: [
            { label: 'Pizzerior', href: '/pizzerior.html' },
            ...(pizzeria.hemsida ? [{ label: 'Hemsida', href: pizzeria.hemsida, external: true }] : [])
          ],
          followCta: true
        };
      }
    },

    // 4. FIND CHEAPEST
    {
      id: 'FindCheapest',
      matchScore(tokens) {
        let score = 0;
        tokens.forEach(t => {
          const c = expandToCanonical(t);
          if (c === 'billig') score += 15;
          if (t === 'billigast' || t === 'billigaste') score += 5;
        });
        return score;
      },
      resolve({ tokens, data, ctx }) {
        const ing = extractIngrediens(tokens);
        let pool = [...data.pizzor].filter(p => Number(p.pris) > 0);
        if (ing) pool = pool.filter(p => (p.pizza_namn || '').toLowerCase().includes(ing));
        pool.sort((a, b) => Number(a.pris) - Number(b.pris));
        const top = pool.slice(0, 3);
        ctx.lastPizza = top[0] || null;
        ctx.lastIntent = 'FindCheapest';
        const label = ing ? `billigaste ${ing}pizza` : 'billigaste pizzorna';
        return {
          text: `${label.charAt(0).toUpperCase() + label.slice(1)}: ${top.map(p => `${p.pizza_namn} hos ${p.pizzeria} (${formatKr(p.pris)})`).join(', ')}.`,
          links: [{ label: 'Se i söket', href: '/index.html' }],
          followCta: true
        };
      }
    },

    // 5. FIND MOST EXPENSIVE
    {
      id: 'FindMostExpensive',
      matchScore(tokens) {
        let score = 0;
        tokens.forEach(t => {
          const c = expandToCanonical(t);
          if (c === 'dyr') score += 15;
          if (t === 'dyrast' || t === 'dyraste') score += 5;
        });
        return score;
      },
      resolve({ data, ctx }) {
        const top = [...data.pizzor].filter(p => Number(p.pris) > 0).sort((a, b) => Number(b.pris) - Number(a.pris))[0];
        ctx.lastPizza = top;
        ctx.lastIntent = 'FindMostExpensive';
        return {
          text: `Dyraste pizzan just nu: ${top.pizza_namn} hos ${top.pizzeria} för ${formatKr(top.pris)}.`,
          links: [{ label: 'Jämför priser', href: '/index.html' }],
          followCta: true
        };
      }
    },

    // 6. AVERAGE PRICE
    {
      id: 'AveragePrice',
      matchScore(tokens) {
        let score = 0;
        tokens.forEach(t => { if (expandToCanonical(t) === 'snitt') score += 20; });
        return score;
      },
      resolve({ data, ctx }) {
        const prices = data.pizzor.map(p => Number(p.pris)).filter(n => n > 0);
        const avg = prices.reduce((s, n) => s + n, 0) / prices.length;
        ctx.lastIntent = 'AveragePrice';
        return {
          text: `Snittpris: ${formatKr(avg)}. Min: ${formatKr(Math.min(...prices))}, max: ${formatKr(Math.max(...prices))}.`,
          links: [{ label: 'Sök pizzor', href: '/index.html' }],
          followCta: true
        };
      }
    },

    // 7. MOST PIZZAS
    {
      id: 'MostPizzas',
      matchScore(tokens, rawQ) {
        let score = 0;
        tokens.forEach(t => { if (expandToCanonical(t) === 'flest') score += 12; });
        if (rawQ.includes('pizza')) score += 5;
        return score;
      },
      resolve({ data, ctx }) {
        const byP = indexByPizzeria(data.pizzor);
        const ranked = [...byP.values()].map(p => ({ namn: p.namn, count: p.pizzor.length })).sort((a, b) => b.count - a.count);
        const top = ranked[0];
        ctx.lastIntent = 'MostPizzas';
        return {
          text: `${top.namn} har flest pizzor (${top.count} st). Topp 3: ${ranked.slice(0, 3).map((x, i) => `${i + 1}. ${x.namn} (${x.count})`).join(', ')}.`,
          links: [{ label: 'Jämför pizzerior', href: '/pizzerior.html' }],
          followCta: true
        };
      }
    },

    // 8. BUDGET CALCULATOR
    {
      id: 'BudgetCalculator',
      matchScore(tokens, rawQ) {
        let score = 0;
        if (/\d+\s*kr/.test(rawQ)) score += 20;
        else if (/^\d+$/.test(rawQ.trim())) score += 10;
        tokens.forEach(t => { if (expandToCanonical(t) === 'budget') score += 5; });
        if (rawQ.includes('pizza') || rawQ.includes('pizzor')) score += 5;
        return score;
      },
      resolve({ rawQ, data }) {
        const budget = Number((rawQ.match(/(\d+)/) || [])[1] || 0);
        if (!budget) return null;
        const prices = data.pizzor.map(p => Number(p.pris)).filter(n => n > 0);
        const avg = prices.reduce((s, n) => s + n, 0) / prices.length;
        const min = Math.min(...prices);
        return {
          text: `Med ${budget} kr får du ca ${Math.floor(budget / avg)} pizzor till snittpris (${formatKr(avg)}). Till lägsta pris (${formatKr(min)}) upp till ${Math.floor(budget / min)} pizzor.`,
          links: [{ label: 'Sök billiga pizzor', href: '/index.html' }]
        };
      }
    },

    // 9. LOCATION SEARCH
    {
      id: 'LocationSearch',
      matchScore(tokens, rawQ) {
        let score = 0;
        tokens.forEach(t => { if (expandToCanonical(t) === 'narmast') score += 20; });
        if (rawQ.includes('gps') || rawQ.includes('position')) score += 10;
        return score;
      },
      resolve({ rawQ }) {
        const wantsPizzeria = /pizzeria|pizzerior/.test(rawQ);
        const action = wantsPizzeria ? 'nearby_pizzeria' : 'nearby_pizza';
        const label  = wantsPizzeria ? 'pizzerior' : 'pizzor';
        return {
          text: `Jag kan räkna ut vilka ${label} som är närmast dig. Tryck nedan!`,
          links: [
            { label: '📍 Närmast mig', href: `#${action}`, action },
            { label: 'Se alla pizzerior', href: '/pizzerior.html' }
          ]
        };
      }
    },

    // 10. PIZZA NAME MATCH — "Capricciosa", "Margherita"
    {
      id: 'PizzaNameMatch',
      matchScore(tokens, rawQ, ctx, data) {
        if (!data.pizzor.length) return 0;
        const matches = data.pizzor.filter(p => containsPhrase(norm(rawQ), norm(p.pizza_namn || '')));
        return matches.length ? 10 + Math.min(matches.length, 5) : 0;
      },
      resolve({ rawQ, data, ctx }) {
        const matches = uniqueBy(
          data.pizzor.filter(p => containsPhrase(norm(rawQ), norm(p.pizza_namn || ''))),
          p => `${p.pizzeria}::${p.pizza_namn}`
        );
        if (!matches.length) return null;
        const prices = matches.map(m => Number(m.pris)).filter(n => n > 0);
        const first = matches[0];
        ctx.lastPizza = first;
        ctx.lastIntent = 'PizzaNameMatch';
        const ingredients = Array.isArray(first.ingredienser) ? first.ingredienser.join(', ') : '';
        const examples = matches.slice(0, 3).map(m => `${m.pizzeria} (${formatKr(m.pris)})`).join(', ');
        return {
          text: `${first.pizza_namn} finns hos ${matches.length} pizzeria${matches.length > 1 ? 'r' : ''}. Pris ${formatKr(Math.min(...prices))}–${formatKr(Math.max(...prices))}. Exempel: ${examples}.${ingredients ? ` Innehåll: ${ingredients}.` : ''}`,
          links: [{ label: 'Visa i sök', href: `/index.html?sok=${encodeURIComponent(first.pizza_namn)}` }],
          followCta: true
        };
      }
    },

    // 11. INGREDIENS SEARCH
    {
      id: 'IngrediensSok',
      matchScore(tokens) {
        return extractIngrediens(tokens) ? 12 : 0;
      },
      resolve({ tokens, data }) {
        const ing = extractIngrediens(tokens);
        const withIng = data.pizzor.filter(p =>
          Array.isArray(p.ingredienser) && p.ingredienser.some(x => norm(x).includes(ing))
        );
        if (!withIng.length) return null;
        const ex = withIng.slice(0, 4).map(p => `${p.pizza_namn} (${p.pizzeria})`).join(', ');
        return {
          text: `Jag hittar ${withIng.length} pizzor med ${ing}. Exempel: ${ex}.`,
          links: [{ label: 'Sök ingrediens', href: `/index.html?sok=${encodeURIComponent(ing)}` }]
        };
      }
    },

    // 12. SITE/FAQ INFO
    {
      id: 'SiteInfo',
      matchScore(tokens, rawQ) {
        let score = 0;
        if (rawQ.includes('om oss') || rawQ.includes('vad ar billiga') || rawQ.includes('vad gor')) score += 30;
        if (rawQ.includes('integritet') || rawQ.includes('cookie') || rawQ.includes('gdpr')) score += 30;
        if (rawQ.includes('kontakt') || rawQ.includes('faq') || rawQ.includes('vanliga fragor')) score += 25;
        return score;
      },
      resolve({ rawQ }) {
        const q = rawQ.toLowerCase();
        if (q.includes('integritet') || q.includes('cookie') || q.includes('gdpr')) {
          return { text: 'Integritetspolicyn beskriver vilka cookies som används och hur data hanteras.', links: [{ label: 'Öppna integritetspolicy', href: '/integritetspolicy.html' }] };
        }
        if (q.includes('kontakt') || q.includes('faq')) {
          return { text: 'Kontakt och vanliga frågor finns på Om oss och FAQ.', links: [{ label: 'Om oss', href: '/om-oss.html' }, { label: 'FAQ', href: '/faq.html' }] };
        }
        return {
          text: 'Billiga Pizzor är en jämförelsetjänst för Mölndal — sök pizzor, jämför priser, hitta pizzerior.',
          links: [{ label: 'Om oss', href: '/om-oss.html' }, { label: 'Sök pizzor', href: '/index.html' }]
        };
      }
    }
  ];

  // --- CORE ENGINE: resolveIntent ---
  const SCORE_THRESHOLD = 10;

  async function resolveIntent(fragaRaw) {
    const fraga = esc(fragaRaw).slice(0, 220);
    if (!fraga) return { text: 'Skriv en fråga om pizzor eller sajten.', links: [{ label: 'Startsida', href: '/index.html' }] };

    // Security runs first and can hard-stop prompt-injection attempts.
    const securityHit = securityInterceptor(fragaRaw);
    if (securityHit) return securityHit;

    const rawQ = normalizeQuestionForIntent(fraga);
    const tokens = tokenize(rawQ);
    const data = { pizzor: state.allaPizzor };

    if (!data.pizzor.length) {
      const docHit = bestDocMatch(fraga, state.docs);
      if (docHit) return { text: `Från ${docHit.doc.title}: ${docHit.snippet}`, links: [{ label: 'Öppna sidan', href: docHit.doc.path }] };
      return { text: 'Jag laddar data just nu. Testa igen om en sekund.', links: [{ label: 'Startsida', href: '/index.html' }] };
    }

    const entities = extractEntities(fraga, data.pizzor);

    // Execution Layer handles exact JSON entities and enforces location-first filtering.
    if (shouldUseExecutionLayer(entities, rawQ)) {
      const executed = await runExecutionLayer(entities, data, conversationState);
      if (executed) return executed;
    }

    // Score alla intents och sortera
    const scored = INTENTS
      .map(intent => ({ intent, score: intent.matchScore(tokens, rawQ, conversationState, data) }))
      .sort((a, b) => b.score - a.score);

    // Försök från topp, hoppa över om resolve returnerar null
    for (const { intent, score } of scored) {
      if (score < SCORE_THRESHOLD) break;
      const result = intent.resolve({ tokens, rawQ, data, ctx: conversationState });
      if (result) return result;
    }

    // SiteKnowledgeIntent: TF-IDF-like scoring for site guide questions.
    const docHit = scoreDocTfidf(fraga, state.docs) || bestDocMatch(fraga, state.docs);
    if (docHit) {
      return {
        text: `Från ${docHit.doc.title}: ${docHit.snippet}`,
        links: [{ label: 'Öppna sidan', href: docHit.doc.path }]
      };
    }

    return {
      text: 'Inget exakt svar – prova: pizzerians namn, pizza, budget i kr, "billigast", "närmast mig".',
      links: [
        { label: 'Sök pizzor', href: '/index.html' },
        { label: 'Pizzerior', href: '/pizzerior.html' },
        { label: 'FAQ', href: '/faq.html' }
      ]
    };
  }

  // --- AUTOCOMPLETE HOOK (NLP Parsing Layer) ---
  function getSuggestions(partialText) {
    const p = partialText.trim().toLowerCase();
    if (!p || p.length < 2) return [];
    const suggestions = [];

    // Budget pattern
    if (/^\d+$/.test(p)) suggestions.push(`Hur många pizzor får du för ${p} kr?`);
    if (/^\d+\s*kr?/.test(p)) suggestions.push(`Hur många pizzor för ${p}?`);

    // Pizzeria name match
    if (state.allaPizzor.length) {
      const byP = indexByPizzeria(state.allaPizzor);
      for (const piz of byP.values()) {
        if (piz.normNamn.includes(norm(p))) {
          suggestions.push(`Vad kostar pizzorna på ${piz.namn}?`);
          suggestions.push(`Öppettider för ${piz.namn}?`);
          if (suggestions.length >= 5) break;
        }
      }
    }

    // Keyword suggestions
    if ('billig'.startsWith(p) || p.startsWith('bil')) suggestions.push('Vilken är billigaste pizzan?');
    if ('närmast'.startsWith(p) || p.startsWith('när')) suggestions.push('Vilken pizzeria är närmast mig?');
    if ('kebab'.startsWith(p)) suggestions.push('Billigaste kebabpizzan?');
    if ('snitt'.startsWith(p)) suggestions.push('Vad är snittpriset på pizzor?');
    if ('dyrast'.startsWith(p)) suggestions.push('Vilken är dyraste pizzan?');

    return [...new Set(suggestions)].slice(0, 5);
  }


    form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fraga = esc(input.value);
    if (!fraga) return;
    await addMessage(fraga, 'user');
      const svar = await resolveIntent(fraga);
    await queueBotMessageWithThinking(svar.text, svar.links || []);
    if (svar.followCta) {
      goodAnswerCount += 1;
      // Visa bubblan vid 1:a bra svaret, sedan var 4:e gång
      if (goodAnswerCount === 1 || goodAnswerCount % 4 === 0) {
        messageQueue = messageQueue.then(() => {
          showFollowCtaBubble();
          return new Promise((r) => setTimeout(r, 0));
        });
      }
    }
    input.value = '';
    input.focus();
  });

  Promise.all([
    fetch('/data/pizzor.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []),
    loadKnowledgeDocs()
  ]).then(([pizzor, docs]) => {
    state.allaPizzor = pizzor;
    state.docs = docs;
    state.ready = true;

    const params = new URLSearchParams(window.location.search);
    const q = esc(params.get('q') || '');

    if (q) {
      input.value = q;
      form.requestSubmit();
      return;
    }
  });
})();