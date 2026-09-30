from flask import Flask, request, jsonify, render_template
import json
import os
from word_generator import KamusWordGenerator

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "static"),
    template_folder=os.path.join(BASE_DIR, "templates")
)

generator = KamusWordGenerator(
    os.path.join(BASE_DIR, "wordlist.txt"),
    os.path.join(BASE_DIR, "corpus_kalimat.txt")
)

DATA_DIR = "/tmp" if os.environ.get("VERCEL") else BASE_DIR

LEADERBOARD_FILE = os.path.join(DATA_DIR, "leaderboard.json")
GAME_HISTORY_FILE = os.path.join(DATA_DIR, "game_history.json")
MISTAKE_LOG_FILE = os.path.join(DATA_DIR, "mistake_log.json")
PLAYER_HISTORY_FILE = os.path.join(DATA_DIR, "player_history.json")

def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

@app.route("/get_opponent")
def get_opponent():
    nama = request.args.get("nama", "").strip().lower()
    riwayat_pemain = load_json(PLAYER_HISTORY_FILE, {})

    if nama and nama in riwayat_pemain and riwayat_pemain[nama].get("rata_wpm", 0) > 0:
        wpm_dasar = riwayat_pemain[nama]["rata_wpm"]
    else:
        riwayat_game = load_json(GAME_HISTORY_FILE, [])
        wpm_dasar = (sum(d["wpm"] for d in riwayat_game) / len(riwayat_game)) if riwayat_game else 25

    ai_wpm = max(round(wpm_dasar * 1.05, 1), 15)

    return jsonify({"ai_wpm": ai_wpm, "wpm_dasar": round(wpm_dasar, 1)})

def tentukan_default(wpm):
    """Aturan cadangan kalau data historis belum cukup untuk melatih model."""
    if wpm < 20:
        return {"panjang_min": 3, "waktu_per_kata": 3.5}
    elif wpm < 40:
        return {"panjang_min": 5, "waktu_per_kata": 2.5}
    elif wpm < 60:
        return {"panjang_min": 7, "waktu_per_kata": 1.8}
    else:
        return {"panjang_min": 9, "waktu_per_kata": 1.3}


def latih_model_regresi(data_riwayat):
    if len(data_riwayat) < 15:
        return None

    xs = [d["wpm"] for d in data_riwayat]
    ys = [d["waktu_per_kata"] for d in data_riwayat]
    ws = [max(d["skor"], 1) for d in data_riwayat]

    sw = sum(ws)
    swx = sum(w * x for w, x in zip(ws, xs))
    swy = sum(w * y for w, y in zip(ws, ys))
    swxx = sum(w * x * x for w, x in zip(ws, xs))
    swxy = sum(w * x * y for w, x, y in zip(ws, xs, ys))

    denom = sw * swxx - swx * swx
    if denom == 0:
        return None

    a = (sw * swxy - swx * swy) / denom
    b = (swxx * swy - swx * swxy) / denom

    return {"a": a, "b": b, "jumlah_data": len(data_riwayat)}


def prediksi_waktu_per_kata(wpm):
    riwayat = load_json(GAME_HISTORY_FILE, [])
    model = latih_model_regresi(riwayat)

    if model is None:
        return tentukan_default(wpm)["waktu_per_kata"], "default"

    hasil = model["a"] * wpm + model["b"]
    hasil = max(0.8, min(hasil, 4.0))
    return round(hasil, 2), "model"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get_words")
def get_words():
    jumlah = int(request.args.get("jumlah", 20))
    kata = generator.generate_words_puisi(jumlah)
    return jsonify({"words": kata})


@app.route("/get_difficulty")
def get_difficulty():
    wpm = float(request.args.get("wpm", 0))
    default = tentukan_default(wpm)
    waktu_prediksi, sumber = prediksi_waktu_per_kata(wpm)

    return jsonify({
        "panjang_min": default["panjang_min"],
        "waktu_per_kata": waktu_prediksi,
        "sumber": sumber
    })


@app.route("/player_start")
def player_start():
    nama = request.args.get("nama", "").strip().lower()
    riwayat_pemain = load_json(PLAYER_HISTORY_FILE, {})

    if not nama or nama not in riwayat_pemain:
        return jsonify({"pemain_baru": True, "rata_wpm": None, "huruf_riwayat": []})

    data = riwayat_pemain[nama]
    kesalahan = data.get("kesalahan_huruf_kumulatif", {})
    huruf_riwayat = sorted(kesalahan.items(), key=lambda x: x[1], reverse=True)[:3]
    huruf_riwayat = [h[0] for h in huruf_riwayat]

    return jsonify({
        "pemain_baru": False,
        "rata_wpm": round(data.get("rata_wpm", 0), 1),
        "jumlah_sesi": data.get("jumlah_sesi", 0),
        "huruf_riwayat": huruf_riwayat
    })


@app.route("/model_info")
def model_info():
    riwayat = load_json(GAME_HISTORY_FILE, [])
    model = latih_model_regresi(riwayat)

    if model is None:
        return jsonify({
            "status": "belum cukup data",
            "jumlah_data_terkumpul": len(riwayat),
            "minimal_dibutuhkan": 15
        })

    return jsonify({
        "status": "model aktif",
        "koefisien_a": round(model["a"], 4),
        "koefisien_b": round(model["b"], 4),
        "jumlah_data": model["jumlah_data"],
        "penjelasan": "waktu_per_kata = a * wpm + b, dilatih dari riwayat permainan"
    })


def update_mistake_log(kesalahan_huruf, latensi_huruf):
    # Menyimpan kumulatif kesalahan dan latensi huruf dari seluruh pengunjung
    log = load_json(MISTAKE_LOG_FILE, {"kesalahan": {}, "latensi": {}, "jumlah_latensi": {}})

    for huruf, jumlah in kesalahan_huruf.items():
        log["kesalahan"][huruf] = log["kesalahan"].get(huruf, 0) + jumlah

    for huruf, rata_ms in latensi_huruf.items():
        jumlah_lama = log["jumlah_latensi"].get(huruf, 0)
        rata_lama = log["latensi"].get(huruf, 0)
        jumlah_baru = jumlah_lama + 1
        rata_baru = (rata_lama * jumlah_lama + rata_ms) / jumlah_baru
        log["latensi"][huruf] = rata_baru
        log["jumlah_latensi"][huruf] = jumlah_baru

    save_json(MISTAKE_LOG_FILE, log)


def update_player_history(nama, wpm, kesalahan_huruf):
    """Menyimpan riwayat tiap pemain berdasarkan nama untuk personalisasi sesi berikutnya."""
    nama_key = nama.strip().lower()
    if not nama_key or nama_key == "anonim":
        return

    riwayat = load_json(PLAYER_HISTORY_FILE, {})
    data_pemain = riwayat.get(nama_key, {
        "jumlah_sesi": 0,
        "total_wpm": 0,
        "rata_wpm": 0,
        "kesalahan_huruf_kumulatif": {}
    })

    data_pemain["jumlah_sesi"] += 1
    data_pemain["total_wpm"] += wpm
    data_pemain["rata_wpm"] = data_pemain["total_wpm"] / data_pemain["jumlah_sesi"]

    for huruf, jumlah in kesalahan_huruf.items():
        data_pemain["kesalahan_huruf_kumulatif"][huruf] = (
            data_pemain["kesalahan_huruf_kumulatif"].get(huruf, 0) + jumlah
        )

    riwayat[nama_key] = data_pemain
    save_json(PLAYER_HISTORY_FILE, riwayat)


@app.route("/submit_score", methods=["POST"])
def submit_score():
    data = request.get_json()

    nama = data.get("nama", "Anonim")
    wpm = data.get("wpm", 0)
    waktu = data.get("waktu", 0)
    typo = data.get("typo", 0)
    akurasi = data.get("akurasi", 0)
    kata_benar = data.get("kata_benar", 0)
    menang_ai = data.get("menang_ai", False)
    kesalahan_huruf = data.get("kesalahan_huruf", {})
    latensi_huruf = data.get("latensi_huruf", {})
    waktu_per_kata_dipakai = data.get("waktu_per_kata_dipakai", 2.5)

    skor = round((wpm * 10) + (kata_benar * 2) - (typo * 5) + (50 if menang_ai else 0), 1)
    if skor < 0:
        skor = 0

    leaderboard = load_json(LEADERBOARD_FILE, [])
    entri_baru = {
        "nama": nama, "wpm": wpm, "waktu": waktu, "typo": typo,
        "akurasi": akurasi, "menang_ai": menang_ai, "skor": skor
    }
    leaderboard.append(entri_baru)
    leaderboard.sort(key=lambda x: x["skor"], reverse=True)
    save_json(LEADERBOARD_FILE, leaderboard)
    ranking = leaderboard.index(entri_baru) + 1

    riwayat_game = load_json(GAME_HISTORY_FILE, [])
    riwayat_game.append({
        "wpm": wpm,
        "waktu_per_kata": waktu_per_kata_dipakai,
        "skor": skor
    })
    riwayat_game = riwayat_game[-500:]
    save_json(GAME_HISTORY_FILE, riwayat_game)

    update_mistake_log(kesalahan_huruf, latensi_huruf)
    update_player_history(nama, wpm, kesalahan_huruf)

    return jsonify({"skor": skor, "ranking": ranking, "total_pemain": len(leaderboard)})


@app.route("/leaderboard")
def leaderboard():
    halaman = int(request.args.get("halaman", 1))
    per_halaman = 10
    data = load_json(LEADERBOARD_FILE, [])

    total_halaman = max((len(data) + per_halaman - 1) // per_halaman, 1)
    halaman = max(1, min(halaman, total_halaman))
    awal = (halaman - 1) * per_halaman
    akhir = awal + per_halaman

    return jsonify({
        "data": data[awal:akhir],
        "halaman": halaman,
        "total_halaman": total_halaman,
        "total_pemain": len(data)
    })


if __name__ == "__main__":
    app.run(debug=True)