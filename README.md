# Negozio

Sistema de gestión de tienda / punto de venta. Construido con Next.js 14, Supabase y TypeScript.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript strict |
| Estilos | Tailwind CSS |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Estado global | Zustand |
| Formularios | React Hook Form + Zod |
| Gráficos | Recharts |
| Íconos | lucide-react |
| Fechas | date-fns |

---

## 1. Configurar Supabase

### 1.1 Crear el proyecto

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Elegir nombre, región (preferentemente `South America`) y contraseña
3. Esperar ~2 min a que levante

### 1.2 Obtener las claves

En el panel del proyecto: **Project Settings → API**

| Variable | Fuente |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key *(solo server)* |

### 1.3 Ejecutar los scripts SQL

En **SQL Editor → New query**, ejecutar en este orden:

```
1. supabase/setup.sql                  → profiles, role_permissions
2. supabase/products_setup.sql         → establishments, products, establishment_products, vistas
3. supabase/stock_setup.sql            → suppliers, supplier_orders, stock_movements
4. supabase/sales_setup.sql            → sales, sale_items
5. supabase/external_sales_setup.sql   → external_sales, external_sale_items
6. supabase/dashboard_setup.sql        → vistas del dashboard, RPCs
7. supabase/triggers_setup.sql         → product_price_history, trigger de precios
8. supabase/config_setup.sql           → bucket logos
```

### 1.4 Crear el primer usuario owner

En **Authentication → Users → Add user**:
- Email: tu email
- Password: una contraseña segura
- ✓ Auto Confirm User

Luego en SQL Editor:

```sql
-- Asignar rol owner
UPDATE public.profiles
SET role = 'owner', full_name = 'Tu Nombre'
WHERE id = 'PEGAR-UUID-DEL-USUARIO';

-- Crear establecimiento
INSERT INTO public.establishments (name, owner_id)
VALUES ('Nombre de tu tienda', 'PEGAR-UUID-DEL-USUARIO');

-- Vincular perfil al establecimiento
UPDATE public.profiles
SET establishment_id = (
  SELECT id FROM public.establishments
  WHERE owner_id = 'PEGAR-UUID-DEL-USUARIO'
)
WHERE id = 'PEGAR-UUID-DEL-USUARIO';
```

---

## 2. Configurar el proyecto localmente

```bash
# Clonar
git clone <url-del-repo>
cd negozio

# Instalar dependencias
npm install

# Configurar variables de entorno
# Editá .env.local con tus claves de Supabase:
```

**.env.local**:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 3. Seed de datos de prueba

Crea un establecimiento demo con 20 productos, 3 usuarios y ventas de ejemplo.

```bash
npx tsx scripts/seed.ts
```

Credenciales que crea:

| Email | Contraseña | Rol |
|---|---|---|
| `owner@demo.com` | `demo1234` | Owner (dueño) |
| `caja@demo.com` | `demo1234` | Cashier (cajero) |
| `empleado@demo.com` | `demo1234` | Employee (empleado) |

---

## 4. Desarrollo

```bash
# Servidor de desarrollo
npm run dev
# → http://localhost:3000

# Verificar tipos TypeScript
npm run type-check

# Lint
npm run lint

# Formatear código
npm run format
```

---

## 5. Estructura del proyecto

```
negozio/
├── app/
│   ├── dashboard/          # Panel del owner
│   │   ├── productos/      # Gestión de productos
│   │   └── configuracion/  # Settings
│   ├── caja/               # POS (dark theme, fullscreen)
│   ├── empleados/
│   │   ├── ingreso-mercaderia/   # Recepción de stock
│   │   └── venta-externa/        # Ventas móvil (mobile-first)
│   ├── login/
│   ├── 403/                # Acceso denegado
│   └── layout.tsx          # Root layout con AuthProvider + Toaster
│
├── components/
│   ├── ui/                 # Design system (Button, Input, Table, Toast…)
│   ├── layout/             # Sidebar, TopBar
│   ├── auth/               # LoginForm, AuthProvider
│   ├── dashboard/          # StatsCards, SalesChart, etc.
│   ├── products/           # BarcodeInput, ProductForm, ProductTable
│   ├── stock/              # OrderItemList, SupplierSelector
│   ├── caja/               # CajaScanner, PaymentPanel, TicketModal
│   ├── external-sales/     # MobileScanner, ExternalItemList
│   └── config/             # BusinessTab, UsersTab, PermissionsTab…
│
├── hooks/                  # useAuth, useCaja, useDashboard, useToast…
├── store/                  # Zustand stores (auth, caja, externalSale)
├── lib/
│   ├── supabase/           # client, server, middleware, actions, admin
│   ├── utils/              # cn, formatCurrency, csv, errors
│   └── validations/        # Schemas Zod
├── types/database.ts       # Tipos TypeScript del schema
├── scripts/seed.ts         # Datos de prueba
└── supabase/               # Scripts SQL
```

---

## 6. Roles y accesos

| Ruta | Owner | Cashier | Employee |
|---|:---:|:---:|:---:|
| `/dashboard/*` | ✅ | ❌ | ❌ |
| `/caja` | ✅ | ✅ | ❌ |
| `/empleados/*` | ✅ | ❌ | ✅ |

---

## 7. Logos

Pegar los archivos en `public/logos/`:

```
public/logos/
├── negozio-icon-principal.png       ← sidebar colapsado, login
├── negozio-textogrueso-largo.png    ← sidebar expandido
├── negozio-textofino-largo.png
├── negozio-textogrueso-letras.png   ← login (solo texto)
└── negozio-textofino-letras.png
```

---

## 8. Verificar triggers de la DB

Después de correr el seed, verificar en SQL Editor:

```sql
-- 1. Trigger de stock: insertar movimiento y verificar que se actualiza
SELECT stock FROM establishment_products WHERE id = '<ep_id>';

INSERT INTO stock_movements (
  establishment_product_id, type, reason,
  quantity, previous_stock, new_stock, created_by
) VALUES (
  '<ep_id>', 'in', 'manual', 10, <stock_actual>, <stock_actual + 10>, '<user_id>'
);

-- El stock debería haberse actualizado automáticamente:
SELECT stock FROM establishment_products WHERE id = '<ep_id>';

-- 2. Trigger de historial de precios:
UPDATE establishment_products SET price = 999 WHERE id = '<ep_id>';
SELECT * FROM product_price_history WHERE establishment_product_id = '<ep_id>';
```

---

## 9. Deploy

El proyecto está preparado para deploy en **Vercel**:

```bash
# Conectar con Vercel CLI
npx vercel

# Variables de entorno en Vercel → Settings → Environment Variables:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```
