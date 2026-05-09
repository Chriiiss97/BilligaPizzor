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
const PIZZERIA_ICKE_PIZZA_KAT = new Set([
    'dryck',
    'snacks',
    'saser',
    'tillbehor',
    'dessert',
    'sallader',
    'pasta',
    'lasagne',
    'burgare',
]);

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
        hamtaPizzorListaFranSupabase(),
        hamtaExtrasListaFranSupabase(),
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
            hamtaPizzeriorCoordsLista()
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

                    const pizzaRatter = allaRatter.filter((p) => !PIZZERIA_ICKE_PIZZA_KAT.has(kategoriseraPizzeriaItem(p)));

                    // Rad 3: Exempel på pizzor (upp till 5)
                    const exempelRatter = [];
                    const sedda = new Set();
                    for (const p of pizzaRatter) {
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

                    // Rad 4: Prisinfo (endast pizzor)
                    const priser = pizzaRatter.map((p) => p.pris).filter((pr) => pr > 0);
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
                })
                .catch((error) => {
                    console.error('[Pizzeriasida] Kunde inte ladda koordinater:', error);
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



// ============================================================
//  APP BOOTSTRAP - pizzeria-sida
// ============================================================
window.addEventListener("load", function() {
    initPizzeriaSida();
});
