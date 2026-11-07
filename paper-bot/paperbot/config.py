"""Configuración. Todos los umbrales viven aquí, en código, no en el modelo."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class RiskLimits:
    max_drawdown: float = 0.15        # 15 % desde el máximo de equity -> kill switch
    max_daily_loss: float = 0.03      # 3 % del equity al inicio del día UTC
    max_position_frac: float = 0.25   # exposición máxima (nocional / equity)
    kelly_fraction: float = 0.25      # cuarto de Kelly
    min_confidence: float = 0.80      # puerta de entrada
    min_setup_quality: int = 2        # 0..3
    escalate_below: float = 0.60      # si la confianza cae por debajo -> revisión profunda
    kill_switch_file: str = "KILL"    # si existe este fichero, no se opera


@dataclass(frozen=True)
class Costs:
    fee: float = 0.001        # 0,10 % por lado (taker típico)
    slippage: float = 0.0005  # 0,05 % por lado


@dataclass(frozen=True)
class Config:
    symbol: str = "BTC/USDT"
    exchange: str = "kraken"          # kraken | binance (solo datos públicos)
    interval_minutes: int = 60
    lookback: int = 200               # velas cerradas que ve el motor de estado
    starting_cash: float = 10_000.0
    data_dir: str = "data"
    risk: RiskLimits = field(default_factory=RiskLimits)
    costs: Costs = field(default_factory=Costs)
