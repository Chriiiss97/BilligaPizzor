/**
 * app-native.js
 * Körs på alla sidor. Detekterar om appen körs i Capacitor (Android/iOS)
 * och aktiverar i så fall den native app-layouten med bottom tab bar.
 * Påverkar INTE webbversionen – window.Capacitor finns bara i appen.
 */
(function () {
  'use strict';

  /** Returnerar true om vi kör i Capacitor-appen (inte webbläsaren) */
  function erNativeApp() {
    return !!(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform()
    );
  }

  /**
   * Bestäm vilken tab som är aktiv baserat på URL-sökvägen.
   * Returnerar ett av: 'pizzor' | 'pizzerior' | 'karta' | 'statistik' | 'om-oss'
   */
  function aktivTab() {
    var path = window.location.pathname;
    if (path.startsWith('/karta')) return 'karta';
    if (path.startsWith('/pizzerior')) return 'pizzerior';
    if (path.startsWith('/statistik')) return 'statistik';
    if (path.startsWith('/om-oss')) return 'om-oss';
    return 'pizzor'; // index.html / startsida
  }

  /** Skapar och injicerar bottom tab bar-elementet */
  function skapaTabBar() {
    var aktiv = aktivTab();

    var tabs = [
      {
        id: 'pizzor',
        href: '/index.html',
        label: 'PIZZOR',
        // Pizza-skiva ikon
        svg: '<svg viewBox="0 0 24 24"><path d="M12 2C9.9 6.8 5.6 10.3 1 11l11 11 11-11C18.4 10.3 14.1 6.8 12 2z"/><circle cx="12" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/></svg>'
      },
      {
        id: 'pizzerior',
        href: '/pizzerior.html',
        label: 'PIZZERIOR',
        // Hus / restaurang ikon
        svg: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>'
      },
      {
        id: 'karta',
        href: '/karta.html',
        label: 'KARTA',
        center: true,
        // Navigera-mig ikon (kompass/pile inåt)
        svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" fill="none"/><path d="M12 8l4 4m-4-4l-4 4" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      },
      {
        id: 'statistik',
        href: '/statistik.html',
        label: 'STATISTIK',
        // Stapeldiagram ikon
        svg: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
      },
      {
        id: 'om-oss',
        href: '/om-oss.html',
        label: 'OM OSS',
        // Person ikon
        svg: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      }
    ];

    var bar = document.createElement('nav');
    bar.id = 'app-tab-bar';
    bar.setAttribute('aria-label', 'App-navigation');

    tabs.forEach(function (tab) {
      var a = document.createElement('a');
      a.href = tab.href;

      var klasser = ['app-tab-item'];
      if (tab.center) klasser.push('app-tab-center');
      if (tab.id === aktiv) klasser.push('active');
      a.className = klasser.join(' ');

      a.setAttribute('aria-label', tab.label);
      a.setAttribute('aria-current', tab.id === aktiv ? 'page' : 'false');

      a.innerHTML = tab.svg + '<span class="app-tab-label">' + tab.label + '</span>';
      bar.appendChild(a);
    });

    document.body.appendChild(bar);
  }

  /** Skapar flytande sök-knapp + position-knapp på kartsidan */
  function skapaKartaKontroller() {
    // Bara på kartsidan
    var originalKontroller = document.getElementById('karta-kontroller');
    if (!originalKontroller) return;

    // Hämta original sök-input och resultat-lista
    var originalInput = document.getElementById('karta-sok');
    var originalResultat = document.getElementById('karta-sok-resultat');
    var originalNarmast = document.getElementById('karta-narmast-knapp');

    // --- Sök-knapp (förstoringsglas) ---
    var sokKnapp = document.createElement('button');
    sokKnapp.id = 'app-sok-knapp';
    sokKnapp.type = 'button';
    sokKnapp.setAttribute('aria-label', 'Sök pizzeria');
    sokKnapp.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>';
    document.body.appendChild(sokKnapp);

    // --- Expanderat sökfält ---
    var sokFalt = document.createElement('div');
    sokFalt.id = 'app-sok-falt';
    var sokInput = document.createElement('input');
    sokInput.type = 'text';
    sokInput.placeholder = 'Sök pizzeria, område eller stad…';
    sokInput.autocomplete = 'off';
    var stangKnapp = document.createElement('button');
    stangKnapp.id = 'app-sok-stang';
    stangKnapp.type = 'button';
    stangKnapp.textContent = '×';
    sokFalt.appendChild(sokInput);
    sokFalt.appendChild(stangKnapp);
    document.body.appendChild(sokFalt);

    // --- Sökresultat ---
    var sokResultat = document.createElement('ul');
    sokResultat.id = 'app-sok-resultat';
    document.body.appendChild(sokResultat);

    // Öppna sök
    sokKnapp.addEventListener('click', function () {
      sokFalt.classList.add('aktiv');
      sokInput.focus();
    });

    // Stäng sök
    function stangSok() {
      sokFalt.classList.remove('aktiv');
      sokResultat.classList.remove('aktiv');
      sokInput.value = '';
      if (originalInput) { originalInput.value = ''; originalInput.dispatchEvent(new Event('input')); }
    }
    stangKnapp.addEventListener('click', stangSok);

    // Vidarebefordra tangentbordshändelser till original-input så sök-logiken fungerar
    sokInput.addEventListener('input', function () {
      if (originalInput) {
        // Kopiera värdet och trigga original-logiken
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(originalInput, sokInput.value);
        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // Spegla resultat från original-listan till app-listan
    if (originalResultat) {
      var observer = new MutationObserver(function () {
        sokResultat.innerHTML = originalResultat.innerHTML;
        if (originalResultat.style.display !== 'none' && originalResultat.children.length > 0) {
          sokResultat.classList.add('aktiv');
        } else {
          sokResultat.classList.remove('aktiv');
        }
      });
      observer.observe(originalResultat, { childList: true, attributes: true, attributeFilter: ['style'] });

      // Klick i app-resultat → trigga klick i original
      sokResultat.addEventListener('click', function (e) {
        var li = e.target.closest('li');
        if (!li) return;
        var idx = Array.from(sokResultat.children).indexOf(li);
        var originalLi = originalResultat.children[idx];
        if (originalLi) originalLi.click();
        stangSok();
      });
    }

    // --- Min position-knapp ---
    // Knappen är nu integrerad i tab bar center istället
    // (döljs via CSS)
  }

  /** Aktiverar native-läge: lägger till CSS-klass + tab bar */
  function aktiveraNativeLage() {
    document.body.classList.add('app-native');

    // Flytta filter-knappen ur topbaren (annars döljs den med sin förälder)
    var filterKnapp = document.getElementById('karta-filter-knapp');
    if (filterKnapp) {
      document.body.appendChild(filterKnapp);
    }

    skapaTabBar();

    // Visa "?" info-knapp + modal bara på startsidan (index / pizzor)
    if (aktivTab() === 'pizzor') {
      skapaInfoKnapp();
    }
  }

  /** Skapar "?" flytande knapp och modal med hero-innehållet */
  function skapaInfoKnapp() {
    // Hämta hero-innehållet
    var heroSek = document.querySelector('.hero-sektion');
    var heroRubrik = heroSek ? (heroSek.querySelector('h1') || {}).textContent || '' : '';
    var heroBrodtext = heroSek ? (heroSek.querySelector('.hero-intro') || {}).textContent || '' : '';
    var disclaimerText = heroSek ? (heroSek.querySelector('.disclaimer') || {}).textContent || '' : '';
    var logoSrc = 'images/Billiga_Pizzor_banner.png';

    // Skapa modal
    var modal = document.createElement('div');
    modal.id = 'app-info-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Om Billiga Pizzor');
    modal.innerHTML =
      '<div id="app-info-modal-box">' +
        '<img src="' + logoSrc + '" alt="Billiga Pizzor logotyp">' +
        (heroRubrik ? '<h2>' + heroRubrik + '</h2>' : '') +
        (heroBrodtext ? '<p>' + heroBrodtext + '</p>' : '') +
        (disclaimerText ? '<p><em>' + disclaimerText + '</em></p>' : '') +
        '<button id="app-info-modal-stang" type="button">Stäng</button>' +
      '</div>';
    document.body.appendChild(modal);

    // Stäng modal
    function stangModal() {
      modal.classList.remove('synlig');
    }
    modal.querySelector('#app-info-modal-stang').addEventListener('click', stangModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) stangModal();
    });

    // Skapa "?" knapp
    var knapp = document.createElement('button');
    knapp.id = 'app-info-knapp';
    knapp.type = 'button';
    knapp.setAttribute('aria-label', 'Om den här sidan');
    knapp.textContent = '?';
    knapp.addEventListener('click', function() {
      modal.classList.add('synlig');
    });
    document.body.appendChild(knapp);
  }

  /** Starta — kör på DOMContentLoaded för säker DOM-åtkomst */
  function start() {
    if (!erNativeApp()) return;
    aktiveraNativeLage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
