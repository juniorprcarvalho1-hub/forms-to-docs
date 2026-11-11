type DadosPreceptoria = { nome: string; data_inicio?: string; data_emissao?: string };
const entidades: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
const escapar = (texto: string) => texto.replace(/[&<>"']/g, (caractere) => entidades[caractere] ?? caractere);

export const EMAIL_CLINICA_FACESF = "clinicasaudeintegrada.facesf@gmail.com";
export const NOME_CLINICA_FACESF = "Clínica Saúde Integrada CELC";

export function mensagemEmailPreceptoria(dados: DadosPreceptoria) {
  const data = [dados.data_inicio, dados.data_emissao]
    .map((valor) => valor?.match(/^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/))
    .find(Boolean);
  const semestre = data ? `${data[1]}.${Number(data[2]) <= 6 ? 1 : 2}` : "";
  const periodo = semestre ? ` referente ao semestre de ${semestre}` : "";
  const mensagem = `Temos o prazer de informar que estamos encaminhando em anexo, a declaração de preceptoria de Estágio Curricular supervisionado${periodo}.`;
  const agradecimento = "Agradecemos pela atenção dispensada e permanecemos à disposição para eventuais esclarecimentos.";
  const clinica = "Clínica-Escola Dr. Ênio Lustosa Cantarelli";
  const faculdade = "Faculdade de Ciências Humanas e Exatas do Sertão do São Francisco - FACESF";
  const credenciamento = "Credenciada pela Portaria Min. Nº 664, de 06/07/2007 – Pub. no D.O.U. de 09/07/2007";
  const psicologia = "Curso de Psicologia autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. no D.O.U. de 18/08/2015";
  const endereco = "Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP: 56440-000";
  const cadastro = "CNPJ: 09.801.291/0001-91 - Tel.: (87) 3876-1460 - www.facesf.com.br";
  return {
    assunto: "DECLARAÇÃO DE PRECEPTORIA.",
    corpo: [
      `Prezado(a) ${dados.nome},`, "", mensagem, "", agradecimento, "", "Atenciosamente,", "",
      "Equipe CELC/", "Nathaly Ferraz Queiroz Silva", "Coordenadora", clinica,
      faculdade, credenciamento, psicologia, endereco, cadastro,
    ].join("\n"),
    corpo_html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#202124;line-height:1.4">
      <p style="margin:0 0 18px">Prezado(a) <strong>${escapar(dados.nome)}</strong>,</p>
      <p style="margin:0 0 18px">${mensagem}</p>
      <p style="margin:0 0 18px">${agradecimento}</p>
      <p style="margin:0 0 18px">Atenciosamente,</p>
      <div>Equipe CELC/<br><strong style="color:#0000ff">Nathaly Ferraz Queiroz Silva<br>Coordenadora</strong><br>${clinica}</div>
      <div style="text-align:center">
        <div>${faculdade}</div>
        <div style="color:#8a4200;font-size:10px">${credenciamento}<br>${psicologia}</div>
        <div style="font-size:10px">${endereco}<br>CNPJ: 09.801.291/0001-91 - Tel.:
          <a href="tel:+558738761460">(87) 3876-1460</a> - <a href="https://www.facesf.com.br">www.facesf.com.br</a></div>
      </div>
    </div>`,
  };
}
