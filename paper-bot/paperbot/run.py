"""Bucle en vivo, SOLO PAPER: datos reales públicos, dinero simulado.
Uso: python -m paperbot.run --exchange kraken --symbol BTC/USDT --interval 60
Para parar de emergencia: crea un fichero llamado KILL en el directorio de datos."""
from __future__ import annotations

import argparse
import json
import pickle
import time
from pathlib import Path

from .broker import PaperBroker
from .config import Config
from .data import fetch_book, fetch_candles
from .engine import Engine
from .policy import Calibrator, RulePolicy
from .risk import RiskManager


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exchange", default="kraken")
    ap.add_argument("--symbol", default="BTC/USDT")
    ap.add_argument("--interval", type=int, default=60)
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--once", action="store_true", help="un solo paso y salir (útil con cron)")
    a = ap.parse_args()

    cfg = Config(symbol=a.symbol, exchange=a.exchange, interval_minutes=a.interval, data_dir=a.data_dir)
    d = Path(a.data_dir)
    d.mkdir(exist_ok=True)
    state_file = d / "state.pkl"
    if state_file.exists():
        eng: Engine = pickle.loads(state_file.read_bytes())
    else:
        eng = Engine(cfg, RulePolicy(), PaperBroker(cfg.starting_cash, cfg.costs),
                     RiskManager(cfg.risk, workdir=str(d)), journal_path=d / "journal.jsonl")
    eng.policy.cal = Calibrator.load(d / "calibration.json")   # la revisión nocturna lo actualiza

    iv = a.interval * 60
    while True:
        now = int(time.time())
        try:
            candles = fetch_candles(a.exchange, a.symbol, a.interval, 500)
            book = fetch_book(a.exchange, a.symbol)
            # Ejecutamos al mid; el broker añade deslizamiento y comisión.
            rec = eng.step(candles, now, exec_price=(book.bid + book.ask) / 2, book=book)
            print(json.dumps({k: rec[k] for k in ("ts", "price", "action", "equity")} | {"motivo": rec["verdict"]["reason"]},
                             ensure_ascii=False))
            if rec["verdict"]["escalate"]:
                with (d / "escalations.jsonl").open("a") as f:
                    f.write(json.dumps(rec) + "\n")
            state_file.write_bytes(pickle.dumps(eng))
        except Exception as e:  # un fallo de red no debe tumbar el bucle, pero se registra
            print(json.dumps({"ts": now, "error": repr(e)}))
        if a.once:
            break
        time.sleep(iv - (int(time.time()) % iv) + 5)   # despertar 5 s después del cierre de vela


if __name__ == "__main__":
    main()
