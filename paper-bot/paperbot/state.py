"""Motor de estado determinista: convierte velas cerradas (+ libro opcional) en una
instantánea numérica compacta. Todo se calcula en código, nunca en el modelo.

Regla de causalidad: solo entran velas cuyo cierre (ts + intervalo) es <= now.
La vela en curso se descarta siempre, así ningún campo ve el futuro."""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np

from .data import Book, Candle


@dataclass(frozen=True)
class Snapshot:
    ts: int                 # cierre de la última vela usada
    close: float
    mid: float
    spread_bps: float
    imbalance: float        # (bid_size - ask_size) / total, -1..1 ; 0 si no hay libro
    ret_1: float            # retorno log de la última vela
    ret_24: float           # retorno log de las últimas 24 velas
    ema_ratio: float        # ema20 / ema50 - 1
    zscore_20: float        # (close - media20) / desviación20
    vol_24: float           # volatilidad realizada (desv. típica de retornos log, 24 velas)
    vol_pct: float          # percentil de vol_24 frente a su propia historia (0..1)
    atr_14: float
    vol_ratio: float        # volumen última vela / media 20
    dd_from_high_24: float  # caída desde el máximo de 24 velas (>=0)
    inventory: float        # posición actual en unidades del activo (con signo)
    equity_drawdown: float  # caída del equity desde su máximo (>=0)

    def compact(self) -> dict:
        """Versión redondeada para registrar o para pasársela a un modelo (<400 tokens)."""
        return {k: (round(v, 5) if isinstance(v, float) else v) for k, v in asdict(self).items()}


def closed_only(candles: list[Candle], interval_minutes: int, now: int) -> list[Candle]:
    return [c for c in candles if c.ts + interval_minutes * 60 <= now]


def _ema(x: np.ndarray, n: int) -> float:
    a = 2 / (n + 1)
    e = x[0]
    for v in x[1:]:
        e = a * v + (1 - a) * e
    return float(e)


def build_snapshot(candles: list[Candle], interval_minutes: int, now: int,
                   book: Book | None = None, inventory: float = 0.0,
                   equity_drawdown: float = 0.0) -> Snapshot:
    cs = closed_only(candles, interval_minutes, now)
    if len(cs) < 60:
        raise ValueError(f"hacen falta al menos 60 velas cerradas, hay {len(cs)}")
    close = np.array([c.close for c in cs])
    high = np.array([c.high for c in cs])
    low = np.array([c.low for c in cs])
    vol = np.array([c.volume for c in cs])
    lr = np.diff(np.log(close))

    vol_series = np.array([lr[i - 24:i].std() for i in range(24, len(lr) + 1)])
    vol_24 = float(vol_series[-1])
    vol_pct = float((vol_series <= vol_24).mean())

    tr = np.maximum(high[1:] - low[1:], np.maximum(abs(high[1:] - close[:-1]), abs(low[1:] - close[:-1])))
    m20, s20 = close[-20:].mean(), close[-20:].std()

    if book is not None and book.ts >= cs[-1].ts:
        mid = (book.bid + book.ask) / 2
        spread_bps = (book.ask - book.bid) / mid * 1e4
        tot = book.bid_size + book.ask_size
        imbalance = (book.bid_size - book.ask_size) / tot if tot else 0.0
    else:
        mid, spread_bps, imbalance = float(close[-1]), 0.0, 0.0

    return Snapshot(
        ts=cs[-1].ts + interval_minutes * 60,
        close=float(close[-1]),
        mid=float(mid),
        spread_bps=float(spread_bps),
        imbalance=float(imbalance),
        ret_1=float(lr[-1]),
        ret_24=float(math.log(close[-1] / close[-25])),
        ema_ratio=_ema(close[-150:], 20) / _ema(close[-150:], 50) - 1,
        zscore_20=float((close[-1] - m20) / s20) if s20 > 0 else 0.0,
        vol_24=vol_24,
        vol_pct=vol_pct,
        atr_14=float(tr[-14:].mean()),
        vol_ratio=float(vol[-1] / vol[-20:].mean()) if vol[-20:].mean() > 0 else 1.0,
        dd_from_high_24=float(1 - close[-1] / high[-24:].max()),
        inventory=float(inventory),
        equity_drawdown=float(equity_drawdown),
    )
