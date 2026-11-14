// footer.js - shared behavior for the site footer / developer credit.
// Currently just fills in the copyright year; kept as its own file so
// footer markup, styling, and behavior all live together.

(function(){
  function init(){
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
