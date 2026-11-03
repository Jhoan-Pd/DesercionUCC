import { VIGENCIA_DATOS_ABIERTOS_S, obtenerDatosUcc } from "@/lib/datos-abiertos-remotos";
import { resumenUccPasto } from "@/lib/datos-abiertos";
import { Encabezado } from "@/components/comunes/Encabezado";
import { PanelCifras } from "@/components/cifras/PanelCifras";

export const metadata = { title: "Cifras oficiales UCC" };

/**
 * Cifras oficiales dentro del observatorio. La página es SSR (el layout lee la sesión en cada
 * petición), pero la consulta a datos.gov.co usa la caché de datos de Next.js con la misma vigencia
 * que la página pública: las dos comparten la respuesta y no se consulta el ministerio en cada visita.
 */
export default async function CifrasUccPage() {
  const { datos, origen } = await obtenerDatosUcc({ next: { revalidate: VIGENCIA_DATOS_ABIERTOS_S } });
  const r = resumenUccPasto(datos);

  return (
    <>
      <Encabezado
        seccion="/cifras-ucc"
        titulo="la UCC Pasto en cifras."
        descripcion={
          <>
            Matrícula reportada por la universidad al Ministerio de Educación y publicada en datos.gov.co. Son cifras agregadas por programa, sexo y año; no contienen
            información de estudiantes individuales ni tasas de deserción.
          </>
        }
      />
      <PanelCifras r={r} origen={origen} />
      <p className="meta">{`// las cifras de datos.gov.co salen de la caché de datos de Next.js (vigencia de ${VIGENCIA_DATOS_ABIERTOS_S / 3600} h), compartida con la página pública /datos-abiertos (ISR)`}</p>
    </>
  );
}
