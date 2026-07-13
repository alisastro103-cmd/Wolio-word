# 📝 Wolio Word

Editor Markdown gaya VSCode yang berjalan **100% offline** di browser — tanpa server, tanpa build step, tanpa framework. Tulis, review, dan kelola dokumen Markdown langsung dari satu proyek statis.

## Fitur

- ✅ Mode **Editor**, **Review**, dan **Split** (berdampingan)
- ✅ **Multi-tab** — buka beberapa dokumen sekaligus
- ✅ **Autosave** ke `localStorage` — perubahan tidak hilang saat refresh
- ✅ **Riwayat versi (checkpoint)** per tab
- ✅ **Command Palette** (`Ctrl+K`) dan **Cari & Ganti** (`Ctrl+F`)
- ✅ **Daftar Isi (Outline)** otomatis dari heading
- ✅ Parser Markdown vanilla JS sendiri: heading, bold/italic/strikethrough, kode inline & blok dengan syntax highlight, tabel, task list, blockquote (termasuk nested), link, gambar
- ✅ Dukungan diagram **Mermaid** (lazy-load dari CDN, opsional)
- ✅ Impor `.md` / `.markdown` / `.txt`
- ✅ Ekspor ke `.md`, `.txt`, `.html` (mandiri/standalone), atau `.pdf` (via dialog cetak browser)
- ✅ Tema terang / gelap
- ✅ Tanpa CDN wajib, tanpa dependensi build — semua vanilla HTML/CSS/JS

## Isi proyek

```
wolio-word/
├── index.html     ← landing page (buka ini untuk info & link ke app)
├── app.html       ← aplikasi editor-nya, buka ini untuk mulai menulis
├── style.css      ← semua tampilan/CSS
├── script.js      ← semua logika (parser Markdown, editor, tab, impor-ekspor)
├── fonts/         ← font lokal (Fraunces)
└── wolio-logo.svg
```

`index.html`, `style.css`, dan `script.js` harus tetap dalam satu folder karena saling terhubung lewat path relatif.

## Cara pakai

1. Buka `index.html` di browser (double click, tidak perlu instalasi).
2. Tulis Markdown di panel **Editor**.
3. Klik **Review** atau **Split** untuk lihat hasil render.
4. Gunakan ikon gerigi (⚙) untuk **impor** file `.md`/`.txt` yang sudah ada, atau **ekspor** hasil kerja.

Panduan sintaks Markdown lengkap: lihat [`CARA-PAKAI-MARKDOWN.md`](CARA-PAKAI-MARKDOWN.md).

## Roadmap

- [ ] Konversi ke Android APK (Capacitor / WebView wrapper)
- [ ] Sinkronisasi antar-perangkat (opsional, tetap offline-first)

## Teknologi

Vanilla HTML, CSS, dan JavaScript murni — tanpa framework, tanpa build step, tanpa koneksi internet yang dibutuhkan (kecuali fitur diagram Mermaid, sekali saat pertama dipakai).

## Lisensi

MIT
