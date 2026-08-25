const { z } = require('zod');

// ── AUTH ──────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1, 'Användarnamn krävs'),
  password: z.string().min(1, 'Lösenord krävs')
});

const registerSchema = z.object({
  username: z.string().min(1, 'Användarnamn krävs'),
  password: z.string().min(6, 'Lösenord måste vara minst 6 tecken'),
  display_name: z.string().min(1, 'Visningsnamn krävs'),
  admin_key: z.string().optional()
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Nuvarande lösenord krävs'),
  new_password: z.string().min(6, 'Nytt lösenord måste vara minst 6 tecken')
});

// ── WAREHOUSES ────────────────────────────────────────────────────────────────
const warehouseSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  type: z.string().optional().default('car'),
  description: z.string().optional().default('')
});

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
const productSchema = z.object({
  e_number: z.string().min(1, 'E-nummer krävs'),
  name: z.string().min(1, 'Namn krävs'),
  description: z.string().optional().default(''),
  unit: z.string().optional().default('st'),
  barcode: z.string().nullable().optional(),
  category_id: z.number().int().nullable().optional(),
  category: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  attributes: z.record(z.any()).optional().default({})
});

// ── INVENTORY ─────────────────────────────────────────────────────────────────
const inventorySetSchema = z.object({
  warehouse_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  quantity: z.number().min(0),
  min_quantity: z.number().min(0).optional().default(2)
});

const restockSchema = z.object({
  warehouse_id: z.number().int().positive(),
  notes: z.string().optional().default(''),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().positive()
  })).min(1, 'Minst en artikel krävs')
});

// ── TRANSACTIONS / CHECKOUT ───────────────────────────────────────────────────
const checkoutItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().positive()
});

const checkoutSchema = z.object({
  warehouse_id: z.number().int().positive(),
  customer_name: z.string().optional().default(''),
  customer_address: z.string().optional().default(''),
  work_order: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  items: z.array(checkoutItemSchema).min(1, 'Varukorgen är tom')
});

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
const customerSchema = z.object({
  name: z.string().min(1, 'Namn krävs'),
  company: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  customer_number: z.string().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  location_type: z.string().nullable().optional()
});

// ── JOBS ──────────────────────────────────────────────────────────────────────
const jobSchema = z.object({
  order_number: z.string().optional().default(''),
  customer_name: z.string().min(1, 'Kundnamn krävs'),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  description: z.string().optional().default(''),
  customer_id: z.number().int().positive().nullable().optional(),
  is_shared: z.boolean().optional().default(false)
});

const jobEntrySchema = z.object({
  type: z.enum(['note', 'photo']).optional().default('note'),
  content: z.string().optional().default(''),
  image_data: z.string().optional(),
  mime_type: z.string().optional()
});

const jobMaterialSchema = z.object({
  product_id: z.number().int().positive().nullable().optional(),
  e_number: z.string().min(1, 'E-nummer krävs'),
  product_name: z.string().min(1, 'Produktnamn krävs'),
  quantity: z.number().positive(),
  unit: z.string().optional().default('st')
});

// ── CALENDAR ──────────────────────────────────────────────────────────────────
const calendarEventSchema = z.object({
  title: z.string().min(1, 'Titel krävs'),
  description: z.string().optional().default(''),
  start_datetime: z.string().min(1, 'Starttid krävs'),
  end_datetime: z.string().nullable().optional(),
  all_day: z.boolean().optional().default(false),
  type: z.string().optional().default('booking'),
  job_id: z.number().int().positive().nullable().optional(),
  color: z.string().optional().default('#f5a623'),
  reminder_minutes: z.number().int().min(0).optional().default(60)
});

// ── UPLOADS ───────────────────────────────────────────────────────────────────
const uploadSchema = z.object({
  image_data: z.string().min(1, 'Bilddata krävs'),
  mime_type: z.string().optional().default('image/jpeg')
});

// ── GEOFENCE ──────────────────────────────────────────────────────────────────
const geofenceSettingsSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius: z.number().int().positive().optional().default(200),
  enabled: z.boolean().optional().default(true),
  name: z.string().optional().default('Centralförrådet')
});

// ── ASSISTANT ─────────────────────────────────────────────────────────────────
const assistantChatSchema = z.object({
  message: z.string().min(1, 'Meddelande krävs'),
  system: z.string().optional().default('Du är ElStock-assistenten.')
});

const assistantActionSchema = z.object({
  action: z.enum(['create_calendar_event', 'add_to_cart', 'add_job_note']),
  params: z.record(z.any())
});

// ── USER SETTINGS ─────────────────────────────────────────────────────────────
const userProfileSchema = z.object({
  display_name: z.string().optional(),
  telegram_chat_id: z.string().nullable().optional(),
  telegram_user: z.string().nullable().optional(),
  push_enabled: z.boolean().optional(),
  notify_low_stock: z.boolean().optional(),
  color: z.string().optional()
});

module.exports = {
  loginSchema, registerSchema, changePasswordSchema,
  warehouseSchema, productSchema,
  inventorySetSchema, restockSchema,
  checkoutSchema, checkoutItemSchema,
  customerSchema, jobSchema, jobEntrySchema, jobMaterialSchema,
  calendarEventSchema, uploadSchema,
  geofenceSettingsSchema, assistantChatSchema, assistantActionSchema,
  userProfileSchema
};
