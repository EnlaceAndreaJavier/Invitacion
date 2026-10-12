const CARPETA = "1wXLo05rkGbH-5DJW5jLahWH9dgU7k8kk";
const MAXIMO = 500 * 1024 * 1024;
const SUBIDA = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    return responde(d.accion === "trozo" ? trozo(d) : inicio(d));
  } catch (err) {
    console.error(err);
    return responde({ ok: false, error: String(err) });
  }
}

function inicio(d) {
  if (!/^(image|video)\//.test(d.tipo) || !(d.total > 0) || d.total > MAXIMO) throw new Error("Archivo no válido");
  const carpeta = DriveApp.getFolderById(CARPETA).getId();
  const quien = String(d.quien || "").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "Invitado";
  const hora = Utilities.formatDate(new Date(), "Europe/Madrid", "yyyy-MM-dd HH.mm.ss");
  const nombre = hora + " - " + quien + " - " + String(d.nombre || "archivo").slice(0, 80);
  const r = UrlFetchApp.fetch(SUBIDA, {
    method: "post",
    contentType: "application/json; charset=UTF-8",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "X-Upload-Content-Type": d.tipo, "X-Upload-Content-Length": String(d.total) },
    payload: JSON.stringify({ name: nombre, parents: [carpeta] }),
    muteHttpExceptions: true,
    followRedirects: false
  });
  if (r.getResponseCode() !== 200) throw new Error(r.getContentText());
  const h = r.getHeaders();
  return { ok: true, sesion: h.Location || h.location };
}

function trozo(d) {
  if (String(d.sesion).indexOf(SUBIDA + "&") !== 0) throw new Error("Sesión no válida");
  const bytes = Utilities.base64Decode(d.datos);
  const fin = d.inicio + bytes.length - 1;
  const r = UrlFetchApp.fetch(d.sesion, {
    method: "put",
    contentType: d.tipo,
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "Content-Range": "bytes " + d.inicio + "-" + fin + "/" + d.total },
    payload: bytes,
    muteHttpExceptions: true,
    followRedirects: false
  });
  const c = r.getResponseCode();
  if (c !== 308 && c !== 200 && c !== 201) throw new Error(c + " " + r.getContentText());
  return { ok: true, fin: c !== 308 };
}

function responde(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
