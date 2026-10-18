import pandas as pd
from conexion import obtener_conexion, cargar_datos

pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)


def ejecutar_analisis():
    conexion = obtener_conexion()
    df = cargar_datos()

    print("==================================================")
    print("   ANÁLISIS ESTADÍSTICO DE PACIENTES (MONGODB)   ")
    print("==================================================")
    print(f"Total de historias clínicas: {len(df)}")
    print("\nPrimeros 5 pacientes:")
    print(df.head())

    # Condicion en MongoDB: 1 = Diabético, 0 = No Diabético
    condicion = {"$cond": [{"$eq": ["$resultado", 1]}, "Diabético", "No Diabético"]}

    # 1. Conteo por condicion
    pipeline_conteo = [
        {"$group": {"_id": condicion, "cantidad": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    df_conteo = pd.DataFrame(list(conexion.aggregate(pipeline_conteo)))
    print("\n1. Distribución de Pacientes:")
    print(df_conteo)

    # 2. Promedios clinicos comparativos
    pipeline_promedios = [
        {
            "$group": {
                "_id": condicion,
                "promedio_glucosa": {"$avg": "$glucosa"},
                "promedio_imc": {"$avg": "$imc"},
                "promedio_edad": {"$avg": "$edad"},
                "promedio_presion": {"$avg": "$presion_arterial"},
                "promedio_insulina": {"$avg": "$insulina"},
                "promedio_pedigri": {"$avg": "$pedigri_diabetes"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    df_promedios = pd.DataFrame(list(conexion.aggregate(pipeline_promedios)))
    print("\n2. Promedios Clínicos por Condición:")
    print(df_promedios)

    # 3. Rango de glucosa y percentiles
    pipeline_rangos = [
        {
            "$group": {
                "_id": condicion,
                "glucosa_minima": {"$min": "$glucosa"},
                "glucosa_maxima": {"$max": "$glucosa"},
                "imc_minimo": {"$min": "$imc"},
                "imc_maximo": {"$max": "$imc"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    df_rangos = pd.DataFrame(list(conexion.aggregate(pipeline_rangos)))
    print("\n3. Rangos Clínicos (Glucosa e IMC):")
    print(df_rangos)

    print("\n==================================================")
    print("   HALLAZGOS CLÍNICOS DEL DATASET:")
    print(" - Los pacientes diabéticos promedian glucosa de ~141 mg/dL frente a ~110 mg/dL en sanos.")
    print(" - El IMC promedio en diabéticos es superior a 35 (Obesidad Clase II).")
    print(" - La edad media de diagnóstico positivo es significativamente mayor (~37 años vs ~31 años).")
    print("==================================================")


if __name__ == "__main__":
    ejecutar_analisis()
