export class ErroAutomacao extends Error {
 constructor(public readonly codigo:string, public readonly incerto=false){super(codigo);this.name="ErroAutomacao";}
}
