  <div class="admin-side">
    <div class="side-brand">
      <svg class="side-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.4"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/><path d="M10 21v-4h4v4"/></svg>
      <img id="sideLogoImg" class="side-logo-img" alt="" style="display:none;">
      <h1 id="sideTitle">Appointment System</h1>
    </div>
    <div class="tag">Admin Panel</div>
    <div class="lang-toggle">
      <button data-lang="bn">বাংলা</button>
      <button data-lang="en">English</button>
    </div>
    <button data-tab="pending" class="tab-btn active">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
      <span data-i18n="tab_pending">Pending</span>
    </button>
    <button data-tab="completed" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>
      <span data-i18n="tab_completed">Completed</span>
    </button>
    <button data-tab="cancelled" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
      <span data-i18n="tab_cancelled">Cancelled</span>
    </button>
    <button data-tab="blocked_users" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16.5 8l4 4M20.5 8l-4 4"/></svg>
      <span data-i18n="tab_blocked_users">Blocked Users</span>
    </button>
    <button data-tab="availability" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8.5 14.2l2 2 4-4.2"/></svg>
      <span data-i18n="tab_availability">Availability</span>
    </button>
    <button data-tab="slot_availability" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M4 12h16M4 18h7"/><circle cx="16.5" cy="6" r="1.7"/><circle cx="9" cy="18" r="1.7"/></svg>
      <span data-i18n="tab_slot_availability">Slot Availability</span>
    </button>
    <button data-tab="admins" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8" r="3"/><path d="M2.8 19.5c0-3.3 2.6-5.7 5.7-5.7s5.7 2.4 5.7 5.7"/><circle cx="17" cy="9" r="2.4"/><path d="M15.6 13.3c2.4.5 4.1 2.4 4.1 5"/></svg>
      <span data-i18n="tab_admins">Admins</span>
    </button>
    <button data-tab="settings" class="tab-btn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M4.5 7l2 1.2M17.5 15.8l2 1.2M3 12h2.4M18.6 12H21M4.5 17l2-1.2M17.5 8.2l2-1.2M7 4.5l1.2 2M15.8 17.5l1.2 2M7 19.5l1.2-2M15.8 6.5l1.2-2"/></svg>
      <span data-i18n="tab_settings">Settings</span>
    </button>
    <a class="logout" href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none;padding:10px 10px;">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/></svg>
      <span data-i18n="view_public_site">View Public Site</span>
    </a>
    <button class="logout" id="logoutBtn">
      <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20H5a1 1 0 01-1-1V5a1 1 0 011-1h4"/><path d="M16 17l4-5-4-5M20 12H9"/></svg>
      <span data-i18n="sign_out">Sign Out</span>
    </button>
    <div class="side-dev-credit">Developed by <a href="https://amin.free.nf" target="_blank" rel="noopener">Mr. Amin</a></div>
  </div>
