// ui.js - lightweight in-page popup system.
// Replaces window.alert / window.confirm / window.prompt with
// non-blocking, styled overlays so nothing looks like a browser dialog.

var UI = (function(){

  function ensureRoot(){
    var root = document.getElementById('ui-root');
    if (!root){
      root = document.createElement('div');
      root.id = 'ui-root';
      document.body.appendChild(root);
    }
    return root;
  }

  // ---------- Toast (replaces alert) ----------
  function toast(message, type){
    var root = ensureRoot();
    var box = document.createElement('div');
    box.className = 'ui-toast' + (type === 'error' ? ' ui-toast-error' : '');
    box.textContent = message;
    root.appendChild(box);
    requestAnimationFrame(function(){ box.classList.add('show'); });
    setTimeout(function(){
      box.classList.remove('show');
      setTimeout(function(){ box.remove(); }, 250);
    }, 3200);
  }

  // ---------- Confirm modal (replaces confirm) ----------
  function confirmModal(message, opts){
    opts = opts || {};
    return new Promise(function(resolve){
      var root = ensureRoot();
      var overlay = document.createElement('div');
      overlay.className = 'ui-overlay';
      overlay.innerHTML =
        '<div class="ui-modal">' +
          '<div class="ui-modal-msg">' + message + '</div>' +
          '<div class="ui-modal-actions">' +
            '<button class="btn btn-ghost" data-act="cancel">' + (opts.cancelLabel || 'Cancel') + '</button>' +
            '<button class="btn btn-primary" data-act="ok">' + (opts.okLabel || 'OK') + '</button>' +
          '</div>' +
        '</div>';
      root.appendChild(overlay);
      requestAnimationFrame(function(){ overlay.classList.add('show'); });
      function close(result){
        overlay.classList.remove('show');
        setTimeout(function(){ overlay.remove(); }, 200);
        resolve(result);
      }
      overlay.querySelector('[data-act="ok"]').addEventListener('click', function(){ close(true); });
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', function(){ close(false); });
      overlay.addEventListener('click', function(e){ if (e.target === overlay) close(false); });
    });
  }

  // ---------- Prompt modal (replaces prompt) ----------
  function promptModal(message, opts){
    opts = opts || {};
    return new Promise(function(resolve){
      var root = ensureRoot();
      var overlay = document.createElement('div');
      overlay.className = 'ui-overlay';
      overlay.innerHTML =
        '<div class="ui-modal">' +
          '<div class="ui-modal-msg">' + message + '</div>' +
          '<input type="text" class="ui-modal-input" placeholder="' + (opts.placeholder || '') + '" value="' + (opts.defaultValue || '') + '">' +
          '<div class="ui-modal-actions">' +
            '<button class="btn btn-ghost" data-act="cancel">' + (opts.cancelLabel || 'Cancel') + '</button>' +
            '<button class="btn btn-primary" data-act="ok">' + (opts.okLabel || 'OK') + '</button>' +
          '</div>' +
        '</div>';
      root.appendChild(overlay);
      requestAnimationFrame(function(){ overlay.classList.add('show'); overlay.querySelector('.ui-modal-input').focus(); });
      var input = overlay.querySelector('.ui-modal-input');
      function close(result){
        overlay.classList.remove('show');
        setTimeout(function(){ overlay.remove(); }, 200);
        resolve(result);
      }
      overlay.querySelector('[data-act="ok"]').addEventListener('click', function(){ close(input.value); });
      overlay.querySelector('[data-act="cancel"]').addEventListener('click', function(){ close(null); });
      input.addEventListener('keydown', function(e){ if (e.key === 'Enter') close(input.value); });
      overlay.addEventListener('click', function(e){ if (e.target === overlay) close(null); });
    });
  }

  // ---------- Generic modal with custom HTML content ----------
  function modal(html){
    return new Promise(function(resolve){
      var root = ensureRoot();
      var overlay = document.createElement('div');
      overlay.className = 'ui-overlay';
      overlay.innerHTML = '<div class="ui-modal ui-modal-wide">' + html + '</div>';
      root.appendChild(overlay);
      requestAnimationFrame(function(){ overlay.classList.add('show'); });
      function close(result){
        overlay.classList.remove('show');
        setTimeout(function(){ overlay.remove(); }, 200);
        resolve(result);
      }
      overlay.addEventListener('click', function(e){ if (e.target === overlay) close(null); });
      overlay._close = close;
      overlay._el = overlay.querySelector('.ui-modal-wide');
      resolve(overlay);
    });
  }

  return { toast: toast, confirm: confirmModal, prompt: promptModal, modal: modal };
})();
