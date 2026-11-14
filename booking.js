(function(){

  var API = 'php/api.php';

  var state = {
    step: 1,
    settings: null,
    blockedDates: [],
    openDates: [],
    form: { name:'', contactType:'phone', contact:'' },
    calYear: null, calMonth: null,
    selectedDate: null,
    selectedSlot: null,
    lastBookingId: null
  };

  function pad(n){ return n<10 ? '0'+n : ''+n; }
  function isoDate(y,m,d){ return y+'-'+pad(m+1)+'-'+pad(d); }
  function todayObj(){ var t=new Date(); return {y:t.getFullYear(), m:t.getMonth(), d:t.getDate()}; }
  function fmt12(hhmm){
    var p = hhmm.split(':'); var h = parseInt(p[0],10); var m = p[1];
    var ap = h>=12 ? 'PM':'AM'; var h12 = h%12; if(h12===0) h12=12;
    var lang = I18N.getLang();
    return I18N.digits(lang, h12) + ':' + I18N.digits(lang, m) + ' ' + ap;
  }
  function addMinutes(hhmm, mins){
    var p = hhmm.split(':'); var total = parseInt(p[0],10)*60+parseInt(p[1],10)+mins;
    return pad(Math.floor(total/60))+':'+pad(total%60);
  }
  function formatLongDate(dstr){
    var p = dstr.split('-'); var y=parseInt(p[0]),m=parseInt(p[1])-1,d=parseInt(p[2]);
    var dt = new Date(y,m,d);
    var lang = I18N.getLang();
    var wd = I18N.weekdayLong(lang, dt.getDay());
    var mon = I18N.monthName(lang, m).slice(0, lang==='bn'?undefined:3);
    return wd+', '+mon+' '+I18N.digits(lang,pad(d))+', '+I18N.digits(lang,y);
  }

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

  function errMessage(res){
    var code = res.data && res.data.error_code;
    var key = 'err_' + code;
    if (code && I18N.t(key) !== key) return I18N.t(key);
    return (res.data && res.data.error) || I18N.t('err_generic');
  }

  // ---------- Language (toggle itself is wired by header.js; we just react) ----------
  function applyBranding(){
    if (!state.settings) return;
    var lang = I18N.getLang();
    document.getElementById('siteTitle').textContent = lang === 'bn' && state.settings.site_title_bn
      ? state.settings.site_title_bn : state.settings.site_title;
    document.getElementById('siteSubtitle').textContent = lang === 'bn' && state.settings.site_subtitle_bn
      ? state.settings.site_subtitle_bn : state.settings.site_subtitle;
    var logoImg = document.getElementById('siteLogo');
    if (state.settings.logo_url){
      logoImg.src = state.settings.logo_url;
      logoImg.style.display = '';
    } else {
      logoImg.style.display = 'none';
      logoImg.removeAttribute('src');
    }
    renderNotice();
  }
  function renderNotice(){
    var banner = document.getElementById('noticeBanner');
    if (!state.settings || !state.settings.notice_enabled){ banner.style.display = 'none'; return; }
    var lang = I18N.getLang();
    var text = lang === 'bn' && state.settings.notice_text_bn ? state.settings.notice_text_bn : state.settings.notice_text;
    if (!text){ banner.style.display = 'none'; return; }
    banner.textContent = text;
    banner.style.display = '';
  }
  document.addEventListener('langchange', function(){
    applyBranding();
    updateLedger();
    if (state.step === 2){ renderCalendar(); renderSlots(); }
    if (state.step === 3){ renderStep3(); }
    var input = document.getElementById('f-contact');
    input.placeholder = I18N.t(state.form.contactType === 'email' ? 'email_ph' : 'phone_ph');
  });

  function updateLedger(){
    for (var i=1;i<=3;i++){
      var num = document.getElementById('ln'+i);
      var lab = document.getElementById('ll'+i);
      var isDone = i < state.step || (i === 3 && state.step === 3 && state.lastBookingId);
      num.className = 'ledger-num' + (isDone ? ' done' : (i === state.step ? ' current' : ''));
      num.textContent = isDone ? '✓' : I18N.digits(I18N.getLang(), i);
      lab.className = 'ledger-label' + (i <= state.step ? ' active' : '');
    }
    document.getElementById('step1').style.display = state.step===1 ? '' : 'none';
    document.getElementById('step2').style.display = state.step===2 ? '' : 'none';
    document.getElementById('step3').style.display = state.step===3 ? '' : 'none';
  }

  // ---------- Step 1 ----------
  document.querySelectorAll('input[name=ctype]').forEach(function(r){
    r.addEventListener('change', function(){
      state.form.contactType = r.value;
      var input = document.getElementById('f-contact');
      input.type = r.value === 'email' ? 'email' : 'tel';
      input.placeholder = I18N.t(r.value === 'email' ? 'email_ph' : 'phone_ph');
      input.value = '';
      state.form.contact = '';
    });
  });

  document.getElementById('toStep2').addEventListener('click', function(){
    var name = document.getElementById('f-name').value.trim();
    var contact = document.getElementById('f-contact').value.trim();
    document.getElementById('err-name').textContent = '';
    document.getElementById('err-contact').textContent = '';
    var valid = true;
    if (!name) { document.getElementById('err-name').textContent = I18N.t('err_name_required'); valid = false; }
    if (!contact) { document.getElementById('err-contact').textContent = I18N.t(state.form.contactType==='email'?'err_email_required':'err_phone_required'); valid = false; }
    if (!valid) return;
    state.form.name = name;
    state.form.contact = contact;
    var t = todayObj();
    state.calYear = t.y; state.calMonth = t.m;
    state.selectedDate = null; state.selectedSlot = null;
    state.step = 2;
    updateLedger();
    Promise.all([ api('blocked_dates'), api('open_dates') ]).then(function(results){
      state.blockedDates = (results[0].ok && results[0].data.dates) ? results[0].data.dates : [];
      state.openDates = (results[1].ok && results[1].data.dates) ? results[1].data.dates : [];
      renderCalendar();
      renderSlots();
    });
  });

  // ---------- Step 2 : calendar ----------
  function isDateClosed(y,m,d){
    var dt = new Date(y,m,d);
    var dstr = isoDate(y,m,d);
    var t = todayObj();
    var today = new Date(t.y,t.m,t.d);
    if (dt < today) return true;

    var mode = (state.settings && state.settings.open_mode) || 'weekly';
    if (mode === 'selected_dates'){
      if (state.openDates.indexOf(dstr) === -1) return true;
      if (state.blockedDates.indexOf(dstr) !== -1) return true;
      return false;
    }
    var closedDays = (state.settings && state.settings.closed_days) || [];
    if (closedDays.indexOf(dt.getDay()) !== -1) return true;
    if (state.blockedDates.indexOf(dstr) !== -1) return true;
    return false;
  }

  function renderCalendar(){
    var lang = I18N.getLang();
    var y = state.calYear, m = state.calMonth;
    document.getElementById('calMonthLabel').textContent = I18N.monthName(lang,m) + ' ' + I18N.digits(lang,y);
    var t = todayObj();
    document.getElementById('calPrev').disabled = (y === t.y && m === t.m);

    var weekdayRow = document.getElementById('calWeekdayRow');
    var wkKeys = ['sun','mon','tue','wed','thu','fri','sat'];
    weekdayRow.innerHTML = wkKeys.map(function(k){ return '<th>'+I18N.t(k)+'</th>'; }).join('');

    var first = new Date(y,m,1);
    var startDow = first.getDay();
    var daysInMonth = new Date(y,m+1,0).getDate();
    var cells = [];
    for (var i=0;i<startDow;i++) cells.push(null);
    for (var d=1; d<=daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    var body = document.getElementById('calBody');
    body.innerHTML = '';
    for (var r=0; r<cells.length/7; r++){
      var tr = document.createElement('tr');
      for (var c=0;c<7;c++){
        var d2 = cells[r*7+c];
        var td = document.createElement('td');
        if (d2 !== null){
          var closed = isDateClosed(y,m,d2);
          var dstr = isoDate(y,m,d2);
          var btn = document.createElement('button');
          btn.textContent = I18N.digits(lang, d2);
          btn.disabled = closed;
          if (state.selectedDate === dstr) btn.className = 'sel';
          btn.addEventListener('click', function(dstr2){
            return function(){
              state.selectedDate = dstr2;
              state.selectedSlot = null;
              document.getElementById('toStep3').disabled = true;
              renderCalendar();
              renderSlots();
            };
          }(dstr));
          td.appendChild(btn);
        }
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
  }

  function refreshBlockedDatesAndRenderCal(){
    Promise.all([ api('blocked_dates'), api('open_dates') ]).then(function(results){
      state.blockedDates = (results[0].ok && results[0].data.dates) ? results[0].data.dates : state.blockedDates;
      state.openDates = (results[1].ok && results[1].data.dates) ? results[1].data.dates : state.openDates;
      renderCalendar();
    });
  }

  document.getElementById('calPrev').addEventListener('click', function(){
    state.calMonth--; if (state.calMonth<0){ state.calMonth=11; state.calYear--; }
    refreshBlockedDatesAndRenderCal();
  });
  document.getElementById('calNext').addEventListener('click', function(){
    state.calMonth++; if (state.calMonth>11){ state.calMonth=0; state.calYear++; }
    refreshBlockedDatesAndRenderCal();
  });
  document.getElementById('calToday').addEventListener('click', function(){
    var t = todayObj(); state.calYear = t.y; state.calMonth = t.m;
    refreshBlockedDatesAndRenderCal();
  });

  function renderSlots(){
    var list = document.getElementById('slotsList');
    var dateLabel = document.getElementById('slotsDateLabel');
    if (!state.selectedDate){
      dateLabel.textContent = '—';
      list.innerHTML = '<div class="empty">' + I18N.t('select_date_prompt') + '</div>';
      return;
    }
    dateLabel.textContent = formatLongDate(state.selectedDate);
    list.innerHTML = '<div class="empty">' + I18N.loadingHtml() + '</div>';
    api('slots', { qs: '&date=' + encodeURIComponent(state.selectedDate) }).then(function(res){
      if (!res.ok){ list.innerHTML = '<div class="empty">' + I18N.t('could_not_load_slots') + '</div>'; return; }
      var slots = res.data.slots || [];
      var slotMinutes = res.data.slot_minutes;
      if (slots.length === 0){
        list.innerHTML = '<div class="empty">' + I18N.t('no_slots') + '</div>';
        return;
      }
      list.innerHTML = '';
      slots.forEach(function(s){
        var cls = 'slot-row';
        var tagKey = 'available';
        if (s.status === 'blocked'){ cls += ' blocked'; tagKey = 'unavailable'; }
        else if (s.status === 'full'){ cls += ' full'; tagKey = 'full'; }
        else if (state.selectedSlot === s.time){ cls += ' sel'; }

        var row = document.createElement('div');
        row.className = cls;
        row.innerHTML = '<span>' + fmt12(s.time) + ' - ' + fmt12(addMinutes(s.time, slotMinutes)) + '</span>' +
                         '<span class="tag">' + I18N.t(tagKey) + '</span>';
        if (s.status === 'available'){
          row.addEventListener('click', function(){
            state.selectedSlot = s.time;
            document.getElementById('toStep3').disabled = false;
            renderSlots();
          });
        }
        list.appendChild(row);
      });
    });
  }

  document.getElementById('backStep1').addEventListener('click', function(){
    state.step = 1;
    updateLedger();
  });

  document.getElementById('toStep3').addEventListener('click', function(){
    if (!state.selectedSlot) return;
    state.step = 3;
    updateLedger();
    renderStep3();
  });

  // ---------- Step 3 ----------
  function renderStep3(){
    var body = document.getElementById('step3Body');
    if (state.lastBookingId){
      body.innerHTML =
        '<div class="confirmed">' +
          '<div class="mark">✓</div>' +
          '<h2>' + I18N.t('appointment_confirmed') + '</h2>' +
          '<div class="sub">' + I18N.t('appointment_confirmed_sub') + '</div>' +
          '<div class="ref">' + I18N.t('reference') + ' ' + state.lastBookingId + '</div>' +
        '</div>' +
        '<div class="btn-row" style="margin-top:22px;">' +
          '<button class="btn btn-ghost" id="printReceiptBtn">' + I18N.t('print_receipt') + '</button>' +
          '<button class="btn btn-primary" id="newBooking">' + I18N.t('book_another') + '</button>' +
        '</div>';
      document.getElementById('printReceiptBtn').addEventListener('click', function(){
        printReceiptById(state.lastBookingId, {
          name: state.form.name, contact: state.form.contact, contact_type: state.form.contactType,
          date: state.selectedDate, time: state.selectedSlot, effective_status: 'pending'
        });
      });
      document.getElementById('newBooking').addEventListener('click', function(){
        state.step = 1;
        state.form = { name:'', contactType:'phone', contact:'' };
        state.selectedDate = null; state.selectedSlot = null; state.lastBookingId = null;
        document.getElementById('f-name').value = '';
        document.getElementById('f-contact').value = '';
        document.querySelector('input[name=ctype][value=phone]').checked = true;
        updateLedger();
      });
      return;
    }
    var slotMinutes = (state.settings && state.settings.slot_minutes) || 5;
    body.innerHTML =
      '<h2>' + I18N.t('review_confirm') + '</h2>' +
      '<div class="sub">' + I18N.t('review_confirm_sub') + '</div>' +
      '<div class="summary">' +
        '<div class="row"><span class="k">' + I18N.t('full_name') + '</span><span class="v">' + escapeHtml(state.form.name) + '</span></div>' +
        '<div class="row"><span class="k">' + I18N.t(state.form.contactType==='email'?'email':'phone') + '</span><span class="v">' + escapeHtml(state.form.contact) + '</span></div>' +
        '<div class="row"><span class="k">' + I18N.t('date_label') + '</span><span class="v">' + formatLongDate(state.selectedDate) + '</span></div>' +
        '<div class="row"><span class="k">' + I18N.t('time_label') + '</span><span class="v">' + fmt12(state.selectedSlot) + ' - ' + fmt12(addMinutes(state.selectedSlot, slotMinutes)) + '</span></div>' +
      '</div>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="backStep2">' + I18N.t('back') + '</button><button class="btn btn-primary" id="doConfirm">' + I18N.t('confirm_appointment') + '</button></div>';

    document.getElementById('backStep2').addEventListener('click', function(){
      state.step = 2;
      updateLedger();
    });
    document.getElementById('doConfirm').addEventListener('click', function(){
      var btn = document.getElementById('doConfirm');
      btn.disabled = true; btn.textContent = I18N.t('confirming');
      api('book', { body: {
        name: state.form.name,
        contact_type: state.form.contactType,
        contact: state.form.contact,
        date: state.selectedDate,
        time: state.selectedSlot
      }}).then(function(res){
        if (!res.ok){
          UI.toast(errMessage(res), 'error');
          if (res.status === 409){
            state.step = 2; state.selectedSlot = null;
            updateLedger(); renderSlots();
          } else {
            btn.disabled = false; btn.textContent = I18N.t('confirm_appointment');
          }
          return;
        }
        state.lastBookingId = res.data.id;
        updateLedger();
        renderStep3();
      });
    });
  }

  // ---------- Receipt printing (in-page preview, works reliably on mobile) ----------
  function buildReceiptHtml(id, booking){
    var siteTitle = (state.settings && (I18N.getLang()==='bn' ? state.settings.site_title_bn : state.settings.site_title)) || '';
    var slotMinutes = (state.settings && state.settings.slot_minutes) || 5;
    var statusLabel = I18N.t('tab_' + (booking.effective_status || 'pending'));
    return '<div class="print-preview-box">' +
      '<div class="rt">' + escapeHtml(siteTitle) + '</div>' +
      '<div class="rsub">' + I18N.t('receipt_title') + '</div>' +
      '<div class="row"><span class="k">' + I18N.t('receipt_name') + '</span><span>' + escapeHtml(booking.name) + '</span></div>' +
      '<div class="row"><span class="k">' + I18N.t(booking.contact_type==='email'?'email':'phone') + '</span><span>' + escapeHtml(booking.contact) + '</span></div>' +
      '<div class="row"><span class="k">' + I18N.t('receipt_date') + '</span><span>' + formatLongDate(booking.date) + '</span></div>' +
      '<div class="row"><span class="k">' + I18N.t('receipt_time') + '</span><span>' + fmt12(booking.time) + ' - ' + fmt12(addMinutes(booking.time, slotMinutes)) + '</span></div>' +
      '<div class="row"><span class="k">' + I18N.t('receipt_status') + '</span><span>' + statusLabel + '</span></div>' +
      '<div class="pref">' + I18N.t('receipt_ref') + ': ' + id + '</div>' +
      '<div class="pnote">' + I18N.t('receipt_footer_note') + '</div>' +
    '</div>';
  }

  function printReceiptById(id, booking){
    var receiptHtml = buildReceiptHtml(id, booking);
    var html =
      '<h2 style="color:var(--pink-deep);margin-bottom:14px;">' + I18N.t('receipt_title') + '</h2>' +
      receiptHtml +
      '<div class="btn-row" style="margin-top:18px;">' +
        '<button class="btn btn-ghost" id="rp-close">' + I18N.t('close_dialog') + '</button>' +
        '<button class="btn btn-primary" id="rp-print">' + I18N.t('print_receipt') + '</button>' +
      '</div>';
    UI.modal(html).then(function(overlay){
      overlay.querySelector('#rp-close').addEventListener('click', function(){ overlay._close(null); });
      overlay.querySelector('#rp-print').addEventListener('click', function(){
        document.getElementById('printArea').innerHTML = receiptHtml;
        window.print();
      });
    });
  }

  // ---------- Track appointment ----------
  function openTrackModal(){
    var html =
      '<h2 style="color:var(--pink-deep);margin-bottom:6px;">' + I18N.t('track_title') + '</h2>' +
      '<div class="sub" style="color:var(--ink-soft);font-size:13px;margin-bottom:18px;">' + I18N.t('track_sub') + '</div>' +
      '<div class="field"><input type="text" id="track-ref" placeholder="' + I18N.t('track_ref_ph') + '"></div>' +
      '<div style="text-align:center;color:var(--ink-soft);font-size:12px;margin:4px 0 10px;">' + I18N.t('track_or') + '</div>' +
      '<div class="field"><input type="text" id="track-contact" placeholder="' + I18N.t('track_contact_ph') + '"></div>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="track-close">' + I18N.t('close_dialog') + '</button><button class="btn btn-primary" id="track-search">' + I18N.t('track_search') + '</button></div>' +
      '<div id="track-results" style="margin-top:16px;"></div>';

    UI.modal(html).then(function(overlay){
      overlay.querySelector('#track-close').addEventListener('click', function(){ overlay._close(null); });
      overlay.querySelector('#track-search').addEventListener('click', function(){
        var ref = overlay.querySelector('#track-ref').value.trim();
        var contact = overlay.querySelector('#track-contact').value.trim();
        var results = overlay.querySelector('#track-results');
        if (!ref && !contact){ return; }
        results.innerHTML = '<div class="empty">' + I18N.loadingHtml() + '</div>';
        var qs = ref ? ('&ref=' + encodeURIComponent(ref)) : ('&contact=' + encodeURIComponent(contact));
        api('track_booking', { qs: qs }).then(function(res){
          if (!res.ok || !res.data.bookings || res.data.bookings.length === 0){
            results.innerHTML = '<div class="empty">' + I18N.t('track_no_results') + '</div>';
            return;
          }
          results.innerHTML = res.data.bookings.map(function(b){
            var statusLabel = I18N.t('tab_' + b.effective_status);
            return '<div class="summary" style="margin-bottom:10px;">' +
              '<div class="row"><span class="k">' + I18N.t('receipt_ref') + '</span><span class="v">' + b.id + '</span></div>' +
              '<div class="row"><span class="k">' + I18N.t('receipt_date') + '</span><span class="v">' + formatLongDate(b.date) + '</span></div>' +
              '<div class="row"><span class="k">' + I18N.t('receipt_time') + '</span><span class="v">' + fmt12(b.time) + '</span></div>' +
              '<div class="row"><span class="k">' + I18N.t('receipt_status') + '</span><span class="v">' + statusLabel + '</span></div>' +
              '<div class="btn-row end" style="margin-top:8px;"><button class="btn btn-ghost btn-print" data-id="' + b.id + '">' + I18N.t('print_receipt') + '</button></div>' +
            '</div>';
          }).join('');
          results.querySelectorAll('.btn-print').forEach(function(btn){
            btn.addEventListener('click', function(){
              var b = res.data.bookings.find(function(x){ return x.id === btn.getAttribute('data-id'); });
              if (b) printReceiptById(b.id, b);
            });
          });
        });
      });
    });
  }
  document.getElementById('trackLink').addEventListener('click', openTrackModal);

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  // ---------- Init ----------
  I18N.apply();
  api('settings').then(function(res){
    state.settings = res.data;
    applyBranding();
    updateLedger();
  });

})();
