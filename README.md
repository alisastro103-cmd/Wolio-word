# 📝 Wolio Word

Editor Markdown gaya VSCode yang berjalan **100% offline** di browser — tanpa server, tanpa build step, tanpa framework. Tulis, review, dan kelola dokumen Markdown langsung dari satu proyek statis, bisa juga di-install sebagai aplikasi (PWA) di HP maupun laptop.

🔗 **Live demo:** [wolio-word.vercel.app](https://wolio-word.vercel.app)

![Made with Vanilla JS](https://img.shields.io/badge/made%20with-vanilla%20JS-f7df1e)
![Offline First](https://img.shields.io/badge/offline-first-success)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Fitur

- ✅ Mode **Editor**, **Review**, dan **Split** (berdampingan)
- ✅ **Multi-tab** — buka beberapa dokumen sekaligus, dengan indikator "belum disimpan"
- ✅ **Autosave** ke `localStorage` — perubahan tidak hilang saat refresh
- ✅ **Riwayat versi (checkpoint)** per tab
- ✅ **Command Palette** (`Ctrl+K`) dan **Cari & Ganti** (`Ctrl+F`)
- ✅ **Daftar Isi (Outline)** otomatis dari heading
- ✅ Parser Markdown vanilla JS sendiri: heading, bold/italic/strikethrough, kode inline & blok dengan syntax highlight, tabel, task list, blockquote (termasuk nested), link, gambar
- ✅ Dukungan diagram **Mermaid** (lazy-load dari CDN, opsional)
- ✅ Impor `.md` / `.markdown` / `.txt`
- ✅ Ekspor ke `.md`, `.txt`, `.html` (mandiri/standalone), atau `.pdf` (via dialog cetak browser)
- ✅ **PWA installable** — bisa dipasang di HP/desktop dan dibuka tanpa internet lewat service worker
- ✅ Tema terang / gelap
- ✅ Tanpa CDN wajib, tanpa dependensi build — semua vanilla HTML/CSS/JS

## Isi proyek

```
wolio-word/
├── index.html      ← landing page (buka ini untuk info & link ke app)
├── app.html        ← aplikasi editor-nya, buka ini untuk mulai menulis
├── style.css       ← semua tampilan/CSS
├── script.js       ← semua logika (parser Markdown, editor, tab, impor-ekspor)
├── sw.js           ← service worker (cache offline-first untuk PWA)
├── manifest.json   ← metadata PWA (nama, ikon, tema)
├── fonts/          ← font lokal (Atkinson Hyperlegible, Fraunces)
├── icons/          ← ikon PWA & Open Graph image
└── wolio-logo.svg
```

Semua file harus tetap dalam satu folder karena saling terhubung lewat path relatif.

## Cara pakai

1. Buka `index.html` di browser (double click, tidak perlu instalasi), atau langsung akses [live demo](https://wolio-word.vercel.app).
2. Tulis Markdown di panel **Editor**.
3. Klik **Review** atau **Split** untuk lihat hasil render.
4. Gunakan ikon gerigi (⚙) untuk **impor** file `.md`/`.txt` yang sudah ada, atau **ekspor** hasil kerja.
5. (Opsional) Install sebagai aplikasi lewat tombol "Install" di address bar browser — setelah itu bisa dibuka tanpa koneksi internet.

Panduan sintaks Markdown lengkap: lihat [`CARA-PAKAI-MARKDOWN.md`](CARA-PAKAI-MARKDOWN.md).

## Roadmap

- [ ] Konversi ke Android APK (Capacitor / WebView wrapper)
- [ ] Sinkronisasi antar-perangkat (opsional, tetap offline-first)
- [ ] Export ke `.docx`
- [ ] Word count goal / mode fokus menulis (distraction-free)

## Teknologi

Vanilla HTML, CSS, dan JavaScript murni — tanpa framework, tanpa build step, tanpa koneksi internet yang dibutuhkan (kecuali fitur diagram Mermaid, sekali saat pertama dipakai).

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan dibagikan.

---

Copyright 2026 ASTR-0123 — All rights reserved.
