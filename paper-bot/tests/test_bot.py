import math
import random

import pytest

from paperbot.backtest import run_backtest
from paperbot.broker import PaperBroker
from paperbot.config import Config, Costs, RiskLimits
from paperbot.data import Candle
from paperbot.policy import Calibrator, Decision, RulePolicy
from paperbot.risk import RiskManager, kelly_fraction
from paperbot.state import build_snapshot

IV = 60


def synth(n=600, seed=1, drift=0.0, vol=0.01, start=30000.0):
    rnd = random.Random(seed)
    out, p = [], start
    for i in range(n):
        o = p
        p = p * math.exp(drift + rnd.gauss(0, vol))
        hi, lo = max(o, p) * (1 + abs(rnd.gauss(0, vol / 3))), min(o, p) * (1 - abs(rnd.gauss(0, vol / 3)))
        out.append(Candle(i * 3600, o, hi, lo, p, 100 + rnd.random() * 50))
    return out


def dec(**kw):
    base = dict(regime="trending", direction="long", toxic_flow="none", setup_quality=3,
                risk_state="safe", raw_score=0.9, confidence=0.9)
    base.update(kw)
    return Decision(**base)


# --- causalidad -------------------------------------------------------------

def test_snapshot_ignores_unclosed_and_future_candles():
    cs = synth(300)
    now = cs[200].ts + IV * 60          # la vela 200 acaba de cerrar
    a = build_snapshot(cs[:201], IV, now)
    tampered = cs[:201] + [Candle(c.ts, 1, 1, 1, 1e9, 1) for c in cs[201:]]
    b = build_snapshot(tampered, IV, now)
    assert a == b
    # una vela en curso (no cerrada) con precio absurdo tampoco cambia nada
    c = build_snapshot(cs[:201] + [Candle(cs[201].ts, 1, 1e9, 1, 1e9, 1)], IV, now)
    assert a == c


def test_backtest_has_no_lookahead():
    """Cambiar el futuro no puede cambiar las decisiones pasadas."""
    cs = synth(500, seed=7)
    r1 = run_backtest(cs, Config())["records"]
    cs2 = cs[:400] + synth(100, seed=99, start=cs[400].open)
    cs2 = cs2[:400] + [Candle(cs[400 + i].ts, c.open, c.high, c.low, c.close, c.volume) for i, c in enumerate(cs2[400:])]
    r2 = run_backtest(cs2, Config())["records"]
    k = next(i for i, r in enumerate(r1) if r["ts"] > cs[399].ts + IV * 60) - 1
    assert [r["decision"] for r in r1[:k]] == [r["decision"] for r in r2[:k]]


# --- capa de riesgo ---------------------------------------------------------

def rm(tmp_path, **kw):
    return RiskManager(RiskLimits(**kw), workdir=str(tmp_path))


def test_gates(tmp_path):
    r = rm(tmp_path)
    assert r.check(dec(), 10000, 10000, 10000, False).approved
    assert not r.check(dec(confidence=0.8), 10000, 10000, 10000, False).approved   # debe ser > 0.80
    assert not r.check(dec(setup_quality=1), 10000, 10000, 10000, False).approved
    assert not r.check(dec(risk_state="near_limit"), 10000, 10000, 10000, False).approved
    assert not r.check(dec(direction="neutral"), 10000, 10000, 10000, False).approved


def test_size_is_quarter_kelly_and_capped(tmp_path):
    v = rm(tmp_path).check(dec(confidence=0.9), 10000, 10000, 10000, False)
    assert v.target_frac == pytest.approx(min(kelly_fraction(0.9, 1.0) * 0.25, 0.25))
    v = rm(tmp_path, max_position_frac=0.05).check(dec(confidence=0.99), 10000, 10000, 10000, False)
    assert v.target_frac == pytest.approx(0.05)


def test_kill_switch_drawdown_is_sticky(tmp_path):
    r = rm(tmp_path)
    v = r.check(dec(), 8400, 10000, 8400, True)     # 16 % de drawdown
    assert not v.approved and v.flatten and "KILL" in v.reason
    # aunque el equity se recupere, sigue armado hasta que un humano lo desarme
    assert not r.check(dec(), 10000, 10000, 10000, False).approved


def test_kill_switch_file(tmp_path):
    (tmp_path / "KILL").write_text("")
    assert not rm(tmp_path).check(dec(), 10000, 10000, 10000, False).approved


def test_daily_loss(tmp_path):
    v = rm(tmp_path).check(dec(), 9600, 10000, 9950, True)   # -3,5 % en el día
    assert not v.approved and v.flatten


def test_escalation_on_low_confidence_with_position(tmp_path):
    v = rm(tmp_path).check(dec(confidence=0.55), 10000, 10000, 10000, True)
    assert v.escalate and v.flatten and not v.approved


def test_crisis_never_trades(tmp_path):
    v = rm(tmp_path).check(dec(regime="crisis"), 10000, 10000, 10000, False)
    assert not v.approved and v.escalate


def test_limits_are_immutable():
    with pytest.raises(Exception):
        RiskLimits().max_drawdown = 0.9


# --- broker y calibración ---------------------------------------------------

def test_round_trip_costs_money():
    b = PaperBroker(10000, Costs(fee=0.001, slippage=0.0005))
    b.open(0, 0.25, 100.0, atr=1.0)
    b.close(1, 100.0, "test")
    assert b.cash < 10000 and b.realized[0] < 0


def test_uncalibrated_confidence_is_shrunk():
    assert Calibrator()(0.9) == pytest.approx(0.7)   # sin historial nunca supera 0,80 -> no opera


def test_calibrator_learns_and_shrinks():
    c = Calibrator.fit([0.9] * 200, [1] * 180 + [0] * 20)
    assert 0.8 < c(0.9) < 0.9


def test_backtest_runs_and_drawdown_capped():
    cs = synth(800, seed=3, vol=0.02)
    cal = Calibrator.fit([0.6, 0.7, 0.8, 0.9] * 100, [1] * 400)   # calibrador optimista a propósito
    res = run_backtest(cs, Config(), cal)
    assert res["max_drawdown"] < 0.15 + 0.05   # el kill switch corta cerca del 15 %


class AlwaysLong:
    """Política kamikaze: siempre larga con confianza alta. La capa de riesgo debe pararla."""
    cal = None

    def decide(self, s):
        return dec(confidence=0.95)


def test_engine_kill_switch_stops_a_bad_policy():
    from paperbot.broker import PaperBroker
    from paperbot.engine import Engine
    cfg = Config()
    cs = synth(900, seed=11, drift=-0.004, vol=0.01)     # mercado bajista
    eng = Engine(cfg, AlwaysLong(), PaperBroker(10000, cfg.costs), RiskManager(cfg.risk, "/nonexistent"))
    curve = []
    for i in range(160, len(cs) - 1):
        eng.step(cs[: i + 1], cs[i].ts + 3600, exec_price=cs[i + 1].open)
        curve.append(eng.broker.equity(cs[i + 1].open))
    assert eng.risk.killed_reason is not None
    assert min(curve) > 10000 * (1 - 0.15 - 0.03)     # se para cerca del 15 %, con margen de un stop
    assert eng.broker.pos.qty == 0
