const PESTANA = "Invitados";
const LIMITE = 30;

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    return responde(buscar(d.telefono));
  } catch (err) {
    console.error(err);
    return responde({ ok: false, error: String(err) });
  }
}

function buscar(telefono) {
  const tel = normaliza(telefono);
  if (tel.length < 9) return { ok: true, encontrado: false };
  frena();
  const filas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PESTANA).getDataRange().getDisplayValues().slice(1);
  const f = filas.find(r => normaliza(r[0]) === tel);
  if (!f) return { ok: true, encontrado: false };
  return { ok: true, encontrado: true, saludo: f[1].trim(), personas: f[2].trim(), plazas: Number(f[3]) || 1 };
}

function normaliza(t) {
  const n = String(t || "").replace(/\D/g, "").replace(/^00/, "");
  return n.length === 11 && n.startsWith("34") ? n.slice(2) : n;
}

function frena() {
  const cache = CacheService.getScriptCache();
  const clave = "b" + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(clave) || 0) + 1;
  cache.put(clave, String(n), 120);
  if (n > LIMITE) throw new Error("Demasiadas búsquedas");
}

function responde(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
