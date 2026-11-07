"""Broker simulado (paper). No existe ningún camino en este repo que envíe órdenes reales."""
from __future__ import annotations

from dataclasses import dataclass, field

from .config import Costs


@dataclass
class Position:
    qty: float = 0.0          # con signo
    entry: float = 0.0
    stop: float = 0.0
    take: float = 0.0
    opened_ts: int = 0
    bars_held: int = 0


@dataclass
class Fill:
    ts: int
    side: str
    qty: float
    price: float
    fee: float
    reason: str


@dataclass
class PaperBroker:
    cash: float
    costs: Costs
    pos: Position = field(default_factory=Position)
    fills: list[Fill] = field(default_factory=list)
    realized: list[float] = field(default_factory=list)   # PnL neto por operación cerrada

    def equity(self, price: float) -> float:
        return self.cash + self.pos.qty * price

    def _trade(self, ts: int, qty: float, ref_price: float, reason: str):
        if qty == 0:
            return
        side = "buy" if qty > 0 else "sell"
        px = ref_price * (1 + self.costs.slippage) if qty > 0 else ref_price * (1 - self.costs.slippage)
        fee = abs(qty) * px * self.costs.fee
        self.cash -= qty * px + fee
        self.fills.append(Fill(ts, side, qty, px, fee, reason))
        return px, fee

    def open(self, ts: int, target_frac: float, price: float, atr: float,
             stop_atr: float = 1.5, take_atr: float = 1.5):
        eq = self.equity(price)
        qty = target_frac * eq / price
        px, fee = self._trade(ts, qty, price, "open")
        sign = 1 if qty > 0 else -1
        self.pos = Position(qty, px, px - sign * stop_atr * atr, px + sign * take_atr * atr, ts, 0)
        self._open_fee = fee

    def close(self, ts: int, price: float, reason: str):
        if self.pos.qty == 0:
            return
        q = self.pos.qty
        px, fee = self._trade(ts, -q, price, reason)
        pnl = q * (px - self.pos.entry) - fee - getattr(self, "_open_fee", 0.0)
        self.realized.append(pnl)
        self.pos = Position()
