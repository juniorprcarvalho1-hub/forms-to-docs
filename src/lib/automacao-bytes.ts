/** Codifica bytes sem depender de DOM, Buffer ou bibliotecas de PDF. */
export function bytesBase64(bytes:Uint8Array):string{
 let s="";for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);
}
