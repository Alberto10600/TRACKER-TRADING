"""Revisión nocturna: lee el diario, etiqueta resultados, mide calibración (Brier)
y reentrena el calibrador. Uso: python -m paperbot.review --data-dir data"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .backtest import label_outcomes
from .data import fetch_candles
from .policy import Calibrator


def brier(probs: list[float], hits: list[int]) -> float:
    return sum((p - h) ** 2 for p, h in zip(probs, hits)) / len(hits) if hits else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--exchange", default="kraken")
    ap.add_argument("--symbol", default="BTC/USDT")
    ap.add_argument("--interval", type=int, default=60)
    a = ap.parse_args()
    d = Path(a.data_dir)
    recs = [json.loads(l) for l in (d / "journal.jsonl").read_text().splitlines() if l.strip()]
    candles = fetch_candles(a.exchange, a.symbol, a.interval, 1000)
    raws, hits = label_outcomes(recs, candles, a.interval)

    old = Calibrator.load(d / "calibration.json")
    # Ajusta con el 70 % más antiguo y compara en el 30 % más reciente (fuera de muestra).
    cut = int(len(hits) * 0.7)
    new = Calibrator.fit(raws[:cut], hits[:cut])
    test_r, test_h = raws[cut:], hits[cut:]
    report = {
        "decisiones": len(recs),
        "con_direccion_y_resultado": len(hits),
        "acierto": sum(hits) / len(hits) if hits else None,
        "brier_actual": brier([old(r) for r in test_r], test_h),
        "brier_nuevo": brier([new(r) for r in test_r], test_h),
        "brier_moneda_al_aire": 0.25,
        "operaciones_abiertas": sum(r["action"].startswith("open") for r in recs),
        "escalados": sum(r["verdict"]["escalate"] for r in recs),
    }
    # Solo se acepta el calibrador nuevo si hay datos suficientes y mejora la calibración.
    if len(hits) >= 50 and report["brier_nuevo"] <= report["brier_actual"]:
        Calibrator.fit(raws, hits).save(d / "calibration.json")   # validado: reentrena con todo
        report["calibrador"] = "actualizado"
    else:
        report["calibrador"] = "sin cambios (pocos datos o no mejora)"
    (d / "review.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
