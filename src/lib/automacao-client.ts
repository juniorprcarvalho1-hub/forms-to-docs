type Etapa={estado:string;erro_codigo?:string;tentativas?:number;path?:string};
export type Andamento={habilitada:boolean;versao?:number;pdf?:Etapa|null;email?:Etapa|null};
const motivos:Record<string,string>={renderizador_ausente:"Configure o gerador de PDF",gmail_ausente:"Conecte o Gmail do sistema",orientador_ausente:"Cadastre o e-mail do orientador",preceptor_ausente:"Informe um e-mail válido do preceptor",conta_inativa:"Conta suspensa ou vencida",campo_ausente:"Revise os campos obrigatórios",modelo_ausente:"Cadastre o modelo do curso",modelo_incompativel:"Revise o curso e o modelo",imagem_invalida:"Revise a imagem do modelo",imagem_indisponivel:"Imagem indisponível",pdf_layout:"Revise o documento: deve caber em uma página A4",pdf_invalido:"PDF inválido: revise o documento",confirmar_envio:"Confira se a mensagem chegou antes de tentar novamente"};
function rotulo(e:Etapa|undefined|null,etapa:"pdf"|"email",habilitada:boolean){
 if(!e)return habilitada?(etapa==="pdf"?"Sem geração automática solicitada":""):"Automação aguardando ativação";
 if(e.estado==="concluido")return etapa==="pdf"?"PDF pronto":"E-mail enviado";
 if(e.estado==="envio_a_confirmar")return "Envio a confirmar";
 if(e.erro_codigo&&motivos[e.erro_codigo])return motivos[e.erro_codigo]!;
 return ({pendente:"Na fila",processando:etapa==="pdf"?"Gerando PDF":"Enviando e-mail",erro_recuperavel:"Nova tentativa agendada",bloqueado_configuracao:"Aguardando correção",cancelado:"Versão substituída"} as Record<string,string>)[e.estado]??"Aguardando";
}
export function projetarAndamento(a:Andamento){
 const retomavel=(e?:Etapa|null)=>!!e&&["erro_recuperavel","bloqueado_configuracao"].includes(e.estado);
 return{pdf:rotulo(a.pdf,"pdf",a.habilitada),email:rotulo(a.email,"email",a.habilitada),enviado:a.email?.estado==="concluido",confirmar:a.email?.estado==="envio_a_confirmar",retomarPdf:retomavel(a.pdf),retomarEmail:retomavel(a.email)};
}

export function selecionarPdfArquivado(a:Andamento):string|null{
 const path=a.pdf?.path;
 if(a.pdf?.estado!=="concluido"||typeof path!=="string"||!a.versao)return null;
 const uuid="[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}";
 return new RegExp("^"+uuid+"/automacao/"+uuid+"/v"+a.versao+"\\.pdf$","i").test(path)?path:null;
}
