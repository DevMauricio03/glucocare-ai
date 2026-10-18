from pymongo import MongoClient
import pandas as pd

HOST = "localhost"
PUERTO = 27017
BASE_DATOS = "diabetes_db"
COLECCION = "pacientes"


def obtener_conexion():
    """Retorna la coleccion de MongoDB para interactuar con los datos."""
    cliente = MongoClient(f"mongodb://{HOST}:{PUERTO}/")
    return cliente[BASE_DATOS][COLECCION]


def cargar_datos():
    """Obtiene todos los registros de la coleccion en formato DataFrame."""
    conexion = obtener_conexion()
    documentos = list(conexion.find({}, {"_id": 0}))
    return pd.DataFrame(documentos)


if __name__ == "__main__":
    try:
        col = obtener_conexion()
        total = col.count_documents({})
        print("CONEXION EXITOSA A MONGODB (diabetes_db.pacientes)")
        print(f"Total de registros actuales: {total}")
    except Exception as e:
        print(f"Error de conexion a MongoDB: {e}")
