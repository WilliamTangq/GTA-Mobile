import * as T from '../vendor/three.module.js';

// Small, deterministic, locally generated textures. No remote image requests.
function canvas(w, h) {
  const c = document.createElement('canvas'); c.width=w;c.height=h;
  return [c,c.getContext('2d')];
}
function texture(c, repeat=1) {
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;
  t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=2;
  return t;
}
export function createSurfaceTextures() {
  let seed=1947;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const noise=(base,amount,count)=>{
    const [c,ctx]=canvas(256,256);ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
    for(let i=0;i<count;i++) {
      const v=Math.floor(95+random()*110);ctx.fillStyle=`rgba(${v},${v},${v},${amount})`;
      const s=1+random()*2;ctx.fillRect(random()*256,random()*256,s,s);
    }
    return [c,ctx];
  };
  const [asphalt,a]=noise('#7b7e80',.45,15000);
  a.strokeStyle='#54585c';a.lineWidth=.5;
  for(let i=0;i<8;i++) {const x=random()*256,y=random()*256;a.beginPath();a.moveTo(x,y);a.lineTo(x+15,y+35);a.lineTo(x+8,y+60);a.stroke();}
  const [concrete,c]=noise('#eee9df',.12,7000);
  c.fillStyle='#aba39420';for(let i=0;i<14;i++) c.fillRect(random()*256,random()*256,2,25+random()*80);
  const [glass,g]=canvas(256,64);
  const grad=g.createLinearGradient(0,0,100,64);grad.addColorStop(0,'#91b3c1');grad.addColorStop(.45,'#354959');grad.addColorStop(1,'#172933');g.fillStyle=grad;g.fillRect(0,0,256,64);
  for(let i=0;i<4;i++) {g.fillStyle='#101e28';g.fillRect(i*64,0,4,64);g.fillRect(0,60,256,4);g.fillStyle='#d1e5e528';g.beginPath();g.moveTo(i*64+9,0);g.lineTo(i*64+30,0);g.lineTo(i*64+57,60);g.lineTo(i*64+36,60);g.fill();}
  const [shadow,s]=canvas(128,128),radial=s.createRadialGradient(64,64,8,64,64,64);
  radial.addColorStop(0,'rgba(5,11,18,.65)');radial.addColorStop(.55,'rgba(5,11,18,.35)');radial.addColorStop(1,'rgba(5,11,18,0)');s.fillStyle=radial;s.fillRect(0,0,128,128);
  const road=texture(asphalt);road.repeat.set(6,48);
  const wall=texture(concrete);wall.repeat.set(2,4);
  const normalPixels=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++) for(let x=0;x<128;x++) {
    const i=(y*128+x)*4;
    normalPixels[i]=128+Math.round(24*Math.sin(x*Math.PI/16+y*Math.PI/32));
    normalPixels[i+1]=128+Math.round(20*Math.cos(y*Math.PI/16-x*Math.PI/32));
    normalPixels[i+2]=250;normalPixels[i+3]=255;
  }
  const waterNormal=new T.DataTexture(normalPixels,128,128);waterNormal.wrapS=waterNormal.wrapT=T.RepeatWrapping;waterNormal.repeat.set(90,90);waterNormal.needsUpdate=true;
  return {asphalt:road,concrete:wall,glass:texture(glass),shadow:texture(shadow),waterNormal};
}
const PALETTES={
  sunset:['#386e9c','#b8c7ce','#f1c6a3','#b4b5b3'],
  day:['#2676ae','#91c8e6','#d7e7e6','#96aeb2'],
  night:['#071324','#18314d','#53627b','#192b3b'],
};
export function createAtmosphere(scene, renderer) {
  const [sky,ctx]=canvas(256,512),map=texture(sky);
  const dome=new T.Mesh(new T.SphereGeometry(1800,24,12),new T.MeshBasicMaterial({map,side:T.BackSide,depthWrite:false,fog:false}));
  dome.renderOrder=-1000;dome.userData.gpuOnly=true;scene.add(dome);
  let environment;
  function setTime(time) {
    const p=PALETTES[time]||PALETTES.sunset;
    const gradient=ctx.createLinearGradient(0,0,0,512);
    gradient.addColorStop(0,p[0]);gradient.addColorStop(.42,p[1]);gradient.addColorStop(.51,p[2]);gradient.addColorStop(.65,p[3]);gradient.addColorStop(1,p[3]);ctx.fillStyle=gradient;ctx.fillRect(0,0,256,512);map.needsUpdate=true;
    scene.userData.skyColors=p;
    if(!renderer.isSoftwareRenderer) {
      // Cube reflections are generated once per lighting change, never per frame.
      const images=Array.from({length:6},(_,i)=>{
        const [c,g]=canvas(64,64),gr=g.createLinearGradient(0,0,0,64);
        gr.addColorStop(0,i===3?p[3]:p[0]);gr.addColorStop(.65,p[2]);gr.addColorStop(1,p[3]);g.fillStyle=gr;g.fillRect(0,0,64,64);
        if(i!==2 && i!==3){g.fillStyle='#344450';for(let n=0;n<7;n++)g.fillRect(n*10,40+(n%3)*4,7,24);}
        return c;
      });
      const cube=new T.CubeTexture(images);cube.colorSpace=T.SRGBColorSpace;cube.needsUpdate=true;
      const pmrem=new T.PMREMGenerator(renderer),next=pmrem.fromCubemap(cube);
      scene.environment=next.texture;environment?.dispose();environment=next;cube.dispose();pmrem.dispose();
      scene.environmentIntensity=time==='night'?.35:.65;
    }
  }
  setTime('sunset');
  return {setTime,update(player){dome.position.set(player.x,0,player.z);}};
}
