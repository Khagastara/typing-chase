const track = document.getElementById("track");
const wordRow = document.getElementById("word-row");
const timerDisplay = document.getElementById("timer");
const wpmDisplay = document.getElementById("wpm");
const mulaiBtn = document.getElementById("mulai-btn");
const hasilAkhir = document.getElementById("hasil-akhir");
const ringkasan = document.getElementById("ringkasan");
const leaderboardList = document.getElementById("leaderboard-list");
const ulangiBtn = document.getElementById("ulangi-btn");
const prevPageBtn = document.getElementById("prev-page-btn");
const nextPageBtn = document.getElementById("next-page-btn");
const pageIndicator = document.getElementById("page-indicator");
const namaInput = document.getElementById("nama-input");
const raceBarPlayer = document.getElementById("race-bar-player");
const raceBarAI = document.getElementById("race-bar-ai");
const raceStatus = document.getElementById("race-status");

const DURASI_SESI = 60;

let aiWpm = 25;
let aiKataSelesaiTotal = 0;
let terakhirFrameAI = null;
let stackSekarang = 0;
let stackTertinggi = 0;

let namaSekarang = "Anonim";
let waktuPerKataSaatIni = 2.5;
let latensiHuruf = {};
let waktuKeydownTerakhir = null;
let daftarKata = [];
let indeksAktif = 0;
let ketikanSekarang = "";
let jumlahTypo = 0;
let kataBenar = 0;
let karakterBenar = 0;
let totalKarakterDiketik = 0;
let kesalahanHuruf = {};
let waktuMulai = null;
let waktuMulaiBaris = null;
let permainanBerjalan = false;
let animasiId = null;
let sedangMengambilKata = false;
let wpmSaatIni = 0;
let halamanLeaderboardSekarang = 1;

function tentukanTingkatKesulitan(wpm) {
    if (wpm < 20) return { panjangMin: 3, waktuPerKata: 3.5 };
    else if (wpm < 40) return { panjangMin: 5, waktuPerKata: 2.5 };
    else if (wpm < 60) return { panjangMin: 7, waktuPerKata: 1.8 };
    else return { panjangMin: 9, waktuPerKata: 1.3 };
}

async function ambilKesulitanDariServer(wpm) {
    try {
        const respon = await fetch(`/get_difficulty?wpm=${wpm}`);
        const data = await respon.json();
        waktuPerKataSaatIni = data.waktu_per_kata;
        return data;
    } catch (err) {
        const fallback = tentukanTingkatKesulitan(wpm);
        waktuPerKataSaatIni = fallback.waktuPerKata;
        return { panjang_min: fallback.panjangMin, waktu_per_kata: fallback.waktuPerKata };
    }
}

async function tambahKataBaru() {
    if (sedangMengambilKata) return;
    sedangMengambilKata = true;

    const kesulitan = await ambilKesulitanDariServer(wpmSaatIni);
    const hurufUrutan = Object.entries(kesalahanHuruf)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(item => item[0])
        .join("");

    const kataBaru = await ambilKataBaru(15, kesulitan.panjang_min, hurufUrutan);
    const indeksAwal = daftarKata.length;
    const objekBaru = kataBaru.map(teks => ({ teks, selesai: false }));
    daftarKata = daftarKata.concat(objekBaru);

    tambahkanElemenBaru(objekBaru, indeksAwal);
    sedangMengambilKata = false;
}

async function ambilKataBaru(jumlah, panjangMin = 0, hurufPrioritas = "") {
    const params = new URLSearchParams({ jumlah, panjang_min: panjangMin, huruf: hurufPrioritas });
    const respon = await fetch(`/get_words?${params.toString()}`);
    const data = await respon.json();
    return data.words;
}

function buatHtmlHurufAktif(teks) {
    let html = "";
    for (let i = 0; i < teks.length; i++) {
        const huruf = teks[i];
        if (i < ketikanSekarang.length) {
            html += ketikanSekarang[i] === huruf
                ? `<span class="huruf-benar">${huruf}</span>`
                : `<span class="huruf-salah">${huruf}</span>`;
        } else {
            html += `<span class="huruf-belum">${huruf}</span>`;
        }
    }
    return html;
}

function renderSemuaKata() {
    wordRow.innerHTML = "";
    daftarKata.forEach((kata, i) => {
        const span = document.createElement("span");
        span.classList.add("kata-item");
        span.dataset.index = i;
        isiKontenKata(span, kata, i);
        wordRow.appendChild(span);
    });
}

function isiKontenKata(elemen, kata, indeks) {
    elemen.classList.remove("aktif", "selesai", "gagal");
    if (kata.gagal) {
        elemen.classList.add("gagal");
        elemen.textContent = kata.teks;
    } else if (kata.selesai) {
        elemen.classList.add("selesai");
        elemen.textContent = kata.teks;
    } else if (indeks === indeksAktif) {
        elemen.classList.add("aktif");
        elemen.innerHTML = buatHtmlHurufAktif(kata.teks);
    } else {
        elemen.textContent = kata.teks;
    }
}

function perbaruiEfekKata(indeks) {
    if (indeks < 0 || indeks >= daftarKata.length) return;
    const elemen = wordRow.querySelector(`[data-index="${indeks}"]`);
    if (!elemen) return;
    isiKontenKata(elemen, daftarKata[indeks], indeks);
}

function tambahkanElemenBaru(kataArray, indeksAwal) {
    kataArray.forEach((kata, i) => {
        const span = document.createElement("span");
        span.classList.add("kata-item", "kata-muncul");
        span.dataset.index = indeksAwal + i;
        isiKontenKata(span, kata, indeksAwal + i);
        wordRow.appendChild(span);
    });
}

function hitungInfoBaris() {
    const elemenSemua = Array.from(wordRow.children);
    if (elemenSemua.length === 0) return { jumlahBaris: 0, jumlahBarisPertama: 0 };

    const topUnik = [...new Set(elemenSemua.map(el => el.offsetTop))];
    const topPertama = elemenSemua[0].offsetTop;

    let jumlahBarisPertama = 0;
    for (const elemen of elemenSemua) {
        if (elemen.offsetTop === topPertama) jumlahBarisPertama++;
        else break;
    }

    return { jumlahBaris: topUnik.length, jumlahBarisPertama };
}

function cekPergantianBaris() {
    const info = hitungInfoBaris();
    if (info.jumlahBarisPertama === 0) return;

    const barisSelesai = daftarKata.slice(0, info.jumlahBarisPertama).every(k => k.selesai);

    if (barisSelesai) {
        daftarKata.splice(0, info.jumlahBarisPertama);
        indeksAktif = Math.max(indeksAktif - info.jumlahBarisPertama, 0);
        waktuMulaiBaris = Date.now();
        renderSemuaKata();
    }
}

function perbaruiRaceBar() {
    const kataAI = Math.floor(aiKataSelesaiTotal);
    const maksNilai = Math.max(kataBenar, kataAI, 1);

    raceBarPlayer.style.width = `${(kataBenar / maksNilai) * 100}%`;
    raceBarAI.style.width = `${(kataAI / maksNilai) * 100}%`;
}

function perbaruiStackDisplay() {
    raceStatus.textContent = `x${stackSekarang}`;
    raceStatus.classList.remove("stack-naik");
    void raceStatus.offsetWidth;
    raceStatus.classList.add("stack-naik");
}

async function mulaiPermainan() {
    mulaiBtn.blur();
    namaSekarang = namaInput.value.trim() || "Anonim";

    const riwayat = await fetch(`/player_start?nama=${encodeURIComponent(namaSekarang)}`).then(r => r.json());
    const opponentData = await fetch(`/get_opponent?nama=${encodeURIComponent(namaSekarang)}`).then(r => r.json());
    aiWpm = opponentData.ai_wpm;
    aiKataSelesaiTotal = 0;
    terakhirFrameAI = null;
    stackSekarang = 0;
    stackTertinggi = 0;
    perbaruiStackDisplay();

    kesalahanHuruf = {};
    if (!riwayat.pemain_baru && riwayat.huruf_riwayat.length > 0) {
        riwayat.huruf_riwayat.forEach(huruf => { kesalahanHuruf[huruf] = 2; });
    }

    const wpmAwal = (!riwayat.pemain_baru && riwayat.rata_wpm) ? riwayat.rata_wpm : 0;
    wpmSaatIni = wpmAwal;

    const kesulitanAwal = await ambilKesulitanDariServer(wpmAwal);
    const hurufAwal = Object.keys(kesalahanHuruf).join("");
    const kataMentah = await ambilKataBaru(15, kesulitanAwal.panjang_min, hurufAwal);

    daftarKata = kataMentah.map(teks => ({ teks, selesai: false }));
    indeksAktif = 0;
    ketikanSekarang = "";
    jumlahTypo = 0;
    kataBenar = 0;
    karakterBenar = 0;
    totalKarakterDiketik = 0;
    latensiHuruf = {};
    waktuKeydownTerakhir = null;
    waktuMulai = Date.now();
    waktuMulaiBaris = Date.now();
    permainanBerjalan = true;

    hasilAkhir.classList.add("hidden");
    timerDisplay.textContent = `Sisa Waktu: ${DURASI_SESI}s`;
    timerDisplay.classList.remove("waktu-kritis");
    renderSemuaKata();

    if (hitungInfoBaris().jumlahBaris < 2) {
        await tambahKataBaru();
    }

    animasiId = requestAnimationFrame(gameLoop);
}

function gameLoop(waktuSekarang) {
    if (!permainanBerjalan) return;

    if (terakhirFrameAI === null) terakhirFrameAI = waktuSekarang;
    const deltaAI = (waktuSekarang - terakhirFrameAI) / 1000;
    terakhirFrameAI = waktuSekarang;
    aiKataSelesaiTotal += (aiWpm / 60) * deltaAI;

    const waktuBerjalan = (Date.now() - waktuMulai) / 1000;
    const sisaWaktu = Math.max(DURASI_SESI - waktuBerjalan, 0);
    wpmSaatIni = waktuBerjalan > 0 ? (kataBenar / waktuBerjalan) * 60 : 0;

    timerDisplay.textContent = `Sisa Waktu: ${sisaWaktu.toFixed(1)}s`;
    timerDisplay.classList.toggle("waktu-kritis", sisaWaktu <= 10);
    wpmDisplay.textContent = `WPM: ${wpmSaatIni.toFixed(1)}`;

    if (sisaWaktu <= 0) {
        akhiriPermainan();
        return;
    }

    cekWaktuBaris();
    perbaruiRaceBar();

    if (hitungInfoBaris().jumlahBaris <= 2) {
        tambahKataBaru();
    }

    animasiId = requestAnimationFrame(gameLoop);
}

function cekWaktuBaris() {
    const info = hitungInfoBaris();
    if (info.jumlahBarisPertama === 0 || waktuMulaiBaris === null) return;

    const batasWaktu = info.jumlahBarisPertama * waktuPerKataSaatIni;
    const waktuBerjalanBaris = (Date.now() - waktuMulaiBaris) / 1000;

    if (waktuBerjalanBaris > batasWaktu) {
        for (let i = 0; i < info.jumlahBarisPertama; i++) {
            if (!daftarKata[i].selesai) {
                daftarKata[i].selesai = true;
                daftarKata[i].gagal = true;
            }
        }
        stackSekarang = 0;
        perbaruiStackDisplay();
        ketikanSekarang = "";
        indeksAktif = info.jumlahBarisPertama;
        cekPergantianBaris();
    }
}

document.addEventListener("keydown", (e) => {
    if (!permainanBerjalan) return;
    if (indeksAktif >= daftarKata.length) return;

    const kataAktif = daftarKata[indeksAktif].teks;

    if (e.key === "Backspace") {
        e.preventDefault();
        if (ketikanSekarang.length > 0) {
            ketikanSekarang = ketikanSekarang.slice(0, -1);
            perbaruiEfekKata(indeksAktif);
        }
        return;
    }

    if (e.key === " ") {
        e.preventDefault();
        finalisasiKata();
        return;
    }

    if (e.key.length !== 1) return;
    if (ketikanSekarang.length >= kataAktif.length) return;

    totalKarakterDiketik += 1;
    const posisi = ketikanSekarang.length;
    const hurufDiketik = e.key.toLowerCase();

    const waktuSekarang = Date.now();
    if (waktuKeydownTerakhir !== null) {
        const selisih = waktuSekarang - waktuKeydownTerakhir;
        const hurufIni = kataAktif[posisi];
        if (!latensiHuruf[hurufIni]) latensiHuruf[hurufIni] = [];
        latensiHuruf[hurufIni].push(selisih);
    }
    waktuKeydownTerakhir = waktuSekarang;

    if (hurufDiketik === kataAktif[posisi]) {
        karakterBenar += 1;
    } else {
        jumlahTypo += 1;
        const hurufSeharusnya = kataAktif[posisi];
        kesalahanHuruf[hurufSeharusnya] = (kesalahanHuruf[hurufSeharusnya] || 0) + 1;
    }

    ketikanSekarang += hurufDiketik;
    perbaruiEfekKata(indeksAktif);
});

function finalisasiKata() {
    const indeksLama = indeksAktif;
    const kataAktif = daftarKata[indeksAktif].teks;

    if (ketikanSekarang === kataAktif) {
        kataBenar += 1;
        daftarKata[indeksAktif].selesai = true;
        stackSekarang += 1;
        if (stackSekarang > stackTertinggi) stackTertinggi = stackSekarang;
    } else {
        daftarKata[indeksAktif].selesai = true;
        daftarKata[indeksAktif].gagal = true;
        stackSekarang = 0;
    }

    perbaruiStackDisplay();
    ketikanSekarang = "";
    indeksAktif += 1;

    if (indeksAktif >= daftarKata.length) {
        akhiriPermainan();
        return;
    }

    perbaruiEfekKata(indeksLama);
    perbaruiEfekKata(indeksAktif);
    cekPergantianBaris();
}

async function akhiriPermainan() {
    permainanBerjalan = false;
    cancelAnimationFrame(animasiId);

    const waktuTotal = (Date.now() - waktuMulai) / 1000;
    const wpmAkhir = waktuTotal > 0 ? (kataBenar / waktuTotal) * 60 : 0;
    const akurasi = totalKarakterDiketik > 0 ? (karakterBenar / totalKarakterDiketik) * 100 : 0;
    const menangLawanAI = kataBenar >= Math.floor(aiKataSelesaiTotal);

    const latensiRataRata = {};
    Object.entries(latensiHuruf).forEach(([huruf, daftar]) => {
        const rata = daftar.reduce((a, b) => a + b, 0) / daftar.length;
        latensiRataRata[huruf] = Math.round(rata);
    });

    const respon = await fetch("/submit_score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nama: namaSekarang,
            wpm: parseFloat(wpmAkhir.toFixed(1)),
            waktu: parseFloat(waktuTotal.toFixed(1)),
            typo: jumlahTypo,
            akurasi: parseFloat(akurasi.toFixed(1)),
            kata_benar: kataBenar,
            menang_ai: menangLawanAI,
            kesalahan_huruf: kesalahanHuruf,
            latensi_huruf: latensiRataRata,
            waktu_per_kata_dipakai: waktuPerKataSaatIni
        })
    });

    const data = await respon.json();

    ringkasan.innerHTML = `
        WPM: ${wpmAkhir.toFixed(1)} <br>
        Kata Benar: ${kataBenar} <br>
        Kombo Tertinggi: x${stackTertinggi} <br>
        Jumlah Typo: ${jumlahTypo} <br>
        Akurasi: ${akurasi.toFixed(1)}% <br>
        Skor Akhir: ${data.skor} <br>
        Ranking: #${data.ranking} dari ${data.total_pemain} pemain
        <hr>
        <strong>Kamu vs AI</strong><br>
        Kata Kamu: ${kataBenar} | Kata AI: ${Math.floor(aiKataSelesaiTotal)} <br>
        ${menangLawanAI ? "Kamu menang melawan AI!" : "AI menang kali ini, coba lagi!"}
    `;

    halamanLeaderboardSekarang = Math.ceil(data.ranking / 10);
    await muatLeaderboard(halamanLeaderboardSekarang);
    hasilAkhir.classList.remove("hidden");
}

async function muatLeaderboard(halaman) {
    const respon = await fetch(`/leaderboard?halaman=${halaman}`);
    const data = await respon.json();

    halamanLeaderboardSekarang = data.halaman;

    leaderboardList.innerHTML = "";
    data.data.forEach((entri, i) => {
        const nomorRank = (data.halaman - 1) * 10 + i + 1;
        const item = document.createElement("div");
        item.classList.add("leaderboard-item");
        item.innerHTML = `
            <span class="nomor-rank">${nomorRank}</span>
            <span>${entri.nama} - Skor: ${entri.skor} (WPM: ${entri.wpm})</span>
        `;
        leaderboardList.appendChild(item);
    });

    pageIndicator.textContent = `Halaman ${data.halaman} dari ${data.total_halaman}`;
    prevPageBtn.disabled = data.halaman <= 1;
    nextPageBtn.disabled = data.halaman >= data.total_halaman;
}

prevPageBtn.addEventListener("click", () => muatLeaderboard(halamanLeaderboardSekarang - 1));
nextPageBtn.addEventListener("click", () => muatLeaderboard(halamanLeaderboardSekarang + 1));
mulaiBtn.addEventListener("click", mulaiPermainan);
ulangiBtn.addEventListener("click", mulaiPermainan);