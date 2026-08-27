import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const LARGURA_A4_PX = 794;

/**
 * Encaixa uma página A4 (794px) na largura disponível, mantendo a mesma
 * escala visual usada na geração do PDF (WYSIWYG).
 */
export function EscalaA4({ children, className }: { children: ReactNode; className?: string }) {
  const externoRef = useRef<HTMLDivElement>(null);
  const internoRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [altura, setAltura] = useState<number>(0);

  useEffect(() => {
    const externo = externoRef.current;
    const interno = internoRef.current;
    if (!externo || !interno) return;

    const atualizar = () => {
      const disponivel = externo.clientWidth;
      const novaEscala = Math.min(1, disponivel / LARGURA_A4_PX);
      setEscala(novaEscala);
      setAltura(interno.offsetHeight * novaEscala);
    };

    atualizar();
    const observador = new ResizeObserver(atualizar);
    observador.observe(externo);
    observador.observe(interno);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={externoRef} className={cn("w-full overflow-hidden", className)} style={{ height: altura || undefined }}>
      <div
        ref={internoRef}
        style={{
          width: LARGURA_A4_PX,
          transform: `scale(${escala})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
