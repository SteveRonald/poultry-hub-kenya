-- Render PostgreSQL Database Setup
-- Poultry Hub Kenya

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "admin_sessions" (
  "id" INTEGER NOT NULL SERIAL,
  "admin_id" char(36) NOT NULL,
  "session_token" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "expires_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  PRIMARY KEY ("id"),
  KEY "admin_id" ("admin_id"),
  CONSTRAINT "admin_sessions_ibfk_1" FOREIGN KEY ("admin_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE
) 

INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('1', '550e8400-e29b-41d4-a716-446655440099', '1c50cf9feb2ff391d77dfdb591974e97dae861f4fca0e6e6ca7055575038d9db', '2025-07-22 16:56:21', '2025-07-23 16:56:21');

CREATE TABLE "cart" (
  "id" INTEGER NOT NULL SERIAL,
  "user_id" varchar(36) NOT NULL,
  "product_id" varchar(36) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  PRIMARY KEY ("id"),
  UNIQUE KEY "unique_user_product" ("user_id","product_id"),
  KEY "product_id" ("product_id"),
  CONSTRAINT "cart_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "cart_ibfk_2" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE
) 

CREATE TABLE "contact_messages" (
  "id" INTEGER NOT NULL SERIAL,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "category" varchar(100) DEFAULT NULL,
  "message" TEXT NOT NULL,
  "status" enum('new','read','replied') DEFAULT 'new',
  "admin_reply" TEXT DEFAULT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  PRIMARY KEY ("id")
) 

INSERT INTO "contact_messages" ("id", "name", "email", "phone", "subject", "category", "message", "status", "admin_reply", "created_at", "updated_at") VALUES ('1', 'Steve Ronald', 'okothroni863@gmail.com', '0799422635', 'order', 'customer', 'how is the process of ordering', 'replied', 'visit our products page and make you order', '2025-10-01 13:56:29', '2025-10-01 14:11:36');

CREATE TABLE "notifications" (
  "id" INTEGER NOT NULL SERIAL,
  "user_id" char(36) NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" BOOLEAN DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  PRIMARY KEY ("id"),
  KEY "user_id" ("user_id"),
  CONSTRAINT "notifications_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE
) 

INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('1', '550e8400-e29b-41d4-a716-446655440099', 'Welcome to Poultry Hub Kenya! Your account has been set up successfully.', '1', '2025-09-30 17:32:08');

CREATE TABLE "orders" (
  "id" INTEGER NOT NULL SERIAL,
  "user_id" char(36) NOT NULL,
  "product_id" char(36) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" enum('pending','confirmed','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  "status_notes" TEXT DEFAULT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  "order_number" varchar(20) DEFAULT NULL,
  "vendor_id" varchar(36) DEFAULT NULL,
  "total_amount" DECIMAL(10,2) DEFAULT 0.00,
  "payment_status" enum('pending','paid','failed','refunded') DEFAULT 'pending',
  "payment_method" enum('mpesa','bank','paypal') DEFAULT 'mpesa',
  "shipping_address" TEXT DEFAULT NULL,
  "contact_phone" varchar(20) DEFAULT NULL,
  "notes" TEXT DEFAULT NULL,
  "order_type" enum('direct','cart') DEFAULT 'direct',
  PRIMARY KEY ("id"),
  KEY "user_id" ("user_id"),
  KEY "product_id" ("product_id"),
  KEY "orders_vendor_fk" ("vendor_id"),
  KEY "idx_order_number" ("order_number"),
  CONSTRAINT "orders_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE,
  CONSTRAINT "orders_ibfk_2" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE,
  CONSTRAINT "orders_vendor_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE
) 

INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('7', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '1', 'pending', NULL, '2025-10-01 15:44:05', '2025-10-01 15:44:05', 'TEST-20251001-51910F', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '150.00', 'pending', 'mpesa', 'Test address', '1234567890', 'Test single product order', 'direct');

CREATE TABLE "otp_verification" (
  "id" INTEGER NOT NULL SERIAL,
  "email" VARCHAR(255) NOT NULL,
  "otp" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  "used" BOOLEAN DEFAULT 0,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  PRIMARY KEY ("id")
) 

CREATE TABLE "products" (
  "id" char(36) NOT NULL,
  "vendor_id" char(36) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT DEFAULT NULL,
  "category" enum('chickens','eggs','feed','equipment','medicine','chicks') NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "stock_quantity" INTEGER DEFAULT 0,
  "unit" varchar(50) DEFAULT 'piece',
  "image_urls" longTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid("image_urls")),
  "is_active" BOOLEAN DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  PRIMARY KEY ("id"),
  KEY "vendor_id" ("vendor_id"),
  CONSTRAINT "products_ibfk_1" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE
) 

INSERT INTO "products" ("id", "vendor_id", "name", "description", "category", "price", "stock_quantity", "unit", "image_urls", "is_active", "created_at", "updated_at") VALUES ('68dbf4fdd006b', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', 'Fresh Chicken Eggs', 'Fresh farm eggs from free-range chickens', 'eggs', '150.00', '91', 'piece', '[\"http:\\/\\/localhost\\/poultry-hub-kenya\\/uploads\\/products\\/68de681cc98d7_1759406108_0.png\"]', '1', '2025-09-30 18:19:25', '2025-10-02 14:55:20');

CREATE TABLE "user_profiles" (
  "id" char(36) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "full_name" VARCHAR(255) NOT NULL,
  "phone" varchar(20) DEFAULT NULL,
  "role" enum('customer','vendor','admin') DEFAULT 'customer',
  "avatar_url" VARCHAR(255) DEFAULT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  PRIMARY KEY ("id"),
  UNIQUE KEY "email" ("email")
) 

INSERT INTO "user_profiles" ("id", "email", "password", "full_name", "phone", "role", "avatar_url", "created_at", "updated_at") VALUES ('3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'martin23@gmail.com', '$2y$10$YWduvJSChyzjpjflQXuPt.EfBZXhCmjB3NCEHfXb/bsJuKAko8M5K', 'Martin', '0799422634', 'vendor', NULL, '2025-07-23 13:23:31', '2025-09-30 18:10:54');

CREATE TABLE "vendors" (
  "id" char(36) NOT NULL,
  "user_id" char(36) NOT NULL,
  "farm_name" VARCHAR(255) NOT NULL,
  "farm_description" TEXT DEFAULT NULL,
  "location" VARCHAR(255) NOT NULL,
  "id_number" varchar(20) DEFAULT NULL,
  "status" enum('pending','approved','rejected','suspended') DEFAULT 'approved',
  "approved_at" TIMESTAMP NULL DEFAULT NULL,
  "approved_by" char(36) DEFAULT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT current_TIMESTAMP() ON UPDATE current_TIMESTAMP(),
  PRIMARY KEY ("id"),
  UNIQUE KEY "user_id" ("user_id"),
  CONSTRAINT "vendors_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "user_profiles" ("id") ON DELETE CASCADE
) 

INSERT INTO "vendors" ("id", "user_id", "farm_name", "farm_description", "location", "id_number", "status", "approved_at", "approved_by", "created_at", "updated_at") VALUES ('ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'Martin\'s Poultry Farm', 'sells poultry product', 'Nairobi', '23467587', 'approved', NULL, NULL, '2025-07-23 13:23:31', '2025-09-30 18:48:49');

