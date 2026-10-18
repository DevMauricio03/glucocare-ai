import json
import sys
import requests

URL_SERVIDOR = "http://127.0.0.1:5002"
ENDPOINT_PREDECIR = f"{URL_SERVIDOR}/api/predecir"
ENDPOINT_ESTADISTICAS = f"{URL_SERVIDOR}/api/estadisticas"
ENDPOINT_MUESTRAS = f"{URL_SERVIDOR}/api/pacientes-muestra"


def verificar_servidor():
    """Comprueba que el servidor backend este activo."""
    try:
        r = requests.get(ENDPOINT_ESTADISTICAS, timeout=3)
        if r.status_code == 200:
            data = r.json()
            print(" Servidor en linea y conectado a MongoDB.")
            print(f"   Base de datos: {data.get('base_datos')} ({data.get('total_registros')} pacientes)")
            return True
        else:
            print(f" El servidor respondio con codigo {r.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(" Error: No se pudo conectar al servidor en " + URL_SERVIDOR)
        print("   Asegúrate de ejecutar primero: python servidor.py")
        return False


def enviar_peticion_diagnostico(paciente_datos):
    """Realiza la peticion HTTP POST al servidor con el payload JSON del paciente."""
    print("\n[CLIENTE] Enviando peticion HTTP POST a:", ENDPOINT_PREDECIR)
    print("[CLIENTE] Payload enviado:")
    print(json.dumps(paciente_datos, indent=2))

    try:
        respuesta = requests.post(
            ENDPOINT_PREDECIR,
            json=paciente_datos,
            headers={"Content-Type": "application/json"},
            timeout=5,
        )

        print(f"\n[SERVIDOR] Respuesta recibida (HTTP {respuesta.status_code}):")
        data = respuesta.json()

        if respuesta.status_code == 200 and data.get("exito"):
            print("==================================================")
            print(f" DIAGNÓSTICO: {data['diagnostico']}")
            print(f" NIVEL DE RIESGO: {data['nivel_riesgo'].upper()}")
            print(f" Probabilidad de Diabetes: {data['probabilidad_diabetes']}%")
            print(f" Probabilidad Sin Diabetes: {data['probabilidad_no_diabetes']}%")
            print("--------------------------------------------------")
            if data["factores_identificados"]:
                print(" Factores de Riesgo Clínico Detectados:")
                for f in data["factores_identificados"]:
                    print(f"   - {f}")
            else:
                print(" No se detectaron anomalias en los biomarcadores.")
            print(f"\n Recomendación:")
            print(f"   {data['recomendacion']}")
            print("==================================================")
            return data
        else:
            print(" Error devuelto por el servidor:", data.get("error"))
            return None

    except Exception as e:
        print(" Error al comunicarse con el servidor:", e)
        return None


def menu_interactivo():
    print("==================================================")
    print("   SISTEMA CLIENTE · DIAGNÓSTICO DE DIABETES     ")
    print("==================================================")

    if not verificar_servidor():
        sys.exit(1)

    # Obtener muestras del servidor
    r_muestras = requests.get(ENDPOINT_MUESTRAS).json()
    muestras = r_muestras.get("pacientes", {})

    while True:
        print("\nSelecciona una opción:")
        print("1. Enviar Paciente Sano de Control (Bajo Riesgo)")
        print("2. Enviar Paciente con Alerta (Riesgo Moderado)")
        print("3. Enviar Paciente Crítico (Alto Riesgo)")
        print("4. Ingresar datos manualmente")
        print("5. Salir")

        opcion = input("\nOpción (1-5): ").strip()

        if opcion == "1":
            enviar_peticion_diagnostico(muestras["sano"])
        elif opcion == "2":
            enviar_peticion_diagnostico(muestras["moderado"])
        elif opcion == "3":
            enviar_peticion_diagnostico(muestras["critico"])
        elif opcion == "4":
            try:
                print("\nIntroduce los valores clínicos del paciente:")
                p = {
                    "embarazos": float(input("Número de embarazos: ")),
                    "glucosa": float(input("Glucosa plasmática (mg/dL): ")),
                    "presion_arterial": float(input("Presión arterial diastólica (mmHg): ")),
                    "grosor_piel": float(input("Grosor pliegue cutáneo tríceps (mm): ")),
                    "insulina": float(input("Insulina sérica 2h (mu U/ml): ")),
                    "imc": float(input("Índice de masa corporal IMC (kg/m²): ")),
                    "pedigri_diabetes": float(input("Función de pedigrí genético (ej. 0.45): ")),
                    "edad": float(input("Edad en años: ")),
                }
                enviar_peticion_diagnostico(p)
            except ValueError:
                print("Entrada invalida. Debes ingresar valores numericos.")
        elif opcion == "5":
            print("Cerrando cliente. ¡Hasta pronto!")
            break
        else:
            print("Opcion no valida.")


if __name__ == "__main__":
    menu_interactivo()
