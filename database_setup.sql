-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 30, 2025 at 03:47 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `poultry marketplace`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_sessions`
--

CREATE TABLE `admin_sessions` (
  `id` int(11) NOT NULL,
  `admin_id` char(36) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_sessions`
--

INSERT INTO `admin_sessions` (`id`, `admin_id`, `session_token`, `created_at`, `expires_at`) VALUES
(1, '550e8400-e29b-41d4-a716-446655440099', '1c50cf9feb2ff391d77dfdb591974e97dae861f4fca0e6e6ca7055575038d9db', '2025-07-22 13:56:21', '2025-07-23 13:56:21'),
(2, '550e8400-e29b-41d4-a716-446655440099', '03899e2df12bb683f8a931a1244caf7cc8cb103f0f8fe96bafd89b72f421f896', '2025-07-22 13:57:13', '2025-07-23 13:57:13'),
(3, '550e8400-e29b-41d4-a716-446655440099', '33cee08c4aa930f6c3e6a531e45ca6993fe93fea2f1a8b1021a9be4b97f7496d', '2025-07-22 14:15:51', '2025-07-23 14:15:51'),
(4, '550e8400-e29b-41d4-a716-446655440099', '034dae42004998099e8054d4c558b437890a2cf8823ec3a136dade46e422c07b', '2025-07-22 14:59:30', '2025-07-23 14:59:30'),
(5, '550e8400-e29b-41d4-a716-446655440099', '799eed1e5b3849e770d3d79ddd728b6fe1cd26f1f57b8582bb02cb5509702509', '2025-07-23 08:21:50', '2025-07-24 08:21:50'),
(6, '550e8400-e29b-41d4-a716-446655440099', 'ca87849a6902723756f4b0fe68fa6500b6bfaec543bc51662ec19ac82e670ef5', '2025-07-23 08:22:47', '2025-07-24 08:22:47'),
(7, '550e8400-e29b-41d4-a716-446655440099', '9d2fb1ae76bd696c3699c6578e8b6863066404970ed5296a3d2da00428d21c82', '2025-07-23 08:42:19', '2025-07-24 08:42:19'),
(8, '550e8400-e29b-41d4-a716-446655440099', '4707cd5329025193212e3b4ddf3dae62ab5d6a5c93a388967c3b541e25546a8b', '2025-07-23 08:46:53', '2025-07-24 08:46:53'),
(9, '550e8400-e29b-41d4-a716-446655440099', '4d931cf5f797b3737dd529984453109aa89d16c4f0b5e6ae3f7813791204e5f2', '2025-07-23 09:09:19', '2025-07-24 09:09:19'),
(10, '550e8400-e29b-41d4-a716-446655440099', 'd431bd7f63ad4a11e0c5e974fa05477ca641b0d17d84955109c4bb4ca6d45b63', '2025-07-23 09:24:34', '2025-07-24 09:24:34'),
(11, '550e8400-e29b-41d4-a716-446655440099', 'c2a727950403896ad300a85fb9e4863fc8b47094cace3d810a51de05f343e2c2', '2025-07-23 09:37:22', '2025-07-24 09:37:22'),
(12, '550e8400-e29b-41d4-a716-446655440099', '8f20ef2cb47b52497e04ed6e693daa3472f31a4f71db9754a387266188daa659', '2025-07-23 10:24:50', '2025-07-24 10:24:50'),
(13, '550e8400-e29b-41d4-a716-446655440099', '6691d8789f2c4f499b08c43a66756996c6cd0675cd44b8daf204cd570ff633d8', '2025-07-23 10:38:36', '2025-07-24 10:38:36'),
(14, '550e8400-e29b-41d4-a716-446655440099', '292e0b8899c5709cb67d7e2a262fd3ccc35e4376a51984eed9faef5d57f3c241', '2025-07-23 11:17:07', '2025-07-24 11:17:07'),
(15, '550e8400-e29b-41d4-a716-446655440099', '0d66601683a11d861e4e7a99d247080592623f81a0afbd10e3d83586fa2825c5', '2025-07-23 11:31:07', '2025-07-24 11:31:07'),
(16, '550e8400-e29b-41d4-a716-446655440099', 'ff7b6ac497d55e3fc7dad1355df563951dc6afe6fc35c30717798a546f3a8ce9', '2025-07-23 11:40:33', '2025-07-24 11:40:33'),
(17, '550e8400-e29b-41d4-a716-446655440099', '86d5e48a9a999be7671eff0e08849c365319ebe60b5fd562b52bf0c839fbc484', '2025-07-23 14:24:12', '2025-07-24 14:24:12'),
(18, '550e8400-e29b-41d4-a716-446655440099', '84f2eb982445d39e1166370428679f020a96087e8ea94629faf5ce5903b2f670', '2025-08-01 11:40:40', '2025-08-02 11:40:40'),
(19, '550e8400-e29b-41d4-a716-446655440099', '90c44d3b129f8c06ee07342b3e6325db2409d9f12e38514f45269ccf971f1248', '2025-08-12 15:27:02', '2025-08-13 15:27:02'),
(20, '550e8400-e29b-41d4-a716-446655440099', '191bb8f52a7407e5d00dfa513bc0e94c6778a5963e83ca57b2e95c7e84456837', '2025-09-16 11:44:24', '2025-09-17 11:44:24'),
(21, '550e8400-e29b-41d4-a716-446655440099', '361c44c4bed21a43881ddb8abe68880095340348727f8fa76deeb62ab694eb25', '2025-09-16 11:46:42', '2025-09-17 11:46:42');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` char(36) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `user_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `quantity` int(11) NOT NULL,
  `status` enum('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','completed','failed') DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` char(36) NOT NULL,
  `vendor_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `category` enum('chickens','eggs','feed','equipment','medicine','chicks') NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `unit` varchar(50) DEFAULT 'piece',
  `image_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`image_urls`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_profiles`
--

CREATE TABLE `user_profiles` (
  `id` char(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` enum('customer','vendor','admin') DEFAULT 'customer',
  `avatar_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_profiles`
--

INSERT INTO `user_profiles` (`id`, `email`, `password`, `full_name`, `phone`, `role`, `avatar_url`, `created_at`, `updated_at`) VALUES
('3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'martin23@gmail.com', '$2b$10$wLtZV90wQykI352XWOAMX.HZ22GTWIX8w5hltv1pbwNkT/mePvBce', 'Martin', '0799422634', 'vendor', NULL, '2025-07-23 10:23:31', '2025-07-23 10:23:31'),
('550e8400-e29b-41d4-a716-446655440099', 'kothroni863@gmail.com', '$2b$10$FVKNqkmQwjPMgM4WIK.6QunWHqOEjC8UopoJfpY8we2uLWuY/as9S', 'Ronald Admin ', '+254799422637', 'admin', NULL, '2025-07-22 13:30:23', '2025-07-22 13:55:41'),
('ab315ee5-079a-4562-87be-d3826b368964', 'okothroni863@gmail.com', '$2b$10$n.Wy57yIhnbDiBYfsD/3ae2kNwvlGmmCXLXF1MjJ3d1L.AR8QmEJ6', 'Steve Ronald', '0799422635', 'customer', NULL, '2025-07-21 21:37:17', '2025-07-21 21:37:17'),
('b38e7a24-77b1-4f5d-b6cb-035f68f32c55', 'charlesonyango011@Gmail.com', '$2b$10$.S9Xl.7KvtnVqIspGDsjjeQhcOfu81MwH53.TgGrZ0CeVLKh7VJJW', 'charles otieno onyango', '0743686405', 'customer', NULL, '2025-08-12 15:15:50', '2025-08-12 15:15:50');

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `farm_name` varchar(255) NOT NULL,
  `farm_description` text DEFAULT NULL,
  `location` varchar(255) NOT NULL,
  `id_number` varchar(20) DEFAULT NULL,
  `status` enum('pending','approved','rejected','suspended') DEFAULT 'approved',
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendors`
--

INSERT INTO `vendors` (`id`, `user_id`, `farm_name`, `farm_description`, `location`, `id_number`, `status`, `approved_at`, `approved_by`, `created_at`, `updated_at`) VALUES
('ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'Martin\'s Poultry Farm', 'sells poultry product', 'Nairobi', '23467587', 'pending', NULL, NULL, '2025-07-23 10:23:31', '2025-08-01 11:44:10');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `admin_id` (`admin_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `vendor_id` (`vendor_id`);

--
-- Indexes for table `user_profiles`
--
ALTER TABLE `user_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD CONSTRAINT `admin_sessions_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `vendors`
--
ALTER TABLE `vendors`
  ADD CONSTRAINT `vendors_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
