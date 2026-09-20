import { CARTAS, carta, MODOS } from './js/loteria.js';
import { conectar, accion, leerPref, guardarPref, $, el } from './js/cliente.js';

let estado = null;
let ultimoEventoVisto = null;

// ---------------------------------------------------------------- avisos
let avisoTimer = null;
function avisar(texto, mal = false) {
  $('.aviso')?.remove();
  clearTimeout(avisoTimer);
  const nodo = el('div', { class: `aviso${mal ? ' mal' : ''}`, role: 'status' }, texto);
  document.body.append(nodo);
  avisoTimer = setTimeout(() => nodo.remove(), 3500);
}

async function hacer(nombre, datos) {
  const r = await accion(nombre, datos);
  if (!r.ok && r.error) avisar(r.error, true);
  return r;
}

// ---------------------------------------------------------------- tablero fijo de 54
const celdas = new Map();
for (const c of CARTAS) {
  const nodo = el('div', { class: 'celda', title: `${c.n}. ${c.nombre}`, style: `background-image:url('${c.mini}')` },
    el('span', {}, String(c.n)));
  celdas.set(c.n, nodo);
  $('#tablero').append(nodo);
}

// ---------------------------------------------------------------- modos
for (const [clave, m] of Object.entries(MODOS)) {
  $('#modos').append(el('button', {
    class: 'modo', role: 'radio', 'aria-checked': 'false', dataset: { modo: clave },
    onclick: () => hacer('modo', { modo: clave }),
  }, m.nombre));
}

// ---------------------------------------------------------------- sacar / deshacer / barajar
let sacando = false;
async function sacar() {
  if (sacando) return;
  sacando = true;
  $('#btn-sacar').disabled = true;
  const r = await hacer('sacar');
  if (r.ok && !r.carta) avisar('Ya salieron las 54 cartas.');
  // Un respiro para que un doble clic no saque dos cartas.
  setTimeout(() => { sacando = false; pintarBotones(); }, 350);
}
$('#btn-sacar').addEventListener('click', sacar);
$('#btn-deshacer').addEventListener('click', () => hacer('deshacer'));

document.addEventListener('keydown', (ev) => {
  if (ev.code !== 'Space' || ev.repeat) return;
  if (ev.target.closest('input, textarea, select, [contenteditable]')) return;
  ev.preventDefault(); // también evita que la barra "presione" el botón que tenga el foco
  sacar();
});

let confirmarTimer = null;
$('#btn-barajar').addEventListener('click', async (ev) => {
  const b = ev.currentTarget;
  if (!b.classList.contains('confirmar')) {
    b.classList.add('confirmar');
    b.textContent = '¿Seguro? Toca otra vez para barajar';
    confirmarTimer = setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Nueva partida'; }, 3500);
    return;
  }
  clearTimeout(confirmarTimer);
  b.classList.remove('confirmar');
  b.textContent = 'Nueva partida';
  await hacer('barajar');
  avisar('Mazo barajado. ¡A jugar!');
});

// ---------------------------------------------------------------- auto
$('#btn-auto').addEventListener('click', () => {
  const activo = !estado?.auto?.activo;
  hacer('auto', { activo, segundos: Number($('#auto-seg').value) });
});
$('#auto-seg').addEventListener('change', (ev) => {
  const s = Math.max(5, Math.min(600, Math.round(Number(ev.target.value) || 8)));
  ev.target.value = s;
  // Si ya estaba corriendo, se reprograma con el nuevo intervalo.
  if (estado?.auto?.activo) hacer('auto', { activo: true, segundos: s });
});
setInterval(() => {
  const a = estado?.auto;
  $('#auto-cuenta').textContent = a?.activo && a.proxima
    ? `siguiente en ${Math.max(0, Math.ceil((a.proxima - Date.now()) / 1000))} s`
    : '';
}, 250);

// ---------------------------------------------------------------- chat
$('#chk-anunciar').addEventListener('change', (ev) => hacer('anunciar', { valor: ev.target.checked }));
for (const chk of document.querySelectorAll('#plataformas input')) {
  chk.addEventListener('change', () => hacer('anunciarEn', { plataforma: chk.dataset.plataforma, valor: chk.checked }));
}

const NOMBRE_PLAT = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick', trovo: 'Trovo' };
/** Etiqueta chiquita de plataforma; en Twitch no se pone para no llenar la lista de lo de siempre. */
function etiquetaPlat(plataforma) {
  if (!plataforma || plataforma === 'twitch') return null;
  return el('span', { class: `etiqueta-plat ${plataforma}` }, NOMBRE_PLAT[plataforma] ?? plataforma);
}
$('#chk-bot').addEventListener('change', (ev) => hacer('comoBot', { valor: ev.target.checked }));
$('#chk-voz').addEventListener('change', (ev) => hacer('accionActiva', { valor: ev.target.checked }));
$('#btn-probar-voz').addEventListener('click', async () => {
  const r = await hacer('probarVoz');
  if (r.ok) avisar(`Corrí la acción «${estado?.config?.accionAlSacar}». Si no se oye, revisa que exista con ese nombre exacto.`);
});
$('#btn-probar').addEventListener('click', async () => {
  const r = await hacer('probarChat');
  if (r.ok) avisar('Mensaje de prueba enviado al chat.');
});

// ---------------------------------------------------------------- pestañas
function cambiarVista(nombre) {
  guardarPref('loteria:vista', nombre);
  for (const tab of document.querySelectorAll('.tab')) {
    const activa = tab.dataset.vista === nombre;
    tab.classList.toggle('activa', activa);
    tab.setAttribute('aria-selected', activa);
  }
  for (const v of document.querySelectorAll('.vista')) v.hidden = v.id !== `vista-${nombre}`;
  if (nombre === 'reclamos') reclamosVistos = estado?.reclamos?.length ?? 0;
  pintarBadges();
}
for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => cambiarVista(tab.dataset.vista));
let reclamosVistos = 0;

// ---------------------------------------------------------------- reclamos y verificación manual
function mostrarResultado(texto, bien) {
  const r = $('#resultado-manual');
  r.hidden = false;
  r.className = `resultado ${bien ? 'bien' : 'mal'}`;
  r.textContent = texto;
}

const nombresFaltan = (nums) => nums.map((n) => carta(n).nombre).join(', ');

$('#form-reclamar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const usuario = $('#in-reclamar').value.trim();
  if (!usuario) return;
  const r = await hacer('reclamar', { usuario });
  if (!r.ok) return;
  const textos = {
    valido: `✔ ¡Lotería válida! ${r.usuario} completó ${r.frase} (cartón ${r.codigo}).`,
    invalido: `✘ ${r.usuario} todavía no: le falta ${nombresFaltan(r.faltan ?? [])}.`,
    'sin-carton': `${r.usuario} no tiene cartón asignado.`,
    'sin-cartas': 'Todavía no sale ninguna carta.',
    espera: `${r.usuario} ya reclamó hace unos segundos; espera un poco.`,
    'ya-gano': `${r.usuario} ya había ganado esta partida.`,
  };
  mostrarResultado(textos[r.estado] ?? r.estado, r.estado === 'valido');
  $('#in-reclamar').value = '';
});

$('#form-verificar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const codigo = $('#in-verificar').value.trim();
  if (!codigo) return;
  const r = await hacer('verificar', { codigo });
  if (!r.ok) return;
  mostrarResultado(r.gana
    ? `✔ El cartón ${r.codigo} ya completó ${r.patron.frase}.`
    : `✘ Al cartón ${r.codigo} le falta ${nombresFaltan(r.faltan)} para ${r.patron.frase}.`, r.gana);
});

// ---------------------------------------------------------------- cartones
$('#chk-avisar-carton').checked = leerPref('loteria:avisarCarton', '1') === '1';
$('#chk-avisar-carton').addEventListener('change', (ev) => guardarPref('loteria:avisarCarton', ev.target.checked ? '1' : '0'));

$('#form-carton').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const usuario = $('#in-carton').value.trim();
  if (!usuario) return;
  const r = await hacer('carton', { usuario, avisar: $('#chk-avisar-carton').checked });
  if (!r.ok) return;
  avisar(r.creado ? `Cartón ${r.codigo} para ${r.usuario}` : `${r.usuario} ya tenía el cartón ${r.codigo}`);
  $('#in-carton').value = '';
});

$('#in-mi-usuario').value = leerPref('loteria:miUsuario', '');
$('#in-mi-usuario').addEventListener('input', (ev) => {
  guardarPref('loteria:miUsuario', ev.target.value.trim());
  pintarEnlaces();
});

// ---------------------------------------------------------------- pintar
function pintarBotones() {
  const n = estado?.salidas?.length ?? 0;
  $('#btn-sacar').disabled = sacando || n >= 54;
  $('#btn-deshacer').disabled = n === 0;
}

function pintarBadges() {
  const cartones = estado?.cartones?.length ?? 0;
  $('#badge-cartones').textContent = cartones;
  const enReclamos = !$('#vista-reclamos').hidden;
  if (enReclamos) reclamosVistos = estado?.reclamos?.length ?? 0;
  const nuevos = (estado?.reclamos?.length ?? 0) - reclamosVistos;
  const b = $('#badge-reclamos');
  b.hidden = enReclamos || nuevos <= 0;
  b.textContent = nuevos;
  b.classList.toggle('alerta', (estado?.ganadores?.length ?? 0) > 0);
}

function pintarEnlaces() {
  const base = location.origin;
  $('#url-overlay').value = `${base}/overlay.html`;

  const yo = $('#in-mi-usuario').value.trim().replace(/^@+/, '');
  $('#url-carton').value = yo ? `${base}/carton.html?usuario=${encodeURIComponent(yo)}` : `${base}/carton.html`;
  $('#url-carton-obs').value = yo ? `${base}/carton.html?usuario=${encodeURIComponent(yo)}&obs` : '';
  $('#url-publico').value = estado?.config?.urlCartonPublico ?? '';
}

function pintar() {
  const s = estado;
  const n = s.salidas.length;
  const ultima = n ? carta(s.salidas[n - 1]) : null;

  // carta actual
  $('#cuenta').textContent = n;
  $('#actual-nombre').textContent = ultima ? `${ultima.n}. ${ultima.nombre}` : 'Sin cartas';
  $('#actual-verso').textContent = ultima ? ultima.verso : 'Saca la primera carta para empezar.';
  const img = $('#actual-img');
  img.hidden = !ultima;
  if (ultima && img.getAttribute('src') !== ultima.mini) img.src = ultima.mini;
  if (s.evento.tipo === 'carta' && ultimoEventoVisto !== null && s.evento.id !== ultimoEventoVisto) {
    const a = $('#actual');
    a.classList.remove('nueva');
    void a.offsetWidth; // reinicia la animación
    a.classList.add('nueva');
  }
  ultimoEventoVisto = s.evento.id;

  // tablero
  const salio = new Set(s.salidas);
  for (const [num, nodo] of celdas) {
    nodo.classList.toggle('salio', salio.has(num));
    nodo.classList.toggle('ultima', ultima?.n === num);
  }

  // modo
  $('#modo-actual').textContent = `· ${MODOS[s.modo].nombre}`;
  for (const b of document.querySelectorAll('.modo')) b.setAttribute('aria-checked', b.dataset.modo === s.modo);

  // auto
  $('#btn-auto').setAttribute('aria-pressed', s.auto.activo);
  $('#btn-auto').textContent = s.auto.activo ? '⏸ Auto' : '▶ Auto';
  if (document.activeElement !== $('#auto-seg')) $('#auto-seg').value = s.auto.segundos;

  // conexión con Streamer.bot
  const sb = $('#pill-sb');
  const sinPermiso = s.streamerbot.conectado && !!s.streamerbot.error;
  sb.classList.toggle('ok', s.streamerbot.conectado && !sinPermiso);
  sb.classList.toggle('aviso', sinPermiso);
  sb.textContent = sinPermiso ? 'SB sin permiso de chat' : s.streamerbot.conectado ? 'SB conectado' : 'SB desconectado';
  sb.title = s.streamerbot.error ?? `Streamer.bot ${s.streamerbot.version ?? ''} en ${s.streamerbot.url}`;
  $('#sb-error').hidden = !sinPermiso;
  $('#sb-error').textContent = s.streamerbot.error ?? '';
  $('#chk-anunciar').checked = !!s.config.anunciar;
  $('#plataformas').classList.toggle('apagado', !s.config.anunciar);
  for (const chk of document.querySelectorAll('#plataformas input')) {
    chk.checked = !!s.config.plataformas?.[chk.dataset.plataforma];
  }
  $('#chk-bot').checked = !!s.config.comoBot;
  $('#chk-voz').checked = !!s.config.accionActiva;
  $('#lbl-voz').title = s.config.accionAlSacar
    ? `Corre la acción «${s.config.accionAlSacar}» de Streamer.bot en cada carta`
    : 'Falta accionAlSacar en datos/config.json';
  $('#btn-probar-voz').disabled = !s.streamerbot.conectado || !s.config.accionAlSacar;
  $('#btn-probar').disabled = !s.streamerbot.conectado;

  pintarBotones();
  pintarGanadores();
  pintarReclamos();
  pintarCartones();
  pintarBadges();
  pintarEnlaces();
}

function pintarGanadores() {
  const g = estado.ganadores;
  $('#ganadores').replaceChildren(...g.map((r) => el('div', { class: 'ganador' },
    el('b', {}, etiquetaPlat(r.plataforma), `¡Lotería! ${r.usuario}`),
    el('div', { class: 'detalle' }, `${r.patron} · cartón `, el('span', { class: 'codigo' }, r.codigo), ` · con ${r.salidas} cartas`))));
}

function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function pintarReclamos() {
  const lista = $('#lista-reclamos');
  if (!estado.reclamos.length) {
    lista.replaceChildren(el('li', { class: 'vacio' }, 'Nadie ha gritado lotería todavía.'));
    return;
  }
  lista.replaceChildren(...estado.reclamos.map((r) => el('li', { class: r.valido ? 'valido' : '' },
    el('span', { class: 'icono' }, r.valido ? '✔' : '✘'),
    el('div', {},
      el('div', { class: 'quien' }, etiquetaPlat(r.plataforma), r.usuario),
      el('div', { class: 'detalle' }, r.valido
        ? `${r.patron} · ${hora(r.hora)}`
        : `Le falta: ${nombresFaltan(r.faltan)} · ${hora(r.hora)}`)),
    el('span', { class: 'codigo' }, r.codigo))));
}

function pintarCartones() {
  const lista = $('#lista-cartones');
  const cartones = [...estado.cartones].sort((a, b) => b.hora.localeCompare(a.hora));
  if (!cartones.length) {
    lista.replaceChildren(el('li', { class: 'vacio' }, 'Aún no hay cartones. Se reparten con !carton en el chat o aquí arriba.'));
    return;
  }
  lista.replaceChildren(...cartones.map((c) => el('li', {},
    el('span', { class: 'codigo' }, c.codigo),
    el('div', { class: 'quien' }, etiquetaPlat(c.plataforma), c.usuario),
    el('div', { class: 'acciones' },
      el('button', {
        class: 'chico', title: 'Abrir su cartón',
        onclick: () => window.open(`/carton.html?codigo=${encodeURIComponent(c.codigo)}`, '_blank'),
      }, 'Ver'),
      el('button', {
        class: 'chico', title: 'Quitarle el cartón',
        onclick: () => hacer('quitarCarton', { clave: c.clave }),
      }, '✕')))));
}

// ---------------------------------------------------------------- arranque
cambiarVista(leerPref('loteria:vista', 'reclamos'));
pintarEnlaces();

conectar({
  alRecibir: (s) => {
    const primera = estado === null;
    estado = s;
    if (primera) reclamosVistos = s.reclamos.length;
    pintar();
  },
  alCambiarEnlace: (ok) => {
    const p = $('#pill-enlace');
    p.classList.toggle('ok', ok);
    p.textContent = ok ? 'En línea' : 'Sin servidor';
  },
});
