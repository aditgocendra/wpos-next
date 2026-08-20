# Product Requirements Document (PRD) - Warehouse & POS Integrated System (WPOS)

## 1. Project Overview
**WPOS** adalah aplikasi manajemen stok multi-gudang yang terintegrasi dengan fitur Point of Sale (POS) untuk kasir. Aplikasi ini dirancang untuk menangani kompleksitas inventaris di beberapa lokasi dengan fokus pada akurasi perhitungan Harga Pokok Penjualan (HPP) menggunakan metode **Monthly Moving Average**.

## 2. Goals & Objectives
- Sinkronisasi stok secara real-time di seluruh lokasi gudang.
- Pengelolaan kategori produk secara hierarkis (multi-level).
- Perhitungan HPP yang akurat dan konsisten per periode bulan.
- Antarmuka POS yang dioptimalkan untuk kecepatan kerja kasir.
- Keamanan data dengan pembatasan akses berdasarkan peran pengguna (RBAC).

## 3. Target Audience & RBAC (Role-Based Access Control)
- **Super Admin:** Akses penuh ke seluruh fitur, laporan konsolidasi, manajemen user, dan pengaturan sistem.
- **Warehouse Admin:** Mengelola stok, mutasi, dan melihat laporan untuk gudang yang ditugaskan.
- **Cashier:** Mengoperasikan modul POS untuk transaksi penjualan (terkunci pada gudang/toko tertentu).

## 4. Functional Requirements

### 4.1. Warehouse & Inventory Management
- **Multi-Warehouse Support:** Manajemen data banyak lokasi gudang.
- **Stock Tracking:** Monitoring jumlah stok produk di setiap gudang secara mendetail.
- **Stock Mutation:** Perpindahan barang antar gudang dengan status pelacakan (Pending, Received, Cancelled).
- **Stock Adjustment:** Penyesuaian stok untuk barang rusak, hilang, atau hasil opname.

### 4.2. Simplified POS (Cashier-Only)
- **Fast Entry:** Input produk cepat menggunakan barcode scanner atau pencarian nama.
- **Direct List:** Tidak menggunakan alur "Shopping Cart" konvensional; item langsung masuk ke daftar transaksi aktif.
- **Warehouse Selector:** Penjualan memotong stok dari gudang yang dipilih (default berdasarkan lokasi kasir).
- **Instant Checkout:** Pembayaran cepat dengan metode Cash, QRIS, atau Transfer.

### 4.3. Multi-level Category Management
- **Hierarchical Categories:** Mendukung struktur kategori tak terbatas (contoh: Elektronik > Komputer > Laptop).
- **Category Tree:** Navigasi produk berdasarkan struktur kategori.

### 4.4. Monthly Cost Ledger (HPP Logic)
- **Moving Average Calculation:** HPP dihitung ulang setiap kali ada stok masuk:
  `((Stok Lama * Avg Cost Lama) + (Stok Baru * Harga Beli Baru)) / Total Stok Baru`.
- **Monthly Ledger:** 
  - Setiap awal bulan, sistem mengambil HPP akhir bulan lalu sebagai saldo awal.
  - HPP "dikunci" per periode bulan untuk memastikan integritas laporan historis.
- **Transaction Snapshot:** Saat transaksi POS terjadi, nilai `selling_price` dan `avg_cost` saat itu disalin (snapshot) ke dalam detail transaksi.

### 4.5. Reporting & Analytics
- **Sales Reports:** Laporan harian, mingguan, dan bulanan.
- **Profit & Loss:** Perhitungan laba berdasarkan selisih harga jual dan snapshot HPP.
- **Inventory Audit:** Sejarah perubahan stok per produk dan per gudang.

### 4.6. Authentication & Security
- **Secure Login:** Menggunakan NextAuth.js dengan hashing password bcrypt.
- **Route Protection:** Middleware untuk membatasi akses URL berdasarkan role pengguna.
- **Data Isolation:** Memastikan admin gudang/kasir hanya bisa melihat/mengelola data gudang mereka sendiri.

## 5. Non-Functional Requirements
- **Performance:** Pencarian produk di POS harus di bawah 200ms.
- **Consistency:** Data stok harus akurat dan terlindungi dari race conditions (ACID compliant).
- **Scalability:** Struktur database mendukung ribuan SKU dan transaksi harian.
- **Responsiveness:** Dashboard dioptimalkan untuk Desktop dan Tablet.

## 6. Technical Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Shadcn/UI
- **Database:** PostgreSQL via Prisma ORM
- **Authentication:** NextAuth.js
- **State Management:** Zustand (untuk logic POS)
- **Deployment:** Vercel (CI/CD via GitHub)

## 7. Arsitektur Kode & Separation of Concerns
Sistem menggunakan alur eksekusi berlapis (layered architecture) di mana seluruh logika bisnis terisolasi di Service Layer dan teruji penuh melalui Unit Testing:

[ Middleware / Auth Guard ] --> Memeriksa cookie sesi & memvalidasi Role (RBAC)
          │
          ▼
[ Page (App Router) ]       --> Server-side layout & async page route handling
          │
          ▼
[ UI Components ]           --> Client/Server Components (Form, Table, State & Modal)
          │
          ▼
[ API Route / Action ]      --> Request Validation (Zod), Auth Check, HTTP Status Response
          │
          ▼
[ Service Layer ]           --> Business Logic: Cek stok, hitung total, atur alur transaksi
    ▲          │
    │          ▼
[ Unit Test ] [ Data Access / DB ] --> Prisma Transactions & Queries (Vitest + Prisma Mock)

## 8. Struktur Pohon Direktori Terintegrasi
src/
├── app/                        <-- ROUTING & PAGES (App Router)
│   ├── (auth)/                 <-- Rute Otentikasi
│   │   ├── login/
│   │   │   └── page.tsx        <-- Halaman Form Login
│   │   └── unassigned/
│   │       └── page.tsx        <-- Halaman Akses Terbatas
│   ├── (dashboard)/            <-- Layout Khusus Admin & Gudang
│   │   ├── warehouses/
│   │   │   ├── page.tsx        <-- Halaman Daftar Gudang
│   │   │   └── [id]/
│   │   │       └── page.tsx    <-- Halaman Detail & Stok Gudang
│   │   └── transfers/
│   │       ├── page.tsx        <-- Halaman Daftar Transfer Stok
│   │       └── new/
│   │           └── page.tsx    <-- Halaman Form Buat Transfer
│   ├── (pos)/                  <-- Layout Fullscreen Khusus Kasir
│   │   └── pos/
│   │       └── page.tsx        <-- Halaman Utama Aplikasi Kasir
│   └── api/                    <-- HTTP API ENDPOINTS
│       ├── auth/
│       │   ├── login/
│       │   │   └── route.ts
│       │   ├── logout/
│       │   │   └── route.ts
│       │   └── me/
│       │       └── route.ts
│       ├── warehouses/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── stocks/
│       │       │   └── route.ts
│       │       └── adjust-stock/
│       │           └── route.ts
│       ├── transfers/
│       │   ├── route.ts
│       │   └── [id]/
│       │       └── execute/
│       │           └── route.ts
│       └── pos/
│           └── checkout/
│               └── route.ts
├── components/                 <-- UI COMPONENTS LAYER
│   ├── ui/                     <-- Reusable Primitives (Button, Input, Modal, Table)
│   ├── auth/                   <-- Komponen Spesifik Auth
│   │   ├── LoginForm.tsx
│   │   └── UserMenu.tsx
│   ├── warehouse/              <-- Komponen Spesifik Gudang
│   │   ├── WarehouseTable.tsx
│   │   └── AdjustStockModal.tsx
│   ├── transfer/               <-- Komponen Spesifik Transfer
│   │   └── TransferForm.tsx
│   └── pos/                    <-- Komponen Spesifik Kasir
│       ├── ProductGrid.tsx
│       ├── CartSidebar.tsx
│       └── PaymentModal.tsx
├── services/                   <-- BUSINESS LOGIC LAYER
│   ├── __tests__/              <-- UNIT TESTS FOR SERVICES (VITEST)
│   │   ├── auth.service.test.ts
│   │   ├── warehouse.service.test.ts
│   │   ├── inventory.service.test.ts
│   │   └── order.service.test.ts
│   ├── auth.service.ts
│   ├── warehouse.service.ts
│   ├── inventory.service.ts
│   └── order.service.ts
├── middleware.ts               <-- PROTEKSI ROUTE UTAMA (Next.js Middleware)
├── lib/                        <-- UTILITIES & CONFIGS
│   ├── __mocks__/              <-- PRISMA MOCK SETUP FOR TESTS
│   │   └── prisma.ts
│   ├── prisma.ts               <-- Prisma Client Instance
│   ├── auth.ts                 <-- Helper Token/Session Management
│   └── validations/            <-- Zod Schemas
│       ├── auth.schema.ts
│       ├── warehouse.schema.ts
│       ├── transfer.schema.ts
│       └── pos.schema.ts
└── vitest.config.ts            <-- KONFIGURASI VITEST

## 9. Deployment Strategy
- Integrasi otomatis dengan GitHub.
- Environment variable (Database URL, Auth Secret) dikelola di dashboard Vercel.
- Migrasi database otomatis dijalankan saat proses deployment.
