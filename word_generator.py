import random

class KamusWordGenerator:
    def __init__(self, path_wordlist, path_corpus_kalimat=None):
        with open(path_wordlist, "r", encoding="utf-8") as f:
            self.daftar_kata = [baris.strip() for baris in f if baris.strip()]

        self.daftar_kalimat = []
        if path_corpus_kalimat:
            with open(path_corpus_kalimat, "r", encoding="utf-8") as f:
                self.daftar_kalimat = [baris.strip().split() for baris in f if baris.strip()]

    def generate_words(self, jumlah):
        return random.sample(self.daftar_kata, min(jumlah, len(self.daftar_kata)))

    def cari_kata_dengan_huruf(self, daftar_huruf, jumlah=5):
        kandidat = [
            kata for kata in self.daftar_kata
            if any(huruf in kata for huruf in daftar_huruf)
        ]

        if not kandidat:
            return random.sample(self.daftar_kata, min(jumlah, len(self.daftar_kata)))

        return random.sample(kandidat, min(jumlah, len(kandidat)))

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

    def generate_words_puisi(self, jumlah, panjang_span_min=2, panjang_span_maks=5):
        """
        Mengambil potongan acak (2-5 kata berurutan) dari kalimat-kalimat
        berbeda di corpus_kalimat.txt, lalu menyambungnya. Tiap potongan
        tetap gramatikal karena berasal dari kalimat asli, tapi rangkaian
        akhirnya terasa acak dan puitis karena sumbernya berpindah-pindah,
        mirip teknik cut-up dalam puisi. Tidak menyentuh wordlist.txt sama
        sekali, murni dari corpus_kalimat.
        """
        if not self.daftar_kalimat:
            return []

        hasil = []
        while len(hasil) < jumlah:
            kalimat = random.choice(self.daftar_kalimat)

            if len(kalimat) < panjang_span_min:
                hasil.extend(kalimat)
                continue

            panjang_span = random.randint(panjang_span_min, min(panjang_span_maks, len(kalimat)))
            mulai = random.randint(0, len(kalimat) - panjang_span)
            potongan = kalimat[mulai:mulai + panjang_span]
            hasil.extend(potongan)

        return hasil[:jumlah]

    def generate_words_campuran(self, jumlah, panjang_min=0, huruf_prioritas=None):
        jumlah_kalimat = int(jumlah * 0.7)
        jumlah_random = jumlah - jumlah_kalimat

        dari_kalimat = self.generate_words_kalimat(jumlah_kalimat)
        dari_random = self.generate_words_adaptif(jumlah_random, panjang_min, huruf_prioritas)

        return dari_kalimat + dari_random