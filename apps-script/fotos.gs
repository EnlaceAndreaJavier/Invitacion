const CARPETA = "1wXLo05rkGbH-5DJW5jLahWH9dgU7k8kk";
const MAXIMO = 20 * 1024 * 1024;

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const bytes = Utilities.base64Decode(d.datos);
    if (!/^image\//.test(d.tipo) || bytes.length > MAXIMO) throw new Error("Archivo no válido");
    const quien = String(d.quien || "").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "Invitado";
    const hora = Utilities.formatDate(new Date(), "Europe/Madrid", "yyyy-MM-dd HH.mm.ss");
    const nombre = hora + " - " + quien + " - " + String(d.nombre || "foto.jpg").slice(0, 80);
    DriveApp.getFolderById(CARPETA).createFile(Utilities.newBlob(bytes, d.tipo, nombre));
    return responde({ ok: true });
  } catch (err) {
    return responde({ ok: false, error: String(err) });
  }
}

function responde(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
