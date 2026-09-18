import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  activeOrganizationId: uuid("active_organization_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("accounts_provider_account_uidx").on(table.providerId, table.accountId),
  index("accounts_user_idx").on(table.userId),
]);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("verifications_identifier_idx").on(table.identifier)]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  legalDocument: text("legal_document"),
  institutionalEmail: text("institutional_email"),
  phone: text("phone"),
  address: text("address"),
  addressNumber: text("address_number"),
  addressComplement: text("address_complement"),
  district: text("district"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  status: text("status").notNull().default("invited"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("organization_members_org_user_uidx").on(table.organizationId, table.userId),
  index("organization_members_user_idx").on(table.userId, table.organizationId),
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull().default(""),
  stage: text("stage").notNull().default("Aquisição"),
  status: text("status").notNull().default("nao_iniciado"),
  responsible: text("responsible").notNull().default("Não atribuído"),
  mainImage: text("main_image"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("projects_org_code_uidx").on(table.organizationId, table.code),
  index("projects_org_updated_idx").on(table.organizationId, table.updatedAt),
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  document: text("document").notNull(),
  email: text("email").notNull(),
  phones: jsonb("phones").$type<string[]>().notNull().default([]),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("contacts_org_document_uidx").on(table.organizationId, table.document),
  index("contacts_org_type_idx").on(table.organizationId, table.type),
]);

export const projectParticipants = pgTable("project_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
  role: text("role").notNull(),
  percentage: text("percentage"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("project_participants_project_contact_role_uidx").on(table.projectId, table.contactId, table.role),
  index("project_participants_contact_idx").on(table.contactId),
]);

export const financialMovements = pgTable("financial_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  movementDate: timestamp("movement_date", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pendente"),
  holderName: text("holder_name"),
  holderDocument: text("holder_document"),
  holderType: text("holder_type"),
  documentType: text("document_type"),
  receiptIds: jsonb("receipt_ids").$type<string[]>().notNull().default([]),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("financial_movements_project_date_idx").on(table.projectId, table.movementDate),
  index("financial_movements_org_idx").on(table.organizationId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_logs_project_date_idx").on(table.projectId, table.createdAt)]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  financialMovementId: uuid("financial_movement_id").references(() => financialMovements.id, { onDelete: "set null" }),
  displayName: text("display_name").notNull(),
  originalName: text("original_name").notNull(),
  category: text("category").notNull(),
  version: integer("version").notNull().default(1),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("documents_project_category_idx").on(table.projectId, table.category),
  index("documents_financial_movement_idx").on(table.financialMovementId),
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("nao_iniciado"),
  isOnlineMeeting: boolean("is_online_meeting").notNull().default(false),
  meetingUrl: text("meeting_url"),
  meetingTime: text("meeting_time"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("tasks_project_due_idx").on(table.projectId, table.dueDate)]);

export const taskAssignees = pgTable("task_assignees", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
}, (table) => [index("task_assignees_task_idx").on(table.taskId)]);

export const taskMeetingParticipants = pgTable("task_meeting_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
}, (table) => [index("task_meeting_participants_task_idx").on(table.taskId)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  recipientUserId: text("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("notifications_recipient_read_idx").on(table.recipientUserId, table.readAt, table.createdAt)]);

export const reportRuns = pgTable("report_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  generatedBy: text("generated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  reportKey: text("report_key").notNull(),
  format: text("format").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
  rowCount: integer("row_count").notNull().default(0),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("report_runs_org_date_idx").on(table.organizationId, table.generatedAt)]);


export const projectOperationalData = pgTable("project_operational_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  regularization: jsonb("regularization").$type<Record<string, unknown>>().notNull().default({}),
  possession: jsonb("possession").$type<Record<string, unknown>>().notNull().default({}),
  updatedBy: text("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("project_operational_data_project_uidx").on(table.projectId),
  index("project_operational_data_org_idx").on(table.organizationId),
]);

export const judicialActions = pgTable("judicial_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  actionType: text("action_type").notNull(),
  processNumber: text("process_number").notNull().default(""),
  court: text("court").notNull().default(""),
  lastMovementDate: date("last_movement_date"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("judicial_actions_project_scope_idx").on(table.projectId, table.scope),
  index("judicial_actions_org_idx").on(table.organizationId),
]);

export const projectImages = pgTable("project_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(), mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(), sha256: text("sha256").notNull(),
  displayOrder: integer("display_order").notNull().default(0), isMain: boolean("is_main").notNull().default(false),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("project_images_project_order_idx").on(table.projectId, table.displayOrder), index("project_images_org_idx").on(table.organizationId)]);

export const salesPortfolio = pgTable("sales_portfolio", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), type: text("type").notNull(), name: text("name").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}), createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sales_portfolio_project_idx").on(table.projectId), index("sales_portfolio_org_idx").on(table.organizationId)]);

export const salesProposals = pgTable("sales_proposals", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), number: integer("number").notNull(),
  originId: uuid("origin_id").references(() => salesPortfolio.id, { onDelete: "set null" }), status: text("status").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}), createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("sales_proposals_project_number_uidx").on(table.projectId, table.number), index("sales_proposals_org_idx").on(table.organizationId)]);

export const serviceProviders = pgTable("service_providers", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  document: text("document").notNull(), name: text("name").notNull(), data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}), status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("service_providers_org_document_uidx").on(table.organizationId, table.document), index("service_providers_org_idx").on(table.organizationId)]);

export const projectProviderAssignments = pgTable("project_provider_assignments", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), providerId: uuid("provider_id").notNull().references(() => serviceProviders.id, { onDelete: "restrict" }),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}), createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("project_provider_assignments_project_provider_uidx").on(table.projectId, table.providerId), index("project_provider_assignments_org_idx").on(table.organizationId)]);

export const distributionSnapshots = pgTable("distribution_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(), organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  calculatedBy: text("calculated_by").notNull().references(() => users.id, { onDelete: "restrict" }), calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("distribution_snapshots_project_date_idx").on(table.projectId, table.calculatedAt), index("distribution_snapshots_org_idx").on(table.organizationId)]);
