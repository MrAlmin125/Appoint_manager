<?php
// db.php - database bootstrap. Reads php/config.php to decide whether
// to connect to MySQL (e.g. InfinityFree) or use a local SQLite file.

$config = require __DIR__ . '/config.php';
$driver = $config['driver'] ?? 'sqlite';

try {
    if ($driver === 'mysql') {
        $dsn = 'mysql:host=' . $config['host']
             . ';port=' . ($config['port'] ?? 3306)
             . ';dbname=' . $config['dbname']
             . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $config['user'], $config['pass'], [
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ]);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } else {
        $dataDir = __DIR__ . '/../data';
        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0775, true);
        }
        $dbPath = $dataDir . '/appointments.db';
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'Could not connect to database: ' . $e->getMessage()]));
}

if ($driver === 'mysql') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        `key`   VARCHAR(64) PRIMARY KEY,
        `value` TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
        id            VARCHAR(32)  PRIMARY KEY,
        username      VARCHAR(100) NOT NULL,
        email         VARCHAR(255),
        phone         VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(20)  NOT NULL DEFAULT 'admin',
        created_at    VARCHAR(32)  NOT NULL,
        UNIQUE KEY uniq_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS bookings (
        id           VARCHAR(32)  PRIMARY KEY,
        name         VARCHAR(255) NOT NULL,
        contact_type VARCHAR(10)  NOT NULL,
        contact      VARCHAR(255) NOT NULL,
        date         VARCHAR(10)  NOT NULL,
        time         VARCHAR(5)   NOT NULL,
        status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
        created_at   VARCHAR(32)  NOT NULL,
        ip_address   VARCHAR(64),
        INDEX idx_date_time (date, time),
        INDEX idx_name (name),
        INDEX idx_contact (contact)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS blocked_users (
        id         VARCHAR(32)  PRIMARY KEY,
        contact    VARCHAR(255) NOT NULL,
        reason     VARCHAR(255),
        created_at VARCHAR(32)  NOT NULL,
        INDEX idx_bu_contact (contact)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS blocked_slots (
        id         VARCHAR(32)  PRIMARY KEY,
        date       VARCHAR(10)  NOT NULL,
        time       VARCHAR(5)   NULL,
        reason     VARCHAR(255),
        created_at VARCHAR(32)  NOT NULL,
        INDEX idx_bs_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS open_dates (
        id         VARCHAR(32) PRIMARY KEY,
        date       VARCHAR(10) NOT NULL,
        created_at VARCHAR(32) NOT NULL,
        UNIQUE KEY uniq_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT
    )");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username ON admins (username)");

    $pdo->exec("CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        name TEXT,
        contact_type TEXT,
        contact TEXT,
        date TEXT,
        time TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT,
        ip_address TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS blocked_users (
        id TEXT PRIMARY KEY,
        contact TEXT,
        reason TEXT,
        created_at TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS blocked_slots (
        id TEXT PRIMARY KEY,
        date TEXT,
        time TEXT,
        reason TEXT,
        created_at TEXT
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS open_dates (
        id TEXT PRIMARY KEY,
        date TEXT,
        created_at TEXT
    )");
    $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_open_dates_date ON open_dates (date)");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings (date, time)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_bu_contact ON blocked_users (contact)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_bs_date ON blocked_slots (date)");
}

// Adds a column to an existing table if it isn't already there. Needed
// because CREATE TABLE IF NOT EXISTS does nothing to a table that
// already exists — this is how older, already-deployed databases pick
// up new columns without the admin having to run anything manually.
function ensureColumn(PDO $pdo, string $driver, string $table, string $column, string $definition) {
    if ($driver === 'mysql') {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?");
        $stmt->execute([$table, $column]);
        $exists = (int) $stmt->fetchColumn() > 0;
    } else {
        $cols = array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC), 'name');
        $exists = in_array($column, $cols, true);
    }
    if (!$exists) {
        $pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
    }
}
ensureColumn($pdo, $driver, 'bookings', 'ip_address', $driver === 'mysql' ? 'VARCHAR(64)' : 'TEXT');

function getSetting(PDO $pdo, string $key, $default = null) {
    $stmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = ?");
    $stmt->execute([$key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? $row['value'] : $default;
}

function setSetting(PDO $pdo, string $key, string $value) {
    global $driver;
    if ($driver === 'mysql') {
        $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    } else {
        $stmt = $pdo->prepare("INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    }
    $stmt->execute([$key, $value]);
}

// Seed default settings on first run
$defaults = [
    'site_title'       => 'Appointment Office',
    'site_title_bn'    => 'অ্যাপয়েন্টমেন্ট অফিস',
    'site_subtitle'    => 'Book your visit online',
    'site_subtitle_bn' => 'অনলাইনে আপনার সাক্ষাতের সময় বুক করুন',
    'open_time'        => '09:00',
    'close_time'       => '14:00',
    'slot_minutes'     => '5',
    'capacity'         => '1',
    'closed_days'      => '[5,6]', // Fri, Sat closed by default
    'open_mode'        => 'weekly', // 'weekly' or 'selected_dates'
    'notice_enabled'   => '0',
    'notice_text'      => '',
    'notice_text_bn'   => '',
    'logo_filename'    => '',
];
foreach ($defaults as $k => $v) {
    if (getSetting($pdo, $k, null) === null) {
        setSetting($pdo, $k, $v);
    }
}

// Seed a default admin account on first run (or if the admins table is
// somehow empty, e.g. migrating from an older version of this app that
// only had a single shared site password).
$adminCount = (int) $pdo->query("SELECT COUNT(*) FROM admins")->fetchColumn();
if ($adminCount === 0) {
    $legacyPassword = getSetting($pdo, 'admin_password', 'admin123');
    $id = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
    $stmt = $pdo->prepare("INSERT INTO admins (id, username, email, phone, password_hash, role, created_at) VALUES (?, 'admin', NULL, NULL, ?, 'admin', ?)");
    $stmt->execute([$id, password_hash($legacyPassword, PASSWORD_DEFAULT), date('c')]);
}
