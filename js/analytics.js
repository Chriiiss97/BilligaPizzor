// analytics.js — fire-and-forget event logging till Supabase
// Använder anon key + RPC log_analytics_event (security definer)

(function () {
  var SUPABASE_URL = 'https://oyyynxdkospqgvehyzxl.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eXlueGRrb3NwcWd2ZWh5enhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDI0MDcsImV4cCI6MjA5MjI3ODQwN30.SjWbJDqsq8IzuhoQMjktJEuE8_9ujhB7QXk40Rqus8o';

  // Logga inte i lokal utveckling
  function arLokal() {
    var h = window.location.hostname;
    return window.location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1';
  }

  // Generera enkel slumpmässig ID
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Beständigt visitor_id (localStorage)
  function hamtaVisitorId() {
    try {
      var id = localStorage.getItem('bp_vid');
      if (!id) { id = genId(); localStorage.setItem('bp_vid', id); }
      return id;
    } catch (e) { return genId(); }
  }

  // Session-id (sessionStorage — nollställs när flik stängs)
  function hamtaSessionId() {
    try {
      var id = sessionStorage.getItem('bp_sid');
      if (!id) { id = genId(); sessionStorage.setItem('bp_sid', id); }
      return id;
    } catch (e) { return genId(); }
  }

  // Avgör client_type
  function hamtaClientType() {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        return 'app';
      }
    } catch (e) {}
    return 'web';
  }

  // Avgör platform
  function hamtaPlatform() {
    try {
      if (window.Capacitor && window.Capacitor.getPlatform) {
        return window.Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
      }
    } catch (e) {}
    return navigator.userAgent.indexOf('Mobile') !== -1 ? 'mobile-web' : 'desktop-web';
  }

  // Skicka event till Supabase (fire-and-forget)
  window.logEvent = function (eventName, extra) {
    if (arLokal()) return;
    extra = extra || {};

    var payload = {
      p_event_name: eventName,
      p_page_path: extra.page_path || window.location.pathname,
      p_page_title: extra.page_title || document.title || null,
      p_client_type: hamtaClientType(),
      p_platform: hamtaPlatform(),
      p_session_id: hamtaSessionId(),
      p_visitor_id: hamtaVisitorId(),
      p_entity_type: extra.entity_type || null,
      p_entity_slug: extra.entity_slug || null,
      p_search_term: extra.search_term || null,
      p_app_version: extra.app_version || null,
      p_metadata: extra.metadata || {}
    };

    // Ta bort null-värden för att hålla payloaden ren
    Object.keys(payload).forEach(function (k) {
      if (payload[k] === null) delete payload[k];
    });

    fetch(SUPABASE_URL + '/rest/v1/rpc/log_analytics_event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {}); // ignorera nätverksfel
  };

  // Auto-logga page_view när sidan laddas
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.logEvent('page_view');
    });
  } else {
    window.logEvent('page_view');
  }
})();
