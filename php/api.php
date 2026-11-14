<?php
session_start();
header('Content-Type: application/json');
require __DIR__ . '/db.php';

function input() {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    return is_array($json) ? $json : $_POST;
}

function requireAdmin() {
    if (empty($_SESSION['admin_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Not authenticated', 'error_code' => 'not_authenticated']);
        exit;
    }
}

function timeToMinutes($t) {
    $parts = explode(':', $t);
    return ((int)$parts[0]) * 60 + (int)$parts[1];
}
function minutesToTime($m) {
    return sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
}
function generateSlotTimes($openTime, $closeTime, $slotMinutes) {
    $slots = [];
    $t = timeToMinutes($openTime);
    $end = timeToMinutes($closeTime);
    while ($t < $end) {
        $slots[] = minutesToTime($t);
        $t += (int)$slotMinutes;
    }
    return $slots;
}
function normContact($c) {
    return strtolower(trim($c));
}
// A booking is 'completed' either because an admin marked it so directly,
// or automatically once a still-'pending' booking's date/time has passed.
function effectiveStatus($booking) {
    if ($booking['status'] === 'cancelled') return 'cancelled';
    if ($booking['status'] === 'completed') return 'completed';
    $bookingDt = $booking['date'] . ' ' . $booking['time'];
    $nowDt = date('Y-m-d H:i');
    return ($bookingDt < $nowDt) ? 'completed' : 'pending';
}
function newId() {
    return strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
}
function logoUrl(PDO $pdo) {
    $filename = getSetting($pdo, 'logo_filename', '');
    if ($filename === '') return null;
    $path = __DIR__ . '/../uploads/' . $filename;
    if (!file_exists($path)) return null;
    return 'uploads/' . $filename . '?v=' . filemtime($path);
}
function clientIp() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

$action = $_GET['action'] ?? '';
if ($action === '') {
    $body = input();
    $action = $body['action'] ?? '';
}

switch ($action) {

    // ================= PUBLIC =================

    case 'settings': {
        echo json_encode([
            'site_title'       => getSetting($pdo, 'site_title'),
            'site_title_bn'    => getSetting($pdo, 'site_title_bn'),
            'site_subtitle'    => getSetting($pdo, 'site_subtitle'),
            'site_subtitle_bn' => getSetting($pdo, 'site_subtitle_bn'),
            'open_time'        => getSetting($pdo, 'open_time'),
            'close_time'       => getSetting($pdo, 'close_time'),
            'slot_minutes'     => (int) getSetting($pdo, 'slot_minutes'),
            'capacity'         => (int) getSetting($pdo, 'capacity'),
            'closed_days'      => json_decode(getSetting($pdo, 'closed_days', '[]'), true),
            'open_mode'        => getSetting($pdo, 'open_mode', 'weekly'),
            'notice_enabled'   => getSetting($pdo, 'notice_enabled', '0') === '1',
            'notice_text'      => getSetting($pdo, 'notice_text', ''),
            'notice_text_bn'   => getSetting($pdo, 'notice_text_bn', ''),
            'logo_url'         => logoUrl($pdo),
        ]);
        break;
    }

    // Specific dates that ARE bookable when open_mode = 'selected_dates'.
    case 'open_dates': {
        $stmt = $pdo->prepare("SELECT date FROM open_dates WHERE date >= ? ORDER BY date ASC");
        $stmt->execute([date('Y-m-d')]);
        $dates = array_map(function($r){ return $r['date']; }, $stmt->fetchAll(PDO::FETCH_ASSOC));
        echo json_encode(['dates' => $dates]);
        break;
    }

    // Whole-day blocked dates (today or future) — used by the public
    // calendar to disable those dates entirely so visitors can't even
    // open them to see slots.
    case 'blocked_dates': {
        $stmt = $pdo->prepare("SELECT DISTINCT date FROM blocked_slots WHERE (time IS NULL OR time = '') AND date >= ?");
        $stmt->execute([date('Y-m-d')]);
        $dates = array_map(function($r){ return $r['date']; }, $stmt->fetchAll(PDO::FETCH_ASSOC));
        echo json_encode(['dates' => $dates]);
        break;
    }

    case 'slots': {
        $date = $_GET['date'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid date', 'error_code' => 'invalid_date']);
            break;
        }
        $openTime = getSetting($pdo, 'open_time');
        $closeTime = getSetting($pdo, 'close_time');
        $slotMinutes = (int) getSetting($pdo, 'slot_minutes');
        $capacity = (int) getSetting($pdo, 'capacity');
        $times = generateSlotTimes($openTime, $closeTime, $slotMinutes);

        $stmt = $pdo->prepare("SELECT time, COUNT(*) as c FROM bookings WHERE date = ? AND status != 'cancelled' GROUP BY time");
        $stmt->execute([$date]);
        $counts = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['time']] = (int) $row['c'];
        }

        $stmt2 = $pdo->prepare("SELECT time FROM blocked_slots WHERE date = ?");
        $stmt2->execute([$date]);
        $blockedRows = $stmt2->fetchAll(PDO::FETCH_ASSOC);
        $wholeDayBlocked = false;
        $blockedTimes = [];
        foreach ($blockedRows as $row) {
            if ($row['time'] === null || $row['time'] === '') {
                $wholeDayBlocked = true;
            } else {
                $blockedTimes[$row['time']] = true;
            }
        }

        $openMode = getSetting($pdo, 'open_mode', 'weekly');
        if ($openMode === 'selected_dates') {
            $stmt3 = $pdo->prepare("SELECT COUNT(*) FROM open_dates WHERE date = ?");
            $stmt3->execute([$date]);
            if ((int) $stmt3->fetchColumn() === 0) {
                $wholeDayBlocked = true;
            }
        } else {
            $closedDays = json_decode(getSetting($pdo, 'closed_days', '[]'), true);
            $dow = (int) date('w', strtotime($date));
            if (in_array($dow, $closedDays, true)) {
                $wholeDayBlocked = true;
            }
        }

        $result = [];
        foreach ($times as $t) {
            if ($wholeDayBlocked || isset($blockedTimes[$t])) {
                $status = 'blocked';
            } elseif (($counts[$t] ?? 0) >= $capacity) {
                $status = 'full';
            } else {
                $status = 'available';
            }
            $result[] = ['time' => $t, 'status' => $status];
        }
        echo json_encode(['slots' => $result, 'slot_minutes' => $slotMinutes, 'whole_day_blocked' => $wholeDayBlocked]);
        break;
    }

    case 'book': {
        $body = input();
        $name = trim($body['name'] ?? '');
        $contactType = ($body['contact_type'] ?? 'phone') === 'email' ? 'email' : 'phone';
        $contact = trim($body['contact'] ?? '');
        $date = $body['date'] ?? '';
        $time = $body['time'] ?? '';

        if ($name === '' || $contact === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing or invalid fields', 'error_code' => 'invalid_fields']);
            break;
        }

        $openMode = getSetting($pdo, 'open_mode', 'weekly');
        if ($openMode === 'selected_dates') {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM open_dates WHERE date = ?");
            $stmt->execute([$date]);
            if ((int) $stmt->fetchColumn() === 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Selected date is not open for booking', 'error_code' => 'date_not_open']);
                break;
            }
        } else {
            $closedDays = json_decode(getSetting($pdo, 'closed_days', '[]'), true);
            $dow = (int) date('w', strtotime($date));
            if (in_array($dow, $closedDays, true)) {
                http_response_code(400);
                echo json_encode(['error' => 'Selected date is closed', 'error_code' => 'date_closed']);
                break;
            }
        }
        if ($date < date('Y-m-d')) {
            http_response_code(400);
            echo json_encode(['error' => 'Selected date is in the past', 'error_code' => 'past_date']);
            break;
        }

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM blocked_users WHERE LOWER(TRIM(contact)) = ?");
        $stmt->execute([normContact($contact)]);
        if ((int) $stmt->fetchColumn() > 0) {
            http_response_code(403);
            echo json_encode(['error' => 'This contact is blocked from booking', 'error_code' => 'blocked_user']);
            break;
        }

        // A contact may only have ONE active (not yet completed, not cancelled)
        // appointment at a time. Once it's completed (its date/time has passed)
        // or cancelled, they can book again.
        $today = date('Y-m-d');
        $nowTime = date('H:i');
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE LOWER(TRIM(contact)) = ? AND status = 'pending' AND (date > ? OR (date = ? AND time >= ?))");
        $stmt->execute([normContact($contact), $today, $today, $nowTime]);
        if ((int) $stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'This contact already has a pending appointment. Please wait until it is completed before booking another.', 'error_code' => 'already_has_pending']);
            break;
        }

        $stmt = $pdo->prepare("SELECT time FROM blocked_slots WHERE date = ?");
        $stmt->execute([$date]);
        $wholeDayBlocked = false; $blockedTimes = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($row['time'] === null || $row['time'] === '') $wholeDayBlocked = true;
            else $blockedTimes[$row['time']] = true;
        }
        if ($wholeDayBlocked || isset($blockedTimes[$time])) {
            http_response_code(409);
            echo json_encode(['error' => 'This slot is unavailable', 'error_code' => 'slot_blocked']);
            break;
        }

        $capacity = (int) getSetting($pdo, 'capacity');
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE date = ? AND time = ? AND status != 'cancelled'");
        $stmt->execute([$date, $time]);
        if ((int) $stmt->fetchColumn() >= $capacity) {
            http_response_code(409);
            echo json_encode(['error' => 'This slot was just taken. Please choose another time.', 'error_code' => 'slot_full']);
            break;
        }

        $id = newId();
        $stmt = $pdo->prepare("INSERT INTO bookings (id, name, contact_type, contact, date, time, status, created_at, ip_address) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)");
        $stmt->execute([$id, $name, $contactType, $contact, $date, $time, date('c'), clientIp()]);

        echo json_encode(['success' => true, 'id' => $id]);
        break;
    }

    // ================= ADMIN AUTH =================

    case 'admin_login': {
        $body = input();
        $identifier = trim($body['identifier'] ?? '');
        $password = $body['password'] ?? '';
        if ($identifier === '' || $password === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Missing credentials', 'error_code' => 'invalid_fields']);
            break;
        }
        $norm = strtolower($identifier);
        $stmt = $pdo->prepare("SELECT * FROM admins WHERE LOWER(username) = ? OR LOWER(email) = ? OR phone = ?");
        $stmt->execute([$norm, $norm, trim($identifier)]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($admin && password_verify($password, $admin['password_hash'])) {
            $_SESSION['admin_id'] = $admin['id'];
            $_SESSION['admin_username'] = $admin['username'];
            echo json_encode(['success' => true, 'username' => $admin['username']]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Incorrect username/email/phone or password', 'error_code' => 'wrong_password']);
        }
        break;
    }

    case 'admin_check': {
        if (!empty($_SESSION['admin_id'])) {
            echo json_encode(['loggedIn' => true, 'username' => $_SESSION['admin_username'] ?? '']);
        } else {
            echo json_encode(['loggedIn' => false]);
        }
        break;
    }

    case 'admin_logout': {
        $_SESSION = [];
        session_destroy();
        echo json_encode(['success' => true]);
        break;
    }

    case 'admin_change_password': {
        requireAdmin();
        $body = input();
        $current = $body['current_password'] ?? '';
        $new = $body['new_password'] ?? '';
        if (strlen($new) < 4) {
            http_response_code(400);
            echo json_encode(['error' => 'New password is too short', 'error_code' => 'password_too_short']);
            break;
        }
        $stmt = $pdo->prepare("SELECT * FROM admins WHERE id = ?");
        $stmt->execute([$_SESSION['admin_id']]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$admin || !password_verify($current, $admin['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Current password is incorrect', 'error_code' => 'wrong_password']);
            break;
        }
        $stmt = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE id = ?");
        $stmt->execute([password_hash($new, PASSWORD_DEFAULT), $admin['id']]);
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: MANAGE ADMIN ACCOUNTS =================

    case 'admin_list_admins': {
        requireAdmin();
        $stmt = $pdo->query("SELECT id, username, email, phone, role, created_at FROM admins ORDER BY created_at ASC");
        echo json_encode(['admins' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        break;
    }

    case 'admin_add_admin': {
        requireAdmin();
        $body = input();
        $username = trim($body['username'] ?? '');
        $email = trim($body['email'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $password = $body['password'] ?? '';
        if ($username === '' || strlen($password) < 4) {
            http_response_code(400);
            echo json_encode(['error' => 'Username and a password (min 4 chars) are required', 'error_code' => 'invalid_fields']);
            break;
        }
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM admins WHERE LOWER(username) = ?");
        $stmt->execute([strtolower($username)]);
        if ((int) $stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'That username is already taken', 'error_code' => 'username_taken']);
            break;
        }
        $id = newId();
        $stmt = $pdo->prepare("INSERT INTO admins (id, username, email, phone, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, 'admin', ?)");
        $stmt->execute([$id, $username, $email ?: null, $phone ?: null, password_hash($password, PASSWORD_DEFAULT), date('c')]);
        echo json_encode(['success' => true, 'id' => $id]);
        break;
    }

    case 'admin_update_admin': {
        requireAdmin();
        $body = input();
        $id = $body['id'] ?? '';
        $username = trim($body['username'] ?? '');
        $email = trim($body['email'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $password = $body['password'] ?? '';

        $stmt = $pdo->prepare("SELECT * FROM admins WHERE id = ?");
        $stmt->execute([$id]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$admin) {
            http_response_code(404);
            echo json_encode(['error' => 'Admin not found', 'error_code' => 'not_found']);
            break;
        }
        if ($username === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Username is required', 'error_code' => 'invalid_fields']);
            break;
        }
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM admins WHERE LOWER(username) = ? AND id != ?");
        $stmt->execute([strtolower($username), $id]);
        if ((int) $stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'That username is already taken', 'error_code' => 'username_taken']);
            break;
        }

        if ($password !== '') {
            if (strlen($password) < 4) {
                http_response_code(400);
                echo json_encode(['error' => 'New password is too short', 'error_code' => 'password_too_short']);
                break;
            }
            $stmt = $pdo->prepare("UPDATE admins SET username = ?, email = ?, phone = ?, password_hash = ? WHERE id = ?");
            $stmt->execute([$username, $email ?: null, $phone ?: null, password_hash($password, PASSWORD_DEFAULT), $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE admins SET username = ?, email = ?, phone = ? WHERE id = ?");
            $stmt->execute([$username, $email ?: null, $phone ?: null, $id]);
        }
        if ($id === $_SESSION['admin_id']) {
            $_SESSION['admin_username'] = $username;
        }
        echo json_encode(['success' => true]);
        break;
    }

    case 'admin_delete_admin': {
        requireAdmin();
        $body = input();
        $id = $body['id'] ?? '';
        $count = (int) $pdo->query("SELECT COUNT(*) FROM admins")->fetchColumn();
        if ($count <= 1) {
            http_response_code(400);
            echo json_encode(['error' => 'At least one admin account must remain', 'error_code' => 'last_admin']);
            break;
        }
        $stmt = $pdo->prepare("DELETE FROM admins WHERE id = ?");
        $stmt->execute([$id]);
        if ($id === $_SESSION['admin_id']) {
            $_SESSION = [];
            session_destroy();
        }
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: BOOKINGS =================

    case 'admin_bookings': {
        requireAdmin();
        $date = trim($_GET['date'] ?? '');
        $search = trim($_GET['search'] ?? '');
        $tab = trim($_GET['tab'] ?? '');

        $where = [];
        $params = [];
        if ($tab === 'cancelled') { $where[] = "status = 'cancelled'"; }
        else if ($tab === 'pending') { $where[] = "status = 'pending'"; }
        else if ($tab === 'completed') { $where[] = "status IN ('pending', 'completed')"; }
        if ($date !== '') { $where[] = 'date = ?'; $params[] = $date; }
        if ($search !== '') {
            $where[] = '(id LIKE ? OR name LIKE ? OR contact LIKE ?)';
            $needle = '%' . $search . '%';
            $params[] = $needle; $params[] = $needle; $params[] = $needle;
        }

        $sql = "SELECT * FROM bookings";
        if ($where) $sql .= " WHERE " . implode(' AND ', $where);
        $sql .= " ORDER BY date DESC, time DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $out = [];
        foreach ($rows as $row) {
            $eff = effectiveStatus($row);
            if ($tab === 'pending' && $eff !== 'pending') continue;
            if ($tab === 'completed' && $eff !== 'completed') continue;
            $row['effective_status'] = $eff;
            $out[] = $row;
        }
        echo json_encode(['bookings' => $out]);
        break;
    }

    case 'cancel_booking': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    case 'restore_booking': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'pending' WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    case 'complete_booking': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'completed' WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    case 'delete_booking': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("DELETE FROM bookings WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: BLOCKED USERS =================

    case 'admin_blocked_users': {
        requireAdmin();
        $stmt = $pdo->query("SELECT * FROM blocked_users ORDER BY created_at DESC");
        echo json_encode(['blocked' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        break;
    }

    case 'admin_block_user': {
        requireAdmin();
        $body = input();
        $contact = trim($body['contact'] ?? '');
        $reason = trim($body['reason'] ?? '');
        if ($contact === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Contact is required', 'error_code' => 'invalid_fields']);
            break;
        }
        $id = newId();
        $stmt = $pdo->prepare("INSERT INTO blocked_users (id, contact, reason, created_at) VALUES (?, ?, ?, ?)");
        $stmt->execute([$id, $contact, $reason, date('c')]);
        echo json_encode(['success' => true, 'id' => $id]);
        break;
    }

    case 'admin_unblock_user': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("DELETE FROM blocked_users WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: BLOCKED SLOTS / DATES =================

    case 'admin_blocked_slots': {
        requireAdmin();
        $date = trim($_GET['date'] ?? '');
        if ($date !== '') {
            $stmt = $pdo->prepare("SELECT * FROM blocked_slots WHERE date = ? ORDER BY time IS NULL DESC, time ASC");
            $stmt->execute([$date]);
        } else {
            // Full overview across every date, whole-day blocks first.
            $stmt = $pdo->query("SELECT * FROM blocked_slots ORDER BY date ASC, time IS NULL DESC, time ASC");
        }
        echo json_encode(['blocked' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        break;
    }

    case 'admin_block_slot': {
        requireAdmin();
        $body = input();
        $date = trim($body['date'] ?? '');
        $time = trim($body['time'] ?? '');
        $reason = trim($body['reason'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid date', 'error_code' => 'invalid_date']);
            break;
        }
        $id = newId();
        $stmt = $pdo->prepare("INSERT INTO blocked_slots (id, date, time, reason, created_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$id, $date, $time === '' ? null : $time, $reason, date('c')]);
        echo json_encode(['success' => true, 'id' => $id]);
        break;
    }

    case 'admin_unblock_slot': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("DELETE FROM blocked_slots WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: OPEN DATES (selected_dates mode) =================

    case 'admin_open_dates': {
        requireAdmin();
        $stmt = $pdo->query("SELECT * FROM open_dates ORDER BY date ASC");
        echo json_encode(['open_dates' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        break;
    }

    case 'admin_add_open_date': {
        requireAdmin();
        $body = input();
        $date = trim($body['date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid date', 'error_code' => 'invalid_date']);
            break;
        }
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM open_dates WHERE date = ?");
        $stmt->execute([$date]);
        if ((int) $stmt->fetchColumn() > 0) {
            echo json_encode(['success' => true]); // already open, no-op
            break;
        }
        $id = newId();
        $stmt = $pdo->prepare("INSERT INTO open_dates (id, date, created_at) VALUES (?, ?, ?)");
        $stmt->execute([$id, $date, date('c')]);
        echo json_encode(['success' => true, 'id' => $id]);
        break;
    }

    case 'admin_remove_open_date': {
        requireAdmin();
        $body = input();
        $stmt = $pdo->prepare("DELETE FROM open_dates WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: LOGO =================

    case 'admin_upload_logo': {
        requireAdmin();
        if (empty($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No file uploaded or upload error', 'error_code' => 'invalid_fields']);
            break;
        }
        if ($_FILES['logo']['size'] > 2 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'Image must be smaller than 2MB', 'error_code' => 'file_too_large']);
            break;
        }
        $tmp = $_FILES['logo']['tmp_name'];
        $info = @getimagesize($tmp);
        if ($info === false) {
            http_response_code(400);
            echo json_encode(['error' => 'File is not a valid image', 'error_code' => 'invalid_image']);
            break;
        }
        $allowed = [
            IMAGETYPE_PNG  => 'png',
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_GIF  => 'gif',
            IMAGETYPE_WEBP => 'webp',
        ];
        if (!isset($allowed[$info[2]])) {
            http_response_code(400);
            echo json_encode(['error' => 'Only PNG, JPG, GIF, or WEBP images are allowed', 'error_code' => 'invalid_image_type']);
            break;
        }

        $uploadsDir = __DIR__ . '/../uploads';
        if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0775, true);
        foreach (glob($uploadsDir . '/logo.*') as $old) { @unlink($old); }

        $filename = 'logo.' . $allowed[$info[2]];
        if (!move_uploaded_file($tmp, $uploadsDir . '/' . $filename)) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not save the uploaded file', 'error_code' => 'upload_failed']);
            break;
        }
        setSetting($pdo, 'logo_filename', $filename);
        echo json_encode(['success' => true, 'logo_url' => logoUrl($pdo)]);
        break;
    }

    case 'admin_remove_logo': {
        requireAdmin();
        $uploadsDir = __DIR__ . '/../uploads';
        foreach (glob($uploadsDir . '/logo.*') as $old) { @unlink($old); }
        setSetting($pdo, 'logo_filename', '');
        echo json_encode(['success' => true]);
        break;
    }

    // ================= ADMIN: SETTINGS =================

    case 'admin_settings': {
        requireAdmin();
        echo json_encode([
            'site_title'       => getSetting($pdo, 'site_title'),
            'site_title_bn'    => getSetting($pdo, 'site_title_bn'),
            'site_subtitle'    => getSetting($pdo, 'site_subtitle'),
            'site_subtitle_bn' => getSetting($pdo, 'site_subtitle_bn'),
            'open_time'        => getSetting($pdo, 'open_time'),
            'close_time'       => getSetting($pdo, 'close_time'),
            'slot_minutes'     => (int) getSetting($pdo, 'slot_minutes'),
            'capacity'         => (int) getSetting($pdo, 'capacity'),
            'closed_days'      => json_decode(getSetting($pdo, 'closed_days', '[]'), true),
            'open_mode'        => getSetting($pdo, 'open_mode', 'weekly'),
            'notice_enabled'   => getSetting($pdo, 'notice_enabled', '0') === '1',
            'notice_text'      => getSetting($pdo, 'notice_text', ''),
            'notice_text_bn'   => getSetting($pdo, 'notice_text_bn', ''),
            'logo_url'         => logoUrl($pdo),
        ]);
        break;
    }

    case 'admin_settings_update': {
        requireAdmin();
        $body = input();
        $map = ['site_title','site_title_bn','site_subtitle','site_subtitle_bn','open_time','close_time','notice_text','notice_text_bn'];
        foreach ($map as $k) {
            if (isset($body[$k])) setSetting($pdo, $k, trim($body[$k]));
        }
        if (isset($body['slot_minutes'])) setSetting($pdo, 'slot_minutes', (string) max(1, (int)$body['slot_minutes']));
        if (isset($body['capacity'])) setSetting($pdo, 'capacity', (string) max(1, (int)$body['capacity']));
        if (isset($body['closed_days']) && is_array($body['closed_days'])) {
            setSetting($pdo, 'closed_days', json_encode(array_values(array_map('intval', $body['closed_days']))));
        }
        if (isset($body['open_mode']) && in_array($body['open_mode'], ['weekly','selected_dates'], true)) {
            setSetting($pdo, 'open_mode', $body['open_mode']);
        }
        if (isset($body['notice_enabled'])) {
            setSetting($pdo, 'notice_enabled', $body['notice_enabled'] ? '1' : '0');
        }
        echo json_encode(['success' => true]);
        break;
    }

    // ================= PUBLIC: TRACK BOOKING =================

    case 'track_booking': {
        $ref = trim($_GET['ref'] ?? '');
        $contact = trim($_GET['contact'] ?? '');
        if ($ref === '' && $contact === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Provide a booking number or contact', 'error_code' => 'invalid_fields']);
            break;
        }
        if ($ref !== '') {
            $stmt = $pdo->prepare("SELECT * FROM bookings WHERE UPPER(id) = ?");
            $stmt->execute([strtoupper($ref)]);
        } else {
            $stmt = $pdo->prepare("SELECT * FROM bookings WHERE LOWER(TRIM(contact)) = ? ORDER BY date DESC, time DESC");
            $stmt->execute([normContact($contact)]);
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['effective_status'] = effectiveStatus($row);
        }
        echo json_encode(['bookings' => $rows]);
        break;
    }

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action', 'error_code' => 'unknown_action']);
}
