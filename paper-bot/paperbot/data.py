"""Datos de mercado públicos (sin API key). Solo lectura: este módulo nunca envía órdenes."""
from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class Candle:
    ts: int        # apertura de la vela, epoch en segundos (UTC)
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass(frozen=True)
class Book:
    ts: int
    bid: float
    ask: float
    bid_size: float   # suma de cantidad en los N mejores niveles
    ask_size: float


def _get(url: str, timeout: int = 15):
    req = urllib.request.Request(url, headers={"User-Agent": "paperbot/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


_KRAKEN_PAIRS = {"BTC/USDT": "XBTUSDT", "ETH/USDT": "ETHUSDT", "BTC/USD": "XBTUSD", "ETH/USD": "ETHUSD"}


def fetch_candles(exchange: str, symbol: str, interval_minutes: int, limit: int = 500) -> list[Candle]:
    """Devuelve velas ordenadas por tiempo. Incluye la vela en curso (sin cerrar):
    el motor de estado se encarga de descartarla."""
    if exchange == "binance":
        iv = {1: "1m", 5: "5m", 15: "15m", 60: "1h", 240: "4h", 1440: "1d"}[interval_minutes]
        raw = _get(f"https://api.binance.com/api/v3/klines?symbol={symbol.replace('/', '')}&interval={iv}&limit={limit}")
        return [Candle(int(k[0]) // 1000, *map(float, k[1:6])) for k in raw]
    if exchange == "kraken":
        pair = _KRAKEN_PAIRS[symbol]
        raw = _get(f"https://api.kraken.com/0/public/OHLC?pair={pair}&interval={interval_minutes}")
        if raw.get("error"):
            raise RuntimeError(raw["error"])
        rows = next(v for k, v in raw["result"].items() if k != "last")
        return [Candle(int(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[6])) for r in rows][-limit:]
    raise ValueError(f"exchange no soportado: {exchange}")


def fetch_book(exchange: str, symbol: str, depth: int = 10) -> Book:
    import time
    if exchange == "binance":
        raw = _get(f"https://api.binance.com/api/v3/depth?symbol={symbol.replace('/', '')}&limit={depth}")
        bids, asks = raw["bids"], raw["asks"]
    elif exchange == "kraken":
        raw = _get(f"https://api.kraken.com/0/public/Depth?pair={_KRAKEN_PAIRS[symbol]}&count={depth}")
        book = next(iter(raw["result"].values()))
        bids, asks = book["bids"], book["asks"]
    else:
        raise ValueError(exchange)
    return Book(
        ts=int(time.time()),
        bid=float(bids[0][0]), ask=float(asks[0][0]),
        bid_size=sum(float(b[1]) for b in bids[:depth]),
        ask_size=sum(float(a[1]) for a in asks[:depth]),
    )
