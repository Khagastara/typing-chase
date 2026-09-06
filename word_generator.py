import random

class KamusWordGenerator:
    def __init__(self, path_wordlist):
        with open(path_wordlist, "r", encoding="utf-8") as f:
            self.daftar_kata = [baris.strip() for baris in f if baris.strip()]

    def generate_words_adaptif(self, jumlah, panjang_min=0, huruf_prioritas=None):
        kandidat_dasar = [k for k in self.daftar_kata if len(k) >= panjang_min]
        if not kandidat_dasar:
            kandidat_dasar = self.daftar_kata

        kandidat_prioritas = []
        if huruf_prioritas:
            kandidat_prioritas = [
                k for k in kandidat_dasar
                if any(huruf in k for huruf in huruf_prioritas)
            ]

        jumlah_prioritas = min(len(kandidat_prioritas), jumlah // 2)
        hasil_prioritas = random.sample(kandidat_prioritas, jumlah_prioritas) if jumlah_prioritas > 0 else []

        sisa = jumlah - len(hasil_prioritas)
        hasil_biasa = random.sample(kandidat_dasar, min(sisa, len(kandidat_dasar)))

        hasil = hasil_prioritas + hasil_biasa
        random.shuffle(hasil)
        return hasil

    def cari_kata_dengan_huruf(self, daftar_huruf, jumlah=5):
        kandidat = [
            kata for kata in self.daftar_kata
            if any(huruf in kata for huruf in daftar_huruf)
        ]

        if not kandidat:
            return random.sample(self.daftar_kata, min(jumlah, len(self.daftar_kata)))

        return random.sample(kandidat, min(jumlah, len(kandidat)))