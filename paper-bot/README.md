# paper-bot

Bot de trading de cripto **solo en papel**: usa datos reales y públicos de Kraken o Binance y opera con dinero simulado. No hay ningún camino en el código que envíe órdenes reales ni que use API keys.

Está basado en la arquitectura del prompt viral "BRAIN / REFLEX", sin las piezas que no se pueden verificar. AgenKit no aparece y Jev queda como enchufe opcional.

## Arquitectura

| Capa | Fichero | Qué hace |
|---|---|---|
| Motor de estado | `state.py` | Convierte las velas **cerradas** y el libro de órdenes en una instantánea numérica: mid, spread, desequilibrio, volatilidad realizada, inventario y drawdown. Descarta la vela en curso, así que ningún campo ve el futuro. |
| Decisión | `policy.py` | Instantánea → `Decision` (régimen, dirección, toxic_flow, setup_quality 0–3, risk_state, confianza). Usa reglas deterministas y un calibrador por tramos. |
| Riesgo | `risk.py` | Límites duros en código y congelados: drawdown máximo del 15 % (kill switch que no se desarma solo), pérdida diaria máxima del 3 %, posición máxima del 25 % y fichero `KILL` como parada de emergencia. Puertas de entrada: setup ≥ 2, confianza > 0,80 y risk_state `safe`. Tamaño: ¼ de Kelly sobre la probabilidad calibrada. Si hay posición abierta y la confianza baja de 0,60, o si el régimen es `crisis`, cierra la posición y escala la decisión. |
| Ejecución | `broker.py` | Broker simulado con comisión (0,10 %) y deslizamiento (0,05 %) por lado, stop y take a 1,5 ATR y salida por tiempo a las 6 velas. |
| Motor | `engine.py` | El backtest y el modo en vivo usan **el mismo** código. |
| Backtest | `backtest.py` | Decide al cierre de la vela *i* y ejecuta en la apertura de *i+1*. Es walk-forward: calibra con la primera mitad y evalúa con la segunda. |
| Revisión nocturna | `review.py` | Etiqueta los resultados, calcula el Brier score fuera de muestra y solo actualiza el calibrador si hay al menos 50 casos y la calibración mejora. |

## Uso

```bash
pip install -r requirements.txt
python -m pytest                    # 15 tests: causalidad y límites de riesgo
python -m paperbot.backtest         # backtest con velas de Kraken (BTC/USDT 1h)
python -m paperbot.run              # bucle en vivo en papel (una decisión por vela)
python -m paperbot.review           # revisión nocturna (programarla con cron)
touch data/KILL                     # parada de emergencia
```

Cron de ejemplo:

```
5 * * * *  cd ~/paper-bot && python -m paperbot.run --once >> data/run.log 2>&1
15 3 * * * cd ~/paper-bot && python -m paperbot.review >> data/review.log 2>&1
```

## Enchufar otro decisor (LLM, Jev…)

Implementa `decide(snapshot) -> Decision` en una clase y pásala al `Engine` en lugar de `RulePolicy`. `snapshot.compact()` ocupa menos de 400 tokens.

El decisor **solo puede proponer**. El tamaño y los límites los decide siempre `risk.py`.

## Estado honesto

- **Las reglas incluidas no tienen ventaja demostrada.** Son una línea base auditable. Mientras no hay historial, el calibrador encoge la confianza hacia el 50 %, así que al principio el bot **casi no opera**. Es a propósito.
- En el backtest no hay libro de órdenes histórico, así que la confirmación por desequilibrio del libro nunca suma y salen menos operaciones que en vivo.
- Este entorno de pruebas no tenía acceso a las APIs de los exchanges. Los tests usan datos sintéticos y la conexión real con Kraken o Binance **está sin probar**. Pruébala con `python -m paperbot.run --once`.

## ¿En qué podría equivocarme?

1. **Una ventaja que en realidad es ruido.** Con pocas operaciones, un buen Brier score o un buen backtest pueden ser suerte. Antes de pensar en dinero real hacen falta cientos de operaciones fuera de muestra que batan a comprar y mantener **después de costes**.
2. **Costes infravalorados.** El 0,15 % por lado es optimista en momentos de volatilidad. En timeframes cortos los costes se comen casi cualquier ventaja.
3. **Que el "81 ms por vela" no importe.** En velas de 1 h la latencia no aporta nada. La ventaja, si existe, tiene que venir de la señal y no de la velocidad.
4. **Calibración que deja de servir.** Si el mercado cambia de régimen, la calibración aprendida deja de ser válida. Por eso la contracción hacia el 50 % y la exigencia de mejorar fuera de muestra.
5. **Dinero real sin supervisión.** Este repo no lo hace a propósito. Si algún día se conecta a un exchange, debería ser con una API key **sin permiso de retirada**, con una cantidad que puedas perder entera y después de meses en papel.

No es asesoramiento financiero.
