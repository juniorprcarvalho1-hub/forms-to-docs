import {expect,test} from "bun:test";
import {limitarImagem,alterarTamanhoImagem} from "./editor-imagem";
test("arraste considera a escala da página e não salta ao clicar",()=>{
 expect(limitarImagem({x:100,y:800,width:200,height:80},80,40,.5,{width:794,height:1120})).toEqual({x:260,y:880,width:200,height:80});
});
test("limites preservam a imagem dentro da página",()=>{
 expect(limitarImagem({x:100,y:800,width:200,height:80},2000,2000,1,{width:794,height:1120})).toMatchObject({x:594,y:1040});
 expect(limitarImagem({x:10,y:10,width:200,height:80},-1000,-1000,1,{width:794,height:1120})).toMatchObject({x:0,y:0});
});
test("redimensionar mantém proporção e respeita a borda inferior",()=>{
 expect(alterarTamanhoImagem({x:100,y:800,width:200,height:80},400,{width:794,height:1120})).toEqual({x:100,y:800,width:400,height:160});
 expect(alterarTamanhoImagem({x:100,y:1000,width:200,height:80},400,{width:794,height:1120})).toEqual({x:100,y:1000,width:300,height:120});
});
