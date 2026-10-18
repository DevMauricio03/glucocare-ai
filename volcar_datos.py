import json
from pathlib import Path
import pandas as pd
from conexion import obtener_conexion

BASE_DIR = Path(__file__).resolve().parent
RUTA_CSV = BASE_DIR / "base de datos" / "diabetes.csv"

# Mapeo de columnas originales a nombres claros y en minusculas
MAPA_COLUMNAS = {
    "Pregnancies": "embarazos",
    "Glucose": "glucosa",
    "BloodPressure": "presion_arterial",
    "SkinThickness": "grosor_piel",
    "Insulin": "insulina",
    "BMI": "imc",
    "DiabetesPedigreeFunction": "pedigri_diabetes",
    "Age": "edad",
    "Outcome": "resultado",
}


def volcar_csv_a_mongodb():
    if not RUTA_CSV.exists():
        raise FileNotFoundError(f"No se encontro el archivo CSV en: {RUTA_CSV}")

    print(f"Leyendo dataset desde: {RUTA_CSV}")
    df = pd.read_csv(RUTA_CSV)

    # Renombrar columnas
    df = df.rename(columns=MAPA_COLUMNAS)

    # Insertar id secuencial al inicio
    df.insert(0, "id", range(1, len(df) + 1))

    print(f"Registros leidos del CSV: {len(df)}")
    print("Columnas procesadas:", list(df.columns))

    # Convertir a lista de diccionarios / documentos BSON
    documentos = json.loads(df.to_json(orient="records"))

    # Conectar y volcar a MongoDB
    conexion = obtener_conexion()
    conexion.delete_many({})  # Limpiar coleccion previa para no duplicar
    resultado = conexion.insert_many(documentos)

    print(f"DOCUMENTOS INSERTADOS EN MONGODB: {len(resultado.inserted_ids)}")
    print("VOLCADO COMPLETADO EN: base 'diabetes_db', coleccion 'pacientes'")


if __name__ == "__main__":
    volcar_csv_a_mongodb()
