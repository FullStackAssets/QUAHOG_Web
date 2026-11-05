import * as THREE from "three";

// Procedural, locally authored textures for one historic hero environment.
// Shared textures, zero external imagery, stable across play sessions.
function tex(canvas: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  return t;
}
function canvas(size: number) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  return {c, ctx: c.getContext("2d")!};
}
export function makeHeritagePavers() {
  const {c,ctx}=canvas(512);
  ctx.fillStyle="#655752";ctx.fillRect(0,0,512,512);
  const base = ["#905b4d", "#9d6956", "#a47a69", "#846455", "#ac7963", "#78594d", "#927260"];
  for(let row=0;row<24;row++) {
    const y=row*22 -2, off=(row%2)*40;
    for(let x=-80+off;x<512;x+=80) {
      let seed=(row*37 + Math.floor(x/10)*71+7291)>>>0;
      ctx.fillStyle=base[seed%base.length];ctx.fillRect(x+2,y+2,76,18);
      ctx.fillStyle="rgba(255,230,209,.12)";ctx.fillRect(x+3,y+3,73,1);
      ctx.fillStyle="rgba(28,21,18,.17)";ctx.fillRect(x+4,y+17,71,2);
      if(seed%6===0){ctx.fillStyle="rgba(27,36,32,.13)";ctx.fillRect(x+31,y+11,18,2);}
    }
  }
  for(let i=0;i<5500;i++){
    const x=(i*173+Math.floor(i/7))%512,y=(i*337+Math.floor(i/13))%512;
    ctx.fillStyle=i%2?"rgba(8,12,14,.08)":"rgba(240,230,213,.09)";
    ctx.fillRect(x,y,2,1);
  }
  const albedo=tex(c);albedo.repeat.set(2.1,1.3);
  const {c:bc,ctx:b}=canvas(512);b.fillStyle="#969696";b.fillRect(0,0,512,512);
  for(let row=0;row<24;row++) for(let x=-80+(row%2)*40;x<512;x+=80) {
    b.fillStyle="#454545";b.fillRect(x,row*22-2,80,2);b.fillRect(x,row*22-2,2,22);
    b.fillStyle="#b4b4b4";b.fillRect(x+2,row*22,75,2);
  }
  const bump=tex(bc,false);bump.repeat.copy(albedo.repeat);
  return {albedo,bump};
}
export function makeLawnMaterial() {
  const {c,ctx}=canvas(256);ctx.fillStyle="#6b7453";ctx.fillRect(0,0,256,256);
  const shades=["#52674b","#6b7b59","#778460","#4d6548","#7a8362"];
  for(let i=0;i<12500;i++) {
    const x=(i*97+((i*i)%113))%256,y=(i*163+(i%79)*3)%256;
    ctx.strokeStyle=shades[i%shades.length];ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(i%5-2),y-1-(i%4));ctx.stroke();
  }
  const grass=tex(c);grass.repeat.set(3,3);return grass;
}
export function makeFlagTexture() {
  const {c,ctx}=canvas(512);
  ctx.fillStyle="#f4f2e8";ctx.fillRect(0,0,512,512);
  const band=512/13;
  for(let i=0;i<13;i+=2){ctx.fillStyle="#b32639";ctx.fillRect(0,i*band,512,band);}
  ctx.fillStyle="#283e68";ctx.fillRect(0,0,512*.4,band*7);
  // Fifty visible stars in staggered 6x5 / 5x4 rows, patterned into a canton.
  ctx.fillStyle="#f8f5ee";
  for(let row=0;row<9;row++)for(let j=0;j<(row%2===0?6:5);j++){
    const count=row%2===0?6:5;
    const x=(j+1)/(count+1)*512*.4,y=(row+.5)/9*band*7;
    ctx.beginPath();for(let t=0;t<10;t++){
      const a=-Math.PI/2+t*Math.PI/5,r=t%2?2.7:5.5;
      if(!t)ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);else ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);
    }ctx.closePath();ctx.fill();
  }
  const flag=tex(c);flag.wrapS=flag.wrapT=THREE.ClampToEdgeWrapping;return flag;
}
export function makeFlagCloth() {
  const g=new THREE.PlaneGeometry(1.85,1.02,14,8);
  const p=g.getAttribute("position");
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i)+.925;
    p.setZ(i, Math.sin(x*5.2)*.065*(x/1.85));
  }
  g.translate(.925,0,0);g.computeVertexNormals();return g;
}
