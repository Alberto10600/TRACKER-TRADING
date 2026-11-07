"""Motor común: el backtest y el bucle en vivo usan exactamente este mismo código."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .broker import PaperBroker
from .config import Config
from .data import Book, Candle
from .policy import Policy
from .risk import RiskManager
from .state import build_snapshot, closed_only

HORIZON_BARS = 6   # horizonte de la apuesta: salida por tiempo y etiqueta para calibrar


@dataclass
class Engine:
    cfg: Config
    policy: Policy
    broker: PaperBroker
    risk: RiskManager
    journal_path: Path | None = None
    peak_equity: float = 0.0
    day: int = -1
    day_start_equity: float = 0.0

    def _log(self, rec: dict):
        if self.journal_path:
            with self.journal_path.open("a") as f:
                f.write(json.dumps(rec) + "\n")

    def _manage_exits(self, bar: Candle):
        p = self.broker.pos
        if p.qty == 0 or p.opened_ts >= bar.ts + self.cfg.interval_minutes * 60:
            return
        p.bars_held += 1
        long = p.qty > 0
        hit_stop = bar.low <= p.stop if long else bar.high >= p.stop
        hit_take = bar.high >= p.take if long else bar.low <= p.take
        end = bar.ts + self.cfg.interval_minutes * 60
        if hit_stop:  # conservador: si en la misma vela tocó ambos, contamos el stop
            self.broker.close(end, p.stop, "stop")
        elif hit_take:
            self.broker.close(end, p.take, "take")
        elif p.bars_held >= HORIZON_BARS:
            self.broker.close(end, bar.close, "time")

    def step(self, candles: list[Candle], now: int, exec_price: float, book: Book | None = None) -> dict:
        cs = closed_only(candles, self.cfg.interval_minutes, now)
        last = cs[-1]
        self._manage_exits(last)

        eq = self.broker.equity(last.close)
        self.peak_equity = max(self.peak_equity, eq)
        d_idx = now // 86400
        if d_idx != self.day:
            self.day, self.day_start_equity = d_idx, eq

        snap = build_snapshot(cs[-self.cfg.lookback:], self.cfg.interval_minutes, now, book,
                              inventory=self.broker.pos.qty,
                              equity_drawdown=1 - eq / self.peak_equity if self.peak_equity else 0.0)
        dec = self.policy.decide(snap)
        has_pos = self.broker.pos.qty != 0
        v = self.risk.check(dec, eq, self.peak_equity, self.day_start_equity, has_pos)

        action = "hold"
        if v.flatten and has_pos:
            self.broker.close(now, exec_price, "risk:" + v.reason)
            action = "flatten"
        elif v.approved and not has_pos:
            self.broker.open(now, v.target_frac, exec_price, snap.atr_14)
            action = "open_" + dec.direction

        rec = {"ts": now, "price": snap.close, "snapshot": snap.compact(), "decision": dec.to_dict(),
               "verdict": {"approved": v.approved, "frac": v.target_frac, "reason": v.reason,
                           "escalate": v.escalate},
               "action": action, "equity": round(self.broker.equity(exec_price), 2)}
        self._log(rec)
        return rec
