import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function ControleIps() {
  const cache = useQueryClient();
  const [ip, setIp] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const consulta = useQuery({
    queryKey: ["ips"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ips_bloqueados").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function bloquear(event: React.FormEvent) {
    event.preventDefault();
    if (ocupado) return;
    const validacao = z.string().ip().safeParse(ip.trim());
    if (!validacao.success) { toast.error("Informe um endereço IP válido."); return; }
    setOcupado(true);
    try {
      const { error } = await supabase.from("ips_bloqueados").insert({ ip: validacao.data, motivo: motivo.trim() });
      if (error) throw error;
      setIp(""); setMotivo(""); toast.success("IP bloqueado.");
      await cache.invalidateQueries({ queryKey: ["ips"] });
    } catch { toast.error("Não foi possível bloquear o IP. Confira se ele já está na lista."); }
    finally { setOcupado(false); }
  }
  async function desbloquear(id: string, endereco: string) {
    if (ocupado || !window.confirm("Desbloquear o IP " + endereco + "?")) return;
    setOcupado(true);
    try {
      const { error } = await supabase.from("ips_bloqueados").delete().eq("id", id);
      if (error) throw error;
      toast.success("IP desbloqueado.");
      await cache.invalidateQueries({ queryKey: ["ips"] });
    } catch { toast.error("Não foi possível desbloquear o IP."); }
    finally { setOcupado(false); }
  }
  return <section className="rounded-2xl border bg-card p-5">
    <h2 className="text-lg font-semibold">Bloqueio por IP</h2>
    <form onSubmit={bloquear} className="my-4 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><Label htmlFor="bloquear-ip">Endereço IP</Label><Input className="mt-1" id="bloquear-ip" value={ip} onChange={event => setIp(event.target.value)} maxLength={45} disabled={ocupado} required /></div>
      <div className="min-w-0 flex-1"><Label htmlFor="motivo-ip">Motivo</Label><Input className="mt-1" id="motivo-ip" value={motivo} onChange={event => setMotivo(event.target.value)} maxLength={200} disabled={ocupado} /></div>
      <Button type="submit" disabled={ocupado}>Bloquear IP</Button>
    </form>
    {consulta.isPending ? <p role="status">Carregando IPs…</p> : consulta.isError ? <div role="alert"><p>Não foi possível carregar os bloqueios.</p><Button variant="outline" onClick={() => void consulta.refetch()}>Tentar novamente</Button></div> :
      <ul className="divide-y">{consulta.data.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong className="font-medium">{item.ip}</strong><span className="ml-3 text-sm text-muted-foreground">{item.motivo}</span></span><Button variant="outline" size="sm" disabled={ocupado} onClick={() => void desbloquear(item.id, item.ip)}>Desbloquear</Button></li>)}
      {!consulta.data.length && <li className="text-sm text-muted-foreground">Nenhum IP bloqueado.</li>}</ul>}
  </section>;
}
