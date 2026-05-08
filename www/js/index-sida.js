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
            _pizzeriaInfoMap = null; // reset so hamtaOppettimerForPizzeria/hamtaTelefonForPizzeria rebuild
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

// ============================================================
//  APP BOOTSTRAP - index-sida
// ============================================================
window.addEventListener("load", function() {
    initIndexSida();
    initPrisSlider();
});
