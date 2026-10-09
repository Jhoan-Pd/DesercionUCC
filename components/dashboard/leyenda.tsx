import { COLOR } from "@/lib/colores";

/** El texto de la leyenda va en color de tinta; el color de la serie solo lo lleva el ícono */
export function textoLeyenda(valor: string) {
  return <span style={{ color: COLOR.tinta, fontSize: 12 }}>{valor}</span>;
}
