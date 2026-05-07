(function () {
  function isApp() {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
      return window.Capacitor.isNativePlatform();
    }
    var ua = (navigator.userAgent || '').toLowerCase();
    return (ua.indexOf('wv') !== -1 && ua.indexOf('android') !== -1) ||
           (ua.indexOf('iphone') !== -1 && ua.indexOf('safari') === -1);
  }

  if (!isApp()) return;

  // Mark app mode on root element
  document.documentElement.classList.add('is-app');

  // Hide old top navbar and social bottom-nav
  var oldNavbar = document.querySelector('.navbar');
  if (oldNavbar) oldNavbar.style.display = 'none';
  var oldBottomNav = document.querySelector('nav.bottom-nav');
  if (oldBottomNav) oldBottomNav.style.display = 'none';

  // Don't inject if nav already exists (karta.html has it in HTML)
  if (document.getElementById('karta-bottom-nav')) return;

  // Determine active path
  var path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '') path = '/';

  function isAktiv(href) {
    var hrefPath = href.replace(/\/+$/, '') || '/';
    if (hrefPath === '/') return path === '/' || path === '';
    return path === hrefPath || path.indexOf(hrefPath + '/') === 0;
  }

  function navItem(href, label, iconSvg, extra) {
    var aktiv = isAktiv(href);
    var cls = 'karta-bnav-item' + (extra ? ' ' + extra : '') + (aktiv ? ' karta-bnav-item--aktiv' : '');
    var current = aktiv ? ' aria-current="page"' : '';
    return '<a href="' + href + '" class="' + cls + '" aria-label="' + label + '"' + current + '>' + iconSvg + '<span>' + label + '</span></a>';
  }

  var ikonHus = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>';
  var ikonLista = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
  var ikonPin = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 14-8 14S4 15.25 4 10a8 8 0 0 1 8-8z"/></svg>';
  var ikonStatistik = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="20" x2="6" y2="11"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>';
  var ikonPerson = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  var aktiv = isAktiv('/karta');
  var kartaItemCls = 'karta-bnav-item karta-bnav-item--karta' + (aktiv ? ' karta-bnav-item--aktiv' : '');
  var kartaCurrent = aktiv ? ' aria-current="page"' : '';
  var kartaItem = '<a href="/karta" class="' + kartaItemCls + '" aria-label="Karta"' + kartaCurrent + '>'
    + '<span class="karta-bnav-karta-cirkel">' + ikonPin + '</span>'
    + '<span>Karta</span></a>';

  var nav = document.createElement('nav');
  nav.id = 'karta-bottom-nav';
  nav.setAttribute('aria-label', 'Appnavigation');
  nav.innerHTML =
    navItem('/', 'Pizzor', ikonHus) +
    navItem('/pizzerior', 'Pizzerior', ikonLista) +
    kartaItem +
    navItem('/statistik', 'Statistik', ikonStatistik) +
    navItem('/om-oss', 'Om oss', ikonPerson);

  document.body.appendChild(nav);

  // Add bottom padding to body so content isn't hidden behind nav
  document.body.style.paddingBottom = 'calc(72px + env(safe-area-inset-bottom))';
})();
