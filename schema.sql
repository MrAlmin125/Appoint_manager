-- phpMyAdmin SQL Dump
-- version 4.9.0.1
-- https://www.phpmyadmin.net/
--
-- Host: sql110.infinityfree.com
-- Generation Time: Sep 06, 2026 at 03:17 AM
-- Server version: 11.4.13-MariaDB
-- PHP Version: 7.2.22

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `if0_40706792_appointment`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` varchar(32) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'admin',
  `created_at` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `username`, `email`, `phone`, `password_hash`, `role`, `created_at`) VALUES
('77DC3704', 'Admin', NULL, NULL, '$2y$10$usz1c.wDpcddT0jfl1J4neqjgr2/aMJfcR40NYPd7xG1OWh1B36KG', 'admin', '2026-09-03T03:24:07-04:00');

-- --------------------------------------------------------

--
-- Table structure for table `blocked_slots`
--

CREATE TABLE `blocked_slots` (
  `id` varchar(32) NOT NULL,
  `date` varchar(10) NOT NULL,
  `time` varchar(5) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `blocked_users`
--

CREATE TABLE `blocked_users` (
  `id` varchar(32) NOT NULL,
  `contact` varchar(255) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` varbinary(32) NOT NULL,
  `name` varbinary(255) NOT NULL,
  `contact_type` varbinary(10) NOT NULL,
  `contact` varbinary(255) NOT NULL,
  `date` varbinary(10) NOT NULL,
  `time` varbinary(5) NOT NULL,
  `status` varbinary(20) NOT NULL DEFAULT 'confirmed',
  `created_at` varbinary(32) NOT NULL,
  `ip_address` varchar(64) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `open_dates`
--

CREATE TABLE `open_dates` (
  `id` varchar(32) NOT NULL,
  `date` varchar(10) NOT NULL,
  `created_at` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `key` varbinary(64) NOT NULL,
  `value` blob DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`key`, `value`) VALUES
(0x6361706163697479, 0x31),
(0x636c6f73655f74696d65, 0x31343a3030),
(0x636c6f7365645f64617973, 0x5b352c362c312c335d),
(0x6c6f676f5f66696c656e616d65, 0x6c6f676f2e6a7067),
(0x6e6f746963655f656e61626c6564, 0x30),
(0x6e6f746963655f74657874, ''),
(0x6e6f746963655f746578745f626e, ''),
(0x6f70656e5f6d6f6465, 0x7765656b6c79),
(0x6f70656e5f74696d65, 0x30393a3030),
(0x736974655f7375627469746c65, 0x426f6f6b20796f7572207669736974206f6e6c696e65),
(0x736974655f7375627469746c655f626e, 0xe0a685e0a6a8e0a6b2e0a6bee0a687e0a6a8e0a78720e0a686e0a6aae0a6a8e0a6bee0a6b020e0a6b8e0a6bee0a695e0a78de0a6b7e0a6bee0a6a4e0a787e0a6b020e0a6b8e0a6aee0a6afe0a6bc20e0a6ace0a781e0a69520e0a695e0a6b0e0a781e0a6a8),
(0x736974655f7469746c65, 0x4170706f696e746d656e74204f6666696365),
(0x736974655f7469746c655f626e, 0xe0a685e0a78de0a6afe0a6bee0a6aae0a6afe0a6bce0a787e0a6a8e0a78de0a69fe0a6aee0a787e0a6a8e0a78de0a69f20e0a685e0a6abe0a6bfe0a6b8),
(0x736c6f745f6d696e75746573, 0x3330);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_username` (`username`),
  ADD UNIQUE KEY `idx_admins_username` (`username`);

--
-- Indexes for table `blocked_slots`
--
ALTER TABLE `blocked_slots`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bs_date` (`date`),
  ADD KEY `idx_blocked_slots_date` (`date`);

--
-- Indexes for table `blocked_users`
--
ALTER TABLE `blocked_users`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bu_contact` (`contact`),
  ADD KEY `idx_blocked_users_contact` (`contact`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bookings_date_time` (`date`,`time`),
  ADD KEY `idx_bookings_name` (`name`),
  ADD KEY `idx_bookings_contact` (`contact`);

--
-- Indexes for table `open_dates`
--
ALTER TABLE `open_dates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_open_dates_date` (`date`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`key`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
