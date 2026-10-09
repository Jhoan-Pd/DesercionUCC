"""
Entrena el modelo de riesgo de deserción del Observatorio UCC (regresión logística, scikit-learn)
y exporta sus coeficientes a JSON para aplicarlos en el backend TypeScript (sin servidor Python).

Uso:
    pip install -r ml/requirements.txt
    npm run ml:dataset            # (opcional) regenera ml/datos/panel_entrenamiento.csv desde la BD
    python ml/entrenar_modelo.py  # entrena, evalúa y escribe ml/modelo_riesgo.json + ml/reporte_modelo.md

Unidad de análisis: estudiante-semestre. Variable objetivo y = 1 si el estudiante desertó al terminar
ese semestre o el siguiente (horizonte de un año académico). Las características ya vienen calculadas
por services/riesgo/caracteristicas.ts, el mismo código que usa la aplicación.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score, roc_curve  # noqa: E402
from sklearn.model_selection import GroupKFold, GroupShuffleSplit  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ / "datos" / "panel_entrenamiento.csv"
SALIDA_MODELO = RAIZ / "modelo_riesgo.json"
SALIDA_REPORTE = RAIZ / "reporte_modelo.md"
FIGURAS = RAIZ / "figuras"
SEMILLA = 2026
C = 1.0  # inverso de la regularización L2 (valor por defecto de scikit-learn)
HORIZONTE_SEMESTRES = 2


def dec(x: float, d: int = 3) -> str:
    """Número con coma decimal (formato colombiano)."""
    return f"{x:.{d}f}".replace(".", ",")


def miles(n: int) -> str:
    """Entero con punto de miles: 7.949"""
    return f"{n:,}".replace(",", ".")


def pct(x: float, d: int = 1) -> str:
    return f"{x * 100:.{d}f}".replace(".", ",") + " %"


def nuevo_modelo():
    """StandardScaler + regresión logística L2. tol muy bajo para que los coeficientes sean exactos
    (el entrenador TypeScript con Newton-Raphson debe reproducirlos)."""
    return make_pipeline(StandardScaler(), LogisticRegression(C=C, solver="lbfgs", max_iter=10_000, tol=1e-10))


def umbrales(tasa_base: float) -> dict:
    """Misma regla que EntrenadorLogistico.umbrales: MEDIO desde la tasa base, ALTO desde 2,5 veces."""
    tasa_base = float(tasa_base)
    medio = round(tasa_base, 2)
    alto = min(0.9, round(tasa_base * 2.5, 2))
    return {"medio": medio, "alto": max(alto, medio + 0.01)}


def metricas(y: np.ndarray, p: np.ndarray, umbral_alto: float) -> dict:
    alto = p >= umbral_alto
    vp = int(np.sum(alto & (y == 1)))
    fp = int(np.sum(alto & (y == 0)))
    fn = int(np.sum(~alto & (y == 1)))
    vn = int(np.sum(~alto & (y == 0)))
    orden = np.argsort(p)
    calibracion = []
    for d, grupo in enumerate(np.array_split(orden, 10), start=1):
        calibracion.append({"decil": d, "predicho": float(p[grupo].mean()), "observado": float(y[grupo].mean()), "n": int(len(grupo))})
    return {
        "n": int(len(y)),
        "positivos": int(y.sum()),
        "tasaBase": float(y.mean()),
        "auc": float(roc_auc_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
        "logLoss": float(log_loss(y, p)),
        "umbralAlto": umbral_alto,
        "precisionAlto": vp / (vp + fp) if vp + fp else 0.0,
        "sensibilidadAlto": vp / (vp + fn) if vp + fn else 0.0,
        "matrizConfusion": {"vp": vp, "fp": fp, "vn": vn, "fn": fn},
        "calibracion": calibracion,
    }


def main() -> None:
    df = pd.read_csv(DATOS)
    caracteristicas = [c for c in df.columns if c not in ("estudiante_id", "semestre_fila", "y")]
    if any("." in c and c.rsplit(".", 1)[-1].isdigit() for c in df.columns):
        raise SystemExit("Columnas duplicadas en el CSV (pandas las renombró con .1): revisa ml/exportar_dataset.ts")
    X = df[caracteristicas].to_numpy(dtype=float)
    y = df["y"].to_numpy(dtype=int)
    grupos = df["estudiante_id"].to_numpy()
    print(f"Datos: {miles(len(df))} filas, {miles(df['estudiante_id'].nunique())} estudiantes, {len(caracteristicas)} características, tasa base {pct(float(y.mean()), 2)}")

    # 1) Evaluación honesta: entrenamiento/prueba separando ESTUDIANTES (no filas)
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEMILLA)
    ent, prueba = next(gss.split(X, y, grupos))
    modelo = nuevo_modelo().fit(X[ent], y[ent])
    p_prueba = modelo.predict_proba(X[prueba])[:, 1]
    u = umbrales(float(y[ent].mean()))
    m_prueba = metricas(y[prueba], p_prueba, u["alto"])
    print(f"Prueba: AUC {dec(m_prueba['auc'])} · Brier {dec(m_prueba['brier'], 4)} · precisión alto {pct(m_prueba['precisionAlto'])} · sensibilidad alto {pct(m_prueba['sensibilidadAlto'])}")

    # 2) Validación cruzada por grupos (5 pliegues) para ver la estabilidad
    aucs = []
    for i_ent, i_val in GroupKFold(n_splits=5).split(X, y, grupos):
        m = nuevo_modelo().fit(X[i_ent], y[i_ent])
        aucs.append(roc_auc_score(y[i_val], m.predict_proba(X[i_val])[:, 1]))
    print(f"Validación cruzada: AUC {dec(float(np.mean(aucs)))} ± {dec(float(np.std(aucs)))}")

    # 3) Línea base simple para comparar: "promedio bajo" como único indicador
    auc_regla = roc_auc_score(y[prueba], -df["promedio"].to_numpy()[prueba])

    # 4) Modelo final con TODOS los datos -> coeficientes para producción
    final = nuevo_modelo().fit(X, y)
    escalador: StandardScaler = final.named_steps["standardscaler"]
    logistica: LogisticRegression = final.named_steps["logisticregression"]
    tasa_base = float(y.mean())
    zona = timezone(timedelta(hours=-5))
    ahora = datetime.now(zona)
    definicion = {
        "version": f"sklearn-{ahora:%Y%m%d}",
        "origen": "PYTHON_SKLEARN",
        "horizonteSemestres": HORIZONTE_SEMESTRES,
        "caracteristicas": caracteristicas,
        "medias": escalador.mean_.tolist(),
        # Desviación poblacional (0 si la variable es constante): igual que el entrenador TS
        "desviaciones": np.sqrt(escalador.var_).tolist(),
        "coeficientes": logistica.coef_[0].tolist(),
        "intercepto": float(logistica.intercept_[0]),
        "tasaBase": tasa_base,
        "umbrales": umbrales(tasa_base),
    }
    salida = {
        "definicion": definicion,
        "metricas": {
            **m_prueba,
            "aucValidacionCruzada": float(np.mean(aucs)),
            "aucValidacionCruzadaDesv": float(np.std(aucs)),
            "aucReglaPromedio": float(auc_regla),
            "entrenadoEn": ahora.isoformat(timespec="seconds"),
            "libreria": "scikit-learn",
            "C": C,
        },
    }
    SALIDA_MODELO.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Modelo exportado -> {SALIDA_MODELO.relative_to(RAIZ.parent)}")

    # 5) Figuras y reporte
    FIGURAS.mkdir(exist_ok=True)
    fpr, tpr, _ = roc_curve(y[prueba], p_prueba)
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot(fpr, tpr, color="#00549F", lw=2, label=f"Modelo (AUC = {dec(m_prueba['auc'])})")
    ax.plot([0, 1], [0, 1], color="#888", lw=1, ls="--", label="Azar (AUC = 0,5)")
    ax.set_xlabel("Tasa de falsos positivos")
    ax.set_ylabel("Tasa de verdaderos positivos (sensibilidad)")
    ax.set_title("Curva ROC — conjunto de prueba")
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: dec(v, 1)))
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: dec(v, 1)))
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(FIGURAS / "roc.png", dpi=120)
    plt.close(fig)

    cal = m_prueba["calibracion"]
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([c["predicho"] for c in cal], [c["observado"] for c in cal], "o-", color="#00549F", lw=2, label="Modelo por deciles")
    lim = max(max(c["predicho"] for c in cal), max(c["observado"] for c in cal)) * 1.1
    ax.plot([0, lim], [0, lim], color="#888", lw=1, ls="--", label="Calibración perfecta")
    ax.set_xlabel("Probabilidad predicha")
    ax.set_ylabel("Proporción observada que desertó")
    ax.set_title("Calibración — conjunto de prueba")
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: dec(v, 1)))
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: dec(v, 1)))
    ax.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(FIGURAS / "calibracion.png", dpi=120)
    plt.close(fig)

    coef = sorted(zip(caracteristicas, definicion["coeficientes"]), key=lambda t: -abs(t[1]))
    filas_coef = "\n".join(f"| `{c}` | {'+' if w >= 0 else '−'}{dec(abs(w))} | {dec(float(np.exp(w)), 2)} |" for c, w in coef)
    mc = m_prueba["matrizConfusion"]
    SALIDA_REPORTE.write_text(
        f"""# Reporte del modelo de riesgo de deserción

Generado por `ml/entrenar_modelo.py` el {ahora:%Y-%m-%d %H:%M} (hora de Colombia). Versión **{definicion['version']}**.

## Datos

- {miles(len(df))} filas estudiante-semestre de {miles(df['estudiante_id'].nunique())} estudiantes; {len(caracteristicas)} características.
- Objetivo: desertar al terminar el semestre o el siguiente (horizonte {HORIZONTE_SEMESTRES} semestres). Tasa base: **{pct(tasa_base)}**.
- Separación entrenamiento/prueba **por estudiante** (80/20) para evitar fuga de información entre semestres de una misma persona.

## Desempeño en el conjunto de prueba

| Métrica | Valor |
|---|---|
| AUC-ROC | **{dec(m_prueba['auc'])}** |
| AUC validación cruzada (5 pliegues por estudiante) | {dec(float(np.mean(aucs)))} ± {dec(float(np.std(aucs)))} |
| AUC de la regla simple "promedio bajo" | {dec(auc_regla)} |
| Brier | {dec(m_prueba['brier'], 4)} |
| Log-loss | {dec(m_prueba['logLoss'], 4)} |
| Umbral de riesgo ALTO | {pct(u['alto'], 0)} de probabilidad |
| Precisión en ALTO | {pct(m_prueba['precisionAlto'])} |
| Sensibilidad en ALTO | {pct(m_prueba['sensibilidadAlto'])} |

Matriz de confusión (ALTO vs. resto): VP {mc['vp']}, FP {mc['fp']}, FN {mc['fn']}, VN {mc['vn']}.

![Curva ROC](figuras/roc.png) ![Calibración](figuras/calibracion.png)

## Coeficientes (variables estandarizadas)

Un coeficiente positivo aumenta el riesgo. La razón de probabilidades (odds ratio) indica cuánto se multiplican las
probabilidades de desertar por cada desviación estándar que aumenta la variable.

| Característica | Coeficiente | Odds ratio |
|---|---|---|
{filas_coef}

Intercepto: {dec(definicion['intercepto'])} (probabilidad de un estudiante promedio: {pct(float(1 / (1 + np.exp(-definicion['intercepto']))))}).

## Niveles

- **BAJO**: probabilidad < {pct(definicion['umbrales']['medio'], 0)} (por debajo de la tasa base).
- **MEDIO**: entre {pct(definicion['umbrales']['medio'], 0)} y {pct(definicion['umbrales']['alto'], 0)}.
- **ALTO**: ≥ {pct(definicion['umbrales']['alto'], 0)} (2,5 veces la tasa base).

> Los datos son sintéticos: las relaciones que el modelo encuentra son las que se programaron en el generador.
> Con datos reales de la UCC el procedimiento es el mismo (exportar, entrenar, revisar este reporte).
""",
        encoding="utf-8",
    )
    print(f"Reporte -> {SALIDA_REPORTE.relative_to(RAIZ.parent)}")


if __name__ == "__main__":
    main()
