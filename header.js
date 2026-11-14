// header.js - shared behavior for the site header / admin sidebar.
// Owns the language toggle buttons (present on the public masthead,
// the admin login screen, and the admin sidebar) and broadcasts a
// "langchange" event on document so each page's own script can
// re-render whatever content depends on the active language.

(function(){

  function syncActiveState(){
    var lang = I18N.getLang();
    document.querySelectorAll('.lang-toggle button').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function init(){
    document.querySelectorAll('.lang-toggle button').forEach(function(btn){
      btn.addEventListener('click', function(){
        var lang = btn.getAttribute('data-lang');
        if (lang === I18N.getLang()) return;
        I18N.setLang(lang);
        I18N.apply();
        syncActiveState();
        document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
      });
    });
    syncActiveState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed in case a page needs to force a re-sync (e.g. after
  // dynamically re-rendering the sidebar).
  window.Header = { syncActiveState: syncActiveState };

})();
