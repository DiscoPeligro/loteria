import { carta, MODOS } from './js/loteria.js';
import { conectar, $, el } from './js/cliente.js';

// ---------------------------------------------------------------- opciones por URL
const params = new URLSearchParams(location.search);
const numero = (clave, porDefecto, min, max) => {
  const v = Number(params.get(clave));
  return params.has(clave) && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : porDefecto;
};
const OPC = {
  lado: params.get('lado') === 'izq' ? 'izq' : 'der',
  historial: Math.round(numero('historial', 5, 0, 12)),
  escala: numero('escala', 1, 0.3, 3),
  ocultarTras: numero('ocultarTras', 0, 0, 3600),
  verso: params.get('verso') !== '0',
  contador: params.get('contador') !== '0',
  loteria: params.get('loteria') !== '0',
};

const escena = $('#escena');
escena.classList.add(OPC.lado);
escena.classList.toggle('sin-verso', !OPC.verso);
document.documentElement.style.setProperty('--escala', OPC.escala);
$('.insignias').hidden = !OPC.contador;
$('#historial').hidden = OPC.historial === 0;

// ---------------------------------------------------------------- utilidades
const reiniciarAnimacion = (nodo, clase) => {
  nodo.classList.remove(clase);
  void nodo.offsetWidth;
  nodo.classList.add(clase);
};

/** Espera a que la imagen esté lista, para que el volteo no enseñe una carta en blanco. */
function precargar(src) {
  const img = new Image();
  img.src = src;
  const lista = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  return Promise.race([lista, new Promise((ok) => setTimeout(ok, 1500))]);
}

let ocultarTimer = null;
function programarOcultar() {
  clearTimeout(ocultarTimer);
  $('#grupo').classList.remove('oculto');
  if (OPC.ocultarTras > 0) ocultarTimer = setTimeout(() => $('#grupo').classList.add('oculto'), OPC.ocultarTras * 1000);
}

function toast(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.hidden = false;
  reiniciarAnimacion(t, 'toast');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4600);
}

// ---------------------------------------------------------------- pintar
let turno = 0; // si llegan dos cartas seguidas, la animación vieja se descarta

function pintarInsignias(s) {
  $('#modo').textContent = MODOS[s.modo].nombre;
  $('#cuenta').textContent = s.salidas.length;
}

function pintarHistorial(salidas, animarPrimera) {
  const previas = salidas.slice(0, -1).slice(-OPC.historial).reverse();
  $('#historial').replaceChildren(...previas.map((n, i) => el('div', {
    class: `mini${animarPrimera && i === 0 ? ' nueva' : ''}`,
    style: `--giro:${((n * 37) % 9) - 4}deg; opacity:${1 - i * (0.5 / Math.max(1, OPC.historial))}`,
    title: carta(n).nombre,
  }, el('img', { src: carta(n).mini, alt: '' }))));
}

function pintarLetrero(c) {
  $('#nombre').replaceChildren(el('small', {}, String(c.n)), c.nombre);
  $('#verso').textContent = `«${c.verso}»`;
}

async function mostrarCarta(s, animar) {
  const mio = ++turno;
  const n = s.salidas.at(-1);
  if (!n) {
    $('#grupo').hidden = true;
    return;
  }
  const c = carta(n);
  if (animar) await precargar(c.img);
  if (mio !== turno) return;

  $('#carta-img').src = c.img;
  pintarLetrero(c);
  pintarHistorial(s.salidas, animar);
  $('#grupo').hidden = false;
  if (animar) {
    reiniciarAnimacion($('#carta'), 'entra');
    reiniciarAnimacion($('#letrero'), 'entra');
  } else {
    $('#carta').classList.remove('entra', 'sale');
    $('#letrero').classList.remove('entra');
  }
  programarOcultar();
}

async function deshacer(s) {
  const mio = ++turno;
  reiniciarAnimacion($('#carta'), 'sale');
  await new Promise((ok) => setTimeout(ok, 450));
  if (mio !== turno) return;
  $('#carta').classList.remove('sale');
  mostrarCarta(s, false);
}

// ---------------------------------------------------------------- ¡Lotería!
const COLORES = ['#e4007c', '#ffb81c', '#00a36c', '#1f4e9e', '#ff5a36', '#ffffff'];
let loteriaTimer = null;

function gritarLoteria(reclamo) {
  if (!OPC.loteria) return;
  const caja = $('#loteria');
  $('#loteria-quien').textContent = reclamo.usuario;
  $('#loteria-detalle').textContent = `${reclamo.patron} · cartón ${reclamo.codigo}`;
  caja.classList.remove('sale');
  caja.hidden = false;
  reiniciarAnimacion($('.loteria-caja'), 'loteria-caja');

  const confeti = $('#confeti');
  confeti.replaceChildren(...Array.from({ length: 110 }, () => {
    const dur = 2.8 + Math.random() * 3;
    return el('i', {
      style: [
        `left:${Math.random() * 100}%`,
        `background:${COLORES[Math.floor(Math.random() * COLORES.length)]}`,
        `--dx:${Math.round((Math.random() - 0.5) * 400)}px`,
        `--rot:${Math.round(360 + Math.random() * 1080)}deg`,
        `animation-duration:${dur.toFixed(2)}s`,
        `animation-delay:${(Math.random() * 1.2).toFixed(2)}s`,
      ].join(';'),
    });
  }));

  clearTimeout(loteriaTimer);
  loteriaTimer = setTimeout(() => {
    caja.classList.add('sale');
    loteriaTimer = setTimeout(() => { caja.hidden = true; confeti.replaceChildren(); }, 520);
  }, 9000);
}

// ---------------------------------------------------------------- estado en vivo
let ultimoEvento = null;

conectar({
  alRecibir: (s) => {
    pintarInsignias(s);
    const ev = s.evento;

    // Primera vez (o reconexión tras reiniciar el servidor): se pinta tal cual, sin repetir animaciones.
    if (ultimoEvento === null || ev.id < ultimoEvento) {
      ultimoEvento = ev.id;
      mostrarCarta(s, false);
      return;
    }
    if (ev.id === ultimoEvento) return;
    ultimoEvento = ev.id;

    switch (ev.tipo) {
      case 'carta':
        mostrarCarta(s, true);
        break;
      case 'deshacer':
        deshacer(s);
        break;
      case 'partida':
        turno++;
        $('#grupo').hidden = true;
        toast(`¡Nueva partida! Se juega a ${MODOS[s.modo].nombre}`);
        break;
      case 'modo':
        toast(`Ahora se juega a ${MODOS[s.modo].nombre}`);
        break;
      case 'reclamo':
        if (ev.reclamo?.valido) gritarLoteria(ev.reclamo);
        break;
      default:
        break;
    }
  },
});
