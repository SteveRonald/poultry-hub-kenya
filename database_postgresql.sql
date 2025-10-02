-- Poultry Hub Kenya Database - PostgreSQL Version
-- Generated: 2025-10-02 16:39:11
-- For Render PostgreSQL Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Poultry Hub Kenya Database Export
-- Generated: 2025-10-02 16:38:40
-- For migration to Render PostgreSQL

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
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('2', '550e8400-e29b-41d4-a716-446655440099', '03899e2df12bb683f8a931a1244caf7cc8cb103f0f8fe96bafd89b72f421f896', '2025-07-22 16:57:13', '2025-07-23 16:57:13');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('3', '550e8400-e29b-41d4-a716-446655440099', '33cee08c4aa930f6c3e6a531e45ca6993fe93fea2f1a8b1021a9be4b97f7496d', '2025-07-22 17:15:51', '2025-07-23 17:15:51');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('4', '550e8400-e29b-41d4-a716-446655440099', '034dae42004998099e8054d4c558b437890a2cf8823ec3a136dade46e422c07b', '2025-07-22 17:59:30', '2025-07-23 17:59:30');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('5', '550e8400-e29b-41d4-a716-446655440099', '799eed1e5b3849e770d3d79ddd728b6fe1cd26f1f57b8582bb02cb5509702509', '2025-07-23 11:21:50', '2025-07-24 11:21:50');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('6', '550e8400-e29b-41d4-a716-446655440099', 'ca87849a6902723756f4b0fe68fa6500b6bfaec543bc51662ec19ac82e670ef5', '2025-07-23 11:22:47', '2025-07-24 11:22:47');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('7', '550e8400-e29b-41d4-a716-446655440099', '9d2fb1ae76bd696c3699c6578e8b6863066404970ed5296a3d2da00428d21c82', '2025-07-23 11:42:19', '2025-07-24 11:42:19');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('8', '550e8400-e29b-41d4-a716-446655440099', '4707cd5329025193212e3b4ddf3dae62ab5d6a5c93a388967c3b541e25546a8b', '2025-07-23 11:46:53', '2025-07-24 11:46:53');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('9', '550e8400-e29b-41d4-a716-446655440099', '4d931cf5f797b3737dd529984453109aa89d16c4f0b5e6ae3f7813791204e5f2', '2025-07-23 12:09:19', '2025-07-24 12:09:19');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('10', '550e8400-e29b-41d4-a716-446655440099', 'd431bd7f63ad4a11e0c5e974fa05477ca641b0d17d84955109c4bb4ca6d45b63', '2025-07-23 12:24:34', '2025-07-24 12:24:34');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('11', '550e8400-e29b-41d4-a716-446655440099', 'c2a727950403896ad300a85fb9e4863fc8b47094cace3d810a51de05f343e2c2', '2025-07-23 12:37:22', '2025-07-24 12:37:22');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('12', '550e8400-e29b-41d4-a716-446655440099', '8f20ef2cb47b52497e04ed6e693daa3472f31a4f71db9754a387266188daa659', '2025-07-23 13:24:50', '2025-07-24 13:24:50');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('13', '550e8400-e29b-41d4-a716-446655440099', '6691d8789f2c4f499b08c43a66756996c6cd0675cd44b8daf204cd570ff633d8', '2025-07-23 13:38:36', '2025-07-24 13:38:36');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('14', '550e8400-e29b-41d4-a716-446655440099', '292e0b8899c5709cb67d7e2a262fd3ccc35e4376a51984eed9faef5d57f3c241', '2025-07-23 14:17:07', '2025-07-24 14:17:07');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('15', '550e8400-e29b-41d4-a716-446655440099', '0d66601683a11d861e4e7a99d247080592623f81a0afbd10e3d83586fa2825c5', '2025-07-23 14:31:07', '2025-07-24 14:31:07');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('16', '550e8400-e29b-41d4-a716-446655440099', 'ff7b6ac497d55e3fc7dad1355df563951dc6afe6fc35c30717798a546f3a8ce9', '2025-07-23 14:40:33', '2025-07-24 14:40:33');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('17', '550e8400-e29b-41d4-a716-446655440099', '86d5e48a9a999be7671eff0e08849c365319ebe60b5fd562b52bf0c839fbc484', '2025-07-23 17:24:12', '2025-07-24 17:24:12');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('18', '550e8400-e29b-41d4-a716-446655440099', '84f2eb982445d39e1166370428679f020a96087e8ea94629faf5ce5903b2f670', '2025-08-01 14:40:40', '2025-08-02 14:40:40');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('20', '550e8400-e29b-41d4-a716-446655440099', '191bb8f52a7407e5d00dfa513bc0e94c6778a5963e83ca57b2e95c7e84456837', '2025-09-16 14:44:24', '2025-09-17 14:44:24');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('21', '550e8400-e29b-41d4-a716-446655440099', '361c44c4bed21a43881ddb8abe68880095340348727f8fa76deeb62ab694eb25', '2025-09-16 14:46:42', '2025-09-17 14:46:42');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('22', '550e8400-e29b-41d4-a716-446655440099', '952aa547bd012f0ac025cc9cf30d13c8ed29182d0f839c78e9d63655a7eeca78', '2025-09-30 17:38:07', '2025-10-01 17:38:07');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('23', '550e8400-e29b-41d4-a716-446655440099', '76d8bcbca8b48826dbf46e86b8a5a128f6a15bfccf6e1defc0e8fea99f286c06', '2025-09-30 17:40:16', '2025-10-01 17:40:16');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('24', '550e8400-e29b-41d4-a716-446655440099', '14ad486dc4029868887bd82457233be1ea8797e1c638dda2646a19e1b1081c59', '2025-09-30 17:42:08', '2025-10-01 17:42:08');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('26', '550e8400-e29b-41d4-a716-446655440099', '5c54e92eb622b799f1c0f38f6cb3a7ec73a2e26a8045e990b4f3b046f40fb2a5', '2025-09-30 17:51:01', '2025-10-01 17:51:01');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('30', '550e8400-e29b-41d4-a716-446655440099', 'af4322d7406cc385e606558741609832270dc035389bb5ce63ab4c70e0c928df', '2025-09-30 18:19:48', '2025-10-01 18:19:48');
INSERT INTO "admin_sessions" ("id", "admin_id", "session_token", "created_at", "expires_at") VALUES ('35', '550e8400-e29b-41d4-a716-446655440099', '0fe0cbed654380dae0bf6efe261ea55ecb36776a8cd68ed42551f2ede0a811d2', '2025-10-01 14:07:20', '2025-10-02 14:07:20');

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
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('2', '550e8400-e29b-41d4-a716-446655440099', 'New vendor application received from Martin\'s Poultry Farm.', '1', '2025-09-30 17:32:08');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('3', '550e8400-e29b-41d4-a716-446655440099', 'System maintenance scheduled for tomorrow at 2 AM.', '1', '2025-09-30 17:32:08');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('4', '550e8400-e29b-41d4-a716-446655440099', 'Test notification: New user registered - John Doe', '0', '2025-09-30 19:35:16');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('5', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'Your product \'Test Product\' has been rejected. Reason: Product disapproved by admin', '1', '2025-09-30 19:35:56');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('6', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'Your product \'Test Product\' has been approved and is now live!', '1', '2025-09-30 19:36:24');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('7', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'You have received a new order #ORD-20251001-861F99 with 1 item(s). Please check your vendor dashboard.', '1', '2025-10-01 16:44:44');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('8', '550e8400-e29b-41d4-a716-446655440099', 'New order #ORD-20251001-861F99 has been placed with 1 item(s). Total amount: KSH 300.00', '0', '2025-10-01 16:44:44');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('9', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'You have received a new order #ORD-20251001-69405D with 1 item(s). Please check your vendor dashboard.', '1', '2025-10-01 17:14:52');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('10', '550e8400-e29b-41d4-a716-446655440099', 'New order #ORD-20251001-69405D has been placed with 1 item(s). Total amount: KSH 150.00', '0', '2025-10-01 17:14:52');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('11', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'You have received a new order #ORD-20251001-CDF59B with 1 item(s). Please check your vendor dashboard.', '1', '2025-10-01 17:27:30');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('12', '550e8400-e29b-41d4-a716-446655440099', 'New order #ORD-20251001-CDF59B has been placed with 1 item(s). Total amount: KSH 150.00', '0', '2025-10-01 17:27:30');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('13', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', 'You have received a new order #ORD-20251002-FA602E with 1 item(s). Please check your vendor dashboard.', '1', '2025-10-02 14:46:23');
INSERT INTO "notifications" ("id", "user_id", "message", "is_read", "created_at") VALUES ('14', '550e8400-e29b-41d4-a716-446655440099', 'New order #ORD-20251002-FA602E has been placed with 1 item(s). Total amount: KSH 450.00', '0', '2025-10-02 14:46:23');

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
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('8', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '2', 'pending', NULL, '2025-10-01 15:44:05', '2025-10-01 15:44:05', 'TEST-20251001-51C60C', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '300.00', 'pending', 'mpesa', 'Test address', '1234567890', 'Test multi-product order - item 1', 'direct');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('12', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '1', 'pending', NULL, '2025-10-01 15:49:41', '2025-10-01 15:49:41', 'ORD-20251001-576304', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '150.00', 'pending', 'mpesa', '123 Test Street, Nairobi', '0712345678', 'Quick order test', 'direct');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('13', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '1', 'pending', NULL, '2025-10-01 16:01:22', '2025-10-01 16:01:22', 'ORD-20251001-260CCF', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '150.00', 'pending', 'mpesa', 'eldoret', '079989890', 'gooog', 'direct');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('14', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbfb39dca96', '3', 'confirmed', NULL, '2025-10-01 16:03:42', '2025-10-01 16:35:54', 'ORD-20251001-EBF40D', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '301.50', 'paid', 'mpesa', 'ed', '555555', '', 'cart');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('15', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '2', 'pending', NULL, '2025-10-01 16:44:40', '2025-10-01 17:12:13', 'ORD-20251001-861F99', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '300.00', 'pending', 'mpesa', 'moi university', 'dddd', 'Quick order from products page', 'direct');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('16', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '1', 'pending', NULL, '2025-10-01 17:14:46', '2025-10-01 17:14:46', 'ORD-20251001-69405D', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '150.00', 'pending', 'mpesa', 'eldoret', '0799422635', '', 'cart');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('17', 'ab315ee5-079a-4562-87be-d3826b368964', '68dbf4fdd006b', '1', 'confirmed', NULL, '2025-10-01 17:27:24', '2025-10-02 11:56:29', 'ORD-20251001-CDF59B', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '150.00', 'paid', 'paypal', 'eldoret', '0799422635', 'from cart', 'cart');
INSERT INTO "orders" ("id", "user_id", "product_id", "quantity", "status", "status_notes", "created_at", "updated_at", "order_number", "vendor_id", "total_amount", "payment_status", "payment_method", "shipping_address", "contact_phone", "notes", "order_type") VALUES ('18', '3c5cf47a-ac4f-4aa5-875f-ce3fbabfe7d3', '68dbf4fdd006b', '3', 'processing', NULL, '2025-10-02 14:46:07', '2025-10-02 14:51:21', 'ORD-20251002-FA602E', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '450.00', 'paid', 'paypal', 'mamboleo', '0787678756', 'Quick order from products page', 'direct');

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
INSERT INTO "products" ("id", "vendor_id", "name", "description", "category", "price", "stock_quantity", "unit", "image_urls", "is_active", "created_at", "updated_at") VALUES ('68dbfb39dca96', 'ca3f0bac-7e9b-46c4-9534-dca77f7fd5b4', '8 day old chicks', '8 days old chicks - Premium quality  Poultry raised on our family farm. Standard quality for everyday use. These birds are carefully selected and perfect for various farming needs. Raised with natural feed and proper care. Available for immediate delivery. Contact us for more details.', 'chickens', '100.50', '5', 'piece', '[\"http:\\/\\/localhost\\/poultry-hub-kenya\\/uploads\\/products\\/68de68a547fa0_1759406245_0.png\"]', '1', '2025-09-30 18:46:01', '2025-10-02 14:58:47');

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
INSERT INTO "user_profiles" ("id", "email", "password", "full_name", "phone", "role", "avatar_url", "created_at", "updated_at") VALUES ('550e8400-e29b-41d4-a716-446655440099', 'kothroni863@gmail.com', '$2y$10$yXlFvoYJS3E6U9H1XGMbvuJeWBvUBX57ilxOf92YhqXnxEtQAzEmO', 'Ronald Admin ', '+254799422637', 'admin', NULL, '2025-07-22 16:30:23', '2025-10-01 14:07:13');
INSERT INTO "user_profiles" ("id", "email", "password", "full_name", "phone", "role", "avatar_url", "created_at", "updated_at") VALUES ('ab315ee5-079a-4562-87be-d3826b368964', 'okothroni863@gmail.com', '$2y$10$reuJGdTXxZOttGnNhPpvJOmXTLEV78Dslnmhj1X9HCL3pe1IqUxhy', 'Steve Ronald', '0799422635', 'customer', NULL, '2025-07-22 00:37:17', '2025-10-01 17:26:42');
INSERT INTO "user_profiles" ("id", "email", "password", "full_name", "phone", "role", "avatar_url", "created_at", "updated_at") VALUES ('b38e7a24-77b1-4f5d-b6cb-035f68f32c55', 'charlesonyango011@Gmail.com', '$2y$10$7j94bWppkYxidICNTr.XF.MXPLnjiC59x6UZxZV3gpt.8EqlaJqpW', 'charles otieno onyango', '0743686405', 'customer', NULL, '2025-08-12 18:15:50', '2025-10-01 11:53:12');

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

