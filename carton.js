import {
  carta, MODOS, cartonDesdeCodigo, normalizarCodigo, generarCodigo, mejorPatron, modoValido,
} from './js/loteria.js';
import { conectar, accion, hayServidor, leerPref, guardarPref, $, el } from './js/cliente.js';

// Dos modos en la misma página:
//  - conectado: la sirve el servidor local; ve las cartas que salen y guarda las marcas allá.
//  - suelto: subida a un hosting público; cada quien marca a mano y se guarda en su navegador.

const params = new URLSearchParams(location.search);
const esObs = params.has('obs');
document.body.classList.toggle('obs', esObs);

let conectado = false;
let estado = null;          // instantánea del servidor (solo conectado)
let usuario = null;         // ?usuario= (solo conectado)
let codigo = null;
let cartas16 = [];
let casillas = [];
let marcasLocales = new Set();
let modoLocal = modoValido(leerPref('loteria:modo', 'lleno'));
let ultimoEvento = null;
let mensajeGrito = null;    // respuesta del servidor al botón "Gritar", para que no la pise el siguiente repintado

// ---------------------------------------------------------------- guardado local (modo suelto)
const claveMarcas = (c) => `loteria:marcas:${c}`;

function cargarMarcasLocales(c) {
  try {
    const arr = JSON.parse(leerPref(claveMarcas(c), '[]'));
    return new Set(Array.isArray(arr) ? arr.filter((i) => Number.isInteger(i) && i >= 0 && i < 16) : []);
  } catch {
    return new Set();
  }
}
const guardarMarcasLocales = () => guardarPref(claveMarcas(codigo), JSON.stringify([...marcasLocales]));

function codigosPractica() {
  try { return new Set(JSON.parse(leerPref('loteria:practica', '[]'))); } catch { return new Set(); }
}
function anotarPractica(c) {
  const s = codigosPractica();
  s.add(c);
  guardarPref('loteria:practica', JSON.stringify([...s].slice(-30)));
}

// ---------------------------------------------------------------- navegación
function mostrarBienvenida(mensaje, error) {
  codigo = null;
  $('#btn-darme')?.remove();
  document.title = 'Lotería · Mi cartón';
  $('#juego').hidden = true;
  $('#bienvenida').hidden = false;
  $('#chip-codigo').hidden = true;
  $('#quien').hidden = true;
  $('#form-usuario').hidden = !conectado;
  $('#texto-bienvenida').textContent = mensaje ?? (conectado
    ? 'Abre el cartón de alguien por su usuario de Twitch, o uno por código.'
    : 'Escribe el código de tu cartón para jugar junto con el stream.');
  $('#form-codigo').hidden = false;
  const e = $('#error-bienvenida');
  e.hidden = !error;
  e.textContent = error ?? '';
  pintarModoChip();
}

function pintarModoChip() {
  // Sin servidor, el modo es un ajuste del cartón abierto; en la bienvenida no dice nada.
  const modo = conectado ? estado?.modo : codigo && modoLocal;
  $('#chip-modo').hidden = !modo;
  if (modo) $('#chip-modo').textContent = MODOS[modo].nombre;
}

function ponerUrl() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  if (conectado) {
    if (usuario) {
      u.searchParams.set('usuario', usuario);
      if (params.get('plataforma')) u.searchParams.set('plataforma', params.get('plataforma'));
    } else if (codigo) {
      u.searchParams.set('codigo', codigo);
    }
    if (esObs) u.searchParams.set('obs', '');
  } else if (codigo) {
    u.hash = codigo;
  }
  history.replaceState(null, '', u.toString().replace(/obs=(&|$)/, 'obs$1'));
}

function abrirCodigo(c) {
  const limpio = normalizarCodigo(c);
  if (!limpio) {
    mostrarBienvenida(null, 'Ese código no existe. Son 6 letras y números, como K7M2QX.');
    return;
  }
  if (limpio !== codigo) {
    codigo = limpio;
    cartas16 = cartonDesdeCodigo(codigo);
    marcasLocales = conectado ? new Set() : cargarMarcasLocales(codigo);
    construirCarton();
  }
  document.title = `Lotería · ${codigo}`;
  $('#bienvenida').hidden = true;
  $('#juego').hidden = false;
  ponerUrl();
  actualizar();
}

/** En modo conectado con ?usuario=, sigue al cartón de esa persona (por si pide uno nuevo). */
function seguirUsuario() {
  // El mismo nombre puede existir en Twitch y en YouTube: ?plataforma= decide, y si no, Twitch.
  const plat = params.get('plataforma') || 'twitch';
  const candidatos = estado.cartones.filter((c) => c.usuario.toLowerCase() === usuario.toLowerCase());
  const registro = candidatos.find((c) => (c.plataforma ?? 'twitch') === plat) ?? candidatos[0];
  if (registro) {
    usuario = registro.usuario;
    abrirCodigo(registro.codigo);
    return;
  }
  if (codigo === null && !$('#bienvenida').hidden && $('#btn-darme')) return; // ya se está ofreciendo
  mostrarBienvenida(`${usuario} todavía no tiene cartón.`);
  $('#form-codigo').hidden = true;
  $('#texto-bienvenida').after(el('button', {
    class: 'primario', id: 'btn-darme',
    onclick: async () => {
      const r = await accion('carton', { usuario });
      if (!r.ok) $('#texto-bienvenida').textContent = r.error ?? 'No se pudo.';
    },
  }, `Darle un cartón a ${usuario}`));
}

// ---------------------------------------------------------------- cartón
function giro(i) {
  let h = 7;
  for (const ch of codigo) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h + i * 2654435761) >>> 0) % 50 - 25;
}

function construirCarton() {
  casillas = cartas16.map((n, i) => {
    const c = carta(n);
    return el('button', {
      class: 'casilla',
      type: 'button',
      style: `--giro:${giro(i)}deg`,
      'aria-label': `${c.n}. ${c.nombre}`,
      'aria-pressed': 'false',
      title: c.nombre,
      onclick: () => alternar(i),
    }, el('img', { src: c.mini, alt: '', draggable: 'false' }));
  });
  $('#carton').replaceChildren(...casillas);
}

function marcasServidor() {
  return estado?.marcas?.[codigo] ?? { celdas: [], auto: false };
}

function alternar(i) {
  if (esObs || codigo === null) return;
  if (!conectado) {
    if (marcasLocales.has(i)) marcasLocales.delete(i); else marcasLocales.add(i);
    guardarMarcasLocales();
    actualizar();
    return;
  }
  const m = marcasServidor();
  const salio = estado.salidas.includes(cartas16[i]);
  if (m.auto && salio && !m.celdas.includes(i)) return; // la marca viene del auto-marcado
  const valor = !m.celdas.includes(i);
  // Se pinta de inmediato; el servidor confirma por SSE.
  estado.marcas[codigo] = { ...m, celdas: valor ? [...m.celdas, i] : m.celdas.filter((x) => x !== i) };
  actualizar();
  accion('marcar', { codigo, celda: i, valor });
}

function actualizar() {
  if (codigo === null) return;
  const modo = conectado ? estado.modo : modoLocal;
  const salidas = conectado ? new Set(estado.salidas) : null;
  const m = conectado ? marcasServidor() : null;
  const manual = conectado ? new Set(m.celdas) : marcasLocales;
  const auto = conectado && m.auto;

  const marcada = (i) => manual.has(i) || (auto && salidas.has(cartas16[i]));
  // Con servidor, una marca solo cuenta si la carta de verdad salió.
  const cuenta = (i) => marcada(i) && (!conectado || salidas.has(cartas16[i]));
  const r = mejorPatron(modo, cuenta);

  casillas.forEach((nodo, i) => {
    const salio = conectado && salidas.has(cartas16[i]);
    nodo.classList.toggle('marcada', marcada(i));
    nodo.classList.toggle('salio', salio);
    nodo.classList.toggle('erronea', conectado && manual.has(i) && !salio);
    nodo.classList.toggle('ganadora', r.completo && r.patron.celdas.includes(i));
    nodo.setAttribute('aria-pressed', marcada(i));
  });

  // aviso de lotería
  $('#gana').hidden = !r.completo;
  if (r.completo) {
    const puedeGritar = conectado && !!usuario && !esObs;
    $('#gana-texto').textContent = mensajeGrito ?? (puedeGritar
      ? `Completaste ${r.patron.frase}.`
      : `Completaste ${r.patron.frase}. ¡Grita !loteria en el chat!`);
    $('#btn-gritar').hidden = !puedeGritar;
  } else {
    mensajeGrito = null;
  }
  const n = r.faltan.length;
  $('#progreso').textContent = r.completo ? '' : `Te ${n === 1 ? 'falta 1' : `faltan ${n}`} para ${r.patron.frase}`;

  // cabecera
  $('#chip-codigo').hidden = false;
  $('#chip-codigo').textContent = codigo;
  $('#quien').hidden = !(conectado && usuario);
  $('#quien').textContent = usuario ?? '';
  pintarModoChip();

  // controles
  $('#control-modo').hidden = conectado;
  $('#control-auto').hidden = !conectado;
  $('#chk-auto').checked = !!auto;
  $('#btn-otro').hidden = conectado && !!usuario;
  const esPractica = conectado
    ? !estado.cartones.some((c) => c.codigo === codigo)
    : codigosPractica().has(codigo);
  $('#aviso-practica').hidden = !esPractica || esObs;

  // última carta
  if (conectado) {
    const ultima = estado.salidas.at(-1);
    $('#ultima').hidden = !ultima;
    if (ultima) {
      const c = carta(ultima);
      if ($('#ultima-img').getAttribute('src') !== c.mini) $('#ultima-img').src = c.mini;
      $('#ultima-nombre').textContent = c.nombre;
      $('#ultima-cuenta').textContent = estado.salidas.length;
    }
  }
}

// ---------------------------------------------------------------- controles
for (const [clave, m] of Object.entries(MODOS)) $('#sel-modo').append(el('option', { value: clave }, m.nombre));
$('#sel-modo').value = modoLocal;
$('#sel-modo').addEventListener('change', (ev) => {
  modoLocal = modoValido(ev.target.value);
  guardarPref('loteria:modo', modoLocal);
  actualizar();
});

$('#chk-auto').addEventListener('change', (ev) => {
  estado.marcas[codigo] = { ...marcasServidor(), auto: ev.target.checked };
  actualizar();
  accion('autoMarcar', { codigo, valor: ev.target.checked });
});

let borrarTimer = null;
$('#btn-borrar').addEventListener('click', (ev) => {
  const b = ev.currentTarget;
  if (!b.dataset.confirmar) {
    b.dataset.confirmar = '1';
    b.textContent = '¿Seguro? Toca otra vez';
    borrarTimer = setTimeout(() => { delete b.dataset.confirmar; b.textContent = 'Quitar frijolitos'; }, 3000);
    return;
  }
  clearTimeout(borrarTimer);
  delete b.dataset.confirmar;
  b.textContent = 'Quitar frijolitos';
  if (conectado) {
    estado.marcas[codigo] = { ...marcasServidor(), celdas: [] };
    accion('borrarMarcas', { codigo });
  } else {
    marcasLocales.clear();
    guardarMarcasLocales();
  }
  actualizar();
});

$('#btn-otro').addEventListener('click', () => {
  usuario = null;
  mostrarBienvenida();
  ponerUrl();
});

$('#btn-gritar').addEventListener('click', async () => {
  const r = await accion('reclamar', { usuario });
  const textos = {
    valido: '¡Lotería confirmada!',
    invalido: 'El servidor dice que todavía no: revisa tus frijolitos.',
    espera: 'Espera unos segundos antes de volver a gritar.',
    'ya-gano': 'Ya ganaste esta partida.',
  };
  mensajeGrito = textos[r.estado] ?? r.error ?? r.texto ?? null;
  $('#gana-texto').textContent = mensajeGrito ?? '';
});

$('#form-codigo').addEventListener('submit', (ev) => {
  ev.preventDefault();
  usuario = null;
  abrirCodigo($('#in-codigo').value);
});

$('#form-usuario').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const u = $('#in-usuario').value.trim().replace(/^@+/, '');
  if (!u) return;
  usuario = u;
  guardarPref('loteria:ultimoUsuario', u);
  seguirUsuario();
  ponerUrl();
});

$('#btn-practica').addEventListener('click', () => {
  usuario = null;
  const c = generarCodigo();
  anotarPractica(c);
  abrirCodigo(c);
});

window.addEventListener('hashchange', () => {
  if (conectado) return;
  const c = location.hash.slice(1);
  if (c && normalizarCodigo(c) !== codigo) abrirCodigo(c);
});

// ---------------------------------------------------------------- arranque
estado = await hayServidor();
conectado = !!estado;
$('#in-usuario').value = leerPref('loteria:ultimoUsuario', '');

function resolverInicio() {
  if (conectado && params.get('usuario')) {
    usuario = params.get('usuario').trim().replace(/^@+/, '');
    seguirUsuario();
    return;
  }
  const c = params.get('codigo') || location.hash.slice(1);
  if (c) abrirCodigo(c);
  else mostrarBienvenida();
}
resolverInicio();

if (conectado) {
  conectar({
    alRecibir: (s) => {
      const ev = s.evento;
      const cartaNueva = ultimoEvento !== null && ev.id !== ultimoEvento && ev.tipo === 'carta';
      ultimoEvento = ev.id;
      estado = s;
      if (usuario) seguirUsuario(); else actualizar();
      pintarModoChip();
      if (cartaNueva) {
        const u = $('#ultima');
        u.classList.remove('nueva');
        void u.offsetWidth;
        u.classList.add('nueva');
      }
    },
  });
}
