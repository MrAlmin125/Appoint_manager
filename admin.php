<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — Appointment System</title>
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

<!-- LOGIN VIEW -->
<div class="wrap" id="loginView">
  <div style="display:flex;justify-content:flex-end;padding-top:20px;">
    <div class="lang-toggle">
      <button data-lang="bn">বাংলা</button>
      <button data-lang="en">English</button>
    </div>
  </div>
  <div class="login-box">
    <h2 style="color:var(--pink-deep);margin-bottom:6px;" data-i18n="admin_sign_in">Admin Sign In</h2>
    <div class="sub" style="color:var(--ink-soft);font-size:13px;margin-bottom:20px;" data-i18n="admin_sign_in_sub">Enter the administrator password to continue.</div>
    <div class="field">
      <label data-i18n="identifier_label">Username, Email or Phone</label>
      <input type="text" id="adminIdentifier" data-i18n-ph="identifier_ph" placeholder="Username, email or phone number">
    </div>
    <div class="field">
      <label data-i18n="password">Password</label>
      <div style="position:relative;">
        <input type="password" id="adminPass" placeholder="Password" style="padding-right:70px;">
        <button type="button" id="togglePass" class="nav-link" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12px;" data-i18n="show_password">Show</button>
      </div>
    </div>
    <div class="err" id="loginErr"></div>
    <div class="btn-row" style="margin-top:6px;">
      <a class="btn btn-ghost" href="index.php" style="text-decoration:none;" data-i18n="back">Back</a>
      <button class="btn btn-primary" id="doLogin" data-i18n="sign_in">Sign In</button>
    </div>
    
  </div>
  <?php include 'partials/footer.php'; ?>
</div>

<!-- ADMIN VIEW -->
<div class="admin-shell" id="adminView" style="display:none;">
  <div class="admin-mobile-bar">
    <button id="hamburgerBtn" aria-label="Menu" type="button">
      <svg class="hamburger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
    <span class="mobile-title" id="mobileBarLabel">Admin Panel</span>
  </div>
  <div class="admin-backdrop" id="adminBackdrop"></div>
<?php include 'partials/admin_header.php'; ?>
  <div class="admin-main" id="adminMain"></div>
</div>

<script src="js/i18n.js"></script>
<script src="js/ui.js"></script>
<script src="js/header.js"></script>
<script src="js/admin.js"></script>
</body>
</html>
