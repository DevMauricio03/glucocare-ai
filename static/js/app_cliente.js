// app_cliente.js: Cliente móvil con validación clínica defensiva (3 perfiles)

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
  const bannerAlertaGlobal = document.getElementById("banner-alerta-global");

  // Reglas de validacion en cliente sincronizadas con el servidor
  const REGLAS = {
    embarazos: { min: 0, max: 25, entero: true, nombre: "Número de embarazos", unidad: "gestaciones" },
    glucosa: { min: 30, max: 600, entero: false, nombre: "Glucosa plasmática", unidad: "mg/dL" },
    presion_arterial: { min: 30, max: 180, entero: false, nombre: "Presión arterial", unidad: "mmHg" },
    grosor_piel: { min: 2, max: 99, entero: false, nombre: "Pliegue cutáneo", unidad: "mm" },
    insulina: { min: 0, max: 850, entero: false, nombre: "Insulina sérica", unidad: "μU/mL" },
    imc: { min: 10, max: 80, entero: false, nombre: "IMC", unidad: "kg/m²" },
    pedigri_diabetes: { min: 0.05, max: 2.50, entero: false, nombre: "Pedigrí genético", unidad: "índice" },
    edad: { min: 1, max: 120, entero: true, nombre: "Edad del paciente", unidad: "años" }
  };

  // Detectar si estamos en GitHub Pages o servidor local
  const esGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";
  if (esGitHubPages && etiquetaConexion) {
    etiquetaConexion.textContent = "Motor ML en Celular";
  }

  // Reloj simulador de smartphone
  function actualizarReloj() {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, "0");
    const minutos = String(ahora.getMinutes()).padStart(2, "0");
    if (horaActualEl) horaActualEl.textContent = `${horas}:${minutos}`;
  }
  actualizarReloj();
  setInterval(actualizarReloj, 30000);

  // Perfiles precargados seguros
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

  // Limpiar mensajes de error previos
  function limpiarErrores() {
    document.querySelectorAll(".error-msg-campo").forEach(el => el.textContent = "");
    document.querySelectorAll(".campo-input").forEach(el => el.classList.remove("input-error"));
    if (bannerAlertaGlobal) {
      bannerAlertaGlobal.style.display = "none";
      bannerAlertaGlobal.textContent = "";
    }
  }

  function mostrarErrorCampo(campo, mensaje) {
    const input = document.getElementById(campo);
    const errSpan = document.getElementById(`err-${campo}`);
    if (input) input.classList.add("input-error");
    if (errSpan) errSpan.textContent = `⚠️ ${mensaje}`;
  }

  // Validacion en tiempo real mientras el usuario escribe
  Object.keys(REGLAS).forEach(campo => {
    const input = document.getElementById(campo);
    if (!input) return;

    input.addEventListener("input", () => {
      // Limpiar error del campo
      input.classList.remove("input-error");
      const errSpan = document.getElementById(`err-${campo}`);
      if (errSpan) errSpan.textContent = "";

      const valorTexto = input.value.trim().replace(",", ".");
      if (valorTexto === "") return;

      const num = parseFloat(valorTexto);
      const regla = REGLAS[campo];

      if (isNaN(num)) {
        mostrarErrorCampo(campo, "Ingresa un número válido");
        return;
      }

      if (num < regla.min) {
        mostrarErrorCampo(campo, `Mínimo permitido: ${regla.min} ${regla.unidad}`);
      } else if (num > regla.max) {
        mostrarErrorCampo(campo, `Máximo permitido: ${regla.max} ${regla.unidad}`);
      }
    });
  });

  // Cargar chips de muestra rapida
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      limpiarErrores();
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

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    enviarPeticionDiagnostico();
  });

  async function enviarPeticionDiagnostico() {
    limpiarErrores();
    const payload = {};
    let primerErrorCampo = null;
    let hayErrores = false;

    // Validacion exhaustiva previa al envio (Defense in Depth en el Cliente)
    for (const [campo, regla] of Object.entries(REGLAS)) {
      const input = document.getElementById(campo);
      const valorStr = input ? input.value.trim().replace(",", ".") : "";

      if (!input || valorStr === "") {
        mostrarErrorCampo(campo, `Este campo es obligatorio`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      const num = parseFloat(valorStr);
      if (isNaN(num) || !isFinite(num)) {
        mostrarErrorCampo(campo, `Ingresa un valor numérico real`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      if (regla.entero && !Number.isInteger(num)) {
        mostrarErrorCampo(campo, `Debe ser un número entero`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      if (num < regla.min || num > regla.max) {
        mostrarErrorCampo(campo, `Rango clínico permitido: ${regla.min} a ${regla.max} ${regla.unidad}`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      payload[campo] = regla.entero ? parseInt(num, 10) : num;
    }

    if (hayErrores) {
      if (bannerAlertaGlobal) {
        bannerAlertaGlobal.textContent = "Revisa los campos señalados en rojo con valores fuera de límites médicos.";
        bannerAlertaGlobal.style.display = "block";
      }
      if (primerErrorCampo) {
        primerErrorCampo.scrollIntoView({ behavior: "smooth", block: "center" });
        primerErrorCampo.focus();
      }
      return;
    }

    // Feedback de carga
    btnAnalizar.disabled = true;
    btnAnalizar.innerHTML = `
      <svg class="anim-girar" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
      Evaluando Paciente...
    `;

    let resultado = null;

    // Modo 1: Si hay servidor Flask REST
    if (!esGitHubPages) {
      try {
        const respuesta = await fetch("/api/predecir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await respuesta.json();
        if (respuesta.ok && data.exito) {
          resultado = data;
        } else {
          // Si el servidor detecto alteracion maliciosa
          if (bannerAlertaGlobal) {
            bannerAlertaGlobal.textContent = "Alerta del Servidor: " + (data.error || "Datos rechazados por validación");
            bannerAlertaGlobal.style.display = "block";
          }
        }
      } catch (err) {
        console.warn("Servidor no accesible, recurriendo a motor local:", err);
      }
    }

    // Modo 2: GitHub Pages / Fallback offline
    if (!resultado && typeof predecirDiabetesEnNavegador === "function") {
      resultado = predecirDiabetesEnNavegador(payload);
      if (resultado && !resultado.exito) {
        if (bannerAlertaGlobal) {
          bannerAlertaGlobal.textContent = resultado.error;
          bannerAlertaGlobal.style.display = "block";
        }
        resultado = null;
      }
    }

    if (resultado && resultado.exito) {
      actualizarInterfazResultado(resultado);
      tarjetaDiag.scrollIntoView({ behavior: "smooth", block: "start" });
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
        alert("GlucoCare AI v1.0\nSistema clínico con triple validación defensiva (Usuario, Alteraciones y Seguridad de Servidor).");
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
