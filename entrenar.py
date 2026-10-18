from pathlib import Path
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from conexion import cargar_datos

BASE_DIR = Path(__file__).resolve().parent

pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)

# 1. Cargar datos desde MongoDB
print("Cargando pacientes desde MongoDB...")
df = cargar_datos()

if df.empty:
    raise ValueError("La coleccion 'pacientes' en MongoDB esta vacia. Ejecuta volcar_datos.py primero.")

print("Primeros 5 registros:")
print(df.head())
print(f"\nTotal de registros: {len(df)}")
print(f"Pacientes Diabéticos (1): {(df['resultado'] == 1).sum()}")
print(f"Pacientes No Diabéticos (0): {(df['resultado'] == 0).sum()}")

# 2. Separar variables predictoras (X) y objetivo (y)
caracteristicas = [
    "embarazos",
    "glucosa",
    "presion_arterial",
    "grosor_piel",
    "insulina",
    "imc",
    "pedigri_diabetes",
    "edad",
]

X = df[caracteristicas]
y = df["resultado"]

# 3. Division en entrenamiento y prueba
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

print(f"\nConjunto de entrenamiento: {len(X_train)} pacientes")
print(f"Conjunto de prueba: {len(X_test)} pacientes")

# 4. Entrenar modelo evaluativo
modelo_evaluacion = RandomForestClassifier(
    n_estimators=120,
    max_depth=6,
    random_state=42,
    class_weight="balanced",
)
modelo_evaluacion.fit(X_train, y_train)

predicciones = modelo_evaluacion.predict(X_test)
exactitud = accuracy_score(y_test, predicciones)

print(f"\n=== METRICAS DEL MODELO ===")
print(f"Exactitud (Accuracy): {exactitud * 100:.2f}%")
print("\nMatriz de Confusión:")
print(confusion_matrix(y_test, predicciones))
print("\nReporte de Clasificación Clínica:")
print(
    classification_report(
        y_test, predicciones, target_names=["Sin Diabetes", "Con Diabetes"]
    )
)

# 5. Entrenar el modelo final de produccion con el dataset completo
print("\nENTRENANDO MODELO FINAL DE PRODUCCION...")
modelo_produccion = RandomForestClassifier(
    n_estimators=120,
    max_depth=6,
    random_state=42,
    class_weight="balanced",
)
modelo_produccion.fit(X, y)

# Guardar el artefacto serializado
ruta_modelo = BASE_DIR / "cerebro_diabetes.joblib"
joblib.dump(modelo_produccion, ruta_modelo)
print(f"MODELO GUARDADO EXITOSAMENTE EN: {ruta_modelo.name}")
