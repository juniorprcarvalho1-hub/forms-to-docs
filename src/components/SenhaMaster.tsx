import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cadastroUsuarioSchema } from "@/lib/controle-usuarios";

export function SenhaMaster() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    setErro("");
    const validacao = cadastroUsuarioSchema.shape.senha.safeParse(senha);
    if (!validacao.success) { setErro("Use pelo menos 8 caracteres e no máximo 72 bytes."); return; }
    if (senha !== confirmacao) { setErro("As senhas devem ser iguais."); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await supabase.auth.signOut({ scope: "others" });
      setSenha(""); setConfirmacao("");
      toast.success("Senha da conta master atualizada.");
    } catch { setErro("Não foi possível alterar a senha. Entre novamente e tente outra senha."); }
    finally { setSalvando(false); }
  }
  return <section className="rounded-2xl border bg-card p-5">
    <h2 className="text-lg font-semibold">Senha da conta master</h2>
    <p className="mt-1 text-sm text-muted-foreground">Defina uma senha pessoal após o primeiro acesso.</p>
    <form onSubmit={salvar} className="mt-4 max-w-lg space-y-4">
      <div className="space-y-1.5"><Label htmlFor="senha-master">Nova senha</Label><Input id="senha-master" type="password" autoComplete="new-password" minLength={8} value={senha} onChange={event => setSenha(event.target.value)} disabled={salvando} required /></div>
      <div className="space-y-1.5"><Label htmlFor="confirmar-senha-master">Confirme a nova senha</Label><Input id="confirmar-senha-master" type="password" autoComplete="new-password" minLength={8} value={confirmacao} onChange={event => setConfirmacao(event.target.value)} disabled={salvando} required /></div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Alterar minha senha"}</Button>
    </form>
  </section>;
}
