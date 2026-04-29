// --- Core Environment Helpers ---
// Force noindex only when served from netlify.app, keep indexable on the canonical domain.
(function hanteraRobotsForHost() {
    const arNetlifyHost = /(^|\.)netlify\.app$/i.test(window.location.hostname);
    let robotsMeta = document.querySelector('meta[name="robots"]');

    if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.setAttribute('name', 'robots');
        document.head.appendChild(robotsMeta);
    }

    if (arNetlifyHost) {
        robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
    } else if (!robotsMeta.getAttribute('content')) {
        robotsMeta.setAttribute('content', 'index,follow');
    }
})();

function arLokalUtveckling() {
    const host = (window.location.hostname || '').toLowerCase();
    return window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
}

function hamtaLokalHref(href) {
    if (!href || typeof href !== 'string') {
        return href;
    }

    const matchDynamiskPizzeria = href.match(/^\/pizzerior\/([^/?#]+)\/?$/i);
    if (matchDynamiskPizzeria && matchDynamiskPizzeria[1]) {
        const slug = matchDynamiskPizzeria[1];
        return `/pizzerior/pizzeria.html?slug=${encodeURIComponent(slug)}`;
    }

    if (!href.startsWith('/')) {
        return href;
    }

    const utanSlashPaSlutet = href.replace(/\/+$/, '');
    if (utanSlashPaSlutet === '') {
        return '/index.html';
    }

    if (utanSlashPaSlutet.endsWith('.html')) {
        return utanSlashPaSlutet;
    }

    return `${utanSlashPaSlutet}.html`;
}

function hamtaNavigeringsLankForPizzeria(lank) {
    if (!lank) {
        return lank;
    }

    return arLokalUtveckling() ? hamtaLokalHref(lank) : lank;
}

function arAppWebViewMiljo() {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
        return window.Capacitor.isNativePlatform();
    }

    const ua = (navigator.userAgent || '').toLowerCase();
    const arAndroidWebView = ua.includes('wv') && ua.includes('android');
    const arIosWebView = ua.includes('iphone') && !ua.includes('safari');
    return arAndroidWebView || arIosWebView;
}

function initHeroLasMerForApp() {
    const heroIntro = document.querySelector('.hero-intro');
    const lasMerKnapp = document.querySelector('.hero-las-mer-btn');
    if (!heroIntro || !lasMerKnapp) return;

    if (!arAppWebViewMiljo()) {
        lasMerKnapp.hidden = true;
        return;
    }

    document.body.classList.add('app-hero-lage');

    heroIntro.classList.add('hero-intro--kollapsad');
    lasMerKnapp.hidden = false;
    lasMerKnapp.textContent = 'Läs mer';
    lasMerKnapp.setAttribute('aria-expanded', 'false');

    lasMerKnapp.addEventListener('click', () => {
        const arKollapsad = heroIntro.classList.toggle('hero-intro--kollapsad');
        const arExpanderad = !arKollapsad;
        lasMerKnapp.textContent = arExpanderad ? 'Visa mindre' : 'Läs mer';
        lasMerKnapp.setAttribute('aria-expanded', String(arExpanderad));
    });
}

let allaPizzor = [];
let valdaPizzerior = [];
let aktivKategori = 'Pizzor (alla)';
let valdaIngredienser = []; 
let pizzorSomVisas = 100; 
let nuvarandeFiltreradLista = []; 
let anvandarPosition = null;
let isNearbyActive = false;
let indexCoordsMap = null;
let aiMode = false; // AI-läge toggle state
let geolocationPaminnelsePagar = false;
let mobilScrollHintEfterVisaFler = false;
window.dataLayer = window.dataLayer || []; // GTM tracking
let gtmSokDebounceTimer = null; // GTM tracking
let unifiedSearchIntentTimer = null;
const gtmScrollStegSkickade = new Set(); // GTM tracking
let gtmSuppressNextPizzaKortEvent = false; // GTM tracking
const GOOGLE_MAPS_SOK_BASE_URL = 'https://www.google.com/maps/search/?api=1&query=';
let prisSliderUnderlag = null;

const ADRESS_COORDS = {
    'Konditorivägen 1, 437 33 Lindome': { lat: 57.5797, lng: 12.0742 },
    'Gamla riksvägen 38, 428 32 Kållered': { lat: 57.6110, lng: 12.0509 },
    'Gamla riksvägen 4, 428 32 Kållered': { lat: 57.6122, lng: 12.0492 },
    'Hagabäcksleden 9, 428 32 Kållered': { lat: 57.6102, lng: 12.0540 },
    'Krokslätts Parkgata 57, 431 68 Mölndal': { lat: 57.6787, lng: 11.9955 },
    'Almåsgången 1, 437 30 Lindome': { lat: 57.5776, lng: 12.0685 },
    'Gamla riksvägen 54, 428 30 Kållered': { lat: 57.6089, lng: 12.0526 }
};

function saneraTelefonnummer(telefonnummer) {
    return (telefonnummer || '').replace(/\s+/g, '');
}

const countUpRafPerElement = new WeakMap();

function countUp(el, target, suffix, duration) {
    if (!el) return;

    const tidigareRaf = countUpRafPerElement.get(el);
    if (tidigareRaf) {
        cancelAnimationFrame(tidigareRaf);
        countUpRafPerElement.delete(el);
    }

    const start = performance.now();
    function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * target);
        el.textContent = current.toLocaleString('sv-SE') + suffix;
        if (progress < 1) {
            const rafId = requestAnimationFrame(frame);
            countUpRafPerElement.set(el, rafId);
        } else {
            countUpRafPerElement.delete(el);
        }
    }
    const rafId = requestAnimationFrame(frame);
    countUpRafPerElement.set(el, rafId);
}

function triggaNarSynlig(el, onEnter, onLeave, threshold = 0.45) {
    if (!el || typeof onEnter !== 'function') return;

    if (!('IntersectionObserver' in window)) {
        onEnter();
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        const [entry] = entries;
        if (!entry) return;

        if (entry.isIntersecting) {
            onEnter();
        } else if (typeof onLeave === 'function') {
            onLeave();
        }
    }, { threshold });

    observer.observe(el);
}

function escapaHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function saneraExternUrl(url) {
    const normaliserad = String(url || '').trim();
    if (!normaliserad) return '';

    const medSchema = /^[a-z][a-z\d+\-.]*:/i.test(normaliserad)
        ? normaliserad
        : `https://${normaliserad}`;

    try {
        const parsed = new URL(medSchema, window.location.origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.href;
    } catch {
        return '';
    }
}

function skapaGoogleMapsSokLank(namn, adress) {
    const query = `${namn || ''}, ${adress || ''}`;
    return `${GOOGLE_MAPS_SOK_BASE_URL}${encodeURIComponent(query)}`;
}

function byggPizzaSokText(pizza) {
    const ingrediensText = Array.isArray(pizza.ingredienser) ? pizza.ingredienser.join(' ') : '';
    return normaliseraText(`${pizza.pizzeria || ''} ${pizza.pizza_namn || ''} ${ingrediensText} ${pizza.omrade || ''} ${pizza.stad || ''}`);
}

function normaliseraText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

const VEGETAR_FORBUDNA_ORD = [
    'skinka', 'salami', 'kebab', 'kyckling', 'tonfisk', 'räkor', 'bacon', 'oxfilé', 'oxkött',
    'fläsk', 'fläskfilé', 'parmaskinka', 'pepperoni', 'köttfärs', 'kött', 'ansjovis', 'sardeller',
    'musslor', 'kräft', 'scampi', 'kycklingkebab', 'gyros', 'shawarma',
    'pulled', 'lamm', 'korv', 'lax', 'fisk', 'skaldjur', 'köttbullar', 'köttbulle', 'kalkon',
    'salciccia', 'salsiccia', 'chorizo', 'prosciutto', 'mortadella', 'speck', 'pancetta',
    'capocollo', 'bresaola', 'guanciale', 'biff', 'biffer', 'hamburgare', 'burger', 'burgare'
];

const VEGETAR_TILLATNA_ORD = [
    'vegetar', 'vegansk', 'vego', 'vegokott', 'quorn', 'soja',
    'gronsaker', 'tomat', 'lok', 'paprika', 'svamp', 'champinjon', 'oliver',
    'spenat', 'zucchini', 'majs', 'ananas', 'kronartskocka',
    'mozzarella', 'cheddar', 'fetaost', 'tomatsas', 'pesto', 'halloumi', 'ost', 'agg'
];

// Pre-normalize both lists once at startup for efficient, consistent matching
const FORBUDNA_NORMALISERADE = VEGETAR_FORBUDNA_ORD.map(normaliseraText);
const TILLATNA_NORMALISERADE = VEGETAR_TILLATNA_ORD.map(normaliseraText);

// Category filter rule-sets — defined outside filter function to avoid reallocation per render cycle
const MEAT_BLACKLIST_RAW = ["oxfilé", "köttfärs", "bacon", "skinka", "salami", "kebab", "kyckling", "fläskfilé", "pepperoni"];
const SEAFOOD_LIST_RAW = ["räkor", "tonfisk", "musslor", "crabfish"];
const GRILL_LIST_RAW = ["kebab", "grill", "spett"];

// Pre-normalize all blacklists at startup for consistent matching
const MEAT_BLACKLIST = MEAT_BLACKLIST_RAW.map(normaliseraText);
const SEAFOOD_LIST = SEAFOOD_LIST_RAW.map(normaliseraText);
const GRILL_LIST = GRILL_LIST_RAW.map(normaliseraText);

function harForbjudetVegetarInnehall(normaliseradText) {
    // Mask veg-prefix compound words before checking so e.g. "vegokott"
    // does not falsely trigger the 'kott' forbidden entry.
    // We do NOT use word-boundary regex (\b) here because forbidden entries
    // like 'kräft' normalize to 'kraft', and "kraftor" (kräftor) has no
    // word boundary after 'kraft' — .includes() is the correct tool.
    const text = normaliseradText.replace(/veg\w+/g, '');
    return FORBUDNA_NORMALISERADE.some((ord) => text.includes(ord));
}

function arVegetariskText(normaliseradText) {
    if (harForbjudetVegetarInnehall(normaliseradText)) return false;
    return TILLATNA_NORMALISERADE.some((ord) => normaliseradText.includes(ord));
}

function arVegetariskSokterm(term) {
    const t = normaliseraText(term);
    return t.includes('vegetar') || t.includes('vegansk') || t.includes('vego');
}

function filtreraEfterKategori(menuItems, aktiv) {
    if (aktiv === 'Pizzor (alla)') return menuItems;

    return menuItems.filter((item) => {
        const normNamn = normaliseraText(item.pizza_namn || '');
        const normIngredienser = Array.isArray(item.ingredienser)
            ? item.ingredienser.map((i) => normaliseraText(i || ''))
            : [];

        // Ensure 'term' is normalized before checking if it's in any ingredient
        const harIngrediens = (term) => {
            const normTerm = normaliseraText(term);
            return normIngredienser.some((i) => i.includes(normTerm));
        };
        const harNagonIngrediens = (terms) => terms.some((t) => harIngrediens(t));

        switch (aktiv) {
            case 'Vegetariska':
                return arVegetariskText(byggPizzaSokText(item));

            case 'Inbakade':
                return normNamn.includes('inbakad');

            case 'Amerikanska pannpizzor':
                return normNamn.includes('panpizza') || normNamn.includes('amerikansk');

            case 'Kebab och grillrätter': {
                const primarKat = hamtaPrimarKategoriForPizza(item);
                // Only show kebab items (NOT burgare), and pizzas with grill ingredients
                return primarKat === 'kebab' ||
                       (primarKat === 'pizza' && harNagonIngrediens(GRILL_LIST));
            }

            case 'Skaldjur':
                return harNagonIngrediens(SEAFOOD_LIST);

            case 'Salami':
                return harIngrediens('salami');

            case 'Kebab':
                return harIngrediens('kebab');

            case 'Köttfärs':
                return harIngrediens('köttfärs');

            case 'Kyckling':
                return harIngrediens('kyckling');

            case 'Oxfilé':
                return harIngrediens('oxfilé');

            case 'Fläskfilé':
                return harIngrediens('fläskfilé');

            case 'Burgare':
                return normNamn.includes('burgare') || normNamn.includes('burger') || normNamn.includes('hamburgare');

            default:
                return true;
        }
    });
}


function hamtaPrisSliderUnderlag() {
    const priser = allaPizzor.map((p) => Number(p.pris)).filter((value) => value > 0).sort((a, b) => a - b);
    if (!priser.length) {
        return null;
    }

    const globalMin = priser[0];
    const globalMax = priser[priser.length - 1];
    const p95Index = Math.floor((priser.length - 1) * 0.95);
    const steg = 5;
    const p95Pris = Math.min(globalMax, Math.ceil(priser[p95Index] / steg) * steg);

    return { globalMin, globalMax, p95Pris, totalAntal: priser.length };
}

function formatPrisSliderText(minPris, maxPris, antal) {
    if (minPris === null && maxPris === null) return 'Alla priser';
    if (minPris === null) return `Upp till ${maxPris} kr (${antal} pizzor)`;
    if (maxPris === null) return `Från ${minPris} kr (${antal} pizzor)`;
    return `${minPris} – ${maxPris} kr (${antal} pizzor)`;
}

function begransaPrisTillSteg(pris, steg = 5) {
    return Math.round(pris / steg) * steg;
}

function omvandlaSliderPercentTillPris(percent, underlag) {
    const { globalMin, globalMax, p95Pris } = underlag;
    const clampadPercent = Math.max(0, Math.min(100, percent));

    if (clampadPercent <= 80) {
        const t = clampadPercent / 80;
        return begransaPrisTillSteg(globalMin + (p95Pris - globalMin) * t);
    }

    const t = (clampadPercent - 80) / 20;
    return begransaPrisTillSteg(p95Pris + (globalMax - p95Pris) * t);
}

function omvandlaPrisTillSliderPercent(pris, underlag) {
    const { globalMin, globalMax, p95Pris } = underlag;
    const clampatPris = Math.max(globalMin, Math.min(globalMax, pris));

    if (clampatPris <= p95Pris) {
        const range = p95Pris - globalMin || 1;
        return Math.round(((clampatPris - globalMin) / range) * 80);
    }

    const range = globalMax - p95Pris || 1;
    return Math.round(80 + ((clampatPris - p95Pris) / range) * 20);
}

// Primary category taxonomy (Foodora/Uber Eats style): top strip uses only food types.
const CATEGORY_MAP = {
    pizza: {
        label: 'Pizza',
        emoji: '🍕',
        match: ['pizza', 'capricciosa', 'vesuvio', 'napoli', 'hawaii', 'calzone', 'quattro', 'margherita']
    },
    kebab: {
        label: 'Kebab',
        emoji: '🥙',
        match: ['kebab', 'kebabrulle', 'rulle', 'tallrik', 'gyros', 'shawarma', 'falafel']
    },
    burgare: {
        label: 'Burgare',
        emoji: '🍔',
        match: ['burgare', 'burger', 'hamburgare']
    },
    sallad: {
        label: 'Sallader',
        emoji: '🥗',
        match: ['sallad', 'caesar', 'mixsallad', 'grekisk sallad']
    },
    pasta: {
        label: 'Pasta',
        emoji: '🍝',
        match: ['pasta', 'spaghetti', 'tagliatelle', 'penne']
    },
    inbakad: {
        label: 'Inbakad',
        emoji: '🫓',
        match: ['inbakad', 'inbakade', 'halvinbakad', 'halvinbakade', 'dubbelinbakad', 'dubbelinbakade']
    },
    vegetar: {
        label: 'Vegetariskt',
        emoji: '🥬',
        match: ['vegetar', 'vegansk', 'vego', 'halloumi', 'gronsaker', 'mozzarella']
    },
    special: {
        label: 'Special',
        emoji: '⭐',
        match: ['special', 'premium', 'husets']
    }
};

const CATEGORY_MATCH_INDEX = Object.fromEntries(
    Object.entries(CATEGORY_MAP).map(([nyckel, kategori]) => [
        nyckel,
        (kategori.match || []).map((ord) => normaliseraText(ord)).filter(Boolean)
    ])
);

function arInbakadPizzaText(pizzaText) {
    return (CATEGORY_MATCH_INDEX.inbakad || []).some((ord) => pizzaText.includes(ord));
}

function arSpecial(pizzaText) {
    // pizzaText is already normalized
    if (pizzaText.includes('special') || pizzaText.includes('husets') || pizzaText.includes('premium')) return true;
    if (pizzaText.includes('lasagne') || pizzaText.includes('lamm')) return true;
    if (pizzaText.includes('surdeg')) return true;
    return false;
}

function hamtaPrimarKategoriForPizza(pizza) {
    const pizzaText = byggPizzaSokText(pizza);

    // Inbakad always wins first.
    if (arInbakadPizzaText(pizzaText)) return 'inbakad';

    // Explicit ordered chain — score-based match for food-type categories only.
    const orderedCategories = ['kebab', 'burgare', 'pasta', 'sallad', 'vegetar'];
    let bastKategori = null;
    let hogstaScore = 0;

    orderedCategories.forEach((nyckel) => {
        if (nyckel === 'vegetar' && !arVegetariskText(pizzaText)) {
            return;
        }
        const matchOrd = CATEGORY_MATCH_INDEX[nyckel] || [];
        const score = matchOrd.reduce((summa, ord) => summa + (pizzaText.includes(ord) ? 1 : 0), 0);
        if (score > hogstaScore) {
            hogstaScore = score;
            bastKategori = nyckel;
        }
    });

    if (bastKategori) return bastKategori;

    // Special is checked strictly — no fuzzy match, no fallback.
    if (arSpecial(pizzaText)) return 'special';

    // Everything else is pizza.
    return 'pizza';
}

function skapaAssistentSvarObjekt({ kategori = 'pizza', rubrik = 'Resultat', innehall = '', actions = [] }) {
    return { kategori, rubrik, innehall, actions };
}

// --- SECURITY LAYER FOR ASSISTANT ---

const WHITELIST_PIZZA_FALT = ['pizza_namn', 'pris', 'ingredienser', 'pizzeria', 'omrade'];
const DISALLOWED_KEYWORDS = ['kod', 'javascript', 'html', 'css', 'backend', 'api', 'databas', 'server', 'variabel', 'funktion', 'console', 'debug', 'source', 'fetch', 'json', 'hvordan'];
const MAX_INPUT_LENGTH = 150;
const MAX_OUTPUT_ITEMS = 5;

function validateAndSanitizeInput(input) {
    // Validera typ
    if (typeof input !== 'string') {
        return '';
    }
    
    // Trimma och begränsa längd
    let sanitized = String(input).trim().substring(0, MAX_INPUT_LENGTH);
    
    // Remov dangercontrol characters
    sanitized = sanitized.replace(/[<>\"'`]/g, '');
    
    // Remov multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized;
}

function isDisallowedQuestion(frageNormaliserad) {
    const norm = frageNormaliserad.toLowerCase();
    return DISALLOWED_KEYWORDS.some(keyword => norm.includes(keyword));
}

function whitelistPizzaData(pizza) {
    if (!pizza || typeof pizza !== 'object') {
        return null;
    }
    
    const result = {};
    WHITELIST_PIZZA_FALT.forEach(falt => {
        if (falt in pizza) {
            result[falt] = pizza[falt];
        }
    });
    
    return result;
}

function getVisiblePizzasForAssistant() {
    // Returnera bara pizzor som redan är filtrerade och synliga för användaren
    if (!Array.isArray(nuvarandeFiltreradLista)) {
        return [];
    }
    
    // Begränsa till MAX_OUTPUT_ITEMS
    return nuvarandeFiltreradLista.slice(0, MAX_OUTPUT_ITEMS).map(whitelistPizzaData);
}

function renderaAssistentSvarSafe(svarEl, svarObj, fraga) {
    const wrapper = document.createElement('div');
    wrapper.className = 'assistent-inline-svar';

    const textEl = document.createElement('span');
    textEl.className = 'assistent-inline-text';

    // Convert generated HTML to plain text to keep inline answer compact and safe.
    const temp = document.createElement('div');
    temp.innerHTML = svarObj.innehall || '';
    const plain = (temp.textContent || '').replace(/\s+/g, ' ').trim();
    const kortText = plain.length > 140 ? `${plain.slice(0, 137).trim()}...` : plain;
    textEl.textContent = kortText || 'Jag hittade ett svar utifrån datan på sidan.';

    const actions = document.createElement('div');
    actions.className = 'assistent-inline-actions';

    const basActions = [...(svarObj.actions || []), { label: '📤 Dela', action: 'share', fraga }];
    basActions.slice(0, 2).forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'assistent-inline-action';
        btn.textContent = a.label;
        btn.dataset.action = a.action || '';
        if (a.href) btn.dataset.href = a.href;
        if (a.pizzeria) btn.dataset.pizzeria = a.pizzeria;
        if (a.sok !== undefined) btn.dataset.sok = a.sok;
        if (a.fraga) btn.dataset.fraga = a.fraga;
        actions.appendChild(btn);
    });

    wrapper.appendChild(textEl);
    wrapper.appendChild(actions);
    svarEl.innerHTML = '';
    svarEl.appendChild(wrapper);
}

function hittaNamndPizzeria(fragetext) {
    const normFraga = normaliseraText(fragetext);
    const unikaPizzerior = [...new Set(allaPizzor.map((p) => p.pizzeria).filter(Boolean))];
    const sorterade = [...unikaPizzerior].sort((a, b) => b.length - a.length);
    return sorterade.find((namn) => normFraga.includes(normaliseraText(namn))) || null;
}

function hamtaAktivPizzeriaKontext() {
    return valdaPizzerior.length === 1 ? valdaPizzerior[0] : null;
}

function hamtaPizzeriaInfo(pizzeriaNamn) {
    if (!pizzeriaNamn) return null;
    const pizzaLista = allaPizzor.filter((p) => normaliseraText(p.pizzeria) === normaliseraText(pizzeriaNamn));
    if (!pizzaLista.length) return null;

    const medAdress = pizzaLista.find((p) => p.adress) || pizzaLista[0];
    return {
        namn: pizzeriaNamn,
        adress: medAdress.adress || '',
        telefon: medAdress.telefon || '',
        hemsida: medAdress.hemsida || '',
        omrade: medAdress.omrade || '',
        stad: medAdress.stad || 'Mölndal',
        oppettider: medAdress.oppettider || null,
        antalPizzor: pizzaLista.length,
        pizzor: pizzaLista
    };
}

function skapaHemsideSidorListaHtml() {
    const sidor = [...document.querySelectorAll('.footer-links a')]
        .map((a) => ({ namn: a.textContent.trim(), href: a.getAttribute('href') || '' }))
        .filter((s) => s.namn && s.href);

    if (!sidor.length) return '';
    const unika = [];
    const set = new Set();
    sidor.forEach((s) => {
        const key = `${s.namn}::${s.href}`;
        if (!set.has(key)) {
            set.add(key);
            unika.push(s);
        }
    });

    return unika
        .map((s) => `<a href="${escapaHtml(s.href)}">${escapaHtml(s.namn)}</a>`)
        .join(' · ');
}

function skapaVagSvar(pizzeriaInfo) {
    if (!pizzeriaInfo) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Jag behöver veta vilken pizzeria du menar. Skriv till exempel: "Hur hittar jag till Nisses Pizzeria?"',
            actions: [
                { label: '📍 Öppna pizzerior', action: 'openLink', href: '/pizzerior' }
            ]
        });
    }

    if (!pizzeriaInfo.adress) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `Jag hittar ingen adress för <strong>${escapaHtml(pizzeriaInfo.namn)}</strong> just nu.`,
            actions: [
                { label: '🏪 Visa pizzerian', action: 'visaPizzeria', pizzeria: pizzeriaInfo.namn }
            ]
        });
    }

    const mapsLank = skapaGoogleMapsSokLank(pizzeriaInfo.namn, pizzeriaInfo.adress);
    const telefonRad = pizzeriaInfo.telefon
        ? ` · 📞 <a href="tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}">${escapaHtml(pizzeriaInfo.telefon)}</a>`
        : '';
    return skapaAssistentSvarObjekt({
        kategori: 'pizza',
        rubrik: escapaHtml(pizzeriaInfo.namn),
        innehall: `📍 <strong>${escapaHtml(pizzeriaInfo.namn)}</strong> ligger på <strong>${escapaHtml(pizzeriaInfo.adress)}</strong>. <a href="${mapsLank}" target="_blank" rel="noopener noreferrer">Öppna i Google Maps</a>${telefonRad}.`,
        actions: [
            { label: '🍕 Visa pizzor här', action: 'visaPizzeria', pizzeria: pizzeriaInfo.namn },
            { label: '📍 Öppna i Google Maps', action: 'openLink', href: mapsLank }
        ]
    });
}

function arVegetariskPizza(pizza) {
    const text = byggPizzaSokText(pizza);
    return arVegetariskText(text);
}

function hamtaPrisTal(pizza) {
    return Number(pizza?.pris) || 0;
}

function skapaPizzaSvarsrad(pizza) {
    const namn = escapaHtml(pizza.pizza_namn || 'Okand pizza');
    const pizzeria = escapaHtml(pizza.pizzeria || 'Okand pizzeria');
    return `<strong>${namn}</strong> hos <strong>${pizzeria}</strong> (${hamtaPrisTal(pizza)} kr)`;
}

function svaraPaPizzaFraga(fragaRaw) {
    // SECURITY: Sanera input
    const fraga = validateAndSanitizeInput(fragaRaw);
    
    if (!fraga) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Skriv en fråga, till exempel: "Hur många pizzor får jag för 1000 kr?" eller "Hur hittar jag till Bella Ciao?"'
        });
    }

    const norm = normaliseraText(fraga);
    
    // SECURITY: Blocka frågor om kod, backend, interna detaljer
    if (isDisallowedQuestion(norm)) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Jag kan bara svara på frågor om pizzor och information som visas på sidan, som priser, ingredienser, och pizzerior i Mölndal.'
        });
    }
    
    const harData = Array.isArray(allaPizzor) && allaPizzor.length > 0;
    const pizzeriaNamn = hittaNamndPizzeria(norm) || (norm.includes('denna pizzeria') || norm.includes('den har pizzerian') || norm.includes('den pizzerian') ? hamtaAktivPizzeriaKontext() : null);

    // Hemsidefrågor (synligt innehåll och navigation)
    if (norm.includes('varfor') && (norm.includes('skapade') || norm.includes('finns sidan') || norm.includes('denna sida'))) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Vi skapade sidan för att samla pizzor och priser i Mölndal på ett ställe, så du slipper hoppa mellan olika menyer och snabbt hittar rätt pizza för din budget.',
            actions: [
                { label: 'ℹ️ Läs mer om oss', action: 'openLink', href: '/om-oss' }
            ]
        });
    }

    if (norm.includes('vad ar den har sidan') || norm.includes('vad gor sidan') || norm.includes('om hemsidan') || norm.includes('om sidan')) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Det här är Billiga Pizzor: en jämförelsesida där du kan söka, filtrera och sortera pizzor från lokala pizzerior i Mölndal, se priser, ingredienser och hitta pizzerior nära dig.',
            actions: [
                { label: '🏪 Gå till pizzerior', action: 'openLink', href: '/pizzerior' }
            ]
        });
    }

    if (norm.includes('kontakt') || norm.includes('mail') || norm.includes('e-post')) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Du kan kontakta oss via <a href="mailto:kontakt@billigapizzor.se">kontakt@billigapizzor.se</a>.',
            actions: [
                { label: '✉️ Maila oss', action: 'openLink', href: 'mailto:kontakt@billigapizzor.se' }
            ]
        });
    }

    if (norm.includes('integritet') || norm.includes('privacy') || norm.includes('cookie')) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Integritet och cookies finns på <a href="/integritetspolicy">Integritetspolicy</a>. Vi använder cookies för att förbättra tjänsten och ge bättre statistik.',
            actions: [
                { label: '🛡️ Öppna integritetspolicy', action: 'openLink', href: '/integritetspolicy' }
            ]
        });
    }

    if (norm.includes('vilka sidor') || norm.includes('navigera') || norm.includes('meny pa sidan') || norm.includes('finns pa hemsidan')) {
        const sidorHtml = skapaHemsideSidorListaHtml();
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: sidorHtml
                ? `Du hittar bland annat dessa sidor: ${sidorHtml}.`
                : 'Sidan har bland annat Hem, Pizzerior, Frågor & Svar, Om oss och Integritetspolicy.',
            actions: [
                { label: '🏠 Till startsidan', action: 'openLink', href: '/' }
            ]
        });
    }

    if (norm.includes('hur hittar jag till') || norm.includes('vag till') || norm.includes('hitta till denna pizzeria') || norm.includes('adress till')) {
        if (!harData) {
            return skapaAssistentSvarObjekt({
                kategori: 'site',
                rubrik: 'Om hemsidan',
                innehall: 'Jag kan inte hämta pizzeriadata just nu. Testa igen om en liten stund.'
            });
        }
        const info = hamtaPizzeriaInfo(pizzeriaNamn);
        return skapaVagSvar(info);
    }

    if (!harData) {
        return skapaAssistentSvarObjekt({
            kategori: 'site',
            rubrik: 'Om hemsidan',
            innehall: 'Jag hittar ingen pizzadata just nu. Testa igen om en liten stund.'
        });
    }

    const pizzorIUrval = pizzeriaNamn
        ? allaPizzor.filter((p) => normaliseraText(p.pizzeria) === normaliseraText(pizzeriaNamn))
        : allaPizzor;

    if (!pizzorIUrval.length) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: 'Jag hittade ingen pizzeria som matchar den frågan.',
            actions: [
                { label: '🏪 Se alla pizzerior', action: 'openLink', href: '/pizzerior' }
            ]
        });
    }

    const billigastePizza = pizzorIUrval.reduce((min, p) => hamtaPrisTal(p) < hamtaPrisTal(min) ? p : min, pizzorIUrval[0]);
    const dyrastePizza = pizzorIUrval.reduce((max, p) => hamtaPrisTal(p) > hamtaPrisTal(max) ? p : max, pizzorIUrval[0]);
    const snittpris = pizzorIUrval.reduce((sum, p) => sum + hamtaPrisTal(p), 0) / pizzorIUrval.length;

    if ((norm.includes('vad kostar') || norm.includes('kostar')) && norm.includes('alla pizzor')) {
        const minPris = hamtaPrisTal(billigastePizza);
        const maxPris = hamtaPrisTal(dyrastePizza);
        if (pizzeriaNamn) {
            return skapaAssistentSvarObjekt({
                kategori: 'pizza',
                rubrik: escapaHtml(pizzeriaNamn),
                innehall: `Snittpris: <strong>${snittpris.toFixed(1)} kr</strong><br>Billigaste: <strong>${minPris} kr</strong><br>Dyraste: <strong>${maxPris} kr</strong>`,
                actions: [
                    { label: '🍕 Visa dessa pizzor', action: 'visaPizzeria', pizzeria: pizzeriaNamn }
                ]
            });
        }
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `I hela urvalet ligger pizzorna mellan <strong>${minPris}–${maxPris} kr</strong> med snitt <strong>${snittpris.toFixed(1)} kr</strong> (${pizzorIUrval.length} pizzor).`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: '' }
            ]
        });
    }

    if (norm.includes('billigaste')) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🟢 Billigaste just nu: ${skapaPizzaSvarsrad(billigastePizza)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: billigastePizza.pizza_namn || '', pizzeria: billigastePizza.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('dyraste')) {
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🔴 Dyraste just nu: ${skapaPizzaSvarsrad(dyrastePizza)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: dyrastePizza.pizza_namn || '', pizzeria: dyrastePizza.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('snittpris')) {
        const prefix = pizzeriaNamn ? `Snittpris hos <strong>${escapaHtml(pizzeriaNamn)}</strong>` : 'Snittpris i hela Mölndal';
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: pizzeriaNamn ? escapaHtml(pizzeriaNamn) : 'Resultat',
            innehall: `📊 ${prefix}: <strong>${snittpris.toFixed(1)} kr</strong> (${pizzorIUrval.length} pizzor i urvalet).`,
            actions: [
                pizzeriaNamn
                    ? { label: '🍕 Visa dessa pizzor', action: 'visaPizzeria', pizzeria: pizzeriaNamn }
                    : { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: '' }
            ]
        });
    }

    const budgetMatch = norm.match(/(\d+)\s*kr/);
    if ((norm.includes('hur manga') || norm.includes('max')) && budgetMatch) {
        const budget = Number(budgetMatch[1]);
        const maxAntal = Math.floor(budget / hamtaPrisTal(billigastePizza));
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🧮 För <strong>${budget} kr</strong> kan du köpa upp till <strong>${maxAntal}</strong> pizzor i detta urval. Billigaste är ${skapaPizzaSvarsrad(billigastePizza)}.`,
            actions: [
                { label: '🍕 Visa billigaste alternativ', action: 'visaSokning', sok: billigastePizza.pizza_namn || '', pizzeria: billigastePizza.pizzeria || '' }
            ]
        });
    }

    const antalPizzaMatch = norm.match(/(\d+)\s*pizz/);
    if ((norm.includes('vad kostar') || norm.includes('kostar')) && antalPizzaMatch) {
        const antal = Number(antalPizzaMatch[1]);
        const minTotal = antal * hamtaPrisTal(billigastePizza);
        const maxTotal = antal * hamtaPrisTal(dyrastePizza);
        const snittTotal = antal * snittpris;
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `💰 <strong>${antal}</strong> pizzor kostar cirka <strong>${snittTotal.toFixed(0)} kr</strong> i snitt (spann <strong>${minTotal}–${maxTotal} kr</strong>).`,
            actions: [
                { label: '🍕 Visa billigaste alternativ', action: 'visaSokning', sok: billigastePizza.pizza_namn || '', pizzeria: billigastePizza.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('kebab') && norm.includes('billig')) {
        const kebabPizzor = pizzorIUrval.filter((p) => byggPizzaSokText(p).includes('kebab'));
        if (!kebabPizzor.length) {
            return skapaAssistentSvarObjekt({
                kategori: 'pizza',
                rubrik: 'Resultat',
                innehall: 'Jag hittade ingen kebabpizza i urvalet.'
            });
        }
        const billigKebab = kebabPizzor.reduce((min, p) => hamtaPrisTal(p) < hamtaPrisTal(min) ? p : min, kebabPizzor[0]);
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🥙 Billigaste kebabpizza: ${skapaPizzaSvarsrad(billigKebab)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: 'kebab', pizzeria: billigKebab.pizzeria || '' }
            ]
        });
    }

    if (norm.includes('vegetar')) {
        let maxPris = null;
        const underMatch = norm.match(/under\s*(\d+)/);
        if (underMatch) maxPris = Number(underMatch[1]);
        const vegPizzor = pizzorIUrval.filter((p) => arVegetariskPizza(p) && (maxPris === null || hamtaPrisTal(p) <= maxPris));
        if (!vegPizzor.length) {
            return skapaAssistentSvarObjekt({
                kategori: 'pizza',
                rubrik: 'Resultat',
                innehall: maxPris === null ? 'Jag hittade inga tydligt vegetariska pizzor i urvalet.' : `Jag hittade inga vegetariska pizzor under ${maxPris} kr.`
            });
        }
        const billigVeg = vegPizzor.reduce((min, p) => hamtaPrisTal(p) < hamtaPrisTal(min) ? p : min, vegPizzor[0]);
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: 'Resultat',
            innehall: `🥬 Jag hittade <strong>${vegPizzor.length}</strong> vegetariska alternativ${maxPris !== null ? ` under ${maxPris} kr` : ''}. Billigast är ${skapaPizzaSvarsrad(billigVeg)}.`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaSokning', sok: 'vegetarisk' }
            ]
        });
    }

    if (pizzeriaNamn && (norm.includes('kostar') || norm.includes('alla pizzor') || norm.includes('pizzor pa'))) {
        const minPris = hamtaPrisTal(billigastePizza);
        const maxPris = hamtaPrisTal(dyrastePizza);
        return skapaAssistentSvarObjekt({
            kategori: 'pizza',
            rubrik: escapaHtml(pizzeriaNamn),
            innehall: `Snittpris: <strong>${snittpris.toFixed(1)} kr</strong><br>Billigaste: <strong>${minPris} kr</strong><br>Dyraste: <strong>${maxPris} kr</strong>`,
            actions: [
                { label: '🍕 Visa dessa pizzor', action: 'visaPizzeria', pizzeria: pizzeriaNamn },
                { label: '📍 Hur hittar jag dit?', action: 'fraga', fraga: `Hur hittar jag till ${pizzeriaNamn}?` }
            ]
        });
    }

    return skapaAssistentSvarObjekt({
        kategori: 'site',
        rubrik: 'Om hemsidan',
        innehall: 'Jag kan svara på både pizzor och hemsidan: billigaste/dyraste/snittpris, budgetfrågor, kebab/vegetariskt, pizzerior, vägbeskrivning till pizzeria, varför sidan skapades, kontakt, integritet/cookies och vilka sidor som finns.',
        actions: [
            { label: '🔥 Populära frågor', action: 'focusInput' }
        ]
    });
}

function renderaAssistentSvar(svarEl, svarObj, fraga) {
    const kategoriEmoji = svarObj.kategori === 'site' ? 'ℹ️' : '🍕';
    const kategoriText = svarObj.kategori === 'site' ? 'Om hemsidan' : 'Resultat';
    const wrapper = document.createElement('div');
    wrapper.className = `assistent-svar-kort assistent-svar-kort--${svarObj.kategori === 'site' ? 'site' : 'pizza'}`;

    const meta = document.createElement('div');
    meta.className = 'assistent-svar-meta';
    meta.textContent = `${kategoriEmoji} ${kategoriText}`;
    wrapper.appendChild(meta);

    const rubrik = document.createElement('h3');
    rubrik.className = 'assistent-svar-rubrik';
    rubrik.innerHTML = svarObj.rubrik || (svarObj.kategori === 'site' ? 'Om hemsidan' : 'Resultat');
    wrapper.appendChild(rubrik);

    const body = document.createElement('div');
    body.className = 'assistent-svar-body';
    body.innerHTML = svarObj.innehall || '';
    wrapper.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'assistent-svar-actions';

    [...(svarObj.actions || []), { label: '📤 Dela denna fråga', action: 'share', fraga }].forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'assistent-action-btn';
        btn.textContent = a.label;
        btn.dataset.action = a.action || '';
        if (a.href) btn.dataset.href = a.href;
        if (a.pizzeria) btn.dataset.pizzeria = a.pizzeria;
        if (a.sok !== undefined) btn.dataset.sok = a.sok;
        if (a.fraga) btn.dataset.fraga = a.fraga;
        actions.appendChild(btn);
    });

    wrapper.appendChild(actions);
    svarEl.innerHTML = '';
    svarEl.appendChild(wrapper);
}

function appliceraAssistentPizzeriaFilter(pizzeriaNamn) {
    const rensaBtn = document.getElementById('rensa-filter-btn');
    if (rensaBtn) rensaBtn.click();
    if (!pizzeriaNamn) {
        uppdateraVisning();
        return;
    }

    const cb = [...document.querySelectorAll('#pizzeria-lista input')].find((c) => c.value === pizzeriaNamn);
    if (cb) {
        cb.checked = true;
        togglaPizzeria(pizzeriaNamn, cb);
    } else {
        uppdateraVisning();
    }
}

function appliceraAssistentSokning(sokText, pizzeriaNamn = '') {
    const rensaBtn = document.getElementById('rensa-filter-btn');
    if (rensaBtn) rensaBtn.click();

    if (pizzeriaNamn) {
        const cb = [...document.querySelectorAll('#pizzeria-lista input')].find((c) => c.value === pizzeriaNamn);
        if (cb) {
            cb.checked = true;
            togglaPizzeria(pizzeriaNamn, cb);
        }
    }

    const sokruta = document.getElementById('sokruta');
    if (sokruta) sokruta.value = sokText || '';
    uppdateraVisning();
}

function skapaDelaFragaUrl(fraga) {
    const url = new URL(window.location.href);
    if (fraga) {
        url.searchParams.set('assistq', fraga);
    } else {
        url.searchParams.delete('assistq');
    }
    return url.toString();
}

async function delaFraga(fraga, svarEl) {
    const url = skapaDelaFragaUrl(fraga);
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            if (svarEl) svarEl.setAttribute('data-share-status', 'Länk kopierad');
            return;
        }
    } catch {
        // fall through to prompt fallback
    }
    window.prompt('Kopiera den här länken:', url);
    if (svarEl) svarEl.setAttribute('data-share-status', 'Länk skapad');
}

// --- Unified Search (AI + Normal) ---

function oppnaAiLageSida(fraga = '') {
    const aiPath = arLokalUtveckling() ? 'ai-lage.html' : '/ai-lage.html';
    const url = new URL(aiPath, window.location.href);
    const sanerad = validateAndSanitizeInput(fraga || '');
    if (sanerad) {
        url.searchParams.set('q', sanerad);
    }
    document.body.classList.add('ai-redirecting');
    setTimeout(() => {
        window.location.href = url.toString();
    }, 140);
}

function updateAiToggleBtnUI() {
    const toggleBtn = document.getElementById('ai-toggle-btn');
    const iconSpan = toggleBtn?.querySelector('.ai-toggle-icon');
    const textSpan = toggleBtn?.querySelector('.ai-toggle-text');
    
    if (toggleBtn && iconSpan && textSpan) {
        iconSpan.textContent = '✨';
        textSpan.textContent = 'Fråga AI';
        toggleBtn.setAttribute('aria-pressed', 'false');
        toggleBtn.title = 'Öppna AI-läge';
    }
}

function visaMiniAiTeaser(fraga, intentMode = 'ai') {
    const box = document.getElementById('ai-mini-svar');
    const textEl = document.getElementById('ai-mini-svar-text');
    const openBtn = document.getElementById('ai-mini-opna');
    if (!box || !textEl || !openBtn) return;

    const norm = normaliseraText(fraga || '');
    let teaser = '💡 Jag kan ge ett snabbt svar här, eller hela svaret i AI-chatten.';
    let cta = 'Få hela svaret →';

    if (norm.includes('kontakt') || norm.includes('mail') || norm.includes('e-post')) {
        teaser = '💡 kontakt@billigapizzor.se';
        cta = 'Visa i AI →';
    } else if (norm.includes('integritet') || norm.includes('cookie')) {
        teaser = '💡 Integritet, cookies och policy kan öppnas direkt i AI-läge.';
        cta = 'Se mer →';
    } else if (norm.includes('kostar') || norm.includes('pris')) {
        teaser = '💡 Jag kan räkna prisintervall och ge jämförelse på några sekunder.';
        cta = 'Få hela svaret →';
    } else if (intentMode === 'mixed') {
        teaser = '💡 Jag tolkar detta som en fråga och kan förklara mer i chatten.';
        cta = 'Se mer →';
    }

    textEl.textContent = teaser;
    openBtn.textContent = cta;
    box.classList.remove('ai-mini-svar--dold');
}

function doljMiniAiTeaser() {
    const box = document.getElementById('ai-mini-svar');
    if (!box) return;
    box.classList.add('ai-mini-svar--dold');
}

function toggleAiMode() {
    oppnaAiLageSida('');
}

function updateAiHintVisibility() {
    const hint = document.getElementById('ai-hint');
    if (!hint) return;
    
    if (aiMode) {
        hint.classList.add('ai-hint-dold');
    } else {
        hint.classList.remove('ai-hint-dold');
    }
}

function setAiSvarRubrik(mode = 'ai') {
    const rubrikEl = document.getElementById('ai-svar-rubrik');
    if (!rubrikEl) return;

    if (mode === 'mixed') {
        rubrikEl.textContent = '💡 Svar pa din fraga (tolkning)';
        rubrikEl.classList.add('ai-svar-rubrik--mixed');
        return;
    }

    rubrikEl.textContent = '✨ AI-svar';
    rubrikEl.classList.remove('ai-svar-rubrik--mixed');
}

function triggerAiAutoFeedback() {
    const sokrutaEl = document.getElementById('sokruta');
    if (!sokrutaEl) return;
    sokrutaEl.classList.add('ai-auto-activated');
    setTimeout(() => sokrutaEl.classList.remove('ai-auto-activated'), 450);
}

function scoreSearchIntent(text) {
    const norm = normaliseraText(text).trim();
    if (!norm) {
        return { mode: 'normal', confidence: 0, questionScore: 0, pizzaScore: 0 };
    }

    const frageord = ['hur', 'vad', 'varfor', 'vilken', 'vilka', 'var', 'nar', 'kan', 'far', 'kostar', 'billigaste', 'dyraste'];
    const aiPhrases = [
        'beratta om',
        'beratta mer',
        'om er',
        'vem ar ni',
        'varfor sidan',
        'om hemsidan',
        'om sidan',
        'kontakt',
        'integritet',
        'hjalp mig'
    ];

    const pizzaSokOrd = [
        'pizza', 'pizzor', 'kebab', 'vesuvio', 'capricciosa', 'hawaii', 'ananas', 'skinka',
        'salami', 'vegetar', 'oxfile', 'kyckling', 'rakor', 'margarita', 'margherita',
        'lindome', 'kallered', 'molndal', 'krokslatt'
    ];

    let questionScore = 0;
    let pizzaScore = 0;

    if (frageord.some(ord => norm.startsWith(ord) || norm.includes(` ${ord} `))) questionScore += 2;
    if (aiPhrases.some(phrase => norm.includes(phrase))) questionScore += 3;
    if (text.includes('?')) questionScore += 2;

    const ordLista = norm.split(/\s+/).filter(Boolean);
    if (ordLista.length >= 5) questionScore += 1;
    if ((norm.includes('hur ') || norm.includes('vad ')) && (norm.includes('kostar') || norm.includes('far') || norm.includes('finns'))) {
        questionScore += 2;
    }

    pizzaSokOrd.forEach((ord) => {
        if (norm.includes(ord)) pizzaScore += 1;
    });

    if (ordLista.length <= 2 && pizzaSokOrd.some(ord => norm.includes(ord))) {
        pizzaScore += 2;
    }

    const diff = questionScore - pizzaScore;
    if (diff >= 2) {
        return { mode: 'ai', confidence: Math.abs(diff), questionScore, pizzaScore };
    }
    if (diff <= -2) {
        return { mode: 'normal', confidence: Math.abs(diff), questionScore, pizzaScore };
    }

    return { mode: 'mixed', confidence: Math.abs(diff), questionScore, pizzaScore };
}

function isQuestionInput(text) {
    return scoreSearchIntent(text).mode !== 'normal';
}

function isLikelyPizzaSearchInput(text) {
    return scoreSearchIntent(text).mode === 'normal';
}

function behallPizzorVidAiFraga() {
    const sokrutaEl = document.getElementById('sokruta');
    if (!sokrutaEl) return;

    const aktuellText = sokrutaEl.value;
    sokrutaEl.value = '';
    uppdateraVisning();
    sokrutaEl.value = aktuellText;
}

function populateAiSnabbfragor() {
    const chipsContainer = document.querySelector('.ai-snabbfragor-chips');
    if (!chipsContainer) return;
    
    chipsContainer.innerHTML = '';
    
    const snabbfragorList = [
        'Billigaste pizzan',
        'Snittpris',
        '1000 kr',
        'Billig kebabpizza',
        'Vegetarisk pizza',
        'Varför sidan?',
        'Kontakt'
    ];
    
    snabbfragorList.forEach((fraga) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = fraga;
        btn.className = 'ai-snabbfragor-chip';
        btn.addEventListener('click', () => {
            const sokruta = document.getElementById('sokruta');
            if (sokruta) {
                sokruta.value = fraga;
                sokruta.dispatchEvent(new Event('input'));
                sokruta.focus();
            }
        });
        chipsContainer.appendChild(btn);
    });
}

function handleUnifiedSearch(sokText, options = {}) {
    const { mode = 'ai' } = options;
    if (!sokText.trim()) {
        const container = document.getElementById('ai-svar-container');
        setAiSvarRubrik('ai');
        if (container) container.textContent = '💡 Ställ en fråga för att få ett direkt svar från menydatan.';
        return;
    }

    setAiSvarRubrik(mode === 'mixed' ? 'mixed' : 'ai');
    
    // Run assistant logic (with security layer)
    const svarObj = svaraPaPizzaFraga(sokText);
    renderaAssistentSvarSafe(document.getElementById('ai-svar-container'), svarObj, sokText);
    
    // Handle action buttons
    document.getElementById('ai-svar-container').addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const action = target.dataset.action || '';
        if (action === 'openLink' && target.dataset.href) {
            window.location.href = hamtaNavigeringsLankForPizzeria(target.dataset.href);
        } else if (action === 'visaPizzeria') {
            appliceraAssistentPizzeriaFilter(target.dataset.pizzeria || '');
            aiMode = false;
            document.getElementById('ai-toggle-btn').click();
        } else if (action === 'visaSokning') {
            appliceraAssistentSokning(target.dataset.sok || '', target.dataset.pizzeria || '');
            aiMode = false;
            document.getElementById('ai-toggle-btn').click();
        } else if (action === 'share') {
            delaFraga(sokText, document.getElementById('ai-svar-container'));
        }
    }, { once: true });
}

function initUnifiedSearch() {
    const toggleBtn = document.getElementById('ai-toggle-btn');
    if (!toggleBtn) return;
    
    // Initialize UI
    updateAiHintVisibility();
    updateAiToggleBtnUI();
    
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleAiMode();
    });

    const miniBox = document.getElementById('ai-mini-svar');
    const miniOpenBtn = document.getElementById('ai-mini-opna');
    const openAiFromTeaser = () => {
        const sokruta = document.getElementById('sokruta');
        oppnaAiLageSida(sokruta?.value || '');
    };

    if (miniBox) {
        miniBox.addEventListener('click', openAiFromTeaser);
        miniBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openAiFromTeaser();
            }
        });
    }

    if (miniOpenBtn) {
        miniOpenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAiFromTeaser();
        });
    }
    
    // Check for ?assistq= URL param and forward to dedicated AI page
    const params = new URLSearchParams(window.location.search);
    const assistqRaw = params.get('assistq');
    const assistq = assistqRaw ? validateAndSanitizeInput(assistqRaw) : null;
    
    if (assistq) {
        oppnaAiLageSida(assistq);
    }
}

function initPizzaAssistent() {
    const sektion = document.getElementById('pizza-assistent');
    const input = document.getElementById('pizza-assistent-input');
    const knapp = document.getElementById('pizza-assistent-knapp');
    const svarEl = document.getElementById('pizza-assistent-svar');

    if (!sektion || !input || !knapp || !svarEl) return;

    const svara = () => {
        const fraga = input.value;
        const svarObj = svaraPaPizzaFraga(fraga);
        renderaAssistentSvar(svarEl, svarObj, fraga);
    };

    knapp.addEventListener('click', svara);
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        svara();
    });

    document.querySelectorAll('.assistent-fraga-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            input.value = chip.dataset.fraga || '';
            svara();
        });
    });

    svarEl.addEventListener('click', (e) => {
        const target = e.target.closest('.assistent-action-btn');
        if (!target) return;

        const action = target.dataset.action || '';
        if (action === 'openLink' && target.dataset.href) {
            window.location.href = hamtaNavigeringsLankForPizzeria(target.dataset.href);
        } else if (action === 'visaPizzeria') {
            appliceraAssistentPizzeriaFilter(target.dataset.pizzeria || '');
        } else if (action === 'visaSokning') {
            appliceraAssistentSokning(target.dataset.sok || '', target.dataset.pizzeria || '');
        } else if (action === 'fraga' && target.dataset.fraga) {
            input.value = target.dataset.fraga;
            svara();
        } else if (action === 'focusInput') {
            input.focus();
            input.select();
        } else if (action === 'share') {
            delaFraga(target.dataset.fraga || input.value || '', svarEl);
        }
    });

    const fromUrl = new URLSearchParams(window.location.search).get('assistq');
    if (fromUrl) {
        input.value = fromUrl;
        svara();
    }
}

function uppdateraNarmastStatus(text, arFel = false) {
    const statusEl = document.getElementById('narmast-status');
    if (!statusEl) return;
    statusEl.innerText = text;
    statusEl.classList.toggle('error', arFel);
}

function resetNearbyMode() {
    isNearbyActive = false;
    anvandarPosition = null;
    uppdateraNarmastStatus('');
    const narmastBtn = document.getElementById('narmast-btn');
    if (narmastBtn) narmastBtn.classList.remove('narmast-aktiv');
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
            () => reject(new Error('Kunde inte hämta din position')),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: forceRefresh ? 0 : 300000
            }
        );
    });
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

function sortByDistance(pizzor, userLat, userLng) {
    return [...pizzor]
        .map((pizza) => {
            const dynamicKey = skapaPizzeriaCoordsNyckel(pizza.pizzeria, pizza.adress);
            const dynamicCoords = indexCoordsMap ? indexCoordsMap.get(dynamicKey) : null;
            const staticCoords = ADRESS_COORDS[pizza.adress];
            const coords = dynamicCoords || staticCoords;
            const distansKm = coords
                ? calculateDistance(userLat, userLng, coords.lat, coords.lng)
                : Number.POSITIVE_INFINITY;

            return {
                ...pizza,
                distansKm
            };
        })
        .sort((a, b) => {
            if (a.distansKm !== b.distansKm) return a.distansKm - b.distansKm;
            return a.pizza_namn.localeCompare(b.pizza_namn, 'sv');
        });
}

let pizzeriorCoordsMapPromise = null;

function skapaPizzeriaCoordsNyckel(pizzeriaNamn, adress) {
    const namn = normaliseraText(pizzeriaNamn || '');
    const adr = normaliseraText(adress || '');
    return `${namn}|||${adr}`;
}

function hamtaCoordsFranStatiskLista(adress) {
    if (!adress) return null;

    const exact = ADRESS_COORDS[adress];
    if (exact) return exact;

    const nyckel = normaliseraText(adress);
    for (const [k, v] of Object.entries(ADRESS_COORDS)) {
        if (normaliseraText(k) === nyckel) return v;
    }

    return null;
}

function hamtaPizzeriorCoordsMap() {
    if (pizzeriorCoordsMapPromise) return pizzeriorCoordsMapPromise;

    pizzeriorCoordsMapPromise = fetch('/data/pizzerior_coords.json')
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Kunde inte hämta pizzerior_coords.json (${response.status})`);
            }
            return response.json();
        })
        .then((rows) => {
            const map = new Map();
            if (!Array.isArray(rows)) return map;

            rows.forEach((row) => {
                const lat = Number(row?.lat);
                const lng = Number(row?.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                const nyckel = skapaPizzeriaCoordsNyckel(row?.pizzeria, row?.adress);
                if (!nyckel || nyckel === '|||') return;

                map.set(nyckel, { lat, lng });
            });

            return map;
        })
        .catch((error) => {
            console.error('[Narmast mig] Kunde inte ladda /data/pizzerior_coords.json:', error);
            return new Map();
        });

    return pizzeriorCoordsMapPromise;
}

function kopplaCoordsTillPizzerior(pizzerior, coordsMap) {
    const saknarCoords = [];

    const listaMedCoords = pizzerior.map((pizzeria) => {
        const nyckel = skapaPizzeriaCoordsNyckel(pizzeria.namn, pizzeria.adress);
        const franMap = coordsMap.get(nyckel) || null;
        const franStatisk = hamtaCoordsFranStatiskLista(pizzeria.adress);
        const coords = franMap || franStatisk;

        if (!coords) {
            saknarCoords.push(`${pizzeria.namn} | ${pizzeria.adress}`);
        }

        return {
            ...pizzeria,
            lat: coords?.lat,
            lng: coords?.lng
        };
    });

    if (saknarCoords.length > 0) {
        console.warn(`[Narmast mig] ${saknarCoords.length} pizzerior saknar coords.`, saknarCoords.slice(0, 25));
    }

    return listaMedCoords;
}

function sorteraPizzeriorEfterDynamiskDistans(pizzerior, userLat, userLng) {
    return pizzerior
        .map((pizzeria) => {
            const harCoords = Number.isFinite(pizzeria.lat) && Number.isFinite(pizzeria.lng);
            const distansKm = harCoords
                ? calculateDistance(userLat, userLng, pizzeria.lat, pizzeria.lng)
                : Number.POSITIVE_INFINITY;

            return {
                ...pizzeria,
                distansKm
            };
        })
        .sort((a, b) => {
            if (a.distansKm !== b.distansKm) return a.distansKm - b.distansKm;
            return (a.namn || '').localeCompare((b.namn || ''), 'sv');
        });
}

function gtmPushKlick(data) { // GTM tracking
    if (gtmSuppressNextPizzaKortEvent && data && data.event === 'klick' && data.typ === 'pizza') { // GTM tracking
        gtmSuppressNextPizzaKortEvent = false; // GTM tracking
        return; // GTM tracking
    } // GTM tracking
    window.dataLayer = window.dataLayer || []; // GTM tracking
    window.dataLayer.push(data); // GTM tracking
} // GTM tracking

function gtmTrackScrollDjup() { // GTM tracking
    const doc = document.documentElement; // GTM tracking
    const maxScroll = doc.scrollHeight - window.innerHeight; // GTM tracking
    if (maxScroll <= 0) return; // GTM tracking
    const procent = Math.min(100, Math.round((window.scrollY / maxScroll) * 100)); // GTM tracking
    [25, 50, 75, 100].forEach((steg) => { // GTM tracking
        if (procent >= steg && !gtmScrollStegSkickade.has(steg)) { // GTM tracking
            gtmScrollStegSkickade.add(steg); // GTM tracking
            gtmPushKlick({ event: 'scroll', procent: steg }); // GTM tracking
        } // GTM tracking
    }); // GTM tracking
} // GTM tracking

function gtmInitNavbarTracking() { // GTM tracking
    document.querySelectorAll('.nav-links a').forEach((lank) => { // GTM tracking
        lank.addEventListener('click', () => { // GTM tracking
            gtmPushKlick({ event: 'klick', typ: 'navbar', namn: lank.textContent.trim() }); // GTM tracking
        }); // GTM tracking
    }); // GTM tracking
} // GTM tracking

let gtmPizzaKortTrackingInitierad = false; // GTM tracking

function gtmInitPizzaKortTracking() { // GTM tracking
    if (gtmPizzaKortTrackingInitierad) return; // GTM tracking
    gtmPizzaKortTrackingInitierad = true; // GTM tracking

    document.addEventListener('click', function(event) { // GTM tracking
        const kort = event.target.closest('#resultat-lista .pizza-kort'); // GTM tracking
        if (!kort) return; // GTM tracking

        const klickadLank = event.target.closest('a'); // GTM tracking
        let typ = 'pizza'; // GTM tracking

        if (klickadLank) { // GTM tracking
            const href = klickadLank.getAttribute('href') || ''; // GTM tracking
            if (href.startsWith('tel:')) typ = 'telefon'; // GTM tracking
            else if (href.includes('google.com/maps/search')) typ = 'karta'; // GTM tracking
            else typ = 'lank'; // GTM tracking
        } // GTM tracking

        gtmPushKlick({ // GTM tracking
            event: 'klick', // GTM tracking
            typ: typ, // GTM tracking
            pizza: kort.dataset.pizza || '', // GTM tracking
            pizzeria: kort.dataset.pizzeria || '', // GTM tracking
            omrade: kort.dataset.omrade || '', // GTM tracking
            pris: kort.dataset.pris || '' // GTM tracking
        }); // GTM tracking
    }); // GTM tracking
} // GTM tracking

// --- Routing + Data Normalization ---
const DYNAMISK_PIZZERIA_BASSIDA = '/pizzerior';

function normaliseraPizzeriaNamn(namn) {
    return (namn || '').toLowerCase().trim();
}

function skapaPizzeriaSlug(namn) {
    return (namn || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(pizzeria|restaurang|resturang)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function skapaDynamiskPizzeriaLank(namn) {
    return `${DYNAMISK_PIZZERIA_BASSIDA}/${skapaPizzeriaSlug(namn)}`;
}

function hamtaPizzeriaSlugFranUrl() {
    const params = new URLSearchParams(window.location.search || '');
    const slugFranQuery = (params.get('slug') || '').trim().toLowerCase();
    if (slugFranQuery) {
        return slugFranQuery;
    }

    const match = (window.location.pathname || '').match(/\/pizzerior\/([^/?#]+)\/?$/i);
    if (!match || !match[1]) {
        return '';
    }

    const slug = decodeURIComponent(match[1]).toLowerCase();
    if (slug === 'pizzeria' || slug === 'pizzeria.html') {
        return '';
    }

    return slug;
}

function hamtaPizzeriaNamnFranQuery() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('pizzeria') || '').trim();
}

function skapaPizzeriorSidaDataFranJson(data) {
    const infoPerPizzeria = new Map();

    data.forEach((pizza) => {
        const nyckel = normaliseraPizzeriaNamn(pizza.pizzeria);
        if (!infoPerPizzeria.has(nyckel)) {
            infoPerPizzeria.set(nyckel, {
                namn: pizza.pizzeria || '',
                adress: pizza.adress || '',
                telefon: pizza.telefon || '',
                hemsida: pizza.hemsida || '',
                omrade: pizza.omrade || '',
                stad: pizza.stad || ''
            });
        }
    });

    const slugAnvandning = new Map();

    return Array.from(infoPerPizzeria.values()).map((pizzeria) => {
        const basSlug = skapaPizzeriaSlug(pizzeria.namn) || 'pizzeria';
        const redanAnvand = slugAnvandning.get(basSlug) || 0;
        const slug = redanAnvand === 0 ? basSlug : `${basSlug}-${redanAnvand + 1}`;
        slugAnvandning.set(basSlug, redanAnvand + 1);

        return {
            namn: pizzeria.namn,
            slug,
            telefon: pizzeria.telefon,
            adress: pizzeria.adress,
            hemsida: pizzeria.hemsida,
            omrade: pizzeria.omrade,
            stad: pizzeria.stad,
            länk: `${DYNAMISK_PIZZERIA_BASSIDA}/${slug}`
        };
    });
}

// --- SEO: Schema.org JSON-LD ---

function parsaAdress(adress) {
    if (!adress) return {};
    const m = adress.match(/^(.+?),\s*(\d{3}\s?\d{2})\s+(.+)$/);
    if (m) {
        return { streetAddress: m[1].trim(), postalCode: m[2].trim(), addressLocality: m[3].trim() };
    }
    return { streetAddress: adress };
}

function injecteraJsonLd(data, id) {
    const befintlig = document.getElementById(id);
    if (befintlig) befintlig.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
}

function byggItemListSchema(pizzerior) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': 'Billiga pizzor i Mölndal',
        'itemListElement': pizzerior.map((p, i) => {
            const adr = parsaAdress(p.adress);
            const adressObj = { '@type': 'PostalAddress', 'addressRegion': p.stad || 'Mölndal', 'addressCountry': 'SE' };
            if (adr.streetAddress) adressObj.streetAddress = adr.streetAddress;
            if (adr.postalCode) adressObj.postalCode = adr.postalCode;
            if (adr.addressLocality) adressObj.addressLocality = adr.addressLocality;
            return {
                '@type': 'ListItem',
                'position': i + 1,
                'url': `https://billigapizzor.se/pizzerior/${p.slug}`,
                'item': { '@type': 'Restaurant', 'name': p.namn, 'address': adressObj }
            };
        })
    };
}

function byggRestaurantSchema(pizzeriaInfo, pizzeriaNamn) {
    const adr = parsaAdress(pizzeriaInfo.adress);
    const adressObj = { '@type': 'PostalAddress', 'addressRegion': pizzeriaInfo.stad || 'Mölndal', 'addressCountry': 'SE' };
    if (adr.streetAddress) adressObj.streetAddress = adr.streetAddress;
    if (adr.postalCode) adressObj.postalCode = adr.postalCode;
    if (adr.addressLocality) adressObj.addressLocality = adr.addressLocality;
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        'name': pizzeriaNamn,
        'address': adressObj
    };
    if (pizzeriaInfo.telefon) schema.telephone = pizzeriaInfo.telefon;
    if (pizzeriaInfo.hemsida) schema.url = pizzeriaInfo.hemsida;
    return schema;
}

function initSchemaGenerellSida() {
    // Pages with dedicated inits handle schema themselves
    if (document.getElementById('filter-sektion') || document.getElementById('pizzerior-lista') || document.getElementById('pizzeria-sida-root')) {
        return;
    }
    const djup = window.location.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean).length;
    const dataSokvag = djup >= 2 ? '../../data/pizzor.json' : djup === 1 ? '../data/pizzor.json' : 'data/pizzor.json';
    fetch(dataSokvag)
        .then(r => r.json())
        .then(data => {
            injecteraJsonLd(byggItemListSchema(skapaPizzeriorSidaDataFranJson(data)), 'schema-itemlist');
        });
}

// --- UI Data Sources ---
// --- DIN MANUELLA LISTA PÅ INGREDIENSER ---
const MANUELLA_INGREDIENSER = [
    "Ananas", "Aubergine", "Avokado", "Bacon", "Banan", "Basilika", "Basilikapesto",
    "BBQ-sås", "Bearnaisesås", "Biffkebab", "Brieost", "Briochebröd", "Broccoli",
    "Buffelmozzarella", "Caesardressing", "Cayennepeppar", "Champinjoner", "Cheddarost",
    "Cheddarsås", "Chevré", "Chiliflakes", "Chilimajonnäs", "Chilimayo", "Chiliolja",
    "Citron", "Coleslaw", "Crème fraiche", "Crispy kyckling", "Curry", "Currysås",
    "Dipsås", "Dressing", "Dönerkött", "Falafel", "Feferoni", "Fetaost", "Fior di latte",
    "Fisk", "Florsocker", "Fläskfilé", "Fläskkebab", "Friterad kyckling", "Fårost",
    "Fänkålssalami", "Färsk basilika", "Färsk mozzarella", "Färsk paprika", "Färsk tomat",
    "Färsk vitlök", "Färska champinjoner", "Färska räkor", "Färska tomater",
    "Getost", "Godis", "Gorgonzola", "Gouda", "Grillad kyckling", "Grillad kycklingfilé",
    "Grillad tomat", "Grillade grönsaker", "Grillat kött", "Grillat lammfärsspett",
    "Grädde", "Gräddfil", "Gräddsås", "Grönsaker", "Gurka", "Hallon", "Hallonsås",
    "Halloumi", "Hamburgare", "Hamburgerdressing", "Handskalade räkor", "Heta kryddor",
    "Honung", "Högrevsfärs", "Inlagd gurka", "Isbergssallad", "Jalapeño", "Jordnötter",
    "Kalvfond", "Kapris", "Kebab", "Kebabkrydda", "Kebabkött", "Kebabsås", "Kebabsås stark",
    "Ketchup", "Korv", "Krabba", "Krabbfish", "Krabbstick", "Krispsallad", "Kronärtskocka",
    "Kryddor", "Kräftor", "Kräftstjärtar", "Kyckling", "Kyckling nuggets", "Kycklingfilé",
    "Kycklingfiléspett", "Kycklingkebab", "Kycklingvingar", "Körsbärstomater", "Köttfärs",
    "Köttfärssås", "Lammfärsspett", "Lammracks", "Lammytterfilé", "Lax", "Lime",
    "Lufttorkad skinka", "Lök", "Lökringar", "Majonnäs", "Majs", "Mandarin", "Mangochutney",
    "Marinerad kyckling", "Mixsallad", "Mjukost", "Mozzarella", "Mumssås", "Musslor",
    "Nachochips", "Nachos", "Nutella", "Nötfärs", "Nötkebab", "Nötkött", "Nötter",
    "Oliver", "Olivolja", "Ost", "Oxfilé", "Oxkött", "Panering", "Paprika", "Parmaskinka",
    "Parmesan", "Parmigiano", "Peperoni", "Peppar", "Pepparjack ost", "Pepperoni",
    "Persilja", "Persiskt ris", "Pesto", "Picklad gurka", "Pinjenötter", "Piri-piri",
    "Pizzaost", "Pommes", "Pommes frites", "Potatis", "Prosciutto", "Pulled pork",
    "Purjolök", "Remouladsås", "Rhode islandsås", "Ricotta", "Ris", "Riven parmesan",
    "Rostad lök", "Ruccola", "Ruccolasallad", "Rå lök", "Räfflad potatis", "Räkor",
    "Röd paprika", "Rödkål", "Rödlök", "Rödvin", "Saffran", "Salami", "Sallad",
    "Salladost", "Saltgurka", "San marzano tomatsås", "Sardeller", "Scampi", "Schnitzel",
    "Senap", "Skaldjur", "Skinka", "Smältost", "Soltorkade tomater", "Sparris", "Spenat",
    "Sriracha", "Sriracha mayo", "Stark kebabsås", "Stark korv", "Stark krydda", "Stark sås",
    "Starka kryddor", "Starksås", "Stekt ägg", "Strimlad biff", "Stureost", "Svartpeppar",
    "Sås", "Tabasco", "Taco kryddmix", "Tacosås", "Tomat", "Tomater", "Tomatsås", "Tonfisk",
    "Tryffelmajonnäs", "Tryffelolja", "Tzatziki", "Tärnad tomat", "Valfri dressing",
    "Valfri sås", "Valnötter", "Vegetarisk biff", "Veggieburgare", "Veggokorv",
    "Vegmozzarella", "Vitlök", "Vitlöksdressing", "Vitlökssås", "Zucchini",
    "Ädelost", "Ägg", "Ärtor", "Örter", "Örtkrydda"
];

function formatIngrediensDisplayNamn(ingrediens) {
    const trim = String(ingrediens || '').trim().replace(/\s+/g, ' ');
    if (!trim) return '';
    return trim.charAt(0).toUpperCase() + trim.slice(1);
}

function hamtaDynamiskaIngredienserFranData(pizzor) {
    const canonicalByNorm = new Map(
        MANUELLA_INGREDIENSER.map((namn) => [normaliseraText(namn), namn])
    );
    const unikaByNorm = new Map();

    (Array.isArray(pizzor) ? pizzor : []).forEach((pizza) => {
        if (!Array.isArray(pizza?.ingredienser)) return;
        pizza.ingredienser.forEach((ingrediens) => {
            const trim = String(ingrediens || '').trim();
            // Strip parenthetical suffixes like "(8 bitar)" so duplicates merge
            const cleaned = trim.replace(/\s*\([^)]*\)\s*$/, '').trim();
            const norm = normaliseraText(cleaned);
            if (!norm) return;
            if (unikaByNorm.has(norm)) return;
            unikaByNorm.set(norm, canonicalByNorm.get(norm) || formatIngrediensDisplayNamn(cleaned));
        });
    });

    return [...unikaByNorm.values()].sort((a, b) => a.localeCompare(b, 'sv'));
}

function initIndexSida() {
    const sokruta = document.getElementById('sokruta');
    const antalTraffar = document.getElementById('antal-traffar-container');
    const prisSortering = document.getElementById('pris-sortering');
    const resultatLista = document.getElementById('resultat-lista');

    if (!sokruta || !antalTraffar || !prisSortering || !resultatLista) {
        return;
    }

    document.body.classList.add('index-kort-lage');
    initHeroLasMerForApp();

    // Visa skeleton-laddning medan data hämtas
    const resultatListaSkel = document.getElementById('resultat-lista');
    if (resultatListaSkel) {
        const skelFragment = document.createDocumentFragment();
        for (let i = 0; i < 8; i++) {
            const skel = document.createElement('div');
            skel.className = 'pizza-kort-skeleton';
            skel.innerHTML = [
                '<div class="skeleton-line skeleton-line--title"></div>',
                '<div class="skeleton-line skeleton-line--mid"></div>',
                '<div class="skeleton-line skeleton-line--short"></div>',
                '<div class="skeleton-line skeleton-line--long"></div>'
            ].join('');
            skelFragment.appendChild(skel);
        }
        resultatListaSkel.appendChild(skelFragment);
    }

    Promise.all([
        fetch('data/pizzor.json').then(r => r.json()),
        hamtaPizzeriorCoordsMap()
    ])
        .then(([data, coordsMap]) => {
            allaPizzor = data;
            indexCoordsMap = coordsMap;
            injecteraJsonLd(byggItemListSchema(skapaPizzeriorSidaDataFranJson(data)), 'schema-itemlist');

            const antalPizzor = data.length;
            const hundratal = Math.floor(antalPizzor / 100) * 100;
            const etikett = `${hundratal}+`;

            const heroIntro = document.querySelector('.hero-intro');
            if (heroIntro) heroIntro.textContent = heroIntro.textContent.replace(/\d+\+/, etikett);

            const bottenLi = document.querySelector('.hf-icon.hf-green + span');
            if (bottenLi) bottenLi.textContent = bottenLi.textContent.replace(/\d+\+/, etikett);

            const statsAntal = document.getElementById('stats-pizzor-antal');
            const statsPizzeriorAntal = document.getElementById('stats-pizzerior-antal');
            const pizzeriorCount = new Set(data.map(p => p.pizzeria)).size;
            const statsBar = document.getElementById('stats-bar');
            let statsAnimeringAktiv = false;

            if (statsAntal) statsAntal.textContent = '0+';
            if (statsPizzeriorAntal) statsPizzeriorAntal.textContent = '0';

            triggaNarSynlig(
                statsBar,
                () => {
                    if (statsAnimeringAktiv) return;
                    statsAnimeringAktiv = true;
                    if (statsAntal) countUp(statsAntal, hundratal, '+', 3000);
                    if (statsPizzeriorAntal) countUp(statsPizzeriorAntal, pizzeriorCount, '', 3000);
                },
                () => {
                    statsAnimeringAktiv = false;
                    if (statsAntal) statsAntal.textContent = '0+';
                    if (statsPizzeriorAntal) statsPizzeriorAntal.textContent = '0';
                }
            );

            skapaFilterKnappar();
            initPrisSlider();
            initFranUrl();
            uppdateraVisning(); 
            initUnifiedSearch();
        });

    const laddaFlerBtn = document.getElementById('ladda-fler-btn');
    if (laddaFlerBtn) {
        laddaFlerBtn.onclick = () => {
            pizzorSomVisas += 100;
            visaPizzor(nuvarandeFiltreradLista);
        };
    }

    const narmastBtn = document.getElementById('narmast-btn');
    if (narmastBtn) {
        narmastBtn.onclick = async () => {
            if (geolocationPaminnelsePagar) return;

            geolocationPaminnelsePagar = true;
            narmastBtn.disabled = true;
            uppdateraNarmastStatus('Hämtar din position...');

            try {
                await getUserLocation(true);
                isNearbyActive = true;
                narmastBtn.classList.add('narmast-aktiv');
                uppdateraNarmastStatus('Visar närmaste pizzor');
                uppdateraVisning();
            } catch (error) {
                isNearbyActive = false;
                uppdateraNarmastStatus('Kunde inte hämta din position', true);
            } finally {
                geolocationPaminnelsePagar = false;
                narmastBtn.disabled = false;
            }
        };
    }

    const koraSokflode = () => {
        doljMiniAiTeaser();
        uppdateraVisning();
    };

    sokruta.addEventListener('input', () => { 
        clearTimeout(gtmSokDebounceTimer); // GTM tracking
        gtmSokDebounceTimer = setTimeout(() => { // GTM tracking
            const sökSträng = sokruta.value.toLowerCase(); // GTM tracking
            gtmPushKlick({ event: 'sok', text: sökSträng }); // GTM tracking
        }, 350); // GTM tracking

        pizzorSomVisas = 100;
        clearTimeout(unifiedSearchIntentTimer);
        koraSokflode();
    });

    sokruta.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        clearTimeout(unifiedSearchIntentTimer);
        pizzorSomVisas = 100;
        koraSokflode();
    });

    prisSortering.addEventListener('change', () => { // GTM tracking
        gtmPushKlick({ event: 'klick', typ: 'sortering', val: prisSortering.value }); // GTM tracking
        pizzorSomVisas = 100; uppdateraVisning();
    }); // GTM tracking

    let mobilHintScrollTimer = null;
    window.addEventListener('scroll', () => {
        if (!mobilScrollHintEfterVisaFler) return;

        uppdateraMobilScrollHint(true);

        clearTimeout(mobilHintScrollTimer);
        mobilHintScrollTimer = setTimeout(() => {
            uppdateraMobilScrollHint(false);
        }, 180);
    }, { passive: true });
    window.addEventListener('resize', () => uppdateraMobilScrollHint(false));
    window.addEventListener('resize', uppdateraMobilRensaKnappSynlighet);
    uppdateraMobilScrollHint(false);

    const rensaFilterBtn = document.getElementById('rensa-filter-btn');
    if (rensaFilterBtn) {
        rensaFilterBtn.onclick = () => {
            gtmPushKlick({ event: 'klick', typ: 'rensa_filter' }); // GTM tracking
            valdaPizzerior = []; valdaIngredienser = []; 
            aktivKategori = 'Pizzor (alla)';
            document.getElementById('sokruta').value = '';
            document.getElementById('pris-sortering').value = 'standard';
            document.querySelectorAll('.pizzeria-btn').forEach(k => k.classList.remove('vald-knapp'));
            document.querySelectorAll('.dropdown-innehall input').forEach(cb => cb.checked = false);
            document.querySelectorAll('.kategori-chip').forEach((chip) => chip.classList.remove('kategori-chip--active'));
            const allaKategoriChip = document.querySelector('.kategori-chip[data-kategori="Pizzor (alla)"]');
            if (allaKategoriChip) allaKategoriChip.classList.add('kategori-chip--active');
            document.getElementById('omrade-meny-knapp').innerText = `Välj område... ▼`;
            document.getElementById('ingrediens-meny-knapp').innerText = `Välj ingredienser... ▼`;
            document.getElementById('pizzeria-meny-knapp').innerText = `Välj pizzerior... ▼`;

            document.getElementById('omrade-lista').classList.remove('visa');
            document.getElementById('pizzeria-lista').classList.remove('visa');
            document.getElementById('dropdown-lista').classList.remove('visa');
            const ingrediensSokInput = document.getElementById('ingrediens-sok-input');
            if (ingrediensSokInput) ingrediensSokInput.value = '';
            document.querySelectorAll('#dropdown-lista .dropdown-item').forEach((item) => item.classList.remove('is-hidden'));
            const ingrediensTom = document.getElementById('ingrediens-sok-tomt');
            if (ingrediensTom) ingrediensTom.hidden = true;
            renderValdaIngrediensChips();

            const filterSektion = document.getElementById('filter-sektion');
            const mobilKnapp = document.getElementById('mobil-filter-toggle');
            filterSektion.classList.remove('visa');
            const mobilKnappTextNode = Array.from(mobilKnapp.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
            if (mobilKnappTextNode) mobilKnappTextNode.textContent = '🔍 Visa filter';

            // Also reset price slider
            resetPrisSlider();

            resetNearbyMode();
            uppdateraFilterStegCount();

            pizzorSomVisas = 100;
            uppdateraVisning();
        };
    }
}

// --- Rendering: Pizzeria Cards + Pages ---
function skapaPizzeriaKort(pizzeria) {
    const kort = document.createElement('div');
    kort.className = 'pizza-kort';
    const telefonSanerad = saneraTelefonnummer(pizzeria.telefon);
    const mapsLank = skapaGoogleMapsSokLank(pizzeria.namn, pizzeria.adress);
    const pizzeriaNamnSafe = escapaHtml(pizzeria.namn);
    const adressSafe = escapaHtml(pizzeria.adress);
    const telefonSafe = escapaHtml(pizzeria.telefon);
    const telefonRad = pizzeria.telefon
        ? `<p>📞 <a href="tel:${telefonSanerad}" style="color: #cd212a; text-decoration: none; font-weight: bold;">${telefonSafe}</a></p>`
        : '<p>📞 Telefonnummer saknas</p>';
    const adressRad = pizzeria.adress
        ? `<a href="${mapsLank}" target="_blank" rel="noopener noreferrer" style="color: #008c45; text-decoration: none; font-weight: bold;">📍 ${adressSafe}</a>`
        : '📍 Adress saknas';

    const distansRad = (pizzeria.distansKm !== undefined && pizzeria.distansKm !== Number.POSITIVE_INFINITY)
        ? `<p style="margin-top: 8px; font-size: 0.82em; color: #22a04a; font-weight: 600;">📏 ${pizzeria.distansKm < 1 ? Math.round(pizzeria.distansKm * 1000) + ' m' : pizzeria.distansKm.toFixed(1).replace('.', ',') + ' km'} bort</p>`
        : '';

    kort.innerHTML = `
        <h3>${pizzeriaNamnSafe}</h3>
        ${telefonRad}
        <p style="margin-top: 15px; font-size: 0.85em;">
            ${adressRad}
        </p>
        ${distansRad}
        <button type="button" class="pizzeria-btn pizzeria-btn-visa-meny" style="margin-top: 15px; width: 100%;">Visa meny</button>
    `;

    // Avoid inline onclick so names with apostrophes (e.g. Domino's) do not break the button.
    const visaMenyKnapp = kort.querySelector('.pizzeria-btn-visa-meny');
    if (visaMenyKnapp) {
        visaMenyKnapp.addEventListener('click', () => {
            gtmSpåraPizzeriaKlickOchNavigera(pizzeria.namn, pizzeria.länk);
        });
    }

    return kort;
}

function initPizzeriorSida() {
    const pathname = (window.location.pathname || '').toLowerCase();
    const arPizzeriorListaSida = pathname.includes('pizzerior.html') || pathname === '/pizzerior' || pathname === '/pizzerior/';
    if (!arPizzeriorListaSida) {
        return;
    }

    const lista = document.getElementById('pizzerior-lista');
    if (!lista) {
        return;
    }

    const sokruta = document.getElementById('pizzerior-sokruta');
    const narmastBtn = document.getElementById('pizzerior-narmast-btn');
    const traffarEl = document.getElementById('pizzerior-traffar');

    let allaPizzeriorLista = [];
    let standardSorteradLista = [];
    let coordsKoppladLista = [];
    let narmastAktiv = false;
    let narmastPagar = false;

    function visaPizzerior(pizzerior) {
        lista.innerHTML = '';
        pizzerior.forEach((p) => lista.appendChild(skapaPizzeriaKort(p)));
        if (traffarEl) {
            const n = pizzerior.length;
            if (narmastAktiv) {
                traffarEl.textContent = n === 0
                    ? 'Inga pizzerior hittades'
                    : `Visar topp ${n} närmaste pizzerior`;
            } else {
                traffarEl.textContent = n === 0
                    ? 'Inga pizzerior hittades'
                    : `Hittade ${n} pizzeri${n === 1 ? 'a' : 'or'}`;
            }
        }
    }

    function filtreraPizzerior() {
        const term = sokruta ? normaliseraText(sokruta.value) : '';
        if (!term) return [...allaPizzeriorLista];

        if (arStriktOmradesokterm(term)) {
            return allaPizzeriorLista.filter((p) => normaliseraText(p.omrade || '') === term);
        }

        return allaPizzeriorLista.filter((p) =>
            normaliseraText(p.namn).includes(term) ||
            normaliseraText(p.omrade || '').includes(term) ||
            normaliseraText(p.adress || '').includes(term)
        );
    }

    function uppdateraVisningPizzerior() {
        const filtrerad = filtreraPizzerior();
        const attVisa = narmastAktiv ? filtrerad.slice(0, 10) : filtrerad;
        visaPizzerior(attVisa);
    }

    Promise.all([
        fetch('/data/pizzor.json').then((response) => response.json()),
        hamtaPizzeriorCoordsMap()
    ])
        .then(([data, coordsMap]) => {
            const allaPizzeriorData = skapaPizzeriorSidaDataFranJson(data);
            injecteraJsonLd(byggItemListSchema(allaPizzeriorData), 'schema-itemlist');

            coordsKoppladLista = kopplaCoordsTillPizzerior(allaPizzeriorData, coordsMap);

            standardSorteradLista = [...allaPizzeriorData].sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
            allaPizzeriorLista = [...standardSorteradLista];
            uppdateraVisningPizzerior();
        })
        .catch((error) => {
            console.error('[Pizzerior] Kunde inte initiera data för pizzerior-sidan:', error);
        });

    if (sokruta) {
        sokruta.addEventListener('input', uppdateraVisningPizzerior);
    }

    if (narmastBtn) {
        narmastBtn.addEventListener('click', async () => {
            if (narmastPagar) return;

            if (narmastAktiv) {
                narmastAktiv = false;
                narmastBtn.classList.remove('narmast-aktiv');
                narmastBtn.textContent = '📍 Närmast mig';
                allaPizzeriorLista = standardSorteradLista.map(({ distansKm, ...rest }) => rest);
                uppdateraVisningPizzerior();
                return;
            }

            narmastPagar = true;
            narmastBtn.disabled = true;
            narmastBtn.textContent = 'Hämtar position…';

            try {
                const pos = await getUserLocation(true);
                narmastAktiv = true;
                narmastBtn.classList.add('narmast-aktiv');
                narmastBtn.textContent = 'Räknar avstånd…';

                const kandidater = coordsKoppladLista.length > 0 ? coordsKoppladLista : standardSorteradLista;
                const sorterad = sorteraPizzeriorEfterDynamiskDistans(kandidater, pos.lat, pos.lng);
                allaPizzeriorLista = sorterad.filter((p) => Number.isFinite(p.distansKm));

                narmastBtn.textContent = '📍 Närmast mig';
                uppdateraVisningPizzerior();
            } catch (_e) {
                narmastBtn.textContent = '📍 Närmast mig';
            } finally {
                narmastPagar = false;
                narmastBtn.disabled = false;
            }
        });
    }
}

function initPizzeriaSida() {
    const sidaRoot = document.getElementById('pizzeria-sida-root');
    const titel = document.getElementById('pizzeria-sida-titel');
    const underrubrik = document.getElementById('pizzeria-sida-underrubrik');
    const lista = document.getElementById('resultat-lista');
    const laddaFlerSektion = document.getElementById('ladda-fler-sektion');
    const sokruta = document.getElementById('sokruta');
    const antalTraffar = document.getElementById('antal-traffar-container');

    if (!sidaRoot || !lista || !titel || !underrubrik || !laddaFlerSektion || !sokruta || !antalTraffar) {
        return;
    }

    document.body.classList.add('index-kort-lage');

    const pizzeriaNamnFranQuery = hamtaPizzeriaNamnFranQuery();
    const pizzeriaSlugFranUrl = hamtaPizzeriaSlugFranUrl();
    const fallbackNamn = (sidaRoot.dataset.pizzeria || '').trim();

    fetch('../data/pizzor.json')
        .then(response => response.json())
        .then(data => {
            const register = skapaPizzeriorSidaDataFranJson(data);
            const matchadPizzeriaFranSlug = pizzeriaSlugFranUrl
                ? register.find((pizzeria) => pizzeria.slug === pizzeriaSlugFranUrl)
                : null;
            const pizzeriaNamn = matchadPizzeriaFranSlug?.namn || pizzeriaNamnFranQuery || fallbackNamn;

            if (!pizzeriaNamn) {
                titel.innerText = 'Pizzeria saknas';
                underrubrik.innerText = 'Ingen pizzeria angiven för sidan.';
                lista.innerHTML = '<div class="ingen-traff"><h3>Ingen pizzeria vald</h3><p>Sidan saknar koppling till en pizzeria.</p></div>';
                laddaFlerSektion.style.display = 'none';
                return;
            }

            const soktNamn = pizzeriaNamn.toLowerCase().trim();
            const pizzor = data
                .filter((pizza) => (pizza.pizzeria || '').toLowerCase().trim() === soktNamn)
                .sort((a, b) => a.pizza_namn.localeCompare(b.pizza_namn, 'sv'));

            const pizzeriaInfo = pizzor.find((p) => p.oppettider) || pizzor[0] || null;
            const pizzeriaUnderrad = document.querySelector('.hero-subline');
            const pizzeriaInfoTitel = document.querySelector('.pizzeria-info-header h1');
            const adressLank = document.querySelector('.meta-address-link');
            const metaTelefonLank = document.querySelector('.pizzeria-meta-grid a[href^="tel:"]');
            const hemsidaMetaLank = document.querySelector('.meta-hemsida');
            const stickyCallKnapp = document.querySelector('.sticky-mobile-cta .cta-btn-call');
            const callKnappar = document.querySelectorAll('.pizzeria-cta-row .cta-btn-call');

            if (pizzeriaInfo) {
                const platsDelar = [pizzeriaInfo.omrade, pizzeriaInfo.stad].filter(Boolean).join(', ');
                if (pizzeriaUnderrad && platsDelar) pizzeriaUnderrad.innerText = platsDelar;

                if (pizzeriaInfoTitel) {
                    const titelSuffix = pizzeriaInfo.omrade ? ` i ${pizzeriaInfo.omrade}` : '';
                    pizzeriaInfoTitel.innerText = `${pizzeriaNamn}${titelSuffix} 🍕`;
                }

                if (adressLank && pizzeriaInfo.adress) {
                    adressLank.href = skapaGoogleMapsSokLank(pizzeriaNamn, pizzeriaInfo.adress);
                    adressLank.innerText = pizzeriaInfo.adress;
                }

                if (metaTelefonLank && pizzeriaInfo.telefon) {
                    metaTelefonLank.href = `tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}`;
                    metaTelefonLank.innerText = pizzeriaInfo.telefon;
                }

                if (hemsidaMetaLank) {
                    const hemsidaUrl = saneraExternUrl(pizzeriaInfo.hemsida);
                    if (hemsidaUrl) {
                        hemsidaMetaLank.href = hemsidaUrl;
                        hemsidaMetaLank.innerText = hemsidaUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
                    } else if (hemsidaMetaLank.parentElement) {
                        hemsidaMetaLank.parentElement.style.display = 'none';
                    }
                }

                if (pizzeriaInfo.oppettider && typeof pizzeriaInfo.oppettider === 'object') {
                    const metaGrid = document.querySelector('.pizzeria-meta-grid');
                    if (metaGrid && !metaGrid.querySelector('.meta-item-oppettider')) {
                        const rader = Object.entries(pizzeriaInfo.oppettider)
                            .map(([dag, tid]) => `${escapaHtml(dag)}: ${escapaHtml(tid)}`)
                            .join('<br>');
                        const oppEl = document.createElement('div');
                        oppEl.className = 'meta-item meta-item-oppettider';
                        oppEl.innerHTML = `<span class="meta-label">🕐 Öppettider</span><span class="meta-value">${rader}</span>`;
                        metaGrid.appendChild(oppEl);
                    }
                }

                if (stickyCallKnapp && pizzeriaInfo.telefon) {
                    stickyCallKnapp.href = `tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}`;
                }

                if (callKnappar.length > 0 && pizzeriaInfo.telefon) {
                    callKnappar.forEach((knapp) => {
                        knapp.href = `tel:${saneraTelefonnummer(pizzeriaInfo.telefon)}`;
                    });
                }
            }

            if (pizzeriaInfo) {
                injecteraJsonLd(byggRestaurantSchema(pizzeriaInfo, pizzeriaNamn), 'schema-restaurant');
            }

            const seoEl = document.querySelector('.pizzeria-seo');
            if (seoEl && pizzeriaInfo) {
                const omrade = pizzeriaInfo.omrade || '';
                const stad = pizzeriaInfo.stad || 'Mölndal';
                const omradeText = omrade ? ` i ${omrade}` : '';
                const omradeJmf = omrade ? ` i ${omrade} och ${stad}` : ` i ${stad}`;
                const arSvennepizzan = normaliseraPizzeriaNamn(pizzeriaNamn) === 'svennepizzan';
                if (arSvennepizzan) {
                    seoEl.innerText =
                        `Välkommen till Svennepizzan - Sveriges första medlemspizzeria.\n\n` +
                        `Svennepizzan skapades för att hylla den svenska pizzakulturen och erbjuda en upplevelse som är smartare, godare och enklare. Enkelhet och kvalitet står i centrum, och med endast tio noggrant utvalda pizzor på menyn blir det lätt att välja rätt.\n\n` +
                        `Historien tar sin början med Sven "Svenne" Karlsson, en ung kock som på 1940-talet tog med sig inspiration från Italien hem till Sverige och skapade något unikt - svensk pizza när den är som bäst. Denna filosofi lever vidare i dag genom Fredrik Mattson, hjärnan bakom succén Pinchos, som med Svennepizzan har velat förena tradition och nytänkande i en modern tolkning av den svenska pizzaupplevelsen.\n\n` +
                        `Som medlem får gästen mer än bara en pizza. Med rabatt, dryck, sås och sallad inkluderat erbjuds ett helhetskoncept där värde för pengarna står i fokus. Här hyllas den svenska pizzakulturen genom enkelhet, prisvärdhet och kvalitet, där tio klassiker får låta smakerna tala.\n\n` +
                        `Svennepizzan är en hyllning till det svenska. 🇸🇪🍕`;
                } else {
                    seoEl.innerText =
                        `${pizzeriaNamn}${omradeText} är en populär pizzeria i ${stad}-området. ` +
                        `Här erbjuds en välkomponerad meny med pizzor till bra priser och tydliga ingredienser. ` +
                        (omrade ? `Pizzerian är belägen i ${omrade} och uppskattas av kunder i hela ${stad}. ` : '') +
                        `Se hela menyn med pizzor, ingredienser och priser direkt på den här sidan. ` +
                        `${pizzeriaNamn} är ett bra val för dig som söker god pizza${omradeJmf}. ` +
                        `Jämför priser och hitta din favoritpizza från menyn nedan.`;
                }
            }

            titel.innerText = `${pizzeriaNamn} 🍕`;
            underrubrik.innerText = `Visar ${pizzor.length} pizzor från ${pizzeriaNamn}.`;

            let filtreradLista = pizzor;
            let pizzorSomVisasPizzeria = 100;

            function uppdateraPizzeriaVisning() {
                const sokStrang = sokruta.value.toLowerCase();
                const soktaOrd = sokStrang.split(',').map((ord) => ord.trim()).filter((ord) => ord !== '');
                const resultat = pizzor.filter((pizza) => {
                    const pizzaText = byggPizzaSokText(pizza);
                    return soktaOrd.every((sokt) => hittarOrdet(pizzaText, sokt));
                });
                filtreradLista = resultat;
                antalTraffar.innerText = resultat.length > 0 ? `Hittade ${resultat.length} pizzor` : 'Inga pizzor matchar din sökning';
                visaPizzorPizzeria(filtreradLista);
            }

            function visaPizzorPizzeria(pizzorAttVisa) {
                lista.innerHTML = '';
                if (pizzorAttVisa.length === 0) {
                    lista.innerHTML = '<div class="ingen-traff"><h3>Mamma Mia! 🍕</h3><p>Prova andra sökord.</p></div>';
                    laddaFlerSektion.style.display = 'none';
                    return;
                }

                const urval = pizzorAttVisa.slice(0, pizzorSomVisasPizzeria);
                const fragment = document.createDocumentFragment();
                urval.forEach((pizza) => {
                    const kort = document.createElement('div');
                    kort.className = 'pizza-kort expanded';
                    kort.dataset.pizza = pizza.pizza_namn || '';
                    kort.dataset.pizzeria = pizza.pizzeria || '';
                    kort.dataset.omrade = pizza.omrade || '';
                    kort.dataset.pris = String(pizza.pris ?? '');
                    const mapsLank = skapaGoogleMapsSokLank(pizza.pizzeria, pizza.adress);
                    const hemsidaUrl = saneraExternUrl(pizza.hemsida);
                    const pizzaNamnSafe = escapaHtml(pizza.pizza_namn);
                    const pizzeriaNamnSafe = escapaHtml(pizza.pizzeria);
                    const omradeSafe = escapaHtml(pizza.omrade || 'Mölndal');
                    const telefonSafe = escapaHtml(pizza.telefon);
                    const ingredienserSafe = Array.isArray(pizza.ingredienser) && pizza.ingredienser.length > 0
                        ? pizza.ingredienser.map((ing) => escapaHtml(ing)).join(', ')
                        : 'Information saknas';
                    const adressSafe = escapaHtml(pizza.adress);
                    const pizzeriaDisplay = hemsidaUrl
                        ? `<a href="${hemsidaUrl}" target="_blank" rel="noopener noreferrer">${pizzeriaNamnSafe} 🌐</a>`
                        : pizzeriaNamnSafe;
                    const telefonDisplay = pizza.telefon ? `<p>📞 <a href="tel:${saneraTelefonnummer(pizza.telefon)}" style="color: #cd212a; text-decoration: none; font-weight: bold;">${telefonSafe}</a></p>` : '';

                    kort.innerHTML = `
                        <h3>${pizzaNamnSafe} - ${pizza.pris} kr</h3>
                        <p><strong>${pizzeriaDisplay}</strong> <small>(${omradeSafe})</small></p>
                        ${telefonDisplay}
                        <p style="font-size: 0.9em; color: #555;">Ingredienser: ${ingredienserSafe}</p>
                        <p style="margin-top: 15px; font-size: 0.85em;">
                            <a href="${mapsLank}" target="_blank" rel="noopener noreferrer" style="color: #1f7a4c; text-decoration: none; font-weight: bold;">📍 ${adressSafe}</a>
                        </p>
                    `;
                    fragment.appendChild(kort);
                });
                lista.appendChild(fragment);

                laddaFlerSektion.style.display = pizzorAttVisa.length > pizzorSomVisasPizzeria ? 'block' : 'none';
            }

            sokruta.addEventListener('input', () => {
                pizzorSomVisasPizzeria = 100;
                uppdateraPizzeriaVisning();
            });

            const laddaFlerBtn = document.getElementById('ladda-fler-btn');
            if (laddaFlerBtn) {
                laddaFlerBtn.onclick = () => {
                    pizzorSomVisasPizzeria += 100;
                    visaPizzorPizzeria(filtreradLista);
                };
            }

            uppdateraPizzeriaVisning();
        });
}


function uppdateraInternaLankarForLokalUtveckling() {
    if (!arLokalUtveckling()) {
        return;
    }

    document.querySelectorAll('a[href^="/"]').forEach((lank) => {
        const href = lank.getAttribute('href');
        if (!href || href.endsWith('.html')) {
            return;
        }

        lank.setAttribute('href', hamtaLokalHref(href));
    });
}

function gtmSpåraPizzeriaKlickOchNavigera(namn, länk) { // GTM tracking
    gtmPushKlick({ event: 'klick', typ: 'pizzeria', namn: namn }); // GTM tracking
    window.location.href = hamtaNavigeringsLankForPizzeria(länk); // GTM tracking
} // GTM tracking

// --- UI Interactions ---
function showHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function valjKategori(chip) {
    const kategori = chip.dataset.kategori || 'Pizzor (alla)';

    // Toggle: clicking the already active category resets to default
    if (kategori === aktivKategori && kategori !== 'Pizzor (alla)') {
        aktivKategori = 'Pizzor (alla)';
    } else {
        aktivKategori = kategori;
    }

    // Sync chip active state — mutually exclusive
    document.querySelectorAll('.kategori-chip').forEach((c) => {
        c.classList.toggle('kategori-chip--active', c.dataset.kategori === aktivKategori);
    });

    uppdateraVisning();
}

function toggleMobilMeny() {
    const nav = document.querySelector('.navbar');
    const ikon = document.querySelector('.hamburger-ikon');
    if (!nav || !ikon) return;
    nav.classList.toggle('nav-open');
    ikon.classList.toggle('mobil-meny-aktiv');
}

function closeMobilMeny() {
    const nav = document.querySelector('.navbar');
    const ikon = document.querySelector('.hamburger-ikon');
    if (!nav || !ikon) return;
    nav.classList.remove('nav-open');
    ikon.classList.remove('mobil-meny-aktiv');
}

function togglaFAQ() {
    alert("Frågor & Svar: Vi jämför priser från lokala menyer i Mölndal. Priserna uppdateras löpande. Sidan är under arbete!");
}

function togglaOmOss() {
    const sektion = document.getElementById('om-oss-sektion');
    if (!sektion) return;
    sektion.classList.toggle('visa');
    if (sektion.classList.contains('visa')) {
        sektion.scrollIntoView({ behavior: 'smooth' });
    }
}

function togglaAvanceradeFilter() {
    const filterGrid = document.getElementById('filter-grid');
    const knapp = document.getElementById('avancerade-filter-toggle');
    if (!filterGrid || !knapp) return;

    const arOppen = filterGrid.classList.contains('avf-synlig');
    if (arOppen) {
        filterGrid.classList.remove('avf-synlig');
        filterGrid.classList.add('avf-dold');
        knapp.setAttribute('aria-expanded', 'false');
    } else {
        filterGrid.classList.add('avf-synlig');
        filterGrid.classList.remove('avf-dold');
        knapp.setAttribute('aria-expanded', 'true');
    }
}

function uppdateraAvfCount() {
    const badge = document.getElementById('avf-count');
    if (!badge) return;
    const omradeCount = document.querySelectorAll('#omrade-lista input:checked').length;
    const total = omradeCount + (window.valdaPizzerior ? valdaPizzerior.length : 0) + (window.valdaIngredienser ? valdaIngredienser.length : 0);
    badge.textContent = total > 0 ? String(total) : '';
}

function togglaMobilFilter() {
    gtmPushKlick({ event: 'klick', typ: 'mobil_filter_toggle' }); // GTM tracking
    const filterSektion = document.getElementById('filter-sektion');
    const knapp = document.getElementById('mobil-filter-toggle');

    if (!filterSektion || !knapp) return;

    filterSektion.classList.toggle('filter-hidden-mobile');
    const arDold = filterSektion.classList.contains('filter-hidden-mobile');
    // Update button text while preserving the count-badge span inside the button
    const textNode = Array.from(knapp.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = arDold ? '🔍 Visa filter' : '🔍 Dölj filter';
    uppdateraFilterStegCount();
    uppdateraMobilScrollHint();
}

function togglaLasMer() {
    const textContent = document.getElementById('hero-text-content');
    const btn = document.getElementById('las-mer-btn');

    if (!textContent || !btn) return;

    textContent.classList.toggle('collapsed');
    const arKollapsad = textContent.classList.contains('collapsed');
    btn.textContent = arKollapsad ? 'Läs mer' : 'Visa mindre';
}

// Backward-compatible alias for existing onclick handler in HTML.
function toglaLasMer() {
    togglaLasMer();
}

// Öppna/stäng dropdowns
function togglaPizzeriaMeny(e) {
    if (e) e.stopPropagation(); 
    document.getElementById("pizzeria-lista").classList.toggle("visa");
}

function togglaOmradeMeny(e) {
    if (e) e.stopPropagation();
    document.getElementById("omrade-lista").classList.toggle("visa");
}

function togglaIngrediensMeny(e) {
    if (e) e.stopPropagation(); 
    const meny = document.getElementById("dropdown-lista");
    if (!meny) return;
    meny.classList.toggle("visa");
    if (meny.classList.contains('visa')) {
        const sokInput = document.getElementById('ingrediens-sok-input');
        if (sokInput) {
            setTimeout(() => sokInput.focus(), 0);
        }
    }
}

function renderValdaIngrediensChips() {
    const container = document.getElementById('valda-ingredienser-chips');
    if (!container) return;

    container.innerHTML = '';
    valdaIngredienser.forEach((ingrediens) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'vald-ingrediens-chip';
        chip.setAttribute('aria-label', 'Ta bort ingrediens ' + ingrediens);
        chip.innerHTML = '<span>' + ingrediens + '</span><span class="vald-ingrediens-chip-x">✕</span>';
        chip.onclick = (e) => {
            e.stopPropagation();
            const cb = Array.from(document.querySelectorAll('#dropdown-lista input')).find((c) => c.value === ingrediens);
            if (cb) {
                cb.checked = false;
                togglaIngrediens(ingrediens, cb);
            }
        };
        container.appendChild(chip);
    });
}

function konfigureraMobilVisaFler(listElement, synligaAntal) {
    if (!listElement) return;

    listElement.classList.add('mob-limit');
    const labels = Array.from(listElement.querySelectorAll('.dropdown-item'));
    labels.forEach((label, index) => {
        label.classList.toggle('mob-extra', index >= synligaAntal);
    });

    const befintligKnapp = listElement.querySelector('.chip-visa-fler');
    if (befintligKnapp) befintligKnapp.remove();

    if (labels.length <= synligaAntal) return;

    const visaFlerKnapp = document.createElement('button');
    visaFlerKnapp.type = 'button';
    visaFlerKnapp.className = 'chip-visa-fler';
    visaFlerKnapp.innerText = 'Visa fler';
    visaFlerKnapp.onclick = (e) => {
        e.stopPropagation();
        listElement.classList.toggle('show-all');
        const expanded = listElement.classList.contains('show-all');
        visaFlerKnapp.innerText = expanded ? 'Visa färre' : 'Visa fler';

        if (!expanded) {
            requestAnimationFrame(() => {
                scrollaTillFilterStart(listElement.closest('.filter-grupp') || listElement);
            });
        }

        // Samma hint-logik för område, pizzerior och ingredienser.
        if (['omrade-lista', 'pizzeria-lista', 'dropdown-lista'].includes(listElement.id)) {
            mobilScrollHintEfterVisaFler = expanded;
            uppdateraMobilScrollHint();
        }
    };
    listElement.appendChild(visaFlerKnapp);
}

function scrollaTillFilterStart(element) {
    if (!element) return;

    const navbar = document.querySelector('.navbar');
    const navbarOffset = window.matchMedia('(max-width: 768px)').matches
        ? 12
        : (navbar?.offsetHeight || 0) + 16;

    const topPosition = element.getBoundingClientRect().top + window.scrollY - navbarOffset;
    window.scrollTo({ top: Math.max(0, topPosition), behavior: 'smooth' });
}

window.onclick = function(event) {
    if (!event.target.closest('.dropdown-container') && !event.target.closest('.hamburger-ikon') && !event.target.closest('.nav-links')) {
        const dropdowns = document.getElementsByClassName("dropdown-innehall");
        for (let i = 0; i < dropdowns.length; i++) {
            dropdowns[i].classList.remove('visa');
        }
        // Stäng mobilmeny om öppen
        closeMobilMeny();
    }
};

// --- FILTER LOGIK ---
function uppdateraFilterStegCount() {
    const omradeCount = document.querySelectorAll('#omrade-lista input:checked').length;
    const pizzeriaCount = valdaPizzerior.length;
    const ingrediensCount = valdaIngredienser.length;

    const omradeEl = document.getElementById('omrade-steg-count');
    const pizzeriaEl = document.getElementById('pizzeria-steg-count');
    const ingrediensEl = document.getElementById('ingrediens-steg-count');

    if (omradeEl) omradeEl.textContent = omradeCount > 0 ? String(omradeCount) : '';
    if (pizzeriaEl) pizzeriaEl.textContent = pizzeriaCount > 0 ? String(pizzeriaCount) : '';
    if (ingrediensEl) ingrediensEl.textContent = ingrediensCount > 0 ? String(ingrediensCount) : '';

    // Update mobile toggle button count
    const toggleCount = document.getElementById('filter-toggle-count');
    if (toggleCount) {
        const total = omradeCount + pizzeriaCount + ingrediensCount;
        toggleCount.textContent = total > 0 ? String(total) : '';
    }

    // Update avancerade filter badge
    uppdateraAvfCount();
}

function skapaFilterKnappar() {
    const pizzeriaLista = document.getElementById('pizzeria-lista');
    const omradeLista = document.getElementById('omrade-lista');
    const dropdownLista = document.getElementById('dropdown-lista');
    if (!pizzeriaLista || !omradeLista || !dropdownLista) return;
    
    const pizzerior = [...new Set(allaPizzor.map(p => p.pizzeria))].sort((a, b) => a.localeCompare(b, 'sv'));
    const omraden = [...new Set(allaPizzor.map(p => p.omrade))].filter(o => o).sort();
    const ingredienser = hamtaDynamiskaIngredienserFranData(allaPizzor);
    
    // Områden
    omradeLista.innerHTML = '';
    omraden.forEach(omrade => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.onclick = (e) => e.stopPropagation();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = omrade;
        checkbox.onchange = () => valjOmrade(omrade, checkbox);
        const textSpan = document.createElement('span');
        textSpan.textContent = omrade;
        label.appendChild(checkbox);
        label.appendChild(textSpan);
        omradeLista.appendChild(label);
    });

    // Pizzerior
    pizzeriaLista.innerHTML = '';
    pizzerior.forEach(namn => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.onclick = (e) => e.stopPropagation();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = namn;
        checkbox.onchange = () => togglaPizzeria(namn, checkbox);
        const textSpan = document.createElement('span');
        textSpan.textContent = namn;
        label.appendChild(checkbox);
        label.appendChild(textSpan);
        pizzeriaLista.appendChild(label);
    });

    // Ingredienser
    dropdownLista.innerHTML = '';
    const ingrediensSokWrap = document.createElement('div');
    ingrediensSokWrap.className = 'ingrediens-sok-wrap';
    const ingrediensSokInput = document.createElement('input');
    ingrediensSokInput.type = 'search';
    ingrediensSokInput.id = 'ingrediens-sok-input';
    ingrediensSokInput.className = 'ingrediens-sok-input';
    ingrediensSokInput.placeholder = 'Sök ingrediens...';
    ingrediensSokWrap.appendChild(ingrediensSokInput);
    dropdownLista.appendChild(ingrediensSokWrap);

    const ingrediensOptions = document.createElement('div');
    ingrediensOptions.className = 'ingrediens-options';
    dropdownLista.appendChild(ingrediensOptions);

    const tomResultat = document.createElement('p');
    tomResultat.id = 'ingrediens-sok-tomt';
    tomResultat.className = 'ingrediens-sok-tomt';
    tomResultat.textContent = 'Inga ingredienser matchar din sökning.';
    tomResultat.hidden = true;
    dropdownLista.appendChild(tomResultat);

    ingredienser.forEach(ingr => {
        const label = document.createElement('label');
        label.className = 'dropdown-item';
        label.dataset.ingrediens = ingr;
        label.onclick = (e) => e.stopPropagation();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = ingr;
        checkbox.onchange = () => togglaIngrediens(ingr, checkbox);
        const textSpan = document.createElement('span');
        textSpan.textContent = ingr;
        label.appendChild(checkbox);
        label.appendChild(textSpan);
        ingrediensOptions.appendChild(label);
    });

    ingrediensSokInput.addEventListener('input', () => {
        const term = normaliseraText(ingrediensSokInput.value);
        let synliga = 0;
        ingrediensOptions.querySelectorAll('.dropdown-item').forEach((label) => {
            const namn = normaliseraText(label.dataset.ingrediens || '');
            const visa = !term || namn.includes(term);
            label.classList.toggle('is-hidden', !visa);
            if (visa) synliga++;
        });
        tomResultat.hidden = synliga > 0;
    });

    konfigureraMobilVisaFler(omradeLista, 5);
    konfigureraMobilVisaFler(pizzeriaLista, 5);
    renderValdaIngrediensChips();
}

function togglaPizzeria(namn, checkbox) {
    if (checkbox.checked) {
        if (!valdaPizzerior.includes(namn)) valdaPizzerior.push(namn);
    } else {
        valdaPizzerior = valdaPizzerior.filter(v => v !== namn);
    }
    const menyKnapp = document.getElementById('pizzeria-meny-knapp');
    menyKnapp.innerText = valdaPizzerior.length > 0 ? `Pizzerior (${valdaPizzerior.length}) ▼` : `Välj pizzerior... ▼`;
    uppdateraFilterStegCount();
    pizzorSomVisas = 100;
    uppdateraVisning();
}

function togglaIngrediens(ingr, checkbox) {
    if (checkbox.checked) {
        if (!valdaIngredienser.includes(ingr)) valdaIngredienser.push(ingr);
    } else {
        valdaIngredienser = valdaIngredienser.filter(v => v !== ingr);
    }
    const menyKnapp = document.getElementById('ingrediens-meny-knapp');
    menyKnapp.innerText = valdaIngredienser.length > 0 ? `Ingredienser (${valdaIngredienser.length}) ▼` : `Välj ingredienser... ▼`;
    renderValdaIngrediensChips();
    uppdateraFilterStegCount();
    gtmPushKlick({ event: 'klick', typ: 'ingrediens', namn: ingr }); // GTM tracking
    pizzorSomVisas = 100;
    uppdateraVisning();
}

function valjOmrade(omrade, checkboxElement) {
    gtmPushKlick({ event: 'klick', typ: 'omrade', namn: omrade }); // GTM tracking
    const pizzeriorIOmrade = [...new Set(allaPizzor.filter(p => p.omrade === omrade).map(p => p.pizzeria))];

    if (checkboxElement.checked) {
        pizzeriorIOmrade.forEach(p => { if (!valdaPizzerior.includes(p)) valdaPizzerior.push(p); });
    } else {
        const andraValdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')].map(cb => cb.value);
        pizzeriorIOmrade.forEach(p => {
            const tillhorAnnatValtOmrade = allaPizzor.some(pizza => pizza.pizzeria === p && andraValdaOmraden.includes(pizza.omrade));
            if (!tillhorAnnatValtOmrade) valdaPizzerior = valdaPizzerior.filter(v => v !== p);
        });
    }

    document.querySelectorAll('#pizzeria-lista input').forEach(cb => { cb.checked = valdaPizzerior.includes(cb.value); });
    const omradeMenyKnapp = document.getElementById('omrade-meny-knapp');
    const valdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')];
    omradeMenyKnapp.innerText = valdaOmraden.length > 0 ? `Områden (${valdaOmraden.length}) ▼` : `Välj område... ▼`;
    const menyKnapp = document.getElementById('pizzeria-meny-knapp');
    menyKnapp.innerText = valdaPizzerior.length > 0 ? `Pizzerior (${valdaPizzerior.length}) ▼` : `Välj pizzerior... ▼`;
    uppdateraFilterStegCount();
    pizzorSomVisas = 100;
    uppdateraVisning();
}

// --- SÖK & VISNING ---
function arStriktOmradesokterm(soktOrd) {
    const s = normaliseraText(soktOrd);
    return s === 'anneberg';
}

function hittarOrdet(text, soktOrd) {
    const s = normaliseraText(soktOrd);
    if (!s) return false;
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Kräver ordstart (mellanslag/bindestreck/radstart) men INTE ordslut,
    // så prefix-sökningar som "keb" matchar "kebab".
    const regex = new RegExp('(^|[\\s/\\-])' + escaped, 'i');
    return regex.test(text);
}

function matcharSoktermForPizza(pizza, soktOrd, pizzaText) {
    const s = normaliseraText(soktOrd);
    if (!s) return false;

    if (arStriktOmradesokterm(s)) {
        return normaliseraText(pizza.omrade || '') === s;
    }

    return hittarOrdet(pizzaText, s);
}

function uppdateraMobilRensaKnappSynlighet() {
    const statusRad = document.getElementById('mobil-status-rad');
    if (!statusRad) return;

    const arKompaktViewport = window.matchMedia('(max-width: 1024px)').matches;
    if (!arKompaktViewport) {
        statusRad.classList.remove('visa-rensa');
        return;
    }

    const sokruta = document.getElementById('sokruta');
    const prisSortering = document.getElementById('pris-sortering');

    const harSoktext = (sokruta?.value || '').trim() !== '';
    const harValtOmrade = document.querySelectorAll('#omrade-lista input:checked').length > 0;
    const harValdPizzeria = valdaPizzerior.length > 0;
    const harValdIngrediens = valdaIngredienser.length > 0;
    const harKategoriFilter = aktivKategori !== 'Pizzor (alla)';
    const harPrisFilter = aktivtPrisFiltreMin !== null || aktivtPrisFiltreMax !== null;
    const harSortering = (prisSortering?.value || 'standard') !== 'standard';
    const harNarmast = isNearbyActive;

    const skaVisaRensaKnapp = harSoktext || harValtOmrade || harValdPizzeria || harValdIngrediens || harKategoriFilter || harPrisFilter || harSortering || harNarmast;
    statusRad.classList.toggle('visa-rensa', skaVisaRensaKnapp);
}

function uppdateraMobilScrollHint(arScrollar = false) {
    const hint = document.getElementById('mobil-scroll-hint');
    if (!hint) return;

    const arMobil = window.matchMedia('(max-width: 768px)').matches;
    if (!arMobil || !mobilScrollHintEfterVisaFler) {
        hint.classList.add('dold');
        hint.classList.remove('scrollar');
        return;
    }

    const forstaPizzaKort = document.querySelector('#resultat-lista .pizza-kort');
    const pizzorSyns = !!forstaPizzaKort && (() => {
        const rect = forstaPizzaKort.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    })();

    if (pizzorSyns) {
        hint.classList.add('dold');
        hint.classList.remove('scrollar');
        return;
    }

    hint.classList.remove('dold');
    hint.classList.toggle('scrollar', arScrollar);
}

function uppdateraVisning() {
    const sökSträng = document.getElementById('sokruta').value.toLowerCase();
    const söktaOrd = sökSträng.split(',').map(ord => ord.trim()).filter(ord => ord !== "");
    const söktaOrdText = söktaOrd.filter((ord) => !arVegetariskSokterm(ord));
    const valdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')].map(cb => cb.value);

    let resultat = allaPizzor;
    const vegetarLageAktivt = söktaOrd.some((ord) => arVegetariskSokterm(ord));

    if (valdaPizzerior.length > 0) resultat = resultat.filter(p => valdaPizzerior.includes(p.pizzeria));
    if (valdaOmraden.length > 0) resultat = resultat.filter(p => valdaOmraden.includes(p.omrade));

    // Kategori-strip filter (state-driven, mutually exclusive)
    resultat = filtreraEfterKategori(resultat, aktivKategori);

    if (vegetarLageAktivt) {
        resultat = resultat.filter((pizza) => arVegetariskText(byggPizzaSokText(pizza)));
    }

    resultat = resultat.filter(pizza => {
        const pizzaText = byggPizzaSokText(pizza);
        const matcharDropdown = valdaIngredienser.every(vald => hittarOrdet(pizzaText, vald));
        const matcharSokruta = söktaOrdText.every((sokt) => matcharSoktermForPizza(pizza, sokt, pizzaText));
        return matcharDropdown && matcharSokruta;
    });

    if (isNearbyActive && anvandarPosition) {
        resultat = sortByDistance(resultat, anvandarPosition.lat, anvandarPosition.lng);
        uppdateraNarmastStatus('Visar närmaste pizzor');
    } else {
        const sorteringsVal = document.getElementById('pris-sortering').value;
        if (sorteringsVal === "billigast") resultat.sort((a, b) => a.pris - b.pris);
        else if (sorteringsVal === "dyrast") resultat.sort((a, b) => b.pris - a.pris);
        else if (sorteringsVal === "pizzeria-az") resultat.sort((a, b) => (a.pizzeria || '').localeCompare(b.pizzeria || '', 'sv'));
        else resultat.sort((a, b) => a.pizza_namn.localeCompare(b.pizza_namn, 'sv'));
    }

    if (aktivtPrisFiltreMin !== null || aktivtPrisFiltreMax !== null) {
        resultat = resultat.filter((p) => {
            const pr = Number(p.pris);
            return (aktivtPrisFiltreMin === null || pr >= aktivtPrisFiltreMin) &&
                   (aktivtPrisFiltreMax === null || pr <= aktivtPrisFiltreMax);
        });
    }

    nuvarandeFiltreradLista = resultat;
    const trafftext = resultat.length > 0 ? `Hittade ${resultat.length} pizzor` : 'Inga pizzor matchar din sökning';
    const antalTraffar = document.getElementById('antal-traffar-container');
    const antalTraffarMobil = document.getElementById('antal-traffar-mobile');
    if (antalTraffar) antalTraffar.innerText = trafftext;
    if (antalTraffarMobil) antalTraffarMobil.innerText = trafftext;
    renderAktivaChips();
    uppdateraUrl();
    uppdateraMobilRensaKnappSynlighet();
    uppdateraMobilScrollHint(false);
    visaPizzor(nuvarandeFiltreradLista);
}

function visaPizzor(pizzor) {
    const lista = document.getElementById('resultat-lista');
    const laddaFlerSektion = document.getElementById('ladda-fler-sektion');
    if (!lista || !laddaFlerSektion) return;
    gtmPushKlick({ event: 'pizza_visas', antal: pizzor.length }); // GTM tracking
    lista.innerHTML = '';
    
    if (pizzor.length === 0) {
        lista.innerHTML = `<div class="ingen-traff"><div class="ingen-traff-ikon">😕</div><h3>Inga pizzor matchar dina val</h3><p>Prova att ändra filter, söka på något annat, eller rensa allt och börja om.</p><button type="button" class="pizzeria-btn" onclick="document.getElementById('rensa-filter-btn').click()">✨ Rensa filter</button></div>`;
        laddaFlerSektion.style.display = 'none';
        return;
    }

    const urval = pizzor.slice(0, pizzorSomVisas);
    const minPris = urval.length > 0 ? Math.min(...urval.map(p => Number(p.pris))) : null;
    // Batch DOM insertions via DocumentFragment to avoid a reflow per card.
    const fragment = document.createDocumentFragment();
    urval.forEach(pizza => {
        const kort = document.createElement('div');
        kort.className = 'pizza-kort expanded';
        kort.dataset.pizza = pizza.pizza_namn || ''; // GTM tracking
        kort.dataset.pizzeria = pizza.pizzeria || ''; // GTM tracking
        kort.dataset.omrade = pizza.omrade || ''; // GTM tracking
        kort.dataset.pris = String(pizza.pris ?? ''); // GTM tracking
        const mapsLänk = skapaGoogleMapsSokLank(pizza.pizzeria, pizza.adress);
        const hemsidaUrl = saneraExternUrl(pizza.hemsida);
        const pizzaNamnSafe = escapaHtml(pizza.pizza_namn);
        const pizzeriaNamnSafe = escapaHtml(pizza.pizzeria);
        const omradeSafe = escapaHtml(pizza.omrade || 'Mölndal');
        const telefonSafe = escapaHtml(pizza.telefon);
        const ingrediensChips = Array.isArray(pizza.ingredienser) && pizza.ingredienser.length > 0
            ? `<div class="ingrediens-chips">${pizza.ingredienser.map((ing) => `<span class="ingrediens-chip">${escapaHtml(ing)}</span>`).join('')}</div>`
            : '<p style="font-size:0.8em;color:#555;">Ingredienser saknas</p>';
        const adressSafe = escapaHtml(pizza.adress);
        const pizzeriaDisplay = hemsidaUrl
            ? `<a href="${hemsidaUrl}" target="_blank" rel="noopener noreferrer">${pizzeriaNamnSafe} 🌐</a>`
            : pizzeriaNamnSafe;
        const telefonDisplay = pizza.telefon ? `<p>📞 <a href="tel:${saneraTelefonnummer(pizza.telefon)}" style="color: #cd212a; text-decoration: none; font-weight: bold;">${telefonSafe}</a></p>` : '';
        const avstandsDisplay = isNearbyActive && Number.isFinite(pizza.distansKm)
            ? `<p class="avstand-badge">📍 ${pizza.distansKm < 1 ? Math.round(pizza.distansKm * 1000) + ' m' : pizza.distansKm.toFixed(1).replace('.', ',') + ' km'} från dig</p>`
            : '';
        const arBilligast = minPris !== null && Number(pizza.pris) === minPris;
        const billigastBadge = arBilligast
            ? '<span class="pizza-badge pizza-badge--billigast">🟢 Billigast</span>'
            : '';
        const prisBadgeKlass = arBilligast ? 'pris-badge pris-badge--billig' : 'pris-badge';

        kort.innerHTML = `
            ${billigastBadge}<h3>${pizzaNamnSafe}</h3>
            <span class="${prisBadgeKlass}">${pizza.pris} kr</span>
            <p><strong>${pizzeriaDisplay}</strong> <small>(${omradeSafe})</small></p>
            ${telefonDisplay}
            ${avstandsDisplay}
            ${ingrediensChips}
            <p style="margin-top: 12px; font-size: 0.85em;">
                <a href="${mapsLänk}" target="_blank" rel="noopener noreferrer" style="color: #1f7a4c; text-decoration: none; font-weight: bold;">📍 ${adressSafe}</a>
            </p>
        `;
        fragment.appendChild(kort);
    });
    lista.appendChild(fragment);
    laddaFlerSektion.style.display = pizzor.length > pizzorSomVisas ? 'block' : 'none';
}

function initStickyMobileCta() {
    const root = document.getElementById('pizzeria-sida-root');
    const stickyCta = document.querySelector('.sticky-mobile-cta');
    if (!root || !stickyCta) return;

    let scrollDimTimer = null;

    const visaVidScroll = () => {
        const arMobil = window.matchMedia('(max-width: 768px)').matches;
        const skaVisa = arMobil && window.scrollY > 150;
        stickyCta.classList.toggle('is-visible', skaVisa);

        if (skaVisa) {
            stickyCta.classList.add('is-scrolling');
            clearTimeout(scrollDimTimer);
            scrollDimTimer = setTimeout(() => {
                stickyCta.classList.remove('is-scrolling');
            }, 180);
        }
    };

    window.addEventListener('scroll', visaVidScroll, { passive: true });
    window.addEventListener('resize', visaVidScroll);
    visaVidScroll();
}

function hamtaAktivAppNavSektion() {
    const path = (window.location.pathname || '').toLowerCase();

    if (path.includes('/karta')) return 'karta';
    if (path.includes('/statistik')) return 'statistik';
    if (path.includes('/om-oss')) return 'om-oss';
    if (path.includes('/pizzerior/')) return 'pizzerior';
    if (path.includes('/pizzerior')) return 'pizzerior';
    return 'pizzor';
}

function injiceraGemensamAppNavStil() {
    if (document.getElementById('gemensam-app-nav-stil')) return;

    const style = document.createElement('style');
    style.id = 'gemensam-app-nav-stil';
    style.textContent = `
html.native-app-shell .navbar,
html.native-app-shell .bottom-nav,
html.native-app-shell #app-tab-bar {
    display: none !important;
}

html.native-app-shell body {
    padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px)) !important;
}

#native-app-bottom-nav,
#karta-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 72px;
    z-index: 1005;
    background: rgba(10, 10, 10, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 4px;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.45);
}

#native-app-bottom-nav .karta-bnav-item,
#karta-bottom-nav .karta-bnav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 1;
    padding: 6px 2px;
    color: rgba(255, 255, 255, 0.42);
    text-decoration: none;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    border: none;
    background: none;
    cursor: pointer;
    transition: color 0.15s;
    min-height: 56px;
    font-family: inherit;
}

#native-app-bottom-nav .karta-bnav-item:hover,
#native-app-bottom-nav .karta-bnav-item:focus,
#native-app-bottom-nav .karta-bnav-item.is-aktiv,
#karta-bottom-nav .karta-bnav-item:hover,
#karta-bottom-nav .karta-bnav-item:focus,
#karta-bottom-nav .karta-bnav-item.is-aktiv {
    color: #fff;
    outline: none;
}

#native-app-bottom-nav .karta-bnav-item svg,
#karta-bottom-nav .karta-bnav-item svg {
    transition: transform 0.15s;
    flex-shrink: 0;
}

#native-app-bottom-nav .karta-bnav-item:hover svg,
#native-app-bottom-nav .karta-bnav-item.is-aktiv svg,
#karta-bottom-nav .karta-bnav-item:hover svg,
#karta-bottom-nav .karta-bnav-item.is-aktiv svg {
    transform: scale(1.12);
}

#native-app-bottom-nav .karta-bnav-item--center,
#karta-bottom-nav .karta-bnav-item--center {
    flex: 1.3;
    color: #ffffff;
    gap: 0;
}

#native-app-bottom-nav .karta-bnav-center-ring,
#karta-bottom-nav .karta-bnav-center-ring {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: linear-gradient(145deg, #27c94f, #169c38);
    border: 4px solid rgba(15, 15, 15, 0.96);
    box-shadow: 0 10px 28px rgba(21, 170, 58, 0.42), 0 0 0 1px rgba(21, 170, 58, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    top: -16px;
    transition: transform 0.15s, box-shadow 0.15s;
}

#native-app-bottom-nav .karta-bnav-item--center:hover .karta-bnav-center-ring,
#native-app-bottom-nav .karta-bnav-item--center:focus .karta-bnav-center-ring,
#karta-bottom-nav .karta-bnav-item--center:hover .karta-bnav-center-ring,
#karta-bottom-nav .karta-bnav-item--center:focus .karta-bnav-center-ring {
    transform: scale(1.1) translateY(-2px);
    box-shadow: 0 12px 30px rgba(21, 170, 58, 0.52), 0 0 0 1px rgba(21, 170, 58, 0.32);
}

#native-app-bottom-nav .karta-bnav-center-ring svg,
#karta-bottom-nav .karta-bnav-center-ring svg {
    width: 28px;
    height: 28px;
    color: #fff;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.28));
}

@supports (padding-bottom: env(safe-area-inset-bottom)) {
    #native-app-bottom-nav,
    #karta-bottom-nav {
        height: calc(72px + env(safe-area-inset-bottom));
        padding-bottom: env(safe-area-inset-bottom);
    }
}
`;

    document.head.appendChild(style);
}

function skapaGemensamAppNav() {
    if (!arAppWebViewMiljo()) return;

    document.documentElement.classList.add('native-app-shell');
    injiceraGemensamAppNavStil();

    if (document.getElementById('karta-bottom-nav') || document.getElementById('native-app-bottom-nav')) {
        return;
    }

    const aktiv = hamtaAktivAppNavSektion();
    const nav = document.createElement('nav');
    nav.id = 'native-app-bottom-nav';
    nav.setAttribute('aria-label', 'Appnavigation');

    const href = (path) => arLokalUtveckling() ? hamtaLokalHref(path) : path;

    nav.innerHTML = `
        <a href="${href('/')}" class="karta-bnav-item ${aktiv === 'pizzor' ? 'is-aktiv' : ''}" aria-label="Pizzor">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>
          <span>Pizzor</span>
        </a>
        <a href="${href('/pizzerior')}" class="karta-bnav-item ${aktiv === 'pizzerior' ? 'is-aktiv' : ''}" aria-label="Pizzerior">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span>Pizzerior</span>
        </a>
        <a href="${href('/karta')}" class="karta-bnav-item karta-bnav-item--center ${aktiv === 'karta' ? 'is-aktiv' : ''}" aria-label="Karta">
          <span class="karta-bnav-center-ring" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.5l3.8 6.2-6.2-3.8z" fill="currentColor" stroke="none"/></svg>
          </span>
          <span>Karta</span>
        </a>
        <a href="${href('/statistik')}" class="karta-bnav-item ${aktiv === 'statistik' ? 'is-aktiv' : ''}" aria-label="Statistik">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="20" x2="6" y2="11"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>
          <span>Statistik</span>
        </a>
        <a href="${href('/om-oss')}" class="karta-bnav-item ${aktiv === 'om-oss' ? 'is-aktiv' : ''}" aria-label="Om oss">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Om oss</span>
        </a>
    `;

    document.body.appendChild(nav);
}

// --- App Bootstrap ---
// Körs när sidan laddas - kollar om vi ska visa pop-upen
window.addEventListener("load", function() {
    uppdateraInternaLankarForLokalUtveckling();
    initToppKnapp();
    initIndexSida();
    initPizzeriorSida();
    initPizzeriaSida();
    initStickyMobileCta();
    initSchemaGenerellSida();
    initPrisSlider();
    initTangentbordsGenvag();
    skapaGemensamAppNav();
    gtmInitNavbarTracking(); // GTM tracking
    gtmInitPizzaKortTracking(); // GTM tracking
    window.addEventListener('scroll', gtmTrackScrollDjup); // GTM tracking
    gtmTrackScrollDjup(); // GTM tracking

    // PWA: register service worker after page load to not compete with resources.
    registrerServiceWorker();
});

function registrerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const arNativeApp = !!(
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform()
    );

    if (arNativeApp) {
        navigator.serviceWorker.getRegistrations().then((registreringar) => {
            registreringar.forEach((registrering) => registrering.unregister());
        });
        return;
    }

    navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .catch((err) => {
            // Non-fatal — app works fine without SW, just not installable/offline.
            console.warn('Service worker kunde inte registreras:', err);
        });
}

// --- Aktiva filter chips ---
function renderAktivaChips() {
    const container = document.getElementById('aktiva-filter-chips');
    if (!container) return;

    const chips = [];

    const valdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')].map(cb => cb.value);
    valdaOmraden.forEach(o => chips.push({
        label: `📍 ${o}`,
        rensa: () => {
            const cb = [...document.querySelectorAll('#omrade-lista input')].find(c => c.value === o);
            if (cb) { cb.checked = false; valjOmrade(o, cb); }
        }
    }));

    [...valdaPizzerior].forEach(p => chips.push({
        label: `🏪 ${p}`,
        rensa: () => {
            const cb = [...document.querySelectorAll('#pizzeria-lista input')].find(c => c.value === p);
            if (cb) { cb.checked = false; togglaPizzeria(p, cb); }
        }
    }));

    [...valdaIngredienser].forEach(i => chips.push({
        label: `🌿 ${i}`,
        rensa: () => {
            const cb = [...document.querySelectorAll('#dropdown-lista input')].find(c => c.value === i);
            if (cb) { cb.checked = false; togglaIngrediens(i, cb); }
        }
    }));

    container.innerHTML = '';
    chips.forEach(chip => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'aktiv-filter-chip';
        el.setAttribute('aria-label', `Ta bort filter`);
        const labelNode = document.createTextNode(`${chip.label} `);
        const xSpan = document.createElement('span');
        xSpan.className = 'chip-x';
        xSpan.setAttribute('aria-hidden', 'true');
        xSpan.textContent = '✕';
        el.appendChild(labelNode);
        el.appendChild(xSpan);
        el.addEventListener('click', chip.rensa);
        container.appendChild(el);
    });
}

// --- URL sync ---
function uppdateraUrl() {
    if (!document.getElementById('filter-sektion')) return;
    const params = new URLSearchParams();
    const soktext = document.getElementById('sokruta')?.value.trim();
    if (soktext) params.set('sok', soktext);
    const valdaOmraden = [...document.querySelectorAll('#omrade-lista input:checked')].map(cb => cb.value);
    if (valdaOmraden.length) params.set('omraden', valdaOmraden.join(','));
    if (valdaPizzerior.length) params.set('pizzerior', valdaPizzerior.join(','));
    if (valdaIngredienser.length) params.set('ingredienser', valdaIngredienser.join(','));
    if (aktivtPrisFiltreMin !== null) {
        params.set('prismin', String(aktivtPrisFiltreMin));
    }
    if (aktivtPrisFiltreMax !== null) {
        params.set('prismax', String(aktivtPrisFiltreMax));
    }
    const sortering = document.getElementById('pris-sortering')?.value;
    if (sortering && sortering !== 'standard') params.set('sortering', sortering);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
}

// --- Initiera filter från URL-parametrar ---
function initFranUrl() {
    if (!document.getElementById('filter-sektion')) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    const sok = params.get('sok');
    if (sok) { const el = document.getElementById('sokruta'); if (el) el.value = sok; }

    const omradenParam = params.get('omraden');
    if (omradenParam) {
        omradenParam.split(',').map(o => o.trim()).filter(Boolean).forEach(o => {
            const cb = [...document.querySelectorAll('#omrade-lista input')].find(c => c.value === o);
            if (!cb) return;
            cb.checked = true;
            [...new Set(allaPizzor.filter(p => p.omrade === o).map(p => p.pizzeria))].forEach(p => {
                if (!valdaPizzerior.includes(p)) valdaPizzerior.push(p);
            });
        });
    }

    const pizzeriorParam = params.get('pizzerior');
    if (pizzeriorParam) {
        pizzeriorParam.split(',').map(p => p.trim()).filter(Boolean).forEach(p => {
            const cb = [...document.querySelectorAll('#pizzeria-lista input')].find(c => c.value === p);
            if (cb) { cb.checked = true; if (!valdaPizzerior.includes(p)) valdaPizzerior.push(p); }
        });
    }

    const valdaOmradenCount = [...document.querySelectorAll('#omrade-lista input:checked')].length;
    const omradeMenyKnapp = document.getElementById('omrade-meny-knapp');
    if (omradeMenyKnapp) omradeMenyKnapp.innerText = valdaOmradenCount > 0 ? `Områden (${valdaOmradenCount}) ▼` : 'Välj område... ▼';
    document.querySelectorAll('#pizzeria-lista input').forEach(cb => { cb.checked = valdaPizzerior.includes(cb.value); });
    const pizzeriaMenyKnapp = document.getElementById('pizzeria-meny-knapp');
    if (pizzeriaMenyKnapp) pizzeriaMenyKnapp.innerText = valdaPizzerior.length > 0 ? `Pizzerior (${valdaPizzerior.length}) ▼` : 'Välj pizzerior... ▼';

    const ingredienserParam = params.get('ingredienser');
    if (ingredienserParam) {
        ingredienserParam.split(',').map(i => i.trim()).filter(Boolean).forEach(i => {
            const cb = [...document.querySelectorAll('#dropdown-lista input')].find(c => c.value === i);
            if (cb) { cb.checked = true; if (!valdaIngredienser.includes(i)) valdaIngredienser.push(i); }
        });
        const ingrediensMenyKnapp = document.getElementById('ingrediens-meny-knapp');
        if (ingrediensMenyKnapp) ingrediensMenyKnapp.innerText = valdaIngredienser.length > 0 ? `Ingredienser (${valdaIngredienser.length}) ▼` : 'Välj ingredienser... ▼';
    }
    renderValdaIngrediensChips();

    const prismin = params.get('prismin');
    const prismax = params.get('prismax');
    if (prismin !== null || prismax !== null) {
        const underlag = prisSliderUnderlag || hamtaPrisSliderUnderlag();
        if (!underlag) return;
        const slMin = document.getElementById('pris-slider-min');
        const slMax = document.getElementById('pris-slider-max');
        const fillLeft = document.getElementById('pris-slider-fill-left');
        const fill = document.getElementById('pris-slider-fill');
        const visning = document.getElementById('pris-slider-visning');
        const wrap = document.getElementById('pris-slider-wrap');
        if (prismin !== null) {
            aktivtPrisFiltreMin = Math.max(Number(prismin), underlag.globalMin);
            const minPercent = omvandlaPrisTillSliderPercent(aktivtPrisFiltreMin, underlag);
            if (slMin) slMin.value = String(minPercent);
            if (fillLeft) fillLeft.style.width = `${minPercent}%`;
        }
        if (prismax !== null) {
            aktivtPrisFiltreMax = Math.min(Number(prismax), underlag.globalMax);
            const maxPercent = omvandlaPrisTillSliderPercent(aktivtPrisFiltreMax, underlag);
            if (slMax) slMax.value = String(maxPercent);
            if (fill) fill.style.left = `${maxPercent}%`;
        }
        if (visning) {
            const antal = allaPizzor.filter((p) => {
                const pr = Number(p.pris);
                return (aktivtPrisFiltreMin === null || pr >= aktivtPrisFiltreMin) &&
                       (aktivtPrisFiltreMax === null || pr <= aktivtPrisFiltreMax);
            }).length;
            visning.textContent = formatPrisSliderText(aktivtPrisFiltreMin, aktivtPrisFiltreMax, antal);
        }
        if (wrap) wrap.classList.add('pris-slider-aktiv');
    }

    const sortering = params.get('sortering');
    if (sortering) { const sel = document.getElementById('pris-sortering'); if (sel) sel.value = sortering; }

    uppdateraFilterStegCount();
}

// --- Pris snabbfilter ---
let aktivtPrisFiltreMin = null;
let aktivtPrisFiltreMax = null;

function resetPrisSlider() {
    const sliderMin = document.getElementById('pris-slider-min');
    const sliderMax = document.getElementById('pris-slider-max');
    const fillLeft = document.getElementById('pris-slider-fill-left');
    const fill = document.getElementById('pris-slider-fill');
    const visning = document.getElementById('pris-slider-visning');
    const wrap = document.getElementById('pris-slider-wrap');
    if (sliderMin) sliderMin.value = 0;
    if (sliderMax) sliderMax.value = 100;
    if (fillLeft) fillLeft.style.width = '0%';
    if (fill) fill.style.left = '100%';
    if (visning) visning.textContent = 'Alla priser';
    if (wrap) wrap.classList.remove('pris-slider-aktiv');
    aktivtPrisFiltreMin = null;
    aktivtPrisFiltreMax = null;
}

function initPrisSlider() {
    const wrap = document.getElementById('pris-slider-wrap');
    if (!wrap || !allaPizzor.length) return;

    const underlag = hamtaPrisSliderUnderlag();
    if (!underlag) return;

    const { globalMin, globalMax } = underlag;
    prisSliderUnderlag = underlag;

    const sliderMin = document.getElementById('pris-slider-min');
    const sliderMax = document.getElementById('pris-slider-max');
    const fillLeft = document.getElementById('pris-slider-fill-left');
    const fill = document.getElementById('pris-slider-fill');
    const visning = document.getElementById('pris-slider-visning');

    if (!sliderMin || !sliderMax || !fill || !visning) return;

    sliderMin.min = 0; sliderMin.max = 100; sliderMin.step = 1;
    sliderMax.min = 0; sliderMax.max = 100; sliderMax.step = 1;
    if (!sliderMax.dataset.initialized) {
        sliderMin.value = 0;
        sliderMax.value = 100;
        if (fillLeft) fillLeft.style.width = '0%';
        fill.style.left = '100%';
        visning.textContent = 'Alla priser';
    }

    function uppdateraFill() {
        const minP = Number(sliderMin.value);
        const maxP = Number(sliderMax.value);
        if (fillLeft) fillLeft.style.width = `${minP}%`;
        fill.style.left = `${maxP}%`;
        const valtMin = omvandlaSliderPercentTillPris(minP, underlag);
        const valtMax = omvandlaSliderPercentTillPris(maxP, underlag);
        aktivtPrisFiltreMin = valtMin <= globalMin ? null : valtMin;
        aktivtPrisFiltreMax = valtMax >= globalMax ? null : valtMax;
        const antal = allaPizzor.filter((p) => {
            const pr = Number(p.pris);
            return (aktivtPrisFiltreMin === null || pr >= aktivtPrisFiltreMin) &&
                   (aktivtPrisFiltreMax === null || pr <= aktivtPrisFiltreMax);
        }).length;
        visning.textContent = formatPrisSliderText(aktivtPrisFiltreMin, aktivtPrisFiltreMax, antal);
        wrap.classList.toggle('pris-slider-aktiv', aktivtPrisFiltreMin !== null || aktivtPrisFiltreMax !== null);
        // Raise min z-index when it's in the right half so it can be grabbed over max
        sliderMin.style.zIndex = minP > 50 ? 2 : 1;
        sliderMax.style.zIndex = minP > 50 ? 1 : 2;
    }

    sliderMin.oninput = () => {
        if (Number(sliderMin.value) > Number(sliderMax.value)) sliderMin.value = sliderMax.value;
        uppdateraFill();
        pizzorSomVisas = 100;
        uppdateraVisning();
    };

    sliderMax.oninput = () => {
        if (Number(sliderMax.value) < Number(sliderMin.value)) sliderMax.value = sliderMin.value;
        uppdateraFill();
        pizzorSomVisas = 100;
        uppdateraVisning();
    };

    sliderMax.dataset.initialized = 'true';
}

// --- Tangentbordsgenväg: / fokuserar sökrutan ---
function initTangentbordsGenvag() {
    document.addEventListener('keydown', (e) => {
        if (e.key === '/') {
            const aktivtEl = document.activeElement;
            if (aktivtEl && (aktivtEl.tagName === 'INPUT' || aktivtEl.tagName === 'TEXTAREA' || aktivtEl.isContentEditable)) return;
            e.preventDefault();
            const sokruta = document.getElementById('sokruta');
            if (sokruta) { sokruta.focus(); sokruta.select(); }
        } else if (e.key === 'Escape') {
            document.querySelectorAll('.dropdown-innehall.visa').forEach(d => d.classList.remove('visa'));
        }
    });
}







function initToppKnapp() {
    const toppKnapp = document.getElementById('topp-knapp');
    if (!toppKnapp) return;

    // Normalize in case a page has mojibake characters in static HTML.
    toppKnapp.textContent = '▲';
    toppKnapp.title = 'Gå till toppen';

    let toppKnappScrollTimer = null;
    const visaVidScrollY = 300;

    const uppdateraToppKnapp = () => {
        const arMobil = window.matchMedia('(max-width: 768px)').matches;
        const skaVisa = window.scrollY > visaVidScrollY;

        if (arMobil) {
            toppKnapp.style.display = 'flex';
            toppKnapp.classList.toggle('is-visible', skaVisa);
            if (!skaVisa) {
                toppKnapp.classList.remove('is-scrolling');
            }
        } else {
            toppKnapp.classList.remove('is-visible', 'is-scrolling');
            toppKnapp.style.display = skaVisa ? 'block' : 'none';
            if (!skaVisa) {
                toppKnapp.classList.remove('scrollar');
            }
        }
    };

    window.addEventListener('scroll', () => {
        const arMobil = window.matchMedia('(max-width: 768px)').matches;

        if (window.scrollY <= visaVidScrollY) {
            if (arMobil) {
                toppKnapp.classList.remove('is-visible', 'is-scrolling');
            } else {
                toppKnapp.style.display = 'none';
                toppKnapp.classList.remove('scrollar');
            }
            return;
        }

        if (arMobil) {
            toppKnapp.style.display = 'flex';
            toppKnapp.classList.add('is-visible', 'is-scrolling');
        } else {
            toppKnapp.style.display = 'block';
            toppKnapp.classList.add('scrollar');
        }

        clearTimeout(toppKnappScrollTimer);
        toppKnappScrollTimer = setTimeout(() => {
            if (window.matchMedia('(max-width: 768px)').matches) {
                toppKnapp.classList.remove('is-scrolling');
            } else {
                toppKnapp.classList.remove('scrollar');
            }
        }, 180);
    }, { passive: true });

    window.addEventListener('resize', uppdateraToppKnapp);
    uppdateraToppKnapp();
    toppKnapp.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}




// tillbaka till föregående sida efter cookies
function goBack() {
  if (window.history.length > 1) {
    history.back();
  } else {
    window.location.href = "/";
  }     
}

// ============================================================
//  KATEGORI STRIP SCROLL ARROWS
//  Desktop only (≥1024px). Shows left/right arrow buttons
//  only when the chip strip overflows the container.
// ============================================================
(function initKategoriStripArrows() {
  var strip      = document.getElementById('kategori-strip');
  var inner      = strip && strip.querySelector('.kategori-strip-inner');
  var pilVanster = document.getElementById('ks-pil-vanster');
  var pilHoger   = document.getElementById('ks-pil-hoger');

  if (!strip || !inner || !pilVanster || !pilHoger) return;

  var DESKTOP_BP  = 1024;
  var SCROLL_DIST = 260; // px per arrow click

  function uppdateraPilar() {
    if (window.innerWidth < DESKTOP_BP) {
      // Reset all arrow state on mobile/tablet
      strip.classList.remove('kategori-strip--overflow', 'kategori-strip--can-scroll-left', 'kategori-strip--at-end');
      pilVanster.classList.remove('ks-pil--synlig');
      pilHoger.classList.remove('ks-pil--synlig');
      return;
    }

    var harOverflow = inner.scrollWidth > inner.clientWidth + 1;
    strip.classList.toggle('kategori-strip--overflow', harOverflow);

    if (!harOverflow) {
      strip.classList.remove('kategori-strip--can-scroll-left', 'kategori-strip--at-end');
      pilVanster.classList.remove('ks-pil--synlig');
      pilHoger.classList.remove('ks-pil--synlig');
      return;
    }

    var scrollLeft = Math.round(inner.scrollLeft);
    var maxScroll  = Math.round(inner.scrollWidth - inner.clientWidth);
    var vidStart   = scrollLeft <= 0;
    var vidSlut    = scrollLeft >= maxScroll - 1;

    // Left arrow: only visible when NOT at start
    strip.classList.toggle('kategori-strip--can-scroll-left', !vidStart);
    pilVanster.classList.toggle('ks-pil--synlig', !vidStart);

    // Right arrow: only visible when NOT at end
    strip.classList.toggle('kategori-strip--at-end', vidSlut);
    pilHoger.classList.toggle('ks-pil--synlig', !vidSlut);
  }

  pilVanster.addEventListener('click', function () {
    inner.scrollBy({ left: -SCROLL_DIST, behavior: 'smooth' });
  });

  pilHoger.addEventListener('click', function () {
    inner.scrollBy({ left: SCROLL_DIST, behavior: 'smooth' });
  });

  inner.addEventListener('scroll', uppdateraPilar, { passive: true });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(uppdateraPilar, 80);
  }, { passive: true });

  // Run after full page load so layout dimensions are settled
  if (document.readyState === 'complete') {
    uppdateraPilar();
  } else {
    window.addEventListener('load', uppdateraPilar, { once: true });
  }
})();