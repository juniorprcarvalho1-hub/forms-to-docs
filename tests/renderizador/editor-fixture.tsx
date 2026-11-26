import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {RichEditor} from "../../src/components/RichEditor";
const inicial='<style>.pagina-a4:has(.preceptoria-a4){padding:0!important}</style><div class="preceptoria-a4" style="position:relative;width:794px;height:1120px"><p style="position:absolute;top:120px;left:80px">Modelo de teste com {{nome}}.</p><img alt="Imagem de teste" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=" style="position:absolute;left:100px;top:800px;width:200px;height:80px;background:#d8a36a;object-fit:none"></div>';
function App(){
 const [value,setValue]=useState(inicial),[key,setKey]=useState(0),[disabled,setDisabled]=useState(false);
 return <><h1>Editor de modelos</h1><div><button id="reabrir" onClick={()=>setKey(key+1)}>Salvar e reabrir</button><button id="bloquear" onClick={()=>setDisabled(!disabled)}>Alternar bloqueio</button></div>
 <RichEditor key={key} value={value} onChange={setValue} minHeight={1123} campos={["{{nome}}"]} disabled={disabled}/>
 <textarea id="html-salvo" readOnly value={value} style={{display:"none"}} /></>;
}createRoot(document.getElementById("root")!).render(<App/>);


