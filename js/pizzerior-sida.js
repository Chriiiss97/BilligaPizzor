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

// ============================================================
//  APP BOOTSTRAP - pizzerior-sida
// ============================================================
window.addEventListener("load", function() {
    initPizzeriorSida();
});
