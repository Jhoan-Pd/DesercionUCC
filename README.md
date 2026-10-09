# Observatorio de Deserción UCC

Sistema web que **mide el impacto de desertar** de la educación superior y ayuda a **detectar estudiantes en riesgo** en la Universidad Cooperativa de Colombia, sede Pasto.

Proyecto final de la asignatura *Programación Orientada a la Web*.

> **Estado actual: Fase 2 completa.** Además de la Fase 1 (BD, datos sintéticos, autenticación por roles, dashboard institucional y calculadora de impacto), ya funcionan el **modelo de riesgo** (regresión logística entrenada en Python), la **alerta temprana**, la **encuesta de autoevaluación** y el **panel docente**. Los módulos de la Fase 3 aparecen en el menú como "Fase 3".

![Dashboard institucional](docs/capturas/dashboard.png)

---

## 1. Problema

En Colombia, cerca de 4 de cada 10 estudiantes que ingresan a la educación superior la abandonan antes de terminar (SPADIES, MEN). La deserción tiene costos en cuatro dimensiones:

| Dimensión | Qué se pierde |
|---|---|
| **Económica (estudiante y familia)** | Dinero invertido, deuda sin título que la respalde, menores ingresos de por vida. |
| **Académica** | Créditos cursados sin titulación, trayectorias interrumpidas. |
| **Institucional (UCC)** | Ingresos por matrícula, indicadores de permanencia y graduación. |
| **Social y regional** | Talento que Nariño y el sur del país dejan de formar. |

Las decisiones de retiro suelen tomarse sin dimensionar estos costos y las alertas llegan tarde.

## 2. Objetivos

1. Medir el impacto de la deserción en las cuatro dimensiones.
2. Identificar estudiantes en riesgo y registrar intervenciones para evaluar si funcionan.
3. Permitir que un estudiante simule "¿qué pasa si me retiro?" antes de decidir.

## 3. Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| **1** | Proyecto, BD con Prisma y seed sintético, auth con roles, dashboard institucional, calculadora de impacto, despliegue en Vercel | ✅ Lista |
| **2** | Modelo de riesgo (regresión logística), alerta temprana, encuesta del estudiante, panel docente | ✅ Lista |
| 3 | Intervenciones y su efectividad, impacto institucional, reportes PDF/Excel, importación CSV, README final | Pendiente |

---

## 4. Arquitectura

```mermaid
flowchart LR
    U[Navegador] -->|HTTPS| MW[Middleware Edge<br/>protección por rol]
    MW --> P[Páginas App Router<br/>Server Components]
    MW --> API[API Routes<br/>Zod en cada endpoint]
    P --> S[Servicios POO<br/>ServicioDashboard · ServicioImpacto · ServicioParametros]
    API --> S
    S --> C[Lógica pura<br/>CalculadoraImpacto · calculos.ts]
    S --> DB[(PostgreSQL<br/>Supabase / Neon)]
    P -. "Client Components" .-> R[Recharts · React Hook Form]
    subgraph Vercel
      MW
      P
      API
      S
      C
    end
```

Un solo despliegue en **Vercel** (frontend + API) y la base de datos en **Supabase o Neon** (plan gratuito).

### Estructura de carpetas

```
observatorio-desercion-ucc/
├── app/                       # Rutas (App Router)
│   ├── (auth)/login/          # Inicio de sesión
│   ├── (app)/                 # Páginas protegidas (layout con menú por rol)
│   │   ├── dashboard/         # Dashboard institucional (+ loading.tsx)
│   │   ├── calculadora/       # Calculadora de impacto
│   │   ├── alerta-temprana/   # Lista priorizada y ficha del estudiante (Bienestar)
│   │   ├── encuesta/          # Autoevaluación del estudiante
│   │   ├── panel-docente/     # Señales académicas de los cursos del docente
│   │   ├── admin/parametros/  # Parámetros editables (ADMIN)
│   │   └── [modulo]/          # Módulos de la Fase 3 ("próximamente")
│   ├── api/                   # API REST (auth, dashboard, impacto, parametros, riesgo, alertas, encuesta, docente)
│   └── acceso-denegado/
├── components/
│   ├── ui/                    # Componentes estilo shadcn/ui (button, card, input...)
│   ├── layout/                # Sidebar, formulario de login
│   ├── dashboard/             # Gráficas, filtros, KPIs
│   ├── calculadora/           # Formulario y resultados
│   ├── riesgo/                # Insignia de nivel, gráfica de factores, gestor de alertas
│   ├── encuesta/              # Formulario Likert y resultado
│   ├── docente/               # Panel docente
│   └── admin/                 # Editor de parámetros
├── lib/                       # prisma, auth, rbac, roles, utilidades, validadores Zod
├── services/                  # Lógica de negocio (POO)
│   ├── impacto/               # CalculadoraImpacto (pura) + ServicioImpacto
│   ├── dashboard/             # calculos.ts (puro) + ServicioDashboard
│   ├── riesgo/                # ModeloRiesgo, EntrenadorLogistico, características, ServicioRiesgo
│   ├── encuesta/              # Preguntas, EvaluadorEncuesta, ServicioEncuesta
│   ├── alertas/ · docente/    # ServicioAlertas, ServicioDocente
│   └── parametros/            # ServicioParametros + conversores
├── prisma/
│   ├── schema.prisma          # 19 tablas
│   ├── migrations/            # Migraciones SQL (inicial + Fase 2)
│   ├── seed.ts                # Inserta los datos
│   └── seed/                  # Generador sintético (puro y determinista)
├── ml/                        # Exportación del panel, entrenamiento scikit-learn, notebook, reporte y modelo JSON
├── tests/                     # Vitest (99 pruebas)
├── docs/                      # Diagrama ER y capturas
└── middleware.ts              # Protección de rutas por rol
```

### Clases principales (POO)

| Clase | Responsabilidad | Métodos clave |
|---|---|---|
| `CalculadoraImpacto` | Cálculo financiero puro (sin BD) | `calcular`, `calcularInversion`, `calcularDeuda`, `calcularCostoOportunidad`, `compararEscenarios`, `cuotaFrancesa` (estático) |
| `ServicioImpacto` | Carga perfiles y parámetros, aplica control de acceso individual | `perfilPorPrograma`, `perfilPorEstudiante`, `calcular` |
| `ServicioDashboard` | Consulta la BD con filtros combinables y arma el resumen | `construirWhere` (estático), `obtenerResumen` |
| `ServicioParametros` | Lectura y edición de parámetros OLE/SPADIES | `listar`, `actualizar`, `mapa`, `paraCalculadora`, `referenciasSpadies` |
| `ModeloRiesgo` | Aplica la regresión logística exportada desde Python: probabilidad, puntaje 0-100, nivel y aporte exacto de cada factor | `predecir`, `predecirVector`, `clasificar`, `principalesRiesgos` |
| `EntrenadorLogistico` | Reentrena la regresión logística en TypeScript (Newton-Raphson con L2), con los mismos coeficientes que scikit-learn | `ajustar` |
| `ServicioRiesgo` | Recalcula puntajes, genera alertas del modelo, lista priorizada y ficha del estudiante | `recalcular`, `listaPriorizada`, `detalle` |
| `EvaluadorEncuesta` | Puntaje por dimensión y global de la encuesta, regla de intención de retiro y recursos sugeridos | `validar`, `evaluar` (estáticos) |
| `ServicioEncuesta` · `ServicioAlertas` · `ServicioDocente` | Encuesta con consentimiento, alertas con control de acceso por curso, señales académicas del docente | `responder`, `crear`, `cambiarEstado`… |
| `Aleatorio` | Generador pseudoaleatorio con semilla para el seed | `normal`, `bernoulli`, `ponderado` |
| `ErrorApi` | Errores controlados con código HTTP | — |

> `GeneradorReportes` (Fase 3) seguirá el mismo patrón.

---

## 5. Modelo de datos (diagrama entidad-relación)

19 tablas: las 16 pedidas (`roles`, `usuarios`, `programas`, `periodos`, `estudiantes`, `matriculas`, `notas_semestre`, `financiacion`, `retiros`, `causas_desercion`, `encuestas`, `respuestas_encuesta`, `puntajes_riesgo`, `alertas`, `intervenciones`, `parametros_economicos`) más 3 de la Fase 2: `cursos` e `inscripciones` (panel docente) y `modelos_riesgo` (versiones del modelo). Versión completa con todos los atributos: [`docs/diagrama-er.png`](docs/diagrama-er.png) (fuente: [`docs/diagrama-er.mmd`](docs/diagrama-er.mmd)).

```mermaid
erDiagram
    ROLES ||--o{ USUARIOS : "asigna"
    ESTUDIANTES |o--o| USUARIOS : "cuenta de"
    PROGRAMAS ||--o{ ESTUDIANTES : "matricula a"
    PERIODOS ||--o{ ESTUDIANTES : "cohorte de ingreso"
    ESTUDIANTES ||--o{ MATRICULAS : "tiene"
    PERIODOS ||--o{ MATRICULAS : "en"
    ESTUDIANTES ||--o{ NOTAS_SEMESTRE : "obtiene"
    PERIODOS ||--o{ NOTAS_SEMESTRE : "en"
    ESTUDIANTES ||--o{ FINANCIACION : "se financia con"
    ESTUDIANTES ||--o| RETIROS : "puede tener"
    PERIODOS ||--o{ RETIROS : "ocurre en"
    CAUSAS_DESERCION ||--o{ RETIROS : "explica"
    ESTUDIANTES ||--o{ ENCUESTAS : "responde"
    ENCUESTAS ||--o{ RESPUESTAS_ENCUESTA : "contiene"
    ESTUDIANTES ||--o{ PUNTAJES_RIESGO : "recibe"
    PERIODOS |o--o{ PUNTAJES_RIESGO : "calculado en"
    ESTUDIANTES ||--o{ ALERTAS : "genera"
    USUARIOS |o--o{ ALERTAS : "reporta"
    ESTUDIANTES ||--o{ INTERVENCIONES : "recibe"
    USUARIOS ||--o{ INTERVENCIONES : "responsable"
    PROGRAMAS |o--o{ PARAMETROS_ECONOMICOS : "salario propio"
    USUARIOS |o--o{ PARAMETROS_ECONOMICOS : "última edición"
    PROGRAMAS ||--o{ CURSOS : "ofrece"
    USUARIOS ||--o{ CURSOS : "docente de"
    CURSOS ||--o{ INSCRIPCIONES : "tiene"
    ESTUDIANTES ||--o{ INSCRIPCIONES : "cursa"
    CURSOS |o--o{ ALERTAS : "reportada desde"
    USUARIOS |o--o{ MODELOS_RIESGO : "entrenó"

    ROLES { int id PK
        string nombre UK }
    USUARIOS { uuid id PK
        string email UK
        string passwordHash
        int rolId FK
        uuid estudianteId FK }
    PROGRAMAS { uuid id PK
        string nombre UK
        int duracionSemestres
        int valorSemestre }
    PERIODOS { uuid id PK
        string codigo UK
        int indice UK
        boolean activo }
    ESTUDIANTES { uuid id PK
        string codigo UK
        string hashAnonimo UK
        int estrato
        boolean trabaja
        uuid programaId FK
        uuid periodoIngresoId FK
        string cohorte
        enum estado
        boolean consentimientoDatos }
    MATRICULAS { uuid id PK
        uuid estudianteId FK
        uuid periodoId FK
        int valorMatricula }
    NOTAS_SEMESTRE { uuid id PK
        uuid estudianteId FK
        uuid periodoId FK
        float promedio
        int materiasPerdidas
        float asistenciaPct }
    FINANCIACION { uuid id PK
        uuid estudianteId FK
        enum tipo
        int saldoPendiente
        float tasaEA }
    RETIROS { uuid id PK
        uuid estudianteId FK
        uuid periodoId FK
        int semestreRetiro
        uuid causaId FK }
    CAUSAS_DESERCION { uuid id PK
        string nombre UK
        enum categoria }
    ENCUESTAS { uuid id PK
        uuid estudianteId FK
        boolean consentimiento }
    RESPUESTAS_ENCUESTA { uuid id PK
        uuid encuestaId FK
        int valor }
    PUNTAJES_RIESGO { uuid id PK
        uuid estudianteId FK
        int puntaje
        json factores }
    ALERTAS { uuid id PK
        uuid estudianteId FK
        uuid creadaPorId FK
        enum estado }
    INTERVENCIONES { uuid id PK
        uuid estudianteId FK
        uuid responsableId FK
        enum tipo }
    PARAMETROS_ECONOMICOS { uuid id PK
        string clave
        float valor
        uuid programaId FK }
    CURSOS { uuid id PK
        string codigo
        uuid docenteId FK
        uuid periodoId FK }
    INSCRIPCIONES { uuid id PK
        uuid cursoId FK
        uuid estudianteId FK
        float notaParcial
        float asistenciaPct }
    MODELOS_RIESGO { uuid id PK
        string version UK
        json definicion
        boolean activo }
```

---

## 6. Instalación local

### Requisitos

- **Node.js 18.18 o superior** (recomendado 20 LTS): `node -v`
- Una base de datos PostgreSQL. Lo más simple es usar **el mismo proyecto gratuito de Supabase o Neon** que usarás en producción (sección 8). Alternativa con Docker:
  `docker run --name pg-ucc -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=observatorio -p 5432:5432 -d postgres:16`

> **Windows + OneDrive:** no instales el proyecto dentro de una carpeta sincronizada con OneDrive (por ejemplo `Escritorio` cuando está respaldado). `npm install` crea decenas de miles de archivos en `node_modules`; OneDrive intenta subirlos y suele provocar errores `EPERM`/`EBUSY` y lentitud. Copia la carpeta a una ruta local, por ejemplo `C:\dev\observatorio-desercion-ucc`, y trabaja desde ahí (en GitHub y Vercel no cambia nada).

### Pasos

```bash
# 1. Entrar a la carpeta e instalar dependencias (también genera el cliente de Prisma)
cd observatorio-desercion-ucc
npm install

# 2. Crear el archivo de variables de entorno
cp .env.example .env          # Windows PowerShell:  Copy-Item .env.example .env
#    ...y editar .env con tu DATABASE_URL, DIRECT_URL y NEXTAUTH_SECRET (sección 7)

# 3. Crear las tablas (aplica prisma/migrations)
npx prisma migrate deploy

# 4. Cargar los datos sintéticos (1.500 estudiantes, usuarios demo, parámetros)
npm run db:seed

# 5. Arrancar en modo desarrollo
npm run dev                   # abre http://localhost:3000
```

Comandos útiles:

| Comando | Para qué |
|---|---|
| `npm test` | Ejecuta las 60 pruebas de Vitest |
| `npm run typecheck` | Verifica tipos de TypeScript |
| `npm run lint` | ESLint |
| `npm run build` y `npm start` | Compila y ejecuta en modo producción |
| `npm run db:studio` | Abre Prisma Studio para ver las tablas |
| `npm run db:seed` | Vuelve a cargar los datos (borra y recrea) |
| `npm run ml:dataset` | Exporta el panel estudiante-semestre de la BD a `ml/datos/panel_entrenamiento.csv` |
| `npm run ml:entrenar` | Entrena el modelo con scikit-learn y escribe `ml/modelo_riesgo.json` y `ml/reporte_modelo.md` (requiere `pip install -r ml/requirements.txt`) |

### Usuarios demo

| Rol | Correo | Ve |
|---|---|---|
| ADMIN | `admin@ucc.edu.co` | Todo + parámetros |
| BIENESTAR | `bienestar@ucc.edu.co` | Dashboard, alerta temprana (lista y ficha), calculadora con perfil por código |
| DOCENTE | `docente@ucc.edu.co` | Panel docente con sus 8 cursos del periodo 2026-2 y la calculadora |
| ESTUDIANTE | `estudiante@ucc.edu.co` | Su calculadora con sus datos precargados y la encuesta de autoevaluación |

La contraseña de todas es la de la variable `SEED_DEMO_PASSWORD` del `.env` (valor de ejemplo en `.env.example`). **Cámbiala antes de compartir la URL pública** y vuelve a correr el seed.

---

## 7. Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión que usa la app (en Vercel: **con pooler**) | `postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Conexión directa para migraciones de Prisma | `postgresql://...:5432/postgres` |
| `NEXTAUTH_SECRET` | Secreto para firmar la sesión (mínimo 32 caracteres aleatorios) | ver abajo |
| `NEXTAUTH_URL` | URL pública de la app | `http://localhost:3000` / `https://tu-app.vercel.app` |
| `SEED_DEMO_PASSWORD` | Contraseña de las cuentas demo (solo la usa el seed) | |

Generar `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
# Windows (sin openssl):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 8. Despliegue paso a paso (Supabase o Neon + Vercel)

### 8.1 Base de datos

**Opción A — Supabase**

1. Entra a <https://supabase.com>, crea un proyecto (región recomendada: **South America (São Paulo)**) y guarda la contraseña de la base de datos.
2. Botón **Connect** → pestaña **ORMs** → **Prisma**. Copia las dos cadenas:
   - `DATABASE_URL` → la del **Transaction pooler** (puerto **6543**) y agrega al final `&connection_limit=1` (si no tiene `?`, usa `?pgbouncer=true&connection_limit=1`).
   - `DIRECT_URL` → la del **Session pooler / conexión directa** (puerto **5432**).
3. Reemplaza `[YOUR-PASSWORD]` por tu contraseña.

**Opción B — Neon**

1. Entra a <https://neon.tech>, crea un proyecto (región cercana, p. ej. AWS São Paulo o US East).
2. En **Connection Details**: con **Connection pooling** activado copia la cadena para `DATABASE_URL` (host con `-pooler`) y agrega `&pgbouncer=true&connection_limit=1`; desactívalo y copia la otra para `DIRECT_URL`. Ambas deben terminar con `sslmode=require`.

### 8.2 Crear las tablas y cargar los datos (desde tu PC, una sola vez)

Pon esas dos cadenas en tu `.env` local y ejecuta:

```bash
npx prisma migrate deploy
npm run db:seed
```

Debe mostrar `✅ Seed completado` con 1.500 estudiantes.

### 8.3 Subir el código a GitHub

```bash
cd observatorio-desercion-ucc
git init
git add .
git commit -m "Fase 1: Observatorio de Deserción UCC"
# crea un repositorio vacío en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/observatorio-desercion-ucc.git
git branch -M main
git push -u origin main
```

El `.gitignore` ya excluye `.env` y `node_modules`: **nunca subas tu `.env`**.

### 8.4 Vercel

1. Entra a <https://vercel.com> con tu cuenta de GitHub → **Add New… → Project** → importa el repositorio.
2. Framework: **Next.js** (se detecta solo). Deja el *Build Command* por defecto (`npm run build`, que ejecuta `prisma generate && next build`).
3. En **Environment Variables** agrega: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` y `NEXTAUTH_URL` (pon temporalmente `https://observatorio-desercion-ucc.vercel.app` o el nombre que elijas).
4. **Deploy**. Cuando termine, copia la URL real (Settings → Domains), actualiza `NEXTAUTH_URL` con ella y haz **Redeploy**.
5. Prueba: abre la URL, entra con `bienestar@ucc.edu.co` y revisa el dashboard; luego con `estudiante@ucc.edu.co` y calcula el impacto.

> Consejo: en Vercel → Settings → Functions, elige la región de las funciones **igual o cercana** a la de la base de datos (p. ej. `gru1` São Paulo si usas Supabase São Paulo) para que las consultas sean rápidas.

### 8.5 Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| `Environment variable not found: DIRECT_URL` | Falta `DIRECT_URL` en `.env` o en Vercel. |
| `prepared statement "s0" already exists` | `DATABASE_URL` usa el pooler sin `?pgbouncer=true`. |
| Login vuelve a /login sin error en Vercel | `NEXTAUTH_URL` no coincide con la URL real o falta `NEXTAUTH_SECRET`. Corrige y haz Redeploy. |
| `Can't reach database server` | Cadena de conexión o contraseña incorrecta; en Neon falta `sslmode=require`. |
| `prisma migrate deploy` falla con el pooler | Las migraciones usan `DIRECT_URL` (puerto 5432): revísala. Alternativa: `npx prisma db push`. |
| El dashboard aparece vacío | No se ejecutó `npm run db:seed` contra esa base de datos. |

---

## 9. Cómo funciona

### 9.1 Datos sintéticos (seed)

Los datos reales son privados (Ley 1581 de 2012), así que `prisma/seed/generador.ts` simula **1.500 estudiantes** de 9 programas, cohortes **2018-1 a 2025-2**, con edad, sexo, estrato, municipio de origen (Nariño, Putumayo, Cauca, Valle), trabajo y horas, financiación (recursos propios, ICETEX, beca, crédito UCC), notas, materias perdidas y asistencia por semestre.

La deserción **no se asigna al azar**: se simula semestre a semestre con un modelo logit que depende de estrato, carga laboral, promedio, materias perdidas, asistencia, financiación, programa y semestre (el riesgo es mayor en los primeros semestres). Está calibrado para que la deserción acumulada a 10 semestres ronde el **40 %** (SPADIES nacional: 36,7 %). Cada retiro tiene una causa clasificada en las **cuatro categorías del MEN (SPADIES)**: individuales, académicas, socioeconómicas e institucionales, elegida según el perfil del estudiante. El generador es **determinista** (semilla fija): siempre produce el mismo dataset.

### 9.2 Dashboard institucional

Tasa de deserción por **cohorte, programa, semestre cursado y periodo**, curva de supervivencia por cohorte, causas principales, dimensión regional por municipio y comparación con el promedio nacional. Seis **filtros combinables** (programa, cohorte, estrato, financiación, sexo, trabajo) guardados en la URL. Cada gráfica tiene una vista alternativa en **tabla**.

Decisiones metodológicas:
- **Censura de cohortes recientes.** Una cohorte de 2025 aún no termina, así que su "desertores/total" parece baja. Por eso cada cohorte se compara con la referencia nacional **a la misma antigüedad**, y la curva de supervivencia usa el estimador **Kaplan-Meier** (cuenta a los estudiantes activos solo hasta su último semestre completo y trata a los graduados como salidas sin evento).
- **Tasa por periodo:** retiros del periodo / matriculados del periodo. La referencia anual nacional se convierte a su equivalente semestral, `1 − √(1 − anual)`, para comparar en la misma escala.
- **Tasa anual institucional:** combina los dos últimos periodos cerrados, `1 − (1 − t₁)(1 − t₂)`.

### 9.3 Calculadora de impacto ("¿qué pasa si me retiro?")

| Resultado | Cálculo |
|---|---|
| **Dinero invertido** | matrícula (real o valor × semestres) + transporte × meses + materiales × semestres + sostenimiento × meses; y quién lo pagó (deuda, beca, familia). |
| **Deuda** | Cuota fija (sistema francés): `C = S·i / (1 − (1+i)^−n)`, con `i = (1+EA)^(1/12) − 1`. Se muestra qué % del ingreso se va en la cuota **sin título** vs **con título**. |
| **Costo de oportunidad** | Simulación mes a mes de ingresos de profesional vs bachiller/técnico/tecnólogo a **10, 20 y 30 años**, con crecimiento salarial real y **valor presente neto** `VP = Σ flujoₘ / (1+r)^(m/12)`. Se reporta la diferencia de ingresos y la diferencia **neta** (restando lo que cuesta terminar). |
| **Punto de equilibrio** | Año en que el camino "graduarme" recupera lo invertido frente a "retirarme". |
| **Escenarios** | Retirarse (línea base), continuar, aplazar un semestre, jornada nocturna/virtual (más duración, trabajo simultáneo, descuento) y apoyo financiero (beca parcial). |

Simplificaciones explícitas: valores en pesos reales (sin inflación); el sostenimiento no entra en la comparación de escenarios (se paga igual estudiando o trabajando); la deuda existente se paga en todos los escenarios.

Todos los supuestos (SMMLV 2026, salarios de enganche del Observatorio Laboral para la Educación por programa, tasas, crecimiento, tasa de descuento, referencias SPADIES) se editan en **Admin → Parámetros** sin tocar código. Los salarios por programa incluidos son **valores de ejemplo**: actualízalos con <https://ole.mineducacion.gov.co> antes de la sustentación final.

### 9.4 Modelo de riesgo (regresión logística)

**Pregunta que responde:** ¿qué probabilidad tiene este estudiante de desertar al terminar el semestre que cursa o el siguiente (un año académico)?

1. **Panel estudiante-semestre** (`services/riesgo/caracteristicas.ts`): una fila por cada semestre cursado, con 21 características que la universidad conoce durante el semestre: promedio, materias perdidas, asistencia, caída del promedio, horas de trabajo, estrato, edad de ingreso, semestre, financiación y programa. **No se usan sexo ni municipio** (evitan sesgos y no son accionables). Los semestres cuyo desenlace aún no se conoce (censurados) se excluyen del entrenamiento.
2. **Exportación** (`npm run ml:dataset`) → CSV, y **entrenamiento** en Python (`ml/entrenar_modelo.py`): `StandardScaler` + `LogisticRegression(C=1)` de scikit-learn, separación entrenamiento/prueba **por estudiante** (sin fuga de información), validación cruzada de 5 pliegues y comparación contra una regla simple. Se exportan coeficientes, medias y desviaciones a `ml/modelo_riesgo.json`. El análisis completo está en el notebook `ml/modelo_riesgo.ipynb` y en [`ml/reporte_modelo.md`](ml/reporte_modelo.md).
3. **Predicción en TypeScript** (`ModeloRiesgo`): sin servidor Python en producción. `p = 1/(1+e^-(b₀ + Σ βᵢ·zᵢ))`, puntaje = `round(100·p)`.
4. **Explicación exacta**: como las variables están estandarizadas, el aporte de cada factor es `βᵢ·zᵢ` (cuánto aleja al estudiante del promedio). La suma de aportes más el intercepto reconstruye la probabilidad; no es una aproximación.
5. **Reentrenamiento sin Python**: `EntrenadorLogistico` resuelve el mismo problema con Newton-Raphson y una prueba automática verifica que reproduce los coeficientes de scikit-learn.

| Métrica (conjunto de prueba) | Valor |
|---|---|
| AUC-ROC | **0,819** (validación cruzada 0,829 ± 0,026) |
| AUC de la regla "promedio bajo" | 0,753 |
| Brier | 0,091 |
| Niveles | BAJO < 11 % · MEDIO 11-29 % · ALTO ≥ 29 % (tasa base 11,4 %) |

### 9.5 Alerta temprana (Bienestar)

Lista priorizada de los estudiantes activos ordenada por puntaje, con nivel (ícono + texto, no solo color), los 3 factores que más pesan, alertas abiertas y filtros por nivel, programa, semestre y búsqueda. Botón para **recalcular** todos los puntajes con el modelo activo (genera alertas automáticas para los de nivel ALTO). La **ficha del estudiante** muestra la gráfica de factores, el historial de notas, los cursos del periodo, la última encuesta y las alertas, cuyo estado (abierta, en seguimiento, cerrada) gestiona Bienestar. Cada consulta individual queda en el registro de auditoría.

### 9.6 Encuesta de autoevaluación (estudiante)

16 preguntas Likert en cuatro dimensiones (económica, académica, motivación y entorno), algunas invertidas para evitar respuestas automáticas. Exige **consentimiento informado** antes de empezar y pregunta si autoriza que Bienestar lo contacte. `EvaluadorEncuesta` calcula el puntaje por dimensión y global (BAJO < 35, MEDIO 35-55, ALTO ≥ 55); si el estudiante declara intención de retirarse, el nivel sube al menos a MEDIO. Al terminar ve su resultado y los **recursos** de la UCC según sus dimensiones más altas (tutorías, becas, apoyo psicológico, bienestar). Solo si el resultado es ALTO **y** autorizó el contacto se crea una alerta para Bienestar.

### 9.7 Panel docente

El docente ve únicamente sus cursos del periodo actual con la nota parcial, asistencia y fallas de cada estudiante, y las **señales** (nota parcial < 3,0 o asistencia < 80 %). Puede reportar una alerta a Bienestar desde cada fila. Por **minimización de datos** no ve el puntaje del modelo ni información socioeconómica, y la API verifica que el estudiante esté inscrito en uno de sus cursos antes de aceptar el reporte.

---

## 10. Seguridad y Ley 1581 de 2012 (habeas data)

- **Autenticación** con Auth.js (credenciales), contraseñas con **bcrypt**, sesión JWT firmada de 8 horas.
- **Autorización por rol en dos capas**: `middleware.ts` (antes de renderizar) y cada endpoint (`manejar(roles, …)`). Fuente única de permisos: `lib/rbac.ts`.
- **Datos individuales** solo para ADMIN y BIENESTAR (y cada estudiante los suyos). Un docente o estudiante que pida el código de otro estudiante recibe solo valores generales. Cada consulta individual de Bienestar/Admin se registra en el log (`[AUDITORIA]`, con el hash anónimo).
- **Anonimización**: cada estudiante tiene un `hashAnonimo`; el dashboard solo muestra agregados.
- **Consentimiento**: campos `consentimientoDatos` / `fechaConsentimiento` en estudiantes; la encuesta no se puede responder sin consentimiento y la alerta a Bienestar requiere autorización expresa de contacto.
- **Minimización**: el docente solo ve datos académicos de sus cursos; el puntaje del modelo y los datos socioeconómicos son solo para Bienestar y Administración.
- **Validación Zod** en cada endpoint con mensajes en español; errores controlados con códigos HTTP correctos (400, 401, 403, 404).
- El login solo redirige a rutas internas (rechaza `//sitio` y `/\sitio`, evitando redirecciones abiertas).
- Pendiente para la Fase 3: límite de intentos de inicio de sesión (rate limiting) y tabla de auditoría persistente.

---

## 11. Decisiones técnicas (resumen para sustentar)

| Decisión | Por qué |
|---|---|
| **Next.js App Router** | Front y API en un solo proyecto y un solo despliegue gratuito en Vercel; Server Components consultan la BD sin exponer credenciales. |
| **Prisma + PostgreSQL** | Esquema tipado de extremo a extremo y migraciones versionadas; Postgres gratis en Supabase/Neon. |
| **Auth.js con JWT** | El rol viaja firmado en la cookie: el middleware puede autorizar en el Edge sin consultar la BD. |
| **Lógica pura separada de la BD** | `CalculadoraImpacto` y `calculos.ts` no conocen Prisma ni React: se prueban con Vitest en milisegundos y se reutilizan. |
| **Agregación en memoria** | ~1.500 registros: más simple y flexible para filtros combinables que una consulta SQL por gráfica. Con cientos de miles se pasaría a vistas SQL. |
| **Filtros en la URL** | Se pueden compartir y el servidor recalcula con los mismos parámetros. |
| **IDs UUID y montos `Int`** | UUID evita enumerar registros y permite crear relaciones antes de insertar; el peso colombiano no usa decimales. |
| **Roles en tabla** | Normalizado: agregar un rol no requiere migrar un enum. |
| **Parámetros en BD** | Salarios OLE y valores SPADIES cambian cada año: el admin los actualiza sin desplegar. |
| **Select nativo** | Accesible y ligero para filtros; los demás componentes siguen el estilo de shadcn/ui. |
| **Kaplan-Meier** | Evita el sesgo de las cohortes que aún no terminan. |
| **Generador con semilla** | Datos reproducibles: los tests y la sustentación muestran siempre los mismos números. |

---

## 12. Pruebas y verificación

```bash
npm test
```

**99 pruebas** en 8 archivos:

- `calculadora-impacto.test.ts` (30): inversión, cuota francesa contra un valor verificado, deuda con y sin título, VPN vs nominal, horizontes, punto de equilibrio, escenarios, entradas inválidas.
- `riesgo-modelo.test.ts` (15): el entrenador TS reproduce los coeficientes de scikit-learn, la explicación reconstruye exactamente la probabilidad, niveles, AUC y métricas.
- `dashboard-calculos.test.ts` (12): Kaplan-Meier con casos calculados a mano y censura, tasas por cohorte, semestre y periodo, tasa anual, causas y KPIs.
- `seed-integridad.test.ts` (12): llaves foráneas, unicidad, coherencia estado/retiro, rangos válidos y realismo de la deserción simulada.
- `riesgo-caracteristicas.test.ts` (11): etiquetas del panel a dos semestres, exclusión de semestres censurados y vectorización.
- `encuesta.test.ts` (8): puntajes extremos, preguntas invertidas, regla de intención de retiro y validación.
- `conversores.test.ts` (6): conversión de parámetros y formatos.
- `seed-academico.test.ts` (5): cursos, docentes e inscripciones coherentes con el periodo en curso.

Además, cada fase se verificó de punta a punta contra **PostgreSQL 16**: la migración `prisma/migrations` (estructura idéntica al esquema: columnas, tipos, restricciones, índices y enums), seed y re-seed, login de los 4 roles, matriz de permisos de todas las rutas y APIs (69 verificaciones), validaciones con mensajes en español, edición de parámetros reflejada en calculadora y dashboard, y el flujo completo en navegador (Chromium) en escritorio y móvil, sin errores de consola. En la Fase 2 se añadieron 61 verificaciones de API (lista priorizada, filtros y paginación, ficha, recálculo, alertas, permisos del docente por curso, encuesta con y sin consentimiento) y las pruebas de navegador de los nuevos módulos.


---

## 13. Capturas

| Login | Calculadora |
|---|---|
| ![Login](docs/capturas/login.png) | ![Calculadora](docs/capturas/calculadora.png) |

| Parámetros (Admin) | Móvil |
|---|---|
| ![Parámetros](docs/capturas/parametros.png) | ![Móvil](docs/capturas/movil.png) |

| Alerta temprana (Bienestar) | Ficha del estudiante |
|---|---|
| ![Alerta temprana](docs/capturas/alerta-temprana.png) | ![Ficha](docs/capturas/ficha-estudiante.png) |

| Panel docente | Encuesta de autoevaluación |
|---|---|
| ![Panel docente](docs/capturas/panel-docente.png) | ![Encuesta](docs/capturas/encuesta.png) |

## 14. Colores institucionales

Definidos en `tailwind.config.ts` (`ucc.azul`, `ucc.azul-oscuro`, `ucc.verde`...) y `app/globals.css`. Ajústalos con el manual de identidad visual oficial de la UCC si los tonos difieren.

## 15. Fuentes de referencia

- Ministerio de Educación Nacional — SPADIES (deserción anual 2023: 8,97 % total y 7,82 % universitaria; deserción por cohorte 2016-1: 9,7 % en el semestre 1, 25,5 % en el 5 y 36,7 % en el 10).
- Observatorio Laboral para la Educación (MEN) — salarios de enganche de recién graduados.
- Decretos 1469 y 1470 de 2025 — SMMLV 2026 ($1.750.905) y auxilio de transporte.
- Ley 1581 de 2012 — Protección de datos personales.

Las participaciones nacionales por categoría de causa vienen como **valores ilustrativos** y deben reemplazarse con la distribución oficial antes de usarse como referencia.
