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
let aktivaKategorier = new Set();
let valdaIngredienser = []; 
let pizzorSomVisas = 100; 
let nuvarandeFiltreradLista = []; 
let anvandarPosition = null;
let isNearbyActive = false;
let indexCoordsMap = null;
let geolocationPaminnelsePagar = false;
let mobilScrollHintEfterVisaFler = false;
window.dataLayer = window.dataLayer || []; // GTM tracking
let gtmSokDebounceTimer = null; // GTM tracking
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
    const kategoriText = `${pizza.kategori || ''} ${pizza._bpKategoriId || ''}`;
    return normaliseraText(`${pizza.pizzeria || ''} ${pizza.pizza_namn || ''} ${ingrediensText} ${kategoriText} ${pizza.omrade || ''} ${pizza.stad || ''}`);
}

function normaliseraText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

function formatteraPizzaNamnForVisning(namn) {
    return String(namn || '').trim();
}

function hamtaPizzaTaggarForVisning(pizza) {
    const text = byggPizzaSokText(pizza);
    const taggar = [];

    if (text.includes('stark') || text.includes('jalapeno')) taggar.push('stark');
    if (text.includes('kott') || text.includes('oxfile') || text.includes('skinka') || text.includes('salami')) taggar.push('kott');
    if (text.includes('kyckling')) taggar.push('kyckling');
    if (text.includes('kebab')) taggar.push('kebab');
    if (text.includes('vegetar') || arVegetariskText(text)) taggar.push('vegetarisk');
    if (text.includes('bbq')) taggar.push('bbq');
    if (text.includes('champinjon')) taggar.push('champinjoner');

    if (taggar.length >= 3) return [...new Set(taggar)].slice(0, 3);

    const fallback = Array.isArray(pizza.ingredienser)
        ? pizza.ingredienser
            .map((ing) => normaliseraText(ing))
            .filter(Boolean)
            .filter((ing) => ing.length >= 3)
        : [];

    for (const ing of fallback) {
        if (!taggar.includes(ing)) taggar.push(ing);
        if (taggar.length >= 3) break;
    }

    return taggar.slice(0, 3);
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
const SEAFOOD_LIST_RAW = ["räkor", "tonfisk", "musslor", "crabfish", "kräftstjärtar", "kräftor", "hummer", "lax", "pilgrimsmussla", "bläckfisk", "sardeller"];
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

function arAmerikanskKategoriPizza(item) {
    const normNamn = normaliseraText(item?.pizza_namn || '');
    return normNamn.includes('panpizza') ||
        normNamn.includes('amerikansk') ||
        normNamn.includes('americana') ||
        normNamn.includes('american');
}

function hamtaAktivaKategoriNamn() {
    return [...aktivaKategorier].filter((kategori) => kategori && kategori !== 'Pizzor (alla)');
}

function matcharKategori(item, kategori) {
    const normNamn = normaliseraText(item.pizza_namn || '');
    const normIngredienser = Array.isArray(item.ingredienser)
        ? item.ingredienser.map((i) => normaliseraText(i || ''))
        : [];

    const harIngrediens = (term) => {
        const normTerm = normaliseraText(term);
        return normIngredienser.some((i) => i.includes(normTerm));
    };
    const harNagonIngrediens = (terms) => terms.some((t) => harIngrediens(t));

    switch (kategori) {
        case 'Vegetariska':
            return arVegetariskText(byggPizzaSokText(item));

        case 'Inbakade':
            return normNamn.includes('inbakad');

        case 'Amerikanska pannpizzor':
            return arAmerikanskKategoriPizza(item);

        case 'Kebab och grillrätter': {
            const primarKat = hamtaPrimarKategoriForPizza(item);
            // Only show kebab items (NOT burgare), and pizzas with grill ingredients.
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
            return normNamn.includes('burgare') || normNamn.includes('burger') || normNamn.includes('hamburg');

        default:
            return true;
    }
}

function filtreraEfterKategori(menuItems, aktiva) {
    const aktivaNamn = aktiva instanceof Set
        ? [...aktiva]
        : Array.isArray(aktiva)
            ? aktiva
            : [aktiva];
    const valdaKategorier = aktivaNamn.filter((kategori) => kategori && kategori !== 'Pizzor (alla)');
    if (!valdaKategorier.length) return menuItems;

    return menuItems.filter((item) => valdaKategorier.some((kategori) => matcharKategori(item, kategori)));
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
        match: ['burgare', 'burger', 'hamburg']
    },
    sallad: {
        label: 'Sallader',
        emoji: '🥗',
        match: ['sallad', 'caesar', 'mixsallad', 'grekisk sallad', 'bowl', 'bowls']
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

// Emoji for each filter-strip category label
const KATEGORI_STRIP_EMOJI = {
    'Amerikanska pannpizzor': '<img src="images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">',
    'Burgare': '🍔',
    'Fläskfilé': '🍖',
    'Inbakade': '🫓',
    'Kebab och grillrätter': '🔥',
    'Kebab': '🥙',
    'Köttfärs': '🍕',
    'Kyckling': '🍗',
    'Oxfilé': '🥩',
    'Salami': '🍕',
    'Skaldjur': '🦐',
    'Vegetariska': '🥬',
};

// Keyword → emoji for search-based override (normalized keys)
const SOK_EMOJI_MAP = [
    { keys: ['kyckling'], emoji: '🍗' },
    { keys: ['kebab', 'kebabrulle', 'grill', 'gyros', 'shawarma'], emoji: '🥙' },
    { keys: ['burgare', 'burger', 'hamburgare'], emoji: '🍔' },
    { keys: ['falafel'], emoji: '🥙' },
    { keys: ['pasta', 'spaghetti', 'lasagne', 'penne'], emoji: '🍝' },
    { keys: ['sallad'], emoji: '🥗' },
    { keys: ['inbakad', 'calzone', 'halvinbakad'], emoji: '🫓' },
    { keys: ['vegetar', 'vegansk', 'vego'], emoji: '🥬' },
    { keys: ['oxfilé', 'oxfile'], emoji: '🥩' },
    { keys: ['fläskfilé', 'flaskfile'], emoji: '🍖' },
    { keys: ['rakor', 'räkor', 'skaldjur', 'tonfisk', 'scampi', 'musslor', 'kraftskraft', 'kraft'], emoji: '🦐' },
    { keys: ['salami'], emoji: '🍕' },
    { keys: ['pizza'], emoji: '🍕' },
];

function hamtaSokEmoji(sokstrang) {
    if (!sokstrang) return null;
    const norm = normaliseraText(sokstrang);
    for (const entry of SOK_EMOJI_MAP) {
        if (entry.keys.some((k) => norm.includes(k))) return entry.emoji;
    }
    return null;
}

function hamtaPizzaKortEmoji(pizza, aktivFilter, sokstrang) {
    // If a specific filter is active, all visible cards use that filter's emoji
    if (aktivFilter && aktivFilter !== 'Pizzor (alla)' && KATEGORI_STRIP_EMOJI[aktivFilter]) {
        return KATEGORI_STRIP_EMOJI[aktivFilter];
    }
    if (arAmerikanskKategoriPizza(pizza)) {
        return KATEGORI_STRIP_EMOJI['Amerikanska pannpizzor'];
    }
    // If search term maps to a known category, use that emoji
    const sokEmoji = hamtaSokEmoji(sokstrang);
    if (sokEmoji) return sokEmoji;
    const kategori = hamtaPrimarKategoriForPizza(pizza);
    // Non-pizza categories get their CATEGORY_MAP emoji directly
    if (kategori !== 'pizza') {
        return (CATEGORY_MAP[kategori] || CATEGORY_MAP.pizza).emoji;
    }
    // For plain pizza, check specific ingredients for a more precise emoji
    const normIngr = Array.isArray(pizza.ingredienser)
        ? pizza.ingredienser.map((i) => normaliseraText(i || ''))
        : [];
    const harIngrediens = (term) => {
        const t = normaliseraText(term);
        return normIngr.some((i) => i.includes(t));
    };
    if (harIngrediens('kyckling')) return '🍗';
    if (harIngrediens('fläskfilé')) return '🍖';
    if (harIngrediens('oxfilé')) return '🥩';
    if (SEAFOOD_LIST.some((t) => normIngr.some((i) => i.includes(t)))) return '🦐';
    return '🍕';
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
let pizzaKortNavigeringInitierad = false;

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

function initPizzaKortNavigering() {
    if (pizzaKortNavigeringInitierad) return;
    pizzaKortNavigeringInitierad = true;

    const lista = document.getElementById('resultat-lista');
    if (!lista) return;

    const arInteraktivtElement = (el) => Boolean(el && el.closest('a, button, input, textarea, select, label'));

    lista.addEventListener('click', (event) => {
        const kort = event.target.closest('.pizza-kort[data-href]');
        if (!kort || arInteraktivtElement(event.target)) return;

        const href = kort.dataset.href || '';
        if (href) {
            window.location.href = href;
        }
    });

    lista.addEventListener('keydown', (event) => {
        const target = event.target;
        const kort = target?.closest?.('.pizza-kort[data-href]');
        if (!kort || arInteraktivtElement(target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        const href = kort.dataset.href || '';
        if (href) {
            window.location.href = href;
        }
    });
}

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
                stad: pizza.stad || '',
                oppettider: pizza.oppettider || null
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
            oppettider: pizzeria.oppettider,
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
        uppdateraVisning();
    };

    sokruta.addEventListener('input', () => { 
        clearTimeout(gtmSokDebounceTimer); // GTM tracking
        gtmSokDebounceTimer = setTimeout(() => { // GTM tracking
            const sökSträng = sokruta.value.toLowerCase(); // GTM tracking
            gtmPushKlick({ event: 'sok', text: sökSträng }); // GTM tracking
        }, 350); // GTM tracking

        pizzorSomVisas = 100;
        koraSokflode();
    });

    sokruta.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
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
            aktivaKategorier.clear();
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
// ── Öppettider-hjälpare (används av pizzerior-lista) ──────────────────────────
function arOppetNu(oppettider) {
    if (!oppettider || typeof oppettider !== 'object') return null;
    const nu = new Date();
    const dag = nu.getDay();
    const nuMinuter = nu.getHours() * 60 + nu.getMinutes();
    const dagIndex = { man:1,mandag:1,monday:1,tis:2,tisdag:2,tuesday:2,ons:3,onsdag:3,wednesday:3,tor:4,tors:4,torsdag:4,thursday:4,thu:4,fre:5,fredag:5,friday:5,lor:6,lordag:6,saturday:6,sat:6,son:0,sondag:0,sunday:0,sun:0 };
    function norm(s) { return String(s||'').toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[._]/g,' ').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim(); }
    function hamtaDag(t) { return dagIndex[norm(t).replace(/\./g,'').replace(/\s+/g,'')]; }
    function tidMin(s) { const m=String(s||'').trim().match(/^(\d{1,2})[:.](\d{1,2})$/); if(!m)return null; const h=parseInt(m[1],10),min=parseInt(m[2],10); if(h<0||h>23||min<0||min>59)return null; return h*60+min; }
    function extractDagText(t) { return norm(t).replace(/\d{1,2}[:.]\d{1,2}/g,' ').replace(/[0-9]/g,' ').replace(/\s+/g,' ').trim(); }
    function tolkaDagNyckel(nyckelNorm, tidText, checkDag) {
        const allaDagar=['alla dagar','alladagar','alla dag','man-son','man-sondag'];
        if(allaDagar.indexOf(nyckelNorm)!==-1) return { hadeDag:true, matchar:true };
        let hadeDag=false, matchar=false;
        [nyckelNorm, extractDagText(tidText)].forEach(src=>{
            src.split(',').map(s=>s.trim()).filter(Boolean).forEach(del=>{
                const delar=del.split(/[-–—]/).map(d=>d.trim()).filter(Boolean);
                if(delar.length===2){const f=hamtaDag(delar[0]),t=hamtaDag(delar[1]);if(f!==undefined&&t!==undefined){hadeDag=true;const tr=(f<=t)?(checkDag>=f&&checkDag<=t):(checkDag>=f||checkDag<=t);if(tr)matchar=true;}}
                if(delar.length===1){const idx=hamtaDag(delar[0]);if(idx!==undefined){hadeDag=true;if(checkDag===idx)matchar=true;}}
            });
        });
        return {hadeDag, matchar};
    }
    function arNuInom(tidText) {
        const re=/(\d{1,2}[:.]\d{1,2})\s*[-–—]\s*(\d{1,2}[:.]\d{1,2})/g;
        let m, hittade=false;
        while((m=re.exec(tidText))!==null){
            hittade=true;
            const o=tidMin(m[1]),s=tidMin(m[2]);
            if(o===null||s===null)continue;
            if(o===s) return true;
            if(o<s){ if(nuMinuter>=o&&nuMinuter<s) return true; }
            else { if(nuMinuter>=o||nuMinuter<s) return true; }
        }
        return hittade ? false : null;
    }
    const kandidater=[];
    let hadeDagNyckel=false;
    Object.keys(oppettider).forEach(nyckel=>{
        const nyckelNorm=norm(nyckel);
        if(!nyckelNorm) return;
        const tidText=String(oppettider[nyckel]||'');
        const tolkad=tolkaDagNyckel(nyckelNorm, tidText, dag);
        if(tolkad.hadeDag){ hadeDagNyckel=true; if(tolkad.matchar) kandidater.push(tidText); return; }
        const tolkadVal=tolkaDagNyckel(extractDagText(tidText), '', dag);
        if(tolkadVal.hadeDag){ hadeDagNyckel=true; if(tolkadVal.matchar) kandidater.push(tidText); }
    });
    if(!kandidater.length) return hadeDagNyckel ? false : null;
    let hadeTolkbarTid=false;
    for(let i=0;i<kandidater.length;i++){
        const status=arNuInom(kandidater[i]);
        if(status===true) return true;
        if(status!==null) hadeTolkbarTid=true;
    }
    return hadeTolkbarTid ? false : null;
}

function stangerOppnarOm(oppettider) {
    if (!oppettider || typeof oppettider !== 'object') return '';
    const nu = new Date();
    const dag = nu.getDay();
    const dagIgar = (dag + 6) % 7;
    const nuMin = nu.getHours() * 60 + nu.getMinutes();
    const dagIndex = { man:1,mandag:1,monday:1,tis:2,tisdag:2,tuesday:2,ons:3,onsdag:3,wednesday:3,tor:4,tors:4,torsdag:4,thursday:4,thu:4,fre:5,fredag:5,friday:5,lor:6,lordag:6,saturday:6,sat:6,son:0,sondag:0,sunday:0,sun:0 };
    function norm(s){return String(s||'').toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[._]/g,' ').replace(/[–—−]/g,'-').replace(/\s+/g,' ').trim();}
    function hamtaDag(t){return dagIndex[norm(t).replace(/\./g,'').replace(/\s+/g,'')];}
    function tidMin(s){const m=String(s||'').trim().match(/^(\d{1,2})[:.](\d{1,2})$/);if(!m)return null;return parseInt(m[1],10)*60+parseInt(m[2],10);}
    function extractDagText(t){return norm(t).replace(/\d{1,2}[:.]\d{1,2}/g,' ').replace(/[0-9]/g,' ').replace(/\s+/g,' ').trim();}
    function dagMatcharFor(nyckelNorm,tidText,checkDag){
        const allaDagar=['alla dagar','alladagar','alla dag','man-son','man-sondag'];
        if(allaDagar.indexOf(nyckelNorm)!==-1)return true;
        let mat=false;
        [nyckelNorm, extractDagText(tidText)].forEach(src=>{
            src.split(',').map(s=>s.trim()).filter(Boolean).forEach(del=>{
                const delar=del.split(/[-–—]/).map(d=>d.trim()).filter(Boolean);
                if(delar.length===2){const f=hamtaDag(delar[0]),t=hamtaDag(delar[1]);if(f!==undefined&&t!==undefined){const tr=(f<=t)?(checkDag>=f&&checkDag<=t):(checkDag>=f||checkDag<=t);if(tr)mat=true;}}
                if(delar.length===1){const idx=hamtaDag(delar[0]);if(idx!==undefined&&checkDag===idx)mat=true;}
            });
        });
        return mat;
    }
    function formatMin(m){if(m<=0)return'';const h=Math.floor(m/60),min=m%60;if(h>0&&min>0)return h+'h '+min+'m';if(h>0)return h+'h';return min+'m';}
    const imorgon=(dag+1)%7;
    const intervallerIdag=[], intervallerImorgon=[], intervallerIgar=[];
    Object.keys(oppettider).forEach(nyckel=>{
        const tidText=String(oppettider[nyckel]||'');
        const nyckelNorm=norm(nyckel);
        const re=/(\d{1,2}[:.]\d{1,2})\s*[-–—]\s*(\d{1,2}[:.]\d{1,2})/g;
        let m2;
        while((m2=re.exec(tidText))!==null){
            const o=tidMin(m2[1]),s=tidMin(m2[2]);
            if(o===null||s===null)continue;
            if(dagMatcharFor(nyckelNorm,tidText,dagIgar))intervallerIgar.push({o,s});
            if(dagMatcharFor(nyckelNorm,tidText,dag))intervallerIdag.push({o,s});
            if(dagMatcharFor(nyckelNorm,tidText,imorgon))intervallerImorgon.push({o,s});
        }
    });

    // First check if we are in an overnight spill from yesterday.
    for(let i=0;i<intervallerIgar.length;i++){
        const {o,s}=intervallerIgar[i];
        if(o>s && nuMin<s){
            return '⏳ Stänger om '+formatMin(s-nuMin);
        }
    }

    for(let i=0;i<intervallerIdag.length;i++){
        const {o,s}=intervallerIdag[i];
        if(o<s){
            if(nuMin>=o&&nuMin<s){
                return '⏳ Stänger om '+formatMin(s-nuMin);
            }
        }else if(o>s){
            // Overnight interval for today only counts before midnight on the same day.
            if(nuMin>=o){
                return '⏳ Stänger om '+formatMin(1440-nuMin+s);
            }
        }
    }

    let nastaIdag=null;
    intervallerIdag.forEach(({o})=>{if(o>nuMin){const d=o-nuMin;if(nastaIdag===null||d<nastaIdag)nastaIdag=d;}});
    if(nastaIdag!==null)return '🕐 Öppnar om '+formatMin(nastaIdag);
    let nastaImorgon=null;
    intervallerImorgon.forEach(({o})=>{const d=(1440-nuMin)+o;if(nastaImorgon===null||d<nastaImorgon)nastaImorgon=d;});
    if(nastaImorgon!==null)return '🕐 Öppnar om '+formatMin(nastaImorgon);
    return '';
}

function skapaPizzeriaKort(pizzeria) {
    const kort = document.createElement('div');
    kort.className = 'pizza-kort';
    const telefonSanerad = saneraTelefonnummer(pizzeria.telefon);
    const mapsLank = skapaGoogleMapsSokLank(pizzeria.namn, pizzeria.adress);
    const pizzeriaNamnSafe = escapaHtml(pizzeria.namn);
    const adressSafe = escapaHtml(pizzeria.adress);
    const telefonSafe = escapaHtml(pizzeria.telefon);

    const telefonRad = pizzeria.telefon
        ? `<p><a href="tel:${telefonSanerad}" class="kort-telefon">📞 ${telefonSafe}</a></p>`
        : `<p class="kort-telefon-saknas">📞 Telefonnummer saknas</p>`;

    const adressRad = pizzeria.adress
        ? `<p><a href="${mapsLank}" target="_blank" rel="noopener noreferrer" class="kort-adress"><span class="kort-adress-emoji">📍</span> <span class="kort-adress-text">${adressSafe}</span></a></p>`
        : `<p class="kort-adress-saknas">📍 Adress saknas</p>`;

    const distansRad = (pizzeria.distansKm !== undefined && pizzeria.distansKm !== Number.POSITIVE_INFINITY)
        ? `<p class="kort-distans">📏 ${pizzeria.distansKm < 1 ? Math.round(pizzeria.distansKm * 1000) + ' m' : pizzeria.distansKm.toFixed(1).replace('.', ',') + ' km'} bort</p>`
        : '';

    let oppetRad = '';
    if (pizzeria.oppettider) {
        const status = arOppetNu(pizzeria.oppettider);
        const tidKvar = stangerOppnarOm(pizzeria.oppettider);
        if (status === true) {
            oppetRad = `<div class="kort-oppet-wrap"><span class="kort-oppet kort-oppet--oppen">● Öppet nu</span>${tidKvar ? `<span class="kort-tid-kvar">${tidKvar}</span>` : ''}</div>`;
        } else if (status === false) {
            oppetRad = `<div class="kort-oppet-wrap"><span class="kort-oppet kort-oppet--stangt">● Stängt nu</span>${tidKvar ? `<span class="kort-tid-kvar">${tidKvar}</span>` : ''}</div>`;
        }
    }

    kort.innerHTML = `
        <h3>${pizzeriaNamnSafe}</h3>
        ${telefonRad}
        ${adressRad}
        ${distansRad}
        ${oppetRad}
        <button type="button" class="pizzeria-btn pizzeria-btn-visa-meny"><span class="btn-emoji">📖</span> Visa meny</button>
    `;

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
    const sorteraSelect = document.getElementById('pizzerior-sortera');
    const omradeFilterDiv = document.getElementById('pizzerior-omrade-filter');
    const rubriken = document.getElementById('pizzerior-rubrik');
    const omradeNamnet = document.getElementById('pizzerior-omrade-namn');

    let allaPizzeriorLista = [];
    let standardSorteradLista = [];
    let coordsKoppladLista = [];
    let narmastAktiv = false;
    let narmastPagar = false;
    let aktivtOmrade = null;
    let visaBaraOppna = false;
    let omradestatistik = {};
    const kartaIframeEl = document.getElementById('pizzerior-karta-iframe');
    const kartaIframeStorEl = document.getElementById('pizzerior-karta-iframe-stor');
    const kartaExpandBtn = document.getElementById('pizzerior-map-expand');
    const kartaModal = document.getElementById('pizzerior-karta-modal');
    const kartaModalCloseBtn = document.getElementById('pizzerior-karta-modal-close');

    function appliceraKartaIframeLayout(iframeEl) {
        if (!iframeEl) return;

        iframeEl.src = hamtaNavigeringsLankForPizzeria('/karta');
        iframeEl.addEventListener('load', () => {
            try {
                const doc = iframeEl.contentDocument;
                if (!doc) return;

                const doljSelectors = [
                    '.navbar',
                    '#karta-filter-knapp',
                    '#karta-kontroller',
                    '#karta-prishjul',
                    '#karta-bottom-nav',
                    '#karta-vanster-meny',
                    '#karta-meny-overlay',
                    '#karta-help-overlay'
                ];

                doljSelectors.forEach((selector) => {
                    doc.querySelectorAll(selector).forEach((el) => {
                        el.style.display = 'none';
                    });
                });

                const mapEl = doc.getElementById('karta-container');
                if (mapEl) {
                    mapEl.style.position = 'absolute';
                    mapEl.style.top = '0';
                    mapEl.style.left = '0';
                    mapEl.style.right = '0';
                    mapEl.style.bottom = '0';
                }

                const yta = doc.getElementById('karta-yta');
                if (yta) {
                    yta.style.position = 'relative';
                    yta.style.height = '100%';
                    yta.style.minHeight = '0';
                }

                doc.documentElement.style.overflow = 'hidden';
                doc.body.style.overflow = 'hidden';
                doc.body.style.margin = '0';
            } catch (_error) {
                // Ignore iframe styling errors and keep default karta view.
            }
        });
    }

    function syncFilterTillIframe(iframe) {
        try { iframe.contentWindow.postMessage({ type: 'setFilter', oppetNu: visaBaraOppna }, '*'); } catch (_) {}
    }

    function oppnaStorKarta() {
        if (!kartaModal) return;
        kartaModal.classList.add('is-open');
        kartaModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (kartaIframeStorEl && !kartaIframeStorEl.src) {
            appliceraKartaIframeLayout(kartaIframeStorEl);
            kartaIframeStorEl.addEventListener('load', () => syncFilterTillIframe(kartaIframeStorEl), { once: true });
        } else if (kartaIframeStorEl) {
            syncFilterTillIframe(kartaIframeStorEl);
        }
    }

    function stangStorKarta() {
        if (!kartaModal) return;
        kartaModal.classList.remove('is-open');
        kartaModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function initieraKartaIframe() {
        if (!kartaIframeEl) return;

        appliceraKartaIframeLayout(kartaIframeEl);

        if (kartaExpandBtn) {
            kartaExpandBtn.addEventListener('click', (event) => {
                event.preventDefault();
                oppnaStorKarta();
            });
        }

        if (kartaModalCloseBtn) {
            kartaModalCloseBtn.addEventListener('click', stangStorKarta);
        }

        if (kartaModal) {
            kartaModal.addEventListener('click', (event) => {
                if (event.target === kartaModal) {
                    stangStorKarta();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && kartaModal && kartaModal.classList.contains('is-open')) {
                stangStorKarta();
            }
        });

        const minPositionBtn = document.getElementById('pizzerior-min-position-btn');
        if (minPositionBtn) {
            minPositionBtn.addEventListener('click', () => {
                if (minPositionBtn.classList.contains('aktiv')) {
                    minPositionBtn.classList.remove('aktiv');
                    [kartaIframeEl, kartaIframeStorEl].filter(Boolean).forEach((iframe) => {
                        try { iframe.contentWindow.postMessage({ type: 'clearView' }, '*'); } catch (_) {}
                    });
                    return;
                }
                if (!navigator.geolocation) return;
                minPositionBtn.disabled = true;
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        [kartaIframeEl, kartaIframeStorEl].filter(Boolean).forEach((iframe) => {
                            try {
                                iframe.contentWindow.postMessage({ type: 'setView', lat, lng, zoom: 14 }, '*');
                            } catch (_) {}
                        });
                        minPositionBtn.classList.add('aktiv');
                        minPositionBtn.disabled = false;
                    },
                    () => { minPositionBtn.disabled = false; }
                );
            });
        }
    }

    function visaPizzerior(pizzerior) {
        lista.innerHTML = '';
        if (pizzerior.length === 0) {
            const tomRuta = document.createElement('div');
            tomRuta.className = 'ingen-traff';
            tomRuta.innerHTML = visaBaraOppna
                ? '<h3>Just nu hittar vi inga öppna pizzerior 🍕</h3><p>Det känns ungefär som att stå utanför kebabstället 02:31 och se personalen låsa medan man fortfarande har menyn uppe.<br><br>Men håll ut — någon där ute har säkert deg på gång 👨‍🍳🔥</p>'
                : '<h3>Inga pizzerior hittades</h3><p>Testa en annan sökning eller ett annat område.</p>';
            lista.appendChild(tomRuta);
        } else {
            pizzerior.forEach((p) => lista.appendChild(skapaPizzeriaKort(p)));
        }

        // Uppdatera antal-badge
        const antalSiffra = document.getElementById('pizzerior-antal-siffra');
        if (antalSiffra) antalSiffra.textContent = pizzerior.length;

        if (traffarEl) {
            const n = pizzerior.length;
            if (narmastAktiv) {
                traffarEl.textContent = n === 0
                    ? 'Inga pizzerior hittades'
                    : `Visar topp ${n} närmaste pizzerior`;
            } else {
                traffarEl.textContent = '';
            }
        }
    }

    function updateraRubrik() {
        if (rubriken) rubriken.textContent = 'Hitta Sveriges bästa pizzerior';
        if (omradeNamnet) omradeNamnet.textContent = aktivtOmrade || 'Alla pizzerior';
    }

    function filtreraPizzerior() {
        const term = sokruta ? normaliseraText(sokruta.value) : '';
        let bas = aktivtOmrade
            ? allaPizzeriorLista.filter((p) => p.stad === aktivtOmrade)
            : [...allaPizzeriorLista];

        if (visaBaraOppna) {
            bas = bas.filter((p) => arOppetNu(p.oppettider) === true);
        }

        if (!term) return bas;

        if (arStriktOmradesokterm(term)) {
            return bas.filter((p) => normaliseraText(p.omrade || '') === term);
        }

        return bas.filter((p) =>
            normaliseraText(p.namn).includes(term) ||
            normaliseraText(p.omrade || '').includes(term) ||
            normaliseraText(p.adress || '').includes(term)
        );
    }

    function sorteraPizzerior(pizzerior) {
        const sortering = sorteraSelect ? sorteraSelect.value : 'namn';
        const kopierad = [...pizzerior];
        
        if (sortering === 'namn-desc') {
            return kopierad.sort((a, b) => b.namn.localeCompare(a.namn, 'sv'));
        }
        return kopierad.sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
    }

    function uppdateraVisningPizzerior() {
        const filtrerad = filtreraPizzerior();
        const sorterad = sorteraPizzerior(filtrerad);
        const attVisa = narmastAktiv ? sorterad.slice(0, 10) : sorterad;
        visaPizzerior(attVisa);
    }

    function byggaOmradeFilter() {
        if (!omradeFilterDiv) return;
        omradeFilterDiv.innerHTML = '';

        const omraden = Object.entries(omradestatistik)
            .sort((a, b) => a[0].localeCompare(b[0], 'sv'));

        // Alla pizzerior knapp
        const allaBtn = document.createElement('button');
        allaBtn.type = 'button';
        allaBtn.className = 'pizzerior-omrade-btn';
        if (!aktivtOmrade) allaBtn.classList.add('aktiv');
        allaBtn.textContent = `Alla pizzerier ${Object.values(omradestatistik).reduce((a, b) => a + b, 0)}`;
        allaBtn.addEventListener('click', () => {
            aktivtOmrade = null;
            updateraRubrik();
            opdateraOmradeKnappar();
            uppdateraVisningPizzerior();
        });
        omradeFilterDiv.appendChild(allaBtn);

        // Omrâdes-knappar
        omraden.forEach(([omrade, antal]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pizzerior-omrade-btn';
            if (aktivtOmrade === omrade) btn.classList.add('aktiv');
            btn.textContent = `${omrade} ${antal}`;
            btn.addEventListener('click', () => {
                aktivtOmrade = omrade;
                updateraRubrik();
                opdateraOmradeKnappar();
                uppdateraVisningPizzerior();
            });
            omradeFilterDiv.appendChild(btn);
        });
    }

    function opdateraOmradeKnappar() {
        const btns = document.querySelectorAll('.pizzerior-omrade-btn');
        btns.forEach((btn) => {
            btn.classList.remove('aktiv');
            const text = btn.textContent.split(' ')[0];
            if ((!aktivtOmrade && btn.textContent.startsWith('Alla')) || (aktivtOmrade === text)) {
                btn.classList.add('aktiv');
            }
        });
    }

    Promise.all([
        fetch('/data/pizzor.json').then((response) => response.json()),
        hamtaPizzeriorCoordsMap()
    ])
        .then(([data, coordsMap]) => {
            const allaPizzeriorData = skapaPizzeriorSidaDataFranJson(data);
            injecteraJsonLd(byggItemListSchema(allaPizzeriorData), 'schema-itemlist');

            coordsKoppladLista = kopplaCoordsTillPizzerior(allaPizzeriorData, coordsMap);

            // Räkna pizzerior per stad
            omradestatistik = {};
            allaPizzeriorData.forEach((p) => {
                const stad = p.stad || 'Göteborg';
                omradestatistik[stad] = (omradestatistik[stad] || 0) + 1;
            });

            standardSorteradLista = [...allaPizzeriorData].sort((a, b) => a.namn.localeCompare(b.namn, 'sv'));
            allaPizzeriorLista = coordsKoppladLista.length > 0
                ? [...coordsKoppladLista]
                : [...standardSorteradLista];
            
            byggaOmradeFilter();
            updateraRubrik();
            uppdateraVisningPizzerior();
        })
        .catch((error) => {
            console.error('[Pizzerior] Kunde inte initiera data för pizzerior-sidan:', error);
        });

    if (sokruta) {
        sokruta.addEventListener('input', uppdateraVisningPizzerior);
    }

    if (sorteraSelect) {
        sorteraSelect.addEventListener('change', uppdateraVisningPizzerior);
    }

    const oppetNuToggle = document.getElementById('oppet-nu-toggle-wrap');
    if (oppetNuToggle) {
        oppetNuToggle.addEventListener('click', () => {
            visaBaraOppna = !visaBaraOppna;
            oppetNuToggle.classList.toggle('aktiv', visaBaraOppna);
            uppdateraVisningPizzerior();
            [kartaIframeEl, kartaIframeStorEl].filter(Boolean).forEach((iframe) => {
                try { iframe.contentWindow.postMessage({ type: 'setFilter', oppetNu: visaBaraOppna }, '*'); } catch (_) {}
            });
        });
    }

    initieraKartaIframe();

    if (narmastBtn) {
        narmastBtn.addEventListener('click', async () => {
            if (narmastPagar) return;

            if (narmastAktiv) {
                narmastAktiv = false;
                narmastBtn.classList.remove('narmast-aktiv');
                narmastBtn.textContent = '📍 Närmast mig';
                allaPizzeriorLista = coordsKoppladLista.length > 0
                    ? [...coordsKoppladLista]
                    : standardSorteradLista.map(({ distansKm, ...rest }) => rest);
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

// Maps each pizza to the same category id as the index strip uses
function kategoriseraPizzeriaItem(pizza) {
    if (pizza && typeof pizza._bpKategoriId === 'string' && pizza._bpKategoriId) {
        return pizza._bpKategoriId;
    }

    // Name-based checks run first so e.g. "Amerikansksallad" → sallader, not amerikanska
    const namn = normaliseraText(pizza.pizza_namn || '');
    const LASAGNE_ORD = ['lasagne', 'lasagna'];
    const PASTA_ORD   = ['pasta', 'spaghetti', 'tagliatelle', 'penne', 'linguine', 'fettuccine', 'rigatoni', 'carbonara', 'bolognese'];
    const SALLAD_ORD  = ['sallad', 'salad'];

    if (SALLAD_ORD.some((o) => namn.includes(o)))  return 'sallader';
    if (LASAGNE_ORD.some((o) => namn.includes(o))) return 'lasagne';
    if (PASTA_ORD.some((o) => namn.includes(o)))   return 'pasta';

    // Ingredient/name-based category checks
    if (matcharKategori(pizza, 'Amerikanska pannpizzor')) return 'amerikanska';
    if (matcharKategori(pizza, 'Burgare'))                return 'burgare';
    if (matcharKategori(pizza, 'Inbakade'))               return 'inbakade';
    if (matcharKategori(pizza, 'Kebab'))                  return 'kebab';
    if (matcharKategori(pizza, 'Kebab och grillrätter'))  return 'kebab';
    if (matcharKategori(pizza, 'Kyckling'))               return 'kyckling';
    if (matcharKategori(pizza, 'Oxfilé'))                 return 'oxfile';
    if (matcharKategori(pizza, 'Fläskfilé'))              return 'flaskfile';
    if (matcharKategori(pizza, 'Skaldjur'))               return 'skaldjur';
    if (matcharKategori(pizza, 'Köttfärs'))               return 'kottfars';
    if (matcharKategori(pizza, 'Salami'))                 return 'salami';
    if (matcharKategori(pizza, 'Vegetariska'))            return 'vegetarisk';

    return 'pizzor';
}

// Emoji for each pizzeria-page category id
const PIZZERIA_KAT_EMOJI = {
    pizzor:      '🍕',
    amerikanska: '<img src="/images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">',
    burgare:     '🍔',
    flaskfile:   '🍖',
    inbakade:    '🫓',
    kebab:       '🥙',
    kottfars:    '🍕',
    kyckling:    '🍗',
    oxfile:      '🥩',
    salami:      '🍕',
    skaldjur:    '🦐',
    vegetarisk:  '🥬',
    lasagne:     '🫕',
    pasta:       '🍝',
    sallader:    '🥗',
    dryck:       '🥤',
    snacks:      '🍟',
    saser:       '🧄',
    tillbehor:   '🍽️',
    dessert:     '🍰',
};

const PIZZERIA_EXTRA_KOMPAKTA = new Set(['dryck', 'snacks', 'saser', 'tillbehor', 'dessert']);

function normaliseraExtraKategoriId(kategori) {
    const k = normaliseraText(kategori || '');
    if (!k) return 'tillbehor';
    if (k === 'dryck' || k.includes('dryck')) return 'dryck';
    if (k === 'snacks' || k.includes('snack')) return 'snacks';
    if (k === 'saser' || k === 'sos' || k.includes('sas')) return 'saser';
    if (k === 'dessert' || k.includes('efterratt')) return 'dessert';
    return 'tillbehor';
}

function normaliseraExtraPoster(extraLista, soktNamnNormaliserat) {
    if (!Array.isArray(extraLista)) return [];
    return extraLista
        .filter((row) => normaliseraText(row?.pizzeria || '') === soktNamnNormaliserat)
        .map((row) => {
            const beskrivning = String(row?.beskrivning || '').trim();
            return {
                pizzeria: row.pizzeria,
                pizza_namn: String(row?.namn || '').trim(),
                pris: Number(row?.pris) || 0,
                ingredienser: beskrivning ? [beskrivning] : [],
                beskrivning,
                _bpKategoriId: normaliseraExtraKategoriId(row?.kategori),
            };
        })
        .filter((row) => row.pizza_namn);
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

    Promise.all([
        fetch('../data/pizzor.json').then((response) => response.json()),
        fetch('../data/extras.json')
            .then((response) => (response.ok ? response.json() : []))
            .catch(() => []),
    ])
        .then(([data, extraData]) => {
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
            const soktNamnNormaliserat = normaliseraText(pizzeriaNamn);
            const pizzor = data
                .filter((pizza) => (pizza.pizzeria || '').toLowerCase().trim() === soktNamn)
                .sort((a, b) => a.pizza_namn.localeCompare(b.pizza_namn, 'sv'));
            const extraPoster = normaliseraExtraPoster(extraData, soktNamnNormaliserat);
            const huvudRatter = pizzor;
            const extraRatter = extraPoster;
            const allaRatter = [...pizzor, ...extraPoster].sort((a, b) => {
                const ka = kategoriseraPizzeriaItem(a);
                const kb = kategoriseraPizzeriaItem(b);
                if (ka !== kb) return ka.localeCompare(kb, 'sv');
                return String(a.pizza_namn || '').localeCompare(String(b.pizza_namn || ''), 'sv');
            });

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

                // Opening hours — populate the right-column box
                if (pizzeriaInfo.oppettider && typeof pizzeriaInfo.oppettider === 'object') {
                    const oppBox = document.getElementById('oppettider-box');
                    const oppLista = document.getElementById('oppettider-lista');
                    if (oppBox && oppLista) {
                        const DAGORDNING = ['måndag','tisdag','onsdag','torsdag','fredag','lördag','söndag'];
                        const DAGKORT = {
                            'mån':'måndag','man':'måndag','tis':'tisdag','ons':'onsdag','tor':'torsdag','tors':'torsdag',
                            'fre':'fredag','lör':'lördag','lor':'lördag','sön':'söndag','son':'söndag',
                            'måndag':'måndag','tisdag':'tisdag','onsdag':'onsdag','torsdag':'torsdag',
                            'fredag':'fredag','lördag':'lördag','söndag':'söndag',
                            'mon':'måndag','tue':'tisdag','wed':'onsdag','thu':'torsdag',
                            'fri':'fredag','sat':'lördag','sun':'söndag'
                        };
                        const DAGVISNING = {
                            'måndag':'Måndag','tisdag':'Tisdag','onsdag':'Onsdag','torsdag':'Torsdag',
                            'fredag':'Fredag','lördag':'Lördag','söndag':'Söndag'
                        };

                        function normDag(s) {
                            return (s || '').toLowerCase().trim().replace(/[^a-zåäö]/g, '');
                        }

                        function expanderaDagar(dagNyckel, tid) {
                            // Split on dash/hyphen/en-dash/–, handle "mån-fre", "Måndag – Torsdag" etc.
                            const delar = dagNyckel.split(/[-–—]/).map((d) => normDag(d)).filter(Boolean);
                            if (delar.length === 2) {
                                const fran = DAGKORT[delar[0]];
                                const till = DAGKORT[delar[1]];
                                const frIdx = DAGORDNING.indexOf(fran);
                                const tiIdx = DAGORDNING.indexOf(till);
                                if (frIdx !== -1 && tiIdx !== -1) {
                                    const resultat = [];
                                    for (let i = frIdx; i <= tiIdx; i++) {
                                        resultat.push({ dag: DAGVISNING[DAGORDNING[i]], tid });
                                    }
                                    return resultat;
                                }
                            }
                            // Single day
                            const norm = DAGKORT[normDag(dagNyckel)];
                            const visning = norm ? DAGVISNING[norm] : dagNyckel;
                            return [{ dag: visning, tid }];
                        }

                        // Build expanded list, preserving day order
                        const dagMap = new Map();
                        Object.entries(pizzeriaInfo.oppettider).forEach(([nyckel, tid]) => {
                            expanderaDagar(nyckel, tid).forEach(({ dag, tid: t }) => {
                                dagMap.set(dag.toLowerCase(), { dag, tid: t });
                            });
                        });

                        // Sort by DAGORDNING
                        const sorterade = DAGORDNING
                            .map((d) => dagMap.get(d))
                            .filter(Boolean);

                        oppLista.innerHTML = sorterade
                            .map(({ dag, tid }) => `<div class="oppettider-rad"><span class="opp-dag">${escapaHtml(dag)}</span><span class="opp-tid">${escapaHtml(tid)}</span></div>`)
                            .join('');
                        oppBox.style.display = '';
                    }
                }

                // Map widget link
                const karteBtn = document.getElementById('karta-widget-btn');
                if (karteBtn && pizzeriaInfo.adress) {
                    karteBtn.href = skapaGoogleMapsSokLank(pizzeriaNamn, pizzeriaInfo.adress);
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

            // Load coords and init interactive Leaflet map
            fetch('../data/pizzerior_coords.json')
                .then((r) => r.json())
                .then((coords) => {
                    const koordMatch = coords.find((c) => normaliseraText(c.pizzeria) === normaliseraText(pizzeriaNamn));
                    if (!koordMatch) return;
                    const { lat, lng } = koordMatch;

                    // "Visa på karta" → Google Maps for navigation
                    const karteBtnKoord = document.getElementById('karta-widget-btn');
                    if (karteBtnKoord) {
                        karteBtnKoord.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    }

                    // Render map directly so it is visible from the first paint.
                    const mapEl = document.getElementById('leaflet-map');
                    const fallback = document.getElementById('karta-ikon-fallback');
                    if (mapEl) {
                        const delta = 0.0036;
                        const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=${lat},${lng}`;
                        mapEl.innerHTML = `<iframe class="karta-iframe-live" src="${iframeSrc}" title="Karta" frameborder="0" scrolling="no" loading="lazy" referrerpolicy="no-referrer"></iframe>`;

                        const expandBtn = document.createElement('button');
                        expandBtn.className = 'karta-expand-btn';
                        expandBtn.type = 'button';
                        expandBtn.setAttribute('aria-label', 'Visa större karta');
                        expandBtn.innerText = '⛶';
                        mapEl.appendChild(expandBtn);

                        let kartaModal = document.getElementById('karta-modal');
                        if (!kartaModal) {
                            kartaModal = document.createElement('div');
                            kartaModal.id = 'karta-modal';
                            kartaModal.className = 'karta-modal';
                            kartaModal.setAttribute('role', 'dialog');
                            kartaModal.setAttribute('aria-modal', 'true');
                            kartaModal.setAttribute('aria-label', 'Stor karta');
                            kartaModal.innerHTML = `
                                <div class="karta-modal-inner">
                                  <div id="leaflet-map-modal" class="karta-iframe-modal"></div>
                                  <button class="karta-modal-stang" id="karta-modal-stang" aria-label="Stäng karta">✕</button>
                                  <a class="karta-modal-extern" id="karta-modal-extern" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer">↗ Öppna i Google Maps</a>
                                </div>
                            `;
                            document.body.appendChild(kartaModal);
                        }

                        const closeBtn = document.getElementById('karta-modal-stang');

                        // Dynamically load Leaflet for the modal
                        function _laddaLeaflet(cb) {
                            if (window.L) { cb(); return; }
                            const lcss = document.createElement('link');
                            lcss.rel = 'stylesheet';
                            lcss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                            lcss.crossOrigin = '';
                            document.head.appendChild(lcss);
                            const ljs = document.createElement('script');
                            ljs.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                            ljs.crossOrigin = '';
                            ljs.onload = cb;
                            document.body.appendChild(ljs);
                        }

                        const oppnaKartaModal = () => {
                            const modal = document.getElementById('karta-modal');
                            if (!modal) return;
                            modal.classList.add('karta-modal--open');
                            document.body.style.overflow = 'hidden';
                            if (!window._bpModalMapInited) {
                                _laddaLeaflet(() => {
                                    window._bpModalMapInited = true;
                                    const el = document.getElementById('leaflet-map-modal');
                                    if (!el || el._leaflet_id) return;
                                    const mmap = L.map(el, {
                                        center: [lat, lng],
                                        zoom: 16,
                                        zoomControl: true,
                                        scrollWheelZoom: true,
                                        dragging: true,
                                        attributionControl: true
                                    });
                                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                        maxZoom: 19,
                                        attribution: '© OpenStreetMap'
                                    }).addTo(mmap);
                                    const markerIkonModal = L.divIcon({
                                        className: 'bp-marker',
                                        html: '<div class="bp-marker-pin"></div>',
                                        iconSize: [24, 36],
                                        iconAnchor: [12, 36],
                                        popupAnchor: [0, -36]
                                    });
                                    L.marker([lat, lng], { icon: markerIkonModal }).addTo(mmap)
                                        .bindPopup(`<b>${escapaHtml(pizzeriaNamn)}</b>`, { className: 'bp-popup' })
                                        .openPopup();
                                    setTimeout(() => mmap.invalidateSize(), 150);
                                });
                            }
                        };

                        const stangKartaModal = () => {
                            const modal = document.getElementById('karta-modal');
                            if (!modal) return;
                            modal.classList.remove('karta-modal--open');
                            document.body.style.overflow = '';
                        };

                        expandBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            oppnaKartaModal();
                        });

                        if (closeBtn && !closeBtn.dataset.bound) {
                            closeBtn.dataset.bound = '1';
                            closeBtn.addEventListener('click', stangKartaModal);
                        }

                        if (kartaModal && !kartaModal.dataset.bound) {
                            kartaModal.dataset.bound = '1';
                            kartaModal.addEventListener('click', (e) => {
                                if (e.target === kartaModal) stangKartaModal();
                            });
                            document.addEventListener('keydown', (e) => {
                                if (e.key === 'Escape') stangKartaModal();
                            });
                        }

                        if (fallback) fallback.style.display = 'none';
                    }
                })
                .catch(() => { /* coords unavailable — fallback emoji stays */ });

            const seoEl = document.querySelector('.pizzeria-seo');
            if (seoEl && pizzeriaInfo) {
                const omrade = pizzeriaInfo.omrade || '';
                const stad = pizzeriaInfo.stad || 'Mölndal';
                const arSvennepizzan = normaliseraPizzeriaNamn(pizzeriaNamn) === 'svennepizzan';
                if (arSvennepizzan) {
                    seoEl.innerText =
                        `Välkommen till Svennepizzan - Sveriges första medlemspizzeria.\n\n` +
                        `Svennepizzan skapades för att hylla den svenska pizzakulturen och erbjuda en upplevelse som är smartare, godare och enklare. Enkelhet och kvalitet står i centrum, och med endast tio noggrant utvalda pizzor på menyn blir det lätt att välja rätt.\n\n` +
                        `Historien tar sin början med Sven "Svenne" Karlsson, en ung kock som på 1940-talet tog med sig inspiration från Italien hem till Sverige och skapade något unikt - svensk pizza när den är som bäst. Denna filosofi lever vidare i dag genom Fredrik Mattson, hjärnan bakom succén Pinchos, som med Svennepizzan har velat förena tradition och nytänkande i en modern tolkning av den svenska pizzaupplevelsen.\n\n` +
                        `Som medlem får gästen mer än bara en pizza. Med rabatt, dryck, sås och sallad inkluderat erbjuds ett helhetskoncept där värde för pengarna står i fokus. Här hyllas den svenska pizzakulturen genom enkelhet, prisvärdhet och kvalitet, där tio klassiker får låta smakerna tala.\n\n` +
                        `Svennepizzan är en hyllning till det svenska. 🇸🇪🍕`;
                } else {
                    // --- Data-driven description ---
                    const rader = [];

                    // Rad 1: Plats
                    if (pizzeriaInfo.adress) {
                        const plats = omrade ? `${omrade}, ${stad}` : stad;
                        rader.push(`${pizzeriaNamn} ligger på ${pizzeriaInfo.adress} i ${plats}.`);
                    }

                    // Rad 2: Kategorier som faktiskt finns i menyn
                    const katEtiketter = {
                        pizzor:      'pizzor',
                        amerikanska: 'amerikanska pannpizzor',
                        burgare:     'burgare',
                        flaskfile:   'fläskfilérätter',
                        inbakade:    'inbakade pizzor',
                        kebab:       'kebab, rullar och tallrikar',
                        kottfars:    'köttfärspizzor',
                        kyckling:    'kycklingrätter',
                        oxfile:      'oxfilérätter',
                        salami:      'salamipizzor',
                        skaldjur:    'skaldjurspizzor',
                        vegetarisk:  'vegetariska rätter',
                        lasagne:     'lasagne',
                        pasta:       'pasta',
                        sallader:    'sallader',
                        dryck:       'dryck',
                        snacks:      'snacks',
                        saser:       'såser',
                        tillbehor:   'tillbehör',
                        dessert:     'desserter',
                    };
                    const befintligaKat = [...new Set(allaRatter.map(kategoriseraPizzeriaItem))];
                    const katNamn = befintligaKat
                        .filter((k) => k !== 'pizzor')
                        .map((k) => katEtiketter[k])
                        .filter(Boolean);
                    const harPizzor = befintligaKat.includes('pizzor');
                    const allaMat = harPizzor ? ['pizzor', ...katNamn] : katNamn;
                    if (allaMat.length > 0) {
                        rader.push(`Här hittar du ${allaMat.join(', ')}.`);
                    }

                    // Rad 3: Exempel på rätter (upp till 5, blandade kategorier)
                    const exempelRatter = [];
                    const sedda = new Set();
                    for (const p of allaRatter) {
                        if (exempelRatter.length >= 5) break;
                        const namn = (p.pizza_namn || '').trim();
                        if (namn && !sedda.has(namn.toLowerCase())) {
                            sedda.add(namn.toLowerCase());
                            exempelRatter.push(namn);
                        }
                    }
                    if (exempelRatter.length > 0) {
                        rader.push(`På menyn finns bland annat ${exempelRatter.join(', ')}.`);
                    }

                    // Rad 4: Prisinfo
                    const priser = allaRatter.map((p) => p.pris).filter((pr) => pr > 0);
                    if (priser.length > 0) {
                        const minPris = Math.min(...priser);
                        const maxPris = Math.max(...priser);
                        const snittpris = Math.round(priser.reduce((s, p) => s + p, 0) / priser.length);
                        rader.push(`Priserna ligger mellan ${minPris} och ${maxPris} kr (snitt ${snittpris} kr).`);
                    }

                    // Rad 5: Öppettider
                    if (pizzeriaInfo.oppettider && typeof pizzeriaInfo.oppettider === 'object') {
                        const opp = pizzeriaInfo.oppettider;
                        const oppRader = Object.entries(opp).map(([dag, tid]) => `${dag}: ${tid}`);
                        if (oppRader.length > 0) {
                            rader.push(`Öppettider: ${oppRader.join(', ')}.`);
                        }
                    }

                    seoEl.innerText = rader.join('\n\n');
                }
            }

            titel.innerText = `${pizzeriaNamn} 🍕`;
            underrubrik.innerText = `Visar ${allaRatter.length} rätter från ${pizzeriaNamn}.`;

            // --- Category tabs ---
            const PIZZERIA_TAB_DEF = [
                { id: 'alla',        label: 'Alla',            emoji: '🍽️' },
                { id: 'amerikanska', label: 'Amerikanska',     emoji: '<img src="/images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">' },
                { id: 'burgare',     label: 'Burgare',         emoji: '🍔' },
                { id: 'flaskfile',   label: 'Fläskfilé',       emoji: '🍖' },
                { id: 'inbakade',    label: 'Inbakade',        emoji: '🫓' },
                { id: 'kebab',       label: 'Kebab, Rullar & Tallrikar', emoji: '🥙' },
                { id: 'kottfars',    label: 'Köttfärs',        emoji: '🍕' },
                { id: 'kyckling',    label: 'Kyckling',        emoji: '🍗' },
                { id: 'oxfile',      label: 'Oxfilé',          emoji: '🥩' },
                { id: 'salami',      label: 'Salami',          emoji: '🍕' },
                { id: 'skaldjur',    label: 'Skaldjur',        emoji: '🦐' },
                { id: 'vegetarisk',  label: 'Vegetarisk',      emoji: '🥬' },
                { id: 'lasagne',     label: 'Lasagne',         emoji: '🫕' },
                { id: 'pasta',       label: 'Pasta',           emoji: '🍝' },
                { id: 'sallader',    label: 'Sallader',        emoji: '🥗' },
            ];

            const tabContainer = document.getElementById('pizzeria-kategori-tabs');
            let aktivaPizzeriaTabs = new Set();
            const FOKUS_INITIAL = 4;
            const FOKUS_STEP = 8;

            const SEKTION_DEF = [
                { id: 'pizzor',      titel: 'Populära pizzor', emoji: '🍕' },
                { id: 'amerikanska', titel: 'Amerikanska',     emoji: '<img src="/images/icons8-usa-flag-50.png" alt="Amerikansk" style="width:1.3em;height:1.3em;border-radius:50%;object-fit:cover;vertical-align:middle;">' },
                { id: 'burgare',     titel: 'Burgare',         emoji: '🍔' },
                { id: 'flaskfile',   titel: 'Fläskfilé',       emoji: '🍖' },
                { id: 'inbakade',    titel: 'Inbakade',        emoji: '🫓' },
                { id: 'kebab',       titel: 'Kebab, Rullar & Tallrikar', emoji: '🥙' },
                { id: 'kottfars',    titel: 'Köttfärs',        emoji: '🍕' },
                { id: 'kyckling',    titel: 'Kyckling',        emoji: '🍗' },
                { id: 'oxfile',      titel: 'Oxfilé',          emoji: '🥩' },
                { id: 'salami',      titel: 'Salami',          emoji: '🍕' },
                { id: 'skaldjur',    titel: 'Skaldjur',        emoji: '🦐' },
                { id: 'vegetarisk',  titel: 'Vegetarisk',      emoji: '🥬' },
                { id: 'lasagne',     titel: 'Lasagne',         emoji: '🫕' },
                { id: 'pasta',       titel: 'Pasta',           emoji: '🍝' },
                { id: 'sallader',    titel: 'Sallader',        emoji: '🥗' },
            ];

            const EXTRA_SEKTION_DEF = [
                { id: 'dryck',     titel: 'Dryck',     emoji: '🥤' },
                { id: 'snacks',    titel: 'Snacks',    emoji: '🍟' },
                { id: 'saser',     titel: 'Såser',     emoji: '🧄' },
                { id: 'tillbehor', titel: 'Tillbehör', emoji: '🍽️' },
                { id: 'dessert',   titel: 'Dessert',   emoji: '🍰' },
            ];

            function uppdateraAktivTabVisning() {
                if (!tabContainer) return;
                const ingenAktiv = aktivaPizzeriaTabs.size === 0;
                tabContainer.querySelectorAll('.pizzeria-kategori-tab').forEach((t) => {
                    const aktiv = t.dataset.tabId === 'alla' ? ingenAktiv : aktivaPizzeriaTabs.has(t.dataset.tabId);
                    t.classList.toggle('pizzeria-kategori-tab--active', aktiv);
                    t.setAttribute('aria-selected', String(aktiv));
                });
            }

            if (tabContainer) {
                const tabsMedData = PIZZERIA_TAB_DEF.map((tab) => ({
                    ...tab,
                    antal: tab.id === 'alla' ? huvudRatter.length : huvudRatter.filter((p) => kategoriseraPizzeriaItem(p) === tab.id).length
                })).filter((tab) => tab.id === 'alla' || tab.antal > 0);

                tabContainer.classList.add('pizzeria-kategori-tabs--carousel');
                tabContainer.innerHTML = `
                    <button class="pizzeria-kategori-nav pizzeria-kategori-nav--left" type="button" aria-label="Skrolla kategorier åt vänster">◀</button>
                    <div class="pizzeria-kategori-scroll" id="pizzeria-kategori-scroll"></div>
                    <button class="pizzeria-kategori-nav pizzeria-kategori-nav--right" type="button" aria-label="Skrolla kategorier åt höger">▶</button>
                `;
                const tabScroll = tabContainer.querySelector('#pizzeria-kategori-scroll');
                if (tabScroll) {
                    tabScroll.innerHTML = tabsMedData.map((tab) => `
                    <button class="pizzeria-kategori-tab${tab.id === 'alla' ? ' pizzeria-kategori-tab--active' : ''}"
                            data-tab-id="${escapaHtml(tab.id)}"
                            role="tab"
                            aria-selected="${tab.id === 'alla'}">
                        ${tab.emoji} ${escapaHtml(tab.label)} <span class="tab-antal">(${tab.antal})</span>
                    </button>
                `).join('');
                }

                const navLeft = tabContainer.querySelector('.pizzeria-kategori-nav--left');
                const navRight = tabContainer.querySelector('.pizzeria-kategori-nav--right');

                function uppdateraKategoriNav() {
                    if (!tabScroll || !navLeft || !navRight) return;
                    const maxScroll = Math.max(0, tabScroll.scrollWidth - tabScroll.clientWidth);
                    const canLeft = tabScroll.scrollLeft > 4;
                    const canRight = tabScroll.scrollLeft < maxScroll - 4;
                    navLeft.disabled = !canLeft;
                    navRight.disabled = !canRight;
                }

                function scrollaAktivTabTillSikt() {
                    if (!tabScroll) return;
                    const aktiv = tabScroll.querySelector('.pizzeria-kategori-tab--active');
                    if (aktiv && typeof aktiv.scrollIntoView === 'function') {
                        aktiv.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                }

                if (tabScroll) {
                    tabScroll.addEventListener('scroll', uppdateraKategoriNav);
                }
                if (navLeft && tabScroll) {
                    navLeft.addEventListener('click', () => {
                        tabScroll.scrollBy({ left: -280, behavior: 'smooth' });
                    });
                }
                if (navRight && tabScroll) {
                    navRight.addEventListener('click', () => {
                        tabScroll.scrollBy({ left: 280, behavior: 'smooth' });
                    });
                }
                uppdateraKategoriNav();

                tabContainer.querySelectorAll('.pizzeria-kategori-tab').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const tabId = btn.dataset.tabId;
                        if (tabId === 'alla') {
                            aktivaPizzeriaTabs.clear();
                        } else if (aktivaPizzeriaTabs.has(tabId)) {
                            aktivaPizzeriaTabs.delete(tabId);
                        } else {
                            aktivaPizzeriaTabs.add(tabId);
                        }
                        uppdateraAktivTabVisning();
                        scrollaAktivTabTillSikt();
                        sokruta.value = '';
                        pizzorSomVisasPizzeria = aktivaPizzeriaTabs.size === 0 ? 100 : FOKUS_INITIAL;
                        uppdateraPizzeriaVisning();
                    });
                });
            }

            let filtreradLista = huvudRatter;
            let pizzorSomVisasPizzeria = 100;

            function skapaPizzeriaItemRad(pizza) {
                const rad = document.createElement('div');
                const kat = kategoriseraPizzeriaItem(pizza);
                const arKompakt = PIZZERIA_EXTRA_KOMPAKTA.has(kat);
                rad.className = `pizzeria-item-rad${arKompakt ? ' pizzeria-item-rad--compact' : ''}`;
                const pizzaNamn = escapaHtml(formatteraPizzaNamnForVisning(pizza.pizza_namn));
                const pris = pizza.pris != null ? `${pizza.pris} kr` : '–';
                const ingredienser = Array.isArray(pizza.ingredienser) && pizza.ingredienser.length
                    ? pizza.ingredienser.map((ing) => escapaHtml(ing)).join(', ')
                    : '';
                const kortBeskrivning = escapaHtml(String(pizza.beskrivning || '').trim());
                const emoji = PIZZERIA_KAT_EMOJI[kat] || '🍕';
                const sekundarText = arKompakt
                    ? ((kat === 'dryck' || kat === 'dessert') ? '' : (kortBeskrivning || ingredienser))
                    : ingredienser;
                rad.innerHTML = `
                    <div class="pizzeria-item-bild pizzeria-item-bild--${kat}" aria-hidden="true">${emoji}</div>
                    <div class="pizzeria-item-info">
                        <span class="pizzeria-item-namn">${pizzaNamn}</span>
                        ${sekundarText ? `<span class="pizzeria-item-ingredienser">${sekundarText}</span>` : ''}
                    </div>
                    <span class="pizzeria-item-pris">${escapaHtml(String(pris))}</span>
                `;
                return rad;
            }

            function visaPizzeriaGrid(allaPizzeriasPizzor) {
                lista.innerHTML = '';
                laddaFlerSektion.style.display = 'none';
                const sektioner = SEKTION_DEF.map((s) => ({
                    ...s,
                    pizzor: allaPizzeriasPizzor.filter((p) => kategoriseraPizzeriaItem(p) === s.id)
                })).filter((s) => s.pizzor.length > 0);

                if (!sektioner.length) {
                    lista.innerHTML = '<div class="ingen-traff"><h3>Mamma Mia! 🍕</h3><p>Inga pizzor hittades.</p></div>';
                    return;
                }

                const gridWrapper = document.createElement('div');
                gridWrapper.className = 'pizzeria-sektion-grid';

                sektioner.forEach(({ id, titel, emoji, pizzor: pizzorInSektion }) => {
                    const sektionEl = document.createElement('div');
                    const arKompaktSektion = PIZZERIA_EXTRA_KOMPAKTA.has(id);
                    sektionEl.className = `pizzeria-sektion pizzeria-sektion--${id}${arKompaktSektion ? ' pizzeria-sektion--compact' : ''}`;

                    const headerEl = document.createElement('div');
                    headerEl.className = 'pizzeria-sektion-header';
                    headerEl.innerHTML = `
                        <span class="pizzeria-sektion-titel">${emoji} ${escapaHtml(titel)}</span>
                        <span class="pizzeria-sektion-antal">${pizzorInSektion.length} st${pizzorInSektion.length > 4 ? ' • scrolla' : ''}</span>
                    `;
                    sektionEl.appendChild(headerEl);

                    const itemsEl = document.createElement('div');
                    itemsEl.className = 'pizzeria-sektion-items';
                    pizzorInSektion.forEach((pizza) => itemsEl.appendChild(skapaPizzeriaItemRad(pizza)));
                    sektionEl.appendChild(itemsEl);

                    gridWrapper.appendChild(sektionEl);
                });

                lista.appendChild(gridWrapper);
            }

            function visaExtraSektion(extraAttVisa) {
                const grupper = EXTRA_SEKTION_DEF.map((s) => ({
                    ...s,
                    ratter: extraAttVisa.filter((p) => kategoriseraPizzeriaItem(p) === s.id)
                })).filter((s) => s.ratter.length > 0);

                if (!grupper.length) return;

                const wrap = document.createElement('section');
                wrap.className = 'pizzeria-extra-wrap';
                wrap.innerHTML = `
                    <div class="pizzeria-extra-head">
                        <h3 class="pizzeria-extra-title">🍟 Tillbehör & Dryck</h3>
                    </div>
                `;

                const grid = document.createElement('div');
                grid.className = 'pizzeria-extra-grid';

                grupper.forEach((grupp) => {
                    const card = document.createElement('div');
                    card.className = `pizzeria-extra-card pizzeria-sektion--${grupp.id}`;

                    const header = document.createElement('div');
                    header.className = 'pizzeria-extra-card-head';
                    header.innerHTML = `
                        <span class="pizzeria-extra-card-title">${grupp.emoji} ${escapaHtml(grupp.titel)}</span>
                    `;
                    card.appendChild(header);

                    const items = document.createElement('div');
                    items.className = 'pizzeria-extra-items';
                    grupp.ratter.forEach((pizza) => items.appendChild(skapaPizzeriaItemRad(pizza)));
                    card.appendChild(items);

                    grid.appendChild(card);
                });

                wrap.appendChild(grid);
                lista.appendChild(wrap);
            }

            function visaPizzorPizzeria(pizzorAttVisa) {
                lista.innerHTML = '';
                if (pizzorAttVisa.length === 0) {
                    lista.innerHTML = '<div class="ingen-traff"><h3>Mamma Mia! 🍕</h3><p>Prova andra sökord.</p></div>';
                    laddaFlerSektion.style.display = 'none';
                    return;
                }

                const ingenTabAktiv2 = aktivaPizzeriaTabs.size === 0;
                const urval = pizzorAttVisa;
                const wrapper = document.createElement('div');
                wrapper.className = `pizzeria-lista-full${!ingenTabAktiv2 ? ' pizzeria-lista-full--fokus' : ''}`;
                urval.forEach((pizza) => wrapper.appendChild(skapaPizzeriaItemRad(pizza)));
                lista.appendChild(wrapper);
                laddaFlerSektion.style.display = 'none';
            }

            function uppdateraPizzeriaVisning() {
                const sokStrang = sokruta.value.toLowerCase().trim();
                const harSok = sokStrang.length > 0;
                const soktaOrd = sokStrang.split(',').map((ord) => ord.trim()).filter((ord) => ord !== '');

                let resultatHuvud = harSok
                    ? huvudRatter.filter((pizza) => {
                        const pizzaText = byggPizzaSokText(pizza);
                        return soktaOrd.every((sokt) => hittarOrdet(pizzaText, sokt));
                    })
                    : huvudRatter;

                if (aktivaPizzeriaTabs.size > 0) {
                    resultatHuvud = resultatHuvud.filter((p) => aktivaPizzeriaTabs.has(kategoriseraPizzeriaItem(p)));
                }

                filtreradLista = resultatHuvud;
                const ingenTabAktiv = aktivaPizzeriaTabs.size === 0;
                const totalTraffar = ingenTabAktiv
                    ? (resultatHuvud.length + extraRatter.length)
                    : resultatHuvud.length;
                antalTraffar.innerText = totalTraffar > 0
                    ? `Hittade ${totalTraffar} ${aktivaPizzeriaTabs.has('sallader') ? 'sallader' : 'rätter'}`
                    : 'Inga rätter matchar din sökning';

                if (ingenTabAktiv && !harSok) {
                    visaPizzeriaGrid(huvudRatter);
                } else {
                    visaPizzorPizzeria(filtreradLista);
                }

                // Extras are always rendered as a permanent secondary section.
                visaExtraSektion(extraRatter);
            }

            sokruta.addEventListener('input', () => {
                pizzorSomVisasPizzeria = 100;
                uppdateraPizzeriaVisning();
            });

            const laddaFlerBtn = document.getElementById('ladda-fler-btn');
            if (laddaFlerBtn) {
                laddaFlerBtn.onclick = () => {
                    pizzorSomVisasPizzeria += FOKUS_STEP;
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

    if (kategori === 'Pizzor (alla)') {
        aktivaKategorier.clear();
    } else {
        if (aktivaKategorier.has(kategori)) {
            aktivaKategorier.delete(kategori);
        } else {
            aktivaKategorier.add(kategori);
        }
    }

    const arAllaAktiv = aktivaKategorier.size === 0;
    document.querySelectorAll('.kategori-chip').forEach((c) => {
        const chipKategori = c.dataset.kategori || 'Pizzor (alla)';
        const arAktiv = chipKategori === 'Pizzor (alla)'
            ? arAllaAktiv
            : aktivaKategorier.has(chipKategori);
        c.classList.toggle('kategori-chip--active', arAktiv);
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
    const harKategoriFilter = aktivaKategorier.size > 0;
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

    // Kategori-strip filter (state-driven, multi-select)
    resultat = filtreraEfterKategori(resultat, aktivaKategorier);

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
        const pizzaNamnSafe = escapaHtml(formatteraPizzaNamnForVisning(pizza.pizza_namn));
        const ingrediensText = Array.isArray(pizza.ingredienser) && pizza.ingredienser.length > 0
            ? pizza.ingredienser.join(', ')
            : 'Ingredienser saknas';
        const ingrediensTextSafe = escapaHtml(ingrediensText);
        const pizzeriaDomannamn = (() => {
            const url = saneraExternUrl(pizza.hemsida || '');
            if (!url) return '';
            try {
                return new URL(url).hostname.replace(/^www\./i, '');
            } catch {
                return '';
            }
        })();
        const pizzeriaNamnSafe = escapaHtml(pizzeriaDomannamn || pizza.pizzeria || 'Okand pizzeria');
        const avstandsDisplay = isNearbyActive && Number.isFinite(pizza.distansKm)
            ? `<p class="avstand-badge">${pizza.distansKm < 1 ? Math.round(pizza.distansKm * 1000) + ' m' : pizza.distansKm.toFixed(1).replace('.', ',') + ' km'} fran dig</p>`
            : '';
        const arBilligast = minPris !== null && Number(pizza.pris) === minPris;
        const billigastBadge = arBilligast
            ? '<span class="pizza-badge pizza-badge--billigast">🟢 Billigast</span>'
            : '';
        const prisBadgeKlass = arBilligast ? 'pris-badge pris-badge--billig' : 'pris-badge';
        const pizzeriaLank = hamtaNavigeringsLankForPizzeria(
            pizza.pizzeria ? skapaDynamiskPizzeriaLank(pizza.pizzeria) : DYNAMISK_PIZZERIA_BASSIDA
        );
        kort.dataset.href = pizzeriaLank;
        kort.setAttribute('tabindex', '0');
        kort.setAttribute('role', 'link');
        kort.setAttribute('aria-label', `Visa meny hos ${pizza.pizzeria || 'pizzerian'}`);
        const pizzeriaLankSafe = escapaHtml(pizzeriaLank);
        const pizzeriaNamnForAria = escapaHtml(pizza.pizzeria || 'pizzerian');
        const telefonSanerad = saneraTelefonnummer(pizza.telefon || '');
        const harTelefonnummer = /\d{5,}/.test(telefonSanerad);
        const kontaktHrefSafe = escapaHtml(harTelefonnummer ? `tel:${telefonSanerad}` : pizzeriaLank);
        const kontaktAria = harTelefonnummer
            ? `Ring ${pizzeriaNamnForAria}`
            : `Visa menyn hos ${pizzeriaNamnForAria}`;
        const aktivKategoriForEmoji = (() => {
            const valdaKategorier = hamtaAktivaKategoriNamn();
            return valdaKategorier.length === 1 ? valdaKategorier[0] : 'Pizzor (alla)';
        })();
        const pizzaKategoriEmoji = hamtaPizzaKortEmoji(pizza, aktivKategoriForEmoji, document.getElementById('sokruta')?.value || '');

        kort.innerHTML = `
            ${billigastBadge}
            <div class="pizza-rad">
                <div class="pizza-body">
                    <div class="pizza-top-row">
                        <h3>${pizzaNamnSafe}</h3>
                        <span class="${prisBadgeKlass}">${pizza.pris} kr</span>
                    </div>
                    <p class="pizza-beskrivning">${ingrediensTextSafe}</p>
                    <div class="pizza-bottom-row">
                        <div class="pizza-pizzeria-row">
                            <a class="pizza-store-icon" href="${pizzeriaLankSafe}" aria-label="Visa meny hos ${pizzeriaNamnForAria}">${pizzaKategoriEmoji}</a>
                            <p class="pizza-pizzeria"><a class="pizza-pizzeria-link" href="${pizzeriaLankSafe}">${pizzeriaNamnSafe}</a></p>
                            <span class="pizza-verified-dot" aria-hidden="true"></span>
                        </div>
                        <a class="pizza-telefon-link" href="${kontaktHrefSafe}" aria-label="${kontaktAria}">
                            <span class="pizza-telefon-ikon" aria-hidden="true">☎</span>
                        </a>
                    </div>
                    ${avstandsDisplay}
                </div>
            </div>
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
    gtmInitNavbarTracking(); // GTM tracking
    gtmInitPizzaKortTracking(); // GTM tracking
    initPizzaKortNavigering();
    window.addEventListener('scroll', gtmTrackScrollDjup); // GTM tracking
    gtmTrackScrollDjup(); // GTM tracking

    // PWA: register service worker after page load to not compete with resources.
    registrerServiceWorker();
});

function registrerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

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
