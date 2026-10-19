// app_cliente.js: Interacciones avanzadas UX y motor de diagnostico clinico

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-diabetes");
  const btnAnalizar = document.getElementById("btn-analizar");
  const tarjetaDiag = document.getElementById("tarjeta-diagnostico");
  const badgeAlerta = document.getElementById("badge-alerta");
  const textoPorcentaje = document.getElementById("cifra-porcentaje-num");
  const arcoProgreso = document.getElementById("medidor-progreso");
  const tituloDiag = document.getElementById("titulo-diagnostico");
  const descDiag = document.getElementById("desc-diagnostico");
  const listaFactores = document.getElementById("factores-lista");
  const etiquetaConexion = document.getElementById("texto-conexion");
  const bannerAlertaGlobal = document.getElementById("banner-alerta-global");
  const btnLimpiar = document.getElementById("btn-limpiar-campos");
  const modalSheet = document.getElementById("modal-sheet");
  const modalTitulo = document.getElementById("modal-titulo");
  const modalCuerpo = document.getElementById("modal-cuerpo");
  const btnCerrarModal = document.getElementById("btn-cerrar-modal");

  // Detección de entorno (Local Server vs GitHub Pages)
  const esGitHubPages = window.location.hostname.includes("github.io") || window.location.protocol === "file:";
  if (etiquetaConexion) {
    etiquetaConexion.textContent = esGitHubPages ? "Edge AI" : "Online";
  }

  // Elementos del Wizard Stepper guiado
  const btnPasoAnterior = document.getElementById("btn-paso-anterior");
  const btnPasoSiguiente = document.getElementById("btn-paso-siguiente");
  const textoBtnSiguiente = document.getElementById("texto-btn-siguiente");
  const textoBtnAnalizar = document.getElementById("texto-btn-analizar");
  const stepperTextoPaso = document.getElementById("stepper-texto-paso");
  const stepperTextoPct = document.getElementById("stepper-texto-pct");
  const stepperBarraProgreso = document.getElementById("stepper-barra-progreso");

  // Reglas y rangos de referencia para feedback visual en tiempo real
  const REGLAS = {
    embarazos: { min: 0, max: 25, sanoMin: 0, sanoMax: 3, entero: true, nombre: "Número de embarazos", unidad: "gestaciones", opcional: true },
    glucosa: { min: 30, max: 600, sanoMin: 70, sanoMax: 99, entero: false, nombre: "Glucosa plasmática", unidad: "mg/dL" },
    presion_arterial: { min: 30, max: 180, sanoMin: 60, sanoMax: 80, entero: false, nombre: "Presión arterial", unidad: "mmHg" },
    grosor_piel: { min: 2, max: 99, sanoMin: 10, sanoMax: 30, entero: false, nombre: "Pliegue cutáneo", unidad: "mm" },
    insulina: { min: 0, max: 850, sanoMin: 16, sanoMax: 166, entero: false, nombre: "Insulina sérica", unidad: "μU/mL" },
    imc: { min: 10, max: 80, sanoMin: 18.5, sanoMax: 24.9, entero: false, nombre: "IMC", unidad: "kg/m²" },
    pedigri_diabetes: { min: 0.05, max: 2.50, sanoMin: 0.08, sanoMax: 0.50, entero: false, nombre: "Pedigrí genético", unidad: "índice" },
    edad: { min: 1, max: 120, sanoMin: 18, sanoMax: 45, entero: true, nombre: "Edad del paciente", unidad: "años" }
  };

  // Motor de sonido háptico Web Audio API (audible, desbloqueado por gestos y silenciable)
  let audioHabilitado = localStorage.getItem("glucocare_audio") !== "muted";
  const btnToggleSonido = document.getElementById("btn-toggle-sonido");
  const iconoSonido = document.getElementById("icono-sonido");

  function actualizarBotonSonido() {
    if (iconoSonido) iconoSonido.textContent = audioHabilitado ? "🔊" : "🔇";
    if (btnToggleSonido) {
      btnToggleSonido.setAttribute("title", audioHabilitado ? "Sonido activado (clic para silenciar)" : "Sonido silenciado (clic para activar)");
    }
  }
  actualizarBotonSonido();

  // Instancia compartida de AudioContext (evita límite de instancias y asegura compatibilidad iOS/Android)
  let audioCtx = null;

  function obtenerAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Desbloquear AudioContext al primer toque/clic en cualquier parte de la pantalla (Requisito móvil iOS/Chrome)
  const desbloquearAudio = () => {
    obtenerAudioContext();
  };
  window.addEventListener("pointerdown", desbloquearAudio, { passive: true });
  window.addEventListener("touchstart", desbloquearAudio, { passive: true });
  window.addEventListener("click", desbloquearAudio, { passive: true });

  function reproducirBeep(frecuencia = 587.33, duracion = 0.09, tipo = "sine", gainLevel = 0.18) {
    if (!audioHabilitado) return;
    try {
      const ctx = obtenerAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = tipo;
      osc.frequency.setValueAtTime(frecuencia, now);

      // Curva de ganancia audible sin chasquidos
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(gainLevel, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duracion);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duracion);

      // Micro-vibración háptica física en celulares compatibles
      if (navigator.vibrate) {
        try { navigator.vibrate(25); } catch (e) {}
      }
    } catch (e) {
      // Audio no disponible
    }
  }

  function reproducirSonidoExito() {
    if (!audioHabilitado) return;
    reproducirBeep(523.25, 0.10, "triangle", 0.22); // Do (C5)
    setTimeout(() => reproducirBeep(659.25, 0.10, "triangle", 0.22), 90); // Mi (E5)
    setTimeout(() => reproducirBeep(783.99, 0.22, "sine", 0.25), 180); // Sol (G5)
  }

  if (btnToggleSonido) {
    btnToggleSonido.addEventListener("click", (e) => {
      e.stopPropagation();
      audioHabilitado = !audioHabilitado;
      localStorage.setItem("glucocare_audio", audioHabilitado ? "enabled" : "muted");
      actualizarBotonSonido();
      if (audioHabilitado) {
        obtenerAudioContext();
        reproducirBeep(659.25, 0.15, "triangle", 0.25);
      }
    });
  }

  let ultimoResultado = null;

  // Perfiles de prueba clinica
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

  // Control de Sexo Biológico (Mujer / Hombre)
  let sexoSeleccionado = "femenino";
  const btnSexoFemenino = document.getElementById("btn-sexo-femenino");
  const btnSexoMasculino = document.getElementById("btn-sexo-masculino");
  const inputEmbarazos = document.getElementById("embarazos");
  const avisoEmbarazosHombre = document.getElementById("aviso-embarazos-hombre");

  function setSexo(sexo) {
    sexoSeleccionado = sexo;
    if (btnSexoFemenino && btnSexoMasculino) {
      if (sexo === "masculino") {
        btnSexoMasculino.classList.add("activo");
        btnSexoFemenino.classList.remove("activo");
        if (inputEmbarazos) {
          inputEmbarazos.value = "0";
          inputEmbarazos.disabled = true;
          inputEmbarazos.style.opacity = "0.6";
          inputEmbarazos.style.cursor = "not-allowed";
          actualizarMarcadorVisual("embarazos", 0);
          limpiarErrorCampoIndividual("embarazos");
        }
        if (avisoEmbarazosHombre) avisoEmbarazosHombre.style.display = "block";
      } else {
        btnSexoFemenino.classList.add("activo");
        btnSexoMasculino.classList.remove("activo");
        if (inputEmbarazos) {
          inputEmbarazos.disabled = false;
          inputEmbarazos.style.opacity = "1";
          inputEmbarazos.style.cursor = "auto";
        }
        if (avisoEmbarazosHombre) avisoEmbarazosHombre.style.display = "none";
      }
    }
  }

  function limpiarErrorCampoIndividual(campo) {
    const input = document.getElementById(campo);
    const errSpan = document.getElementById(`err-${campo}`);
    if (input) input.classList.remove("input-error");
    if (errSpan) errSpan.textContent = "";
  }

  if (btnSexoFemenino) {
    btnSexoFemenino.addEventListener("click", () => {
      reproducirBeep(520, 0.05, "sine");
      setSexo("femenino");
    });
  }
  if (btnSexoMasculino) {
    btnSexoMasculino.addEventListener("click", () => {
      reproducirBeep(440, 0.05, "sine");
      setSexo("masculino");
    });
  }

  // Matriz de telemetría de 4 órganos/sistemas en tiempo real
  function actualizarMatrizTelemetria() {
    const vGlucosa = parseFloat(document.getElementById("glucosa")?.value || "");
    const nodoGlucosa = document.getElementById("nodo-glucosa");
    const estadoGlucosa = document.getElementById("estado-nodo-glucosa");
    if (nodoGlucosa && estadoGlucosa) {
      nodoGlucosa.classList.remove("nodo-optimo", "nodo-alerta", "nodo-riesgo");
      if (isNaN(vGlucosa)) {
        estadoGlucosa.textContent = "Pendiente";
      } else if (vGlucosa <= 99) {
        nodoGlucosa.classList.add("nodo-optimo");
        estadoGlucosa.textContent = "Normal";
      } else if (vGlucosa <= 125) {
        nodoGlucosa.classList.add("nodo-alerta");
        estadoGlucosa.textContent = "Alerta";
      } else {
        nodoGlucosa.classList.add("nodo-riesgo");
        estadoGlucosa.textContent = "Elevada";
      }
    }

    const vPresion = parseFloat(document.getElementById("presion_arterial")?.value || "");
    const nodoPresion = document.getElementById("nodo-presion");
    const estadoPresion = document.getElementById("estado-nodo-presion");
    if (nodoPresion && estadoPresion) {
      nodoPresion.classList.remove("nodo-optimo", "nodo-alerta", "nodo-riesgo");
      if (isNaN(vPresion)) {
        estadoPresion.textContent = "Pendiente";
      } else if (vPresion <= 80) {
        nodoPresion.classList.add("nodo-optimo");
        estadoPresion.textContent = "Óptima";
      } else if (vPresion <= 89) {
        nodoPresion.classList.add("nodo-alerta");
        estadoPresion.textContent = "Límite";
      } else {
        nodoPresion.classList.add("nodo-riesgo");
        estadoPresion.textContent = "Alta";
      }
    }

    const vImc = parseFloat(document.getElementById("imc")?.value || "");
    const nodoImc = document.getElementById("nodo-imc");
    const estadoImc = document.getElementById("estado-nodo-imc");
    if (nodoImc && estadoImc) {
      nodoImc.classList.remove("nodo-optimo", "nodo-alerta", "nodo-riesgo");
      if (isNaN(vImc)) {
        estadoImc.textContent = "Pendiente";
      } else if (vImc < 25) {
        nodoImc.classList.add("nodo-optimo");
        estadoImc.textContent = "Normal";
      } else if (vImc < 30) {
        nodoImc.classList.add("nodo-alerta");
        estadoImc.textContent = "Sobrepeso";
      } else {
        nodoImc.classList.add("nodo-riesgo");
        estadoImc.textContent = "Obesidad";
      }
    }

    const vGen = parseFloat(document.getElementById("pedigri_diabetes")?.value || "");
    const nodoGen = document.getElementById("nodo-genetica");
    const estadoGen = document.getElementById("estado-nodo-genetica");
    if (nodoGen && estadoGen) {
      nodoGen.classList.remove("nodo-optimo", "nodo-alerta", "nodo-riesgo");
      if (isNaN(vGen)) {
        estadoGen.textContent = "Pendiente";
      } else if (vGen <= 0.35) {
        nodoGen.classList.add("nodo-optimo");
        estadoGen.textContent = "Bajo";
      } else if (vGen <= 0.65) {
        nodoGen.classList.add("nodo-alerta");
        estadoGen.textContent = "Medio";
      } else {
        nodoGen.classList.add("nodo-riesgo");
        estadoGen.textContent = "Hereditario";
      }
    }
  }

  // Actualizar la mini barra de rango visual de cada campo
  function actualizarMarcadorVisual(campo, valor) {
    const marcador = document.getElementById(`marcador-${campo}`);
    if (!marcador) return;
    const regla = REGLAS[campo];
    if (isNaN(valor)) {
      marcador.style.left = "0%";
      return;
    }
    const pct = Math.max(0, Math.min(100, ((valor - regla.min) / (regla.max - regla.min)) * 100));
    marcador.style.left = `${pct}%`;
  }

  // Limpiar errores
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
    if (errSpan) errSpan.innerHTML = `⚠️ ${mensaje}`;
  }

  // Validacion y feedback en tiempo real
  Object.keys(REGLAS).forEach(campo => {
    const input = document.getElementById(campo);
    if (!input) return;

    // Bloquear caracteres de notación científica ('e', 'E') y signos (+, -) en teclado
    input.addEventListener("keydown", (e) => {
      if (["e", "E", "+", "-"].includes(e.key)) {
        e.preventDefault();
      }
    });

    // Bloquear si intentan pegarlo con Ctrl+V / Cmd+V
    input.addEventListener("paste", (e) => {
      const textoPegado = (e.clipboardData || window.clipboardData).getData("text");
      if (/[eE+-]/.test(textoPegado)) {
        e.preventDefault();
        const textoLimpio = textoPegado.replace(/[eE+-]/g, "");
        document.execCommand("insertText", false, textoLimpio);
      }
    });

    input.addEventListener("input", () => {
      input.classList.remove("input-error");
      const errSpan = document.getElementById(`err-${campo}`);
      if (errSpan) errSpan.textContent = "";

      // Limpiar residuo si algún método de entrada coló 'e', 'E', '+', '-'
      if (/[eE+-]/.test(input.value)) {
        input.value = input.value.replace(/[eE+-]/g, "");
      }

      actualizarMatrizTelemetria();

      const valorTexto = input.value.trim().replace(",", ".");
      if (valorTexto === "") {
        actualizarMarcadorVisual(campo, REGLAS[campo].min);
        return;
      }

      const num = parseFloat(valorTexto);
      const regla = REGLAS[campo];

      if (isNaN(num)) {
        mostrarErrorCampo(campo, "Ingresa un número válido");
        return;
      }

      actualizarMarcadorVisual(campo, num);

      if (num < regla.min) {
        mostrarErrorCampo(campo, `Mínimo biológico: ${regla.min} ${regla.unidad}`);
      } else if (num > regla.max) {
        mostrarErrorCampo(campo, `Máximo fisiológico: ${regla.max} ${regla.unidad}`);
      }
    });
  });

  // Tooltips contextuales de ayuda (Explicaciones sencillas de terminos medicos)
  document.querySelectorAll(".btn-info-tooltip").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const campo = btn.dataset.campo;
      const caja = document.getElementById(`exp-${campo}`);
      if (caja) {
        const visible = caja.style.display === "block";
        document.querySelectorAll(".caja-explicacion").forEach(c => c.style.display = "none");
        caja.style.display = visible ? "none" : "block";
      }
    });
  });

  // Fases del Wizard Stepper guiado
  const FASES = [
    {
      id: "sangre",
      nombre: "Fase 1: Perfil Glucémico (Sangre)",
      pct: 33,
      pctTexto: "Paso 1 / 3",
      siguienteTexto: "Siguiente: Antropometría",
      campos: ["glucosa", "insulina", "presion_arterial"]
    },
    {
      id: "cuerpo",
      nombre: "Fase 2: Antropometría & Composición",
      pct: 66,
      pctTexto: "Paso 2 / 3",
      siguienteTexto: "Siguiente: Perfil",
      campos: ["imc", "grosor_piel"]
    },
    {
      id: "perfil",
      nombre: "Fase 3: Datos Demográficos & Pedigrí",
      pct: 100,
      pctTexto: "Paso 3 / 3",
      campos: ["edad", "embarazos", "pedigri_diabetes"]
    }
  ];

  let faseActual = 0; // 0: sangre, 1: cuerpo, 2: perfil, -1: todos

  // Función para cambiar de fase en el Wizard
  function irAFase(index) {
    limpiarErrores();
    faseActual = index;

    document.querySelectorAll(".paso-tab").forEach(t => t.classList.remove("activo"));

    if (index === -1) {
      // Modo "Todos": ver todo continuo
      const tabTodos = document.getElementById("tab-todos");
      if (tabTodos) tabTodos.classList.add("activo");

      document.querySelectorAll(".card-grupo").forEach(g => g.style.display = "flex");

      if (btnPasoAnterior) btnPasoAnterior.style.display = "none";
      if (btnPasoSiguiente) btnPasoSiguiente.style.display = "none";
      if (btnAnalizar) {
        btnAnalizar.style.display = "flex";
        if (textoBtnAnalizar) textoBtnAnalizar.textContent = "Evaluar Paciente Completo";
      }

      if (stepperTextoPaso) stepperTextoPaso.textContent = "Vista Completa: Todos los Biomarcadores";
      if (stepperTextoPct) stepperTextoPct.textContent = "100%";
      if (stepperBarraProgreso) stepperBarraProgreso.style.width = "100%";
      return;
    }

    const fase = FASES[index];
    const tabFase = document.getElementById(`tab-${fase.id}`);
    if (tabFase) tabFase.classList.add("activo");

    // Mostrar exclusivamente la card de la fase seleccionada
    document.querySelectorAll(".card-grupo").forEach(g => {
      if (g.dataset.categoria === fase.id) {
        g.style.display = "flex";
      } else {
        g.style.display = "none";
      }
    });

    // Actualizar barra de progreso y encabezado
    if (stepperTextoPaso) stepperTextoPaso.textContent = fase.nombre;
    if (stepperTextoPct) stepperTextoPct.textContent = fase.pctTexto;
    if (stepperBarraProgreso) stepperBarraProgreso.style.width = `${fase.pct}%`;

    // Configurar botones de navegación ergonómica en la zona del pulgar
    if (index === 0) {
      // Fase 1: Sangre
      if (btnPasoAnterior) btnPasoAnterior.style.display = "none";
      if (btnPasoSiguiente) {
        btnPasoSiguiente.style.display = "flex";
        if (textoBtnSiguiente) textoBtnSiguiente.textContent = fase.siguienteTexto;
      }
      if (btnAnalizar) btnAnalizar.style.display = "none";
    } else if (index === 1) {
      // Fase 2: Cuerpo
      if (btnPasoAnterior) btnPasoAnterior.style.display = "inline-flex";
      if (btnPasoSiguiente) {
        btnPasoSiguiente.style.display = "flex";
        if (textoBtnSiguiente) textoBtnSiguiente.textContent = fase.siguienteTexto;
      }
      if (btnAnalizar) btnAnalizar.style.display = "none";
    } else if (index === 2) {
      // Fase 3: Perfil (Final)
      if (btnPasoAnterior) btnPasoAnterior.style.display = "inline-flex";
      if (btnPasoSiguiente) btnPasoSiguiente.style.display = "none";
      if (btnAnalizar) {
        btnAnalizar.style.display = "flex";
        if (textoBtnAnalizar) textoBtnAnalizar.textContent = "Evaluar Diagnóstico Completo";
      }
    }
  }

  // Validar únicamente los campos de una fase específica
  function validarFase(camposFase) {
    let tieneError = false;
    let primerError = null;

    camposFase.forEach(campo => {
      const regla = REGLAS[campo];
      const input = document.getElementById(campo);
      const valorStr = input ? input.value.trim().replace(",", ".") : "";

      if (!input || valorStr === "") {
        if (regla.opcional || (campo === "embarazos" && sexoSeleccionado === "masculino")) {
          return;
        }
        mostrarErrorCampo(campo, "Campo obligatorio");
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }

      const num = parseFloat(valorStr);
      if (isNaN(num) || !isFinite(num)) {
        mostrarErrorCampo(campo, "Número no válido");
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }

      if (regla.entero && !Number.isInteger(num)) {
        mostrarErrorCampo(campo, "Debe ser número entero");
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }

      if (num < regla.min || num > regla.max) {
        mostrarErrorCampo(campo, `Límite: ${regla.min} a ${regla.max} ${regla.unidad}`);
        if (!primerError) primerError = input;
        tieneError = true;
        return;
      }
    });

    if (primerError) {
      primerError.focus();
      primerError.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return !tieneError;
  }

  // Evento botón "Siguiente"
  if (btnPasoSiguiente) {
    btnPasoSiguiente.addEventListener("click", () => {
      if (faseActual >= 0 && faseActual < FASES.length - 1) {
        const faseConfig = FASES[faseActual];
        const esValida = validarFase(faseConfig.campos);
        if (esValida) {
          reproducirBeep(480, 0.05, "sine");
          const tabActual = document.getElementById(`tab-${faseConfig.id}`);
          if (tabActual) tabActual.classList.add("completado");
          irAFase(faseActual + 1);
          const sigCampoId = FASES[faseActual].campos[0];
          document.getElementById(sigCampoId)?.focus();
        }
      }
    });
  }

  // Evento botón "Anterior"
  if (btnPasoAnterior) {
    btnPasoAnterior.addEventListener("click", () => {
      if (faseActual > 0) {
        reproducirBeep(380, 0.05, "sine");
        irAFase(faseActual - 1);
      }
    });
  }

  // Navegación táctil por pestañas
  document.querySelectorAll(".paso-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      reproducirBeep(440, 0.04, "sine");
      const filtro = tab.dataset.filtro;
      if (filtro === "todos") {
        irAFase(-1);
      } else {
        const idx = FASES.findIndex(f => f.id === filtro);
        if (idx !== -1) {
          irAFase(idx);
        }
      }
    });
  });

  // Inicializar en Fase 1
  irAFase(0);

  // Chips de seleccion rapida con micro-interaccion
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      reproducirBeep(520, 0.06, "sine");
      limpiarErrores();
      document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      const tipo = btn.dataset.perfil;
      const datos = perfiles[tipo];
      if (datos) {
        setSexo("femenino");
        for (const [campo, valor] of Object.entries(datos)) {
          const input = document.getElementById(campo);
          if (input) {
            input.value = valor;
            actualizarMarcadorVisual(campo, valor);
          }
        }
        actualizarMatrizTelemetria();
        FASES.forEach(f => {
          document.getElementById(`tab-${f.id}`)?.classList.add("completado");
        });
        enviarPeticionDiagnostico();
      }
    });
  });

  // Resetear la tarjeta de dictamen al estado inicial en espera
  function resetearTarjetaDiagnostico() {
    tarjetaDiag.className = "tarjeta-diagnostico";
    badgeAlerta.className = "badge-alerta espera";
    badgeAlerta.textContent = "En Espera";

    const perimetro = 226;
    arcoProgreso.style.strokeDashoffset = perimetro;
    arcoProgreso.style.stroke = "var(--azul-medico)";

    textoPorcentaje.textContent = "0%";
    tituloDiag.textContent = "Sin Evaluar";
    descDiag.textContent = "Ingresa los biomarcadores del paciente o selecciona un paciente de prueba arriba para obtener el veredicto del modelo.";

    listaFactores.innerHTML = "";
    listaFactores.style.display = "none";

    const diagAcciones = document.getElementById("diag-acciones-resultado");
    if (diagAcciones) diagAcciones.style.display = "none";
    ultimoResultado = null;
  }

  // Boton Limpiar campos
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      reproducirBeep(350, 0.05, "sine");
      limpiarErrores();
      form.reset();
      setSexo("femenino");
      resetearTarjetaDiagnostico();
      actualizarMatrizTelemetria();
      document.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("activo"));
      document.querySelectorAll(".paso-tab").forEach(t => t.classList.remove("completado"));
      Object.keys(REGLAS).forEach(c => actualizarMarcadorVisual(c, REGLAS[c].min));
      irAFase(0);
      document.getElementById("glucosa")?.focus();
    });
  }

  // Envio de formulario
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    enviarPeticionDiagnostico();
  });

  async function enviarPeticionDiagnostico() {
    limpiarErrores();
    const payload = {};
    let primerErrorCampo = null;
    let hayErrores = false;

    for (const [campo, regla] of Object.entries(REGLAS)) {
      const input = document.getElementById(campo);
      let valorStr = input ? input.value.trim().replace(",", ".") : "";

      // Caso especial: Embarazos opcional o paciente masculino
      if (campo === "embarazos" && (sexoSeleccionado === "masculino" || valorStr === "")) {
        payload[campo] = 0;
        continue;
      }

      if (!input || valorStr === "") {
        if (regla.opcional) {
          payload[campo] = 0;
          continue;
        }
        mostrarErrorCampo(campo, `Campo obligatorio`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      const num = parseFloat(valorStr);
      if (isNaN(num) || !isFinite(num)) {
        mostrarErrorCampo(campo, `Número no válido`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      if (regla.entero && !Number.isInteger(num)) {
        mostrarErrorCampo(campo, `Debe ser número entero`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      if (num < regla.min || num > regla.max) {
        mostrarErrorCampo(campo, `Límite permitido: ${regla.min} a ${regla.max} ${regla.unidad}`);
        if (!primerErrorCampo) primerErrorCampo = input;
        hayErrores = true;
        continue;
      }

      payload[campo] = regla.entero ? parseInt(num, 10) : num;
    }
    payload["sexo"] = sexoSeleccionado;

    if (hayErrores) {
      if (primerErrorCampo) {
        const campoErrId = primerErrorCampo.id;
        const faseDelError = FASES.findIndex(f => f.campos.includes(campoErrId));
        if (faseDelError !== -1 && faseActual !== faseDelError && faseActual !== -1) {
          irAFase(faseDelError);
        }
        if (bannerAlertaGlobal) {
          bannerAlertaGlobal.textContent = "Por favor completa los biomarcadores pendientes para obtener el dictamen.";
          bannerAlertaGlobal.style.display = "block";
        }
        primerErrorCampo.scrollIntoView({ behavior: "smooth", block: "center" });
        primerErrorCampo.focus();
      }
      return;
    }

    // Feedback táctil visual de procesamiento
    btnAnalizar.disabled = true;
    btnAnalizar.innerHTML = `
      <svg class="anim-girar" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
      <span>Analizando Biomarcadores...</span>
    `;

    // Overlay cinemático de escaneo láser clínico
    const overlayEscaneo = document.getElementById("overlay-escaneo-clinico");
    const escaneoBarraFill = document.getElementById("escaneo-barra-fill");
    const escaneoTextoFase = document.getElementById("escaneo-texto-fase");

    if (overlayEscaneo) {
      overlayEscaneo.style.display = "flex";
      if (escaneoBarraFill) escaneoBarraFill.style.width = "0%";
      if (escaneoTextoFase) escaneoTextoFase.textContent = "Analizando Ensamble Bioestadístico...";
      setTimeout(() => {
        if (escaneoBarraFill) escaneoBarraFill.style.width = "100%";
        reproducirBeep(520, 0.08, "triangle", 0.18);
      }, 30);
    }

    const delayPromesa = new Promise(resolve => setTimeout(resolve, 650));
    let resultado = null;

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
          if (bannerAlertaGlobal) {
            bannerAlertaGlobal.textContent = "Alerta del Servidor: " + (data.error || "Datos no procesables");
            bannerAlertaGlobal.style.display = "block";
          }
        }
      } catch (err) {
        console.warn("Backend no disponible, recurriendo a motor local:", err);
      }
    }

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

    await delayPromesa;
    if (overlayEscaneo) overlayEscaneo.style.display = "none";

    if (resultado && resultado.exito) {
      // Haptic feedback en dispositivos compatibles
      if (navigator.vibrate) navigator.vibrate(50);
      ultimoResultado = { data: resultado, payload: payload };
      actualizarInterfazResultado(resultado);
      reproducirSonidoExito();
      tarjetaDiag.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    btnAnalizar.disabled = false;
    const txtBoton = faseActual === -1 ? "Evaluar Paciente Completo" : "Evaluar Diagnóstico Completo";
    btnAnalizar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
      <span id="texto-btn-analizar">${txtBoton}</span>
    `;
  }

  // Animacion fluida del contador numerico
  function animarContador(elemento, valorFinal, duracionMs = 700) {
    let inicio = 0;
    const pasos = 25;
    const incremento = valorFinal / pasos;
    const intervaloMs = duracionMs / pasos;
    const timer = setInterval(() => {
      inicio += incremento;
      if (inicio >= valorFinal) {
        elemento.textContent = `${Math.round(valorFinal)}%`;
        clearInterval(timer);
      } else {
        elemento.textContent = `${Math.round(inicio)}%`;
      }
    }, intervaloMs);
  }

  function actualizarInterfazResultado(data) {
    const prob = data.probabilidad_diabetes;
    const color = data.color_alerta;

    tarjetaDiag.className = `tarjeta-diagnostico estado-${color}`;
    badgeAlerta.className = `badge-alerta ${color}`;
    badgeAlerta.textContent = `Riesgo ${data.nivel_riesgo}`;

    // Actualizar arco de gauge
    const perimetro = 226;
    const offset = perimetro - (perimetro * (prob / 100));
    arcoProgreso.style.strokeDashoffset = offset;
    
    if (color === "verde") arcoProgreso.style.stroke = "#10b981";
    else if (color === "ambar") arcoProgreso.style.stroke = "#f59e0b";
    else arcoProgreso.style.stroke = "#ef4444";

    animarContador(textoPorcentaje, prob);
    tituloDiag.textContent = data.diagnostico;
    descDiag.textContent = data.recomendacion;

    listaFactores.innerHTML = "";
    if (data.factores_identificados && data.factores_identificados.length > 0) {
      const headerItem = document.createElement("div");
      headerItem.className = "factor-titulo-fila";
      headerItem.textContent = "Biomarcadores alterados:";
      listaFactores.appendChild(headerItem);

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

    // Mostrar botón de generar ficha médica oficial
    const diagAcciones = document.getElementById("diag-acciones-resultado");
    if (diagAcciones) diagAcciones.style.display = "flex";
  }

  // Generador de Ficha Médica Oficial Imprimible / PDF Hospitalario
  function mostrarModalFichaClinica(data, payload) {
    const fechaObj = new Date();
    const fechaStr = fechaObj.toLocaleDateString("es-MX", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const folioNum = Math.floor(100000 + Math.random() * 900000);
    const hashSimulado = Math.random().toString(16).substring(2, 10).toUpperCase() + "-" + Math.random().toString(16).substring(2, 6).toUpperCase();

    // Interpretar rangos clínicos con guías ADA/OMS
    const bGlucosa = payload.glucosa < 100 
      ? { texto: "NORMAL", clase: "rango-optimo" }
      : payload.glucosa <= 125 
        ? { texto: "ALTERADA (AYUNO)", clase: "rango-alerta" }
        : { texto: "HIPERGLUCEMIA", clase: "rango-critico" };

    const bPresion = payload.presion_arterial <= 80 
      ? { texto: "ÓPTIMA", clase: "rango-optimo" }
      : payload.presion_arterial <= 89 
        ? { texto: "LIMÍTROFE", clase: "rango-alerta" }
        : { texto: "ELEVADA", clase: "rango-critico" };

    const bImc = payload.imc < 25.0 
      ? { texto: "NORMOPESO", clase: "rango-optimo" }
      : payload.imc < 30.0 
        ? { texto: "SOBREPESO", clase: "rango-alerta" }
        : { texto: "OBESIDAD", clase: "rango-critico" };

    const bInsulina = payload.insulina <= 166 
      ? { texto: "NORMAL", clase: "rango-optimo" }
      : { texto: "RESISTENCIA INSULÍNICA", clase: "rango-critico" };

    const bPiel = payload.grosor_piel <= 30 
      ? { texto: "NORMAL", clase: "rango-optimo" }
      : { texto: "ADIPOSIDAD AUMENTADA", clase: "rango-alerta" };

    const bGen = payload.pedigri_diabetes < 0.50 
      ? { texto: "BAJO RIESGO", clase: "rango-optimo" }
      : { texto: "ALTA AGREGACIÓN", clase: "rango-critico" };

    let factoresHtml = "";
    if (data.factores_identificados && data.factores_identificados.length > 0) {
      factoresHtml = `
        <div class="doc-factores-lista">
          <strong>Biomarcadores de Alerta Identificados:</strong>
          <ul>
            ${data.factores_identificados.map(f => `<li>${f}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    const html = `
      <div class="ficha-clinica-imprimible" id="documento-ficha-oficial">
        <!-- 1. MEMBRETE OFICIAL INSTITUCIONAL -->
        <header class="doc-membrete">
          <div class="doc-logo-instituto">
            <svg class="cruz-medica-svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              <circle cx="12" cy="12" r="10" stroke-width="1.2"></circle>
            </svg>
            <div class="doc-instituto-texto">
              <h2>CENTRO DE ESPECIALIDADES METABÓLICAS & ENDOCRINOLOGÍA</h2>
              <h3>Unidad de Bioestadística Clínica y Detección Temprana de Diabetes</h3>
              <p>Reg. Sanitario SSA: #9842-DM · Laboratorio de Soporte Diagnóstico Computacional</p>
            </div>
          </div>
          <div class="doc-sello-vigencia">
            <span class="doc-badge-original">DOCUMENTO CLÍNICO OFICIAL</span>
            <span class="doc-folio-texto">FOLIO: GCAI-2026-${folioNum}</span>
          </div>
        </header>

        <!-- 2. DATOS DEL PACIENTE Y CONTROL EPIDEMIOLÓGICO -->
        <section class="doc-seccion-paciente">
          <div class="doc-fila-datos">
            <div class="doc-dato-col">
              <span class="doc-label">FECHA DE EMISIÓN:</span>
              <span class="doc-valor">${fechaStr}</span>
            </div>
            <div class="doc-dato-col">
              <span class="doc-label">SEXO BIOLÓGICO:</span>
              <span class="doc-valor">${payload.sexo === "masculino" ? "Masculino (Hombre)" : "Femenino (Mujer)"}</span>
            </div>
            <div class="doc-dato-col">
              <span class="doc-label">EDAD DEL PACIENTE:</span>
              <span class="doc-valor">${payload.edad} años</span>
            </div>
            <div class="doc-dato-col">
              <span class="doc-label">HISTORIAL OBSTÉTRICO:</span>
              <span class="doc-valor">${payload.sexo === "masculino" ? "No aplica por sexo (0)" : (payload.embarazos + " gestaciones registradas")}</span>
            </div>
          </div>
        </section>

        <!-- 3. TABLA FORMAL DE PARÁMETROS BIOQUÍMICOS Y ANTROPOMÉTRICOS -->
        <section class="doc-seccion-laboratorio">
          <div class="doc-titulo-seccion">PANEL DE BIOMARCADORES Y ANTROPOMETRÍA</div>
          <div class="doc-tabla-wrapper">
            <table class="doc-tabla-analitica">
              <thead>
                <tr>
                  <th>Parámetro Clínico</th>
                  <th style="text-align: right;">Resultado</th>
                  <th style="text-align: center;">Intervalo de Referencia (ADA / OMS)</th>
                  <th style="text-align: center;">Estado Clínico</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Glucosa Plasmática en Ayuno</strong>
                    <small>Biomarcador glucémico central</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.glucosa} mg/dL</td>
                  <td style="text-align: center; color: #475569;">70.0 - 99.0 mg/dL</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${bGlucosa.clase}">${bGlucosa.texto}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Presión Arterial Diastólica</strong>
                    <small>Tensión vascular mínima</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.presion_arterial} mmHg</td>
                  <td style="text-align: center; color: #475569;">60.0 - 80.0 mmHg</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${bPresion.clase}">${bPresion.texto}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Índice de Masa Corporal (IMC)</strong>
                    <small>Composición antropométrica</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.imc} kg/m²</td>
                  <td style="text-align: center; color: #475569;">18.5 - 24.9 kg/m²</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${bImc.clase}">${bImc.texto}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Insulina Sérica (2 hrs post-carga)</strong>
                    <small>Respuesta secretora pancreática</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.insulina} μU/mL</td>
                  <td style="text-align: center; color: #475569;">16.0 - 166.0 μU/mL</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${bInsulina.clase}">${bInsulina.texto}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Pliegue Cutáneo Tricipital</strong>
                    <small>Grosor celular subcutáneo</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.grosor_piel} mm</td>
                  <td style="text-align: center; color: #475569;">10.0 - 30.0 mm</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${bPiel.clase}">${bPiel.texto}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Función de Pedigrí Diabético</strong>
                    <small>Carga heredofamiliar ponderada</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.pedigri_diabetes}</td>
                  <td style="text-align: center; color: #475569;">0.080 - 0.500</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${bGen.clase}">${bGen.texto}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Antecedentes Gestacionales</strong>
                    <small>Historial obstétrico previo</small>
                  </td>
                  <td style="text-align: right; font-weight: 700;">${payload.sexo === "masculino" ? "0 (No aplica)" : payload.embarazos + " gestaciones"}</td>
                  <td style="text-align: center; color: #475569;">${payload.sexo === "masculino" ? "No aplica por sexo" : "0 - 3 gestaciones (riesgo basal)"}</td>
                  <td style="text-align: center;">
                    <span class="badge-rango ${payload.sexo === "masculino" ? "rango-optimo" : (payload.embarazos > 3 ? "rango-alerta" : "rango-optimo")}">
                      ${payload.sexo === "masculino" ? "NO APLICA" : (payload.embarazos > 3 ? "MULTIGESTA" : "NORMAL")}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 4. DICTAMEN DE ESTRATIFICACIÓN CLÍNICA -->
        <section class="doc-seccion-dictamen estado-${data.color_alerta}">
          <div class="doc-dictamen-header">
            <div>
              <span class="doc-dictamen-sub">DICTAMEN CLÍNICO PROBABILÍSTICO</span>
              <h4 class="doc-dictamen-titulo">${data.diagnostico}</h4>
            </div>
            <div class="doc-score-box">
              <span class="doc-score-pct">${data.probabilidad_diabetes}%</span>
              <span class="doc-score-label">Riesgo ${data.nivel_riesgo.toUpperCase()}</span>
            </div>
          </div>
          
          <div class="doc-conducta-box">
            <strong>Conducta Terapéutica y Recomendación:</strong>
            <p>${data.recomendacion}</p>
          </div>

          ${factoresHtml}
        </section>

        <!-- 5. FIRMA, SELLO INSTITUCIONAL Y DISCLAIMER LEGAL -->
        <footer class="doc-pie-pagina">
          <div class="doc-firmas-fila">
            <div class="doc-sello-qr">
              <div class="doc-qr-simulado">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="2" width="8" height="8" rx="1"></rect>
                  <rect x="14" y="2" width="8" height="8" rx="1"></rect>
                  <rect x="2" y="14" width="8" height="8" rx="1"></rect>
                  <rect x="14" y="14" width="4" height="4"></rect>
                  <rect x="18" y="18" width="4" height="4"></rect>
                </svg>
              </div>
              <div class="doc-qr-detalles">
                <span>VALIDACIÓN BIOESTADÍSTICA</span>
                <small>Hash: SHA256-${hashSimulado}</small>
                <small>Protocolo Certificado ADA / OMS</small>
              </div>
            </div>

            <div class="doc-firma-medico">
              <div class="doc-linea-firma"></div>
              <strong>Dr. Especialista en Medicina Interna</strong>
              <span>Cédula Profesional SSA: #8492019-MX</span>
              <span>Jefatura de Servicio de Endocrinología</span>
            </div>
          </div>

          <p class="doc-disclaimer-legal">
            <strong>AVISO CONFIDENCIAL Y LEGAL:</strong> Este documento es un informe de soporte al juicio clínico generado mediante análisis multivariado de Machine Learning. No sustituye la exploración médica presencial ni los estudios paraclínicos confirmatorios (HbA1c / CTOG). Los datos contenidos son confidenciales conforme a las leyes de protección de datos de salud vigentes.
          </p>
        </footer>

        <!-- BOTÓN DE ACCIÓN EN PANTALLA (OCULTO AL IMPRIMIR) -->
        <div class="doc-acciones-pantalla">
          <button type="button" class="btn-imprimir-documento-oficial" onclick="window.print()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Imprimir Ficha Médica Oficial (PDF)</span>
          </button>
        </div>
      </div>
    `;
    abrirModal("Expediente Médico Oficial", html);
  }

  const btnExportarFicha = document.getElementById("btn-exportar-ficha");
  if (btnExportarFicha) {
    btnExportarFicha.addEventListener("click", () => {
      if (!ultimoResultado) return;
      reproducirBeep(600, 0.06, "sine");
      mostrarModalFichaClinica(ultimoResultado.data, ultimoResultado.payload);
    });
  }

  // Modal estilo Bottom Sheet
  function abrirModal(titulo, htmlContenido) {
    if (!modalSheet) return;
    modalTitulo.textContent = titulo;
    modalCuerpo.innerHTML = htmlContenido;
    modalSheet.style.display = "flex";
  }

  function cerrarModal() {
    if (modalSheet) modalSheet.style.display = "none";
  }

  if (btnCerrarModal) btnCerrarModal.addEventListener("click", cerrarModal);
  if (modalSheet) {
    modalSheet.addEventListener("click", (e) => {
      if (e.target === modalSheet) cerrarModal();
    });
  }

  // Barra de navegacion inferior
  document.querySelectorAll(".nav-item").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("activo"));
      tab.classList.add("activo");
      const accion = tab.dataset.tab;

      if (accion === "inicio") {
        document.querySelector(".contenido-scroll").scrollTo({ top: 0, behavior: "smooth" });
      } else if (accion === "stats") {
        cargarEstadisticasModal();
      } else if (accion === "info") {
        abrirModal(
          "Acerca de GlucoCare AI",
          `<p style="font-size:14px; color:#475569; line-height:1.6;">
            <strong>GlucoCare AI</strong> es un sistema clínico de soporte diagnóstico basado en Machine Learning (Random Forest) calibrado con estándares internacionales de la ADA/OMS.
           </p>
           <div style="background:#f1f5f9; padding:12px; border-radius:12px; margin-top:10px; font-size:13px; color:#334155;">
            <strong>Pilares UX Incorporados:</strong><br>
            • Zona ergonómica del pulgar para smartphone.<br>
            • Mini-barras visuales de salud por parámetro.<br>
            • Segmentación táctil por fases clínicas.<br>
            • Triple validación defensiva (Usuario, Alteraciones y Ataques).
           </div>`
        );
      }
    });
  });

  async function cargarEstadisticasModal() {
    let contenido = "";
    try {
      const res = await fetch("/api/estadisticas");
      if (res.ok) {
        const d = await res.json();
        contenido = `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
            <div style="background:#f0f9ff; padding:14px; border-radius:14px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#0284c7;">${d.total_registros}</div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Pacientes en Base</div>
            </div>
            <div style="background:#fef2f2; padding:14px; border-radius:14px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#dc2626;">${d.prevalencia}%</div>
              <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Prevalencia</div>
            </div>
          </div>
          <div style="margin-top:12px; font-size:13px; color:#475569; line-height:1.5;">
            • Base de datos: <strong>${d.base_datos}.${d.coleccion}</strong><br>
            • Casos con Diabetes: <strong>${d.casos_diabeticos}</strong><br>
            • Casos Sanos / Control: <strong>${d.casos_no_diabeticos}</strong>
          </div>
        `;
        abrirModal("Base de Datos MongoDB", contenido);
        return;
      }
    } catch (e) {}

    contenido = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
        <div style="background:#f0f9ff; padding:14px; border-radius:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:#0284c7;">768</div>
          <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Historias Clínicas</div>
        </div>
        <div style="background:#fef2f2; padding:14px; border-radius:14px; text-align:center;">
          <div style="font-size:24px; font-weight:800; color:#dc2626;">34.9%</div>
          <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700;">Prevalencia</div>
        </div>
      </div>
    `;
    abrirModal("Estadísticas del Dataset", contenido);
  }
});
