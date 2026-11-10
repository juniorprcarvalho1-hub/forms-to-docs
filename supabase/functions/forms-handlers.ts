import {resolverCursoFormulario,resolverPeriodoFormulario,buscarCampoFormulario,ValidacaoFormularioError} from "../../src/lib/forms-identificacao.ts";
import {dataISO} from "../../src/lib/importacao.ts";
import {formsFailure,formsJson} from "./forms-http.ts";
export type FormsAdmin={from:(table:string)=>any;rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>};
const json= formsJson;
function normalizar(chave:string){return chave.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
async function saveDocument(admin:FormsAdmin,request:Request,token:string,destination:string,record:Record<string,unknown>):Promise<Response>{
 const data={...record};
 for(const field of ["data","data_inicio","data_fim"]){
  if(typeof data[field]!=="string" || !data[field])continue;
  const raw=String(data[field]);const iso=dataISO(/^\d{4}-\d{2}-\d{2}T/.test(raw)?raw.slice(0,10):raw);
  if(!iso)return json({error:"Confira as datas do formulário."},422);data[field]=iso;
 }
 if(destination==="declaracoes-resposta" && (String(data.supervisor??"").trim().length<2 || String(data.estagiario??"").trim().length<2))return json({error:"Informe o nome do supervisor."},422);
 if(data.data_inicio && data.data_fim && String(data.data_inicio)>String(data.data_fim))return json({error:"A data de término deve ser igual ou posterior à data de início."},422);
 const {data:saved,error}=await admin.rpc("registrar_documento_forms",{p_token:token,p_destino:destination,p_chave:request.headers.get("x-facesf-id"),p_hash:request.headers.get("x-facesf-source-hash"),p_dados:data});
 return error?formsFailure(error):json(saved);
}
async function oficiosInterno(request: Request,supabaseAdmin:FormsAdmin,validatedToken:string):Promise<Response>{

        

        const { data: config } = await supabaseAdmin
          .from("configuracoes")
          .select("*")
          .maybeSingle();
        if (!config) return json({ error: "Configuração ausente" }, 500);

        const cfg = config as unknown as Record<string, string | number>;

        let bruto: Record<string, unknown> = {};
        try {
          bruto = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        // Aceita chaves do Google Forms com acento/maiúsculas ("Aluno(a)", "MATRÍCULA"...)
        const payload: Record<string, unknown> = {};
        for (const [chave, valor] of Object.entries(bruto)) {
          payload[normalizar(chave)] = Array.isArray(valor) ? valor.flat(Infinity).map(String).join("; ") : valor;
        }

        const token = request.headers.get("x-webhook-token") ?? String(payload["token"] ?? "");
        if (token !== validatedToken) {
          return json({ error: "Token inválido" }, 401);
        }

        const texto = (...chaves: string[]) => {
          for (const chave of chaves) {
            const valor = payload[normalizar(chave)];
            if (valor !== undefined && String(valor).trim() !== "") return String(valor).trim();
          }
          return "";
        };
        const padrao = (chave: string) => String(cfg[chave] ?? "");

        const dataStr = texto("data") || new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Fortaleza"}).format(new Date());

        const nome = texto("aluno", "alunoa", "nome");
        if (!nome) return json({ error: "Campo Aluno(a) não recebido" }, 422);

        // Cadastros auxiliares: curso e professor escolhidos no formulário
        const cursoForm = texto("curso");
        const professorForm = texto("professor", "professororientador", "professoraorientadora");

        const { data: cursos, error: cursosError } = await supabaseAdmin
          .from("cursos")
          .select("nome_formulario, nome_oficial, area_estagio");
if(cursosError) throw Error('Lookup unavailable');
        const { data: professores, error: professoresError } = await supabaseAdmin
          .from("professores")
          .select("nome_formulario, nome_oficial, registro, curso");
if(professoresError) throw Error('Lookup unavailable');

        const cursoCad = (cursos ?? []).find(
          (c:any) => normalizar(String(c.nome_formulario)) === normalizar(cursoForm),
        );
        const curso = cursoCad?.nome_oficial?.trim() || cursoForm;
        const cursoChave = resolverCursoFormulario(curso);

        const professorCad = (professores ?? []).find((p: any) => {
          const alvo = normalizar(String(p.nome_formulario));
          return (
            (professorForm && alvo === normalizar(professorForm)) ||
            (!professorForm && normalizar(String(p.curso)) === normalizar(cursoForm))
          );
        });
        const professor =
          professorCad?.nome_oficial?.trim() || professorForm || padrao("padrao_professor");

        // Módulo do estágio e modelo aplicável (1 padrão, 2 nutrição, 3 psicologia)
        const moduloForm = texto("modulo", "moduloestagio", "estagio", "modulos", "qualseuestagio");
        const cursoNorm = normalizar(curso || cursoForm);
        const modeloChave = cursoChave === "nutricao" ? "nutricao" : cursoChave === "psicologia" ? "psicologia" : "padrao";

        let moduloNome = moduloForm;
        let cargaModulo = "";
        let areaModulo = "";
        if (modeloChave !== "padrao") {
          const { data: modulos, error: modulosError } = await supabaseAdmin
            .from("modulos_estagio")
            .select("curso, nome_formulario, nome_oficial, carga_horaria, area_estagio");
if(modulosError) throw Error('Lookup unavailable');
          const moduloCad = (modulos ?? []).find(
            (m:any) =>
              normalizar(String(m.nome_formulario)) === normalizar(moduloForm) &&
              (!String(m.curso).trim() || normalizar(String(m.curso)) === cursoNorm),
          );
          if (moduloCad) {
            moduloNome = String(moduloCad.nome_oficial || moduloCad.nome_formulario);
            cargaModulo = String(moduloCad.carga_horaria ?? "");
            areaModulo = String(moduloCad.area_estagio ?? "");
          }
        }

        const cargaFinal = modeloChave === "padrao" ? "420 horas" : (texto("cargahoraria") || cargaModulo);
        if(modeloChave!=="padrao" && (!moduloNome.trim() || !cargaFinal.trim()))throw new ValidacaoFormularioError("Cadastre o módulo e a carga horária ou informe esses dados no formulário.");

        const registro = {
          modulo: moduloNome,
          modelo_chave: modeloChave,
          data: dataStr,
          nome,
          cpf: texto("cpf"),
          curso,
          matricula: texto("matricula"),
          instituicao: texto("instituicao"),
          cargo: texto("cargo"),
          assunto: texto("assunto") || "Estágio Curricular Obrigatório",
          corpo: texto("corpo"),
          destinatario: texto("destinatario") || padrao("padrao_destinatario"),
          area_estagio:
            texto("areaestagio", "area") ||
            areaModulo.trim() ||
            cursoCad?.area_estagio?.trim() ||
            padrao("padrao_area_estagio"),
          professor_orientador: professor,
          registro_professor:
            texto("registroprofessor", "conselho") ||
            professorCad?.registro?.trim() ||
            padrao("padrao_registro_professor"),
          carga_horaria: cargaFinal,
          periodo: texto("periodo") || padrao("padrao_periodo"),
          seguradora: texto("seguradora") || padrao("padrao_seguradora"),
          apolice: texto("apolice") || padrao("padrao_apolice"),
          coordenador: texto("coordenador") || padrao("padrao_coordenador"),
          origem: texto("origem") || "google_forms",
        };

return saveDocument(supabaseAdmin,request,token,"oficios",registro);

}
async function declaracoesInterno(request: Request,supabaseAdmin:FormsAdmin,validatedToken:string):Promise<Response>{

        

        const { data: config } = await supabaseAdmin
          .from("configuracoes")
          .select("*")
          .maybeSingle();
        if (!config) return json({ error: "Configuração ausente" }, 500);
        const cfg = config as unknown as Record<string, string | number>;

        let bruto: Record<string, unknown> = {};
        try {
          bruto = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        const payload: Record<string, unknown> = {};
        for (const [chave, valor] of Object.entries(bruto)) {
          payload[normalizar(chave)] = Array.isArray(valor) ? valor.flat(Infinity).map(String).join("; ") : valor;
        }

        const token = request.headers.get("x-webhook-token") ?? String(payload["token"] ?? "");
        if (token !== validatedToken) {
          return json({ error: "Token inválido" }, 401);
        }

        /** Procura o valor por correspondência exata e, depois, aproximada do título da pergunta. */
        const buscar = (chaves:string[], evitar:string[]=[]) => buscarCampoFormulario(payload,chaves,evitar);
        const texto = (...chaves: string[]) => buscar(chaves);

        const nome = buscar(
          ["nome", "preceptor", "nomedopreceptor", "nomecompleto", "nomecompletodopreceptor"],
          ["aluno", "estudante", "discente", "curso", "hospital", "email"],
        );
        if (!nome) return json({ error: "Campo Nome não recebido" }, 422);

        const cursoForm = texto("curso", "cursodeestagio", "areadeestagio", "area");

        // Nome oficial do curso, conforme cadastro auxiliar
        const { data: cursos, error: cursosError } = await supabaseAdmin
          .from("cursos")
          .select("nome_formulario, nome_oficial");
if(cursosError) throw Error('Lookup unavailable');
        const cursoCad = (cursos ?? []).find(
          (c:any) => normalizar(String(c.nome_formulario)) === normalizar(cursoForm),
        );
        const curso = cursoCad?.nome_oficial?.trim() || cursoForm;
        const cursoChave = resolverCursoFormulario(curso);

        const modeloChave = cursoChave;

        // Campo de estágio: nome oficial e carga horária vêm do cadastro do sistema
        const campoForm = texto(
          "campodeestagio",
          "campoestagio",
          "hospital",
          "instituicao",
          "modulo",
        );
        const cursoNorm = normalizar(curso || cursoForm);
        const { data: modulos, error: modulosError } = await supabaseAdmin
          .from("modulos_estagio")
          .select("curso, nome_formulario, nome_oficial, carga_horaria");
if(modulosError) throw Error('Lookup unavailable');
        const campoCad = (modulos ?? []).find(
          (m:any) =>
            normalizar(String(m.nome_formulario)) === normalizar(campoForm) &&
            (!String(m.curso).trim() || normalizar(String(m.curso)) === cursoNorm),
        );

        const registro = {
          nome,
          curso,
          modelo_chave: modeloChave,
          coren: texto("registroprofissional", "registro", "coren", "crefito", "crn", "crp"),
          hospital: campoCad
            ? String(campoCad.nome_oficial || campoCad.nome_formulario)
            : campoForm,
          data_inicio: texto("datainicio", "datadeinicio", "inicio", "periodoinicio"),
          data_fim: texto("datafim", "datadefim", "fim", "periodofim", "termino"),
          carga_horaria:
            String(campoCad?.carga_horaria ?? "") || String(cfg["padrao_carga_horaria"] ?? ""),
          alunos: texto("alunos", "nomedosalunos", "nomedoaluno", "nomesdosalunos", "estudantes", "discentes"),
          email: texto("emaildopreceptor", "email", "enderecodeemail"),
          origem: "google_forms",
        };

return saveDocument(supabaseAdmin,request,token,"declaracoes",registro);

}
async function respostasInterno(request: Request,supabaseAdmin:FormsAdmin,validatedToken:string):Promise<Response>{

        

        const { data: config } = await supabaseAdmin
          .from("configuracoes")
          .select("*")
          .maybeSingle();
        if (!config) return json({ error: "Configuração ausente" }, 500);
        const cfg = config as unknown as Record<string, string | number>;

        let bruto: Record<string, unknown> = {};
        try {
          bruto = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        const payload: Record<string, unknown> = {};
        for (const [chave, valor] of Object.entries(bruto)) {
          payload[normalizar(chave)] = Array.isArray(valor) ? valor.flat(Infinity).map(String).join("; ") : valor;
        }

        const token = request.headers.get("x-webhook-token") ?? String(payload["token"] ?? "");
        if (token !== validatedToken) {
          return json({ error: "Token inválido" }, 401);
        }

        const buscar = (chaves:string[], evitar:string[]=[]) => buscarCampoFormulario(payload,chaves,evitar);
        const texto = (...chaves: string[]) => buscar(chaves);

        const supervisor = buscar(
          ["nomedosupervisor", "supervisor", "nomecompletodosupervisor", "nomecompletodosupervisordecampo", "nomedosupervisordecampo", "nomedosupervisoradecampo", "nomecompletodosupervisoradecampo", "nome"],
          ["estagiario", "aluno", "discente", "curso", "email"],
        );
        const supervisorFinal = supervisor;

        const estagiario = buscar(
          ["nomedoestagiario", "nomedoestagiarioa", "nomedoaestagiario", "nomedoaestagiarioa", "nomecompletodoestagiario", "nomecompletodoestagiarioa", "estagiario", "estagiarioa", "aluno", "alunoa", "nomedoaluno", "nomedoalunoa", "discente"],
          ["supervisor"],
        );

        const cursoForm = texto("curso", "cursodoestagiario") || texto("areadeestagio", "area");
        const { data: cursos, error: cursosError } = await supabaseAdmin
          .from("cursos")
          .select("nome_formulario, nome_oficial");
if(cursosError) throw Error('Lookup unavailable');
        const cursoCad = (cursos ?? []).find(
          (c:any) => normalizar(String(c.nome_formulario)) === normalizar(cursoForm),
        );
        const curso = cursoCad?.nome_oficial?.trim() || cursoForm;
        const cursoChave = resolverCursoFormulario(curso);

        const modeloChave = cursoChave;

        const avaliacaoBruta = texto(
          "tipodeavaliacao",
          "avaliacao",
          "avaliacaoparcialfinal",
          "parcialoufinal",
        );
        const tipoAvaliacao = normalizar(avaliacaoBruta).includes("final")
          ? "AVALIAÇÃO FINAL"
          : normalizar(avaliacaoBruta).includes("parcial")
            ? "AVALIAÇÃO PARCIAL"
            : avaliacaoBruta;

        const periodo = resolverPeriodoFormulario(payload,cursoChave);

        const registro = {
          supervisor: supervisorFinal,
          estagiario,
          curso,
          modelo_chave: modeloChave,
          tipo_avaliacao: tipoAvaliacao,
          periodo,
          email_supervisor: texto("emaildosupervisor", "email", "enderecodeemail"),
          origem: "google_forms",
        };

return saveDocument(supabaseAdmin,request,token,"declaracoes-resposta",registro);

}

function comValidacao(handler:(request:Request,admin:FormsAdmin,token:string)=>Promise<Response>){
 return async(request:Request,admin:FormsAdmin,token:string):Promise<Response>=>{
  try{return await handler(request,admin,token);}catch(error){
   if(error instanceof ValidacaoFormularioError)return json({error:error.message},422);
   throw error;
  }
 };
}
export const handleOficios=comValidacao(oficiosInterno);
export const handleDeclaracoes=comValidacao(declaracoesInterno);
export const handleRespostas=comValidacao(respostasInterno);
