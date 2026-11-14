(function(){

  var API = 'php/api.php';
  var state = { tab: 'pending', bookings: [], filterDate: '', searchQuery: '', settings: null, slotDate: null };
  var searchDebounce = null;

  function api(action, opts){
    opts = opts || {};
    var url = API + '?action=' + encodeURIComponent(action) + (opts.qs || '');
    var init = { method: opts.method || 'GET', headers: {} };
    if (opts.body) {
      init.method = 'POST';
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init).then(function(r){
      return r.json().then(function(data){ return { ok: r.ok, status: r.status, data: data }; });
    });
  }

  function fmt12(hhmm){
    var p = hhmm.split(':'); var h = parseInt(p[0],10); var m = p[1];
    var ap = h>=12 ? 'PM':'AM'; var h12 = h%12; if(h12===0) h12=12;
    var lang = I18N.getLang();
    return I18N.digits(lang,h12)+':'+I18N.digits(lang,m)+' '+ap;
  }
  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function errMessage(res){
    var code = res.data && res.data.error_code;
    var key = 'err_' + code;
    if (code && I18N.t(key) !== key) return I18N.t(key);
    return (res.data && res.data.error) || I18N.t('err_generic');
  }
  function formatCreatedAt(iso){
    if (!iso) return '—';
    var datePart = iso.slice(0,10);
    var timePart = iso.slice(11,16);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return escapeHtml(iso);
    var label = I18N.formatShortDate(datePart);
    if (/^\d{2}:\d{2}$/.test(timePart)) label += ', ' + fmt12(timePart);
    return label;
  }

  // ---------- Language (toggle itself is wired by header.js; we just react) ----------
  document.addEventListener('langchange', function(){
    var passInput = document.getElementById('adminPass');
    if (passInput) updatePassToggleLabel();
    if (document.getElementById('adminView').style.display !== 'none') {
      var labelEl = document.getElementById('mobileBarLabel');
      if (labelEl) labelEl.textContent = I18N.t('tab_' + state.tab);
      renderTab();
    }
  });

  // ---------- Password eye toggle (login) ----------
  function updatePassToggleLabel(){
    var input = document.getElementById('adminPass');
    var btn = document.getElementById('togglePass');
    if (!input || !btn) return;
    btn.textContent = input.type === 'password' ? I18N.t('show_password') : I18N.t('hide_password');
  }
  document.getElementById('togglePass').addEventListener('click', function(){
    var input = document.getElementById('adminPass');
    input.type = input.type === 'password' ? 'text' : 'password';
    updatePassToggleLabel();
  });

  // ---------- Login ----------
  function showLogin(){
    document.getElementById('loginView').style.display = '';
    document.getElementById('adminView').style.display = 'none';
  }
  function showAdmin(){
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('adminView').style.display = '';
    loadSettingsIntoSidebar();
    var labelEl = document.getElementById('mobileBarLabel');
    if (labelEl) labelEl.textContent = I18N.t('tab_' + state.tab);
    renderTab();
  }

  document.getElementById('doLogin').addEventListener('click', function(){
    var identifier = document.getElementById('adminIdentifier').value.trim();
    var pass = document.getElementById('adminPass').value;
    api('admin_login', { body: { identifier: identifier, password: pass } }).then(function(res){
      if (res.ok) { showAdmin(); }
      else { document.getElementById('loginErr').textContent = errMessage(res); }
    });
  });
  ['adminIdentifier','adminPass'].forEach(function(id){
    document.getElementById(id).addEventListener('keydown', function(e){
      if (e.key === 'Enter') document.getElementById('doLogin').click();
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', function(){
    api('admin_logout').then(function(){ showLogin(); });
  });

  // ---------- Mobile drawer (hamburger toggles the sidebar) ----------
  function openDrawer(){
    document.querySelector('.admin-side').classList.add('open');
    document.getElementById('adminBackdrop').classList.add('show');
  }
  function closeDrawer(){
    document.querySelector('.admin-side').classList.remove('open');
    document.getElementById('adminBackdrop').classList.remove('show');
  }
  var hamburgerBtn = document.getElementById('hamburgerBtn');
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
  var adminBackdrop = document.getElementById('adminBackdrop');
  if (adminBackdrop) adminBackdrop.addEventListener('click', closeDrawer);

  document.querySelectorAll('.tab-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      state.tab = btn.getAttribute('data-tab');
      state.filterDate = ''; state.searchQuery = '';
      var labelEl = document.getElementById('mobileBarLabel');
      if (labelEl) labelEl.textContent = I18N.t('tab_' + state.tab);
      renderTab();
      closeDrawer();
    });
  });

  function loadSettingsIntoSidebar(){
    api('admin_settings').then(function(res){
      if (res.ok){
        state.settings = res.data;
        var lang = I18N.getLang();
        document.getElementById('sideTitle').textContent = (lang==='bn' && res.data.site_title_bn) ? res.data.site_title_bn : res.data.site_title;
        applySidebarLogo(res.data.logo_url);
      }
    });
  }
  function applySidebarLogo(url){
    var img = document.getElementById('sideLogoImg');
    var svg = document.querySelector('.side-logo');
    if (url){
      img.src = url; img.style.display = '';
      if (svg) svg.style.display = 'none';
    } else {
      img.style.display = 'none'; img.removeAttribute('src');
      if (svg) svg.style.display = '';
    }
  }

  function renderTab(){
    if (state.tab === 'pending' || state.tab === 'completed' || state.tab === 'cancelled') renderBookings();
    else if (state.tab === 'blocked_users') renderBlockedUsers();
    else if (state.tab === 'slot_availability') renderSlotAvailability();
    else if (state.tab === 'availability') renderAvailability();
    else if (state.tab === 'admins') renderAdmins();
    else renderSettings();
  }

  // ---------- Bookings (pending / completed / cancelled) ----------
  function renderBookings(){
    var main = document.getElementById('adminMain');
    var titleKey = state.tab === 'pending' ? 'pending_bookings' : (state.tab === 'completed' ? 'completed_bookings' : 'cancelled_bookings');
    var subKey = state.tab === 'pending' ? 'pending_bookings_sub' : (state.tab === 'completed' ? 'completed_bookings_sub' : 'cancelled_bookings_sub');

    main.innerHTML =
      '<h2>' + I18N.t(titleKey) + '</h2><div class="sub">' + I18N.t(subKey) + '</div>' +
      '<div class="toolbar">' +
        '<input type="text" id="searchQuery" placeholder="' + I18N.t('search_ph') + '" value="' + escapeHtml(state.searchQuery) + '" style="min-width:280px;">' +
        '<input type="date" id="filterDate" value="' + state.filterDate + '">' +
        '<button class="btn btn-ghost" id="clearFilter" style="padding:8px 14px;font-size:12.5px;">' + I18N.t('clear') + '</button>' +
      '</div>' +
      '<div style="overflow-x:auto;">' +
      '<table class="data"><thead><tr>' +
        '<th>' + I18N.t('col_booking_no') + '</th><th>' + I18N.t('col_name') + '</th><th>' + I18N.t('col_date') + '</th><th>' + I18N.t('col_time') + '</th><th>' + I18N.t('col_contact') + '</th><th>' + I18N.t('col_ip') + '</th><th>' + I18N.t('col_created') + '</th><th>' + I18N.t('col_status') + '</th><th>' + I18N.t('col_action') + '</th>' +
      '</tr></thead>' +
      '<tbody id="bookingsBody"><tr><td colspan="9" style="text-align:center;color:#B98CA4;padding:30px;">' + I18N.loadingHtml() + '</td></tr></tbody></table>' +
      '</div>';

    document.getElementById('searchQuery').addEventListener('input', function(e){
      var val = e.target.value;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function(){ state.searchQuery = val; fetchBookings(); }, 250);
    });
    document.getElementById('filterDate').addEventListener('change', function(e){
      state.filterDate = e.target.value; fetchBookings();
    });
    document.getElementById('clearFilter').addEventListener('click', function(){
      state.filterDate = ''; state.searchQuery = '';
      document.getElementById('filterDate').value = '';
      document.getElementById('searchQuery').value = '';
      fetchBookings();
    });

    fetchBookings();
  }

  function fetchBookings(){
    var qs = '&tab=' + encodeURIComponent(state.tab);
    if (state.filterDate) qs += '&date=' + encodeURIComponent(state.filterDate);
    if (state.searchQuery) qs += '&search=' + encodeURIComponent(state.searchQuery);
    api('admin_bookings', { qs: qs }).then(function(res){
      if (!res.ok){ if (res.status === 401) showLogin(); return; }
      state.bookings = res.data.bookings || [];
      var tbody = document.getElementById('bookingsBody');
      if (!tbody) return;
      if (state.bookings.length === 0){
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#B98CA4;padding:30px;">' + I18N.t('no_bookings_found') + '</td></tr>';
        return;
      }
      tbody.innerHTML = state.bookings.map(function(b){
        var pillClass = b.effective_status;
        var pillLabel = I18N.t('tab_' + b.effective_status);
        var actionBtn = '';
        if (b.effective_status === 'pending'){
          actionBtn = '<button class="btn btn-ghost" data-complete="' + b.id + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('mark_completed') + '</button> ' +
                      '<button class="btn btn-danger" data-cancel="' + b.id + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('cancel') + '</button>';
        } else if (b.effective_status === 'cancelled'){
          actionBtn = '<button class="btn btn-ghost" data-restore="' + b.id + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('restore') + '</button> ' +
                      '<button class="btn btn-danger" data-delete="' + b.id + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('delete') + '</button>';
        } else {
          actionBtn = '<button class="btn btn-danger" data-cancel="' + b.id + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('cancel') + '</button>';
        }
        actionBtn += ' <button class="btn btn-ghost" data-block-contact="' + escapeHtml(b.contact) + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('block') + '</button>';
        return '<tr>' +
          '<td>' + escapeHtml(b.id) + '</td>' +
          '<td>' + escapeHtml(b.name) + '</td>' +
          '<td>' + I18N.formatShortDate(b.date) + '</td>' +
          '<td>' + fmt12(b.time) + '</td>' +
          '<td>' + escapeHtml(b.contact) + ' <span style="color:#B98CA4;">(' + I18N.t(b.contact_type) + ')</span></td>' +
          '<td style="white-space:nowrap;color:#B98CA4;font-size:12px;">' + escapeHtml(b.ip_address || '—') + '</td>' +
          '<td style="white-space:nowrap;">' + formatCreatedAt(b.created_at) + '</td>' +
          '<td><span class="pill ' + pillClass + '">' + pillLabel + '</span></td>' +
          '<td style="white-space:nowrap;">' + actionBtn + '</td>' +
        '</tr>';
      }).join('');

      document.querySelectorAll('[data-block-contact]').forEach(function(btn){
        btn.addEventListener('click', async function(){
          var contact = btn.getAttribute('data-block-contact');
          var ok = await UI.confirm(I18N.t('confirm_block_contact').replace('%s', contact));
          if (!ok) return;
          api('admin_block_user', { body: { contact: contact, reason: '' } }).then(function(res2){
            if (res2.ok) UI.toast(I18N.t('block'));
            else UI.toast(errMessage(res2), 'error');
          });
        });
      });

      document.querySelectorAll('[data-cancel]').forEach(function(btn){
        btn.addEventListener('click', async function(){
          var ok = await UI.confirm(I18N.t('confirm_action'));
          if (!ok) return;
          api('cancel_booking', { body: { id: btn.getAttribute('data-cancel') } }).then(function(res2){
            if (res2.ok) fetchBookings();
          });
        });
      });
      document.querySelectorAll('[data-restore]').forEach(function(btn){
        btn.addEventListener('click', function(){
          api('restore_booking', { body: { id: btn.getAttribute('data-restore') } }).then(function(res2){
            if (res2.ok) fetchBookings();
          });
        });
      });
      document.querySelectorAll('[data-complete]').forEach(function(btn){
        btn.addEventListener('click', async function(){
          var ok = await UI.confirm(I18N.t('confirm_action'));
          if (!ok) return;
          api('complete_booking', { body: { id: btn.getAttribute('data-complete') } }).then(function(res2){
            if (res2.ok) fetchBookings();
          });
        });
      });
      document.querySelectorAll('[data-delete]').forEach(function(btn){
        btn.addEventListener('click', async function(){
          var ok = await UI.confirm(I18N.t('confirm_delete_booking'));
          if (!ok) return;
          api('delete_booking', { body: { id: btn.getAttribute('data-delete') } }).then(function(res2){
            if (res2.ok) fetchBookings();
          });
        });
      });
    });
  }

  // ---------- Blocked Users ----------
  function renderBlockedUsers(){
    var main = document.getElementById('adminMain');
    main.innerHTML =
      '<h2>' + I18N.t('blocked_users_title') + '</h2><div class="sub">' + I18N.t('blocked_users_sub') + '</div>' +
      '<div class="card" style="max-width:560px;padding:22px;margin-bottom:22px;">' +
        '<h3 style="font-size:15px;margin-bottom:14px;">' + I18N.t('block_new_contact') + '</h3>' +
        '<div class="field"><input type="text" id="bu-contact" placeholder="' + I18N.t('contact_ph') + '"></div>' +
        '<div class="field"><input type="text" id="bu-reason" placeholder="' + I18N.t('reason_optional') + '"></div>' +
        '<div class="btn-row end"><button class="btn btn-primary" id="bu-add">' + I18N.t('block') + '</button></div>' +
      '</div>' +
      '<div id="buList"></div>';

    document.getElementById('bu-add').addEventListener('click', function(){
      var contact = document.getElementById('bu-contact').value.trim();
      var reason = document.getElementById('bu-reason').value.trim();
      if (!contact) return;
      api('admin_block_user', { body: { contact: contact, reason: reason } }).then(function(res){
        if (res.ok) { document.getElementById('bu-contact').value=''; document.getElementById('bu-reason').value=''; loadBlockedUsers(); UI.toast(I18N.t('block')); }
        else UI.toast(errMessage(res), 'error');
      });
    });

    loadBlockedUsers();
  }

  function loadBlockedUsers(){
    api('admin_blocked_users').then(function(res){
      if (!res.ok){ if (res.status === 401) showLogin(); return; }
      var list = res.data.blocked || [];
      var box = document.getElementById('buList');
      if (!box) return;
      if (list.length === 0){
        box.innerHTML = '<div class="empty" style="text-align:center;color:#B98CA4;padding:20px;">' + I18N.t('no_blocked_users') + '</div>';
        return;
      }
      box.innerHTML = list.map(function(b){
        return '<div class="blocked-list-item">' +
          '<div><strong>' + escapeHtml(b.contact) + '</strong>' + (b.reason ? ' — ' + escapeHtml(b.reason) : '') + '</div>' +
          '<button class="btn btn-ghost" data-unblock="' + b.id + '" style="padding:5px 12px;font-size:12px;">' + I18N.t('unblock') + '</button>' +
        '</div>';
      }).join('');
      document.querySelectorAll('[data-unblock]').forEach(function(btn){
        btn.addEventListener('click', function(){
          api('admin_unblock_user', { body: { id: btn.getAttribute('data-unblock') } }).then(function(res2){
            if (res2.ok) loadBlockedUsers();
          });
        });
      });
    });
  }

  // ---------- Availability (booking mode, weekly days, closed/open dates, hours) ----------
  function renderAvailability(){
    var main = document.getElementById('adminMain');
    main.innerHTML = '<h2>' + I18N.t('availability_title') + '</h2><div class="sub">' + I18N.loadingHtml() + '</div>';
    api('admin_settings').then(function(res){
      if (!res.ok){ if (res.status === 401) showLogin(); return; }
      var s = res.data;
      state.settings = s;
      var weekdayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
      var dayBtns = weekdayKeys.map(function(k,i){
        var on = s.closed_days.indexOf(i) !== -1;
        return '<button type="button" data-day="' + i + '" class="' + (on ? 'on' : '') + '">' + I18N.t(k) + '</button>';
      }).join('');

      main.innerHTML =
        '<h2>' + I18N.t('availability_title') + '</h2><div class="sub">' + I18N.t('availability_sub') + '</div>' +

        '<div class="card" style="max-width:640px;padding:24px;margin-bottom:22px;">' +
          '<h3 style="font-size:15px;margin-bottom:14px;">' + I18N.t('booking_mode') + '</h3>' +
          '<div class="radiorow" style="flex-direction:column;align-items:flex-start;gap:12px;">' +
            '<label><input type="radio" name="openMode" value="weekly" ' + (s.open_mode!=='selected_dates'?'checked':'') + '> ' + I18N.t('mode_weekly') + '</label>' +
            '<label><input type="radio" name="openMode" value="selected_dates" ' + (s.open_mode==='selected_dates'?'checked':'') + '> ' + I18N.t('mode_selected') + '</label>' +
          '</div>' +
        '</div>' +

        '<div class="card" style="max-width:640px;padding:24px;margin-bottom:22px;">' +
          '<h3 style="font-size:15px;margin-bottom:14px;">' + I18N.t('working_hours') + '</h3>' +
          '<div class="grid3">' +
            '<div class="field"><label>' + I18N.t('opens') + '</label><input type="text" id="av-open" value="' + s.open_time + '"></div>' +
            '<div class="field"><label>' + I18N.t('closes') + '</label><input type="text" id="av-close" value="' + s.close_time + '"></div>' +
            '<div class="field"><label>' + I18N.t('slot_length') + '</label><input type="text" id="av-slot" value="' + s.slot_minutes + '"></div>' +
          '</div>' +
          '<div class="field"><label>' + I18N.t('capacity_per_slot') + '</label><input type="text" id="av-cap" value="' + s.capacity + '"></div>' +
          '<div class="btn-row end"><button class="btn btn-primary" id="av-save-hours">' + I18N.t('save_settings') + '</button></div>' +
        '</div>' +

        '<div class="card" id="av-weekly-card" style="max-width:640px;padding:24px;margin-bottom:22px;">' +
          '<h3 style="font-size:15px;margin-bottom:14px;">' + I18N.t('closed_on') + '</h3>' +
          '<div class="weekday-toggle" id="dayToggle">' + dayBtns + '</div>' +
          '<div class="btn-row end" style="margin-top:16px;"><button class="btn btn-primary" id="av-save-days">' + I18N.t('save_settings') + '</button></div>' +
        '</div>' +

        '<div class="card" id="av-closed-dates-card" style="max-width:640px;padding:24px;margin-bottom:22px;">' +
          '<h3 style="font-size:15px;margin-bottom:6px;">' + I18N.t('closed_dates_title') + '</h3>' +
          '<div class="sub" style="margin-bottom:14px;">' + I18N.t('closed_dates_sub') + '</div>' +
          '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">' +
            '<div class="field" style="margin-bottom:0;max-width:200px;"><input type="date" id="cd-date"></div>' +
            '<button class="btn btn-danger" id="cd-add" style="height:44px;">' + I18N.t('add_closed_date') + '</button>' +
          '</div>' +
          '<div id="cd-list" style="margin-top:16px;"></div>' +
        '</div>' +

        '<div class="card" id="av-open-dates-card" style="max-width:640px;padding:24px;">' +
          '<h3 style="font-size:15px;margin-bottom:6px;">' + I18N.t('open_dates_title') + '</h3>' +
          '<div class="sub" style="margin-bottom:14px;">' + I18N.t('open_dates_sub') + '</div>' +
          '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">' +
            '<div class="field" style="margin-bottom:0;max-width:200px;"><input type="date" id="od-date"></div>' +
            '<button class="btn btn-primary" id="od-add" style="height:44px;">' + I18N.t('add_open_date') + '</button>' +
          '</div>' +
          '<div id="od-list" style="margin-top:16px;"></div>' +
        '</div>';

      function toggleModeCards(){
        var mode = document.querySelector('input[name=openMode]:checked').value;
        document.getElementById('av-weekly-card').style.display = mode === 'weekly' ? '' : 'none';
        document.getElementById('av-closed-dates-card').style.display = mode === 'weekly' ? '' : 'none';
        document.getElementById('av-open-dates-card').style.display = mode === 'selected_dates' ? '' : 'none';
      }
      toggleModeCards();
      document.querySelectorAll('input[name=openMode]').forEach(function(r){
        r.addEventListener('change', function(){
          toggleModeCards();
          api('admin_settings_update', { body: { open_mode: r.value } }).then(function(res2){
            if (res2.ok) UI.toast(I18N.t('settings_saved'));
            else UI.toast(errMessage(res2), 'error');
          });
        });
      });

      document.getElementById('av-save-hours').addEventListener('click', function(){
        var body = {
          open_time: document.getElementById('av-open').value.trim(),
          close_time: document.getElementById('av-close').value.trim(),
          slot_minutes: parseInt(document.getElementById('av-slot').value, 10) || 5,
          capacity: parseInt(document.getElementById('av-cap').value, 10) || 1
        };
        api('admin_settings_update', { body: body }).then(function(res2){
          if (res2.ok) UI.toast(I18N.t('settings_saved'));
          else UI.toast(errMessage(res2), 'error');
        });
      });

      var closedDays = s.closed_days.slice();
      document.querySelectorAll('#dayToggle button').forEach(function(btn){
        btn.addEventListener('click', function(){
          var i = parseInt(btn.getAttribute('data-day'), 10);
          var idx = closedDays.indexOf(i);
          if (idx === -1) closedDays.push(i); else closedDays.splice(idx, 1);
          btn.classList.toggle('on');
        });
      });
      document.getElementById('av-save-days').addEventListener('click', function(){
        api('admin_settings_update', { body: { closed_days: closedDays } }).then(function(res2){
          if (res2.ok) UI.toast(I18N.t('settings_saved'));
          else UI.toast(errMessage(res2), 'error');
        });
      });

      document.getElementById('cd-add').addEventListener('click', function(){
        var date = document.getElementById('cd-date').value;
        if (!date) return;
        api('admin_block_slot', { body: { date: date, time: '', reason: '' } }).then(function(res2){
          if (res2.ok){ document.getElementById('cd-date').value=''; loadClosedDatesList(); }
          else UI.toast(errMessage(res2), 'error');
        });
      });
      document.getElementById('od-add').addEventListener('click', function(){
        var date = document.getElementById('od-date').value;
        if (!date) return;
        api('admin_add_open_date', { body: { date: date } }).then(function(res2){
          if (res2.ok){ document.getElementById('od-date').value=''; loadOpenDatesList(); }
          else UI.toast(errMessage(res2), 'error');
        });
      });

      loadClosedDatesList();
      loadOpenDatesList();
    });
  }

  function loadClosedDatesList(){
    var box = document.getElementById('cd-list');
    if (!box) return;
    api('admin_blocked_slots').then(function(res){
      if (!res.ok) return;
      var list = (res.data.blocked || []).filter(function(r){ return !r.time; });
      if (list.length === 0){
        box.innerHTML = '<div class="empty" style="text-align:center;color:#B98CA4;padding:16px;">' + I18N.t('no_blocked_items') + '</div>';
        return;
      }
      box.innerHTML = list.map(function(r){
        return '<div class="blocked-list-item">' +
          '<div><strong>' + I18N.formatShortDate(r.date) + '</strong>' + (r.reason ? ' — ' + escapeHtml(r.reason) : '') + '</div>' +
          '<button class="btn btn-ghost" data-unblock-cd="' + r.id + '" style="padding:5px 12px;font-size:12px;">' + I18N.t('unblock') + '</button>' +
        '</div>';
      }).join('');
      document.querySelectorAll('[data-unblock-cd]').forEach(function(btn){
        btn.addEventListener('click', function(){
          api('admin_unblock_slot', { body: { id: btn.getAttribute('data-unblock-cd') } }).then(function(){ loadClosedDatesList(); });
        });
      });
    });
  }

  function loadOpenDatesList(){
    var box = document.getElementById('od-list');
    if (!box) return;
    api('admin_open_dates').then(function(res){
      if (!res.ok) return;
      var list = res.data.open_dates || [];
      if (list.length === 0){
        box.innerHTML = '<div class="empty" style="text-align:center;color:#B98CA4;padding:16px;">' + I18N.t('no_open_dates') + '</div>';
        return;
      }
      box.innerHTML = list.map(function(r){
        return '<div class="blocked-list-item">' +
          '<div><strong>' + I18N.formatShortDate(r.date) + '</strong></div>' +
          '<button class="btn btn-ghost" data-remove-od="' + r.id + '" style="padding:5px 12px;font-size:12px;">' + I18N.t('unblock') + '</button>' +
        '</div>';
      }).join('');
      document.querySelectorAll('[data-remove-od]').forEach(function(btn){
        btn.addEventListener('click', function(){
          api('admin_remove_open_date', { body: { id: btn.getAttribute('data-remove-od') } }).then(function(){ loadOpenDatesList(); });
        });
      });
    });
  }

  // ---------- Slot Availability (fine-grained per-date/time blocking) ----------
  function renderSlotAvailability(){
    var main = document.getElementById('adminMain');
    if (!state.slotDate){
      var t = new Date();
      state.slotDate = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
    }
    main.innerHTML =
      '<h2>' + I18N.t('slot_availability_title') + '</h2><div class="sub">' + I18N.t('slot_availability_sub') + '</div>' +
      '<div class="card" style="padding:22px;margin-bottom:22px;">' +
        '<div class="field" style="max-width:220px;"><label>' + I18N.t('pick_date') + '</label><input type="date" id="sa-date" value="' + state.slotDate + '"></div>' +
        '<div id="sa-body">' + I18N.loadingHtml() + '</div>' +
      '</div>' +
      '<h2 style="font-size:17px;">' + I18N.t('blocked_overview_title') + '</h2>' +
      '<div class="sub">' + I18N.t('blocked_overview_sub') + '</div>' +
      '<div id="sa-overview">' + I18N.loadingHtml() + '</div>';

    document.getElementById('sa-date').addEventListener('change', function(e){
      state.slotDate = e.target.value;
      loadSlotAvailability();
    });

    loadSlotAvailability();
    loadBlockedOverview();
  }

  function loadSlotAvailability(){
    var body = document.getElementById('sa-body');
    if (!body) return;
    body.innerHTML = I18N.loadingHtml();

    Promise.all([
      api('slots', { qs: '&date=' + encodeURIComponent(state.slotDate) }),
      api('admin_blocked_slots', { qs: '&date=' + encodeURIComponent(state.slotDate) })
    ]).then(function(results){
      var slotsRes = results[0], blockedRes = results[1];
      if (!slotsRes.ok || !blockedRes.ok){ if (slotsRes.status===401||blockedRes.status===401) showLogin(); return; }

      var slots = slotsRes.data.slots || [];
      var wholeDayBlocked = slotsRes.data.whole_day_blocked;
      var blockedRows = blockedRes.data.blocked || [];
      var wholeDayRow = blockedRows.find(function(r){ return !r.time; });
      var timeBlockRows = {};
      blockedRows.forEach(function(r){ if (r.time) timeBlockRows[r.time] = r.id; });

      var html = '';
      if (wholeDayBlocked && wholeDayRow){
        html += '<div class="err" style="margin-bottom:12px;">' + I18N.t('whole_day_blocked_note') + '</div>';
        html += '<button class="btn btn-primary" id="sa-toggle-day" data-blocked="1">' + I18N.t('unblock_whole_day') + '</button>';
      } else if (!wholeDayBlocked) {
        html += '<button class="btn btn-danger" id="sa-toggle-day" data-blocked="0">' + I18N.t('block_whole_day') + '</button>';
      } else {
        html += '<div class="err" style="margin-bottom:12px;">' + I18N.t('whole_day_blocked_note') + '</div>';
      }

      html += '<div class="slot-mini-list" style="margin-top:20px;">';
      slots.forEach(function(s){
        var isBlocked = s.status === 'blocked' && timeBlockRows[s.time];
        var cls = 'slot-mini' + (isBlocked ? ' blocked' : '');
        html += '<button class="' + cls + '" data-slot-time="' + s.time + '" data-is-blocked="' + (isBlocked?'1':'0') + '" ' + (wholeDayBlocked ? 'disabled' : '') + '>' + s.time + '</button>';
      });
      html += '</div>';

      body.innerHTML = html;

      var toggleBtn = document.getElementById('sa-toggle-day');
      if (toggleBtn) toggleBtn.addEventListener('click', async function(){
        var isBlocked = this.getAttribute('data-blocked') === '1';
        if (isBlocked){
          api('admin_unblock_slot', { body: { id: wholeDayRow.id } }).then(function(){ loadSlotAvailability(); loadBlockedOverview(); });
        } else {
          var reason = await UI.prompt(I18N.t('reason_optional'), { placeholder: I18N.t('reason_optional') });
          if (reason === null) return;
          api('admin_block_slot', { body: { date: state.slotDate, time: '', reason: reason } }).then(function(){ loadSlotAvailability(); loadBlockedOverview(); });
        }
      });

      document.querySelectorAll('[data-slot-time]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var time = btn.getAttribute('data-slot-time');
          var isBlocked = btn.getAttribute('data-is-blocked') === '1';
          if (isBlocked){
            api('admin_unblock_slot', { body: { id: timeBlockRows[time] } }).then(function(){ loadSlotAvailability(); loadBlockedOverview(); });
          } else {
            api('admin_block_slot', { body: { date: state.slotDate, time: time, reason: '' } }).then(function(){ loadSlotAvailability(); loadBlockedOverview(); });
          }
        });
      });
    });
  }

  function loadBlockedOverview(){
    var box = document.getElementById('sa-overview');
    if (!box) return;
    api('admin_blocked_slots').then(function(res){
      if (!res.ok){ if (res.status === 401) showLogin(); return; }
      var list = res.data.blocked || [];
      if (list.length === 0){
        box.innerHTML = '<div class="empty" style="text-align:center;color:#B98CA4;padding:20px;">' + I18N.t('no_blocked_items') + '</div>';
        return;
      }
      box.innerHTML = list.map(function(b){
        var label = I18N.formatShortDate(b.date) + (b.time ? ' — ' + fmt12(b.time) : ' — ' + I18N.t('whole_day_label'));
        return '<div class="blocked-list-item">' +
          '<div><strong>' + label + '</strong>' + (b.reason ? ' — ' + escapeHtml(b.reason) : '') + '</div>' +
          '<button class="btn btn-ghost" data-unblock-item="' + b.id + '" style="padding:5px 12px;font-size:12px;">' + I18N.t('unblock') + '</button>' +
        '</div>';
      }).join('');
      document.querySelectorAll('[data-unblock-item]').forEach(function(btn){
        btn.addEventListener('click', function(){
          api('admin_unblock_slot', { body: { id: btn.getAttribute('data-unblock-item') } }).then(function(res2){
            if (res2.ok){ loadBlockedOverview(); loadSlotAvailability(); }
          });
        });
      });
    });
  }

  // ---------- Admins (accounts management) ----------
  function renderAdmins(){
    var main = document.getElementById('adminMain');
    main.innerHTML =
      '<h2>' + I18N.t('admins_title') + '</h2><div class="sub">' + I18N.t('admins_sub') + '</div>' +

      '<div class="card" style="max-width:480px;padding:22px;margin-bottom:22px;">' +
        '<h3 style="font-size:15px;margin-bottom:14px;">' + I18N.t('my_account') + '</h3>' +
        '<div class="sub" style="margin-bottom:16px;">' + I18N.t('my_account_sub') + '</div>' +
        '<div class="field"><label>' + I18N.t('current_password') + '</label><input type="password" id="cp-current"></div>' +
        '<div class="field"><label>' + I18N.t('new_password') + '</label><input type="password" id="cp-new"></div>' +
        '<div class="btn-row end"><button class="btn btn-primary" id="cp-save">' + I18N.t('change_password') + '</button></div>' +
      '</div>' +

      '<div class="card" style="max-width:560px;padding:22px;margin-bottom:22px;">' +
        '<h3 style="font-size:15px;margin-bottom:14px;">' + I18N.t('add_admin') + '</h3>' +
        '<div class="field"><label>' + I18N.t('username_label') + '</label><input type="text" id="na-username" placeholder="' + I18N.t('username_ph') + '"></div>' +
        '<div class="grid2">' +
          '<div class="field"><label>' + I18N.t('email_optional') + '</label><input type="text" id="na-email"></div>' +
          '<div class="field"><label>' + I18N.t('phone_optional') + '</label><input type="text" id="na-phone"></div>' +
        '</div>' +
        '<div class="field"><label>' + I18N.t('password') + '</label><input type="password" id="na-password"></div>' +
        '<div class="btn-row end"><button class="btn btn-primary" id="na-add">' + I18N.t('add_admin') + '</button></div>' +
      '</div>' +

      '<div id="adminsList"></div>';

    document.getElementById('cp-save').addEventListener('click', function(){
      var current = document.getElementById('cp-current').value;
      var np = document.getElementById('cp-new').value;
      api('admin_change_password', { body: { current_password: current, new_password: np } }).then(function(res){
        if (res.ok){ UI.toast(I18N.t('password_changed')); document.getElementById('cp-current').value=''; document.getElementById('cp-new').value=''; }
        else UI.toast(errMessage(res), 'error');
      });
    });

    document.getElementById('na-add').addEventListener('click', function(){
      var body = {
        username: document.getElementById('na-username').value.trim(),
        email: document.getElementById('na-email').value.trim(),
        phone: document.getElementById('na-phone').value.trim(),
        password: document.getElementById('na-password').value
      };
      api('admin_add_admin', { body: body }).then(function(res){
        if (res.ok){
          document.getElementById('na-username').value='';
          document.getElementById('na-email').value='';
          document.getElementById('na-phone').value='';
          document.getElementById('na-password').value='';
          loadAdminsList();
        } else UI.toast(errMessage(res), 'error');
      });
    });

    loadAdminsList();
  }

  function loadAdminsList(){
    api('admin_list_admins').then(function(res){
      if (!res.ok){ if (res.status === 401) showLogin(); return; }
      var list = res.data.admins || [];
      var box = document.getElementById('adminsList');
      if (!box) return;
      if (list.length === 0){
        box.innerHTML = '<div class="empty" style="text-align:center;color:#B98CA4;padding:20px;">' + I18N.t('no_admins') + '</div>';
        return;
      }
      box.innerHTML =
        '<div style="overflow-x:auto;">' +
        '<table class="data"><thead><tr>' +
          '<th>' + I18N.t('col_username') + '</th><th>' + I18N.t('col_email') + '</th><th>' + I18N.t('col_phone') + '</th><th>' + I18N.t('col_created') + '</th><th></th>' +
        '</tr></thead><tbody>' +
        list.map(function(a){
          return '<tr>' +
            '<td>' + escapeHtml(a.username) + '</td>' +
            '<td>' + escapeHtml(a.email || '—') + '</td>' +
            '<td>' + escapeHtml(a.phone || '—') + '</td>' +
            '<td>' + I18N.formatShortDate((a.created_at||'').slice(0,10)) + '</td>' +
            '<td style="white-space:nowrap;">' +
              '<button class="btn btn-ghost" data-edit-admin="' + a.id + '" style="padding:5px 10px;font-size:12px;margin-right:6px;">' + I18N.t('edit') + '</button>' +
              (list.length > 1 ? '<button class="btn btn-danger" data-del-admin="' + a.id + '" style="padding:5px 10px;font-size:12px;">' + I18N.t('delete') + '</button>' : '') +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>' +
        '</div>';

      document.querySelectorAll('[data-del-admin]').forEach(function(btn){
        btn.addEventListener('click', async function(){
          var ok = await UI.confirm(I18N.t('confirm_delete_admin'));
          if (!ok) return;
          api('admin_delete_admin', { body: { id: btn.getAttribute('data-del-admin') } }).then(function(res2){
            if (res2.ok) { loadAdminsList(); }
            else UI.toast(errMessage(res2), 'error');
          });
        });
      });

      document.querySelectorAll('[data-edit-admin]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var a = list.find(function(x){ return x.id === btn.getAttribute('data-edit-admin'); });
          if (a) openEditAdminModal(a);
        });
      });
    });
  }

  function openEditAdminModal(a){
    var html =
      '<h2 style="color:var(--pink-deep);margin-bottom:16px;">' + I18N.t('edit_admin') + '</h2>' +
      '<div class="field"><label>' + I18N.t('username_label') + '</label><input type="text" id="ea-username" value="' + escapeHtml(a.username) + '"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>' + I18N.t('email_optional') + '</label><input type="text" id="ea-email" value="' + escapeHtml(a.email||'') + '"></div>' +
        '<div class="field"><label>' + I18N.t('phone_optional') + '</label><input type="text" id="ea-phone" value="' + escapeHtml(a.phone||'') + '"></div>' +
      '</div>' +
      '<div class="field"><label>' + I18N.t('leave_blank_password') + '</label><input type="password" id="ea-password"></div>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="ea-cancel">' + I18N.t('close_dialog') + '</button><button class="btn btn-primary" id="ea-save">' + I18N.t('save') + '</button></div>';

    UI.modal(html).then(function(overlay){
      overlay.querySelector('#ea-cancel').addEventListener('click', function(){ overlay._close(null); });
      overlay.querySelector('#ea-save').addEventListener('click', function(){
        var body = {
          id: a.id,
          username: overlay.querySelector('#ea-username').value.trim(),
          email: overlay.querySelector('#ea-email').value.trim(),
          phone: overlay.querySelector('#ea-phone').value.trim(),
          password: overlay.querySelector('#ea-password').value
        };
        api('admin_update_admin', { body: body }).then(function(res){
          if (res.ok){ overlay._close(true); UI.toast(I18N.t('settings_saved')); loadAdminsList(); }
          else UI.toast(errMessage(res), 'error');
        });
      });
    });
  }

  // ---------- Settings (branding + notice) ----------
  function renderSettings(){
    var main = document.getElementById('adminMain');
    main.innerHTML = '<h2>' + I18N.t('settings_title') + '</h2><div class="sub">' + I18N.loadingHtml() + '</div>';
    api('admin_settings').then(function(res){
      if (!res.ok){ if (res.status === 401) showLogin(); return; }
      var s = res.data;

      main.innerHTML =
        '<h2>' + I18N.t('settings_title') + '</h2><div class="sub">' + I18N.t('settings_sub') + '</div>' +
        '<div class="card" style="max-width:560px;padding:26px;margin-bottom:22px;">' +
          '<h3 style="font-size:15px;margin-bottom:6px;">' + I18N.t('logo_title') + '</h3>' +
          '<div class="sub" style="margin-bottom:16px;">' + I18N.t('logo_sub') + '</div>' +
          '<div id="logo-preview-row" style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">' +
            (s.logo_url
              ? '<img src="' + escapeHtml(s.logo_url) + '" alt="" style="width:64px;height:64px;object-fit:contain;border:1px solid var(--line);border-radius:8px;padding:4px;">'
              : '<div style="width:64px;height:64px;border:1px dashed var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:11px;text-align:center;">' + I18N.t('no_logo') + '</div>') +
            '<div style="flex:1;">' +
              '<input type="file" id="logo-file" accept="image/png,image/jpeg,image/gif,image/webp" style="font-size:12.5px;">' +
            '</div>' +
          '</div>' +
          '<div class="btn-row end">' +
            (s.logo_url ? '<button class="btn btn-danger" id="removeLogo">' + I18N.t('remove_logo') + '</button>' : '') +
            '<button class="btn btn-primary" id="uploadLogo">' + I18N.t('upload_logo') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="card" style="max-width:560px;padding:26px;margin-bottom:22px;">' +
          '<div class="field"><label>' + I18N.t('site_title_en') + '</label><input type="text" id="st-title" value="' + escapeHtml(s.site_title) + '"></div>' +
          '<div class="field"><label>' + I18N.t('site_title_bn') + '</label><input type="text" id="st-title-bn" value="' + escapeHtml(s.site_title_bn||'') + '"></div>' +
          '<div class="field"><label>' + I18N.t('site_subtitle_en') + '</label><input type="text" id="st-sub" value="' + escapeHtml(s.site_subtitle) + '"></div>' +
          '<div class="field"><label>' + I18N.t('site_subtitle_bn') + '</label><input type="text" id="st-sub-bn" value="' + escapeHtml(s.site_subtitle_bn||'') + '"></div>' +
          '<div class="btn-row end"><button class="btn btn-primary" id="saveBranding">' + I18N.t('save_settings') + '</button></div>' +
        '</div>' +

        '<div class="card" style="max-width:560px;padding:26px;">' +
          '<h3 style="font-size:15px;margin-bottom:6px;">' + I18N.t('notice_title') + '</h3>' +
          '<div class="sub" style="margin-bottom:14px;">' + I18N.t('notice_sub') + '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-bottom:16px;">' +
            '<input type="checkbox" id="nt-enabled" ' + (s.notice_enabled ? 'checked' : '') + ' style="width:auto;"> ' + I18N.t('notice_enable') +
          '</label>' +
          '<div class="field"><label>' + I18N.t('notice_text_en_label') + '</label><input type="text" id="nt-en" value="' + escapeHtml(s.notice_text||'') + '"></div>' +
          '<div class="field"><label>' + I18N.t('notice_text_bn_label') + '</label><input type="text" id="nt-bn" value="' + escapeHtml(s.notice_text_bn||'') + '"></div>' +
          '<div class="btn-row end"><button class="btn btn-primary" id="saveNotice">' + I18N.t('save_settings') + '</button></div>' +
        '</div>';

      document.getElementById('uploadLogo').addEventListener('click', function(){
        var fileInput = document.getElementById('logo-file');
        var file = fileInput.files[0];
        if (!file){ UI.toast(I18N.t('choose_file_first'), 'error'); return; }
        var fd = new FormData();
        fd.append('logo', file);
        fetch(API + '?action=admin_upload_logo', { method: 'POST', body: fd }).then(function(r){
          return r.json().then(function(data){ return { ok: r.ok, status: r.status, data: data }; });
        }).then(function(res){
          if (res.ok){
            UI.toast(I18N.t('logo_uploaded'));
            applySidebarLogo(res.data.logo_url);
            renderSettings();
          } else {
            UI.toast(errMessage(res), 'error');
          }
        });
      });

      var removeBtn = document.getElementById('removeLogo');
      if (removeBtn) removeBtn.addEventListener('click', async function(){
        var ok = await UI.confirm(I18N.t('confirm_action'));
        if (!ok) return;
        api('admin_remove_logo').then(function(res2){
          if (res2.ok){ applySidebarLogo(null); renderSettings(); }
          else UI.toast(errMessage(res2), 'error');
        });
      });

      document.getElementById('saveBranding').addEventListener('click', function(){
        var body = {
          site_title: document.getElementById('st-title').value.trim(),
          site_title_bn: document.getElementById('st-title-bn').value.trim(),
          site_subtitle: document.getElementById('st-sub').value.trim(),
          site_subtitle_bn: document.getElementById('st-sub-bn').value.trim()
        };
        api('admin_settings_update', { body: body }).then(function(res2){
          if (res2.ok){ UI.toast(I18N.t('settings_saved')); loadSettingsIntoSidebar(); }
          else UI.toast(errMessage(res2), 'error');
        });
      });

      document.getElementById('saveNotice').addEventListener('click', function(){
        var body = {
          notice_enabled: document.getElementById('nt-enabled').checked,
          notice_text: document.getElementById('nt-en').value.trim(),
          notice_text_bn: document.getElementById('nt-bn').value.trim()
        };
        api('admin_settings_update', { body: body }).then(function(res2){
          if (res2.ok) UI.toast(I18N.t('settings_saved'));
          else UI.toast(errMessage(res2), 'error');
        });
      });
    });
  }

  // ---------- Init ----------
  I18N.apply();
  updatePassToggleLabel();
  api('admin_check').then(function(res){
    if (res.ok && res.data.loggedIn) showAdmin();
    else showLogin();
  });

})();
