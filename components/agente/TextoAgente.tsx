import { Fragment } from "react";

/** Negritas **así** dentro de una línea */
function enLinea(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((t, i) => (t.startsWith("**") && t.endsWith("**") ? <strong key={i}>{t.slice(2, -2)}</strong> : <Fragment key={i}>{t}</Fragment>));
}

/**
 * Muestra el texto del agente: párrafos y listas con viñetas (•, - o *).
 * Se renderiza como texto (nunca como HTML) para que una respuesta no pueda inyectar código.
 */
export function TextoAgente({ texto }: { texto: string }) {
  const bloques: { tipo: "p" | "ul"; lineas: string[] }[] = [];
  for (const cruda of texto.split("\n")) {
    const linea = cruda.trim();
    if (!linea) {
      bloques.push({ tipo: "p", lineas: [] });
      continue;
    }
    const vineta = /^([•*-]|\d+[.)])\s+/.exec(linea);
    const tipo = vineta ? "ul" : "p";
    const contenido = vineta ? linea.slice(vineta[0].length) : linea.replace(/^#+\s*/, "");
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo.tipo === tipo && (tipo === "ul" || ultimo.lineas.length > 0)) ultimo.lineas.push(contenido);
    else bloques.push({ tipo, lineas: [contenido] });
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {bloques
        .filter((b) => b.lineas.length > 0)
        .map((b, i) =>
          b.tipo === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.lineas.map((l, j) => (
                <li key={j}>{enLinea(l)}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              {b.lineas.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {enLinea(l)}
                </Fragment>
              ))}
            </p>
          ),
        )}
    </div>
  );
}
