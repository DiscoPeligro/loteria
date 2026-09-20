// Módulo compartido: lo importan el servidor (Node) y las páginas (navegador).
// Nada de APIs exclusivas de un lado; `crypto.getRandomValues` existe en ambos.

const NOMBRES_Y_VERSOS = [
  ['El Gallo', 'El que le cantó a San Pedro no le volverá a cantar'],
  ['El Diablito', 'Pórtate bien, cuatito, si no te lleva el coloradito'],
  ['La Dama', 'Puliendo el paso, por toda la calle real'],
  ['El Catrín', 'Don Ferruco en la alameda, su bastón quería tirar'],
  ['El Paraguas', 'Para el sol y para el agua'],
  ['La Sirena', 'Con los cantos de sirena, no te vayas a marear'],
  ['La Escalera', 'Súbeme paso a pasito, no quieras pegar brinquitos'],
  ['La Botella', 'La herramienta del borracho'],
  ['El Barril', 'Tanto bebió el albañil, que quedó como barril'],
  ['El Árbol', 'El que a buen árbol se arrima, buena sombra le cobija'],
  ['El Melón', 'Me lo das o me lo quitas'],
  ['El Valiente', 'Por qué le corres, cobarde, trayendo tan buen puñal'],
  ['El Gorrito', 'Ponle su gorrito al nene, no se nos vaya a resfriar'],
  ['La Muerte', 'La muerte tilica y flaca'],
  ['La Pera', 'El que espera, desespera'],
  ['La Bandera', 'Verde, blanco y colorado, la bandera del soldado'],
  ['El Bandolón', 'Tocando su bandolón, está el mariachi Simón'],
  ['El Violoncello', 'Creciendo se fue hasta el cielo, y como no fue violín, tuvo que ser violoncello'],
  ['La Garza', 'Al otro lado del río tengo mi banco de arena, donde se sienta mi chata pico de garza morena'],
  ['El Pájaro', 'Tú me traes a puros brincos, como pájaro en la rama'],
  ['La Mano', 'La mano de un criminal'],
  ['La Bota', 'Una bota igual que la otra'],
  ['La Luna', 'El farol de los enamorados'],
  ['El Cotorro', 'Cotorro, cotorro, saca la pata y empiézame a platicar'],
  ['El Borracho', '¡Ah, qué borracho tan necio, ya no lo puedo aguantar!'],
  // La 26 (El Negrito en el mazo original) es la carta de la casa: La Cupido, el personaje
  // de DiscoPeligro, que la pidió la audiencia del stream. Verso nuevo, no tradicional.
  ['La Cupido', 'Alas de ángel y orejas de gato: te flecha el corazón en un rato'],
  ['El Corazón', 'No me extrañes, corazón, que regreso en el camión'],
  ['La Sandía', 'La barriga que Juan tenía, era empacho de sandía'],
  ['El Tambor', "No te arrugues, cuero viejo, que te quiero pa' tambor"],
  ['El Camarón', 'Camarón que se duerme, se lo lleva la corriente'],
  ['Las Jaras', 'Las jaras del indio Adán, donde pegan, dan'],
  ['El Músico', 'El músico trompas de hule, ya no me quiere tocar'],
  ['La Araña', 'Atarántamela a palos, no me la dejes llegar'],
  ['El Soldado', "Uno, dos y tres, el soldado p'al cuartel"],
  ['La Estrella', 'La guía de los marineros'],
  ['El Cazo', 'El caso que te hago es poco'],
  ['El Mundo', 'Este mundo es una bola, y nosotros un bolón'],
  ['El Apache', '¡Ah, Chihuahua! Cuánto apache con pantalón y huarache'],
  ['El Nopal', 'Al nopal lo van a ver, nomás cuando tiene tunas'],
  ['El Alacrán', 'El que con la cola pica, le dan una paliza'],
  ['La Rosa', 'Rosita, Rosaura, ven que te quiero ahora'],
  ['La Calavera', 'Al pasar por el panteón, me encontré un calaverón'],
  ['La Campana', 'Tú con la campana y yo con tu hermana'],
  ['El Cantarito', 'Tanto va el cántaro al agua, que se quiebra y te moja las enaguas'],
  ['El Venado', 'Saltando va buscando, pero no ve nada el pobre venado'],
  ['El Sol', 'La cobija de los pobres'],
  ['La Corona', 'El sombrero de los reyes'],
  ['La Chalupa', 'Rema que rema Lupita, sentada en su chalupita'],
  ['El Pino', 'Fresco y oloroso, en todo tiempo hermoso'],
  ['El Pescado', 'El que por la boca muere, aunque mudo fuera'],
  ['La Palma', 'Palmero, sube a la palma y bájame un coco real'],
  ['La Maceta', "El que nace pa' maceta, no sale del corredor"],
  ['El Arpa', "Arpa vieja de mi suegra, ya no sirves pa' tocar"],
  ['La Rana', 'Al ver a la verde rana, qué sobresalto le dio'],
];

const dos = (n) => String(n).padStart(2, '0');

export const TOTAL = NOMBRES_Y_VERSOS.length; // 54

export const CARTAS = NOMBRES_Y_VERSOS.map(([nombre, verso], i) => ({
  n: i + 1,
  nombre,
  verso,
  img: `cartas/${dos(i + 1)}.jpg`,
  mini: `cartas/min/${dos(i + 1)}.jpg`,
}));

export const carta = (n) => CARTAS[n - 1];

// ------------------------------------------------------------------ azar
function enteroAlAzar(max) {
  // Rechazo para no sesgar: descarta los valores del último tramo incompleto.
  const limite = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limite);
  return buf[0] % max;
}

export function barajarMazo() {
  const mazo = CARTAS.map((c) => c.n);
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = enteroAlAzar(i + 1);
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  return mazo;
}

// ------------------------------------------------------------------ códigos de cartón
// Sin 0/O ni 1/I para que nadie los confunda al copiarlos del chat.
const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const LARGO_CODIGO = 6;

export function generarCodigo() {
  let s = '';
  for (let i = 0; i < LARGO_CODIGO; i++) s += ALFABETO[enteroAlAzar(ALFABETO.length)];
  return s;
}

/** Devuelve el código en mayúsculas y limpio, o null si no es válido. */
export function normalizarCodigo(texto) {
  const s = String(texto ?? '').toUpperCase().replace(/[\s#-]/g, '');
  if (s.length !== LARGO_CODIGO) return null;
  for (const ch of s) if (!ALFABETO.includes(ch)) return null;
  return s;
}

function fnv1a(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Las 16 cartas del cartón, en orden de lectura (fila por fila).
 * Determinista: el servidor y cualquier navegador sacan el mismo cartón del mismo código.
 */
export function cartonDesdeCodigo(codigo) {
  const azar = mulberry32(fnv1a(`loteria:${codigo}`));
  const mazo = CARTAS.map((c) => c.n);
  for (let i = 0; i < 16; i++) {
    const j = i + Math.floor(azar() * (mazo.length - i));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  return mazo.slice(0, 16);
}

// ------------------------------------------------------------------ patrones
// Mismos modos que el mundo de VRChat (Loteria_Board_Lines). Cartón 4x4, celdas 0..15.
// `frase` es para meterla en una oración: "completó la fila 2", "te faltan 2 para el centro".
const FILAS = [0, 1, 2, 3].map((f) => ({ nombre: `Fila ${f + 1}`, frase: `la fila ${f + 1}`, celdas: [0, 1, 2, 3].map((c) => f * 4 + c) }));
const COLUMNAS = [0, 1, 2, 3].map((c) => ({ nombre: `Columna ${c + 1}`, frase: `la columna ${c + 1}`, celdas: [0, 1, 2, 3].map((f) => f * 4 + c) }));
const DIAGONALES = [
  { nombre: 'Diagonal', frase: 'una diagonal', celdas: [0, 5, 10, 15] },
  { nombre: 'Diagonal', frase: 'una diagonal', celdas: [3, 6, 9, 12] },
];

export const MODOS = {
  lleno: { nombre: 'Cartón lleno', patrones: [{ nombre: 'Cartón lleno', frase: 'el cartón lleno', celdas: [...Array(16).keys()] }] },
  linea: { nombre: 'Línea', patrones: [...FILAS, ...COLUMNAS, ...DIAGONALES] },
  esquinas: { nombre: 'Cuatro esquinas', patrones: [{ nombre: 'Cuatro esquinas', frase: 'las cuatro esquinas', celdas: [0, 3, 12, 15] }] },
  centro: { nombre: 'Centro', patrones: [{ nombre: 'Centro', frase: 'el centro', celdas: [5, 6, 9, 10] }] },
};

export const modoValido = (m) => (Object.hasOwn(MODOS, m) ? m : 'lleno');

/**
 * Busca el patrón del modo más cercano a completarse.
 * `cumple(celda)` dice si esa celda cuenta (marcada, o su carta ya salió).
 * → { completo, patron, faltan: [celdas] }
 */
export function mejorPatron(modo, cumple) {
  let mejor = null;
  for (const patron of MODOS[modoValido(modo)].patrones) {
    const faltan = patron.celdas.filter((c) => !cumple(c));
    if (!mejor || faltan.length < mejor.faltan.length) mejor = { patron, faltan };
    if (faltan.length === 0) break;
  }
  return { completo: mejor.faltan.length === 0, patron: mejor.patron, faltan: mejor.faltan };
}

/**
 * ¿Este cartón ya ganó con las cartas que han salido?
 * → { gana, patron, faltan: [números de carta] }
 */
export function buscarLoteria(cartas16, salidas, modo) {
  const salio = new Set(salidas);
  const r = mejorPatron(modo, (celda) => salio.has(cartas16[celda]));
  return { gana: r.completo, patron: r.patron, faltan: r.faltan.map((celda) => cartas16[celda]) };
}
