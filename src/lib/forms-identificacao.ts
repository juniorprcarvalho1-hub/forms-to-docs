export class ValidacaoFormularioError extends Error {}
export type CursoFormulario="enfermagem"|"fisioterapia"|"nutricao"|"psicologia";
export function normalizarCampo(s:string):string{return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
const ALIASES:Record<CursoFormulario,string[]>={enfermagem:["enfermagem","enferm","enf"],fisioterapia:["fisioterapia","fisio"],nutricao:["nutricao","nutri"],psicologia:["psicologia","psico"]};
export function resolverCursoFormulario(value:string):CursoFormulario{
 const s=value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const encontrados=(Object.keys(ALIASES) as CursoFormulario[]).filter(k=>ALIASES[k].some(a=>new RegExp("(?:^|[^a-z])"+a+"(?=$|[^a-z])").test(s)));
 if(encontrados.length!==1)throw new ValidacaoFormularioError("Informe um único curso reconhecido: Enfermagem, Fisioterapia, Nutrição ou Psicologia.");
 return encontrados[0]!;
}
export function buscarCampoFormulario(payload:Record<string,unknown>,aliases:string[],evitar:string[]=[]):string{
 const chaves=aliases.map(normalizarCampo);
 const encontrados=Object.entries(payload).filter(([k,v])=>chaves.includes(normalizarCampo(k))&&!evitar.some(e=>normalizarCampo(k).includes(normalizarCampo(e)))&&v!==null&&v!==undefined&&String(v).trim()).map(([,v])=>String(v).trim());
 const unicos=[...new Set(encontrados)];
 if(unicos.length>1)throw new ValidacaoFormularioError("Há respostas contraditórias para um campo do formulário. Confira as perguntas equivalentes.");
 return unicos[0]??"";
}
export function resolverPeriodoFormulario(payload:Record<string,unknown>,curso:CursoFormulario):string{
 const values=Object.entries(payload).filter(([k])=>/periodo|semestre|fase|estagiosupervisionado/.test(normalizarCampo(k))).map(([,v])=>String(v??"").trim()).filter(Boolean);
 const numeros=values.map(v=>v.match(/^(\d{1,2})\s*(?:º|°|o|ª)?\s*(?:per[ií]odo|semestre)?\.?$/i)?.[1]??"");
 if(!numeros.length||numeros.some(n=>!n)||new Set(numeros).size!==1)throw new ValidacaoFormularioError("Informe um único período válido no campo de período do formulário.");
 const permitido=curso==="nutricao"?["7","8"]:["9","10"];
 if(!permitido.includes(numeros[0]!))throw new ValidacaoFormularioError("O período informado não corresponde aos períodos deste curso.");
 return numeros[0]!;
}
