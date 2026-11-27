type DadosPreceptoria = { nome: string; data_inicio?: string; data_emissao?: string };
export const EMAIL_CLINICA_FACESF = "clinicasaudeintegrada.facesf@gmail.com";
export const NOME_CLINICA_FACESF = "Clínica Saúde Integrada CELC";

export function mensagemEmailPreceptoria(_dados: DadosPreceptoria) {
  const mensagem = "Encaminhamos, em anexo, a Declaração de Preceptoria referente ao Estágio Curricular Supervisionado do semestre letivo 2026.2.";
  const agradecimento = "Agradecemos pela parceria, disponibilidade e contribuição no processo de formação acadêmica e profissional dos nossos estudantes.";
  const esclarecimentos = "Permanecemos à disposição para eventuais esclarecimentos.";
  const clinica = "Clínica-Escola Dr. Ênio Lustosa Cantarelli";
  const faculdade = "Faculdade de Ciências Humanas e Exatas do Sertão do São Francisco - FACESF";
  const credenciamento = "Credenciada pela Portaria Min. Nº 664, de 06/07/2007 – Pub. no D.O.U. de 09/07/2007";
  const psicologia = "Curso de Psicologia autorizado pela Portaria Min. Nº 583 de 17/08/2015 – Pub. no D.O.U. de 18/08/2015";
  const endereco = "Rua Cel. Trapiá, 201, Centro - Belém do São Francisco/PE CEP: 56440-000";
  const cadastro = "CNPJ: 09.801.291/0001-91 - Tel.: (87) 3876-1460 - www.facesf.com.br/";
  const mapa = "https://www.google.com/maps/search/Rua+Cel.+Trapi%C3%A1,+201?entry=gmail&source=g";
  const site = "https://www.facesf.com.br/";
  return {
    assunto: "DECLARAÇÃO DE PRECEPTORIA.",
    corpo: [
      "Prezado(a),", "", mensagem, "", agradecimento, "", esclarecimentos, "", "Atenciosamente,",
      "Equipe CELC/", "Millena Marília Canário Cabral e Sousa", "Coordenadora NuPEP/NuPES", clinica,
      faculdade, credenciamento, psicologia, endereco, cadastro,
      "", `Localização: ${mapa}`, `Site: ${site}`,
    ].join("\n"),
    corpo_html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#202124;line-height:1.4">
      <p style="margin:0 0 18px">Prezado(a),</p>
      <p style="margin:0 0 18px">${mensagem}</p>
      <p style="margin:0 0 18px">${agradecimento}</p>
      <p style="margin:0 0 18px">${esclarecimentos}</p>
      <p style="margin:0 0 18px">Atenciosamente,</p>
      <div>Equipe CELC/<br><strong style="color:#0000ff">Millena Marília Canário Cabral e Sousa<br>Coordenadora NuPEP/NuPES</strong><br>${clinica}</div>
      <div style="text-align:center">
        <div>${faculdade}</div>
        <div style="color:#8a4200;font-size:10px">${credenciamento}<br>${psicologia}</div>
        <div style="font-size:10px"><a href="${mapa.replaceAll("&", "&amp;")}">${endereco}</a><br>CNPJ: 09.801.291/0001-91 - Tel.:
          <a href="tel:+558738761460">(87) 3876-1460</a> - <a href="${site}">www.facesf.com.br</a>/</div>
      </div>
    </div>`,
  };
}
