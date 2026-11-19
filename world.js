/* Aether Crucible: open world (free roam) for The Unmarked.
   Loaded after the main game script and uses its globals (T, buildRig, mkFighter, animate, umSV ...). */
(()=>{
'use strict';
const W={on:false};window.ROAM=W;
const TAU=Math.PI*2,HALF=900,WATER=-6;
const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

/* ---------------- noise + terrain ---------------- */
function hash(i,j){let h=(Math.imul(i,374761393)+Math.imul(j,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295}
function vn(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1}
function baseH(x,z){let h=6.5+16*vn(x*.0017+11,z*.0017-5)+6*vn(x*.006+3,z*.006+9)+1.4*vn(x*.025,z*.025);const e=Math.max(Math.abs(x),Math.abs(z));if(e>HALF-220)h+=Math.pow((e-(HALF-220))/220,2)*90;return h}
const TOWNS=[
  {id:'hollow',name:'Hollowbrook Village',x:-520,z:360,r:75},
  {id:'ashford',name:'Ashford Market Town',x:540,z:-380,r:105}];
TOWNS.forEach(t=>t.h=Math.max(baseH(t.x,t.z),WATER+5));
function townFlat(x,z,h){for(const t of TOWNS){const d=Math.hypot(x-t.x,z-t.z);const k=sm(t.r+60,t.r,d);if(k>0)h=lerp(h,t.h,k)}return h}
// roads (polylines, densified)
const ROAD_DEFS=[
  {id:'main',name:'Kingsway Road',w:7.5,pts:[[-520,360],[-470,345],[-410,320],[-340,262],[-262,205],[-180,150],[-110,96],[-30,40],[60,-10],[150,-70],[250,-150],[345,-235],[430,-305],[500,-355],[540,-380]]},
  {id:'canyon',name:'Ember Road',w:6.5,pts:[[-180,150],[-170,40],[-150,-80],[-120,-200],[-90,-330],[-60,-470],[-40,-560]]},
  {id:'lake',name:'Lakeside Lane',w:5.5,pts:[[-520,360],[-560,420],[-630,470],[-700,505]]}];
// the Silverrun river
const RIVER=[[-900,-260],[-640,-180],[-420,-90],[-230,0],[-60,60],[90,160],[260,300],[480,420],[700,500],[900,560]];
function densify(pts,step){const c=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(p[0],0,p[1])),false,'catmullrom',.5);const n=Math.max(2,Math.round(c.getLength()/step));return c.getSpacedPoints(n).map(v=>({x:v.x,z:v.z}))}
const GRID=40,gkey=(i,j)=>i+','+j;
function mkIndex(samples){const g=new Map();samples.forEach((s,i)=>{const k=gkey(Math.floor(s.x/GRID),Math.floor(s.z/GRID));(g.get(k)||g.set(k,[]).get(k)).push(i)});return g}
function nearest(samples,idx,x,z){const ci=Math.floor(x/GRID),cj=Math.floor(z/GRID);let best=1e9,bi=-1,bt=0;
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=idx.get(gkey(ci+a,cj+b));if(!L)continue;for(const i of L){const p=samples[i],q=samples[Math.min(i+1,samples.length-1)];const dx=q.x-p.x,dz=q.z-p.z,l2=dx*dx+dz*dz||1;let t=((x-p.x)*dx+(z-p.z)*dz)/l2;t=clamp(t,0,1);const d=Math.hypot(x-(p.x+dx*t),z-(p.z+dz*t));if(d<best){best=d;bi=i;bt=t}}}
  return {d:best,i:bi,t:bt}}
const riverS=densify(RIVER,6),riverI=mkIndex(riverS);
const LAKE={x:-760,z:560,r:70};// Lake Mere, at the end of Lakeside Lane
const ROADS=ROAD_DEFS.map(r=>{const S=densify(r.pts,4);S.forEach(s=>s.h=Math.max(WATER+3.4,townFlat(s.x,s.z,baseH(s.x,s.z))));
  for(let pass=0;pass<3;pass++){const H=S.map(s=>s.h);S.forEach((s,i)=>{let a=0,n=0;for(let k=-8;k<=8;k++){const j=i+k;if(j>=0&&j<S.length){a+=H[j];n++}}s.h=Math.max(WATER+3.2,a/n)})}
  return Object.assign({},r,{S,I:mkIndex(S)})});
function roadAt(x,z){let best=null;for(const r of ROADS){const q=nearest(r.S,r.I,x,z);if(q.i<0)continue;if(!best||q.d-r.w/2<best.d-best.r.w/2){const p=r.S[q.i],nx=r.S[Math.min(q.i+1,r.S.length-1)];best={d:q.d,r,h:lerp(p.h,nx.h,q.t),bridge:p.bridge||nx.bridge,i:q.i}}}return best}
function terrainH(x,z){let h=townFlat(x,z,baseH(x,z));const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+8){const k=sm(rd.r.w/2+8,rd.r.w/2+.5,rd.d);h=lerp(h,rd.h-.12,k)}
  const rv=nearest(riverS,riverI,x,z);if(rv.d<26){const k=sm(26,7,rv.d);h=lerp(h,Math.min(h,WATER-2.6),k)}
  const ld=Math.hypot(x-LAKE.x,z-LAKE.z);if(ld<LAKE.r+30){const k=sm(LAKE.r+30,LAKE.r,ld);h=lerp(h,Math.min(h,WATER-3.5),k)}return h}
// bridges: road samples that sit well above the carved ground
ROADS.forEach(r=>{r.S.forEach((s,i)=>{const g=terrainH(s.x,s.z);if(g<s.h-1.2){s.bridge=true;s.h=Math.max(s.h,WATER+2.4)}
  else{const q=r.S[Math.min(i+1,r.S.length-1)],o=r.S[Math.max(i-1,0)];let dx=q.x-o.x,dz=q.z-o.z;const l=Math.hypot(dx,dz)||1;const nx=-dz/l*(r.w/2+4),nz=dx/l*(r.w/2+4);if(Math.min(terrainH(s.x+nx,s.z+nz),terrainH(s.x-nx,s.z-nz))<WATER+.4){s.bridge=true;s.causeway=true}}})});
let FLAT=false;W.setFlat=v=>{FLAT=v};// test-only: a flat, empty world for measuring car physics
function groundAt(x,z){if(FLAT)return 10;const g=terrainH(x,z),rd=roadAt(x,z);if(rd&&rd.bridge&&rd.d<rd.r.w/2+.4)return Math.max(g,rd.h+.05);return g}
W.groundAt=groundAt;

/* ---------------- scene ---------------- */
let scene,camera,sun,hemi,skyMat,built=false;
const solids=[];// {type:'box',x,z,hw,hd,yaw} | {type:'c',x,z,r}
const SG=new Map(),SC=24;
function addSolid(o){o.id=solids.length;solids.push(o);const r=o.type==='c'?o.r:Math.hypot(o.hw,o.hd);for(let i=Math.floor((o.x-r)/SC);i<=Math.floor((o.x+r)/SC);i++)for(let j=Math.floor((o.z-r)/SC);j<=Math.floor((o.z+r)/SC);j++){const k=gkey(i,j);(SG.get(k)||SG.set(k,[]).get(k)).push(o)}}
function solidsNear(x,z){const L=SG.get(gkey(Math.floor(x/SC),Math.floor(z/SC)));return L||[]}
// push a circle (x,z,r) out of static solids; returns collision normal or null
function collide(p,r){if(FLAT)return null;let hit=null;const seen=new Set();for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=SG.get(gkey(Math.floor(p.x/SC)+a,Math.floor(p.z/SC)+b));if(!L)continue;for(const o of L){if(seen.has(o.id))continue;seen.add(o.id);
    if(o.type==='c'){const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz),m=r+o.r;if(d<m&&d>1e-4){p.x=o.x+dx/d*m;p.z=o.z+dz/d*m;hit={x:dx/d,z:dz/d,o}}}
    else{const c=Math.cos(o.yaw),s=Math.sin(o.yaw),lx=(p.x-o.x)*c-(p.z-o.z)*s,lz=(p.x-o.x)*s+(p.z-o.z)*c;const qx=clamp(lx,-o.hw,o.hw),qz=clamp(lz,-o.hd,o.hd);let dx=lx-qx,dz=lz-qz,d=Math.hypot(dx,dz);
      if(d<r){if(d<1e-4){const ex=o.hw-Math.abs(lx),ez=o.hd-Math.abs(lz);if(ex<ez){dx=Math.sign(lx)||1;dz=0}else{dx=0;dz=Math.sign(lz)||1}d=0}else{dx/=d;dz/=d}
        const push=r-d,nlx=lx+dx*push,nlz=lz+dz*push;p.x=o.x+nlx*c+nlz*s;p.z=o.z-nlx*s+nlz*c;hit={x:dx*c+dz*s,z:-dx*s+dz*c,o}}}}}
  const e=Math.max(Math.abs(p.x),Math.abs(p.z));if(e>HALF-40){const k=(HALF-40)/e;p.x*=k;p.z*=k;hit=hit||{x:-Math.sign(p.x),z:-Math.sign(p.z)}}
  return hit}
const MC={};function mat(c,o){const k=c+(o?JSON.stringify(o):'');return MC[k]||(MC[k]=new T.MeshToonMaterial(Object.assign({color:c,gradientMap:grad},o||{})))}
function glow(c){const k='g'+c;return MC[k]||(MC[k]=new T.MeshBasicMaterial({color:c}))}
function mesh(g,m,x,y,z,ry,par){const o=new T.Mesh(g,m);o.position.set(x,y,z);if(ry)o.rotation.y=ry;o.castShadow=true;o.receiveShadow=true;(par||scene).add(o);return o}
function signTex(text,bg,fg,w,h){const cv=document.createElement('canvas');cv.width=w||512;cv.height=h||128;const x=cv.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,cv.width,cv.height);x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=10;x.strokeRect(5,5,cv.width-10,cv.height-10);x.fillStyle=fg;x.font=`700 ${Math.round(cv.height*.42)}px Georgia,serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,cv.width/2,cv.height/2+4);const t=new T.CanvasTexture(cv);t.anisotropy=4;return t}

function buildTerrain(){const N=240,S=HALF*2,g=new T.PlaneGeometry(S,S,N,N);g.rotateX(-Math.PI/2);const p=g.attributes.position,col=new Float32Array(p.count*3),c=new T.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=terrainH(x,z);p.setY(i,h);const n=vn(x*.05,z*.05)*.5+.5,rd=roadAt(x,z),rv=nearest(riverS,riverI,x,z).d;
    if(h<WATER+1.2)c.set('#a8986e');else if(rd&&rd.d<rd.r.w/2+2.5)c.set('#7a6a4c');else if(h>32)c.set('#7b7a75').lerp(new T.Color('#e8e8e8'),sm(48,70,h));else{c.set('#3f6f30').lerp(new T.Color('#6a9040'),n);c.lerp(new T.Color('#5a7a34'),vn(x*.15,z*.15)*.25+.1);if(rv<34)c.lerp(new T.Color('#3f7a3a'),.4);for(const t of TOWNS){const d=Math.hypot(x-t.x,z-t.z);if(d<t.r)c.lerp(new T.Color('#7f9050'),.3)}}
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
  g.setAttribute('color',new T.BufferAttribute(col,3));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshLambertMaterial({vertexColors:true}));m.receiveShadow=true;scene.add(m);
  // water
  const wm=new T.Mesh(new T.PlaneGeometry(S,S),new T.MeshPhongMaterial({color:'#3d7fb0',transparent:true,opacity:.82,shininess:90,specular:'#cfe9ff'}));wm.rotation.x=-Math.PI/2;wm.position.y=WATER;scene.add(wm);W.water=wm}
function buildRoads(){ROADS.forEach(r=>{const S=r.S,n=S.length,pos=[],uv=[],idx=[];
  for(let i=0;i<n;i++){const p=S[i],q=S[Math.min(i+1,n-1)],o=S[Math.max(i-1,0)];let dx=q.x-o.x,dz=q.z-o.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const nx=-dz*r.w/2,nz=dx*r.w/2;
    pos.push(p.x+nx,p.h+.06,p.z+nz,p.x-nx,p.h+.06,p.z-nz);uv.push(0,i*.5,1,i*.5);if(i<n-1)idx.push(i*2,i*2+2,i*2+1,i*2+1,i*2+2,i*2+3)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const cv=document.createElement('canvas');cv.width=64;cv.height=128;const x=cv.getContext('2d');x.fillStyle='#4a4a4f';x.fillRect(0,0,64,128);for(let k=0;k<300;k++){x.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},.05)`;x.fillRect(Math.random()*64,Math.random()*128,2,2)}
  x.fillStyle='#d8c9a0';x.fillRect(2,0,3,128);x.fillRect(59,0,3,128);if(r.id==='main'){x.fillStyle='#e8d26a';x.fillRect(30,10,4,50)}const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;
  const m=new T.Mesh(g,new T.MeshLambertMaterial({map:t,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.receiveShadow=true;scene.add(m);
  // bridges: deck sides, rails and pillars
  for(let i=0;i<n-1;i++){if(!S[i].bridge)continue;const p=S[i],q=S[i+1],yaw=Math.atan2(q.x-p.x,q.z-p.z),mx=(p.x+q.x)/2,mz=(p.z+q.z)/2,my=(p.h+q.h)/2,len=Math.hypot(q.x-p.x,q.z-p.z)+.05;
    if(!S[i].causeway)mesh(new T.BoxGeometry(r.w+1.2,.6,len),mat('#8a8278'),mx,my-.34,mz,yaw);
    [-1,1].forEach(sd=>{const ox=Math.cos(yaw)*sd*(r.w/2+.45),oz=-Math.sin(yaw)*sd*(r.w/2+.45);mesh(new T.BoxGeometry(.25,.9,len),mat('#a49c90'),mx+ox,my+.45,mz+oz,yaw);addSolid({type:'box',x:mx+ox,z:mz+oz,hw:.2,hd:len/2,yaw})});
    if(i%4===0&&!S[i].causeway){const ph=my-WATER+3;mesh(new T.BoxGeometry(r.w*.8,ph,1.2),mat('#7a7268'),mx,my-ph/2,mz,yaw)}}
  // roadside posts every 40 m
  for(let i=0;i<n;i+=10){const p=S[i],q=S[Math.min(i+1,n-1)];if(p.bridge)continue;const yaw=Math.atan2(q.x-p.x,q.z-p.z);const ox=Math.cos(yaw)*(r.w/2+1.2),oz=-Math.sin(yaw)*(r.w/2+1.2);if(TOWNS.some(t=>Math.hypot(p.x-t.x,p.z-t.z)<t.r))continue;
    const g2=terrainH(p.x+ox,p.z+oz);mesh(new T.BoxGeometry(.18,.9,.18),mat('#f2efe6'),p.x+ox,g2+.45,p.z+oz,yaw);mesh(new T.BoxGeometry(.2,.12,.05),glow('#ff9a3d'),p.x+ox,g2+.8,p.z+oz,yaw)}})}
function signpost(x,z,yaw,lines){const g=new T.Group();g.position.set(x,groundAt(x,z),z);g.rotation.y=yaw;scene.add(g);mesh(new T.CylinderGeometry(.08,.1,3,8),mat('#6b4a2e'),0,1.5,0,0,g);
  lines.forEach((ln,i)=>{const b=mesh(new T.BoxGeometry(1.9,.42,.06),new T.MeshLambertMaterial({map:signTex(ln[0],'#7a5a36','#f4ead2',512,112)}),ln[1]*.75,2.5-i*.55,0,0,g);b.rotation.y=ln[1]<0?Math.PI:0});addSolid({type:'c',x,z,r:.2})}

/* ---------------- props & buildings ---------------- */
const RG={};
// gable roof: a triangular profile across the depth, extruded along the width, with a little overhang
function roofGeo(d,h,l){const k=[d,h,l].map(v=>v.toFixed(2)).join('_');if(RG[k])return RG[k];const p=new T.Shape();p.moveTo(-d/2,0);p.lineTo(d/2,0);p.lineTo(0,h);p.closePath();
  const g=new T.ExtrudeGeometry(p,{depth:l,bevelEnabled:false});g.translate(0,0,-l/2);g.rotateY(Math.PI/2);g.computeVertexNormals();return RG[k]=g}
function gableGeo(d,h){const k='gb'+d.toFixed(2)+'_'+h.toFixed(2);if(RG[k])return RG[k];const p=new T.Shape();p.moveTo(-d/2,0);p.lineTo(d/2,0);p.lineTo(0,h);p.closePath();const g=new T.ShapeGeometry(p);g.rotateY(Math.PI/2);return RG[k]=g}
function house(x,z,yaw,o){o=Object.assign({w:8,d:7,fl:1,wall:'#e8dcc4',roof:'#8a3a2a',trim:'#6b4a2e',door:'#5a3a22',sign:null,signBg:'#2f4f3a'},o);const g=new T.Group(),y=groundAt(x,z);g.position.set(x,y,z);g.rotation.y=yaw;scene.add(g);
  const H=3.1*o.fl;mesh(new T.BoxGeometry(o.w+.3,.5,o.d+.3),mat('#7a7068'),0,.15,0,0,g);mesh(new T.BoxGeometry(o.w,H,o.d),mat(o.wall),0,H/2+.3,0,0,g);
  [-1,1].forEach(q=>{mesh(new T.BoxGeometry(.25,H,.25),mat(o.trim),q*(o.w/2-.05),H/2+.3,o.d/2-.05,0,g);mesh(new T.BoxGeometry(.25,H,.25),mat(o.trim),q*(o.w/2-.05),H/2+.3,-o.d/2+.05,0,g)});
  for(let f=0;f<o.fl;f++)mesh(new T.BoxGeometry(o.w+.06,.22,o.d+.06),mat(o.trim),0,.3+3.1*(f+1)-.1,0,0,g);
  const rh=o.d*.42,rd=o.d+1,rl=o.w+.9;mesh(roofGeo(rd,rh,rl),mat(o.roof),0,H+.3,0,0,g);mesh(gableGeo(o.d,rh*.92),mat(o.wall),o.w/2-.02,H+.3,0,0,g);mesh(gableGeo(o.d,rh*.92),mat(o.wall),-o.w/2+.02,H+.3,0,Math.PI,g);
  mesh(new T.BoxGeometry(.7,1.6,.7),mat('#8a7a6a'),o.w*.28,H+o.d*.42+.3,-o.d*.1,0,g);
  mesh(new T.BoxGeometry(1.2,2.1,.12),mat(o.door),0,1.35,o.d/2+.02,0,g);mesh(new T.BoxGeometry(.08,.08,.08),glow('#f2d27a'),.4,1.35,o.d/2+.1,0,g);
  const win=(wx,wy,wz,ry)=>{const w2=new T.Group();w2.position.set(wx,wy,wz);w2.rotation.y=ry;g.add(w2);mesh(new T.BoxGeometry(1.1,1.1,.08),new T.MeshLambertMaterial({color:'#9fc4dd',emissive:'#2a3a44'}),0,0,0,0,w2);mesh(new T.BoxGeometry(1.3,.12,.16),mat(o.trim),0,-.6,.04,0,w2);mesh(new T.BoxGeometry(.06,1.1,.1),mat(o.trim),0,0,.04,0,w2);mesh(new T.BoxGeometry(1.1,.06,.1),mat(o.trim),0,0,.04,0,w2)};
  for(let f=0;f<o.fl;f++){const wy=1.9+3.1*f;[-1,1].forEach(q=>{if(f>0||Math.abs(q*o.w*.3)>1.2)win(q*o.w*.3,wy,o.d/2+.02,0);win(q*o.w*.3,wy,-o.d/2-.02,Math.PI)});win(o.w/2+.02,wy,0,Math.PI/2);win(-o.w/2-.02,wy,0,-Math.PI/2)}
  if(o.sign){const s=mesh(new T.BoxGeometry(Math.min(o.w-.6,5.2),.9,.1),new T.MeshLambertMaterial({map:signTex(o.sign,o.signBg,'#f8f0dc',640,112)}),0,2.95,o.d/2+.1,0,g);s.castShadow=false}
  addSolid({type:'box',x,z,hw:o.w/2+.15,hd:o.d/2+.15,yaw});return g}
function lamp(x,z){const y=groundAt(x,z);mesh(new T.CylinderGeometry(.07,.1,3.6,8),mat('#2a2a30'),x,y+1.8,z);mesh(new T.BoxGeometry(.32,.4,.32),glow('#ffe2a0'),x,y+3.7,z);mesh(new T.ConeGeometry(.3,.25,4),mat('#2a2a30'),x,y+4,z,Math.PI/4);addSolid({type:'c',x,z,r:.15})}
function fence(x1,z1,x2,z2){const L=Math.hypot(x2-x1,z2-z1),n=Math.ceil(L/2.2),yaw=Math.atan2(x2-x1,z2-z1);for(let i=0;i<=n;i++){const x=lerp(x1,x2,i/n),z=lerp(z1,z2,i/n);mesh(new T.BoxGeometry(.14,1.1,.14),mat('#8a6a44'),x,groundAt(x,z)+.55,z)}
  for(let i=0;i<n;i++){const xa=lerp(x1,x2,(i+.5)/n),za=lerp(z1,z2,(i+.5)/n),y=groundAt(xa,za);[.45,.85].forEach(h=>mesh(new T.BoxGeometry(.06,.1,L/n),mat('#9a7a50'),xa,y+h,za,yaw))}
  addSolid({type:'box',x:(x1+x2)/2,z:(z1+z2)/2,hw:.12,hd:L/2,yaw})}
function crate(x,z,s){const y=groundAt(x,z);mesh(new T.BoxGeometry(s,s,s),mat('#a07a48'),x,y+s/2,z,rand(0,1));addSolid({type:'c',x,z,r:s*.6})}
function barrel(x,z){const y=groundAt(x,z);mesh(new T.CylinderGeometry(.4,.4,1,12),mat('#7a4a2a'),x,y+.5,z);mesh(new T.TorusGeometry(.41,.03,4,16),mat('#3a3a40'),x,y+.25,z).rotation.x=Math.PI/2;mesh(new T.TorusGeometry(.41,.03,4,16),mat('#3a3a40'),x,y+.75,z).rotation.x=Math.PI/2;addSolid({type:'c',x,z,r:.45})}
function stall(x,z,yaw,c){const g=new T.Group();g.position.set(x,groundAt(x,z),z);g.rotation.y=yaw;scene.add(g);[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>mesh(new T.BoxGeometry(.12,2.4,.12),mat('#6b4a2e'),a*1.4,1.2,b*.9,0,g));mesh(new T.BoxGeometry(3,.9,1.6),mat('#8a6a44'),0,.45,.2,0,g);
  const cv=mesh(new T.BoxGeometry(3.3,.1,2.2),mat(c),0,2.45,0,0,g);cv.rotation.x=-.12;for(let i=0;i<5;i++)mesh(new T.SphereGeometry(.16,8,6),mat(['#e04a3a','#f2c14e','#7fd65a','#ff9a3d','#c9b3ff'][i]),-1+i*.5,1,.4,0,g);addSolid({type:'box',x,z,hw:1.6,hd:1.1,yaw})}
function well(x,z){const y=groundAt(x,z);mesh(new T.CylinderGeometry(1.1,1.2,1,16,1,true),mat('#8a8278',{side:T.DoubleSide}),x,y+.5,z);mesh(new T.CylinderGeometry(1,1,.1,16),new T.MeshLambertMaterial({color:'#2f5f80'}),x,y+.6,z);[-1,1].forEach(q=>mesh(new T.BoxGeometry(.14,2.2,.14),mat('#6b4a2e'),x+q*1,y+1.1,z));const r=mesh(new T.CylinderGeometry(1,1,1,3,1),mat('#8a3a2a'),x,y+2.5,z);r.rotation.set(Math.PI/2,0,Math.PI/2);r.scale.set(.7,2.6,.9);addSolid({type:'c',x,z,r:1.3})}
function fountain(x,z){const y=groundAt(x,z);mesh(new T.CylinderGeometry(4,4.3,.8,28),mat('#b7ae9f'),x,y+.4,z);mesh(new T.CylinderGeometry(3.6,3.6,.1,28),new T.MeshPhongMaterial({color:'#4f9fd0',shininess:80}),x,y+.75,z);mesh(new T.CylinderGeometry(.5,.7,2.2,12),mat('#a49c90'),x,y+1.5,z);mesh(new T.CylinderGeometry(1.4,1.2,.3,18),mat('#b7ae9f'),x,y+2.5,z);W.fountain={x,y:y+2.7,z};addSolid({type:'c',x,z,r:4.3})}
function pump(x,z,yaw){const g=new T.Group();g.position.set(x,groundAt(x,z),z);g.rotation.y=yaw;scene.add(g);mesh(new T.BoxGeometry(.8,1.7,.6),mat('#c8442a'),0,.85,0,0,g);mesh(new T.BoxGeometry(.6,.5,.1),glow('#f4f0e0'),0,1.3,.31,0,g);mesh(new T.CylinderGeometry(.04,.04,.8,6),mat('#222'),.45,.9,0,0,g);addSolid({type:'c',x,z,r:.5})}
function training(x,z){fence(x-9,z-9,x+9,z-9);fence(x+9,z-9,x+9,z+9);fence(x-9,z+9,x-3,z+9);fence(x+3,z+9,x+9,z+9);fence(x-9,z-9,x-9,z+9);
  for(let i=0;i<3;i++){const dx=x-4+i*4,dz=z-5,y=groundAt(dx,dz);mesh(new T.CylinderGeometry(.12,.12,1.6,8),mat('#6b4a2e'),dx,y+.8,dz);mesh(new T.CylinderGeometry(.35,.35,.9,10),mat('#c9a868'),dx,y+1.35,dz);mesh(new T.SphereGeometry(.28,10,8),mat('#c9a868'),dx,y+2.05,dz);addSolid({type:'c',x:dx,z:dz,r:.4})}}
function trees(){const N=2600,trunkG=new T.CylinderGeometry(.18,.28,2.6,6),pineG=new T.ConeGeometry(1.6,4.6,7),roundG=new T.IcosahedronGeometry(2.1,1);
  const trunk=new T.InstancedMesh(trunkG,mat('#6b4a2e'),N),pine=new T.InstancedMesh(pineG,mat('#2f6a3a'),N),round=new T.InstancedMesh(roundG,mat('#4f8a3a'),N);[trunk,pine,round].forEach(m=>{m.castShadow=true;m.receiveShadow=true;scene.add(m)});
  const o=new T.Object3D();let nt=0,np=0,nr=0,tries=0;while(nt<N&&tries<N*12){tries++;const x=rand(-HALF+60,HALF-60),z=rand(-HALF+60,HALF-60);const forest=vn(x*.004+40,z*.004-12);if(forest<-.05&&Math.random()>.12)continue;
    const h=terrainH(x,z);if(h<WATER+1.5||h>44)continue;if(TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+18))continue;const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+6)continue;
    const s=rand(.75,1.35),isPine=vn(x*.01,z*.01)>-.1;o.position.set(x,h+1.3*s,z);o.rotation.set(0,rand(0,TAU),0);o.scale.set(s,s,s);o.updateMatrix();trunk.setMatrixAt(nt++,o.matrix);
    if(isPine){o.position.y=h+(2.6+2)*s;o.updateMatrix();pine.setMatrixAt(np++,o.matrix)}else{o.position.y=h+(2.6+1.4)*s;o.scale.set(s,s*.85,s);o.updateMatrix();round.setMatrixAt(nr++,o.matrix)}addSolid({type:'c',x,z,r:.35*s})}
  trunk.count=nt;pine.count=np;round.count=nr;
  const rk=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),mat('#8a8780'),400);let nk=0;for(let i=0;i<1600&&nk<400;i++){const x=rand(-HALF+40,HALF-40),z=rand(-HALF+40,HALF-40),h=terrainH(x,z);if(h<WATER+.5||TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+10))continue;const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+3)continue;const s=rand(.4,1.6);o.position.set(x,h+s*.3,z);o.rotation.set(rand(0,3),rand(0,3),rand(0,3));o.scale.set(s,s*.7,s);o.updateMatrix();rk.setMatrixAt(nk++,o.matrix);if(s>.9)addSolid({type:'c',x,z,r:s*.8})}rk.count=nk;rk.castShadow=true;rk.receiveShadow=true;scene.add(rk);
  const fl=new T.InstancedMesh(new T.SphereGeometry(.12,5,4),new T.MeshLambertMaterial({color:'#ffffff'}),1500),fc=new T.Color();let nf=0;for(let i=0;i<6000&&nf<1500;i++){const x=rand(-HALF+60,HALF-60),z=rand(-HALF+60,HALF-60),h=terrainH(x,z);if(h<WATER+1||vn(x*.02,z*.02)<.25)continue;const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+2)continue;o.position.set(x,h+.15,z);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();fl.setMatrixAt(nf,o.matrix);fl.setColorAt(nf,fc.set(['#f2e05a','#ff7aa8','#ffffff','#b48cff'][nf%4]));nf++}fl.count=nf;scene.add(fl)}
function buildTowns(){const H=TOWNS[0],A=TOWNS[1];
  // ---- Hollowbrook Village: cottages around a green, your home, the training yard and a lake lane
  const hx=H.x,hz=H.z;
  W.home={x:hx-30,z:hz+24,yaw:Math.PI/2};house(W.home.x,W.home.z,W.home.yaw,{w:9,d:8,wall:'#efe4cc',roof:'#3a5a8a',sign:'Home',signBg:'#3a5a8a'});
  // garage next to home (open front)
  {const gx=hx-30,gz=hz+38,g=new T.Group();g.position.set(gx,groundAt(gx,gz),gz);g.rotation.y=Math.PI/2;scene.add(g);mesh(new T.BoxGeometry(6.4,3,.3),mat('#d8ccb4'),0,1.5,-3.5,0,g);mesh(new T.BoxGeometry(.3,3,7),mat('#d8ccb4'),-3.2,1.5,0,0,g);mesh(new T.BoxGeometry(.3,3,7),mat('#d8ccb4'),3.2,1.5,0,0,g);mesh(new T.BoxGeometry(6.9,.3,7.4),mat('#3a5a8a'),0,3.15,0,0,g);mesh(new T.BoxGeometry(6.2,.04,7),mat('#8a8278'),0,.06,0,0,g);
    const s=mesh(new T.BoxGeometry(3,.6,.1),new T.MeshLambertMaterial({map:signTex('Garage','#3a5a8a','#f8f0dc',400,96)}),0,2.6,3.6,0,g);s.castShadow=false;
    addSolid({type:'box',x:gx+3.5*Math.sin(Math.PI/2)*-1,z:gz,hw:.2,hd:3.3,yaw:Math.PI/2});addSolid({type:'box',x:gx,z:gz-3.2,hw:3.6,hd:.2,yaw:Math.PI/2});addSolid({type:'box',x:gx,z:gz+3.2,hw:3.6,hd:.2,yaw:Math.PI/2});W.garage={x:gx+5,z:gz,yaw:Math.PI/2}}
  const cot=[[hx-8,hz-30,0,'#e8d6b4','#8a3a2a'],[hx+12,hz-32,0,'#dfe6e0','#6a4a3a'],[hx+34,hz-14,-Math.PI/2,'#f2e2c8','#7a2a2a'],[hx+36,hz+12,-Math.PI/2,'#e6d2b0','#4a5a3a'],[hx+14,hz+36,Math.PI,'#efe0c4','#8a5a2a'],[hx-8,hz+40,Math.PI,'#e4dccc','#6a3a5a'],[hx-34,hz-6,Math.PI/2,'#efe6d2','#8a3a2a']];
  cot.forEach(([x,z,y,w,r])=>house(x,z,y,{w:rand(7,9),d:rand(6,7.5),wall:w,roof:r}));
  house(hx+30,hz-40,0,{w:11,d:8,wall:'#d8c8a8',roof:'#5a3a2a',sign:'Hollowbrook Inn',signBg:'#5a3a22'});
  house(hx-26,hz-34,0,{w:9,d:7,wall:'#e8dcc0',roof:'#2f5a3a',sign:'Old Mill Store',signBg:'#2f5a3a'});
  well(hx,hz);[[-12,-12],[12,-12],[12,12],[-12,12]].forEach(([a,b])=>lamp(hx+a,hz+b));training(hx-40,hz-60);W.yard={x:hx-40,z:hz-60};
  stall(hx+8,hz-14,0,'#c8442a');stall(hx-8,hz+14,Math.PI,'#2f6a8a');[[4,18],[5,19.5],[-16,-4]].forEach(([a,b])=>barrel(hx+a,hz+b));crate(hx+18,hz+2,1);crate(hx+19.2,hz+2.4,.8);
  signpost(hx+58,hz-20,-Math.PI*.75,[['Ashford  →',1],['← Hollowbrook',-1]]);
  // ---- Ashford Market Town: square, fountain, shops, motors, fuel
  const ax=A.x,az=A.z;fountain(ax,az);
  const shops=[[ax-26,az-22,0,'General Store','#2f4f6a'],[ax,az-28,0,'Ashford Bakery','#8a5a2a'],[ax+26,az-22,0,'Tailor','#6a3a5a'],[ax+30,az+4,-Math.PI/2,'Town Hall','#4a4a5a'],[ax+26,az+26,Math.PI,'Library','#3a5a4a'],[ax-2,az+30,Math.PI,'Clinic','#3a6a8a'],[ax-28,az+24,Math.PI,'Tea House','#7a3a2a']];
  shops.forEach(([x,z,y,n,c])=>house(x,z,y,{w:10,d:8,fl:2,wall:['#e8dcc4','#dfe2e6','#efe2cc','#e0d6c2'][Math.floor(Math.random()*4)],roof:c,sign:n,signBg:c}));
  [[ax-60,az-60],[ax-40,az-64],[ax+50,az-62],[ax+70,az-30],[ax+72,az+30],[ax+40,az+66],[ax-30,az+66],[ax-66,az+40],[ax+10,az-70],[ax-70,az-20]].forEach(([x,z])=>house(x,z,Math.round(rand(0,3))*Math.PI/2,{w:rand(7,10),d:rand(6,8),fl:Math.random()<.5?2:1,wall:['#e8dcc4','#dfe6e0','#f2e2c8','#e6d2b0'][Math.floor(Math.random()*4)],roof:['#8a3a2a','#3a5a8a','#4a5a3a','#6a4a3a'][Math.floor(Math.random()*4)]}));
  // motors lot
  const mx=ax-58,mz=az+2;house(mx-6,mz,Math.PI/2,{w:12,d:9,wall:'#f2f2f2',roof:'#2a2a30',sign:'Ashford Motors',signBg:'#b02a2a'});{const g=mesh(new T.BoxGeometry(18,.06,16),mat('#6a6a70'),mx+8,groundAt(mx+8,mz)+.05,mz);g.castShadow=false}W.motors={x:mx+8,z:mz,yaw:Math.PI/2};
  // fuel station on the edge of town
  const fx=ax-80,fz=az-46;{const y=groundAt(fx,fz);[[-4,-3],[4,-3],[-4,3],[4,3]].forEach(([a,b])=>{mesh(new T.BoxGeometry(.3,4.4,.3),mat('#e8e8e8'),fx+a,y+2.2,fz+b);addSolid({type:'c',x:fx+a,z:fz+b,r:.25})});mesh(new T.BoxGeometry(10,.5,8),mat('#e8e8e8'),fx,y+4.6,fz);mesh(new T.BoxGeometry(10.1,.25,8.1),glow('#c8442a'),fx,y+4.3,fz);pump(fx-1.5,fz,0);pump(fx+1.5,fz,0);const s=mesh(new T.BoxGeometry(3,1,.1),new T.MeshLambertMaterial({map:signTex('FUEL','#c8442a','#ffffff',300,100)}),fx,y+5.4,fz+4.05);s.castShadow=false}
  [[-16,-16],[16,-16],[16,16],[-16,16],[0,-20],[0,20],[-20,0],[20,0]].forEach(([a,b])=>lamp(ax+a,az+b));
  stall(ax-10,az-12,0,'#f2c14e');stall(ax+10,az-12,0,'#7fd65a');stall(ax+12,az+12,Math.PI,'#ff9a3d');
  signpost(ax-70,az+40,Math.PI*.25,[['Hollowbrook  →',1],['← Ashford',-1]]);
  // ember road closed by a rockslide
  {const r=ROADS.find(r=>r.id==='canyon'),p=r.S[r.S.length-12];for(let i=0;i<9;i++){const x=p.x+rand(-5,5),z=p.z+rand(-3,3),s=rand(1,2.4);mesh(new T.DodecahedronGeometry(s,0),mat('#8a6a5a'),x,groundAt(x,z)+s*.5,z,rand(0,3));addSolid({type:'c',x,z,r:s*.9})}
    const b=new T.Group();b.position.set(p.x,groundAt(p.x,p.z),p.z+6);scene.add(b);mesh(new T.BoxGeometry(6,.3,.15),mat('#f2f2f2'),0,1,0,0,b);mesh(new T.BoxGeometry(1.6,.3,.16),mat('#c8442a'),-2,1,0,0,b);mesh(new T.BoxGeometry(1.6,.3,.16),mat('#c8442a'),2,1,0,0,b);
    const s=mesh(new T.BoxGeometry(3.4,.9,.1),new T.MeshLambertMaterial({map:signTex('ROAD CLOSED · ROCKSLIDE','#f2c14e','#2a1a0a',700,120)}),0,1.9,0,0,b);W.rockslide={x:p.x,z:p.z}}}

/* ---------------- sky & lights ---------------- */
function buildSky(){scene.background=new T.Color('#9cc9ea');scene.fog=new T.Fog('#b9d6ea',140,620);
  skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#4f8ed0')},bot:{value:new T.Color('#d8ecf6')}},vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bot;varying vec3 vp;void main(){gl_FragColor=vec4(mix(bot,top,clamp(vp.y*1.6+.1,0.,1.)),1.);}'});
  const sky=new T.Mesh(new T.SphereGeometry(1400,24,12),skyMat);sky.frustumCulled=false;scene.add(sky);W.sky=sky;
  hemi=new T.HemisphereLight('#e6f2ff','#4a5a2a',.55);scene.add(hemi);sun=new T.DirectionalLight('#fff2dc',1.05);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=-60;sc.right=60;sc.top=60;sc.bottom=-60;sc.near=1;sc.far=300;sun.shadow.bias=-.0006;scene.add(sun);scene.add(sun.target);
  for(let i=0;i<26;i++){const c=new T.Group(),a=rand(0,TAU),r=rand(400,900);c.position.set(Math.cos(a)*r,rand(140,220),Math.sin(a)*r);for(let k=0;k<5;k++){const s=new T.Mesh(new T.SphereGeometry(rand(14,26),10,8),new T.MeshLambertMaterial({color:'#ffffff',transparent:true,opacity:.92}));s.position.set(k*18-36,rand(-4,6),rand(-8,8));s.scale.y=.55;c.add(s)}scene.add(c)}}

/* ---------------- cars ---------------- */
const CARS={
  hatch:{name:'Hollow Hatch',price:0,color:'#c8442a',len:3.9,wid:1.74,hgt:1.48,wb:2.45,wr:.32,mass:1050,power:62000,acc:3.4,brk:8.6,top:43,grip:1.05,drive:'f',desc:'A plucky little hatchback. Light, nimble and cheap to run.'},
  sedan:{name:'Brookline Sedan',price:300,color:'#2f4f7a',len:4.6,wid:1.8,hgt:1.42,wb:2.75,wr:.34,mass:1380,power:98000,acc:3.9,brk:9,top:52,grip:1.08,drive:'f',desc:'A comfortable family sedan. Smooth, steady and quick on the open road.'},
  pickup:{name:'Ridgeback Pickup',price:450,color:'#5a6a3a',len:5.2,wid:1.95,hgt:1.85,wb:3.1,wr:.42,mass:1950,power:120000,acc:3.3,brk:7.2,top:46,grip:1,drive:'a',desc:'A tough pickup truck with high clearance. Slow to turn, hard to stop, great on hills.'},
  coupe:{name:'Corsa 72',price:800,color:'#e0a83a',len:4.35,wid:1.8,hgt:1.24,wb:2.55,wr:.33,mass:1220,power:150000,acc:5.4,brk:9.8,top:61,grip:.97,drive:'r',desc:'A classic rear-wheel-drive coupe. Fast, loud and loves to slide.'}};
W.CARS=CARS;
const cars=[];let myCar=null,inCar=null;
function buildCarMesh(spec,color){const g=new T.Group(),L=spec.len,Wd=spec.wid,body=mat(color),dk=mat('#2a2a30'),chrome=mat('#d0d4da'),glass=new T.MeshPhongMaterial({color:'#2a3a4a',shininess:120,specular:'#9fc4dd',transparent:true,opacity:.85});
  const base=spec.wr+.12,bh=.55,type=spec===CARS.pickup?'pickup':spec===CARS.hatch?'hatch':spec===CARS.coupe?'coupe':'sedan';
  const B=(w,h,d,m,x,y,z)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
  B(Wd,bh,L,body,0,base+bh/2,0);B(Wd+.04,.16,.32,dk,0,base+.1,L/2-.1);B(Wd+.04,.16,.32,dk,0,base+.1,-L/2+.1);
  let cz=0,cl=L*.45,ch=spec.hgt-base-bh;if(type==='hatch'){cz=-L*.08;cl=L*.55}if(type==='coupe'){cz=-L*.1;cl=L*.38;ch*=.95}if(type==='pickup'){cz=L*.12;cl=L*.32}
  const cab=B(Wd*.9,ch,cl,body,0,base+bh+ch/2,cz);B(Wd*.92,ch*.62,cl*.96,glass,0,base+bh+ch*.5,cz);
  const ws=B(Wd*.86,ch*.75,.06,glass,0,base+bh+ch*.45,cz+cl/2+.02);ws.rotation.x=-.45;const rw=B(Wd*.86,ch*.7,.06,glass,0,base+bh+ch*.45,cz-cl/2-.02);rw.rotation.x=.4;
  B(Wd*.92,.05,cl*.9,body,0,base+bh+ch+.02,cz);
  if(type==='pickup'){const bz=-L*.22,bl=L*.48;B(.1,.45,bl,body,Wd/2-.05,base+bh+.22,bz);B(.1,.45,bl,body,-Wd/2+.05,base+bh+.22,bz);B(Wd,.45,.1,body,0,base+bh+.22,bz-bl/2)}
  // lights, grille, plates, mirrors, handles, door seams
  const hl=[],tl=[];[-1,1].forEach(q=>{hl.push(B(.32,.14,.05,glow('#fffbe6'),q*(Wd/2-.25),base+bh*.68,L/2+.01));tl.push(B(.3,.13,.05,new T.MeshBasicMaterial({color:'#7a1010'}),q*(Wd/2-.24),base+bh*.7,-L/2-.01));
    const m=B(.08,.1,.16,dk,q*(Wd/2+.06),base+bh+ch*.25,cz+cl/2-.25);B(.08,.03,.18,chrome,q*(Wd/2+.01),base+bh*.75,cz+.2);B(.012,bh*.85,.02,dk,q*(Wd/2+.005),base+bh*.5,cz-cl*.05)});
  B(Wd*.4,.16,.04,dk,0,base+bh*.5,L/2+.01);const pl=B(.5,.13,.03,mat('#f4f0e0'),0,base+.2,L/2+.02);B(.5,.13,.03,mat('#f4f0e0'),0,base+.2,-L/2-.02);
  const wheels=[];[[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx,sz])=>{const piv=new T.Group();piv.position.set(sx*(Wd/2-.08),spec.wr,sz*spec.wb/2);g.add(piv);const w=new T.Mesh(new T.CylinderGeometry(spec.wr,spec.wr,.26,16),mat('#1c1c20'));w.rotation.z=Math.PI/2;w.castShadow=true;piv.add(w);
    const hub=new T.Mesh(new T.CylinderGeometry(spec.wr*.55,spec.wr*.55,.27,10),chrome);hub.rotation.z=Math.PI/2;piv.add(hub);const sp=new T.Mesh(new T.BoxGeometry(.28,spec.wr*.9,.06),dk);sp.position.x=sx*.01;w.add(sp);wheels.push({piv,w,front:sz>0})});
  return {g,wheels,hl,tl}}
function spawnCar(type,x,z,yaw,o){const spec=CARS[type],m=buildCarMesh(spec,(o&&o.color)||spec.color);scene.add(m.g);
  const c=Object.assign({type,spec,m,pos:V(x,groundAt(x,z)+.2,z),yaw,vx:0,vy:0,w:0,vyU:0,steer:0,rpm:850,gear:1,eng:false,shiftT:0,owner:null,locked:true,stolen:false,alarm:0,flash:0,pitch:0,roll:0,spin:0,dmg:0,flooded:false,name:spec.name},o||{});cars.push(c);syncCar(c,0);return c}
function syncCar(c,dt){const s=c.spec,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);const fx=sn*s.wb/2,fz=cs*s.wb/2,rx=cs*s.wid/2,rz=-sn*s.wid/2;
  const hFL=groundAt(c.pos.x+fx-rx,c.pos.z+fz-rz),hFR=groundAt(c.pos.x+fx+rx,c.pos.z+fz+rz),hRL=groundAt(c.pos.x-fx-rx,c.pos.z-fz-rz),hRR=groundAt(c.pos.x-fx+rx,c.pos.z-fz+rz);
  const gh=(hFL+hFR+hRL+hRR)/4,tp=Math.atan2((hRL+hRR)/2-(hFL+hFR)/2,s.wb),tr=Math.atan2((hFR+hRR)/2-(hFL+hRL)/2,s.wid);
  if(dt>0){if(c.pos.y>gh+.25){c.vyU-=9.8*dt;c.pos.y+=c.vyU*dt;c.air=true}else{if(c.air&&c.vyU<-5){c.bounce=.35;W.sfx('thud',.5)}c.air=false;c.vyU=0;c.pos.y=lerp(c.pos.y,gh,1-Math.exp(-dt*18))}if(c.pos.y<gh)c.pos.y=gh}else c.pos.y=gh;
  c.ground=gh;c.tp=tp;const k=dt>0?1-Math.exp(-dt*8):1;c.pitch=lerp(c.pitch,tp+(c.accelPitch||0),k);c.roll=lerp(c.roll,tr+(c.latRoll||0),k);
  c.m.g.position.set(c.pos.x,c.pos.y+(c.bounce||0)*Math.sin(clock*30)*.04,c.pos.z);c.m.g.rotation.set(0,0,0);c.m.g.rotation.order='YXZ';c.m.g.rotation.y=c.yaw;c.m.g.rotation.x=c.pitch;c.m.g.rotation.z=-c.roll;if(c.bounce)c.bounce=Math.max(0,c.bounce-dt*2);
  c.spin+=c.vx*dt/s.wr;c.m.wheels.forEach(wh=>{wh.w.rotation.x=c.spin;if(wh.front)wh.piv.rotation.y=c.steer});
  const lit=c.eng&&(W.night||c.lights);c.m.hl.forEach(h=>h.material.color.set(lit?'#fffbe6':'#c8c8c0'));const br=c.braking&&c.eng;c.m.tl.forEach(t=>t.material.color.set(c.flash>0&&Math.sin(clock*18)>0?'#ffb070':br?'#ff2a2a':c.eng?'#a01818':'#5a1010'));if(c.flash>0)c.flash-=dt}
function carStep(c,dt,inp){const s=c.spec,m=s.mass,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);
  const thr=c.eng&&!c.flooded?inp.thr:0,brk=inp.brk,hb=inp.hb;let steerIn=inp.steer;const spd=Math.abs(c.vx);
  const maxSt=.56/(1+spd*.105);c.steer=lerp(c.steer,steerIn*maxSt,1-Math.exp(-dt*(steerIn?6:9)));
  // gearbox
  const gearN=5,gs=s.top/gearN;const want=clamp(Math.floor(spd/gs)+1,1,gearN);if(want!==c.gear&&c.vx>=0){c.gear=want;c.shiftT=.22;if(c===inCar)W.sfx('shift',.25)}c.shiftT-=dt;
  c.rpm=c.eng?(c.vx<-.2?900+spd*260:900+((spd-(c.gear-1)*gs)/gs)*5200*(c.gear===1?1:.8)+(c.gear>1?1300:0)):0;c.rpm=Math.max(c.eng?850:0,Math.min(7200,c.rpm+(thr&&spd<1?2500*thr:0)));
  let Fe=0;if(thr>0)Fe=thr*Math.min(s.mass*s.acc*(c.onRoad?1:.8),s.power/Math.max(spd,1))*(c.shiftT>0?.45:1);
  let rev=0;if(brk&&c.vx<.6&&c.eng&&!c.flooded){rev=-brk*s.mass*2.6;if(c.vx<-7.5)rev=0}
  let Fb=0;if(brk&&c.vx>.6)Fb=-s.mass*s.brk*brk*(c.onRoad?1:.75);if(hb)Fb+=-Math.sign(c.vx)*s.mass*2.4*Math.min(1,spd);
  const Cd=s.power/(s.top*s.top*s.top)*.92,roll=(c.onRoad?.015:.06)*m*9.8,drag=-Cd*c.vx*Math.abs(c.vx)-(Math.abs(c.vx)>.05?Math.sign(c.vx)*roll:0)-.6*c.vx;
  const slope=9.8*Math.sin(c.tp||0)*m;
  const b=s.wb*.5,cc=s.wb*.5,load=m*9.8/2,grip=s.grip*(c.onRoad?1:.82)*(c.flooded?.4:1);
  let slipF=0,slipR=0;if(spd>.8){slipF=Math.atan2(c.vy+c.w*b,spd)-c.steer*Math.sign(c.vx);slipR=Math.atan2(c.vy-c.w*cc,spd)}
  const Ff=clamp(-5*slipF,-1,1)*grip*load*.82,Fr=clamp(-7.5*slipR,-1,1)*grip*load*.94*(hb?.32:1)*(s.drive==='r'&&thr>.5&&spd<16?.85:1);
  const ax=(Fe+rev+Fb+drag+slope-Ff*Math.sin(c.steer))/m,ay=(Fr+Ff*Math.cos(c.steer))/m;
  const I=m*(s.wb*s.wb+s.wid*s.wid)/12*1.25;
  if(spd>.8){c.w+=(b*Ff*Math.cos(c.steer)-cc*Fr)/I*dt;c.w-=c.w*dt*(hb?.2:1.1)}else{c.w=lerp(c.w,c.vx*Math.tan(c.steer)/s.wb,.5)}
  if(c.air){c.w*=.995}
  let nvx=c.vx+(ax+c.w*c.vy)*dt,nvy=c.vy+(ay-c.w*c.vx)*dt;if(Fb&&Math.sign(nvx)!==Math.sign(c.vx)&&!rev)nvx=0;if(spd<2&&!hb)nvy*=.8;
  if(!thr&&!brk&&spd<.4&&!rev){nvx*=.9}
  c.vx=nvx;c.vy=nvy;if(spd<.8&&!hb){c.w=lerp(c.w,c.vx*Math.tan(c.steer)/s.wb,.6)}
  c.yaw+=c.w*dt;c.accelPitch=lerp(c.accelPitch||0,clamp(-ax*.006,-.05,.05),.1);c.latRoll=lerp(c.latRoll||0,clamp(c.w*c.vx*.004,-.06,.06),.1);c.braking=brk>0&&c.vx>.5;
  const wx=Math.sin(c.yaw)*c.vx+Math.cos(c.yaw)*c.vy,wz=Math.cos(c.yaw)*c.vx-Math.sin(c.yaw)*c.vy;c.pos.x+=wx*dt;c.pos.z+=wz*dt;
  // collisions: front and rear circles
  for(const off of [s.len*.3,-s.len*.3]){const p={x:c.pos.x+Math.sin(c.yaw)*off,z:c.pos.z+Math.cos(c.yaw)*off},px=p.x,pz=p.z;const h=collide(p,s.wid*.55);if(h){const dx=p.x-px,dz=p.z-pz;c.pos.x+=dx;c.pos.z+=dz;
      const vwx=Math.sin(c.yaw)*c.vx+Math.cos(c.yaw)*c.vy,vwz=Math.cos(c.yaw)*c.vx-Math.sin(c.yaw)*c.vy,vn=vwx*h.x+vwz*h.z;if(vn<0){const nx=vwx-(1.35)*vn*h.x,nz=vwz-(1.35)*vn*h.z;c.vx=(Math.sin(c.yaw)*nx+Math.cos(c.yaw)*nz)*.7;c.vy=(Math.cos(c.yaw)*nx-Math.sin(c.yaw)*nz)*.7;c.w*=.5;
        if(-vn>3&&c===inCar){W.sfx('crash',Math.min(1,-vn/18));W.shake=Math.min(.6,-vn*.03);c.dmg+= -vn;if(-vn>9)W.say(c.dmg>120?'Your car is getting badly dented.':'Crunch!')}}}}
  // car vs car
  for(const o of cars){if(o===c)continue;const d=Math.hypot(o.pos.x-c.pos.x,o.pos.z-c.pos.z),mn=(s.len+o.spec.len)*.36;if(d<mn&&d>.01){const nx=(c.pos.x-o.pos.x)/d,nz=(c.pos.z-o.pos.z)/d,push=(mn-d);c.pos.x+=nx*push*.6;c.pos.z+=nz*push*.6;o.pos.x-=nx*push*.4;o.pos.z-=nz*push*.4;
    const vwx=Math.sin(c.yaw)*c.vx+Math.cos(c.yaw)*c.vy,vwz=Math.cos(c.yaw)*c.vx-Math.sin(c.yaw)*c.vy,vn=vwx*nx+vwz*nz;if(vn<0){c.vx*=.6;c.vy*=.6;if(c===inCar&&-vn>3){W.sfx('crash',Math.min(1,-vn/15));W.shake=.3;if(!o.alarm&&o!==myCar&&-vn>4){o.alarm=8;W.say('You set off a car alarm!')}}}o.syncNeed=true}}
  const rd=FLAT?null:roadAt(c.pos.x,c.pos.z);c.onRoad=FLAT||!!(rd&&rd.d<rd.r.w/2+.6);
  if(c.pos.y<WATER-.5&&!c.flooded){c.flooded=true;c.eng=false;if(c===inCar){W.say('The engine flooded! Hold R to call a tow truck.');W.sfx('splash',1)}}
  syncCar(c,dt)}

/* ---------------- NPCs ---------------- */
const NPCS=[];
const NPC_DEFS=[
  {n:'Mira',town:0,body:'#7a3a5a',acc:'#f2c14e',head:'bald',hair:['long','#3a2a1a'],skin:'#e0b08a',lines:['Morning! Off somewhere nice?','Ashford is a fair way down Kingsway Road. Follow the yellow line east, over the Silverrun bridge.']},
  {n:'Old Pell',town:0,body:'#4a5a3a',acc:'#c9a868',head:'straw',skin:'#c68a5e',lines:['Fifty years I have farmed this valley.','Mind the river if you drive at night. Folks miss the bridge and end up swimming with their engines.']},
  {n:'Tomas',town:0,body:'#2f4f6a',acc:'#ffffff',head:'goggles',skin:'#9a6440',hair:['messy','#1a1410'],lines:['Is that your car? You should lock it. Well, it locks itself when you walk off. Fancy.','People in Ashford are not as trusting as us. Someone tried to hotwire my cousin\'s truck last spring.']},
  {n:'Little Ana',town:0,body:'#c8442a',acc:'#f4f0e0',head:'bald',hair:['short','#7a4a20'],skin:'#f1d2b6',small:true,lines:['Are you really going to get an element? Like Master Oren\'s students?','When I grow up I am going to be a master of everything. All the elements at once!']},
  {n:'Brann the Smith',town:0,body:'#3a3a40',acc:'#ff8a3d',head:'bald',skin:'#6b4630',lines:['The road east is long, but it is a good road. I laid half those stones myself.','If you ever crack a sword, bring it here. Or a fender.']},
  {n:'Master Oren',town:0,body:'#4a3a2a',acc:'#e8d2a0',head:'straw',skin:'#c68a5e',yard:true,lines:['Out here the world is wide. Walk it. Drive it. Learn where everything is.','A fighter who knows the land wins before the fight starts.']},
  {n:'Kessa',town:1,body:'#2e6f73',acc:'#ffffff',head:'fedora',skin:'#e0b08a',hair:['swept','#1a1410'],lines:['Welcome to Ashford! Best market for a hundred miles.','The fountain? Built by the first mayor. Locals toss in a coin for luck. I just like the sound.']},
  {n:'Dalton',town:1,body:'#1f2a3a',acc:'#c0c0c0',head:'visor',skin:'#c68a5e',motors:true,lines:['Ashford Motors, finest cars on Kingsway Road. Have a look around.']},
  {n:'Rosa the Baker',town:1,body:'#f2e2c8',acc:'#c8442a',head:'bald',hair:['long','#3a2a1a'],skin:'#9a6440',lines:['Fresh bread, warm out of the oven. Take a smell, it is free.','You came all the way from Hollowbrook? On foot? You need a car, love.']},
  {n:'Officer Hale',town:1,body:'#1f3a6a',acc:'#f2c14e',head:'helmg',skin:'#e0b08a',lines:['Keep it slow through town. There are kids around the fountain.','If your car gets stolen, report it here. We keep an eye on the roads.']},
  {n:'Jun',town:1,body:'#5a2a6a',acc:'#c9b3ff',head:'hood',skin:'#f1d2b6',lines:['Heard a spirit lives up in Ember Canyon. The road is closed by a rockslide though.','Some say the shrines will open again soon. Some say a lot of things.']},
  {n:'Ivo',town:1,body:'#8a5a1f',acc:'#ffe2a3',head:'cowl',skin:'#6b4630',lines:['The Tea House does the best ginger tea in the valley. Go on, treat yourself.']}];
function mkNpc(D,i){const id='npc_'+i;const def={id,name:D.n,title:'',el:'unmarked',hp:60,spd:2,pow:1,range:2,stats:[1,1,1,1],body:D.body,accent:D.acc,head:D.head,weapon:D.n==='Master Oren'?'staff':'none',size:D.small?.78:1};
  BYID[id]=def;KITS[id]={passive:['',''],q:null,e:null,r:null};SKIN[id]=D.skin;if(D.hair)HAIR[id]=D.hair;MELEE[id]=[1,1,1];STYLE[id]='blade';
  const f=mkFighter(def,false,0);world.remove(f.rig.root);scene.add(f.rig.root);const t=TOWNS[D.town];let hx=t.x+rand(-t.r*.5,t.r*.5),hz=t.z+rand(-t.r*.5,t.r*.5);if(D.yard){hx=W.yard.x;hz=W.yard.z+2}if(D.motors){hx=W.motors.x-2;hz=W.motors.z+5}
  const p={x:hx,z:hz};collide(p,.6);f.pos.set(p.x,groundAt(p.x,p.z),p.z);f.yaw=rand(0,TAU);f.foe=f;Object.assign(f,{npc:D,home:{x:p.x,z:p.z},tgt:null,wait:rand(1,5),talkI:0,static:!!(D.yard||D.motors),bubble:null,bubT:0});NPCS.push(f);return f}
function npcStep(f,dt,near){const D=f.npc;if(f.dodge>0){f.dodge-=dt;f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;f.vel.x*=Math.pow(.05,dt);f.vel.z*=Math.pow(.05,dt)}
  else if(W.talk===f||f.static){f.vel.set(0,0,0);if(W.talk===f||(near&&f.static))f.yaw=turnTo(f.yaw,Math.atan2(W.hero.pos.x-f.pos.x,W.hero.pos.z-f.pos.z),4*dt)}
  else{if(!f.tgt){f.wait-=dt;f.vel.set(0,0,0);if(f.wait<=0){const a=rand(0,TAU),r=rand(4,D.town===1?30:22);f.tgt={x:f.home.x+Math.cos(a)*r,z:f.home.z+Math.sin(a)*r}}}
    else{const dx=f.tgt.x-f.pos.x,dz=f.tgt.z-f.pos.z,d=Math.hypot(dx,dz);if(d<.6||f.stuck>3){f.tgt=null;f.stuck=0;f.wait=rand(2,7)}else{const sp=D.small?1.9:1.35;f.vel.set(dx/d*sp,0,dz/d*sp);f.yaw=turnTo(f.yaw,Math.atan2(dx,dz),5*dt);const ox=f.pos.x,oz=f.pos.z;f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;const p={x:f.pos.x,z:f.pos.z};if(collide(p,.35)){f.stuck=(f.stuck||0)+dt}f.pos.x=p.x;f.pos.z=p.z}}}
  // dodge speeding cars
  for(const c of cars){const sp=Math.abs(c.vx);if(sp<4)continue;const d=Math.hypot(c.pos.x-f.pos.x,c.pos.z-f.pos.z);if(d<c.spec.len*.6+1.2&&!(f.dodge>0)){const nx=(f.pos.x-c.pos.x)/(d||1),nz=(f.pos.z-c.pos.z)/(d||1);f.vel.set(nx*7,0,nz*7);f.dodge=.6;bubble(f,['Whoa!','Watch it!','Hey! Slow down!','Are you mad?!'][Math.floor(Math.random()*4)])}}
  f.pos.y=groundAt(f.pos.x,f.pos.z);f.grounded=true;f.st='free';if(near||W.talk===f)animate(f,dt);f.rig.aura.visible=false;f.rig.root.position.copy(f.pos);f.rig.root.rotation.y=f.yaw}

/* ---------------- UI ---------------- */
let ui={};
function css(){const s=document.createElement('style');s.textContent=`
#roam-hud{position:absolute;inset:0;z-index:12;pointer-events:none;font-family:var(--ui,system-ui);color:#fff}#roam-hud[hidden]{display:none}
#rh-mini{position:absolute;right:16px;top:16px;width:190px;height:190px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.75);box-shadow:0 6px 24px rgba(0,0,0,.45);background:#223}
#rh-mini canvas{width:100%;height:100%}#rh-area{position:absolute;left:50%;top:18px;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .8s;text-shadow:0 2px 8px rgba(0,0,0,.7)}#rh-area.on{opacity:1}
#rh-area b{display:block;font-family:var(--display,Georgia);font-size:30px;letter-spacing:.04em}#rh-area small{font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.85}
#rh-prompt{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:rgba(10,8,26,.82);padding:8px 14px;border-radius:999px;font-weight:700;font-size:15px;display:none;align-items:center;gap:8px}#rh-prompt kbd{background:#fff;color:#111;border-radius:6px;padding:1px 7px;font-weight:800}
#rh-ring{width:22px;height:22px}#rh-speed{position:absolute;right:24px;bottom:24px;text-align:right;display:none;text-shadow:0 2px 8px rgba(0,0,0,.7)}#rh-speed b{font-size:54px;font-family:var(--display,Georgia);line-height:1}#rh-speed small{display:block;font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
#rh-help{position:absolute;left:16px;bottom:14px;font-size:12.5px;opacity:.8;background:rgba(10,8,26,.55);padding:6px 10px;border-radius:10px;max-width:60vw}
#rh-msg{position:absolute;left:50%;top:84px;transform:translateX(-50%);background:rgba(10,8,26,.8);padding:8px 16px;border-radius:12px;font-size:15px;opacity:0;transition:opacity .4s}#rh-msg.on{opacity:1}
#rh-gold{position:absolute;right:16px;top:214px;width:190px;text-align:center;font-weight:800;color:#ffd27a;text-shadow:0 2px 6px rgba(0,0,0,.7)}
#rh-talk{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);width:min(620px,calc(100% - 32px));background:rgba(12,10,28,.92);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:14px 18px;display:none;pointer-events:auto}
#rh-talk b{color:#ffd27a;font-size:17px}#rh-talk p{margin:6px 0 4px;font-size:16px;line-height:1.45}#rh-talk small{opacity:.7}
.rh-bub{position:absolute;transform:translate(-50%,-100%);background:#fff;color:#111;font-weight:700;font-size:13px;padding:5px 10px;border-radius:12px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)}
#rh-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100% - 32px));max-height:calc(100% - 40px);overflow:auto;background:rgba(12,10,28,.95);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:18px;display:none;pointer-events:auto}
#rh-panel h2{margin:0 0 4px}#rh-panel .rc{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.14);border-radius:12px;margin-top:8px}#rh-panel .rc small{display:block;opacity:.75;font-size:13px;margin-top:2px}
#rh-panel .bars{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:11px;opacity:.85;margin-top:6px}#rh-panel .bars i{display:block;height:6px;border-radius:9px;background:linear-gradient(90deg,#f6b94e,#ffe2a3);margin-top:4px}
#rh-panel button{font:inherit}#rh-map{position:absolute;inset:40px;display:none;pointer-events:auto;background:rgba(8,8,20,.9);border-radius:18px;border:1px solid rgba(255,255,255,.2);padding:14px}#rh-map canvas{width:100%;height:100%;object-fit:contain}
@media (max-width:700px){#rh-mini{width:130px;height:130px}#rh-gold{top:150px;width:130px}#rh-help{display:none}}`;document.head.appendChild(s)}
function buildUI(){css();const h=document.createElement('div');h.id='roam-hud';h.hidden=true;h.innerHTML=`<div id="rh-mini"><canvas width="380" height="380"></canvas></div><div id="rh-gold"></div><div id="rh-area"><small></small><b></b></div><div id="rh-msg"></div>
  <div id="rh-prompt"></div><div id="rh-speed"><b>0</b><small>km/h</small></div><div id="rh-help">WASD move · Shift run · Space jump · E talk / use · F car · Hold F hotwire · M map · Esc menu<br>In a car: W/S drive and reverse · A/D steer · Space handbrake · H horn · L lights</div>
  <div id="rh-talk"></div><div id="rh-panel"></div><div id="rh-map"><canvas width="900" height="900"></canvas></div><div id="rh-bubs"></div>`;document.body.appendChild(h);
  ui={hud:h,mini:h.querySelector('#rh-mini canvas'),area:h.querySelector('#rh-area'),prompt:h.querySelector('#rh-prompt'),speed:h.querySelector('#rh-speed'),talk:h.querySelector('#rh-talk'),panel:h.querySelector('#rh-panel'),map:h.querySelector('#rh-map'),msg:h.querySelector('#rh-msg'),gold:h.querySelector('#rh-gold'),bubs:h.querySelector('#rh-bubs')}}
let mapImg=null;
function buildMapImage(){const N=450,cv=document.createElement('canvas');cv.width=cv.height=N;const x=cv.getContext('2d'),img=x.createImageData(N,N);
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const wx=-HALF+(i+.5)/N*HALF*2,wz=-HALF+(j+.5)/N*HALF*2,h=terrainH(wx,wz);let r,g,b;if(h<WATER){r=61;g=127;b=176}else if(h>32){r=g=b=150+Math.min(90,(h-32)*3)}else{const k=clamp((h+10)/40,0,1);r=70+k*40;g=125+k*35;b=60+k*20;const f=vn(wx*.004+40,wz*.004-12);if(f>-.05){r*=.78;g*=.85;b*=.8}}
    const o=(j*N+i)*4;img.data[o]=r;img.data[o+1]=g;img.data[o+2]=b;img.data[o+3]=255}
  x.putImageData(img,0,0);const P=(px,pz)=>[(px+HALF)/(HALF*2)*N,(pz+HALF)/(HALF*2)*N];x.lineCap='round';
  ROADS.forEach(r=>{x.strokeStyle='#f4ead2';x.lineWidth=r.id==='main'?4:3;x.beginPath();r.S.forEach((s,i)=>{const [a,b]=P(s.x,s.z);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke()});
  TOWNS.forEach(t=>{const [a,b]=P(t.x,t.z);x.fillStyle='rgba(255,226,163,.55)';x.beginPath();x.arc(a,b,t.r/(HALF*2)*N*1.1,0,TAU);x.fill()});mapImg=cv}
function drawMini(){const cv=ui.mini,x=cv.getContext('2d'),N=mapImg.width,S=cv.width,hp=W.focus(),scale=2.2;const cx=(hp.x+HALF)/(HALF*2)*N,cz=(hp.z+HALF)/(HALF*2)*N;
  x.save();x.clearRect(0,0,S,S);x.translate(S/2,S/2);x.rotate(W.camYaw+Math.PI);x.scale(scale,scale);x.drawImage(mapImg,-cx,-cz);
  const P=(px,pz)=>[(px+HALF)/(HALF*2)*N-cx,(pz+HALF)/(HALF*2)*N-cz];
  if(myCar&&inCar!==myCar){const [a,b]=P(myCar.pos.x,myCar.pos.z);x.fillStyle='#4fe3d0';x.fillRect(a-2.5,b-2.5,5,5)}
  x.restore();x.save();x.translate(S/2,S/2);x.rotate(W.camYaw+Math.PI-W.focusYaw());x.fillStyle='#ffd27a';x.strokeStyle='#1a1410';x.lineWidth=2;x.beginPath();x.moveTo(0,-11);x.lineTo(8,9);x.lineTo(0,4);x.lineTo(-8,9);x.closePath();x.fill();x.stroke();x.restore();
  x.save();x.translate(S/2,S/2);x.rotate(W.camYaw+Math.PI);x.fillStyle='#fff';x.font='bold 22px system-ui';x.textAlign='center';x.fillText('N',0,-S/2+26);x.restore()}
function drawBigMap(){const cv=ui.map.querySelector('canvas'),x=cv.getContext('2d'),S=cv.width;x.clearRect(0,0,S,S);x.drawImage(mapImg,0,0,S,S);const P=(px,pz)=>[(px+HALF)/(HALF*2)*S,(pz+HALF)/(HALF*2)*S];x.font='bold 20px Georgia';x.textAlign='center';
  TOWNS.forEach(t=>{const [a,b]=P(t.x,t.z);x.fillStyle='#1a1410';x.fillText(t.name,a+1,b-26);x.fillStyle='#fff';x.fillText(t.name,a,b-27)});
  [['Silverrun River',-300,-40],['Whispering Woods',-120,260],['Ember Road (closed)',-60,-470],['Lake Mere',-760,560]].forEach(([n,px,pz])=>{const [a,b]=P(px,pz);x.font='italic 16px Georgia';x.fillStyle='rgba(255,255,255,.85)';x.fillText(n,a,b)});
  const hp=W.focus(),[a,b]=P(hp.x,hp.z);x.fillStyle='#ffd27a';x.beginPath();x.arc(a,b,9,0,TAU);x.fill();x.strokeStyle='#000';x.lineWidth=3;x.stroke();if(myCar&&inCar!==myCar){const [c,d]=P(myCar.pos.x,myCar.pos.z);x.fillStyle='#4fe3d0';x.fillRect(c-6,d-6,12,12);x.fillStyle='#fff';x.font='bold 14px system-ui';x.fillText('Your car',c,d-12)}}
let msgT=0;W.say=t=>{ui.msg.textContent=t;ui.msg.classList.add('on');msgT=3.2};
let areaT=0,curArea='';function areaName(){const p=W.focus();for(const t of TOWNS)if(Math.hypot(p.x-t.x,p.z-t.z)<t.r+10)return [t.name,'Town'];const rv=nearest(riverS,riverI,p.x,p.z);if(rv.d<40)return ['Silverrun River','River'];
  if(Math.hypot(p.x-LAKE.x,p.z-LAKE.z)<LAKE.r+40)return ['Lake Mere','Lake'];const rd=roadAt(p.x,p.z);if(rd&&rd.d<12)return [rd.r.name,'Road'];if(vn(p.x*.004+40,p.z*.004-12)>-.05)return ['Whispering Woods','Forest'];return ['The Open Valley','Wilds']}
function bubble(f,t){f.bubble=t;f.bubT=2.6}
function drawBubbles(){let h='';const v=new T.Vector3();for(const f of NPCS){if(f.bubT>0){f.bubT-=RDT;v.set(f.pos.x,f.pos.y+2.4*(f.size||1),f.pos.z).project(camera);if(v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1){const r=renderer.domElement.getBoundingClientRect();h+=`<div class="rh-bub" style="left:${(v.x*.5+.5)*r.width}px;top:${(-v.y*.5+.5)*r.height}px">${f.bubble}</div>`}}}ui.bubs.innerHTML=h}

/* ---------------- audio ---------------- */
let eng=null;function engineAudio(on){if(!AC)return;if(on&&!eng){const o1=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o1.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=700;g.gain.value=0;o1.connect(f);o2.connect(f);f.connect(g);g.connect(AC.destination);o1.start();o2.start();eng={o1,o2,f,g}}
  if(!on&&eng){const e=eng;eng=null;e.g.gain.setTargetAtTime(0,AC.currentTime,.05);setTimeout(()=>{try{e.o1.stop();e.o2.stop()}catch(_){}},400)}}
function engineTick(c,thr){if(!eng)return;const f=20+c.rpm/60*1.6,t=AC.currentTime;eng.o1.frequency.setTargetAtTime(f,t,.03);eng.o2.frequency.setTargetAtTime(f*.5,t,.03);eng.f.frequency.setTargetAtTime(400+thr*900+c.rpm*.08,t,.05);eng.g.gain.setTargetAtTime(muted||!c.eng?0:.035+thr*.05,t,.05)}
W.sfx=(k,v)=>{if(!AC||muted)return;const t=AC.currentTime,g=AC.createGain();g.connect(AC.destination);v=v||.4;
  const tone=(f,d,type,vol,f2)=>{const o=AC.createOscillator();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);const gg=AC.createGain();gg.gain.setValueAtTime(vol,t);gg.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(gg);gg.connect(g);o.start(t);o.stop(t+d+.05)};
  const noise=(d,vol,fc)=>{const b=AC.createBuffer(1,AC.sampleRate*d,AC.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=fc||1200;const gg=AC.createGain();gg.gain.setValueAtTime(vol,t);gg.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f);f.connect(gg);gg.connect(g);s.start(t)};
  if(k==='chirp'){tone(1900,.08,'sine',.12*v/.4);setTimeout(()=>tone(1900,.08,'sine',.12),130)}
  else if(k==='horn'){tone(392,.45,'sawtooth',.08);tone(494,.45,'sawtooth',.06)}
  else if(k==='crash'){noise(.35,.6*v,900);tone(90,.3,'square',.2*v,40)}
  else if(k==='thud'){tone(70,.2,'sine',.3*v,40)}else if(k==='shift'){noise(.08,.1,3000)}
  else if(k==='start'){noise(.6,.15,600);tone(60,.6,'sawtooth',.06,110)}else if(k==='door'){tone(160,.12,'square',.08,90);noise(.1,.15,2000)}
  else if(k==='click'){tone(2400,.03,'square',.06)}else if(k==='alarm'){tone(880,.25,'square',.06,660)}else if(k==='splash'){noise(.8,.4,700)}};

/* ---------------- player ---------------- */
const keys=new Set(),pressedK=new Set();let mdown=false,lastMX=0,lastMY=0;
W.camYaw=0;W.camPitch=.32;W.camDist=6.5;let camPos=V(),camLook=V();W.shake=0;
W.focus=()=>inCar?inCar.pos:W.hero.pos;W.focusYaw=()=>inCar?inCar.yaw:W.hero.yaw;
function heroStep(dt){const h=W.hero,run=keys.has('ShiftLeft')||keys.has('ShiftRight');let mx=0,mz=0;if(keys.has('KeyW')||keys.has('ArrowUp'))mz+=1;if(keys.has('KeyS')||keys.has('ArrowDown'))mz-=1;if(keys.has('KeyA')||keys.has('ArrowLeft'))mx-=1;if(keys.has('KeyD')||keys.has('ArrowRight'))mx+=1;
  const fwdX=Math.sin(W.camYaw),fwdZ=Math.cos(W.camYaw),rX=Math.cos(W.camYaw),rZ=-Math.sin(W.camYaw);let dx=fwdX*mz-rX*mx,dz=fwdZ*mz-rZ*mx;const l=Math.hypot(dx,dz);
  const sp=W.talk||W.panelOpen?0:(run?7.2:3.4)*(W.inWater?.45:1);if(l>0){dx/=l;dz/=l}const k=1-Math.exp(-dt*(h.grounded?10:2.5));h.vel.x=lerp(h.vel.x,dx*sp,k);h.vel.z=lerp(h.vel.z,dz*sp,k);
  if(l>0&&sp>0)h.yaw=turnTo(h.yaw,Math.atan2(dx,dz),10*dt);
  if(pressedK.has('Space')&&h.grounded&&!W.talk){h.vel.y=8.2;h.grounded=false;h.jumps=1}h.vel.y-=22*dt;
  h.pos.x+=h.vel.x*dt;h.pos.z+=h.vel.z*dt;const p={x:h.pos.x,z:h.pos.z};collide(p,.4);for(const c of cars){const cx=c.pos.x,cz=c.pos.z,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),lx=(p.x-cx)*cs-(p.z-cz)*sn,lz=(p.x-cx)*sn+(p.z-cz)*cs,hw=c.spec.wid/2+.4,hd=c.spec.len/2+.4;if(Math.abs(lx)<hw&&Math.abs(lz)<hd){const ex=hw-Math.abs(lx),ez=hd-Math.abs(lz);let nlx=lx,nlz=lz;if(ex<ez)nlx=Math.sign(lx)*hw;else nlz=Math.sign(lz)*hd;p.x=cx+nlx*cs+nlz*sn;p.z=cz-nlx*sn+nlz*cs}}
  h.pos.x=p.x;h.pos.z=p.z;h.pos.y+=h.vel.y*dt;const g=groundAt(h.pos.x,h.pos.z);W.inWater=g<WATER-.6;const floor=W.inWater?WATER-1.1:g;if(h.pos.y<=floor){if(!h.grounded&&h.vel.y<-6)h.landT=.2;h.pos.y=floor;h.vel.y=0;h.grounded=true}else if(h.pos.y>floor+.3)h.grounded=false;
  if(W.inWater&&g<WATER-2.2){W.drownT=(W.drownT||0)+dt;if(W.drownT>2.5){W.drownT=0;const rd=roadAt(h.pos.x,h.pos.z);W.say('Too deep to wade. You climb back out.');const b=ROADS[0].S[rd?rd.i:0];h.pos.set(b.x+3,groundAt(b.x+3,b.z),b.z)}}else W.drownT=0;
  h.st='free';h.status=h.status||{};animate(h,dt);h.rig.aura.visible=false;h.rig.root.position.copy(h.pos);h.rig.root.visible=!inCar}
function camStep(dt){const t=W.focus();if(inCar){const c=inCar,sp=Math.abs(c.vx);const behind=c.vx<-1?c.yaw:c.yaw+Math.PI;if(!mdown)W.camYaw=lerpAng(W.camYaw,c.yaw+(c.vx<-2?Math.PI:0),1-Math.exp(-dt*2.2));W.camDist=lerp(W.camDist,c.spec.len*1.45+sp*.06,dt*2);W.camPitch=lerp(W.camPitch,.22,dt*2);camera.fov=lerp(camera.fov,62+sp*.35,dt*3);camera.updateProjectionMatrix()}
  else{const h=W.hero;if(!mdown&&Math.hypot(h.vel.x,h.vel.z)>.5&&!(keys.has('KeyS')&&!keys.has('KeyA')&&!keys.has('KeyD')))W.camYaw=lerpAng(W.camYaw,h.yaw,1-Math.exp(-dt*.9));W.camDist=lerp(W.camDist,6.5,dt*2);camera.fov=lerp(camera.fov,58,dt*3);camera.updateProjectionMatrix()}
  const ty=t.y+(inCar?1.4:1.6);const cp=Math.cos(W.camPitch);let d=W.camDist;
  // keep the camera out of walls: walk back from the target and stop just before a solid
  for(let k=.6;k<=W.camDist;k+=.35){const qx=t.x-Math.sin(W.camYaw)*cp*k,qz=t.z-Math.cos(W.camYaw)*cp*k,qy=ty+Math.sin(W.camPitch)*k;if(insideSolid(qx,qz,qy)){d=Math.max(.8,k-.45);break}}
  let px=t.x-Math.sin(W.camYaw)*cp*d,pz=t.z-Math.cos(W.camYaw)*cp*d,py=ty+Math.sin(W.camPitch)*d;const g=groundAt(px,pz)+.6;if(py<g)py=g;
  camPos.lerp(V(px,py,pz),1-Math.exp(-dt*(inCar?9:12)));camLook.lerp(V(t.x,ty,t.z),1-Math.exp(-dt*14));camera.position.copy(camPos);if(W.shake>0){camera.position.x+=rand(-1,1)*W.shake;camera.position.y+=rand(-1,1)*W.shake;W.shake=Math.max(0,W.shake-dt*1.6)}camera.lookAt(camLook)}
function insideSolid(x,z,y){for(const o of solidsNear(x,z)){if(o.type==='c'){if(o.r>.6&&Math.hypot(x-o.x,z-o.z)<o.r+.2&&y<groundAt(o.x,o.z)+6)return true;continue}if(o.hw<.5&&o.hd<.5)continue;const c=Math.cos(o.yaw),s=Math.sin(o.yaw),lx=(x-o.x)*c-(z-o.z)*s,lz=(x-o.x)*s+(z-o.z)*c;if(Math.abs(lx)<o.hw+.25&&Math.abs(lz)<o.hd+.25&&y<groundAt(o.x,o.z)+(o.h||7.5))return true}return false}
function lerpAng(a,b,k){let d=((b-a+Math.PI)%(TAU)+TAU)%TAU-Math.PI;return a+d*k}

/* ---------------- interactions ---------------- */
let hot=null,hotT=0;
function nearDoor(c){const s=c.spec,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),dx=c.pos.x-cs*(s.wid/2+.6),dz=c.pos.z+sn*(s.wid/2+.6);return Math.hypot(W.hero.pos.x-dx,W.hero.pos.z-dz)<2.2||Math.hypot(W.hero.pos.x-c.pos.x,W.hero.pos.z-c.pos.z)<s.len*.55+.8}
function enterCar(c){inCar=c;c.eng=true;c.flooded=c.flooded&&c.pos.y<WATER-.5;W.sfx('door');setTimeout(()=>{if(inCar===c){W.sfx('start');engineAudio(true)}},250);c.locked=false;if(c.alarm>0&&c!==myCar){}W.camDist=c.spec.len*1.45}
function exitCar(){const c=inCar;if(!c)return;if(Math.abs(c.vx)>3){W.say('Slow down before you get out.');return}inCar=null;c.eng=false;c.vx=c.vy=c.w=0;engineAudio(false);W.sfx('door');const s=c.spec,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);const p={x:c.pos.x-cs*(s.wid/2+.8),z:c.pos.z+sn*(s.wid/2+.8)};collide(p,.4);W.hero.pos.set(p.x,groundAt(p.x,p.z)+.2,p.z);W.hero.vel.set(0,0,0);W.hero.yaw=c.yaw;if(c===myCar)c.lockArm=true}
function interact(){const h=W.hero;let pr='',act=null;hot=null;
  if(inCar){pr=`<kbd>F</kbd> Get out`;act='exit';if(inCar.flooded)pr+=` · <kbd>R</kbd> Call a tow`;return [pr,act]}
  let bestC=null,bd=99;for(const c of cars){const d=Math.hypot(h.pos.x-c.pos.x,h.pos.z-c.pos.z);if(d<bd&&nearDoor(c)){bd=d;bestC=c}}
  let bestN=null,bn=2.6;for(const f of NPCS){const d=Math.hypot(h.pos.x-f.pos.x,h.pos.z-f.pos.z);if(d<bn){bn=d;bestN=f}}
  if(bestN&&(!bestC||bn<bd)){const D=bestN.npc;if(D.motors)return [`<kbd>E</kbd> Browse cars at Ashford Motors`,'motors:'+NPCS.indexOf(bestN)];return [`<kbd>E</kbd> Talk to ${D.n}`,'talk:'+NPCS.indexOf(bestN)]}
  if(bestC){if(bestC===myCar||!bestC.locked)return [`<kbd>F</kbd> ${bestC===myCar?'Unlock and drive your '+bestC.name:'Drive the '+bestC.name+(bestC.stolen?' (stolen)':'')}`,'enter'];hot=bestC;return [`<span>🔒 Locked ${bestC.name} · hold <kbd>F</kbd> to hotwire</span>${hotT>0?`<svg id="rh-ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="4"/><circle cx="12" cy="12" r="9" fill="none" stroke="#ffd27a" stroke-width="4" stroke-dasharray="${hotT/3.5*56.5} 60" transform="rotate(-90 12 12)"/></svg>`:''}`,'hotwire']}
  if(Math.hypot(h.pos.x-W.garage.x,h.pos.z-W.garage.z)<5)return [`<kbd>E</kbd> Open your garage`,'garage'];
  return ['',null]}
function talk(f){if(W.talk!==f){W.talk=f;f.talkI=0}else{f.talkI++}const D=f.npc,L=D.lines.slice();if(D.owner&&D.robbed)L.unshift('You! You stole my car! I saw you!');
  if(f.talkI>=L.length){W.talk=null;ui.talk.style.display='none';return}ui.talk.innerHTML=`<b>${D.n}</b><p>${L[f.talkI]}</p><small>E to continue</small>`;ui.talk.style.display='block'}
function openPanel(html){ui.panel.innerHTML=html;ui.panel.style.display='block';W.panelOpen=true;ui.panel.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closePanel())}
function closePanel(){ui.panel.style.display='none';W.panelOpen=false}
function statBars(s){const r=(v,a,b)=>clamp((v-a)/(b-a),.08,1)*100;return `<div class="bars"><span>Speed</span><i style="width:${r(s.top,38,62)}%"></i><span>Power</span><i style="width:${r(s.power/s.mass,50,125)}%"></i><span>Grip</span><i style="width:${r(s.grip,.9,1.1)}%"></i><span>Weight</span><i style="width:${r(s.mass,1000,2000)}%"></i></div>`}
function garage(){const sv=umSV();openPanel(`<h2>Your garage</h2><p style="opacity:.75;margin:0">Pick which of your cars waits in the driveway. Buy more at Ashford Motors.</p>${Object.keys(CARS).map(k=>{const s=CARS[k],own=sv.cars.includes(k);return `<div class="rc"><div><b>${s.name}</b>${own?'':' <small style="display:inline">· not owned</small>'}<small>${s.desc}</small>${statBars(s)}</div>${own?`<button class="btn sm" data-car="${k}" ${sv.carSel===k?'disabled':''}>${sv.carSel===k?'In driveway':'Use'}</button>`:''}</div>`}).join('')}<div style="margin-top:12px;text-align:right"><button class="btn ghost sm" data-close>Close</button></div>`);
  ui.panel.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>{sv.carSel=b.dataset.car;umSave();spawnMyCar(true);W.sfx('chirp');closePanel();W.say(`Your ${CARS[sv.carSel].name} is in the driveway.`)})}
function motors(){const sv=umSV();openPanel(`<h2>Ashford Motors</h2><p style="opacity:.75;margin:0">"Every one of them runs like a dream. Mostly." · You have <b style="color:#ffd27a">◉ ${sv.gold||0} gold</b></p>${Object.keys(CARS).map(k=>{const s=CARS[k],own=sv.cars.includes(k);return `<div class="rc"><div><b>${s.name}</b> <small style="display:inline">· ${own?'owned':s.price+' gold'}</small><small>${s.desc}</small>${statBars(s)}</div>${own?'<span style="opacity:.7">Owned</span>':`<button class="btn sm" data-buy="${k}" ${sv.gold<s.price?'disabled':''}>Buy</button>`}</div>`}).join('')}<div style="margin-top:12px;text-align:right"><button class="btn ghost sm" data-close>Close</button></div>`);
  ui.panel.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const k=b.dataset.buy,s=CARS[k];if(sv.gold<s.price)return;sv.gold-=s.price;sv.cars.push(k);sv.carSel=k;umSave();W.sfx('chirp');closePanel();if(myCar&&inCar!==myCar){scene.remove(myCar.m.g);cars.splice(cars.indexOf(myCar),1)}myCar=spawnCar(k,W.motors.x,W.motors.z,W.motors.yaw,{owner:'me',locked:false});W.say(`You bought the ${s.name}! It's parked on the lot, keys in your pocket.`)})}
function spawnMyCar(home){const sv=umSV();if(myCar){if(inCar===myCar)return;scene.remove(myCar.m.g);cars.splice(cars.indexOf(myCar),1);myCar=null}const k=sv.carSel||'hatch';let x=W.garage.x,z=W.garage.z,y=W.garage.yaw;if(!home&&sv.roam&&sv.roam.car&&sv.roam.car.type===k&&groundAt(sv.roam.car.x,sv.roam.car.z)>WATER-.3){x=sv.roam.car.x;z=sv.roam.car.z;y=sv.roam.car.yaw}myCar=spawnCar(k,x,z,y,{owner:'me',locked:true})}
function parkedCars(){const spots=[[TOWNS[1].x-14,TOWNS[1].z+44,0,'sedan','#7a7a80',9],[TOWNS[1].x+44,TOWNS[1].z-8,Math.PI/2,'pickup','#8a2a2a',8],[TOWNS[0].x+20,TOWNS[0].z+22,Math.PI,'pickup','#3a4a6a',4],[TOWNS[1].x-80,TOWNS[1].z-40,0,'hatch','#e8e8e8',10],[TOWNS[1].x+20,TOWNS[1].z+44,Math.PI,'coupe','#2a6a4a',11]];
  spots.forEach(([x,z,y,k,col,own])=>{const c=spawnCar(k,x,z,y,{color:col,owner:own,locked:true});c.ownerName=NPC_DEFS[own]?NPC_DEFS[own].n:'someone'})}

/* ---------------- main ---------------- */
function build(){if(built)return;built=true;scene=new T.Scene();camera=new T.PerspectiveCamera(58,innerWidth/innerHeight,.1,1600);buildSky();buildTerrain();buildRoads();trees();buildTowns();buildMapImage();buildUI();
  NPC_DEFS.forEach((D,i)=>mkNpc(D,i));parkedCars();
  addEventListener('keydown',e=>{if(mode!=='roam')return;if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!e.repeat)pressedK.add(e.code);keys.add(e.code)});
  addEventListener('keyup',e=>{if(mode!=='roam')return;keys.delete(e.code)});
  renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='roam')return;mdown=true;lastMX=e.clientX;lastMY=e.clientY});addEventListener('pointerup',()=>{mdown=false});
  addEventListener('pointermove',e=>{if(mode!=='roam'||!mdown)return;W.camYaw-=(e.clientX-lastMX)*.006;W.camPitch=clamp(W.camPitch+(e.clientY-lastMY)*.004,-.15,1.1);lastMX=e.clientX;lastMY=e.clientY});
  renderer.domElement.addEventListener('wheel',e=>{if(mode!=='roam')return;W.camDist=clamp(W.camDist+e.deltaY*.005,3,14)},{passive:true});
  addEventListener('resize',()=>{if(camera){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}})}
W.enter=()=>{const sv=umSV();if(!sv)return;audio();sv.cars=sv.cars||['hatch'];sv.carSel=sv.carSel||'hatch';umRegister(sv,!!portraits.hero);
  const wasBuilt=built;build();if(!wasBuilt||!W.hero||W.hero.def!==BYID.hero){if(W.hero)scene.remove(W.hero.rig.root);W.hero=mkFighter(BYID.hero,true,0);world.remove(W.hero.rig.root);scene.add(W.hero.rig.root);W.hero.foe=W.hero}
  const r=sv.roam;if(r&&r.x!==undefined){W.hero.pos.set(r.x,groundAt(r.x,r.z),r.z);W.hero.yaw=r.yaw||0}else{W.hero.pos.set(W.home.x+9,groundAt(W.home.x+9,W.home.z),W.home.z);W.hero.yaw=Math.PI/2}
  spawnMyCar(false);inCar=null;W.talk=null;W.panelOpen=false;mode='roam';resetFighters&&0;show(null);$('hud').hidden=true;$('touch').hidden=true;ui.hud.hidden=false;W.camYaw=W.hero.yaw;camPos.copy(W.hero.pos).add(V(0,4,-6));camLook.copy(W.hero.pos);curArea='';
  W.say(r?'Welcome back.':'This is Hollowbrook. Your car is in the garage next to your home. Ashford is far east along Kingsway Road.');W.saveT=0};
W.exit=()=>{save();engineAudio(false);inCar=null;ui.hud.hidden=true;closePanel();ui.talk.style.display='none';ui.map.style.display='none';mode='select';umMap()};
function save(){const sv=umSV();if(!sv||!W.hero)return;const h=inCar?inCar.pos:W.hero.pos;sv.roam={x:h.x,z:h.z,yaw:W.hero.yaw,car:myCar?{type:myCar.type,x:myCar.pos.x,z:myCar.pos.z,yaw:myCar.yaw}:null};umSave()}
let lastNear=0;
W.dbg=()=>({cars,myCar,inCar,NPCS,ROADS,TOWNS,roadAt,terrainH,spawnCar,setIn:c=>{inCar=c;c.eng=true}});
W.frame=dt=>{if(!built)return;dt=Math.min(dt,.05);
  if(pressedK.has('Escape')){if(W.panelOpen)closePanel();else if(ui.map.style.display==='block')ui.map.style.display='none';else{openPanel(`<h2>Paused</h2><p style="opacity:.75">Your progress in the open world is saved automatically.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" data-close>Resume</button><button class="btn ghost sm" id="rh-quit">Journey map</button></div>`);ui.panel.querySelector('#rh-quit').onclick=()=>{closePanel();W.exit()}}}
  if(pressedK.has('KeyM')){const on=ui.map.style.display!=='block';ui.map.style.display=on?'block':'none';if(on)drawBigMap()}
  const [pr,act]=interact();
  if(pressedK.has('KeyE')&&!W.panelOpen){if(W.talk)talk(W.talk);else if(act&&act.startsWith('talk:'))talk(NPCS[+act.split(':')[1]]);else if(act&&act.startsWith('motors:'))motors();else if(act==='garage')garage()}
  if(W.talk&&Math.hypot(W.hero.pos.x-W.talk.pos.x,W.hero.pos.z-W.talk.pos.z)>4){W.talk=null;ui.talk.style.display='none'}
  if(pressedK.has('KeyF')&&!W.panelOpen){if(act==='exit')exitCar();else if(act==='enter'){const c=cars.find(c=>nearDoor(c)&&(c===myCar||!c.locked));if(c){if(c===myCar){W.sfx('chirp');c.flash=.5}enterCar(c)}}}
  if(act==='hotwire'&&keys.has('KeyF')&&hot&&!W.panelOpen){hotT+=dt;if(Math.random()<dt*6)W.sfx('click');
    if(!hot.seen){for(const f of NPCS){if(Math.hypot(f.pos.x-hot.pos.x,f.pos.z-hot.pos.z)<20){hot.seen=true;bubble(f,NPC_DEFS.indexOf(f.npc)===hot.owner?'Hey! That\'s my car!':'Hey! What are you doing?!');if(NPC_DEFS.indexOf(f.npc)===hot.owner)f.npc.robbed=true;break}}}
    if(hotT>=3.5){hotT=0;const c=hot;c.locked=false;c.stolen=true;if(Math.random()<.45||c.seen){c.alarm=7;W.say('The alarm went off! Better drive.')}else W.say('Hotwired. Nobody noticed... this time.');const o=NPC_DEFS[c.owner];if(o)o.robbed=true;enterCar(c)}}else hotT=Math.max(0,hotT-dt*2);
  if(inCar&&pressedK.has('KeyR')&&inCar.flooded){const c=inCar;const rd=roadAt(c.pos.x,c.pos.z);let b=ROADS[0].S[0];let bd=1e9;for(const r of ROADS)for(const s of r.S){if(s.bridge)continue;const d=Math.hypot(s.x-c.pos.x,s.z-c.pos.z);if(d<bd){bd=d;b=s}}c.pos.set(b.x,b.h+.5,b.z);c.flooded=false;c.vx=c.vy=c.w=0;c.eng=true;W.say('The tow truck pulled you back onto the road. That cost you 10 gold.');const sv=umSV();sv.gold=Math.max(0,(sv.gold||0)-10);umSave();engineAudio(true)}
  if(inCar&&pressedK.has('KeyH'))W.sfx('horn');if(inCar&&pressedK.has('KeyL')){inCar.lights=!inCar.lights;W.sfx('click')}
  // simulate
  if(inCar){const thr=(keys.has('KeyW')||keys.has('ArrowUp'))&&!W.panelOpen?1:0,brk=(keys.has('KeyS')||keys.has('ArrowDown'))&&!W.panelOpen?1:0,st=((keys.has('KeyA')||keys.has('ArrowLeft'))?1:0)-((keys.has('KeyD')||keys.has('ArrowRight'))?1:0);
    for(let i=0;i<2;i++)carStep(inCar,dt/2,{thr,brk,steer:st,hb:keys.has('Space')});engineTick(inCar,thr);W.hero.pos.copy(inCar.pos);W.hero.yaw=inCar.yaw;W.hero.rig.root.visible=false}
  else heroStep(dt);
  for(const c of cars){if(c===inCar)continue;if(Math.abs(c.vx)>.05||Math.abs(c.vy)>.05||c.syncNeed){carStep(c,dt,{thr:0,brk:1,steer:0,hb:true});c.syncNeed=false}if(c.alarm>0){c.alarm-=dt;c.flash=.2;if(Math.floor(c.alarm*2.5)!==Math.floor((c.alarm+dt)*2.5))W.sfx('alarm');if(c.alarm<=0)c.flash=0;syncCar(c,0)}else if(c.flash>0)syncCar(c,dt)}
  // your car locks itself when you walk away
  if(myCar&&myCar.lockArm&&!inCar&&Math.hypot(W.hero.pos.x-myCar.pos.x,W.hero.pos.z-myCar.pos.z)>7){myCar.lockArm=false;myCar.locked=true;myCar.flash=.5;syncCar(myCar,0);W.sfx('chirp',.25)}
  const fp=W.focus();for(const f of NPCS){const d=Math.hypot(f.pos.x-fp.x,f.pos.z-fp.z);f.rig.root.visible=d<140;if(d<160)npcStep(f,dt,d<70)}
  camStep(dt);sun.position.set(fp.x+60,120,fp.z+40);sun.target.position.set(fp.x,fp.y,fp.z);W.sky.position.copy(camera.position);
  // HUD
  ui.prompt.innerHTML=pr;ui.prompt.style.display=pr&&!W.panelOpen?'flex':'none';
  if(inCar){ui.speed.style.display='block';ui.speed.querySelector('b').textContent=Math.round(Math.abs(inCar.vx)*3.6);ui.speed.querySelector('small').textContent=(inCar.vx<-.5?'R':inCar.eng?'Gear '+inCar.gear:'Off')+' · km/h · '+inCar.name}else ui.speed.style.display='none';
  const [an,ak]=areaName();if(an!==curArea){curArea=an;ui.area.querySelector('b').textContent=an;ui.area.querySelector('small').textContent=ak;ui.area.classList.add('on');areaT=3.5}if(areaT>0){areaT-=dt;if(areaT<=0)ui.area.classList.remove('on')}
  if(msgT>0){msgT-=dt;if(msgT<=0)ui.msg.classList.remove('on')}
  ui.gold.textContent='◉ '+(umSV().gold||0)+' gold';drawMini();drawBubbles();
  W.saveT+=dt;if(W.saveT>15){W.saveT=0;save()}
  pressedK.clear();renderer.render(scene,camera)};
})();
