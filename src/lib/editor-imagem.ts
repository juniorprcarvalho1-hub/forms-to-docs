export type CaixaImagem = {x:number;y:number;width:number;height:number};
export type LimitesPagina = {width:number;height:number};
const limitar=(n:number,min:number,max:number)=>Math.min(Math.max(n,min),Math.max(min,max));
export function limitarImagem(caixa:CaixaImagem,dx:number,dy:number,escala:number,limites:LimitesPagina):CaixaImagem {
 const fator=escala>0?escala:1;
 return {...caixa,x:limitar(caixa.x+dx/fator,0,limites.width-caixa.width),y:limitar(caixa.y+dy/fator,0,limites.height-caixa.height)};
}
export function alterarTamanhoImagem(caixa:CaixaImagem,largura:number,limites:LimitesPagina):CaixaImagem {
 const proporcao=caixa.height/Math.max(1,caixa.width);
 const maximo=Math.max(1,Math.min(limites.width-caixa.x,(limites.height-caixa.y)/proporcao));
 const width=limitar(largura,Math.min(20,maximo),maximo);
 return {...caixa,width,height:width*proporcao};
}
export function aplicarCaixaImagem(img:HTMLImageElement,caixa:CaixaImagem) {
 Object.assign(img.style,{position:"absolute",left:caixa.x+"px",top:caixa.y+"px",right:"auto",bottom:"auto",
  width:caixa.width+"px",height:caixa.height+"px",maxWidth:"none",margin:"0",float:"none"});
}
export function prepararImagemLivre(img:HTMLImageElement,area:HTMLElement) {
 const original=img.getBoundingClientRect();
 let pagina=img.closest<HTMLElement>(".preceptoria-a4,[data-editor-pagina]");
 if(!pagina||!area.contains(pagina)) {
  pagina=document.createElement("div");
  pagina.setAttribute("data-editor-pagina","");
  const estilo=getComputedStyle(area);
  pagina.style.position="relative";
  pagina.style.display="flow-root";
  pagina.style.minHeight=Math.max(1,area.clientHeight-parseFloat(estilo.paddingTop)-parseFloat(estilo.paddingBottom))+"px";
  while(area.firstChild)pagina.appendChild(area.firstChild);
  area.appendChild(pagina);
 }
 if(getComputedStyle(pagina).position==="static")pagina.style.position="relative";
 const r=pagina.getBoundingClientRect(),escala=r.width/Math.max(1,pagina.offsetWidth);
 const caixa:CaixaImagem={x:(original.left-r.left)/escala-pagina.clientLeft,y:(original.top-r.top)/escala-pagina.clientTop,
  width:img.offsetWidth||original.width/escala,height:img.offsetHeight||original.height/escala};
 if(img.parentElement!==pagina)pagina.appendChild(img);
 aplicarCaixaImagem(img,caixa);
 return {caixa,escala,limites:{width:pagina.clientWidth,height:pagina.clientHeight}};
}
