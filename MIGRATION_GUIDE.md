# Panduan Migrasi Skema Prisma (Aman dari Kehilangan Data)

Panduan ini ditujukan agar Anda bisa mengubah struktur database (schema) pada project `wpos-next` tanpa risiko kehilangan atau tertimpanya data (khususnya untuk *breaking changes* seperti mengubah nama kolom, tipe data, atau memecah tabel).

## Masalah dengan `prisma db push`
Perintah `prisma db push` **sangat berbahaya** digunakan jika aplikasi Anda sudah berjalan atau jika ada data penting di dalam tabel. Jika Anda mengubah nama kolom (misal: `notes` menjadi `description`), `db push` tidak tahu bahwa Anda sekadar mengubah nama. Ia akan mengira Anda menghapus kolom `notes` (beserta semua isinya) dan membuat kolom baru `description` yang masih kosong.

Oleh karena itu, gunakan **Prisma Migrations (`prisma migrate dev`)** untuk melacak setiap perubahan skema.

---

## SOP (Standard Operating Procedure) Perubahan Skema Besar

Ikuti langkah-langkah di bawah ini setiap kali Anda melakukan modifikasi pada `prisma/schema.prisma` yang berpotensi menghilangkan data.

### Langkah 1: Buat Backup Data (Opsional tapi Direkomendasikan)
Sebagai jaring pengaman utama, lakukan ekspor data sebelum menyentuh perintah migrasi apa pun.
```bash
npm run db:backup
```
*Ini akan membuat salinan seluruh data ke dalam bentuk file `.json` di dalam folder `prisma/backups/`.*

### Langkah 2: Ubah file `schema.prisma`
Lakukan perubahan sesuai kebutuhan Anda. Contoh: kita ingin mengubah kolom `notes` menjadi `description` di model `Transaction`.

```diff
model Transaction {
  id                String            @id @default(cuid())
- notes             String?
+ description       String?
  // ... kolom lainnya
}
```

### Langkah 3: Buat File Migrasi (Jangan Dijalankan Dulu!)
Jalankan perintah berikut di terminal:
```bash
npx prisma migrate dev --name rename_notes_to_description --create-only
```
- `--name` = Nama migrasi (gunakan underscore).
- `--create-only` = **Sangat Penting!** Ini menyuruh Prisma hanya membuatkan file `.sql` tanpa mengeksekusinya ke database.

### Langkah 4: Edit File `.sql` Migrasi
Buka folder `prisma/migrations/`. Anda akan melihat folder baru (misal: `20260826123456_rename_notes_to_description/migration.sql`).

Buka file `migration.sql` tersebut. Secara *default*, isinya mungkin terlihat seperti ini:
```sql
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "notes",
ADD COLUMN "description" TEXT;
```
*(Perhatikan bahwa `DROP COLUMN` akan menghapus semua data Anda di kolom tersebut!)*

Ubah isi file SQL tersebut secara manual menjadi perintah `RENAME COLUMN`:
```sql
-- AlterTable (Modified manually to prevent data loss)
ALTER TABLE "transactions" RENAME COLUMN "notes" TO "description";
```

### Langkah 5: Terapkan Migrasi
Setelah file SQL diedit dan aman, jalankan kembali migrasi tanpa flag `--create-only`:
```bash
npx prisma migrate dev
```
Prisma akan menemukan file migrasi yang sudah Anda edit tadi, menerapkannya ke database PostgreSQL, dan mengupdate Prisma Client. 

**Hasilnya: Skema berubah, dan Data Anda tetap aman tanpa perlu repot restore dari file backup!**

---

## Kapan Boleh Menggunakan `prisma db push`?
Hanya gunakan `prisma db push` jika Anda:
1. Sedang *prototyping* dari awal dan belum ada data penting sama sekali.
2. Melakukan perubahan yang hanya bersifat menambah tabel atau kolom baru (non-destructive).

Jika ragu, selalu gunakan `npm run db:backup` dan *Prisma Migrations*.
