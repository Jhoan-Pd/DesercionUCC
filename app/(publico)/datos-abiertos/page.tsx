import { obtenerDatosUcc } from "@/lib/datos-abiertos-remotos";
import { resumenUccPasto } from "@/lib/datos-abiertos";
import { Encabezado } from "@/components/comunes/Encabezado";
import { ModoRender } from "@/components/comunes/ModoRender";
import { PanelCifras } from "@/components/cifras/PanelCifras";

export const metadata = { title: "Cifras oficiales de la UCC Pasto", description: "Matrícula oficial de la Universidad Cooperativa de Colombia, sede Pasto, según datos.gov.co." };

/**
 * Página PÚBLICA con regeneración estática incremental (ISR): se genera en el build y, cuando pasan
 * 24 horas, la siguiente visita recibe la versión guardada mientras Next.js la regenera en segundo
 * plano consultando datos.gov.co. Ninguna visita espera al ministerio y las cifras no envejecen más
 * de un día. Si datos.gov.co falla, se usa el respaldo del repositorio (nunca una página vacía).
 * Debe ser un literal (Next.js lo lee sin ejecutar el código): igual a VIGENCIA_DATOS_ABIERTOS_S.
 */
export const revalidate = 86400;

export default async function DatosAbiertosPage() {
  const { datos, origen } = await obtenerDatosUcc({ next: { revalidate } });
  const r = resumenUccPasto(datos);

  return (
    <>
      <Encabezado
        ceja="Datos abiertos"
        titulo="la UCC Pasto en cifras."
        descripcion={
          <>
            Matrícula oficial de la Universidad Cooperativa de Colombia, sede Pasto, publicada por el Ministerio de Educación en datos.gov.co. Son cifras agregadas: no
            contienen información de estudiantes individuales ni tasas de deserción.
          </>
        }
      />
      <PanelCifras r={r} origen={origen} />
      <ModoRender modo="ISR" detalle={`se regenera cada ${revalidate / 3600} h · ${origen.tipo === "en-vivo" ? "datos en vivo de datos.gov.co" : "respaldo del repositorio (datos.gov.co no respondió)"}`} />
    </>
  );
}
