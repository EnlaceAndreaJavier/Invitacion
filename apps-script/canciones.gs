const LISTA = "3Md5ad21v97TUbFkrBeJi7";
const API = "https://api.spotify.com/v1";
const PERMISOS = "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private";
const ajustes = PropertiesService.getScriptProperties();

function autorizar() {
  const estado = Utilities.getUuid();
  ajustes.setProperty("ESTADO", estado);
  console.log("https://accounts.spotify.com/authorize?response_type=code" +
    "&client_id=" + encodeURIComponent(ajustes.getProperty("CLIENT_ID")) +
    "&redirect_uri=" + encodeURIComponent(ajustes.getProperty("URL")) +
    "&scope=" + encodeURIComponent(PERMISOS) + "&state=" + estado);
}

function doGet(e) {
  const p = e.parameter;
  if (!p.code || !p.state || p.state !== ajustes.getProperty("ESTADO")) return HtmlService.createHtmlOutput("");
  const t = token({ grant_type: "authorization_code", code: p.code, redirect_uri: ajustes.getProperty("URL") });
  ajustes.setProperty("REFRESH", t.refresh_token);
  ajustes.deleteProperty("ESTADO");
  return HtmlService.createHtmlOutput("<h2>Listo. Spotify ha quedado conectado; ya puedes cerrar esta pestaña.</h2>");
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    return responde(d.accion === "anadir" ? anadir(d.uri) : buscar(d.texto));
  } catch (err) {
    console.error(err);
    return responde({ ok: false, error: String(err) });
  }
}

function buscar(texto) {
  const q = String(texto || "").trim().slice(0, 100);
  if (q.length < 2) return { ok: true, canciones: [] };
  const r = spotify("get", "/search?type=track&market=ES&limit=8&q=" + encodeURIComponent(q));
  return {
    ok: true,
    canciones: r.tracks.items.map(c => ({
      uri: c.uri,
      titulo: c.name,
      artista: c.artists.map(a => a.name).join(", "),
      portada: (c.album.images[c.album.images.length - 1] || {}).url || ""
    }))
  };
}

function anadir(uri) {
  if (!/^spotify:track:[A-Za-z0-9]{22}$/.test(uri)) throw new Error("Canción no válida");
  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(20000);
  try {
    for (let pagina = "/playlists/" + LISTA + "/items?limit=100"; pagina; ) {
      const r = spotify("get", pagina);
      if (r.items.some(i => ((i.item || i.track) || {}).uri === uri)) return { ok: true, repetida: true };
      pagina = r.next ? r.next.replace(API, "") : "";
    }
    spotify("post", "/playlists/" + LISTA + "/items", { uris: [uri] });
    return { ok: true, repetida: false };
  } finally {
    cerrojo.releaseLock();
  }
}

function spotify(metodo, ruta, cuerpo) {
  const r = UrlFetchApp.fetch(API + ruta, {
    method: metodo,
    contentType: "application/json",
    headers: { Authorization: "Bearer " + acceso() },
    payload: cuerpo ? JSON.stringify(cuerpo) : undefined,
    muteHttpExceptions: true
  });
  if (r.getResponseCode() >= 300) throw new Error(r.getResponseCode() + " " + r.getContentText());
  return JSON.parse(r.getContentText() || "{}");
}

function acceso() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get("ACCESO");
  if (guardado) return guardado;
  const t = token({ grant_type: "refresh_token", refresh_token: ajustes.getProperty("REFRESH") });
  if (t.refresh_token) ajustes.setProperty("REFRESH", t.refresh_token);
  cache.put("ACCESO", t.access_token, 3000);
  return t.access_token;
}

function token(datos) {
  const r = UrlFetchApp.fetch("https://accounts.spotify.com/api/token", {
    method: "post",
    payload: datos,
    headers: { Authorization: "Basic " + Utilities.base64Encode(ajustes.getProperty("CLIENT_ID") + ":" + ajustes.getProperty("CLIENT_SECRET")) },
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error(r.getContentText());
  return JSON.parse(r.getContentText());
}

function responde(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
