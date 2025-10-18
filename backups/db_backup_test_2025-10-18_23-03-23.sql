-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: poultry marketplace
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_sessions`
--

DROP TABLE IF EXISTS `admin_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` char(36) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `csrf_token` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `admin_id` (`admin_id`),
  KEY `idx_admin_csrf_token` (`csrf_token`),
  CONSTRAINT `admin_sessions_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_sessions`
--

LOCK TABLES `admin_sessions` WRITE;
/*!40000 ALTER TABLE `admin_sessions` DISABLE KEYS */;
INSERT INTO `admin_sessions` VALUES (65,'550e8400-e29b-41d4-a716-446655440099','e25ce0772f911510c565fad268f00709f5659478c5d42641f5ada59eb3e3989a',NULL,'2025-10-17 16:56:48','2025-10-18 16:56:48','2025-10-17 16:56:48'),(66,'550e8400-e29b-41d4-a716-446655440099','0e139a9f5377a5560d31837be98ba8caf2f52675bd069c86b8102f534acde0ac',NULL,'2025-10-17 17:06:19','2025-10-18 17:06:19','2025-10-17 17:06:19'),(67,'550e8400-e29b-41d4-a716-446655440099','c162fcb6e2f7319461100499eb484356724265b67a55f9c33ea4222dadd7c80e',NULL,'2025-10-17 17:06:54','2025-10-18 17:06:54','2025-10-17 17:06:54'),(68,'550e8400-e29b-41d4-a716-446655440099','f6972ec1f03d7c43d21b95a621159b8d641c65410a68ffacb22389887649bdc3',NULL,'2025-10-18 14:08:05','2025-10-19 14:08:05','2025-10-18 14:08:05'),(71,'550e8400-e29b-41d4-a716-446655440099','8a24dece0ff3f69765a03c1f2a5f4006bb8210705da6d85bd1f11bd12d00e4be',NULL,'2025-10-18 14:57:42','2025-10-19 14:57:42','2025-10-18 14:57:42'),(76,'550e8400-e29b-41d4-a716-446655440099','e5d482d876cc1d9190ec9fc9c28f51b1e0fb69440dbdd0af0b621beecc5185be',NULL,'2025-10-18 20:38:44','2025-10-19 20:38:44','2025-10-18 20:38:44');
/*!40000 ALTER TABLE `admin_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backup_logs`
--

DROP TABLE IF EXISTS `backup_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `backup_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('full','incremental') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `local_path` varchar(500) DEFAULT NULL,
  `google_drive_id` varchar(255) DEFAULT NULL,
  `file_size` bigint(20) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backup_logs`
--

LOCK TABLES `backup_logs` WRITE;
/*!40000 ALTER TABLE `backup_logs` DISABLE KEYS */;
INSERT INTO `backup_logs` VALUES (1,'full','full_backup_2025-10-18_21-39-08.sql.gz','C:\\xampp\\htdocs\\poultry-hub-kenya\\backend\\utils/../backups/full_backup_2025-10-18_21-39-08.sql.gz',NULL,6618,'2025-10-18 19:39:11');
/*!40000 ALTER TABLE `backup_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backup_settings`
--

DROP TABLE IF EXISTS `backup_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `backup_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backup_settings`
--

LOCK TABLES `backup_settings` WRITE;
/*!40000 ALTER TABLE `backup_settings` DISABLE KEYS */;
INSERT INTO `backup_settings` VALUES (1,'auto_backup_enabled','1','2025-10-18 20:44:45'),(2,'auto_backup_frequency','daily','2025-10-18 20:44:45'),(3,'auto_backup_time','02:00','2025-10-18 20:44:45'),(4,'max_backups','30','2025-10-18 20:44:45'),(5,'backup_retention_days','30','2025-10-18 20:44:45'),(6,'backup_notifications','1','2025-10-18 20:44:45');
/*!40000 ALTER TABLE `backup_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cart`
--

DROP TABLE IF EXISTS `cart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cart` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_product` (`user_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `cart_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart`
--

LOCK TABLES `cart` WRITE;
/*!40000 ALTER TABLE `cart` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contact_messages`
--

DROP TABLE IF EXISTS `contact_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `message` text NOT NULL,
  `status` enum('new','read','replied') DEFAULT 'new',
  `admin_reply` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contact_messages`
--

LOCK TABLES `contact_messages` WRITE;
/*!40000 ALTER TABLE `contact_messages` DISABLE KEYS */;
INSERT INTO `contact_messages` VALUES (1,'Steve Ronald','okothroni863@gmail.com','0799422635','order','customer','how is the process of ordering','replied','visit our products page and make you order','2025-10-01 10:56:29','2025-10-01 11:11:36'),(2,'Ezekiel Malova','ezekielbusolo@gmail.com','0708751060','allocation','customer','how','replied','working ot it','2025-10-07 13:54:29','2025-10-07 14:08:11'),(4,'Martin','okothsteve863@gmail.com','0743686405','order','customer','How is the company doing in terms of order delivery','replied','So far we are doing great ','2025-10-17 13:09:28','2025-10-18 20:32:51');
/*!40000 ALTER TABLE `contact_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,'550e8400-e29b-41d4-a716-446655440099','Welcome to Poultry Hub Kenya! Your account has been set up successfully.',1,'2025-09-30 14:32:08'),(2,'550e8400-e29b-41d4-a716-446655440099','New vendor application received from Martin\'s Poultry Farm.',1,'2025-09-30 14:32:08'),(3,'550e8400-e29b-41d4-a716-446655440099','System maintenance scheduled for tomorrow at 2 AM.',1,'2025-09-30 14:32:08'),(4,'550e8400-e29b-41d4-a716-446655440099','Test notification: New user registered - John Doe',0,'2025-09-30 16:35:16'),(5,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','Your product \'Test Product\' has been rejected. Reason: Product disapproved by admin',1,'2025-09-30 16:35:56'),(6,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','Your product \'Test Product\' has been approved and is now live!',1,'2025-09-30 16:36:24'),(7,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251001-861F99 with 1 item(s). Please check your vendor dashboard.',1,'2025-10-01 13:44:44'),(8,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251001-861F99 has been placed with 1 item(s). Total amount: KSH 300.00',0,'2025-10-01 13:44:44'),(9,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251001-69405D with 1 item(s). Please check your vendor dashboard.',1,'2025-10-01 14:14:52'),(10,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251001-69405D has been placed with 1 item(s). Total amount: KSH 150.00',0,'2025-10-01 14:14:52'),(11,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251001-CDF59B with 1 item(s). Please check your vendor dashboard.',1,'2025-10-01 14:27:30'),(12,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251001-CDF59B has been placed with 1 item(s). Total amount: KSH 150.00',0,'2025-10-01 14:27:30'),(13,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251002-FA602E with 1 item(s). Please check your vendor dashboard.',1,'2025-10-02 11:46:23'),(14,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251002-FA602E has been placed with 1 item(s). Total amount: KSH 450.00',0,'2025-10-02 11:46:23'),(15,'550e8400-e29b-41d4-a716-446655440099','New contact message from Ezekiel Malova: allocation',0,'2025-10-07 13:54:29'),(16,'550e8400-e29b-41d4-a716-446655440099','New product submitted: \'chicken\' by Martin\'s Poultry Farm',0,'2025-10-07 14:14:38'),(17,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','Your product \'chicken\' has been approved and is now live!',1,'2025-10-07 14:15:17'),(18,'550e8400-e29b-41d4-a716-446655440099','New customer registered: Ezekiel Malova',0,'2025-10-07 14:46:01'),(19,'550e8400-e29b-41d4-a716-446655440099','New contact message from Steve Okoth: Product approval ',0,'2025-10-07 16:15:10'),(20,'550e8400-e29b-41d4-a716-446655440099','New customer registered: DIANA ANYANGO',0,'2025-10-07 16:25:31'),(21,'550e8400-e29b-41d4-a716-446655440099','New product submitted: \'Hen\' by Martin\'s Poultry Farm',0,'2025-10-07 16:29:00'),(22,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','Your product \'Hen\' has been approved and is now live!',1,'2025-10-07 16:29:24'),(23,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251007-B27835 with 1 item(s). Please check your vendor dashboard.',1,'2025-10-07 16:33:49'),(24,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251007-B27835 has been placed with 1 item(s). Total amount: KSH 800.00',0,'2025-10-07 16:33:49'),(25,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251007-52FF55 with 1 item(s). Please check your vendor dashboard.',1,'2025-10-07 18:17:57'),(26,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251007-52FF55 has been placed with 1 item(s). Total amount: KSH 150.00',0,'2025-10-07 18:17:57'),(27,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','You have received a new order #ORD-20251007-CAFED7 with 1 item(s). Please check your vendor dashboard.',1,'2025-10-07 18:42:52'),(28,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251007-CAFED7 has been placed with 1 item(s). Total amount: KSH 100.50',0,'2025-10-07 18:42:52'),(29,'550e8400-e29b-41d4-a716-446655440099','New vendor registered: charles otieno onyango (Chalse)',0,'2025-10-09 10:47:31'),(30,'550e8400-e29b-41d4-a716-446655440099','New product submitted: \'Hen\' by Chalse',0,'2025-10-09 10:48:19'),(31,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','Congratulations! Your vendor account \'Martin\'s Poultry Farm\' has been approved. You can now start selling products!',1,'2025-10-09 10:55:47'),(32,'68e792c347af3','Your product \'Hen\' has been approved and is now live!',1,'2025-10-09 10:56:04'),(33,'68e792c347af3','Congratulations! Your vendor account \'Chalse\' has been approved. You can now start selling products!',1,'2025-10-09 10:56:20'),(34,'68e792c347af3','You have received a new order #ORD-20251009-424333 with 1 item(s). Please check your vendor dashboard.',1,'2025-10-09 11:20:28'),(35,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251009-424333 has been placed with 1 item(s). Total amount: KSH 400.00',0,'2025-10-09 11:20:28'),(36,'68e792c347af3','You have received a new order #ORD-20251011-C71E5B with 1 item(s). Please check your vendor dashboard.',1,'2025-10-11 11:56:07'),(37,'550e8400-e29b-41d4-a716-446655440099','New order #ORD-20251011-C71E5B has been placed with 1 item(s). Total amount: KSH 400.00',0,'2025-10-11 11:56:07'),(38,'550e8400-e29b-41d4-a716-446655440099','New contact message from Martin: order',0,'2025-10-17 13:09:28'),(39,'68e53efb315fe','Your order #ORD-20251007-52FF55 status has been updated to: processing',0,'2025-10-18 18:57:38'),(40,'550e8400-e29b-41d4-a716-446655440099','Vendor updated order #ORD-20251007-52FF55 status to \'processing\' for customer \'DIANA ANYANGO\'',0,'2025-10-18 18:57:38'),(41,'ab315ee5-079a-4562-87be-d3826b368964','Your order #ORD-20251001-CDF59B status has been updated to: processing',0,'2025-10-18 18:57:59'),(42,'550e8400-e29b-41d4-a716-446655440099','Vendor updated order #ORD-20251001-CDF59B status to \'processing\' for customer \'Steve Ronald\'',0,'2025-10-18 18:57:59');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `quantity` int(11) NOT NULL,
  `status` enum('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  `status_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_status_updated` timestamp NOT NULL DEFAULT current_timestamp(),
  `order_number` varchar(20) DEFAULT NULL,
  `vendor_id` varchar(36) DEFAULT NULL,
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `payment_status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `payment_method` enum('mpesa','bank','paypal') DEFAULT 'mpesa',
  `shipping_address` text DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `order_type` enum('direct','cart') DEFAULT 'direct',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `product_id` (`product_id`),
  KEY `orders_vendor_fk` (`vendor_id`),
  KEY `idx_order_number` (`order_number`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `orders_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (7,'ab315ee5-079a-4562-87be-d3826b368964','68dbf4fdd006b',1,'confirmed',NULL,'2025-10-01 12:44:05','2025-10-18 16:37:06','2025-10-18 16:37:06','TEST-20251001-51910F','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',150.00,'paid','mpesa','Test address','1234567890','Test single product order','direct'),(8,'ab315ee5-079a-4562-87be-d3826b368964','68dbf4fdd006b',2,'processing',NULL,'2025-10-01 12:44:05','2025-10-09 16:52:16','2025-10-18 16:03:17','TEST-20251001-51C60C','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',300.00,'paid','mpesa','Test address','1234567890','Test multi-product order - item 1','direct'),(12,'ab315ee5-079a-4562-87be-d3826b368964','68dbf4fdd006b',1,'confirmed',NULL,'2025-10-01 12:49:41','2025-10-07 16:22:08','2025-10-18 16:03:17','ORD-20251001-576304','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',150.00,'paid','mpesa','123 Test Street, Nairobi','0712345678','Quick order test','direct'),(14,'ab315ee5-079a-4562-87be-d3826b368964','68dbfb39dca96',3,'confirmed',NULL,'2025-10-01 13:03:42','2025-10-01 13:35:54','2025-10-18 16:03:17','ORD-20251001-EBF40D','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',301.50,'paid','mpesa','ed','555555','','cart'),(15,'ab315ee5-079a-4562-87be-d3826b368964','68dbf4fdd006b',2,'confirmed',NULL,'2025-10-01 13:44:40','2025-10-10 08:26:57','2025-10-18 16:03:17','ORD-20251001-861F99','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',300.00,'paid','mpesa','moi university','dddd','Quick order from products page','direct'),(16,'ab315ee5-079a-4562-87be-d3826b368964','68dbf4fdd006b',1,'confirmed',NULL,'2025-10-01 14:14:46','2025-10-09 15:06:34','2025-10-18 16:03:17','ORD-20251001-69405D','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',150.00,'paid','mpesa','eldoret','0799422635','','cart'),(17,'ab315ee5-079a-4562-87be-d3826b368964','68dbf4fdd006b',1,'processing',NULL,'2025-10-01 14:27:24','2025-10-18 18:57:59','2025-10-18 18:57:59','ORD-20251001-CDF59B','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',150.00,'paid','paypal','eldoret','0799422635','from cart','cart'),(18,'3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','68dbf4fdd006b',3,'shipped',NULL,'2025-10-02 11:46:07','2025-10-07 15:08:26','2025-10-18 16:03:17','ORD-20251002-FA602E','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',450.00,'paid','paypal','mamboleo','0787678756','Quick order from products page','direct'),(19,'68e53efb315fe','68e53fcc61b78',1,'confirmed',NULL,'2025-10-07 16:33:31','2025-10-09 15:06:29','2025-10-18 16:03:17','ORD-20251007-B27835','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',800.00,'paid','mpesa','Cheros','0111507107','Quick order from products page','direct'),(20,'68e53efb315fe','68dbf4fdd006b',1,'processing',NULL,'2025-10-07 18:17:41','2025-10-18 18:57:38','2025-10-18 18:57:38','ORD-20251007-52FF55','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',150.00,'paid','mpesa','Cheros','0111507107','Plz let it be on time','direct'),(21,'ab315ee5-079a-4562-87be-d3826b368964','68dbfb39dca96',1,'processing',NULL,'2025-10-07 18:42:36','2025-10-17 13:12:41','2025-10-18 16:03:17','ORD-20251007-CAFED7','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',100.50,'paid','mpesa','Stage moi','0799876756','Quick order from products page','direct'),(22,'ab315ee5-079a-4562-87be-d3826b368964','68e792f3c8aca',1,'delivered',NULL,'2025-10-09 11:20:20','2025-10-09 16:52:34','2025-10-18 16:03:17','ORD-20251009-424333','68e792c348475',400.00,'paid','mpesa','mamboleo','078968675','Quick order from products page','direct'),(23,'68e53efb315fe','68e792f3c8aca',1,'delivered',NULL,'2025-10-11 11:55:56','2025-10-11 12:07:05','2025-10-18 16:03:17','ORD-20251011-C71E5B','68e792c348475',400.00,'paid','mpesa','Oxford','0111507107','The price is too high 🤣🤣','direct');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otp_verification`
--

DROP TABLE IF EXISTS `otp_verification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `otp_verification` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `otp` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otp_verification`
--

LOCK TABLES `otp_verification` WRITE;
/*!40000 ALTER TABLE `otp_verification` DISABLE KEYS */;
/*!40000 ALTER TABLE `otp_verification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `platform_commissions`
--

DROP TABLE IF EXISTS `platform_commissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `platform_commissions` (
  `id` varchar(36) NOT NULL,
  `order_id` int(11) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `commission_amount` decimal(10,2) NOT NULL,
  `vendor_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','processed') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_platform_commissions_order_id` (`order_id`),
  KEY `idx_platform_commissions_vendor_id` (`vendor_id`),
  KEY `idx_platform_commissions_status` (`status`),
  CONSTRAINT `platform_commissions_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `platform_commissions_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `platform_commissions`
--

LOCK TABLES `platform_commissions` WRITE;
/*!40000 ALTER TABLE `platform_commissions` DISABLE KEYS */;
INSERT INTO `platform_commissions` VALUES ('0ae49201-fe00-4ca5-8d8e-b7e3de478a3c',15,'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',300.00,30.00,270.00,'processed','2025-10-10 08:26:41','2025-10-10 08:26:41'),('4b14a5c4-5477-4e0d-858a-1318362077dc',22,'68e792c348475',400.00,40.00,360.00,'processed','2025-10-09 15:01:02','2025-10-09 15:01:02'),('4ec2434c-e885-4a74-8d6e-a3ee3994b252',7,'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',150.00,15.00,135.00,'processed','2025-10-09 15:01:37','2025-10-09 15:01:37'),('5ae999ac-8be5-42f9-8947-9d08fb5131aa',8,'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',300.00,30.00,270.00,'processed','2025-10-09 16:51:54','2025-10-09 16:51:54'),('e556515c-8071-4937-8c1b-8fd007294a3c',23,'68e792c348475',400.00,40.00,360.00,'processed','2025-10-11 12:07:05','2025-10-11 12:07:05');
/*!40000 ALTER TABLE `platform_commissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES ('68dbf4fdd006b','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4','Fresh Chicken Eggs','Fresh farm eggs from free-range chickens','eggs',150.00,90,'piece','[\"http:\\/\\/localhost\\/poultry-hub-kenya\\/uploads\\/products\\/68de681cc98d7_1759406108_0.png\"]',1,'2025-09-30 15:19:25','2025-10-07 18:17:41'),('68dbfb39dca96','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4','8 day old chick','8 days old chicks - Premium quality  Poultry raised on our family farm. Standard quality for everyday use. These birds are carefully selected and perfect for various farming needs. Raised with natural feed and proper care. Available for immediate delivery. Contact us for more details.','chickens',100.50,49,'piece','[\"http:\\/\\/localhost\\/poultry-hub-kenya\\/uploads\\/products\\/68de68a547fa0_1759406245_0.png\"]',1,'2025-09-30 15:46:01','2025-10-07 18:42:36'),('68e53fcc61b78','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4','Hen','Hen - Quality chickens for your poultry needs. Standard quality for everyday use. ','chickens',800.00,20,'piece','[\"http:\\/\\/localhost\\/poultry-hub-kenya\\/uploads\\/products\\/68e53fc90425d_1759854537_0.png\"]',1,'2025-10-07 16:29:00','2025-10-07 16:33:31'),('68e792f3c8aca','68e792c348475','Hen','Hen - Quality chickens for your poultry needs. Standard quality for everyday use. carefully selected This product is various farming needs and suitable for various poultry farming applications. Contact us for more information and pricing.','chickens',400.00,38,'piece','[\"http:\\/\\/localhost\\/poultry-hub-kenya\\/uploads\\/products\\/68e792f0a1446_1760006896_0.jpg\"]',1,'2025-10-09 10:48:19','2025-10-11 11:55:56');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `security_logs`
--

DROP TABLE IF EXISTS `security_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `security_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event` varchar(100) NOT NULL,
  `severity` enum('INFO','WARNING','ERROR','CRITICAL') DEFAULT 'INFO',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_event` (`event`),
  KEY `idx_severity` (`severity`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `security_logs`
--

LOCK TABLES `security_logs` WRITE;
/*!40000 ALTER TABLE `security_logs` DISABLE KEYS */;
INSERT INTO `security_logs` VALUES (1,'system_setup','INFO','unknown','unknown','{\"message\":\"Security logging system initialized\",\"version\":\"1.0.0\"}','2025-10-09 12:20:27'),(2,'successful_login','INFO','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0','{\"user_id\":\"ab315ee5-079a-4562-87be-d3826b368964\",\"email\":\"okothroni863@gmail.com\",\"role\":\"customer\"}','2025-10-09 13:21:37'),(3,'successful_admin_login','INFO','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','{\"admin_id\":\"550e8400-e29b-41d4-a716-446655440099\",\"email\":\"kothroni863@gmail.com\"}','2025-10-09 13:21:54'),(4,'successful_login','INFO','192.168.16.196','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36','{\"user_id\":\"68e792c347af3\",\"email\":\"chalseotieno907@gmail.com\",\"role\":\"vendor\"}','2025-10-09 13:22:38'),(5,'failed_login','WARNING','192.168.16.196','Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36','{\"email\":\"chalseotieno907@gmail.com\",\"reason\":\"invalid_password\"}','2025-10-09 13:24:35'),(6,'successful_login','INFO','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0','{\"user_id\":\"ab315ee5-079a-4562-87be-d3826b368964\",\"email\":\"okothroni863@gmail.com\",\"role\":\"customer\"}','2025-10-09 13:34:40'),(7,'successful_admin_login','INFO','127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0','{\"admin_id\":\"550e8400-e29b-41d4-a716-446655440099\",\"email\":\"kothroni863@gmail.com\"}','2025-10-09 13:36:10');
/*!40000 ALTER TABLE `security_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_profiles`
--

DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_profiles` (
  `id` char(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` enum('customer','vendor','admin') DEFAULT 'customer',
  `avatar_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `account_status` enum('active','disabled') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_profiles`
--

LOCK TABLES `user_profiles` WRITE;
/*!40000 ALTER TABLE `user_profiles` DISABLE KEYS */;
INSERT INTO `user_profiles` VALUES ('3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','okothsteve863@gmail.com','$2y$10$YWduvJSChyzjpjflQXuPt.EfBZXhCmjB3NCEHfXb/bsJuKAko8M5K','martin odhiambo','0799422634','vendor',NULL,'2025-07-23 10:23:31','2025-10-18 15:51:45','active'),('550e8400-e29b-41d4-a716-446655440099','kothroni863@gmail.com','$2y$10$yXlFvoYJS3E6U9H1XGMbvuJeWBvUBX57ilxOf92YhqXnxEtQAzEmO','Ronald Admin','+254799422640','admin',NULL,'2025-07-22 13:30:23','2025-10-18 14:41:29','active'),('68e527a90853e','ezekielbusolo@gmail.com','$2y$10$3rHXWNMfkfU43b/tu1H3.uI5oKoWbu3RQwpBw/misgL5tJFU1H1P.','Ezekiel Malova','+254708751060','customer',NULL,'2025-10-07 14:46:01','2025-10-07 14:46:01','active'),('68e53efb315fe','odindodiana993@gmail.com','$2y$10$lBlTH5ZMp6T.ikmwEmAplOkXn6rSOm.t93Fa2OFv4m0u0tbs9jh36','DIANA ANYANGO','+2540111507107','customer',NULL,'2025-10-07 16:25:31','2025-10-18 15:44:47','active'),('68e792c347af3','chalseotieno907@gmail.com','$2y$10$r98KV.BTcbDujPPfXiHwMOTPAZo5H4qvnuF1XjDwEaLKVr8VvrqjK','charles otieno onyango','0743686405','vendor',NULL,'2025-10-09 10:47:31','2025-10-18 15:41:27','active'),('ab315ee5-079a-4562-87be-d3826b368964','okothroni863@gmail.com','$2y$10$BbR1YbWx/f4i9Ys4XQWEXOriTV6shsYsQtJKehDtRcYwPg77qjMJi','Steve Ronald','0799422635','customer',NULL,'2025-07-21 21:37:17','2025-10-18 15:50:08','active');
/*!40000 ALTER TABLE `user_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_earnings`
--

DROP TABLE IF EXISTS `vendor_earnings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendor_earnings` (
  `id` varchar(36) NOT NULL,
  `vendor_id` varchar(36) NOT NULL,
  `order_id` int(11) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `commission_amount` decimal(10,2) NOT NULL,
  `net_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','confirmed') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `confirmed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vendor_earnings_vendor_id` (`vendor_id`),
  KEY `idx_vendor_earnings_order_id` (`order_id`),
  KEY `idx_vendor_earnings_status` (`status`),
  CONSTRAINT `vendor_earnings_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_earnings_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_earnings`
--

LOCK TABLES `vendor_earnings` WRITE;
/*!40000 ALTER TABLE `vendor_earnings` DISABLE KEYS */;
INSERT INTO `vendor_earnings` VALUES ('16d3544e-595b-424b-9f97-78b1e6ab95fc','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',7,150.00,15.00,135.00,'confirmed','2025-10-09 15:01:38','2025-10-09 15:01:38'),('173a7cd0-23e7-4df4-9746-bc61901b778e','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',8,300.00,30.00,270.00,'confirmed','2025-10-09 16:51:54','2025-10-09 16:51:54'),('4bfd99df-32b8-406a-bda4-5a24454d1134','68e792c348475',23,400.00,40.00,360.00,'confirmed','2025-10-11 12:07:05','2025-10-11 12:07:05'),('ae595166-e6a1-47fa-a739-161348055191','68e792c348475',22,400.00,40.00,360.00,'confirmed','2025-10-09 15:01:02','2025-10-09 15:01:02'),('e7861ed6-27a8-4c03-b86f-442017741151','ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4',15,300.00,30.00,270.00,'confirmed','2025-10-10 08:26:41','2025-10-10 08:26:41');
/*!40000 ALTER TABLE `vendor_earnings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendors` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `farm_name` varchar(255) NOT NULL,
  `farm_description` text DEFAULT NULL,
  `location` varchar(255) NOT NULL,
  `id_number` varchar(20) DEFAULT NULL,
  `status` enum('pending','approved','rejected','suspended') DEFAULT 'pending',
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` char(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `account_status` enum('active','disabled') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `vendors_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES ('68e792c348475','68e792c347af3','Chalse','sell healthy products','Kisumu','43565676','approved','2025-10-09 11:03:10','550e8400-e29b-41d4-a716-446655440099','2025-10-09 10:47:31','2025-10-18 15:41:27','active'),('ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4','3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3','Martin\'s Poultry Farm','sells poultry product','Nairobi','23467586','approved','2025-10-09 11:03:10','550e8400-e29b-41d4-a716-446655440099','2025-07-23 10:23:31','2025-10-18 15:51:45','active');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-19  0:03:25
