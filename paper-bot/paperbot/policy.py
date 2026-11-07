"""Política: snapshot -> decisión tipada (el "esquema Jev" del prompt).

La política por defecto son reglas deterministas. Cualquier otro decisor (un LLM, Jev...)
puede sustituirla implementando `decide(snapshot) -> Decision`, pero NUNCA toca tamaños
ni límites: eso es de risk.py."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal, Protocol

from .state import Snapshot

Regime = Literal["trending", "mean_reverting", "high_vol", "crisis"]
Direction = Literal["long", "short", "neutral"]
RiskState = Literal["safe", "near_limit", "reduce"]


@dataclass(frozen=True)
class Decision:
    regime: Regime
    direction: Direction
    toxic_flow: str          # sustantivo que describe el flujo dominante ("none", "sell_wall", ...)
    setup_quality: int       # 0..3
    risk_state: RiskState
    raw_score: float         # puntuación sin calibrar, 0..1
    confidence: float        # probabilidad calibrada de acertar la dirección en el horizonte
    payoff_ratio: float = 1.0  # ganancia media / pérdida media esperada (para Kelly)

    def to_dict(self) -> dict:
        return asdict(self)


class Policy(Protocol):
    def decide(self, s: Snapshot) -> Decision: ...


class Calibrator:
    """Calibración por tramos (histogram binning) con contracción hacia el 50 %.
    Se reentrena cada noche en review.py a partir de los resultados reales."""

    def __init__(self, edges=None, rates=None, counts=None):
        self.edges = edges or [0.0, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0001]
        self.rates = rates          # tasa de acierto observada por tramo
        self.counts = counts

    def __call__(self, raw: float) -> float:
        if not self.rates:
            # Sin historial: no nos creemos la puntuación cruda. La encogemos hacia 0,5.
            return 0.5 + (raw - 0.5) * 0.5
        for i in range(len(self.edges) - 1):
            if self.edges[i] <= raw < self.edges[i + 1]:
                n, r = self.counts[i], self.rates[i]
                prior_n = 20  # contracción bayesiana: con pocos datos, cerca de 0,5
                return (r * n + 0.5 * prior_n) / (n + prior_n)
        return 0.5

    @classmethod
    def fit(cls, raws: list[float], hits: list[int]) -> "Calibrator":
        c = cls()
        k = len(c.edges) - 1
        counts, sums = [0] * k, [0] * k
        for r, h in zip(raws, hits):
            for i in range(k):
                if c.edges[i] <= r < c.edges[i + 1]:
                    counts[i] += 1
                    sums[i] += h
                    break
        c.counts = counts
        c.rates = [s / n if n else 0.5 for s, n in zip(sums, counts)]
        return c

    def save(self, path: Path):
        path.write_text(json.dumps({"edges": self.edges, "rates": self.rates, "counts": self.counts}))

    @classmethod
    def load(cls, path: Path) -> "Calibrator":
        if not path.exists():
            return cls()
        d = json.loads(path.read_text())
        return cls(d["edges"], d["rates"], d["counts"])


class RulePolicy:
    """Reglas simples y auditables. No pretende tener ventaja: es el punto de partida
    contra el que comparar cualquier cosa más sofisticada."""

    def __init__(self, calibrator: Calibrator | None = None):
        self.cal = calibrator or Calibrator()

    def regime(self, s: Snapshot) -> Regime:
        if s.vol_pct >= 0.97 or s.dd_from_high_24 >= 0.10:
            return "crisis"
        if s.vol_pct >= 0.85:
            return "high_vol"
        if abs(s.ema_ratio) >= 0.004:
            return "trending"
        return "mean_reverting"

    def decide(self, s: Snapshot) -> Decision:
        reg = self.regime(s)
        direction: Direction = "neutral"
        quality = 0
        if reg == "trending":
            direction = "long" if s.ema_ratio > 0 else "short"
            sign = 1 if direction == "long" else -1
            quality += int(sign * s.ret_24 > 0)          # el momentum de 24 velas acompaña
            quality += int(sign * s.imbalance > 0.1)      # el libro acompaña
            quality += int(s.vol_ratio > 1.2 and sign * s.ret_1 > 0)  # volumen confirma
        elif reg == "mean_reverting":
            if s.zscore_20 <= -2:
                direction = "long"
            elif s.zscore_20 >= 2:
                direction = "short"
            if direction != "neutral":
                sign = 1 if direction == "long" else -1
                quality += int(abs(s.zscore_20) >= 2.5)
                quality += int(sign * s.imbalance > 0.1)
                quality += int(s.vol_ratio < 1.5)          # sin pánico de volumen
        # high_vol y crisis -> neutral, calidad 0

        toxic = "none"
        if s.imbalance <= -0.4:
            toxic = "sell_wall"
        elif s.imbalance >= 0.4:
            toxic = "bid_wall"
        if s.spread_bps > 10:
            toxic = "wide_spread"

        raw = 0.5 if direction == "neutral" else 0.5 + 0.1 * quality + min(abs(s.ema_ratio) * 5, 0.1)
        raw = min(raw, 0.99)

        if s.equity_drawdown >= 0.10:
            rs: RiskState = "reduce"
        elif s.equity_drawdown >= 0.05:
            rs = "near_limit"
        else:
            rs = "safe"

        return Decision(reg, direction, toxic, quality, rs, raw, self.cal(raw))
