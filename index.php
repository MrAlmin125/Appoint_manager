<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Appointment Booking</title>
<link rel="icon" type="image/png" sizes="32x32" href="uploads/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="uploads/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="uploads/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Noto+Serif+Bengali:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=Noto+Sans+Bengali:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/header.css">
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/footer.css">
</head>
<body>

<?php include 'partials/header.php'; ?>

<div id="noticeBanner" style="display:none;"></div>

<div class="ledger">
  <div class="ledger-step">
    <div class="ledger-num" id="ln1">1</div>
    <div class="ledger-label" id="ll1" data-i18n="step_your_info">Your Info</div>
  </div>
  <div class="ledger-rule"></div>
  <div class="ledger-step">
    <div class="ledger-num" id="ln2">2</div>
    <div class="ledger-label" id="ll2" data-i18n="step_choose_time">Choose Time</div>
  </div>
  <div class="ledger-rule"></div>
  <div class="ledger-step">
    <div class="ledger-num" id="ln3">3</div>
    <div class="ledger-label" id="ll3" data-i18n="step_confirm">Confirm</div>
  </div>
</div>

<main>

  <!-- STEP 1 -->
  <section class="card" id="step1">
    <h2 data-i18n="book_appointment">Book an Appointment</h2>
    <div class="sub" data-i18n="book_appointment_sub">Please provide your details to begin.</div>

    <div class="field">
      <label data-i18n="full_name">Full Name</label>
      <input type="text" id="f-name" data-i18n-ph="full_name_ph" placeholder="e.g. Abdul Karim">
      <div class="err" id="err-name"></div>
    </div>

    <div class="field">
      <label data-i18n="contact">Contact</label>
      <div class="radiorow">
        <label><input type="radio" name="ctype" value="phone" checked> <span data-i18n="phone">Phone</span></label>
        <label><input type="radio" name="ctype" value="email"> <span data-i18n="email">Email</span></label>
      </div>
      <input type="tel" id="f-contact" data-i18n-ph="phone_ph" placeholder="e.g. 01xxxxxxxxx">
      <div class="err" id="err-contact"></div>
    </div>

    <div class="btn-row end">
      <button class="btn btn-primary" id="toStep2" data-i18n="continue_btn">Continue</button>
    </div>
  </section>

  <!-- STEP 2 -->
  <section class="split" id="step2" style="display:none;">
    <div class="card" style="padding:24px;">
      <div class="cal-head">
        <div class="month" id="calMonthLabel"></div>
        <div class="cal-nav">
          <button id="calToday" class="today" data-i18n="today">today</button>
          <button id="calPrev">‹</button>
          <button id="calNext">›</button>
        </div>
      </div>
      <table class="cal">
        <thead><tr id="calWeekdayRow"></tr></thead>
        <tbody id="calBody"></tbody>
      </table>
    </div>
    <div class="card" style="padding:24px;">
      <div class="slots-head">
        <h3 style="font-family:'Source Serif 4',serif;font-size:16px;" data-i18n="available_slots">Available Slots</h3>
        <span class="live"><span class="dot"></span><span data-i18n="live">Live</span></span>
      </div>
      <div class="slots-date" id="slotsDateLabel">—</div>
      <div class="slots-list" id="slotsList">
        <div class="empty" data-i18n="select_date_prompt">Select a date to see available times.</div>
      </div>
      <div class="btn-row" style="margin-top:18px;">
        <button class="btn btn-ghost" id="backStep1" data-i18n="back">Back</button>
        <button class="btn btn-primary" id="toStep3" data-i18n="confirm" disabled>Confirm</button>
      </div>
    </div>
  </section>

  <!-- STEP 3 -->
  <section class="card" id="step3" style="display:none;">
    <div id="step3Body"></div>
  </section>

</main>

<footer>
  <span id="footerText">© <span id="year"></span> Appointment System. <span data-i18n="footer_rights">All rights reserved.</span></span>
  <?php include 'partials/footer.php'; ?>
</footer>

<div id="printArea"></div>

<script src="js/i18n.js"></script>
<script src="js/ui.js"></script>
<script src="js/header.js"></script>
<script src="js/footer.js"></script>
<script src="js/booking.js"></script>
</body>
</html>
