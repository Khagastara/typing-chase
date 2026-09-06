# Typing Chase

Game typing berbasis Flask dengan sistem kesulitan adaptif menggunakan model regresi linear sederhana yang dilatih dari data permainan.

## Fitur

- Kata muncul baris per baris dengan animasi real-time
- Sistem 5 hati, typo dan kata tenggelam sama-sama mengurangi hati
- Kesulitan (kecepatan dan panjang kata) menyesuaikan otomatis berdasarkan WPM pengunjung
- Model regresi dilatih dari riwayat permainan sebelumnya untuk memprediksi tingkat kesulitan ideal
- Rekam jejak pengunjung berdasarkan nama, kesulitan awal menyesuaikan riwayat sesi sebelumnya
- Leaderboard dengan pagination (10 besar per halaman, bisa navigasi ke ranking bawah)

## Struktur Proyek

```
typing-chase/
├── app.py                  # Backend Flask, routing, model regresi, logika skor
├── word_generator.py       # Pengambilan kata dari wordlist (KamusWordGenerator)
├── wordlist.txt             # Daftar kata bahasa Indonesia (KBBI atau kata IT)
├── requirements.txt        # Daftar dependency Python
│
├── static/
│   ├── style.css            # Tampilan visual game
│   └── script.js             # Logika permainan, animasi, komunikasi ke backend
│
└── templates/
    └── index.html           # Halaman utama game
```

File yang otomatis terbuat sendiri saat aplikasi dijalankan (tidak perlu dibuat manual, dan sebaiknya masuk `.gitignore`):

```
leaderboard.json       # Skor dan ranking seluruh pengunjung
game_history.json      # Riwayat WPM dan waktu_per_kata tiap sesi, dipakai melatih model
mistake_log.json       # Kumulatif huruf yang sering salah dan latensi ketik per huruf
player_history.json    # Riwayat tiap pengunjung berdasarkan nama
```

## Requirements

- Python 3.9 ke atas
- Flask

Isi `requirements.txt`:

```
Flask
```

## Cara Menjalankan (setelah clone)

```
git clone <url-repo-ini>
cd typing-chase
python -m venv venv
```

Aktivasi virtual environment.

Windows:
```
venv\Scripts\activate
```

Mac/Linux:
```
source venv/bin/activate
```

Install dependency:
```
pip install -r requirements.txt
```

Jalankan aplikasi:
```
py app.py
```

Kalau port 5000 bermasalah (umum terjadi di Windows), tambahkan port lain di `app.run()` dalam `app.py`, misalnya `app.run(debug=True, port=5001)`.

Buka browser ke:
```
http://127.0.0.1:5000
```

## Cara Kerja Sistem Adaptif (ringkas)

- Setiap sesi permainan mengirim `wpm`, `waktu_per_kata` yang dipakai, dan `skor` ke backend lewat `/submit_score`.
- Data itu disimpan di `game_history.json`, maksimal 500 entri terbaru.
- Saat sesi baru meminta kesulitan lewat `/get_difficulty`, backend melatih regresi linear sederhana dari seluruh riwayat (minimal 15 data), lalu memprediksi `waktu_per_kata` ideal untuk WPM pengunjung saat itu.
- Kalau data belum cukup (di bawah 15 sesi), sistem pakai aturan tetap sebagai fallback.
- Koefisien model bisa dicek langsung lewat endpoint `/model_info`.

## Endpoint Utama

| Endpoint | Method | Keterangan |
|---|---|---|
| `/` | GET | Halaman utama game |
| `/get_words` | GET | Ambil kata baru sesuai panjang minimal dan huruf prioritas |
| `/get_difficulty` | GET | Ambil waktu per kata hasil prediksi model berdasarkan WPM |
| `/player_start` | GET | Cek riwayat pengunjung berdasarkan nama |
| `/submit_score` | POST | Kirim hasil sesi, update leaderboard dan riwayat |
| `/leaderboard` | GET | Ambil data leaderboard per halaman |
| `/model_info` | GET | Lihat status dan koefisien model regresi saat ini |

## Catatan untuk Expo

- Pastikan `wordlist.txt` sudah terisi cukup banyak kata (disarankan ratusan) supaya variasi kata tidak cepat berulang.
- Sebaiknya jalankan aplikasi dari folder di luar OneDrive untuk menghindari gangguan sinkronisasi saat menulis file JSON secara real-time.
- Model regresi baru mulai aktif setelah minimal 15 sesi permainan tercatat, jadi di awal expo sistem masih memakai aturan tetap sebagai fallback.
