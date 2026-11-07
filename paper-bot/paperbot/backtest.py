"""Backtest con el mismo motor que el modo en vivo. Decide al cierre de la vela i y
ejecuta al precio de apertura de la vela i+1 (nunca al cierre que ya ha visto)."""
from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

from .broker import PaperBroker
from .config import Config
from .data import Candle, fetch_candles
from .engine import HORIZON_BARS, Engine
from .policy import Calibrator, RulePolicy
from .risk import RiskManager


def run_backtest(candles: list[Candle], cfg: Config, calibrator: Calibrator | None = None,
                 journal: Path | None = None) -> dict:
    iv = cfg.interval_minutes * 60
    broker = PaperBroker(cfg.starting_cash, cfg.costs)
    eng = Engine(cfg, RulePolicy(calibrator), broker, RiskManager(cfg.risk, workdir="/nonexistent"),
                 journal_path=journal)
    curve, recs = [], []
    warm = 160
    for i in range(warm, len(candles) - 1):
        now = candles[i].ts + iv
        rec = eng.step(candles[: i + 1], now, exec_price=candles[i + 1].open)
        recs.append(rec)
        curve.append(broker.equity(candles[i + 1].open))
    if broker.pos.qty:
        broker.close(candles[-1].ts + iv, candles[-1].close, "end")
    final = broker.equity(candles[-1].close)

    peak, mdd = -math.inf, 0.0
    for e in curve:
        peak = max(peak, e)
        mdd = max(mdd, 1 - e / peak)
    wins = [p for p in broker.realized if p > 0]
    bh = candles[-1].close / candles[warm].close - 1
    return {
        "velas": len(candles), "operaciones": len(broker.realized),
        "retorno": final / cfg.starting_cash - 1, "buy_and_hold": bh,
        "max_drawdown": mdd, "acierto": len(wins) / len(broker.realized) if broker.realized else None,
        "comisiones": sum(f.fee for f in broker.fills),
        "kill_switch": eng.risk.killed_reason,
        "records": recs,
    }


def label_outcomes(records: list[dict], candles: list[Candle], interval_minutes: int) -> tuple[list[float], list[int]]:
    """Para cada decisión con dirección: ¿se movió el precio a favor en HORIZON_BARS velas?"""
    by_close = {c.ts + interval_minutes * 60: i for i, c in enumerate(candles)}
    raws, hits = [], []
    for r in records:
        d = r["decision"]
        if d["direction"] == "neutral" or r["ts"] not in by_close:
            continue
        i = by_close[r["ts"]]
        if i + HORIZON_BARS >= len(candles):
            continue
        move = candles[i + HORIZON_BARS].close / candles[i].close - 1
        raws.append(d["raw_score"])
        hits.append(int(move > 0) if d["direction"] == "long" else int(move < 0))
    return raws, hits


def load_csv(path: Path) -> list[Candle]:
    with path.open() as f:
        return [Candle(int(r["ts"]), float(r["open"]), float(r["high"]), float(r["low"]),
                       float(r["close"]), float(r["volume"])) for r in csv.DictReader(f)]


def main():
    ap = argparse.ArgumentParser(description="Backtest del bot (paper)")
    ap.add_argument("--csv", help="CSV con columnas ts,open,high,low,close,volume")
    ap.add_argument("--exchange", default="kraken")
    ap.add_argument("--symbol", default="BTC/USDT")
    ap.add_argument("--interval", type=int, default=60)
    a = ap.parse_args()
    cfg = Config(symbol=a.symbol, exchange=a.exchange, interval_minutes=a.interval)
    candles = load_csv(Path(a.csv)) if a.csv else fetch_candles(a.exchange, a.symbol, a.interval, 1000)

    # Walk-forward: calibra con la primera mitad y evalúa en la segunda (fuera de muestra).
    half = len(candles) // 2
    first = run_backtest(candles[:half], cfg)
    cal = Calibrator.fit(*label_outcomes(first["records"], candles[:half], a.interval))
    res = run_backtest(candles[half - 160:], cfg, cal)
    res.pop("records")
    print(json.dumps(res, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
