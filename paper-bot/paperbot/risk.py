"""Capa de riesgo determinista. El modelo nunca puede saltársela: recibe la decisión
como dato y devuelve el tamaño permitido. Los límites son una dataclass congelada."""
from __future__ import annotations

import os
from dataclasses import dataclass

from .config import RiskLimits
from .policy import Decision


@dataclass(frozen=True)
class Verdict:
    approved: bool
    target_frac: float     # exposición objetivo con signo (fracción del equity)
    reason: str
    flatten: bool = False  # cerrar todo ya
    escalate: bool = False # pedir revisión profunda (humano/LLM) — nunca abre posiciones


def kelly_fraction(p: float, b: float) -> float:
    """Kelly para apuesta binaria: f* = p - (1 - p) / b. Nunca negativo."""
    return max(0.0, p - (1 - p) / b)


class RiskManager:
    def __init__(self, limits: RiskLimits, workdir: str = "."):
        self.L = limits
        self.workdir = workdir
        self.killed_reason: str | None = None   # una vez armado, solo se desarma a mano

    def kill_switch_on(self) -> bool:
        return self.killed_reason is not None or os.path.exists(os.path.join(self.workdir, self.L.kill_switch_file))

    def check(self, d: Decision, equity: float, peak_equity: float, day_start_equity: float,
              has_position: bool) -> Verdict:
        L = self.L
        dd = 1 - equity / peak_equity if peak_equity > 0 else 0.0
        day_loss = 1 - equity / day_start_equity if day_start_equity > 0 else 0.0

        # 1) Interruptores duros, se comprueban antes de cada orden.
        if dd >= L.max_drawdown:
            self.killed_reason = f"drawdown {dd:.1%} >= {L.max_drawdown:.0%}"
        if self.kill_switch_on():
            return Verdict(False, 0.0, f"KILL SWITCH: {self.killed_reason or 'fichero ' + L.kill_switch_file}", flatten=True)
        if day_loss >= L.max_daily_loss:
            return Verdict(False, 0.0, f"pérdida diaria {day_loss:.1%} >= {L.max_daily_loss:.0%}", flatten=True)

        # 2) Escalado: confianza baja con posición abierta o régimen de crisis -> cerrar y revisar.
        if d.regime == "crisis":
            return Verdict(False, 0.0, "régimen crisis", flatten=has_position, escalate=True)
        if has_position and d.confidence < L.escalate_below:
            return Verdict(False, 0.0, f"confianza {d.confidence:.2f} < {L.escalate_below}", flatten=True, escalate=True)

        # 3) Puertas de entrada.
        if d.direction == "neutral":
            return Verdict(False, 0.0, "sin dirección")
        if d.setup_quality < L.min_setup_quality:
            return Verdict(False, 0.0, f"setup_quality {d.setup_quality} < {L.min_setup_quality}")
        if d.confidence <= L.min_confidence:
            return Verdict(False, 0.0, f"confianza {d.confidence:.2f} <= {L.min_confidence}")
        if d.risk_state != "safe":
            return Verdict(False, 0.0, f"risk_state {d.risk_state}")

        # 4) Tamaño: cuarto de Kelly sobre la probabilidad calibrada, con tope de posición.
        f = kelly_fraction(d.confidence, d.payoff_ratio) * L.kelly_fraction
        f = min(f, L.max_position_frac)
        if f <= 0:
            return Verdict(False, 0.0, "Kelly <= 0")
        sign = 1 if d.direction == "long" else -1
        return Verdict(True, sign * f, f"ok: {d.direction} {f:.1%} del equity")
