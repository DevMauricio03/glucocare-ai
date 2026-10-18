// app_cliente.js: Logica hibrida Cliente-Servidor y GitHub Pages Autonomo

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-diabetes");
  const btnAnalizar = document.getElementById("btn-analizar");
  const tarjetaDiag = document.getElementById("tarjeta-diagnostico");
  const badgeAlerta = document.getElementById("badge-alerta");
  const textoPorcentaje = document.getElementById("medidor-porcentaje");
  const arcoProgreso = document.getElementById("medidor-progreso");
  const tituloDiag = document.getElementById("titulo-diagnostico");
  const descDiag = document.getElementById("desc-diagnostico");
  const listaFactores = document.getElementById("factores-lista");
  const horaActualEl = document.getElementById("hora-actual");
  const etiquetaConexion = document.getElementById("texto-conexion");

  // Detectar si estamos en GitHub Pages
  const esGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";
  if (esGitHubPages && etiquetaConexion) {
    etiquetaConexion.textContent = "Motor ML en Celular";
  }

  // Reloj de la barra de estado movil
  function actualizarReloj() {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, "0");
    const minutos = String(ahora.getMinutes()).padStart(2, "0");
    if (horaActualEl) horaActualEl.textContent = `${horas}:${minutos}`;
  }
  actualizarReloj();
  setInterval(actualizarReloj, 30000);

  // Perfiles de pacientes precargados
  const perfiles = {
    sano: {
      embarazos: 1, glucosa: 85, presion_arterial: 66,
      grosor_piel: 23, insulina: 94, imc: 22.4,
      pedigri_diabetes: 0.167, edad: 24
    },
    moderado: {
      embarazos: 3, glucosa: 135, presion_arterial: 76,
      grosor_piel: 28, insulina: 110, imc: 29.8,
      pedigri_diabetes: 0.450, edad: 42
    },
    critico: {
      embarazos: 6, glucosa: 178, presion_arterial: 88,
      grosor_piel: 38, insulina: 220, imc: 36.5,
      pedigri_diabetes: 0.850, edad: 54
    }
  };

  // Botones Chips de seleccion rapida
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tipo = btn.dataset.perfil;
      const datos = perfiles[tipo];
      if (datos) {
        for (const [campo, valor] of Object.entries(datos)) {
          const input = document.getElementById(campo);
          if (input) input.value = valor;
        }
        enviarPeticionDiagnostico();
      }
    });
  });

  // Envio manual
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    enviarPeticionDiagnostico();
  });

  async function enviarPeticionDiagnostico() {
    const campos = [
      "embarazos", "glucosa", "presion_arterial", "grosor_piel",
      "insulina", "imc", "pedigri_diabetes", "edad"
    ];

    const payload = {};
    for (const c of campos) {
      const el = document.getElementById(c);
      if (!el || el.value.trim() === "") {
        alert("Por favor completa todos los biomarcadores.");
        el?.focus();
        return;
      }
      payload[c] = parseFloat(el.value);
    }

    btnAnalizar.disabled = true;
    btnAnalizar.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
      Evaluando Paciente...
    `;

    let resultado = null;

    // Si estamos en un servidor con backend disponible, intentar fetch
    if (!esGitHubPages) {
      try {
        const respuesta = await fetch("/api/predecir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (respuesta.ok) {
          resultado = await respuesta.json();
        }
      } catch (err) {
        console.warn("Servidor backend no disponible, activando motor ML local del cliente:", err);
      }
    }

    // Fallback automatico: Si estamos en GitHub Pages o el servidor no respondio,
    // usamos la inferencia del modelo exportado en JavaScript
    if (!resultado && typeof predecirDiabetesEnNavegador === "function") {
      resultado = predecirDiabetesEnNavegador(payload);
      if (etiquetaConexion) etiquetaConexion.textContent = "Motor ML Local";
    }

    if (resultado && resultado.exito) {
      actualizarInterfazResultado(resultado);
      tarjetaDiag.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      alert("No se pudo procesar la predicción clínica.");
    }

    btnAnalizar.disabled = false;
    btnAnalizar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
      Analizar Paciente en Servidor
    `;
  }

  function actualizarInterfazResultado(data) {
    const prob = data.probabilidad_diabetes;
    const color = data.color_alerta;

    tarjetaDiag.className = `tarjeta-diagnostico estado-${color}`;
    badgeAlerta.className = `badge-alerta ${color}`;
    badgeAlerta.textContent = `Riesgo ${data.nivel_riesgo}`;

    const perimetro = 226;
    const offset = perimetro - (perimetro * (prob / 100));
    arcoProgreso.style.strokeDashoffset = offset;
    
    if (color === "verde") arcoProgreso.style.stroke = "#16a34a";
    else if (color === "ambar") arcoProgreso.style.stroke = "#d97706";
    else arcoProgreso.style.stroke = "#dc2626";

    textoPorcentaje.textContent = `${Math.round(prob)}%`;
    tituloDiag.textContent = data.diagnostico;
    descDiag.textContent = data.recomendacion;

    listaFactores.innerHTML = "";
    if (data.factores_identificados && data.factores_identificados.length > 0) {
      data.factores_identificados.forEach(f => {
        const item = document.createElement("div");
        item.className = "factor-item";
        item.innerHTML = `<span>⚠️</span> <span>${f}</span>`;
        listaFactores.appendChild(item);
      });
      listaFactores.style.display = "flex";
    } else {
      listaFactores.style.display = "none";
    }
  }

  // Pestañas inferiores
  document.querySelectorAll(".nav-item").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("activo"));
      tab.classList.add("activo");
      const accion = tab.dataset.tab;
      if (accion === "stats") {
        consultarEstadisticas();
      } else if (accion === "inicio") {
        document.querySelector(".contenido-scroll").scrollTo({ top: 0, behavior: "smooth" });
      } else if (accion === "info") {
        alert("GlucoCare AI v1.0\nCompatible con GitHub Pages y Servidor Flask.\nModelo entrenado con Pima Indians Diabetes Dataset.");
      }
    });
  });

  async function consultarEstadisticas() {
    try {
      const res = await fetch("/api/estadisticas");
      if (res.ok) {
        const data = await res.json();
        alert(
          `📊 Estadísticas en MongoDB (${data.base_datos}):\n\n` +
          `• Total historias clínicas: ${data.total_registros}\n` +
          `• Casos Diabéticos: ${data.casos_diabeticos}\n` +
          `• Casos No Diabéticos: ${data.casos_no_diabeticos}\n` +
          `• Prevalencia: ${data.prevalencia}%`
        );
        return;
      }
    } catch (e) {}
    alert("📊 Estadísticas del Dataset Clínico:\n\n• 768 Pacientes evaluados\n• 268 Diabéticos (34.9%)\n• 500 No Diabéticos (65.1%)\n• Exactitud del modelo: 77%");
  }
});
