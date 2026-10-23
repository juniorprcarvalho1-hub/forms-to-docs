import { useServerFn } from "@tanstack/react-start";
import {
  listarUsuarios,
  cadastrarUsuario,
  atualizarPlanoUsuario,
  alterarSuspensaoUsuario,
} from "@/lib/controle-usuarios.functions";
import { UsuariosPanel } from "./UsuariosPanel";

export function ControleUsuarios() {
  const listar = useServerFn(listarUsuarios),
    cadastrar = useServerFn(cadastrarUsuario),
    plano = useServerFn(atualizarPlanoUsuario),
    suspender = useServerFn(alterarSuspensaoUsuario);
  return <UsuariosPanel api={{ listar, cadastrar, plano, suspender }} />;
}
