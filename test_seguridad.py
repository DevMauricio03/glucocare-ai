"""
Suite de pruebas de seguridad y robustez clínica (Penetration & Stress Testing)
Evalua el sistema bajo 3 perfiles:
1. Usuario Real (Casos tipicos y errores honestos)
2. Usuario que busca Alterar / Trollear (Valores gigantes, negativos, fisicamente imposibles)
3. Usuario que busca Comprometer el Sistema (Inyecciones, NaN, Infinity, Tipos no numericos, DoS)
"""

import math
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from servidor import app

cliente = app.test_client()

PASADOS = 0
FALLADOS = 0


def registrar(titulo, condicion, detalle=""):
    global PASADOS, FALLADOS
    if condicion:
        print(f"  [OK] {titulo}")
        PASADOS += 1
    else:
        print(f"  [FALLO] {titulo} -> {detalle}")
        FALLADOS += 1


print("======================================================================")
print("     SUITE DE SEGURIDAD Y ROBUSTEZ: PROYECTO DIABETES (3 PERFILES)    ")
print("======================================================================")

# ---------------------------------------------------------------------
# PERFIL 1: USUARIO REAL
# ---------------------------------------------------------------------
print("\n--- [PERFIL 1: USUARIO REAL] ---")

# Caso 1.1: Paciente sano normal
p_sano = {
    "embarazos": 1,
    "glucosa": 85,
    "presion_arterial": 68,
    "grosor_piel": 22,
    "insulina": 94,
    "imc": 23.5,
    "pedigri_diabetes": 0.25,
    "edad": 28,
}
r1 = cliente.post("/api/predecir", json=p_sano)
registrar("1.1 Peticion de usuario sano procesada con éxito (HTTP 200)", r1.status_code == 200)
data1 = r1.get_json() or {}
registrar("1.2 Diagnostico y nivel de riesgo generado", data1.get("nivel_riesgo") in ["Bajo", "Moderado", "Alto"])

# Caso 1.2: Paciente con valores limite fisiologicos validos (borde superior normal)
p_borde = {
    "embarazos": 0,
    "glucosa": 199,
    "presion_arterial": 110,
    "grosor_piel": 50,
    "insulina": 300,
    "imc": 42.0,
    "pedigri_diabetes": 1.2,
    "edad": 75,
}
r2 = cliente.post("/api/predecir", json=p_borde)
registrar("1.3 Paciente en limites clinicos altos aceptado", r2.status_code == 200)

# Caso 1.4: Paciente masculino u omitiendo embarazos (campo opcional)
p_hombre = dict(p_sano, sexo="masculino")
del p_hombre["embarazos"]
r2_hombre = cliente.post("/api/predecir", json=p_hombre)
d_hombre = r2_hombre.get_json() or {}
registrar(
    "1.4 Paciente masculino u omitiendo embarazo procesado correctamente (embarazos=0)",
    r2_hombre.status_code == 200 and d_hombre.get("parametros_analizados", {}).get("embarazos") == 0
)

# ---------------------------------------------------------------------
# PERFIL 2: PERSONA QUE QUIERE ALTERAR / TROLLEAR DATOS
# ---------------------------------------------------------------------
print("\n--- [PERFIL 2: ALTERACIÓN DE DATOS / VALORES IMPOSIBLES] ---")

# Caso 2.1: Pliegue cutaneo de 1 millon o 10^30 (El caso de la captura del usuario)
p_millon = dict(p_sano, grosor_piel=1000000000000000000000000000000)
r3 = cliente.post("/api/predecir", json=p_millon)
registrar(
    "2.1 Rechazar pliegue cutaneo de 10^30 mm (HTTP 400/422)",
    r3.status_code in [400, 422],
    f"Status: {r3.status_code}, Resp: {r3.get_data(as_text=True)}",
)

# Caso 2.2: Valores negativos (edad negativa, glucosa negativa)
p_neg = dict(p_sano, edad=-5, glucosa=-80)
r4 = cliente.post("/api/predecir", json=p_neg)
registrar(
    "2.2 Rechazar edad y glucosa negativas",
    r4.status_code in [400, 422],
    f"Status: {r4.status_code}",
)

# Caso 2.3: Glucosa imposible (ej. 50,000 mg/dL)
p_gluc_absurda = dict(p_sano, glucosa=50000)
r5 = cliente.post("/api/predecir", json=p_gluc_absurda)
registrar(
    "2.3 Rechazar glucosa incompatible con la vida (>600 mg/dL)",
    r5.status_code in [400, 422],
    f"Status: {r5.status_code}",
)

# Caso 2.4: Edad de 500 años
p_matusalen = dict(p_sano, edad=500)
r6 = cliente.post("/api/predecir", json=p_matusalen)
registrar(
    "2.4 Rechazar edad humana imposible (>120 años)",
    r6.status_code in [400, 422],
    f"Status: {r6.status_code}",
)

# Caso 2.5: IMC de 800
p_imc_absurdo = dict(p_sano, imc=800)
r7 = cliente.post("/api/predecir", json=p_imc_absurdo)
registrar(
    "2.5 Rechazar IMC imposible (>90 kg/m²)",
    r7.status_code in [400, 422],
    f"Status: {r7.status_code}",
)

# Caso 2.6: Embarazos decimales o absurdos (ej. 80 embarazos)
p_emb = dict(p_sano, embarazos=80)
r8 = cliente.post("/api/predecir", json=p_emb)
registrar(
    "2.6 Rechazar cantidad absurda de embarazos (>25)",
    r8.status_code in [400, 422],
    f"Status: {r8.status_code}",
)

# ---------------------------------------------------------------------
# PERFIL 3: PERSONA QUE QUIERE COMPROMETER EL SISTEMA (ATAQUES / ADVERSARIO)
# ---------------------------------------------------------------------
print("\n--- [PERFIL 3: COMPROMISO DEL SISTEMA / VECTORES DE ATAQUE] ---")

# Caso 3.1: Envio de NaN o Infinity
p_nan = dict(p_sano, glucosa="NaN")
r9 = cliente.post("/api/predecir", json=p_nan)
registrar(
    "3.1 Rechazar NaN (Not a Number)",
    r9.status_code in [400, 422],
    f"Status: {r9.status_code}",
)

p_inf = dict(p_sano, glucosa="Infinity")
r10 = cliente.post("/api/predecir", json=p_inf)
registrar(
    "3.2 Rechazar Infinity",
    r10.status_code in [400, 422],
    f"Status: {r10.status_code}",
)

# Caso 3.3: Inyeccion de booleano disfrazado de numero (en Python isinstance(True, int) == True)
p_bool = dict(p_sano, embarazos=True)
r11 = cliente.post("/api/predecir", json=p_bool)
registrar(
    "3.3 Rechazar tipos booleanos disfrazados de enteros",
    r11.status_code in [400, 422],
    f"Status: {r11.status_code}",
)

# Caso 3.4: Inyeccion de objetos / diccionarios / NoSQL injection
p_nosql = dict(p_sano, glucosa={"$gt": 0})
r12 = cliente.post("/api/predecir", json=p_nosql)
registrar(
    "3.4 Rechazar payload con objetos anidados (NoSQL Injection)",
    r12.status_code in [400, 422],
    f"Status: {r12.status_code}",
)

# Caso 3.5: Inyeccion XSS en campos de texto / payload
p_xss = dict(p_sano, glucosa="<script>alert('hack')</script>")
r13 = cliente.post("/api/predecir", json=p_xss)
registrar(
    "3.5 Rechazar payloads con inyeccion de scripts XSS",
    r13.status_code in [400, 422],
    f"Status: {r13.status_code}",
)

# Caso 3.6: Mass Assignment (envio de campos extra maliciosos)
p_extra = dict(p_sano, role="admin", is_admin=True, __proto__="polluted")
r14 = cliente.post("/api/predecir", json=p_extra)
# Debe procesar limpiamente solo los campos permitidos o advertir
registrar(
    "3.6 Manejo seguro de Mass Assignment (no contamina estado)",
    r14.status_code in [200, 400],
    f"Status: {r14.status_code}",
)

# Caso 3.7: Envio de string vacia o tipos nulos
p_null = dict(p_sano, imc=None)
r15 = cliente.post("/api/predecir", json=p_null)
registrar(
    "3.7 Rechazar valores nulos (None/null)",
    r15.status_code in [400, 422],
    f"Status: {r15.status_code}",
)

print("\n======================================================================")
print(f"RESULTADO: {PASADOS} PASADOS, {FALLADOS} FALLADOS DE {PASADOS + FALLADOS} PRUEBAS")
print("======================================================================")
