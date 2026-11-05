import * as THREE from "three";

// Shared 256px original road-detail art: richer close-up iron and repaired
// asphalt at the same 3 instanced draw calls as the prior flat color decals.
function create(draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");canvas.width=canvas.height=256;
  const c=canvas.getContext("2d")!;draw(c);
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;
  return tex;
}
export function makeStreetFixtureMaps() {
  const manhole=create(c=>{
    c.fillStyle="#343b3d";c.fillRect(0,0,256,256);
    const grd=c.createRadialGradient(128,120,16,128,128,128);
    grd.addColorStop(0,"#7f8582");grd.addColorStop(.6,"#4b5355");grd.addColorStop(1,"#22292b");
    c.fillStyle=grd;c.beginPath();c.arc(128,128,127,0,Math.PI*2);c.fill();
    for(const [r,w,col] of [[116,7,"#1e292d"],[102,4,"#939996"],[88,3,"#283035"],[58,3,"#697478"]] as const){
      c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.arc(128,128,r,0,Math.PI*2);c.stroke();
    }
    c.fillStyle="#4b5558";for(let a=0;a<Math.PI*2;a+=Math.PI/8){
      const x=128+111*Math.cos(a),y=128+111*Math.sin(a);
      c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();
    }
    c.fillStyle="#202b2e";c.textAlign="center";c.font="bold 21px sans-serif";c.fillText("WATER",128,135);
    for(let i=0;i<2800;i++){const x=(i*131)%256,y=(i*79+i%17)%256;
      c.fillStyle=i%3?"rgba(13,20,21,.12)":"rgba(223,226,212,.09)";c.fillRect(x,y,2,1);}
  });
  const grate=create(c=>{
    c.fillStyle="#32393b";c.fillRect(0,0,256,256);
    c.fillStyle="#737e7e";c.fillRect(8,8,240,240);
    c.fillStyle="#161b20";c.fillRect(16,16,224,224);
    for(let x=24;x<236;x+=20){c.fillStyle="#171e23";c.fillRect(x,20,12,216);
      c.fillStyle="#747c7a";c.fillRect(x,20,3,216);c.fillStyle="#394448";c.fillRect(x+13,20,3,216);}
    c.fillStyle="#6b7472";c.fillRect(13,15,11,228);c.fillRect(232,15,11,228);
    c.fillStyle="rgba(38,27,20,.24)";for(let i=0;i<100;i++){c.fillRect((i*67)%256,(i*137)%256,5,2);}
  });
  const patch=create(c=>{
    c.fillStyle="#5a5e60";c.fillRect(0,0,256,256);
    for(let i=0;i<4200;i++){
      const x=(i*147+Math.floor(i/23))%256,y=(i*73+Math.floor(i/9))%256;
      c.fillStyle=i%2?"rgba(208,212,206,.08)":"rgba(10,14,18,.16)";
      c.fillRect(x,y,1+(i%3),1+(i%2));
    }
    // Repairs tend to have a soft tar seam rather than a solid light rectangle.
    for(let k=0;k<7;k++){
      c.strokeStyle=`rgba(22,25,26,${.28-k*.034})`;c.lineWidth=1.5;
      c.strokeRect(k,k,255-2*k,255-2*k);
    }
  });
  return {manhole,grate,patch};
}
