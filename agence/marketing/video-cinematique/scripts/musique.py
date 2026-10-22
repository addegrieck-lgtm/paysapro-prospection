"""Bande sonore procédurale (création originale, libre d'utilisation) : nappes, pulsation, impacts et montées.

Les instants des scènes et des impacts reprennent src/config/timeline.ts : à garder synchronisés.
Usage : python3 scripts/musique.py   -> public/audio/musique-50s.wav et musique-15s.wav (48 kHz, stéréo)
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"


def note(n):  # n en demi-tons depuis la4 (440 Hz)
    return 440.0 * 2 ** (n / 12)


# Accords (demi-tons / la4) : Dm9, Si♭maj7, Fa maj9, Sol m9, Si♭maj9, Fa(add9)
ACCORDS = {
    "Dm9": [-31, -24, -16, -12, -5, -2],
    "Bbmaj7": [-35, -23, -19, -16, -12],
    "Fmaj9": [-28, -21, -16, -12, -5, -2],
    "Gm9": [-26, -19, -14, -12, -9, -5],
    "Bbmaj9": [-35, -23, -19, -16, -12, -9],
    "Fadd9": [-28, -21, -16, -9, -5, -2],
}

COUPES = {
    50: {
        "accords": [(0, "Dm9"), (7, "Bbmaj7"), (18, "Fmaj9"), (29, "Gm9"), (39, "Bbmaj9"), (46, "Fadd9")],
        "pulse": [(7, 39, 0.5), (18, 29, 0.8), (29, 39, 1.0)],
        "impacts": [2.6, 7, 18, 29, 33, 39.6, 46],
        "montees": [7, 18, 29, 39.6],
    },
    15: {
        "accords": [(0, "Dm9"), (3, "Bbmaj7"), (6.6, "Fmaj9"), (9.6, "Gm9"), (12, "Fadd9")],
        "pulse": [(3, 12, 0.8)],
        "impacts": [1.1, 3, 6.6, 9.6, 12.3],
        "montees": [3, 6.6, 9.6, 12.3],
    },
}


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    # Filtre à un pôle, vectorisé par blocs pour rester rapide.
    for i in range(0, len(x), 4096):
        blk = x[i:i + 4096]
        out = np.empty_like(blk)
        for j, v in enumerate(blk):
            acc = (1 - a) * v + a * acc
            out[j] = acc
        y[i:i + 4096] = out
    return y


def nappe(duree, accords):
    n = int(duree * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)
    bornes = [a for a, _ in accords] + [duree + 2]
    for idx, (debut, nom) in enumerate(accords):
        fin = bornes[idx + 1]
        env = np.clip((t - debut + 0.6) / 1.8, 0, 1) * np.clip((fin + 1.2 - t) / 1.8, 0, 1)
        env = env ** 1.5
        for k, st in enumerate(ACCORDS[nom]):
            f = note(st)
            for h in range(1, 7):
                amp = (1 / h) ** 1.4 / len(ACCORDS[nom])
                ph = 2 * np.pi * f * h * t
                L += env * amp * np.sin(ph * 1.0015 + k)
                R += env * amp * np.sin(ph * 0.9985 + 2 * k)
            # Scintillement aigu, très discret.
            if k >= len(ACCORDS[nom]) - 3:
                sh = 0.05 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.21 * t + k))
                L += env * sh * np.sin(2 * np.pi * f * 4.004 * t)
                R += env * sh * np.sin(2 * np.pi * f * 3.996 * t)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.07 * t)
    return lowpass(L * lfo, 1800), lowpass(R * lfo, 1800)


def pulsation(duree, accords, zones):
    n = int(duree * SR)
    sig = np.zeros(n)
    croche = 60 / 100 / 2
    for debut, fin, vol in zones:
        k = 0
        tt = debut
        while tt < fin - 0.05:
            nom = [a for a in accords if a[0] <= tt][-1][1]
            tons = ACCORDS[nom][1:]
            f = note(tons[k % len(tons)] + 12)
            i0 = int(tt * SR)
            m = int(0.6 * SR)
            tl = np.arange(m) / SR
            env = np.exp(-tl / 0.16) * (1 - np.exp(-tl / 0.004))
            tone = (np.sin(2 * np.pi * f * tl) + 0.3 * np.sin(4 * np.pi * f * tl)) * env * vol * (0.8 if k % 2 else 1)
            j = min(n, i0 + m)
            sig[i0:j] += tone[: j - i0]
            k += 1
            tt += croche
    return lowpass(sig, 3200) * 0.4


def impacts(duree, instants):
    n = int(duree * SR)
    sig = np.zeros(n)
    rng = np.random.default_rng(3)
    for at in instants:
        i0 = int(at * SR)
        m = int(2.6 * SR)
        tl = np.arange(m) / SR
        f = 38 + 55 * np.exp(-tl / 0.12)
        boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tl / 0.7)
        bruit = lowpass(rng.normal(0, 1, m), 500) * np.exp(-tl / 0.18) * 0.6
        j = min(n, i0 + m)
        sig[i0:j] += (boom + bruit)[: j - i0]
    return sig * 0.35


def montees(duree, instants):
    n = int(duree * SR)
    sig = np.zeros(n)
    rng = np.random.default_rng(5)
    for at in instants:
        m = int(1.3 * SR)
        i0 = int(at * SR) - m
        if i0 < 0:
            continue
        tl = np.arange(m) / SR / 1.3
        b = rng.normal(0, 1, m)
        # Souffle : bruit dont le filtre s'ouvre en montant.
        y = np.zeros(m)
        acc = 0.0
        for j in range(m):
            a = np.exp(-2 * np.pi * (300 + 5000 * tl[j] ** 2) / SR)
            acc = (1 - a) * b[j] + a * acc
            y[j] = acc
        sig[i0:i0 + m] += y * tl ** 2 * 0.5
    return sig


def reverb(x, duree_s=2.8):
    rng = np.random.default_rng(9)
    m = int(duree_s * SR)
    ir = rng.normal(0, 1, m) * np.exp(-np.arange(m) / SR / (duree_s / 5))
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + m)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return y


def rendre(duree, c):
    L, R = nappe(duree, c["accords"])
    p = pulsation(duree, c["accords"], c["pulse"])
    imp = impacts(duree, c["impacts"])
    mon = montees(duree, c["montees"])
    dryL = L * 0.5 + p * 0.9 + imp + mon * 0.6
    dryR = R * 0.5 + p * 0.7 + imp + mon * 0.6
    wetL, wetR = reverb(dryL), reverb(np.roll(dryR, 900))
    outL = dryL * 0.75 + wetL * 0.45
    outR = dryR * 0.75 + wetR * 0.45
    t = np.arange(len(outL)) / SR
    fondu = np.clip((duree - t) / 0.9, 0, 1) * np.clip(t / 0.4, 0, 1)
    st = np.stack([outL * fondu, outR * fondu], axis=1)
    st = np.tanh(st / np.max(np.abs(st)) * 1.2) / np.tanh(1.2) * 10 ** (-4.5 / 20)
    pcm = (st * 32767).astype(np.int16)
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT / f"musique-{duree}s.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    for duree, c in COUPES.items():
        rendre(duree, c)
        print(f"musique-{duree}s.wav")
