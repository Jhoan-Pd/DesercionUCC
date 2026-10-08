# Reporte del modelo de riesgo de deserción

Generado por `ml/entrenar_modelo.py` el 2026-10-08 11:07 (hora de Colombia). Versión **sklearn-20261008**.

## Datos

- 7.949 filas estudiante-semestre de 1.491 estudiantes; 21 características.
- Objetivo: desertar al terminar el semestre o el siguiente (horizonte 2 semestres). Tasa base: **11,4 %**.
- Separación entrenamiento/prueba **por estudiante** (80/20) para evitar fuga de información entre semestres de una misma persona.

## Desempeño en el conjunto de prueba

| Métrica | Valor |
|---|---|
| AUC-ROC | **0,819** |
| AUC validación cruzada (5 pliegues por estudiante) | 0,829 ± 0,026 |
| AUC de la regla simple "promedio bajo" | 0,753 |
| Brier | 0,0915 |
| Log-loss | 0,3053 |
| Umbral de riesgo ALTO | 28 % de probabilidad |
| Precisión en ALTO | 48,2 % |
| Sensibilidad en ALTO | 47,7 % |

Matriz de confusión (ALTO vs. resto): VP 95, FP 102, FN 104, VN 1225.

![Curva ROC](figuras/roc.png) ![Calibración](figuras/calibracion.png)

## Coeficientes (variables estandarizadas)

Un coeficiente positivo aumenta el riesgo. La razón de probabilidades (odds ratio) indica cuánto se multiplican las
probabilidades de desertar por cada desviación estándar que aumenta la variable.

| Característica | Coeficiente | Odds ratio |
|---|---|---|
| `semestre` | −0,767 | 0,46 |
| `promedio` | −0,620 | 0,54 |
| `fin_beca` | −0,366 | 0,69 |
| `horas_trabajo` | +0,351 | 1,42 |
| `programa:Ingeniería de Sistemas` | +0,243 | 1,28 |
| `materias_perdidas` | +0,172 | 1,19 |
| `fin_icetex` | −0,170 | 0,84 |
| `estrato_1_2` | +0,158 | 1,17 |
| `asistencia` | −0,156 | 0,86 |
| `fin_credito_ucc` | −0,152 | 0,86 |
| `programa:Enfermería` | −0,130 | 0,88 |
| `ingreso_22_mas` | +0,124 | 1,13 |
| `programa:Ingeniería Civil` | +0,124 | 1,13 |
| `programa:Odontología` | −0,103 | 0,90 |
| `programa:Contaduría Pública` | +0,096 | 1,10 |
| `estrato_4_mas` | −0,083 | 0,92 |
| `primer_anio` | −0,063 | 0,94 |
| `programa:Administración de Empresas` | +0,060 | 1,06 |
| `programa:Medicina` | −0,048 | 0,95 |
| `caida_promedio` | +0,021 | 1,02 |
| `programa:Psicología` | −0,015 | 0,99 |

Intercepto: -2,757 (probabilidad de un estudiante promedio: 6,0 %).

## Niveles

- **BAJO**: probabilidad < 11 % (por debajo de la tasa base).
- **MEDIO**: entre 11 % y 29 %.
- **ALTO**: ≥ 29 % (2,5 veces la tasa base).

> Los datos son sintéticos: las relaciones que el modelo encuentra son las que se programaron en el generador.
> Con datos reales de la UCC el procedimiento es el mismo (exportar, entrenar, revisar este reporte).
