CREATE TABLE `businesses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`plan_type` text DEFAULT 'basic' NOT NULL,
	`activo` integer DEFAULT false NOT NULL,
	`banco_banco` text,
	`banco_cuenta` text,
	`banco_titular` text,
	`email_smtp_user` text,
	`email_smtp_pass` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`subscription_status` text DEFAULT 'inactive',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text,
	`name` text NOT NULL,
	`email` text,
	`oauth_provider` text,
	`oauth_id` text,
	`avatar_url` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`business_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer,
	`name` text NOT NULL,
	`apodo` text,
	`phone` text,
	`whatsapp` text,
	`address` text,
	`sector` text,
	`ciudad` text,
	`cedula` text,
	`status` text DEFAULT 'active' NOT NULL,
	`risk_score` integer DEFAULT 50 NOT NULL,
	`notes` text,
	`fiador_name` text,
	`fiador_phone` text,
	`cobrador_id` integer,
	`avatar_url` text,
	`gps_lat` real,
	`gps_lng` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`amount` text NOT NULL,
	`interest_rate` text NOT NULL,
	`installments_count` integer NOT NULL,
	`start_date` text NOT NULL,
	`frequency` text NOT NULL,
	`total_amount` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` integer NOT NULL,
	`due_date` text NOT NULL,
	`amount` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`payment_method` text DEFAULT 'efectivo',
	`gps_lat` real,
	`gps_lng` real,
	`photo_url` text,
	`cobrador_id` integer,
	`paid_amount` text DEFAULT '0',
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `backup_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer,
	`email` text NOT NULL,
	`frequency` text DEFAULT 'weekly' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_sent_at` integer,
	`smtp_user` text,
	`smtp_pass` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loan_contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`loan_id` integer NOT NULL,
	`client_id` integer NOT NULL,
	`business_id` integer,
	`contract_html` text,
	`signature_base64` text,
	`signed_at` integer,
	`signer_name` text,
	`signer_ip` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer NOT NULL,
	`category` text DEFAULT 'otro' NOT NULL,
	`description` text NOT NULL,
	`amount` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pagos_recibidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer,
	`cliente_nombre` text NOT NULL,
	`cliente_email` text,
	`monto` real NOT NULL,
	`concepto` text NOT NULL,
	`metodo` text DEFAULT 'transferencia' NOT NULL,
	`fecha` text NOT NULL,
	`referencia` text,
	`notas` text,
	`comprobante_enviado` integer DEFAULT false,
	`creado_en` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pagos_pendientes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_id` integer,
	`cliente_nombre` text NOT NULL,
	`cliente_email` text,
	`monto` real NOT NULL,
	`concepto` text NOT NULL,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`referencia` text,
	`notas` text,
	`datos_bancarios_enviados` integer DEFAULT false,
	`creado_en` integer NOT NULL,
	`confirmado_en` integer
);
--> statement-breakpoint
CREATE TABLE `cobrador_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cobrador_id` integer NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cobrador_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cobrador_locations_cobrador_id_unique` ON `cobrador_locations` (`cobrador_id`);