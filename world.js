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
// places you travel to: clearings flattened into the land
const SITES=[
  {id:'emberCamp',x:-128,z:-112,r:20,name:'Bandit Camp',area:'Ember Road'},
  {id:'emberShrine',x:-38,z:-588,r:24,name:'Ember Shrine',area:'Ember Canyon'},
  {id:'stormCamp',x:607,z:-509,r:20,name:'Raider Hideout',area:'Cliff Road'},
  {id:'stormShrine',x:664,z:-748,r:22,name:'Storm Shrine',area:'Stormreach Cliffs'},
  {id:'iron',x:304,z:668,r:26,name:'Iron Pass Gate',area:'Iron Pass'},
  {id:'cabin',x:-672,z:536,r:16,name:'Lakeside Cabin',area:'Lake Mere'}];
SITES.forEach(t=>t.h=Math.max(baseH(t.x,t.z),WATER+4));
function townFlat(x,z,h){for(const t of TOWNS){const d=Math.hypot(x-t.x,z-t.z);const k=sm(t.r+60,t.r,d);if(k>0)h=lerp(h,t.h,k)}for(const t of SITES){const d=Math.hypot(x-t.x,z-t.z);const k=sm(t.r+35,t.r,d);if(k>0)h=lerp(h,t.h,k)}return h}
// roads (polylines, densified)
const ROAD_DEFS=[
  {id:'main',name:'Kingsway Road',w:7.5,pts:[[-520,360],[-470,345],[-410,320],[-340,262],[-262,205],[-180,150],[-110,96],[-30,40],[60,-10],[150,-70],[250,-150],[345,-235],[430,-305],[500,-355],[540,-380]]},
  {id:'canyon',name:'Ember Road',w:6.5,pts:[[-180,150],[-170,40],[-150,-80],[-120,-200],[-90,-330],[-60,-470],[-40,-560]]},
  {id:'lake',name:'Lakeside Lane',w:5.5,pts:[[-520,360],[-560,420],[-630,470],[-700,505]]},
  {id:'cliff',name:'Cliff Road',w:6,pts:[[540,-380],[560,-430],[585,-480],[598,-520],[612,-570],[632,-640],[652,-700],[662,-735]]},
  {id:'iron',name:'Iron Pass Road',w:6.5,pts:[[60,-10],[95,80],[140,180],[190,280],[235,390],[268,500],[292,590],[302,650]]}];
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
const WINMAT=[new T.MeshLambertMaterial({color:'#9fc4dd',emissive:'#2a3a44'}),new T.MeshLambertMaterial({color:'#9fc4dd',emissive:'#2a3a44'})],LAMPMAT=new T.MeshBasicMaterial({color:'#d8d0b0'});
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
  const wm=WINMAT[Math.random()<.68?0:1];W.doors=W.doors||[];W.doors.push({x:x+Math.sin(yaw)*(o.d/2+.8),z:z+Math.cos(yaw)*(o.d/2+.8)});const win=(wx,wy,wz,ry)=>{const w2=new T.Group();w2.position.set(wx,wy,wz);w2.rotation.y=ry;g.add(w2);mesh(new T.BoxGeometry(1.1,1.1,.08),wm,0,0,0,0,w2);mesh(new T.BoxGeometry(1.3,.12,.16),mat(o.trim),0,-.6,.04,0,w2);mesh(new T.BoxGeometry(.06,1.1,.1),mat(o.trim),0,0,.04,0,w2);mesh(new T.BoxGeometry(1.1,.06,.1),mat(o.trim),0,0,.04,0,w2)};
  for(let f=0;f<o.fl;f++){const wy=1.9+3.1*f;[-1,1].forEach(q=>{if(f>0||Math.abs(q*o.w*.3)>1.2)win(q*o.w*.3,wy,o.d/2+.02,0);win(q*o.w*.3,wy,-o.d/2-.02,Math.PI)});win(o.w/2+.02,wy,0,Math.PI/2);win(-o.w/2-.02,wy,0,-Math.PI/2)}
  if(o.sign){const s=mesh(new T.BoxGeometry(Math.min(o.w-.6,5.2),.9,.1),new T.MeshLambertMaterial({map:signTex(o.sign,o.signBg,'#f8f0dc',640,112)}),0,2.95,o.d/2+.1,0,g);s.castShadow=false}
  addSolid({type:'box',x,z,hw:o.w/2+.15,hd:o.d/2+.15,yaw});return g}
function noticeBoard(x,z,yaw){const g=new T.Group(),y=groundAt(x,z);g.position.set(x,y,z);g.rotation.y=yaw;scene.add(g);[-1,1].forEach(q=>mesh(new T.BoxGeometry(.14,2.3,.14),mat('#6b4a2e'),q*1.05,1.15,0,0,g));mesh(new T.BoxGeometry(2.3,1.3,.1),mat('#8a6a44'),0,1.6,0,0,g);mesh(new T.BoxGeometry(2.5,.12,.3),mat('#5a3a22'),0,2.32,0,0,g);
  for(let i=0;i<5;i++){const p=mesh(new T.BoxGeometry(.42,.52,.01),mat(['#f4ead2','#e8dcc4','#fff6dc'][i%3]),-.8+i*.4,1.6+(i%2?.18:-.18),.06,0,g);p.rotation.z=rand(-.12,.12)}const s=mesh(new T.BoxGeometry(1.6,.32,.05),new T.MeshLambertMaterial({map:signTex('JOBS','#5a3a22','#ffd27a',300,80)}),0,2.6,0,0,g);s.castShadow=false;W.boards.push({x,z});addSolid({type:'box',x,z,hw:1.2,hd:.2,yaw})}
function shed(x,z,yaw,label,col){const g=new T.Group();g.position.set(x,groundAt(x,z),z);g.rotation.y=yaw;scene.add(g);const W2=8,D2=9;
  mesh(new T.BoxGeometry(W2,3.6,.3),mat('#cfc3ac'),0,1.8,-D2/2,0,g);[-1,1].forEach(q=>mesh(new T.BoxGeometry(.3,3.6,D2),mat('#cfc3ac'),q*W2/2,1.8,0,0,g));mesh(new T.BoxGeometry(W2+.6,.3,D2+.6),mat(col),0,3.75,0,0,g);const fl=mesh(new T.BoxGeometry(W2-.3,.04,D2),mat('#6a6a70'),0,.05,0,0,g);fl.castShadow=false;
  const s=mesh(new T.BoxGeometry(5,.8,.1),new T.MeshLambertMaterial({map:signTex(label,col,'#ffd27a',640,112)}),0,3.1,D2/2+.1,0,g);s.castShadow=false;
  for(let i=0;i<3;i++)mesh(new T.TorusGeometry(.33,.13,6,12),mat('#1c1c20'),-W2/2+.7,.18+i*.26,-D2/2+1,0,g).rotation.x=Math.PI/2;mesh(new T.BoxGeometry(1.6,.9,.6),mat('#b02a2a'),W2/2-1,.45,-D2/2+.6,0,g);mesh(new T.BoxGeometry(2.4,.08,.5),mat('#6b4a2e'),W2/2-.4,1.6,-1,Math.PI/2,g);
  const P=(lx,lz)=>({x:x+lx*Math.cos(yaw)+lz*Math.sin(yaw),z:z-lx*Math.sin(yaw)+lz*Math.cos(yaw)});
  {const p=P(0,-D2/2);addSolid({type:'box',x:p.x,z:p.z,hw:W2/2,hd:.2,yaw})}[-1,1].forEach(q=>{const p=P(q*W2/2,0);addSolid({type:'box',x:p.x,z:p.z,hw:.2,hd:D2/2,yaw})});return g}
function buildHome(Hm,x,z,yaw,o){house(x,z,yaw,o);const fx=Math.sin(yaw),fz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw),d=o.d/2;Hm.door={x:x+fx*(d+1.2),z:z+fz*(d+1.2)};Hm.garage={x:x+fx*(d+6)+sx*(o.w/2+3),z:z+fz*(d+6)+sz*(o.w/2+3),yaw};
  const px=x+fx*(d+3)-sx*(o.w/2+1.5),pz=z+fz*(d+3)-sz*(o.w/2+1.5),py=groundAt(px,pz);mesh(new T.BoxGeometry(.1,1.4,.1),mat('#6b4a2e'),px,py+.7,pz);Hm.signP={x:px,z:pz};Hm.sign=mesh(new T.BoxGeometry(1.5,.75,.06),new T.MeshLambertMaterial({map:signTex('FOR SALE','#b02a2a','#ffffff',420,180)}),px,py+1.5,pz,yaw);Hm.sign.castShadow=false;Hm.shown=false;
  const gp=mesh(new T.BoxGeometry(3.4,.05,6.2),mat('#8a8278'),Hm.garage.x,groundAt(Hm.garage.x,Hm.garage.z)+.05,Hm.garage.z,yaw);gp.castShadow=false}
function lamp(x,z){const y=groundAt(x,z);W.lamps=W.lamps||[];W.lamps.push({x,z,y:y+3.4});mesh(new T.CylinderGeometry(.07,.1,3.6,8),mat('#2a2a30'),x,y+1.8,z);mesh(new T.BoxGeometry(.32,.4,.32),LAMPMAT,x,y+3.7,z);mesh(new T.ConeGeometry(.3,.25,4),mat('#2a2a30'),x,y+4,z,Math.PI/4);addSolid({type:'c',x,z,r:.15})}
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
function tent(x,z,yaw,c){const y=groundAt(x,z);const t=mesh(new T.ConeGeometry(2.2,2.6,4),mat(c),x,y+1.3,z,yaw+Math.PI/4);t.scale.set(1,1,1.3);addSolid({type:'c',x,z,r:1.9})}
function campfire(x,z){const y=groundAt(x,z);for(let i=0;i<7;i++){const a=i/7*TAU;mesh(new T.DodecahedronGeometry(.25,0),mat('#6a6a6a'),x+Math.cos(a)*.7,y+.15,z+Math.sin(a)*.7)}for(let i=0;i<3;i++){const l=mesh(new T.CylinderGeometry(.08,.08,1.1,6),mat('#5a3a22'),x,y+.2,z);l.rotation.set(Math.PI/2,i*1.05,0)}
  const f=mesh(new T.ConeGeometry(.45,1.1,7),glow('#ffb347'),x,y+.65,z);f.castShadow=false;const f2=mesh(new T.ConeGeometry(.28,.8,7),glow('#fff2b0'),x,y+.55,z);f2.castShadow=false;W.fires.push(f,f2);addSolid({type:'c',x,z,r:.8})}
function brazier(x,z,c){const y=groundAt(x,z);mesh(new T.CylinderGeometry(.5,.3,1.2,10),mat('#4a4a50'),x,y+.6,z);const f=mesh(new T.ConeGeometry(.42,1,8),glow(c),x,y+1.6,z);f.castShadow=false;W.fires.push(f);addSolid({type:'c',x,z,r:.5})}
function arch(x,z,yaw,c){const g=new T.Group();g.position.set(x,groundAt(x,z),z);g.rotation.y=yaw;scene.add(g);[-1,1].forEach(q=>{mesh(new T.BoxGeometry(1.1,6,1.1),mat('#8a8278'),q*3.2,3,0,0,g)});mesh(new T.BoxGeometry(8.6,1,1.5),mat('#8a8278'),0,6.4,0,0,g);mesh(new T.BoxGeometry(7.4,.5,1.2),mat('#6a645c'),0,5.6,0,0,g);
  const gem=mesh(new T.OctahedronGeometry(.6),glow(c),0,5,0,0,g);gem.castShadow=false;W.gems.push(gem);[-1,1].forEach(q=>{const sn=Math.sin(yaw),cs=Math.cos(yaw);addSolid({type:'c',x:x+cs*q*3.2,z:z-sn*q*3.2,r:.75})})}
function buildSites(){W.fires=W.fires||[];W.gems=W.gems||[];const S=Object.fromEntries(SITES.map(t=>[t.id,t]));
  // bandit camp on Ember Road
  {const c=S.emberCamp;tent(c.x-7,c.z-5,.3,'#7a4a2a');tent(c.x+6,c.z-7,-.4,'#6a3a2a');tent(c.x+8,c.z+6,.9,'#8a5a3a');campfire(c.x,c.z);crate(c.x-9,c.z+5,1.1);crate(c.x-8,c.z+6.3,.8);barrel(c.x+3,c.z+9);fence(c.x-14,c.z-12,c.x-14,c.z+12)}
  // Ember Shrine: an ancient stone arch over a fire pit at the end of Ember Road
  {const c=S.emberShrine,y=groundAt(c.x,c.z);mesh(new T.CylinderGeometry(9,10,.6,24),mat('#8a6a5a'),c.x,y+.3,c.z);arch(c.x,c.z-4,0,'#ff6a2a');brazier(c.x-5,c.z+3,'#ff6a2a');brazier(c.x+5,c.z+3,'#ff6a2a');for(let i=0;i<10;i++){const a=i/10*TAU,r=12+rand(0,4);mesh(new T.ConeGeometry(rand(1,2),rand(4,9),5),mat('#9a4a2a'),c.x+Math.cos(a)*r,y+2,c.z+Math.sin(a)*r-3)}}
  // raider hideout on Cliff Road
  {const c=S.stormCamp;tent(c.x-6,c.z+5,0,'#3a4a6a');tent(c.x+7,c.z+3,1,'#2a3a5a');campfire(c.x,c.z);crate(c.x+4,c.z-7,1);barrel(c.x-5,c.z-6);barrel(c.x-6.2,c.z-5)}
  // Storm Shrine on the high cliffs
  {const c=S.stormShrine,y=groundAt(c.x,c.z);mesh(new T.CylinderGeometry(8,9,.6,24),mat('#6a7080'),c.x,y+.3,c.z);arch(c.x,c.z-3,0,'#9fd4ff');brazier(c.x-5,c.z+3,'#cfe9ff');brazier(c.x+5,c.z+3,'#cfe9ff');for(let i=0;i<6;i++){const a=i/6*TAU;mesh(new T.CylinderGeometry(.35,.45,5,8),mat('#7a8090'),c.x+Math.cos(a)*7,y+2.5,c.z+Math.sin(a)*7);addSolid({type:'c',x:c.x+Math.cos(a)*7,z:c.z+Math.sin(a)*7,r:.5})}}
  // Iron Pass gate: stone walls and a great iron door
  {const c=S.iron,y=groundAt(c.x,c.z),g=new T.Group();g.position.set(c.x,y,c.z+8);scene.add(g);[-1,1].forEach(q=>{mesh(new T.BoxGeometry(14,9,3),mat('#7a7468'),q*10,4.5,0,0,g);mesh(new T.BoxGeometry(4,11,4),mat('#6a645c'),q*4,5.5,0,0,g);addSolid({type:'box',x:c.x+q*10,z:c.z+8,hw:7,hd:1.5,yaw:0});addSolid({type:'box',x:c.x+q*4,z:c.z+8,hw:2,hd:2,yaw:0})});
    mesh(new T.BoxGeometry(4.2,7,.6),mat('#4a4e58'),0,3.5,0,0,g);for(let i=0;i<5;i++)mesh(new T.BoxGeometry(4.3,.2,.7),mat('#2a2a30'),0,1+i*1.4,0,0,g);addSolid({type:'box',x:c.x,z:c.z+8,hw:2.1,hd:.4,yaw:0});const s=mesh(new T.BoxGeometry(5,1,.1),new T.MeshLambertMaterial({map:signTex('IRON PASS','#4a4e58','#ffd27a',600,120)}),0,8.4,-1.6,0,g);s.castShadow=false;brazier(c.x-6,c.z+3,'#ffb070');brazier(c.x+6,c.z+3,'#ffb070')}
  // beacons over every place you can go
  W.beacons=[];LOCS.forEach(L=>{const st=L.site?S[L.site]:null,x=L.x!==undefined?L.x:st.x,z=L.z!==undefined?L.z:st.z,y=groundAt(x,z);L.x=x;L.z=z;
    const bm=new T.Mesh(new T.CylinderGeometry(1.1,1.1,80,16,1,true),new T.MeshBasicMaterial({color:L.col,transparent:true,opacity:.18,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));bm.position.set(x,y+40,z);scene.add(bm);
    const rg=new T.Mesh(new T.RingGeometry(1.6,2,40),new T.MeshBasicMaterial({color:L.col,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));rg.rotation.x=-Math.PI/2;rg.position.set(x,y+.08,z);scene.add(rg);L.beam=bm;L.ring=rg})}
function trees(){const N=2600,trunkG=new T.CylinderGeometry(.18,.28,2.6,6),pineG=new T.ConeGeometry(1.6,4.6,7),roundG=new T.IcosahedronGeometry(2.1,1);
  const trunk=new T.InstancedMesh(trunkG,mat('#6b4a2e'),N),pine=new T.InstancedMesh(pineG,mat('#2f6a3a'),N),round=new T.InstancedMesh(roundG,mat('#4f8a3a'),N);[trunk,pine,round].forEach(m=>{m.castShadow=true;m.receiveShadow=true;scene.add(m)});
  const o=new T.Object3D();let nt=0,np=0,nr=0,tries=0;while(nt<N&&tries<N*12){tries++;const x=rand(-HALF+60,HALF-60),z=rand(-HALF+60,HALF-60);const forest=vn(x*.004+40,z*.004-12);if(forest<-.05&&Math.random()>.12)continue;
    const h=terrainH(x,z);if(h<WATER+1.5||h>44)continue;if(TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+18)||SITES.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+8))continue;const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+6)continue;
    const s=rand(.75,1.35),isPine=vn(x*.01,z*.01)>-.1;o.position.set(x,h+1.3*s,z);o.rotation.set(0,rand(0,TAU),0);o.scale.set(s,s,s);o.updateMatrix();trunk.setMatrixAt(nt++,o.matrix);
    if(isPine){o.position.y=h+(2.6+2)*s;o.updateMatrix();pine.setMatrixAt(np++,o.matrix)}else{o.position.y=h+(2.6+1.4)*s;o.scale.set(s,s*.85,s);o.updateMatrix();round.setMatrixAt(nr++,o.matrix)}addSolid({type:'c',x,z,r:.35*s})}
  trunk.count=nt;pine.count=np;round.count=nr;
  const rk=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),mat('#8a8780'),400);let nk=0;for(let i=0;i<1600&&nk<400;i++){const x=rand(-HALF+40,HALF-40),z=rand(-HALF+40,HALF-40),h=terrainH(x,z);if(h<WATER+.5||TOWNS.some(t=>Math.hypot(x-t.x,z-t.z)<t.r+10))continue;const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+3)continue;const s=rand(.4,1.6);o.position.set(x,h+s*.3,z);o.rotation.set(rand(0,3),rand(0,3),rand(0,3));o.scale.set(s,s*.7,s);o.updateMatrix();rk.setMatrixAt(nk++,o.matrix);if(s>.9)addSolid({type:'c',x,z,r:s*.8})}rk.count=nk;rk.castShadow=true;rk.receiveShadow=true;scene.add(rk);
  const fl=new T.InstancedMesh(new T.SphereGeometry(.12,5,4),new T.MeshLambertMaterial({color:'#ffffff'}),1500),fc=new T.Color();let nf=0;for(let i=0;i<6000&&nf<1500;i++){const x=rand(-HALF+60,HALF-60),z=rand(-HALF+60,HALF-60),h=terrainH(x,z);if(h<WATER+1||vn(x*.02,z*.02)<.25)continue;const rd=roadAt(x,z);if(rd&&rd.d<rd.r.w/2+2)continue;o.position.set(x,h+.15,z);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();fl.setMatrixAt(nf,o.matrix);fl.setColorAt(nf,fc.set(['#f2e05a','#ff7aa8','#ffffff','#b48cff'][nf%4]));nf++}fl.count=nf;scene.add(fl)}
function buildTowns(){const H=TOWNS[0],A=TOWNS[1];
  // ---- Hollowbrook Village: cottages around a green, your home, the training yard and a lake lane
  const hx=H.x,hz=H.z;
  W.home={x:hx-30,z:hz+24,yaw:Math.PI/2};W.wardrobe={x:hx-24.6,z:hz+24};LOCS[0].x=hx-40;LOCS[0].z=hz-74;house(W.home.x,W.home.z,W.home.yaw,{w:9,d:8,wall:'#efe4cc',roof:'#3a5a8a',sign:'Home',signBg:'#3a5a8a'});
  // garage next to home (open front)
  {const gx=hx-30,gz=hz+38,g=new T.Group();g.position.set(gx,groundAt(gx,gz),gz);g.rotation.y=Math.PI/2;scene.add(g);mesh(new T.BoxGeometry(6.4,3,.3),mat('#d8ccb4'),0,1.5,-3.5,0,g);mesh(new T.BoxGeometry(.3,3,7),mat('#d8ccb4'),-3.2,1.5,0,0,g);mesh(new T.BoxGeometry(.3,3,7),mat('#d8ccb4'),3.2,1.5,0,0,g);mesh(new T.BoxGeometry(6.9,.3,7.4),mat('#3a5a8a'),0,3.15,0,0,g);mesh(new T.BoxGeometry(6.2,.04,7),mat('#8a8278'),0,.06,0,0,g);
    const s=mesh(new T.BoxGeometry(3,.6,.1),new T.MeshLambertMaterial({map:signTex('Garage','#3a5a8a','#f8f0dc',400,96)}),0,2.6,3.6,0,g);s.castShadow=false;
    addSolid({type:'box',x:gx+3.5*Math.sin(Math.PI/2)*-1,z:gz,hw:.2,hd:3.3,yaw:Math.PI/2});addSolid({type:'box',x:gx,z:gz-3.2,hw:3.6,hd:.2,yaw:Math.PI/2});addSolid({type:'box',x:gx,z:gz+3.2,hw:3.6,hd:.2,yaw:Math.PI/2});W.garage={x:gx+5,z:gz,yaw:Math.PI/2}}
  house(hx+12,hz-32,0,{w:8,d:7,wall:'#dfe6e0',roof:'#2a5a7a',sign:'Barber',signBg:'#2a5a7a'});W.barber={x:hx+12,z:hz-26.5};{const y=groundAt(hx+15.2,hz-28);mesh(new T.CylinderGeometry(.12,.12,1.6,10),new T.MeshLambertMaterial({map:signTex('     ','#ffffff','#fff',64,64)}),hx+15.6,y+1.2,hz-28.4);[0,1,2].forEach(i=>mesh(new T.TorusGeometry(.125,.02,4,12),glow(i%2?'#c8442a':'#2a5a9a'),hx+15.6,y+.7+i*.4,hz-28.4).rotation.x=Math.PI/2)}
  const cot=[[hx-8,hz-30,0,'#e8d6b4','#8a3a2a'],[hx+34,hz-14,-Math.PI/2,'#f2e2c8','#7a2a2a'],[hx+36,hz+12,-Math.PI/2,'#e6d2b0','#4a5a3a'],[hx+14,hz+36,Math.PI,'#efe0c4','#8a5a2a'],[hx-8,hz+40,Math.PI,'#e4dccc','#6a3a5a'],[hx-34,hz-6,Math.PI/2,'#efe6d2','#8a3a2a']];
  cot.forEach(([x,z,y,w,r])=>house(x,z,y,{w:rand(7,9),d:rand(6,7.5),wall:w,roof:r}));
  house(hx+30,hz-40,0,{w:11,d:8,wall:'#d8c8a8',roof:'#5a3a2a',sign:'Hollowbrook Inn',signBg:'#5a3a22'});
  house(hx-26,hz-34,0,{w:9,d:7,wall:'#e8dcc0',roof:'#2f5a3a',sign:'Old Mill Store',signBg:'#2f5a3a'});
  well(hx,hz);[[-12,-12],[12,-12],[12,12],[-12,12]].forEach(([a,b])=>lamp(hx+a,hz+b));training(hx-40,hz-60);W.yard={x:hx-40,z:hz-60};house(hx-40,hz-80,0,{w:13,d:8,wall:'#e6dccb',roof:'#7a2a2a',sign:"Oren's Gym",signBg:'#7a2a2a'});
  {const mx=hx+46,mz=hz+32,yaw=-Math.PI/2;shed(mx,mz,yaw,"Brann's Garage",'#3a3a40');W.mech={x:mx,z:mz};W.mechNpc={x:mx-5.4,z:mz+5.6};pump(mx-7,mz-8,0);W.pumps=[{x:mx-7,z:mz-8}]}
  stall(hx+8,hz-14,0,'#c8442a');stall(hx-8,hz+14,Math.PI,'#2f6a8a');[[4,18],[5,19.5],[-16,-4]].forEach(([a,b])=>barrel(hx+a,hz+b));crate(hx+18,hz+2,1);crate(hx+19.2,hz+2.4,.8);
  signpost(hx+58,hz-20,-Math.PI*.75,[['Ashford  →',1],['← Hollowbrook',-1]]);
  // ---- Ashford Market Town: square, fountain, shops, motors, fuel
  const ax=A.x,az=A.z;fountain(ax,az);
  W.tailor={x:ax+26,z:az-16.8};W.spots={bakery:{x:ax,z:az-22.5,n:'Ashford Bakery'},tea:{x:ax-28,z:az+18.5,n:'Tea House'},hall:{x:ax+23,z:az+4,n:'Town Hall'},clinic:{x:ax-2,z:az+24.5,n:'Clinic'},inn:{x:hx+30,z:hz-34.5,n:'Hollowbrook Inn'}};W.boards=[];noticeBoard(hx+6,hz-6,Math.PI*.25);noticeBoard(ax+9,az+9,-Math.PI*.75);
  const shops=[[ax-26,az-22,0,'General Store','#2f4f6a'],[ax,az-28,0,'Ashford Bakery','#8a5a2a'],[ax+26,az-22,0,'Tailor','#6a3a5a'],[ax+30,az+4,-Math.PI/2,'Town Hall','#4a4a5a'],[ax+26,az+26,Math.PI,'Library','#3a5a4a'],[ax-2,az+30,Math.PI,'Clinic','#3a6a8a'],[ax-28,az+24,Math.PI,'Tea House','#7a3a2a']];
  shops.forEach(([x,z,y,n,c])=>house(x,z,y,{w:10,d:8,fl:2,wall:['#e8dcc4','#dfe2e6','#efe2cc','#e0d6c2'][Math.floor(Math.random()*4)],roof:c,sign:n,signBg:c}));
  [[ax-60,az-60],[ax-40,az-64],[ax+50,az-62],[ax+70,az-30],[ax+72,az+30],[ax+40,az+66],[ax-30,az+66],[ax-66,az+40],[ax+10,az-70],[ax-70,az-20]].forEach(([x,z])=>house(x,z,Math.round(rand(0,3))*Math.PI/2,{w:rand(7,10),d:rand(6,8),fl:Math.random()<.5?2:1,wall:['#e8dcc4','#dfe6e0','#f2e2c8','#e6d2b0'][Math.floor(Math.random()*4)],roof:['#8a3a2a','#3a5a8a','#4a5a3a','#6a4a3a'][Math.floor(Math.random()*4)]}));
  // motors lot
  const mx=ax-58,mz=az+2;house(mx-6,mz,Math.PI/2,{w:12,d:9,wall:'#f2f2f2',roof:'#2a2a30',sign:'Ashford Motors',signBg:'#b02a2a'});{const g=mesh(new T.BoxGeometry(18,.06,16),mat('#6a6a70'),mx+8,groundAt(mx+8,mz)+.05,mz);g.castShadow=false}W.motors={x:mx+8,z:mz,yaw:Math.PI/2};
  // fuel station on the edge of town
  const fx=ax-80,fz=az-46;{const y=groundAt(fx,fz);[[-4,-3],[4,-3],[-4,3],[4,3]].forEach(([a,b])=>{mesh(new T.BoxGeometry(.3,4.4,.3),mat('#e8e8e8'),fx+a,y+2.2,fz+b);addSolid({type:'c',x:fx+a,z:fz+b,r:.25})});mesh(new T.BoxGeometry(10,.5,8),mat('#e8e8e8'),fx,y+4.6,fz);mesh(new T.BoxGeometry(10.1,.25,8.1),glow('#c8442a'),fx,y+4.3,fz);pump(fx-1.5,fz,0);pump(fx+1.5,fz,0);W.pumps.push({x:fx,z:fz});const s=mesh(new T.BoxGeometry(3,1,.1),new T.MeshLambertMaterial({map:signTex('FUEL','#c8442a','#ffffff',300,100)}),fx,y+5.4,fz+4.05);s.castShadow=false}
  [[-16,-16],[16,-16],[16,16],[-16,16],[0,-20],[0,20],[-20,0],[20,0]].forEach(([a,b])=>lamp(ax+a,az+b));
  stall(ax-10,az-12,0,'#f2c14e');stall(ax+10,az-12,0,'#7fd65a');stall(ax+12,az+12,Math.PI,'#ff9a3d');
  signpost(ax-70,az+40,Math.PI*.25,[['Hollowbrook  →',1],['← Ashford',-1]]);
  buildHome(HOMES[1],ax+56,az+44,-Math.PI/2,{w:9,d:8,fl:2,wall:'#e8e0d0',roof:'#2f4f6a'});
  buildHome(HOMES[2],-672,536,Math.atan2(-32,-35),{w:8,d:7,wall:'#9a7650',roof:'#4a3a2a',trim:'#5a3a22'});
  buildSites()}

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
for(const k in CARS)CARS[k].kind=k;W.CARS=CARS;
// the places in the world where your story happens
const LOCS=[
  {id:'gym',act:'spar',col:'#ffd27a',name:"Oren's Gym",prompt:sv=>sv.f.trained?'Spar with Master Oren':'Train with Master Oren'},
  {id:'emberCamp',site:'emberCamp',act:'ember_camp',col:'#ff8a3d',name:'Bandit Camp',prompt:sv=>'Clear the bandit camp',req:sv=>sv.f.trained,lock:"Train at Oren's Gym in Hollowbrook first."},
  {id:'emberShrine',site:'emberShrine',act:'ember_shrine',col:'#ff6a2a',name:'Ember Shrine',prompt:sv=>'Take the Trial of Embers',req:sv=>sv.f.trained&&sv.f.emberCamp,lock:'Clear the bandit camp on Ember Road first.'},
  {id:'stormCamp',site:'stormCamp',act:'storm_camp',col:'#6fb6ff',name:'Raider Hideout',prompt:sv=>'Clear the raider hideout',req:sv=>sv.f.trained,lock:"Train at Oren's Gym in Hollowbrook first."},
  {id:'stormShrine',site:'stormShrine',act:'storm_shrine',col:'#cfe9ff',name:'Storm Shrine',prompt:sv=>'Take the Trial of Thunder',req:sv=>sv.f.trained&&sv.f.stormCamp,lock:'Clear the raider hideout on Cliff Road first.'},
  {id:'iron',site:'iron',act:'boss',col:'#ffb070',name:'Iron Pass Gate',prompt:sv=>sv.f.boss?'Challenge Anvil again':'Challenge Anvil, Master of Metal',req:sv=>!!sv.el,lock:'Anvil only fights those who carry an element. Earn one at a shrine first.'}];
const cars=[];let myCar=null,inCar=null;
function buildCarMesh(spec,color){const g=new T.Group(),L=spec.len,Wd=spec.wid,body=mat(color),dk=mat('#2a2a30'),chrome=mat('#d0d4da'),glass=new T.MeshPhongMaterial({color:'#2a3a4a',shininess:120,specular:'#9fc4dd',transparent:true,opacity:.85});
  const base=spec.wr+.12,bh=.55,type=spec.kind;
  const B=(w,h,d,m,x,y,z)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
  B(Wd,bh,L,body,0,base+bh/2,0);B(Wd+.04,.16,.32,dk,0,base+.1,L/2-.1);B(Wd+.04,.16,.32,dk,0,base+.1,-L/2+.1);
  let cz=0,cl=L*.45,ch=spec.hgt-base-bh;if(type==='hatch'){cz=-L*.08;cl=L*.55}if(type==='coupe'){cz=-L*.1;cl=L*.38;ch*=.95}if(type==='pickup'){cz=L*.12;cl=L*.32}
  const cab=B(Wd*.9,ch,cl,body,0,base+bh+ch/2,cz);B(Wd*.92,ch*.62,cl*.96,glass,0,base+bh+ch*.5,cz);
  const ws=B(Wd*.86,ch*.75,.06,glass,0,base+bh+ch*.45,cz+cl/2+.02);ws.rotation.x=-.45;const rw=B(Wd*.86,ch*.7,.06,glass,0,base+bh+ch*.45,cz-cl/2-.02);rw.rotation.x=.4;
  B(Wd*.92,.05,cl*.9,body,0,base+bh+ch+.02,cz);
  if(type==='pickup'){const bz=-L*.22,bl=L*.48;B(.1,.45,bl,body,Wd/2-.05,base+bh+.22,bz);B(.1,.45,bl,body,-Wd/2+.05,base+bh+.22,bz);B(Wd,.45,.1,body,0,base+bh+.22,bz-bl/2)}
  // lights, grille, plates, mirrors, handles, door seams
  const hl=[],tl=[];[-1,1].forEach(q=>{hl.push(B(.32,.14,.05,new T.MeshBasicMaterial({color:'#fffbe6'}),q*(Wd/2-.25),base+bh*.68,L/2+.01));tl.push(B(.3,.13,.05,new T.MeshBasicMaterial({color:'#7a1010'}),q*(Wd/2-.24),base+bh*.7,-L/2-.01));
    const m=B(.08,.1,.16,dk,q*(Wd/2+.06),base+bh+ch*.25,cz+cl/2-.25);B(.08,.03,.18,chrome,q*(Wd/2+.01),base+bh*.75,cz+.2);B(.012,bh*.85,.02,dk,q*(Wd/2+.005),base+bh*.5,cz-cl*.05)});
  B(Wd*.4,.16,.04,dk,0,base+bh*.5,L/2+.01);const pl=B(.5,.13,.03,mat('#f4f0e0'),0,base+.2,L/2+.02);B(.5,.13,.03,mat('#f4f0e0'),0,base+.2,-L/2-.02);
  const wheels=[];[[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx,sz])=>{const piv=new T.Group();piv.position.set(sx*(Wd/2-.08),spec.wr,sz*spec.wb/2);g.add(piv);const w=new T.Mesh(new T.CylinderGeometry(spec.wr,spec.wr,.26,16),mat('#1c1c20'));w.rotation.z=Math.PI/2;w.castShadow=true;piv.add(w);
    const hub=new T.Mesh(new T.CylinderGeometry(spec.wr*.55,spec.wr*.55,.27,10),chrome);hub.rotation.z=Math.PI/2;piv.add(hub);const sp=new T.Mesh(new T.BoxGeometry(.28,spec.wr*.9,.06),dk);sp.position.x=sx*.01;w.add(sp);wheels.push({piv,w,front:sz>0})});
  return {g,wheels,hl,tl}}
function spawnCar(type,x,z,yaw,o){const spec=(o&&o.spec)||CARS[type],m=buildCarMesh(spec,(o&&o.color)||spec.color);scene.add(m.g);
  const c=Object.assign({type,spec,m,pos:V(x,groundAt(x,z)+.2,z),yaw,vx:0,vy:0,w:0,vyU:0,steer:0,rpm:850,gear:1,eng:false,shiftT:0,owner:null,locked:true,stolen:false,alarm:0,flash:0,pitch:0,roll:0,spin:0,dmg:0,fuel:.4+Math.random()*.5,flooded:false,name:spec.name},o||{});cars.push(c);syncCar(c,0);return c}
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
  let Fe=0;if(thr>0)Fe=thr*Math.min(s.mass*s.acc*(c.onRoad?1:.8),s.power/Math.max(spd,1))*(c.shiftT>0?.45:1)*(c.dmg>80?Math.max(.62,1-(c.dmg-80)/450):1);
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
  {n:'Brann the Smith',town:0,mech:true,body:'#3a3a40',acc:'#ff8a3d',head:'bald',skin:'#6b4630',lines:['The road east is long, but it is a good road. I laid half those stones myself.','If you ever crack a sword, bring it here. Or a fender.','Drive your car into my workshop and I\'ll repair it, tune it or give it a new coat of paint. Fair prices.']},
  {n:'Master Oren',town:0,body:'#4a3a2a',acc:'#e8d2a0',head:'straw',skin:'#c68a5e',yard:true,lines:['Out here the world is wide. Walk it. Drive it. Learn where everything is.','A fighter who knows the land wins before the fight starts.']},
  {n:'Kessa',town:1,body:'#2e6f73',acc:'#ffffff',head:'fedora',skin:'#e0b08a',hair:['swept','#1a1410'],lines:['Welcome to Ashford! Best market for a hundred miles.','The fountain? Built by the first mayor. Locals toss in a coin for luck. I just like the sound.']},
  {n:'Dalton',town:1,body:'#1f2a3a',acc:'#c0c0c0',head:'visor',skin:'#c68a5e',motors:true,lines:['Ashford Motors, finest cars on Kingsway Road. Have a look around.']},
  {n:'Rosa the Baker',town:1,body:'#f2e2c8',acc:'#c8442a',head:'bald',hair:['long','#3a2a1a'],skin:'#9a6440',lines:['Fresh bread, warm out of the oven. Take a smell, it is free.','You came all the way from Hollowbrook? On foot? You need a car, love.']},
  {n:'Officer Hale',town:1,nightOwl:true,body:'#1f3a6a',acc:'#f2c14e',head:'helmg',skin:'#e0b08a',lines:['Keep it slow through town. There are kids around the fountain.','If your car gets stolen, report it here. We keep an eye on the roads.']},
  {n:'Jun',town:1,nightOwl:true,body:'#5a2a6a',acc:'#c9b3ff',head:'hood',skin:'#f1d2b6',lines:['Heard a spirit lives up in Ember Canyon. The road is closed by a rockslide though.','Some say the shrines will open again soon. Some say a lot of things.']},
  {n:'Fen the Barber',town:0,body:'#f4f0e0',acc:'#2a5a7a',head:'bald',hair:['quiff','#1a1410'],skin:'#c68a5e',shop:'barber',lines:['Sit down, sit down.']},
  {n:'Madame Lio',town:1,body:'#6a3a5a',acc:'#f2c14e',head:'bald',hair:['bun','#e8e2d6'],skin:'#e0b08a',shop:'tailor',lines:['Fabric is a fighter\'s second skin, dear.']},
  {n:'Dr. Sana',town:1,body:'#f4f4f4',acc:'#3a6a8a',head:'bald',hair:['bun','#1a1410'],skin:'#9a6440',clinic:true,lines:['Welcome to the clinic. I only just opened it.','I\'m running low on lakeroot. It only grows on the shore of Lake Mere.']},
  {n:'Ivo',town:1,body:'#8a5a1f',acc:'#ffe2a3',head:'cowl',skin:'#6b4630',lines:['The Tea House does the best ginger tea in the valley. Go on, treat yourself.']},
  {n:'Hooded stranger',town:1,thief:true,body:'#1a1a20',acc:'#3a3a40',head:'hood',skin:'#c68a5e',lines:['...']}];
function mkNpc(D,i){const id='npc_'+i;const def={id,name:D.n,title:'',el:'unmarked',hp:60,spd:2,pow:1,range:2,stats:[1,1,1,1],body:D.body,accent:D.acc,head:D.head,weapon:D.n==='Master Oren'?'staff':'none',size:D.small?.78:1};
  BYID[id]=def;KITS[id]={passive:['',''],q:null,e:null,r:null};SKIN[id]=D.skin;if(D.hair)HAIR[id]=D.hair;MELEE[id]=[1,1,1];STYLE[id]='blade';
  const f=mkFighter(def,false,0);world.remove(f.rig.root);scene.add(f.rig.root);const t=TOWNS[D.town];let hx=t.x+rand(-t.r*.5,t.r*.5),hz=t.z+rand(-t.r*.5,t.r*.5);if(D.yard){hx=W.yard.x;hz=W.yard.z+2}if(D.motors){hx=W.motors.x-2;hz=W.motors.z+5}if(D.shop){const sp=W[D.shop];hx=sp.x+2.2;hz=sp.z+1.4}if(D.clinic){hx=W.spots.clinic.x+2;hz=W.spots.clinic.z-1}if(D.mech){hx=W.mechNpc.x;hz=W.mechNpc.z}
  const p={x:hx,z:hz};collide(p,.6);f.pos.set(p.x,groundAt(p.x,p.z),p.z);f.yaw=rand(0,TAU);f.foe=f;const dr=(W.doors||[]).reduce((b,o)=>{const d=Math.hypot(o.x-p.x,o.z-p.z);return d<b[0]?[d,o]:b},[1e9,{x:p.x,z:p.z}])[1];const shopK=!!(D.motors||D.shop||D.mech||D.clinic);Object.assign(f,{door:dr,station:{x:p.x,z:p.z},wake:shopK?7:6+rand(0,1.2),sleep:shopK?21:20.4+rand(0,1.5),indoors:!!D.thief,npc:D,home:{x:p.x,z:p.z},tgt:null,wait:rand(1,5),talkI:0,static:!!(D.yard||D.motors||D.shop||D.clinic||D.mech),bubble:null,bubT:0});NPCS.push(f);return f}
function npcStep(f,dt,near){const D=f.npc;const awake=npcAwake(f);
  if(awake&&f.indoors){f.indoors=false;f.pos.set(f.door.x,groundAt(f.door.x,f.door.z),f.door.z);f.commute=f.station}
  else if(!awake&&!f.indoors&&!f.commute&&W.talk!==f){f.commute=f.door;f.tgt=null}
  if(f.commute){if(walkTo(f,f.commute.x,f.commute.z,D.small?1.9:1.5,dt)){if(!awake){f.indoors=true;f.rig.root.visible=false}f.commute=null}f.rig.aura.visible=false;f.rig.root.position.copy(f.pos);f.rig.root.rotation.y=f.yaw;return}
  if(f.indoors)return;
  f.greetT=(f.greetT===undefined?rand(1,12):f.greetT)-dt;if(near&&f.greetT<=0&&!inCar&&W.talk!==f&&!(f.bubT>0)&&Math.hypot(W.hero.pos.x-f.pos.x,W.hero.pos.z-f.pos.z)<4){f.greetT=rand(40,70);bubble(f,greeting(D))}if(f.dodge>0){f.dodge-=dt;f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;f.vel.x*=Math.pow(.05,dt);f.vel.z*=Math.pow(.05,dt)}
  else if(W.talk===f||f.static){f.vel.set(0,0,0);if(W.talk===f||(near&&f.static))f.yaw=turnTo(f.yaw,Math.atan2(W.hero.pos.x-f.pos.x,W.hero.pos.z-f.pos.z),4*dt)}
  else{if(!f.tgt){f.wait-=dt;f.vel.set(0,0,0);if(f.wait<=0){const a=rand(0,TAU),r=rand(4,D.town===1?30:22);f.tgt={x:f.home.x+Math.cos(a)*r,z:f.home.z+Math.sin(a)*r}}}
    else{const dx=f.tgt.x-f.pos.x,dz=f.tgt.z-f.pos.z,d=Math.hypot(dx,dz);if(d<.6||f.stuck>3){f.tgt=null;f.stuck=0;f.wait=rand(2,7)}else{const sp=D.small?1.9:1.35;f.vel.set(dx/d*sp,0,dz/d*sp);f.yaw=turnTo(f.yaw,Math.atan2(dx,dz),5*dt);const ox=f.pos.x,oz=f.pos.z;f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;const p={x:f.pos.x,z:f.pos.z};if(collide(p,.35)){f.stuck=(f.stuck||0)+dt}f.pos.x=p.x;f.pos.z=p.z}}}
  // dodge speeding cars
  for(const c of cars){const sp=Math.abs(c.vx);if(sp<4||c.ai)continue;const d=Math.hypot(c.pos.x-f.pos.x,c.pos.z-f.pos.z);if(d<c.spec.len*.6+1.2&&!(f.dodge>0)){const nx=(f.pos.x-c.pos.x)/(d||1),nz=(f.pos.z-c.pos.z)/(d||1);f.vel.set(nx*7,0,nz*7);f.dodge=.6;bubble(f,['Whoa!','Watch it!','Hey! Slow down!','Are you mad?!'][Math.floor(Math.random()*4)])}}
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
.rh-obj{position:absolute;left:16px;top:16px;max-width:min(360px,60vw);background:rgba(10,8,26,.78);border-left:4px solid #ffd27a;border-radius:10px;padding:10px 14px;display:none}.rh-obj b{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffd27a}.rh-obj p{margin:4px 0 0;font-size:15px;line-height:1.35}.rh-obj small{display:block;margin-top:4px;opacity:.8;font-size:13px}
.rh-qm{position:absolute;transform:translate(-50%,-100%);font:900 26px Georgia,serif;color:#ffd27a;text-shadow:0 2px 4px #000,0 0 10px rgba(255,210,122,.6)}
.rh-gpop{position:absolute;right:16px;width:190px;text-align:center;top:238px;font-weight:900;font-size:20px;text-shadow:0 2px 6px #000;animation:gpop 1.7s forwards;pointer-events:none}@keyframes gpop{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-28px)}}
#rh-fade{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .8s}
#rh-gold{position:absolute;right:16px;top:214px;width:190px;text-align:center;font-weight:800;color:#ffd27a;text-shadow:0 2px 6px rgba(0,0,0,.7)}
#rh-talk{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);width:min(620px,calc(100% - 32px));background:rgba(12,10,28,.92);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:14px 18px;display:none;pointer-events:auto}
#rh-talk b{color:#ffd27a;font-size:17px}#rh-talk p{margin:6px 0 4px;font-size:16px;line-height:1.45}#rh-talk small{opacity:.7}
.rh-bub{position:absolute;transform:translate(-50%,-100%);background:#fff;color:#111;font-weight:700;font-size:13px;padding:5px 10px;border-radius:12px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)}
#rh-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100% - 32px));max-height:calc(100% - 40px);overflow:auto;background:rgba(12,10,28,.95);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:18px;display:none;pointer-events:auto}
#rh-panel h2{margin:0 0 4px}#rh-panel .rc{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.14);border-radius:12px;margin-top:8px}#rh-panel .rc small{display:block;opacity:.75;font-size:13px;margin-top:2px}
#rh-panel .bars{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:11px;opacity:.85;margin-top:6px}#rh-panel .bars i{display:block;height:6px;border-radius:9px;background:linear-gradient(90deg,#f6b94e,#ffe2a3);margin-top:4px}
#rh-panel button{font:inherit}#rh-panel.lk{left:auto;right:16px;transform:translateY(-50%);width:min(430px,calc(100% - 32px))}
.lk-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 8px}.lk-tabs button{padding:6px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;cursor:pointer;font-size:13px}.lk-tabs button[aria-pressed=true]{background:#f6b94e;color:#1b1203;border-color:#f6b94e}
.lk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;max-height:34vh;overflow:auto;padding:2px}.lk-it{display:grid;gap:3px;justify-items:center;padding:9px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#fff;cursor:pointer;font-size:13px}.lk-it i{width:34px;height:34px;border-radius:50%;border:2px solid rgba(255,255,255,.3)}.lk-it small{opacity:.7;font-size:11.5px}.lk-it[aria-pressed=true]{border-color:#f6b94e;background:rgba(246,185,78,.15)}
.lk-row{display:grid;grid-template-columns:86px 1fr;gap:8px;align-items:center;margin-top:10px;font-size:12px;text-transform:uppercase;letter-spacing:.1em;opacity:.95}.lk-sw{display:flex;flex-wrap:wrap;gap:5px}.lk-sw button{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.2);cursor:pointer}.lk-sw button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #f6b94e}
.lk-foot{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;justify-content:flex-end}#rh-map{position:absolute;inset:40px;display:none;pointer-events:auto;background:rgba(8,8,20,.9);border-radius:18px;border:1px solid rgba(255,255,255,.2);padding:14px}#rh-map canvas{width:100%;height:100%;object-fit:contain}
@media (max-width:700px){#rh-mini{width:130px;height:130px}#rh-gold{top:150px;width:130px}#rh-help{display:none}}`;document.head.appendChild(s)}
function buildUI(){css();const h=document.createElement('div');h.id='roam-hud';h.hidden=true;h.innerHTML=`<div id="rh-mini"><canvas width="380" height="380"></canvas></div><div id="rh-gold"></div><div id="rh-area"><small></small><b></b></div><div id="rh-msg"></div>
  <div id="rh-prompt"></div><div id="rh-speed"><b>0</b><small>km/h</small></div><div id="rh-help">WASD move · Shift run · Space jump · E talk / use · F car · Hold F hotwire · M map · Esc menu<br>In a car: W/S drive and reverse · A/D steer · Space handbrake · H horn · L lights</div>
  <div id="rh-talk"></div><div id="rh-panel"></div><div id="rh-map"><canvas width="900" height="900"></canvas></div><div id="rh-bubs"></div><div id="rh-fade"></div><div class="rh-obj" id="rh-obj"></div><div id="rh-qms"></div>`;document.body.appendChild(h);
  ui={hud:h,mini:h.querySelector('#rh-mini canvas'),area:h.querySelector('#rh-area'),prompt:h.querySelector('#rh-prompt'),speed:h.querySelector('#rh-speed'),talk:h.querySelector('#rh-talk'),panel:h.querySelector('#rh-panel'),map:h.querySelector('#rh-map'),msg:h.querySelector('#rh-msg'),gold:h.querySelector('#rh-gold'),bubs:h.querySelector('#rh-bubs'),fade:h.querySelector('#rh-fade'),obj:h.querySelector('#rh-obj'),qms:h.querySelector('#rh-qms')}}
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
  {const sv=umSV();LOCS.forEach(L=>{const [a,b]=P(L.x,L.z),ok=!L.req||L.req(sv);x.fillStyle=ok?L.col:'#888';x.beginPath();x.arc(a,b,3,0,TAU);x.fill()})}
  if(MS&&wp&&wp.visible){const [a,b]=P(wp.position.x,wp.position.z);x.fillStyle='#ffd27a';x.strokeStyle='#000';x.lineWidth=1.2;x.beginPath();x.moveTo(a,b-5);x.lineTo(a+4,b);x.lineTo(a,b+5);x.lineTo(a-4,b);x.closePath();x.fill();x.stroke()}
  if(MS&&MS.area&&MS.m.steps[MS.step].area){const [a,b]=P(MS.area.x,MS.area.z);x.strokeStyle='rgba(255,210,122,.9)';x.lineWidth=1.5;x.beginPath();x.arc(a,b,MS.area.r/(HALF*2)*N,0,TAU);x.stroke()}
  x.restore();x.save();x.translate(S/2,S/2);x.rotate(W.camYaw+Math.PI-W.focusYaw());x.fillStyle='#ffd27a';x.strokeStyle='#1a1410';x.lineWidth=2;x.beginPath();x.moveTo(0,-11);x.lineTo(8,9);x.lineTo(0,4);x.lineTo(-8,9);x.closePath();x.fill();x.stroke();x.restore();
  x.save();x.translate(S/2,S/2);x.rotate(W.camYaw+Math.PI);x.fillStyle='#fff';x.font='bold 22px system-ui';x.textAlign='center';x.fillText('N',0,-S/2+26);x.restore()}
function drawBigMap(){const cv=ui.map.querySelector('canvas'),x=cv.getContext('2d'),S=cv.width;x.clearRect(0,0,S,S);x.drawImage(mapImg,0,0,S,S);const P=(px,pz)=>[(px+HALF)/(HALF*2)*S,(pz+HALF)/(HALF*2)*S];x.font='bold 20px Georgia';x.textAlign='center';
  TOWNS.forEach(t=>{const [a,b]=P(t.x,t.z);x.fillStyle='#1a1410';x.fillText(t.name,a+1,b-26);x.fillStyle='#fff';x.fillText(t.name,a,b-27)});
  [['Silverrun River',-300,-40],['Whispering Woods',-120,260],['Ember Road',-170,-300],['Lake Mere',-760,560],['Cliff Road',560,-560],['Iron Pass Road',150,250]].forEach(([n,px,pz])=>{const [a,b]=P(px,pz);x.font='italic 16px Georgia';x.fillStyle='rgba(255,255,255,.85)';x.fillText(n,a,b)});
  const sv=umSV();LOCS.forEach(L=>{const [a,b]=P(L.x,L.z),ok=!L.req||L.req(sv);x.fillStyle=ok?L.col:'#8a8a8a';x.beginPath();x.arc(a,b,7,0,TAU);x.fill();x.strokeStyle='#000';x.lineWidth=2;x.stroke();x.font='bold 14px system-ui';x.fillStyle='#fff';x.fillText(L.name+(ok?'':' 🔒'),a,b+22)});
  const hp=W.focus(),[a,b]=P(hp.x,hp.z);x.fillStyle='#ffd27a';x.beginPath();x.arc(a,b,9,0,TAU);x.fill();x.strokeStyle='#000';x.lineWidth=3;x.stroke();if(myCar&&inCar!==myCar){const [c,d]=P(myCar.pos.x,myCar.pos.z);x.fillStyle='#4fe3d0';x.fillRect(c-6,d-6,12,12);x.fillStyle='#fff';x.font='bold 14px system-ui';x.fillText('Your car',c,d-12)}}
let msgT=0;W.say=t=>{ui.msg.textContent=t;ui.msg.classList.add('on');msgT=3.2};
let areaT=0,curArea='';function areaName(){const p=W.focus();for(const t of TOWNS)if(Math.hypot(p.x-t.x,p.z-t.z)<t.r+10)return [t.name,'Town'];for(const t of SITES)if(Math.hypot(p.x-t.x,p.z-t.z)<t.r+25)return [t.area,t.name];const rv=nearest(riverS,riverI,p.x,p.z);if(rv.d<40)return ['Silverrun River','River'];
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
  else if(k==='click'){tone(2400,.03,'square',.06)}else if(k==='alarm'){tone(880,.25,'square',.06,660)}else if(k==='splash'){noise(.8,.4,700)}else if(k==='meow'){tone(700*v+500,.35,'sine',.08*v,420)}};

/* ---------------- player ---------------- */
const keys=new Set(),pressedK=new Set();let mdown=false,lastMX=0,lastMY=0;
W.camYaw=0;W.camPitch=.32;W.camDist=6.5;let camPos=V(),camLook=V();W.shake=0;
W.focus=()=>inCar?inCar.pos:W.hero.pos;W.focusYaw=()=>inCar?inCar.yaw:W.hero.yaw;
function heroStep(dt){const h=W.hero,run=keys.has('ShiftLeft')||keys.has('ShiftRight');let mx=0,mz=0;if(keys.has('KeyW')||keys.has('ArrowUp'))mz+=1;if(keys.has('KeyS')||keys.has('ArrowDown'))mz-=1;if(keys.has('KeyA')||keys.has('ArrowLeft'))mx-=1;if(keys.has('KeyD')||keys.has('ArrowRight'))mx+=1;
  const fwdX=Math.sin(W.camYaw),fwdZ=Math.cos(W.camYaw),rX=Math.cos(W.camYaw),rZ=-Math.sin(W.camYaw);let dx=fwdX*mz-rX*mx,dz=fwdZ*mz-rZ*mx;const l=Math.hypot(dx,dz);
  if(W.mod&&W.mod.fly){W.mod.flyStep(h,dt,l?dx/l:0,l?dz/l:0);return}
  const sp=(W.talk||W.panelOpen?0:(run?7.2:3.4)*(W.inWater?.45:1))*(W.mod?W.mod.spd:1);if(l>0){dx/=l;dz/=l}const k=1-Math.exp(-dt*(h.grounded?10:2.5));h.vel.x=lerp(h.vel.x,dx*sp,k);h.vel.z=lerp(h.vel.z,dz*sp,k);
  if(l>0&&sp>0)h.yaw=turnTo(h.yaw,Math.atan2(dx,dz),10*dt);
  if(pressedK.has('Space')&&h.grounded&&!W.talk){h.vel.y=8.2;h.grounded=false;h.jumps=1}h.vel.y-=22*dt;
  h.pos.x+=h.vel.x*dt;h.pos.z+=h.vel.z*dt;const p={x:h.pos.x,z:h.pos.z};collide(p,.4);for(const c of cars){const cx=c.pos.x,cz=c.pos.z,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),lx=(p.x-cx)*cs-(p.z-cz)*sn,lz=(p.x-cx)*sn+(p.z-cz)*cs,hw=c.spec.wid/2+.4,hd=c.spec.len/2+.4;if(Math.abs(lx)<hw&&Math.abs(lz)<hd){const ex=hw-Math.abs(lx),ez=hd-Math.abs(lz);let nlx=lx,nlz=lz;if(ex<ez)nlx=Math.sign(lx)*hw;else nlz=Math.sign(lz)*hd;p.x=cx+nlx*cs+nlz*sn;p.z=cz-nlx*sn+nlz*cs}}
  h.pos.x=p.x;h.pos.z=p.z;h.pos.y+=h.vel.y*dt;const g=groundAt(h.pos.x,h.pos.z);W.inWater=g<WATER-.6;const floor=W.inWater?WATER-1.1:g;if(h.pos.y<=floor){if(!h.grounded&&h.vel.y<-6)h.landT=.2;h.pos.y=floor;h.vel.y=0;h.grounded=true}else if(h.pos.y>floor+.3)h.grounded=false;
  if(W.inWater&&g<WATER-2.2){W.drownT=(W.drownT||0)+dt;if(W.drownT>2.5){W.drownT=0;const rd=roadAt(h.pos.x,h.pos.z);W.say('Too deep to wade. You climb back out.');const b=ROADS[0].S[rd?rd.i:0];h.pos.set(b.x+3,groundAt(b.x+3,b.z),b.z)}}else W.drownT=0;
  h.st='free';h.status=h.status||{};animate(h,dt);h.rig.aura.visible=false;h.rig.root.position.copy(h.pos);h.rig.root.visible=!inCar}
function camStep(dt){const t=W.focus();if(W.mirror&&!inCar){const h=W.hero;W.camYaw=lerpAng(W.camYaw,h.yaw+Math.PI,1-Math.exp(-dt*5));W.camDist=lerp(W.camDist,3.1,dt*5);W.camPitch=lerp(W.camPitch,.08,dt*5);camera.fov=lerp(camera.fov,45,dt*4);camera.updateProjectionMatrix()}
  else if(inCar){const c=inCar,sp=Math.abs(c.vx);const behind=c.vx<-1?c.yaw:c.yaw+Math.PI;if(!mdown)W.camYaw=lerpAng(W.camYaw,c.yaw+(c.vx<-2?Math.PI:0),1-Math.exp(-dt*2.2));W.camDist=lerp(W.camDist,c.spec.len*1.45+sp*.06,dt*2);W.camPitch=lerp(W.camPitch,.22,dt*2);camera.fov=lerp(camera.fov,62+sp*.35,dt*3);camera.updateProjectionMatrix()}
  else{const h=W.hero;if(!mdown&&Math.hypot(h.vel.x,h.vel.z)>.5&&!(keys.has('KeyS')&&!keys.has('KeyA')&&!keys.has('KeyD')))W.camYaw=lerpAng(W.camYaw,h.yaw,1-Math.exp(-dt*.9));W.camDist=lerp(W.camDist,6.5,dt*2);camera.fov=lerp(camera.fov,58,dt*3);camera.updateProjectionMatrix()}
  const ty=t.y+(inCar?1.4:W.mirror?1.25:1.6);const cp=Math.cos(W.camPitch);let d=W.camDist;
  // keep the camera out of walls: walk back from the target and stop just before a solid
  for(let k=.6;k<=W.camDist;k+=.35){const qx=t.x-Math.sin(W.camYaw)*cp*k,qz=t.z-Math.cos(W.camYaw)*cp*k,qy=ty+Math.sin(W.camPitch)*k;if(insideSolid(qx,qz,qy)){d=Math.max(.8,k-.45);break}}
  let px=t.x-Math.sin(W.camYaw)*cp*d,pz=t.z-Math.cos(W.camYaw)*cp*d,py=ty+Math.sin(W.camPitch)*d;const g=groundAt(px,pz)+.6;if(py<g)py=g;
  camPos.lerp(V(px,py,pz),1-Math.exp(-dt*(inCar?9:12)));camLook.lerp(V(t.x,ty,t.z),1-Math.exp(-dt*14));camera.position.copy(camPos);if(W.shake>0){camera.position.x+=rand(-1,1)*W.shake;camera.position.y+=rand(-1,1)*W.shake;W.shake=Math.max(0,W.shake-dt*1.6)}camera.lookAt(camLook)}
function insideSolid(x,z,y){for(const o of solidsNear(x,z)){if(o.type==='c'){if(o.r>.6&&Math.hypot(x-o.x,z-o.z)<o.r+.2&&y<groundAt(o.x,o.z)+6)return true;continue}if(o.hw<.5&&o.hd<.5)continue;const c=Math.cos(o.yaw),s=Math.sin(o.yaw),lx=(x-o.x)*c-(z-o.z)*s,lz=(x-o.x)*s+(z-o.z)*c;if(Math.abs(lx)<o.hw+.25&&Math.abs(lz)<o.hd+.25&&y<groundAt(o.x,o.z)+(o.h||7.5))return true}return false}
function lerpAng(a,b,k){let d=((b-a+Math.PI)%(TAU)+TAU)%TAU-Math.PI;return a+d*k}

/* ---------------- interactions ---------------- */
let hot=null,hotT=0;
function nearDoor(c){const s=c.spec,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw),dx=c.pos.x-cs*(s.wid/2+.6),dz=c.pos.z+sn*(s.wid/2+.6);return Math.hypot(W.hero.pos.x-dx,W.hero.pos.z-dz)<2.2||Math.hypot(W.hero.pos.x-c.pos.x,W.hero.pos.z-c.pos.z)<s.len*.55+.8}
function enterCar(c){inCar=c;c.eng=c.fuel>0;if(!c.eng)W.say('The tank is empty. Press R to call for a fuel can.');c.flooded=c.flooded&&c.pos.y<WATER-.5;W.sfx('door');setTimeout(()=>{if(inCar===c&&c.eng){W.sfx('start');engineAudio(true)}},250);c.locked=false;if(c.alarm>0&&c!==myCar){}W.camDist=c.spec.len*1.45}
function exitCar(){const c=inCar;if(!c)return;if(Math.abs(c.vx)>3){W.say('Slow down before you get out.');return}inCar=null;c.eng=false;c.vx=c.vy=c.w=0;engineAudio(false);W.sfx('door');const s=c.spec,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);const p={x:c.pos.x-cs*(s.wid/2+.8),z:c.pos.z+sn*(s.wid/2+.8)};collide(p,.4);W.hero.pos.set(p.x,groundAt(p.x,p.z)+.2,p.z);W.hero.vel.set(0,0,0);W.hero.yaw=c.yaw;if(c===myCar)c.lockArm=true}
function interact(){const h=W.hero;let pr='',act=null;hot=null;
  if(inCar){pr=`<kbd>F</kbd> Get out`;act='exit';let e=null;if(inCar.flooded)pr+=` · <kbd>R</kbd> Call a tow`;else if(inCar.fuel<=0)pr+=` · <kbd>R</kbd> Call for a fuel can`;
    if(Math.abs(inCar.vx)<1.5){if(W.pumps.some(p=>Math.hypot(inCar.pos.x-p.x,inCar.pos.z-p.z)<5.5)&&inCar.fuel<.99){pr=`<kbd>E</kbd> Fill up (◉ ${fuelCost(inCar)}) · `+pr;e='fuel'}else if(Math.hypot(inCar.pos.x-W.mech.x,inCar.pos.z-W.mech.z)<6){if(W.isOpen()){pr=`<kbd>E</kbd> Service at Brann's Garage · `+pr;e='mech'}else pr=`🔒 Brann's Garage is closed · opens at 7:00 · `+pr}}return [pr,act,e]}
  const sv=umSV();for(const L of LOCS){if(Math.hypot(h.pos.x-L.x,h.pos.z-L.z)<4.2){const ok=!L.req||L.req(sv);return ok?[`<kbd>E</kbd> ${L.prompt(sv)}`,'loc:'+L.id]:[`🔒 ${L.name}: ${L.lock}`,null]}}
  for(const B of BIZ){const sp=W.spots[B.spot];if(Math.hypot(h.pos.x-sp.x,h.pos.z-sp.z)<2.4){const o=bizOf(sv,B.id);return [o?`<kbd>E</kbd> Collect your cut from the ${B.name} (◉ ${Math.floor(o.bank)})`:`<kbd>E</kbd> Buy a share of the ${B.name} (◉ ${B.price})`,'biz:'+B.id]}}
  for(const Hm of HOMES){if(!Hm.door)continue;const own=(sv.homes||[]).includes(Hm.id);if(Math.hypot(h.pos.x-Hm.door.x,h.pos.z-Hm.door.z)<2.8||(!own&&Math.hypot(h.pos.x-Hm.signP.x,h.pos.z-Hm.signP.z)<2.5))return own?[`<kbd>E</kbd> Go inside`,'homemenu']:[`<kbd>E</kbd> View the ${Hm.name} · for sale`,'home:'+Hm.id];if(own&&Math.hypot(h.pos.x-Hm.garage.x,h.pos.z-Hm.garage.z)<4.5)return [`<kbd>E</kbd> Open your garage`,'garage:'+Hm.id]}
  let bestC=null,bd=99;for(const c of cars){if(c.ai)continue;const d=Math.hypot(h.pos.x-c.pos.x,h.pos.z-c.pos.z);if(d<bd&&nearDoor(c)){bd=d;bestC=c}}
  let bestN=null,bn=2.6;for(const f of NPCS){if(f.hidden||f.indoors||f.npc.thief)continue;const d=Math.hypot(h.pos.x-f.pos.x,h.pos.z-f.pos.z);if(d<bn){bn=d;bestN=f}}
  if(bestN&&(!bestC||bn<bd)){const D=bestN.npc;if(D.motors)return [`<kbd>E</kbd> Browse cars at Ashford Motors`,'motors:'+NPCS.indexOf(bestN)];if(D.shop)return [`<kbd>E</kbd> ${D.shop==='tailor'?'Browse the Tailor':'Get a new look at the Barber'}`,'shop:'+D.shop];return [`<kbd>E</kbd> Talk to ${D.n}`,'talk:'+NPCS.indexOf(bestN)]}
  if(bestC){if(bestC===myCar||!bestC.locked)return [`<kbd>F</kbd> ${bestC===myCar?'Unlock and drive your '+bestC.name:'Drive the '+bestC.name+(bestC.stolen?' (stolen)':'')}`,'enter'];hot=bestC;return [`<span>🔒 Locked ${bestC.name} · hold <kbd>F</kbd> to hotwire</span>${hotT>0?`<svg id="rh-ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="4"/><circle cx="12" cy="12" r="9" fill="none" stroke="#ffd27a" stroke-width="4" stroke-dasharray="${hotT/3.5*56.5} 60" transform="rotate(-90 12 12)"/></svg>`:''}`,'hotwire']}
  if(!W.isOpen()&&Math.hypot(h.pos.x-W.motors.x+2,h.pos.z-W.motors.z-5)<6)return [`🔒 Ashford Motors is closed · opens at 7:00`,null];
  if(Math.hypot(h.pos.x-W.garage.x,h.pos.z-W.garage.z)<5)return [`<kbd>E</kbd> Open your garage`,'garage'];
  for(const b of W.boards)if(Math.hypot(h.pos.x-b.x,h.pos.z-b.z)<3)return [`<kbd>E</kbd> Read the job board`,'board'];
  if(MS&&MS.cat&&!MS.cat.following&&Math.hypot(h.pos.x-MS.cat.x,h.pos.z-MS.cat.z)<2)return [`<kbd>E</kbd> Pick up Biscuit`,'cat'];
  if(Math.hypot(h.pos.x-W.wardrobe.x,h.pos.z-W.wardrobe.z)<3)return [`<kbd>E</kbd> Go inside`,'homemenu'];
  for(const k of ['tailor','barber'])if(Math.hypot(h.pos.x-W[k].x,h.pos.z-W[k].z)<2.6)return !W.isOpen()?[`🔒 The ${k==='tailor'?'Tailor':'Barber'} is closed · opens at 7:00`,null]:[`<kbd>E</kbd> ${k==='tailor'?'Browse the Tailor':'Get a new look at the Barber'}`,'shop:'+k];
  return ['',null]}
function talk(f){if(W.talk!==f){W.talk=f;f.talkI=0}else{f.talkI++}const D=f.npc,L=D.lines.slice();if(D.owner&&D.robbed)L.unshift('You! You stole my car! I saw you!');
  if(f.talkI>=L.length){W.talk=null;ui.talk.style.display='none';const m=MISSIONS.find(m=>m.giver===D.n&&missionOpen(m));if(m&&!MS)offerMission(m);return}ui.talk.innerHTML=`<b>${D.n}</b><p>${L[f.talkI]}</p><small>E to continue</small>`;ui.talk.style.display='block'}
function openPanel(html){ui.panel.innerHTML=html;ui.panel.style.display='block';W.panelOpen=true;ui.panel.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closePanel())}
function closePanel(){ui.panel.style.display='none';W.panelOpen=false}
function statBars(s){const r=(v,a,b)=>clamp((v-a)/(b-a),.08,1)*100;return `<div class="bars"><span>Speed</span><i style="width:${r(s.top,38,62)}%"></i><span>Power</span><i style="width:${r(s.power/s.mass,50,125)}%"></i><span>Grip</span><i style="width:${r(s.grip,.9,1.1)}%"></i><span>Weight</span><i style="width:${r(s.mass,1000,2000)}%"></i></div>`}
function garage(spot){const sv=umSV();openPanel(`<h2>Your garage</h2><p style="opacity:.75;margin:0">Pick which of your cars waits in the driveway. Buy more at Ashford Motors.</p>${Object.keys(CARS).map(k=>{const s=CARS[k],own=sv.cars.includes(k);return `<div class="rc"><div><b>${s.name}</b>${own?'':' <small style="display:inline">· not owned</small>'}<small>${s.desc}</small>${statBars(s)}</div>${own?`<button class="btn sm" data-car="${k}" ${sv.carSel===k?'disabled':''}>${sv.carSel===k?'In driveway':'Use'}</button>`:''}</div>`}).join('')}<div style="margin-top:12px;text-align:right"><button class="btn ghost sm" data-close>Close</button></div>`);
  ui.panel.querySelectorAll('[data-car]').forEach(b=>b.onclick=()=>{sv.carSel=b.dataset.car;umSave();spawnMyCar(spot||true);W.sfx('chirp');closePanel();W.say(`Your ${CARS[sv.carSel].name} is in the driveway.`)})}
function motors(){const sv=umSV();openPanel(`<h2>Ashford Motors</h2><p style="opacity:.75;margin:0">"Every one of them runs like a dream. Mostly." · You have <b style="color:#ffd27a">◉ ${sv.gold||0} gold</b></p>${Object.keys(CARS).map(k=>{const s=CARS[k],own=sv.cars.includes(k);return `<div class="rc"><div><b>${s.name}</b> <small style="display:inline">· ${own?'owned':s.price+' gold'}</small><small>${s.desc}</small>${statBars(s)}</div>${own?(k==='hatch'?'<span style="opacity:.7">Owned</span>':`<button class="btn ghost sm" data-sell="${k}">Sell · ◉ ${sellPrice(sv,k)}</button>`):`<button class="btn sm" data-buy="${k}" ${sv.gold<s.price?'disabled':''}>Buy</button>`}</div>`}).join('')}<div style="margin-top:12px;text-align:right"><button class="btn ghost sm" data-close>Close</button></div>`);
  ui.panel.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{const k=b.dataset.sell;if(inCar&&inCar.type===k&&inCar===myCar){W.say('Get out of it first.');return}const p=sellPrice(sv,k);sv.gold+=p;sv.cars=sv.cars.filter(x=>x!==k);if(sv.cmod)delete sv.cmod[k];if(sv.carSel===k){sv.carSel='hatch';if(myCar){scene.remove(myCar.m.g);cars.splice(cars.indexOf(myCar),1);myCar=null}spawnMyCar(true)}umSave();W.sfx('chirp');W.say(`Dalton buys your ${CARS[k].name} for ◉ ${p}.`);motors()});
  ui.panel.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const k=b.dataset.buy,s=CARS[k];if(sv.gold<s.price)return;sv.gold-=s.price;sv.cars.push(k);sv.carSel=k;umSave();W.sfx('chirp');closePanel();if(myCar&&inCar!==myCar){keepCarState();scene.remove(myCar.m.g);cars.splice(cars.indexOf(myCar),1)}myCar=spawnCar(k,W.motors.x,W.motors.z,W.motors.yaw,{owner:'me',locked:false,spec:modSpec(k,cmod(sv,k)),fuel:1});W.say(`You bought the ${s.name}! It's parked on the lot, keys in your pocket.`)})}
// ---------- looks: Tailor, Barber and your wardrobe ----------
const LOOK_KEYS=['body','acc','pants','skin','head','hair','hairc','weapon','hat','hatc','mask','maskc','glasses','scarf','scarfc','pack','packc','cape','capec'];
const CAT_N={col:'Fabric colours',hat:'Hats',mask:'Masks',glasses:'Glasses',scarf:'Scarves',pack:'Backpacks',cape:'Capes',hair:'Hairstyles',hairc:'Hair dye'};
let look=null,lookMode=null,lookTab=null,lookSel=null;
function curLook(sv){const o={};LOOK_KEYS.forEach(k=>o[k]=sv[k]);return o}
W.restyle=L=>{const sv=umSV(),tmp=Object.assign({},sv,L);umRegister(tmp,true);const h=W.hero,pos=h.pos.clone(),yaw=h.yaw;scene.remove(h.rig.root);const n=mkFighter(BYID.hero,true,0);world.remove(n.rig.root);scene.add(n.rig.root);n.pos.copy(pos);n.yaw=yaw;n.foe=n;W.hero=n;umRegister(sv,true)};
function palette(sv){return [...UM_BODY,...UM_ACC.filter(c=>!UM_BODY.includes(c)),...(sv.owned||[]).filter(i=>i.startsWith('col:')).map(i=>i.slice(4))]}
function lookShop(mode){const sv=umSV();sv.owned=sv.owned||[];look=curLook(sv);lookMode=mode;lookTab=mode==='barber'?'hair':mode==='tailor'?'col':'hat';lookSel=null;W.mirror=true;renderLook()}
function renderLook(){const sv=umSV(),own=id=>umOwns(sv,id),cats=lookMode==='wardrobe'?['hair','hairc','col','hat','mask','glasses','scarf','pack','cape']:UM_SHOP[lookMode];
  const title=lookMode==='tailor'?"Madame Lio's Tailor":lookMode==='barber'?"Fen's Barbershop":'Your wardrobe',sub=lookMode==='wardrobe'?'Wear anything you own. Changing is free.':'Try anything on. You only pay for what you buy.';
  const items=lookMode==='wardrobe'?UM_ITEMS.filter(i=>i.cat===lookTab&&own(i.id)):UM_ITEMS.filter(i=>i.cat===lookTab);
  const isCol=lookTab==='col'||lookTab==='hairc';
  let grid='';if(lookMode==='wardrobe'&&['hat','mask','glasses','scarf','pack','cape'].includes(lookTab))grid+=`<button class="lk-it" data-none="1" aria-pressed="${!look[lookTab]||look[lookTab]==='none'}"><b>None</b></button>`;
  if(lookMode==='wardrobe'&&lookTab==='hair')grid+=UM_HAIRS.map(([v,n])=>`<button class="lk-it" data-base="${v}" aria-pressed="${look.hair===v}"><b>${n}</b><small>Basic</small></button>`).join('');
  grid+=items.map(i=>`<button class="lk-it" data-id="${i.id}" aria-pressed="${lookSel===i.id||(!isCol&&look[i.cat]===i.v)}">${isCol?`<i style="background:${i.v}"></i>`:''}<b>${isCol?'':i.n}</b><small>${own(i.id)?'Owned':'◉ '+i.price}</small></button>`).join('')||(lookMode==='wardrobe'?'<p style="opacity:.7">Nothing here yet. Visit the Tailor in Ashford or the Barber in Hollowbrook.</p>':'');
  // colour pickers for what you are wearing
  const pal=palette(sv),hp=[...UM_HAIRC,...(sv.owned||[]).filter(i=>i.startsWith('hairc:')).map(i=>i.slice(6))];const swatch=(key,list)=>`<div class="lk-sw">${list.map(c=>`<button data-ck="${key}" data-cv="${c}" style="background:${c}" aria-pressed="${look[key]===c}"></button>`).join('')}</div>`;
  let colors='';if(lookMode==='wardrobe'||(lookTab!=='col'&&lookTab!=='hairc')){if(lookTab==='col'||lookMode==='wardrobe'&&lookTab==='col')colors+=`<div class="lk-row"><span>Outfit</span>${swatch('body',pal)}</div><div class="lk-row"><span>Trim</span>${swatch('acc',pal)}</div><div class="lk-row"><span>Pants</span>${swatch('pants',pal)}</div>`;
    if(lookTab==='hairc'||lookTab==='hair')colors+=`<div class="lk-row"><span>Hair colour</span>${swatch('hairc',hp)}</div>`;
    const ck={hat:'hatc',mask:'maskc',scarf:'scarfc',pack:'packc',cape:'capec'}[lookTab];if(ck&&look[lookTab]&&look[lookTab]!=='none'&&look[lookTab]!=='iron')colors+=`<div class="lk-row"><span>Colour</span>${swatch(ck,pal)}</div>`}
  const selItem=lookSel&&UM_ITEMS.find(i=>i.id===lookSel);const canBuy=selItem&&!own(selItem.id);const changed=JSON.stringify(look)!==JSON.stringify(curLook(sv));
  openPanel(`<h2>${title}</h2><p style="opacity:.75;margin:0">${sub} · <b style="color:#ffd27a">◉ ${sv.gold||0} gold</b></p><div class="lk-tabs">${cats.map(c=>`<button data-tab="${c}" aria-pressed="${lookTab===c}">${CAT_N[c]}</button>`).join('')}</div><div class="lk-grid">${grid}</div>${colors}
    <div class="lk-foot">${canBuy?`<button class="btn sm" id="lk-buy" ${sv.gold<selItem.price?'disabled':''}>Buy ${isCol?'this colour':selItem.n} · ◉ ${selItem.price}</button>`:''}<button class="btn ${canBuy?'ghost ':''}sm" id="lk-done">${changed?'Wear this & leave':'Done'}</button><button class="btn ghost sm" id="lk-cancel">${changed?'Cancel':'Close'}</button></div>`);
  const P=ui.panel;P.classList.add('lk');P.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{lookTab=b.dataset.tab;lookSel=null;W.sfx('click');renderLook()});
  P.querySelectorAll('.lk-it').forEach(b=>b.onclick=()=>{W.sfx('click');if(b.dataset.none){look[lookTab]='none';lookSel=null}else if(b.dataset.base){look.hair=b.dataset.base;lookSel=null}else{const it=UM_ITEMS.find(i=>i.id===b.dataset.id);lookSel=it.id;if(it.cat==='col')look.body=it.v;else if(it.cat==='hairc')look.hairc=it.v;else{look[it.cat]=it.v;if(it.cat==='hat'&&!look.hatc)look.hatc='#2a2a30';if(it.cat==='scarf'&&!look.scarfc)look.scarfc='#c8442a';if(it.cat==='cape'&&!look.capec)look.capec='#2a2a6a'}}W.restyle(look);renderLook()});
  P.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>{W.sfx('click');look[b.dataset.ck]=b.dataset.cv;W.restyle(look);renderLook()});
  const buy=P.querySelector('#lk-buy');if(buy)buy.onclick=()=>{const it=selItem;if((sv.gold||0)<it.price)return;sv.gold-=it.price;sv.owned.push(it.id);umSave();W.sfx('chirp');W.say(`You bought ${it.cat==='col'?'a new fabric colour':it.cat==='hairc'?'a new hair dye':'the '+it.n}.`);renderLook()};
  P.querySelector('#lk-done').onclick=()=>{// keep only what you own (or basic items)
    const ok=k=>{const v=look[k];if(!v||v==='none')return true;if(k==='hair')return UM_HAIRS.some(h=>h[0]===v)||own('hair:'+v);if(['hat','mask','glasses','scarf','pack','cape'].includes(k))return own(k+':'+v);if(k==='hairc')return UM_HAIRC.includes(v)||own('hairc:'+v);if(['body','acc','pants','hatc','maskc','scarfc','packc','capec'].includes(k))return palette(sv).includes(v)||!v;return true};
    const cur=curLook(sv);LOOK_KEYS.forEach(k=>{if(ok(k))sv[k]=look[k];else sv[k]=cur[k]});umRegister(sv);sv.por=portraits.hero;umSave();W.restyle(curLook(sv));closeLook()};
  P.querySelector('#lk-cancel').onclick=()=>{W.restyle(curLook(sv));closeLook()}}
function closeLook(){ui.panel.classList.remove('lk');closePanel();W.mirror=false;lookMode=null}
function spawnMyCar(home){const sv=umSV();if(myCar){if(inCar===myCar)return;keepCarState();scene.remove(myCar.m.g);cars.splice(cars.indexOf(myCar),1);myCar=null}const k=sv.carSel||'hatch';const G=home&&home.x!==undefined?home:W.garage;let x=G.x,z=G.z,y=G.yaw;if(!home&&sv.roam&&sv.roam.car&&sv.roam.car.type===k&&groundAt(sv.roam.car.x,sv.roam.car.z)>WATER-.3){x=sv.roam.car.x;z=sv.roam.car.z;y=sv.roam.car.yaw}{const cm=cmod(sv,k);myCar=spawnCar(k,x,z,y,{owner:'me',locked:true,spec:modSpec(k,cm),color:cm.paint||undefined,dmg:cm.dmg||0,fuel:cm.fuel===undefined?1:cm.fuel})}}
function parkedCars(){const spots=[[TOWNS[1].x-14,TOWNS[1].z+44,0,'sedan','#7a7a80',9],[TOWNS[1].x+44,TOWNS[1].z-8,Math.PI/2,'pickup','#8a2a2a',8],[TOWNS[0].x+20,TOWNS[0].z+22,Math.PI,'pickup','#3a4a6a',4],[TOWNS[1].x-80,TOWNS[1].z-40,0,'hatch','#e8e8e8',10],[TOWNS[1].x+20,TOWNS[1].z+44,Math.PI,'coupe','#2a6a4a',11]];
  spots.forEach(([x,z,y,k,col,own])=>{const c=spawnCar(k,x,z,y,{color:col,owner:own,locked:true});c.ownerName=NPC_DEFS[own]?NPC_DEFS[own].n:'someone'})}

/* ---------------- day & night ---------------- */
W.time=8;W.dayN=0;W.isOpen=()=>W.time>=7&&W.time<21;
function clockTxt(icon){const t=W.time,h=Math.floor(t),m=Math.floor((t-h)*60);return (icon?(t>=6&&t<20?'☀ ':'☾ '):'')+h+':'+String(m).padStart(2,'0')}
const cA=new T.Color(),cB=new T.Color(),cC=new T.Color();
function mix3(day,dusk,night,k,du,out){cA.set(night);cB.set(day);out.copy(cA).lerp(cB,k);if(du>0){cC.set(dusk);out.lerp(cC,du)}return out}
let stars,moon,lampLights=[],headSpot;
function buildNight(){const n=900,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const u=Math.random(),v=Math.random()*.9+.1,th=u*TAU,ph=Math.acos(v);pos[i*3]=Math.sin(ph)*Math.cos(th)*1300;pos[i*3+1]=Math.cos(ph)*1300;pos[i*3+2]=Math.sin(ph)*Math.sin(th)*1300}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));stars=new T.Points(g,new T.PointsMaterial({color:'#ffffff',size:2.2,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false}));W.sky.add(stars);
  moon=new T.Mesh(new T.SphereGeometry(38,20,14),new T.MeshBasicMaterial({color:'#f4f0dc',fog:false,transparent:true,opacity:0}));W.sky.add(moon);
  for(let i=0;i<6;i++){const l=new T.PointLight('#ffd890',0,18,1.6);scene.add(l);lampLights.push(l)}
  headSpot=new T.SpotLight('#fff4d6',0,60,.5,.5,1.2);scene.add(headSpot);scene.add(headSpot.target)}
function skyTick(fp,dt){if(!W.panelOpen||W.mod){W.time+=dt/60;if(W.time>=24){W.time-=24;W.dayN++}}
  const t=W.time,a=t>=6&&t<20?(t-6)/14*Math.PI:Math.PI+((t+4)%24)/10*Math.PI,el=Math.sin(a),k=clamp((el+.1)/.32,0,1),du=clamp(1-Math.abs(el+.02)/.22,0,1)*.75;W.night=k<.4;W.dayK=k;
  mix3('#4f8ed0','#5a5a9a','#070b22',k,du*.6,skyMat.uniforms.top.value);mix3('#d8ecf6','#f0a070','#141b38',k,du,skyMat.uniforms.bot.value);
  mix3('#b9d6ea','#d89a80','#0e1428',k,du,scene.fog.color);scene.background.copy(scene.fog.color);
  const sa=el>-.05?a:a+Math.PI,sx=Math.cos(sa),sy=Math.max(.18,Math.abs(Math.sin(sa)));sun.position.set(fp.x+sx*90,fp.y+sy*120,fp.z+40);
  sun.intensity=Math.max(1.05*k,.2*(1-k));mix3('#fff2dc','#ffa860','#8aa0e0',k,du,sun.color);hemi.intensity=.18+.4*k;mix3('#e6f2ff','#f0c8a8','#3a4a7a',k,du*.5,hemi.color);
  if(stars){stars.material.opacity=clamp(1-k*1.6,0,1);moon.material.opacity=clamp(1-k*1.4,0,1);const ma=a+Math.PI;moon.position.set(Math.cos(ma)*1100,Math.max(80,Math.sin(ma)*900),300)}
  WINMAT[0].emissive.set(W.night?'#e8b45a':'#2a3a44');LAMPMAT.color.set(W.night?'#ffe2a0':'#d8d0b0');
  // the nearest street lamps cast real light at night
  if(W.lamps){const L=W.night?W.lamps.map(l=>[Math.hypot(l.x-fp.x,l.z-fp.z),l]).filter(p=>p[0]<70).sort((p,q)=>p[0]-q[0]).slice(0,6):[];lampLights.forEach((ll,i)=>{if(L[i]){ll.position.set(L[i][1].x,L[i][1].y,L[i][1].z);ll.intensity=1.1}else ll.intensity=0})}
  if(headSpot){const c=inCar;if(c&&c.eng&&(W.night||c.lights)){const f=c.spec.len/2,sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);headSpot.position.set(c.pos.x+sn*f,c.pos.y+.8,c.pos.z+cs*f);headSpot.target.position.set(c.pos.x+sn*(f+20),c.pos.y-1,c.pos.z+cs*(f+20));headSpot.intensity=1.6}else headSpot.intensity=0}}
function greeting(D){const t=W.time;if(D.robbed)return ['You! Thief!','I know what you did.','Stay away from my things!'][Math.floor(Math.random()*3)];const L=t>=5&&t<11?['Morning!','Good morning!','Lovely morning.','Up early, eh?']:t<17?['Afternoon!','Hello there.','Nice day for it.','Hi!']:t<21?['Evening!','Good evening.','Getting dark soon.']:['Out late, aren\'t you?','Quiet night.','Evening... bit late for a stroll.'];return L[Math.floor(Math.random()*L.length)]}
function npcAwake(f){const D=f.npc;if(D.nightOwl)return true;if(MS&&MS.m.giver===D.n)return true;const t=W.time;return t>=f.wake&&t<f.sleep}
function npcFar(f){const a=npcAwake(f);if(!a&&!f.indoors){f.indoors=true;f.commute=null}else if(a&&f.indoors){f.indoors=false;f.commute=null;f.pos.set(f.station.x,groundAt(f.station.x,f.station.z),f.station.z)}}
function walkTo(f,x,z,sp,dt){const dx=x-f.pos.x,dz=z-f.pos.z,d=Math.hypot(dx,dz);if(d<.5){f.vel.set(0,0,0);return true}f.vel.set(dx/d*sp,0,dz/d*sp);f.yaw=turnTo(f.yaw,Math.atan2(dx,dz),8*dt);f.pos.x+=f.vel.x*dt;f.pos.z+=f.vel.z*dt;const p={x:f.pos.x,z:f.pos.z};collide(p,.35);f.pos.x=p.x;f.pos.z=p.z;f.pos.y=groundAt(p.x,p.z);f.grounded=true;f.st='free';animate(f,dt);return false}
function homeMenu(){openPanel(`<h2>Home</h2><p style="opacity:.75;margin:0">It's ${clockTxt()}.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm" id="rh-wd">Wardrobe</button><button class="btn ghost sm" data-sleep="7">Sleep until morning (7:00)</button><button class="btn ghost sm" data-sleep="18">Rest until evening (18:00)</button><button class="btn ghost sm" data-close>Close</button></div>`);
  ui.panel.querySelector('#rh-wd').onclick=()=>{closePanel();lookShop('wardrobe')};ui.panel.querySelectorAll('[data-sleep]').forEach(b=>b.onclick=()=>{closePanel();sleepTo(+b.dataset.sleep)})}
function sleepTo(h){let hrs=(h-W.time+24)%24;if(hrs<.5)hrs+=24;ui.fade.style.opacity=1;setTimeout(()=>{if(h<W.time||hrs>=24)W.dayN++;W.time=h;const sv=umSV();let earned=0;if(sv.biz)for(const B of BIZ){const o=sv.biz[B.id];if(o){const add=Math.max(0,Math.min(B.cap-o.bank,B.rate*hrs));o.bank+=add;earned+=add}}
  for(const f of NPCS)if(!f.npc.thief)npcFar(f);save();W.say(`You ${h===7?'slept':'rested'} for ${Math.round(hrs)} hours.${earned>=1?` Your shares earned ◉ ${Math.floor(earned)} meanwhile.`:''}`);setTimeout(()=>{ui.fade.style.opacity=0},300)},900)}
/* ---------------- traffic ---------------- */
function addDriver(c){const s=c.spec,L=s.len,base=s.wr+.12+.1,k=s.kind,cz=k==='hatch'?-L*.08:k==='coupe'?-L*.1:k==='pickup'?L*.12:0,g=new T.Group();g.position.set(s.wid*.2,base,cz);c.m.g.add(g);
  const cols=['#2f4f6a','#7a3a2a','#3a5a3a','#5a3a6a','#c8a868'];mesh(new T.BoxGeometry(.4,.42,.28),mat(cols[Math.floor(Math.random()*cols.length)]),0,.21,0,0,g);mesh(new T.SphereGeometry(.13,10,8),mat(['#e0b08a','#c68a5e','#9a6440','#6b4630'][Math.floor(Math.random()*4)]),0,.55,0,0,g)}
function spawnTraffic(){[['main','sedan','#6a6a70'],['main','hatch','#2a6a8a'],['main','pickup','#8a5a2a'],['main','coupe','#7a1a1a'],['canyon','hatch','#e8e8e8'],['iron','sedan','#5a2a2a'],['cliff','pickup','#3a4a3a'],['lake','hatch','#c8a040']].forEach(([rid,k,col])=>{const r=ROADS.find(r=>r.id===rid),n=r.S.length,i=Math.floor(rand(.15,.85)*n),dir=Math.random()<.5?1:-1,p=r.S[i],q=r.S[clamp(i+dir,0,n-1)];
  const c=spawnCar(k,p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z),{color:col,owner:'traffic',locked:true,fuel:1});c.ai={r,i,dir,want:rand(11.5,15),blockT:0,ghost:0,stuck:0};c.eng=true;addDriver(c)})}
function respawnAI(c){const fp=W.focus();for(let k=0;k<30;k++){const r=ROADS[Math.floor(Math.random()*ROADS.length)],n=r.S.length,i=Math.floor(rand(.05,.95)*n),p=r.S[i];if(Math.hypot(p.x-fp.x,p.z-fp.z)<180)continue;const dir=Math.random()<.5?1:-1,q=r.S[clamp(i+dir,0,n-1)];c.pos.set(p.x,p.h+.4,p.z);c.yaw=Math.atan2(q.x-p.x,q.z-p.z);c.vx=c.vy=c.w=0;c.flooded=false;c.eng=true;Object.assign(c.ai,{r,i,dir,blockT:0,stuck:0,ghost:0});syncCar(c,0);return}}
function aiDrive(c,dt){const a=c.ai,S=a.r.S,n=S.length,fp=W.focus(),far=Math.hypot(c.pos.x-fp.x,c.pos.z-fp.z);
  if(!a.thief&&(c.flooded||(a.stuck>10&&far>90)))return respawnAI(c);
  let i=clamp(a.i,0,n-1);for(let k=0;k<8;k++){const j=i+a.dir;if(j<0||j>=n)break;const p=S[i],q=S[j];if((c.pos.x-p.x)*(q.x-p.x)+(c.pos.z-p.z)*(q.z-p.z)>0)i=j;else break}a.i=i;
  if((a.dir>0&&i>=n-2)||(a.dir<0&&i<=1)){if(far>140&&!a.thief)return respawnAI(c);a.dir=-a.dir}
  const look=clamp(Math.round((5+Math.abs(c.vx)*.8)/4),1,6),j=clamp(i+a.dir*look,0,n-1),p=S[j],q=S[clamp(j+a.dir,0,n-1)];let dx=q.x-p.x,dz=q.z-p.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;const off=a.r.w*.25,tx=p.x-dz*off,tz=p.z+dx*off;
  let err=Math.atan2(tx-c.pos.x,tz-c.pos.z)-c.yaw;while(err>Math.PI)err-=TAU;while(err<-Math.PI)err+=TAU;
  // speed: towns, bends, things in the way
  let want=a.want;for(const t of TOWNS)if(Math.hypot(c.pos.x-t.x,c.pos.z-t.z)<t.r+15)want=Math.min(want,8.5);
  {const j2=clamp(i+a.dir*7,0,n-1),k2=clamp(j2+a.dir,0,n-1),bx=S[k2].x-S[j2].x,bz=S[k2].z-S[j2].z,ax=S[clamp(i+a.dir,0,n-1)].x-S[i].x,az=S[clamp(i+a.dir,0,n-1)].z-S[i].z;const cosb=(ax*bx+az*bz)/((Math.hypot(ax,az)*Math.hypot(bx,bz))||1);if(cosb<.9)want=Math.min(want,9)}
  if(Math.abs(err)>.9)want=Math.min(want,4);
  const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw),half=c.spec.wid/2+.9;let block=1e9,byMe=false;const chk=(x,z,r,me)=>{const ox=x-c.pos.x,oz=z-c.pos.z,ah=ox*fx+oz*fz,lat=Math.abs(ox*fz-oz*fx);if(ah>0&&ah<22&&lat<half+r&&ah<block){block=ah;byMe=me}};
  if(a.ghost>0)a.ghost-=dt;else{if(!inCar)chk(W.hero.pos.x,W.hero.pos.z,.4,true);for(const f of NPCS)if(!f.indoors&&!f.hidden&&Math.hypot(f.pos.x-c.pos.x,f.pos.z-c.pos.z)<24)chk(f.pos.x,f.pos.z,.4,false);for(const o of cars)if(o!==c&&Math.hypot(o.pos.x-c.pos.x,o.pos.z-c.pos.z)<26)chk(o.pos.x,o.pos.z,o.spec.wid/2,o===inCar||o===myCar)}
  const lenH=c.spec.len/2;if(block<1e9)want=Math.min(want,Math.max(0,(block-lenH-3)*.9));
  if(block<1e9&&Math.abs(c.vx)<.6){a.blockT+=dt;if(byMe&&a.blockT>3&&!a.honked&&far<40){a.honked=true;W.sfx('horn')}if(a.blockT>7&&!byMe){a.ghost=3;a.blockT=0}}else{a.blockT=0;a.honked=false}
  a.stuck=Math.abs(c.vx)<.3&&block>=1e9?a.stuck+dt:0;
  const v=c.vx;let thr=0,brk=0;if(v<want-.3)thr=clamp((want-v)/4,.25,1);else if(v>want+1)brk=clamp((v-want)/5,.3,1);if(want<.2&&v>.2)brk=1;
  const steer=clamp(err*2.4,-1,1);
  if(far>420&&!a.thief){c.pos.x+=fx*want*dt;c.pos.z+=fz*want*dt;c.yaw+=clamp(err,-1,1)*dt*1.5;c.vx=want;c.pos.y=groundAt(c.pos.x,c.pos.z)+.2;if(Math.random()<.05)syncCar(c,0);return}
  carStep(c,dt,{thr,brk,steer,hb:false})}
/* ---------------- car thieves ---------------- */
let TH=null,thiefCheck=25,thiefNight=-1;
function thiefTick(dt){const f=NPCS.find(n=>n.npc.thief),c=myCar;if(!f)return;const h=W.hero.pos;
  if(!TH){thiefCheck-=dt;if(thiefCheck>0)return;thiefCheck=40;if(!W.night||!c||inCar===c||c.ai||thiefNight===W.dayN||(MS&&MS.car===c))return;const d=Math.hypot(h.x-c.pos.x,h.z-c.pos.z);if(d<50||d>260||Math.random()>.3)return;
    thiefNight=W.dayN;const an=rand(0,TAU),p={x:c.pos.x+Math.cos(an)*24,z:c.pos.z+Math.sin(an)*24};collide(p,.5);f.indoors=false;f.pos.set(p.x,groundAt(p.x,p.z),p.z);TH={ph:'walk',t:0,c};return}
  const T2=TH,cc=T2.c,dh=Math.hypot(h.x-f.pos.x,h.z-f.pos.z);
  if((T2.ph==='walk'||T2.ph==='pick')&&dh<(inCar?10:7)){bubble(f,"Wasn't me!");T2.ph='flee';T2.t=0;cc.alarm=0;W.say('You scared the thief off!')}
  if(T2.ph==='walk'){const s=cc.spec,dx=cc.pos.x-Math.cos(cc.yaw)*(s.wid/2+.7),dz=cc.pos.z+Math.sin(cc.yaw)*(s.wid/2+.7);if(walkTo(f,dx,dz,2.3,dt)){T2.ph='pick';T2.t=0;cc.alarm=7;W.say(`Your car alarm! Someone is breaking into your ${cc.name}!`)}}
  else if(T2.ph==='pick'){T2.t+=dt;f.yaw=turnTo(f.yaw,Math.atan2(cc.pos.x-f.pos.x,cc.pos.z-f.pos.z),6*dt);f.vel.set(0,0,0);animate(f,dt);
    if(T2.t>7){f.indoors=true;let best=null,bd=1e9;for(const r of ROADS)for(let i=0;i<r.S.length;i+=3){const d=Math.hypot(r.S[i].x-cc.pos.x,r.S[i].z-cc.pos.z);if(d<bd){bd=d;best={r,i}}}
      cc.ai={r:best.r,i:best.i,dir:Math.random()<.5?1:-1,want:16,blockT:0,ghost:0,stuck:0,thief:true,drive:rand(35,55)};cc.eng=true;cc.locked=true;cc.alarm=0;T2.ph='drive';T2.t=0;W.say('Your car is being stolen! Chase it and block its way!')}}
  else if(T2.ph==='drive'){const a=cc.ai;a.drive-=dt;const dc=Math.hypot(h.x-cc.pos.x,h.z-cc.pos.z);T2.t=Math.abs(cc.vx)<1.5&&dc<10?T2.t+dt:0;
    if(T2.t>1.2){cc.ai=null;cc.eng=false;cc.vx=cc.vy=cc.w=0;cc.locked=false;const s=cc.spec;f.indoors=false;const px=cc.pos.x-Math.cos(cc.yaw)*(s.wid/2+.9),pz=cc.pos.z+Math.sin(cc.yaw)*(s.wid/2+.9);f.pos.set(px,groundAt(px,pz),pz);bubble(f,'Fine! Take it!');T2.ph='flee';T2.t=0;W.say('The thief jumped out and ran off. Your car is yours again.')}
    else if(a.drive<=0){cc.ai=null;cc.eng=false;cc.vx=cc.vy=cc.w=0;cc.locked=true;TH=null;W.say(`Your ${cc.name} was stolen and dumped somewhere! Its tracker shows it on your map.`);return}}
  else if(T2.ph==='flee'){T2.t+=dt;const ax=f.pos.x-h.x,az=f.pos.z-h.z,l=Math.hypot(ax,az)||1;walkTo(f,f.pos.x+ax/l*5,f.pos.z+az/l*5,5.5,dt);if(T2.t>6){f.indoors=true;TH=null}}
  if(!f.indoors){f.rig.aura.visible=false;f.rig.root.position.copy(f.pos);f.rig.root.rotation.y=f.yaw;f.rig.root.visible=true}else f.rig.root.visible=false}

/* ---------------- money & buying ---------------- */
const UPG={eng:{n:'Engine tune',lv:[150,320,600],d:'More power, quicker off the line and a higher top speed.'},brk:{n:'Brakes',lv:[120,280],d:'Stop shorter and harder.'},tyre:{n:'Tyres',lv:[140,300],d:'More grip in the corners.'}};
const LVN=['Stock','Street','Sport','Race'];
const PAINTS=['#c8442a','#2f4f7a','#5a6a3a','#e0a83a','#f4f4f4','#1a1a1e','#7a7a80','#2a6a4a','#6a3a8a','#e88aa8','#3aa0d0','#8a5a2a'];
const TANK={hatch:7000,sedan:6000,pickup:5000,coupe:4500};
const HOMES=[{id:'cottage',name:'Hollow Cottage',price:0},
  {id:'town',name:'Ashford Townhouse',price:1500,desc:'A tall townhouse on the quiet east side of Ashford, a short walk from the market square. It has a wardrobe inside and its own driveway where any of your cars can wait.'},
  {id:'cabin',name:'Lakeside Cabin',price:2400,desc:'A wooden cabin above the shore of Lake Mere, at the end of Lakeside Lane. Quiet, with a view over the water. It has a wardrobe inside and its own driveway where any of your cars can wait.'}];
const BIZ=[{id:'bakery',name:'Ashford Bakery',who:'Rosa',price:900,rate:14,cap:420,spot:'bakery'},{id:'inn',name:'Hollowbrook Inn',who:'The innkeeper',price:1300,rate:20,cap:600,spot:'inn'},{id:'tea',name:'Tea House',who:'The tea master',price:1800,rate:28,cap:840,spot:'tea'}];
function cmod(sv,k){sv.cmod=sv.cmod||{};return sv.cmod[k]||(sv.cmod[k]={eng:0,brk:0,tyre:0,paint:null,dmg:0,fuel:1})}
function modSpec(k,cm){const b=CARS[k];return Object.assign({},b,{power:b.power*(1+.14*cm.eng),acc:b.acc*(1+.08*cm.eng),top:b.top*(1+.05*cm.eng),brk:b.brk*(1+.13*cm.brk),grip:b.grip*(1+.045*cm.tyre)})}
const fuelCost=c=>Math.max(1,Math.ceil((1-c.fuel)*40));
const repairCost=c=>Math.max(1,Math.ceil(c.dmg*.6));
function sellPrice(sv,k){const cm=cmod(sv,k);let up=0;for(const u in UPG)for(let i=0;i<cm[u];i++)up+=UPG[u].lv[i];return Math.floor(CARS[k].price*.5+up*.4)}
function keepCarState(){if(!myCar)return;const cm=cmod(umSV(),myCar.type);cm.dmg=Math.round(myCar.dmg);cm.fuel=myCar.fuel}
function bizOf(sv,id){return (sv.biz||{})[id]}
function refuel(){const c=inCar,sv=umSV();if(!c)return;const pay=Math.min(fuelCost(c),sv.gold||0);if(pay<=0){W.say("You can't afford any fuel.");return}c.fuel=Math.min(1,c.fuel+pay/40);sv.gold-=pay;umSave();W.sfx('chirp');W.say(`${c.fuel>.99?'Tank full':'Filled up as much as you could afford'} · ◉ ${pay}`);if(!c.eng&&!c.flooded){c.eng=true;W.sfx('start');engineAudio(true)}}
function mechanic(){const sv=umSV(),c=inCar;if(!c)return;if(c!==myCar){W.say('Brann: "That isn\'t your car. I only work on cars that belong to whoever brings them in."');return}
  const k=c.type,cm=cmod(sv,k),rc=repairCost(c),gold=sv.gold||0,dmgP=Math.min(100,Math.round(c.dmg/2.5));
  openPanel(`<h2>Brann's Garage</h2><p style="opacity:.75;margin:0">"Let's have a look at your ${c.name}." · You have <b style="color:#ffd27a">◉ ${gold} gold</b></p>
  <div class="rc"><div><b>Body repair</b><small>${c.dmg<1?'Not a scratch on it.':`Damage ${dmgP}%. ${c.dmg>80?'The knocks are costing the engine power.':'A few dents and scrapes.'}`}</small></div>${c.dmg<1?'<span style="opacity:.6">Perfect</span>':`<button class="btn sm" data-fix ${gold<rc?'disabled':''}>Repair · ◉ ${rc}</button>`}</div>
  ${Object.keys(UPG).map(u=>{const U=UPG[u],lv=cm[u],nx=U.lv[lv];return `<div class="rc"><div><b>${U.n}</b> <small style="display:inline">· ${LVN[lv]}</small><small>${U.d}</small></div>${nx===undefined?'<span style="opacity:.6">Maxed</span>':`<button class="btn sm" data-up="${u}" ${gold<nx?'disabled':''}>${LVN[lv+1]} · ◉ ${nx}</button>`}</div>`}).join('')}
  <div class="rc"><div><b>Respray</b> <small style="display:inline">· ◉ 60</small><small>Pick a new colour.</small><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${PAINTS.map(p=>`<button data-paint="${p}" style="width:26px;height:26px;border-radius:6px;border:2px solid ${p===(cm.paint||CARS[k].color)?'#ffd27a':'rgba(255,255,255,.3)'};background:${p};cursor:pointer" ${gold<60?'disabled':''}></button>`).join('')}</div></div></div>
  <div style="margin-top:12px;text-align:right"><button class="btn ghost sm" data-close>Done</button></div>`);
  const pay=n=>{sv.gold-=n;W.sfx('chirp');umSave()},fix=ui.panel.querySelector('[data-fix]');
  if(fix)fix.onclick=()=>{pay(rc);c.dmg=0;cm.dmg=0;W.say('Brann hammers out every dent. Good as new.');mechanic()};
  ui.panel.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{const u=b.dataset.up,p=UPG[u].lv[cm[u]];if(sv.gold<p)return;pay(p);cm[u]++;c.spec=modSpec(k,cm);W.say(`${UPG[u].n}: upgraded to ${LVN[cm[u]]}.`);mechanic()});
  ui.panel.querySelectorAll('[data-paint]').forEach(b=>b.onclick=()=>{if(sv.gold<60)return;pay(60);cm.paint=b.dataset.paint;scene.remove(c.m.g);c.m=buildCarMesh(c.spec,cm.paint);scene.add(c.m.g);syncCar(c,0);mechanic()})}
function bizPanel(B){const sv=umSV(),o=bizOf(sv,B.id),gold=sv.gold||0;
  if(o){const n=Math.floor(o.bank);if(n>0){sv.gold=gold+n;o.bank-=n;umSave();W.sfx('chirp');W.say(`You collect ◉ ${n} from the ${B.name}.`)}else W.say(`Nothing to collect yet. The ${B.name} earns you ◉ ${B.rate} a minute.`);return}
  openPanel(`<h2>${B.name}</h2><p style="line-height:1.5">Buy a share of the ${B.name}. ${B.who} keeps running it, and you get a cut of every sale: about <b style="color:#ffd27a">◉ ${B.rate} a minute</b> while you're out in the world. Your cut piles up here until you come by to collect it. It holds up to ◉ ${B.cap}, so don't stay away too long.</p><p>Price: <b style="color:#ffd27a">◉ ${B.price}</b> · You have ◉ ${gold}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost sm" data-close>Not now</button><button class="btn sm" id="rh-bbuy" ${gold<B.price?'disabled':''}>Buy the share</button></div>`);
  ui.panel.querySelector('#rh-bbuy').onclick=()=>{if(sv.gold<B.price)return;sv.gold-=B.price;sv.biz=sv.biz||{};sv.biz[B.id]={bank:0};umSave();W.sfx('chirp');closePanel();W.say(`You own a share of the ${B.name}! Come back to collect your cut.`)}}
function homePanel(Hm){const sv=umSV(),gold=sv.gold||0;openPanel(`<h2>${Hm.name}</h2><p style="line-height:1.5">${Hm.desc}</p><p>Price: <b style="color:#ffd27a">◉ ${Hm.price}</b> · You have ◉ ${gold}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost sm" data-close>Not now</button><button class="btn sm" id="rh-hbuy" ${gold<Hm.price?'disabled':''}>Buy it</button></div>`);
  ui.panel.querySelector('#rh-hbuy').onclick=()=>{if(sv.gold<Hm.price)return;sv.gold-=Hm.price;sv.homes=sv.homes||['cottage'];sv.homes.push(Hm.id);umSave();W.sfx('chirp');closePanel();W.say(`The ${Hm.name} is yours! Your wardrobe is inside, and the driveway is your garage.`)}}
function wealth(){const sv=umSV(),inc=BIZ.filter(B=>bizOf(sv,B.id)).reduce((a,B)=>a+B.rate,0),hd=t=>`<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffd27a;margin-top:12px">${t}</div>`;
  openPanel(`<h2>Your money</h2><p style="margin:0">◉ <b style="color:#ffd27a">${sv.gold||0} gold</b>${inc?` · your shares earn ◉ ${inc} a minute`:''}</p>
  ${hd('Cars')}${sv.cars.map(k=>{const cm=cmod(sv,k),f=myCar&&myCar.type===k?myCar.fuel:cm.fuel,dm=myCar&&myCar.type===k?myCar.dmg:cm.dmg;return `<div class="rc"><div><b>${CARS[k].name}</b>${sv.carSel===k?' <small style="display:inline">· in use</small>':''}<small>Engine ${LVN[cm.eng]} · Brakes ${LVN[cm.brk]} · Tyres ${LVN[cm.tyre]} · Fuel ${Math.round((f===undefined?1:f)*100)}% · Damage ${Math.min(100,Math.round((dm||0)/2.5))}%</small></div></div>`}).join('')}
  ${hd('Homes')}${HOMES.filter(Hm=>Hm.id==='cottage'||(sv.homes||[]).includes(Hm.id)).map(Hm=>`<div class="rc"><div><b>${Hm.name}</b></div></div>`).join('')}${HOMES.filter(Hm=>Hm.price&&!(sv.homes||[]).includes(Hm.id)).map(Hm=>`<div class="rc"><div><b style="opacity:.6">${Hm.name}</b><small>For sale · ◉ ${Hm.price}</small></div></div>`).join('')}
  ${hd('Business shares')}${BIZ.map(B=>{const o=bizOf(sv,B.id);return `<div class="rc"><div><b style="${o?'':'opacity:.6'}">${B.name}</b><small>${o?`Earns ◉ ${B.rate}/min · ◉ ${Math.floor(o.bank)} waiting to be collected`:`Share for sale · ◉ ${B.price} · earns ◉ ${B.rate}/min`}</small></div></div>`}).join('')}
  <div style="margin-top:12px;text-align:right"><button class="btn ghost sm" data-close>Close</button></div>`)}
let lastGold=null,puffs=[],puffT=0;
function moneyTick(dt){const sv=umSV();
  if(inCar&&inCar.eng&&!inCar.flooded){const thr=keys.has('KeyW')||keys.has('ArrowUp')?1:0,was=inCar.fuel;inCar.fuel=Math.max(0,inCar.fuel-Math.abs(inCar.vx)*dt*(.45+.75*thr)/(TANK[inCar.type]||6000)-dt/2400);
    if(was>.15&&inCar.fuel<=.15)W.say('Fuel is low. Fill up at a pump: Ashford fuel station or Brann\'s Garage.');if(inCar.fuel<=0){inCar.eng=false;engineAudio(false);W.say('Out of fuel! Press R to call for a fuel can.')}}
  if(sv.biz)for(const B of BIZ){const o=sv.biz[B.id];if(o)o.bank=Math.min(B.cap,o.bank+B.rate*dt/60)}
  for(const Hm of HOMES){if(!Hm.sign)continue;const own=(sv.homes||[]).includes(Hm.id);if(own!==Hm.shown){Hm.shown=own;Hm.sign.material=new T.MeshLambertMaterial({map:own?signTex('YOURS','#2f6a3a','#ffffff',420,180):signTex('FOR SALE','#b02a2a','#ffffff',420,180)})}}
  const g=sv.gold||0;if(lastGold!==null&&g!==lastGold){const d=g-lastGold,e=document.createElement('div');e.className='rh-gpop';e.textContent=(d>0?'+':'−')+Math.abs(d);e.style.color=d>0?'#9ff0a0':'#ff8a7a';ui.hud.appendChild(e);setTimeout(()=>e.remove(),1700)}lastGold=g;
  if(!puffs.length)for(let i=0;i<14;i++){const m=new T.Mesh(new T.SphereGeometry(.35,7,5),new T.MeshBasicMaterial({color:'#5a5a5a',transparent:true,opacity:0,depthWrite:false}));m.visible=false;scene.add(m);puffs.push({m,t:0})}
  const c=inCar&&inCar.dmg>150&&inCar.eng?inCar:null;puffT-=dt;if(c&&puffT<=0){puffT=.13;const p=puffs.find(p=>p.t<=0);if(p){const s=c.spec;p.t=1.4;p.m.visible=true;p.m.position.set(c.pos.x+Math.sin(c.yaw)*s.len*.38,c.pos.y+s.hgt*.8,c.pos.z+Math.cos(c.yaw)*s.len*.38)}}
  for(const p of puffs){if(p.t<=0)continue;p.t-=dt;p.m.position.y+=dt*1.4;p.m.scale.setScalar(1+(1.4-p.t)*1.4);p.m.material.opacity=Math.max(0,p.t/1.4)*.45;if(p.t<=0)p.m.visible=false}}

/* ---------------- missions ---------------- */
let MS=null;// the active job
const npcBy=n=>NPCS.find(f=>f.npc.n===n);
function rewardTxt(m){return `◉ ${m.gold} gold · ${m.xp} XP${m.bonus?' · '+m.bonus:''}`}
const MISSIONS=[
  {id:'bread',giver:'Rosa the Baker',title:'Warm Delivery',repeat:true,gold:60,xp:30,bonus:'+30 gold if it arrives without a scratch',desc:'Rosa needs a basket of fresh bread taken to the Hollowbrook Inn while it is still warm. Pick it up at the bakery, then hurry down Kingsway Road. You have 1 minute 45.',
    steps:[{t:'Pick up the bread at the Ashford Bakery',at:()=>W.spots.bakery,r:2.6,go:()=>{W.say('Rosa hands you a warm basket of bread. Hurry!');MS.timer=105;MS.dmg0=myCar?myCar.dmg:0}},
      {t:'Deliver the bread to the Hollowbrook Inn',at:()=>W.spots.inn,r:3,go:()=>{const clean=(myCar?myCar.dmg:0)-MS.dmg0<15;if(clean)MS.extraGold=30;W.say(clean?'Delivered warm and perfect. The innkeeper adds a tip!':'Delivered. The basket took a few bumps on the way.')}}]},
  {id:'taxi',giver:'Old Pell',title:'A Ride to Ashford',repeat:true,gold:50,xp:30,bonus:'tip up to 40 for a smooth ride',desc:'Old Pell wants to visit the Tea House in Ashford, but his knees are not what they were. Pick him up in your car and drive him there. He likes a gentle ride.',
    steps:[{t:'Drive your car up to Old Pell and stop next to him',check:()=>{const p=npcBy('Old Pell');return inCar&&p&&Math.hypot(inCar.pos.x-p.pos.x,inCar.pos.z-p.pos.z)<7&&Math.abs(inCar.vx)<1},at:()=>{const p=npcBy('Old Pell');return p?{x:p.pos.x,z:p.pos.z}:null},go:()=>{const p=npcBy('Old Pell');p.rig.root.visible=false;p.hidden=true;MS.comfort=40;MS.car=inCar;MS.d0=inCar.dmg;W.say('Old Pell climbs in. "Mind my hat, youngster."')}},
      {t:'Drive Old Pell to the Tea House in Ashford',at:()=>W.spots.tea,r:12,check:()=>inCar===MS.car&&Math.hypot(inCar.pos.x-W.spots.tea.x,inCar.pos.z-W.spots.tea.z)<12&&Math.abs(inCar.vx)<1,tick:dt=>{if(inCar!==MS.car)return;const sp=Math.abs(inCar.vx)*3.6;if(sp>105){MS.comfort-=dt*6;if(Math.random()<dt*.4)passenger(['Slow down! I\'d like to see my grandchildren again!','My hat! You\'ll lose my hat!','This isn\'t a race, youngster!'])}if(inCar.dmg>MS.d0+2){MS.comfort-=8;MS.d0=inCar.dmg;passenger(['Oof! My back!','Watch where you\'re going!','I felt that in my knees!'])}if(Math.random()<dt*.03)passenger(['I used to drive this road with a horse and cart, you know.','Lovely day for it.','Did you know the Silverrun used to flood every spring?','Ashford has the best ginger tea. You should try it.'])},
        go:()=>{const p=npcBy('Old Pell');p.hidden=false;p.rig.root.visible=true;const s=W.spots.tea;p.pos.set(s.x+1,groundAt(s.x+1,s.z),s.z);p.home={x:s.x+1,z:s.z};MS.extraGold=Math.max(0,Math.round(MS.comfort));W.say(MS.comfort>30?'"What a smooth ride! Here, take a little extra."':MS.comfort>10?'"We made it. Mostly in one piece."':'"Never again. Here\'s your fare."')}}],
    onEnd:()=>{const p=npcBy('Old Pell');if(p&&p.hidden){p.hidden=false;p.rig.root.visible=true}}},
  {id:'trial',giver:'Tomas',title:'Kingsway Time Trial',repeat:true,gold:40,xp:25,bonus:'silver +30, gold +80',desc:'Tomas has marked ten checkpoints down Kingsway Road from Hollowbrook to Ashford. Drive through them all as fast as you can. Under 80s for silver, under 60s for gold.',
    start:()=>{MS.cps=[];const S=ROADS[0].S,a=8,b=S.length-10;for(let i=0;i<10;i++){const k=Math.round(a+(b-a)*i/9),p=S[k],q=S[Math.min(k+1,S.length-1)];const ring=new T.Mesh(new T.TorusGeometry(5,.35,8,28),new T.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:.85}));ring.position.set(p.x,p.h+4,p.z);ring.rotation.y=Math.atan2(q.x-p.x,q.z-p.z);scene.add(ring);MS.cps.push({x:p.x,z:p.z,ring})}MS.cpI=0},
    steps:[{t:'Drive to the first checkpoint in your car',at:()=>MS.cps[0],r:7,needCar:true,go:()=>{MS.cps[0].ring.visible=false;MS.cpI=1;MS.clock=0;W.sfx('chirp');W.say('GO!')}},
      {t:'Pass all the checkpoints',at:()=>MS.cps[MS.cpI],tick:dt=>{MS.clock+=dt;const c=MS.cps[MS.cpI],f=W.focus();MS.cps.forEach((k,i)=>{k.ring.material.color.set(i===MS.cpI?'#ffd27a':'#7a6a4a');k.ring.material.opacity=i===MS.cpI?.95:.35});if(c&&Math.hypot(f.x-c.x,f.z-c.z)<7){c.ring.visible=false;MS.cpI++;W.sfx('chirp')}},check:()=>MS.cpI>=MS.cps.length,info:()=>`Checkpoint ${Math.min(MS.cpI+1,10)} / 10 · ${MS.clock.toFixed(1)}s`,
        go:()=>{const t=MS.clock,sv=umSV();sv.best=sv.best||{};const pb=!sv.best.trial||t<sv.best.trial;if(pb)sv.best.trial=t;MS.extraGold=t<60?80:t<80?30:0;W.say(`${t<60?'GOLD':t<80?'SILVER':'BRONZE'} medal! ${t.toFixed(1)}s${pb?' · new personal best':''}`)}}],
    onEnd:()=>{(MS.cps||[]).forEach(c=>scene.remove(c.ring))}},
  {id:'cat',giver:'Little Ana',title:"Where's Biscuit?",gold:40,xp:40,desc:"Little Ana's cat Biscuit ran off into Whispering Woods. Search the woods, pick Biscuit up, and bring her home to Ana.",
    start:()=>{let x,z;for(let i=0;i<200;i++){const a=rand(0,TAU),r=rand(10,70);x=-120+Math.cos(a)*r;z=260+Math.sin(a)*r;if(groundAt(x,z)>WATER+1&&!solidsNear(x,z).some(o=>o.type==='c'&&Math.hypot(o.x-x,o.z-z)<o.r+1))break}MS.cat=makeCat(x,z);MS.area={x:-120,z:260,r:80}},
    steps:[{t:'Search Whispering Woods for Biscuit',at:()=>MS.area,area:true,check:()=>false,info:()=>{const d=Math.hypot(W.focus().x-MS.cat.x,W.focus().z-MS.cat.z);return d<15?'You can hear meowing very close by!':d<40?'Faint meowing somewhere nearby...':'Listen for meowing.'}},
      {t:'Bring Biscuit back to Little Ana',at:()=>{const a=npcBy('Little Ana');return a?{x:a.pos.x,z:a.pos.z}:null},r:3,go:()=>{scene.remove(MS.cat.g);const a=npcBy('Little Ana');if(a)bubble(a,'BISCUIT! You found her!')}}],
    onEnd:()=>{if(MS.cat)scene.remove(MS.cat.g)}},
  {id:'ambush',giver:'Officer Hale',title:'Road Bandits',gold:80,xp:60,req:sv=>sv.f.trained,reqTx:"Come back once you've trained at Oren's Gym.",desc:'Bandits have been ambushing travellers on Kingsway Road near the woods. Ride out there and drive them off.',
    start:()=>{const S=ROADS[0].S,p=S[95];MS.spot={x:p.x,z:p.z}},
    steps:[{t:'Find the bandits on Kingsway Road',at:()=>MS.spot,r:16,go:()=>{MS.fighting=true;umSV().f.roadAmbush=false;W.go2({key:'roadAmbush',label:'Kingsway Road',short:'AMBUSH',title:'ROAD BANDITS',clear:'BANDITS DRIVEN OFF',queue:['scout','scout','sentinel','skeleton','slinger','scout'],map:'canopy'})}},
      {t:'Report back to Officer Hale in Ashford',at:()=>{const h=npcBy('Officer Hale');return h?{x:h.pos.x,z:h.pos.z}:null},r:3}]},
  {id:'pickup',giver:'Officer Hale',title:'The Stolen Pickup',gold:100,xp:60,desc:'A farmer\'s pickup was stolen and dumped somewhere along Lakeside Lane. Find it, hotwire it (you have permission) and drive it back to the Town Hall in Ashford.',
    start:()=>{const S=ROADS[2].S,p=S[S.length-14],q=S[S.length-13];const ox=-(q.z-p.z),oz=q.x-p.x,l=Math.hypot(ox,oz)||1;MS.car=spawnCar('pickup',p.x+ox/l*7,p.z+oz/l*7,rand(0,TAU),{color:'#8a6a3a',owner:'police',locked:true});MS.car.police=true},
    steps:[{t:'Find the stolen pickup along Lakeside Lane',at:()=>MS.car.pos,r:6,check:()=>inCar===MS.car,info:()=>'Hold F next to it to hotwire.'},
      {t:'Drive the pickup to the Town Hall in Ashford',at:()=>W.spots.hall,r:10,check:()=>inCar===MS.car&&Math.hypot(inCar.pos.x-W.spots.hall.x,inCar.pos.z-W.spots.hall.z)<12&&Math.abs(inCar.vx)<1,go:()=>{W.say('Officer Hale: "Good work. The farmer will be thrilled."');MS.car.locked=true;MS.car.owner='police';MS.keepCar=true}}]},
  {id:'herbs',giver:'Dr. Sana',title:'Herbs for the Clinic',repeat:true,gold:60,xp:35,desc:'Dr. Sana needs six bundles of glowing lakeroot from the shore of Lake Mere, at the end of Lakeside Lane, for her medicines.',
    start:()=>{MS.herbs=[];for(let i=0;i<6;i++){let x,z;for(let k=0;k<80;k++){const a=rand(0,TAU),r=LAKE.r+rand(8,22);x=LAKE.x+Math.cos(a)*r;z=LAKE.z+Math.sin(a)*r;if(groundAt(x,z)>WATER+.6)break}MS.herbs.push(makeHerb(x,z))}},
    steps:[{t:'Gather lakeroot on the shore of Lake Mere',at:()=>{const h=MS.herbs.find(h=>!h.got);return h||null},r:0,tick:()=>{const f=W.hero.pos;MS.herbs.forEach(h=>{if(!h.got&&!inCar&&Math.hypot(f.x-h.x,f.z-h.z)<1.6){h.got=true;scene.remove(h.g);W.sfx('chirp')}})},check:()=>MS.herbs.every(h=>h.got),info:()=>`${MS.herbs.filter(h=>h.got).length} / 6 gathered`},
      {t:'Bring the lakeroot to Dr. Sana at the Clinic',at:()=>W.spots.clinic,r:3.2,go:()=>W.say('"Perfect. These will help a lot of people."')}],
    onEnd:()=>{(MS.herbs||[]).forEach(h=>scene.remove(h.g))}}];
function missionOpen(m){const sv=umSV(),d=(sv.jobs||{})[m.id];return (m.repeat||!d)&&(!m.req||m.req(sv))}
function offerMission(m){openPanel(`<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffd27a">Job · ${m.giver}</div><h2>${m.title}</h2><p style="line-height:1.5">${m.desc}</p><p><b style="color:#ffd27a">Reward:</b> ${rewardTxt(m)}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost sm" data-close>Not now</button><button class="btn sm" id="rh-accept">Accept</button></div>`);ui.panel.querySelector('#rh-accept').onclick=()=>{closePanel();startMission(m)}}
function jobBoard(){const sv=umSV();openPanel(`<h2>Job board</h2><p style="opacity:.75;margin:0">Folks around the valley who need a hand. Talk to them to take the job, or accept it here.</p>${MISSIONS.map(m=>{const open=missionOpen(m),done=(sv.jobs||{})[m.id],lock=m.req&&!m.req(sv);return `<div class="rc"><div><b>${m.title}</b> <small style="display:inline">· ${m.giver}${done?` · done ${done}×`:''}</small><small>${lock?m.reqTx:m.desc}</small><small style="color:#ffd27a">${rewardTxt(m)}</small></div>${MS&&MS.m===m?'<span style="opacity:.7">Active</span>':open&&!MS?`<button class="btn sm" data-job="${m.id}">Accept</button>`:`<span style="opacity:.6">${lock?'Locked':done&&!m.repeat?'Done':'Busy'}</span>`}</div>`}).join('')}<div style="text-align:right;margin-top:10px"><button class="btn ghost sm" data-close>Close</button></div>`);
  ui.panel.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>{closePanel();startMission(MISSIONS.find(m=>m.id===b.dataset.job))})}
function startMission(m){if(MS)return;MS={m,step:0,t:0,extraGold:0};if(m.start)m.start();W.sfx('chirp');W.say(`Job started: ${m.title}`);stepEnter()}
function stepEnter(){const st=MS.m.steps[MS.step];if(st&&st.enter)st.enter()}
function missionNext(){const st=MS.m.steps[MS.step];if(st&&st.go)st.go();MS.step++;if(MS.step>=MS.m.steps.length)endMission(true);else stepEnter()}
function endMission(ok,quiet){if(!MS)return;const m=MS.m;if(m.onEnd)m.onEnd();if(MS.car&&!MS.keepCar&&m.id==='pickup'&&inCar!==MS.car){scene.remove(MS.car.m.g);cars.splice(cars.indexOf(MS.car),1)}
  if(ok){const sv=umSV();sv.jobs=sv.jobs||{};sv.jobs[m.id]=(sv.jobs[m.id]||0)+1;const g=m.gold+(MS.extraGold||0);const r=umReward(sv,m.xp,g,sv.el?1:0);umSave();W.sfx('chirp');setTimeout(()=>W.say(`JOB COMPLETE · ${m.title} · +${g} gold · +${m.xp} XP${r.ups.length?' · LEVEL UP!':''}${r.newAb?' · New ability: '+r.newAb:''}`),1600)}
  else if(!quiet)W.say(`Job failed: ${m.title}. Try again from the job board.`);
  MS=null;ui.obj.style.display='none';if(wp)wp.visible=wr.visible=false}
W.go2=um=>{save();engineAudio(false);inCar=null;ui.hud.hidden=true;closePanel();ui.talk.style.display='none';W.talk=null;mode='select';umWaves(um)};
let wp,wr;
function missionTick(dt){if(!wp){wp=new T.Mesh(new T.CylinderGeometry(.9,.9,90,14,1,true),new T.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));wr=new T.Mesh(new T.RingGeometry(1.4,1.9,36),new T.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:.9,side:T.DoubleSide,depthWrite:false}));wr.rotation.x=-Math.PI/2;scene.add(wp);scene.add(wr);wp.visible=wr.visible=false}
  if(!MS){ui.obj.style.display='none';return}const m=MS.m,st=m.steps[MS.step];
  // returning from the ambush fight
  if(MS.fighting){if(mode!=='roam')return;MS.fighting=false;if(!umSV().f.roadAmbush){endMission(false);W.say('The bandits got away. Try the job again from the board.');return}W.say('The bandits are gone. Report back to Officer Hale.')}
  if(MS.timer!==undefined&&MS.step>0){MS.timer-=dt;if(MS.timer<=0){endMission(false);W.say('Too slow! The bread went cold. Job failed.');return}}
  if(st.tick)st.tick(dt);if(!MS)return;
  const tg=st.at&&st.at();const f=W.focus();let done=false;
  if(st.check)done=st.check();else if(tg&&st.r){done=Math.hypot(f.x-tg.x,f.z-tg.z)<st.r&&(!st.needCar||inCar)}
  if(done){missionNext();if(!MS)return}
  // HUD + waypoint
  const t2=m.steps[MS.step].at&&m.steps[MS.step].at();if(t2&&!m.steps[MS.step].area){wp.visible=wr.visible=true;const gy=groundAt(t2.x,t2.z);wp.position.set(t2.x,gy+45,t2.z);wr.position.set(t2.x,gy+.1,t2.z);wr.rotation.z+=dt;wp.material.opacity=.18+Math.sin(clock*3)*.06}else{wp.visible=wr.visible=false}
  const s2=m.steps[MS.step],dist=t2?Math.round(Math.hypot(f.x-t2.x,f.z-t2.z)):null;
  ui.obj.style.display='block';ui.obj.innerHTML=`<b>${m.title}</b><p>${s2.t}</p><small>${s2.info?s2.info():''}${s2.info&&(dist!==null&&!s2.area)?' · ':''}${dist!==null&&!s2.area?dist+' m':''}${MS.timer!==undefined&&MS.step>0?` · ⏱ ${Math.floor(MS.timer/60)}:${String(Math.floor(MS.timer%60)).padStart(2,'0')}`:''}</small>`;
  if(MS.cat){const c=MS.cat;if(c.following){const h=W.hero.pos,d=Math.hypot(h.x-c.x,h.z-c.z);if(inCar){c.g.visible=false;c.x=h.x;c.z=h.z}else{c.g.visible=true;if(d>1.6){const k=Math.min(1,dt*4);c.x+=(h.x-c.x)*k*.8;c.z+=(h.z-c.z)*k*.8}}c.g.rotation.y=Math.atan2(h.x-c.x,h.z-c.z)}
    c.g.position.set(c.x,groundAt(c.x,c.z),c.z);c.tail.rotation.z=Math.sin(clock*4)*.4;c.meow-=dt;const d2=Math.hypot(f.x-c.x,f.z-c.z);if(c.meow<=0&&d2<60&&!c.following){c.meow=rand(2.5,5);if(d2<45)W.sfx('meow',clamp(1-d2/60,.1,1))}}}
function makeCat(x,z){const g=new T.Group();scene.add(g);const fur=mat('#e8964a'),dk=mat('#a85a2a');mesh(new T.BoxGeometry(.24,.22,.48),fur,0,.24,0,0,g);mesh(new T.BoxGeometry(.25,.06,.1),dk,0,.36,-.05,0,g);mesh(new T.SphereGeometry(.13,10,8),fur,0,.36,.28,0,g);[-1,1].forEach(q=>{mesh(new T.ConeGeometry(.05,.1,4),dk,q*.07,.48,.28,0,g);mesh(new T.SphereGeometry(.02,6,4),mat('#2a8a3a'),q*.05,.38,.39,0,g)});[[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([a,c])=>mesh(new T.CylinderGeometry(.03,.03,.16,6),fur,a*.08,.08,c*.14,0,g));
  const tail=new T.Group();tail.position.set(0,.28,-.26);g.add(tail);mesh(new T.CylinderGeometry(.025,.03,.36,6),dk,0,.16,-.05,0,tail).rotation.x=-.6;return {g,x,z,tail,meow:1,following:false}}
function makeHerb(x,z){const g=new T.Group(),y=groundAt(x,z);g.position.set(x,y,z);scene.add(g);for(let i=0;i<5;i++){const l=mesh(new T.ConeGeometry(.06,.45,4),mat('#3f9a34'),Math.cos(i*1.3)*.1,.22,Math.sin(i*1.3)*.1,0,g);l.rotation.z=Math.cos(i*1.3)*.4}const bl=mesh(new T.SphereGeometry(.09,8,6),glow('#9fffd0'),0,.5,0,0,g);bl.castShadow=false;return {g,x,z,got:false}}
function passenger(lines){if(!MS||MS.lastTalk>clock-4)return;MS.lastTalk=clock;W.say('Old Pell: '+lines[Math.floor(Math.random()*lines.length)])}
function bubble2(t){W.say(t)}
// floating ! over people with a job for you, ? when they are waiting on you
function questMarks(dt){let h='';const v=new T.Vector3(),r=renderer.domElement.getBoundingClientRect(),f=W.focus();for(const n of NPCS){if(n.hidden||n.indoors||!n.rig.root.visible)continue;const d=Math.hypot(n.pos.x-f.x,n.pos.z-f.z);if(d>60)continue;let mk='';
    if(MS){const st=MS.m.steps[MS.step],t=st.at&&st.at();if(t&&Math.abs(t.x-n.pos.x)<.5&&Math.abs(t.z-n.pos.z)<.5)mk='?'}else if(MISSIONS.some(m=>m.giver===n.npc.n&&missionOpen(m)))mk='!';
    if(!mk)continue;v.set(n.pos.x,n.pos.y+2.55*(n.size||1)+Math.sin(clock*3)*.08,n.pos.z).project(camera);if(v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1)h+=`<div class="rh-qm" style="left:${(v.x*.5+.5)*r.width}px;top:${(-v.y*.5+.5)*r.height}px">${mk}</div>`}ui.qms.innerHTML=h}

/*MOD:BEGIN*/
/* ---------------- mod tools (claude.ai copy only; build.py strips this block from the website) ---------------- */
W.mod={on:true,fly:false,spd:1,turbo:false,mapTp:true};
W.mod.tp=(x,z,quiet)=>{const p={x,z};collide(p,.6);const y=groundAt(p.x,p.z);if(inCar){inCar.pos.set(p.x,Math.max(y,WATER)+.6,p.z);inCar.vx=inCar.vy=inCar.w=0;inCar.vyU=0;syncCar(inCar,0)}else{const h=W.hero;h.pos.set(p.x,W.mod.fly?Math.max(y,WATER)+3:Math.max(y,WATER-1)+.2,p.z);h.vel.set(0,0,0)}camPos.set(p.x+.01,y+6,p.z+.01);if(!quiet)W.say('Teleported.')};
W.mod.flyStep=(h,dt,dx,dz)=>{const fast=keys.has('ShiftLeft')||keys.has('ShiftRight'),sp=(fast?75:28)*(W.panelOpen?0:1);let vy=0;if(!W.panelOpen){if(keys.has('Space'))vy+=1;if(keys.has('KeyC')||keys.has('ControlLeft'))vy-=1}
  h.pos.x+=dx*sp*dt;h.pos.z+=dz*sp*dt;h.pos.y+=vy*sp*.7*dt;const e=HALF-40;h.pos.x=clamp(h.pos.x,-e,e);h.pos.z=clamp(h.pos.z,-e,e);const g=Math.max(groundAt(h.pos.x,h.pos.z),WATER-1.1);if(h.pos.y<g)h.pos.y=g;h.pos.y=Math.min(h.pos.y,260);
  h.vel.set(0,0,0);h.grounded=h.pos.y<=g+.05;W.inWater=false;if(dx||dz)h.yaw=turnTo(h.yaw,Math.atan2(dx,dz),10*dt);h.st='free';h.status=h.status||{};animate(h,dt);h.rig.aura.visible=false;h.rig.root.position.copy(h.pos);h.rig.root.visible=!inCar};
W.mod.frame=dt=>{if(pressedK.has('KeyN')){if(W.panelOpen&&W.mod.panel)closePanel();else if(!W.panelOpen)W.mod.menu()}if(!W.panelOpen&&pressedK.has('KeyG')&&!inCar){W.mod.fly=!W.mod.fly;W.say(W.mod.fly?'Fly mode ON · Space up · C down · Shift fast':'Fly mode OFF');if(!W.mod.fly){const h=W.hero;h.vel.set(0,0,0)}}
  if(!W.panelOpen)W.mod.panel=false;
  if(W.mod.turbo&&inCar&&!W.panelOpen&&(keys.has('KeyW')||keys.has('ArrowUp'))&&!inCar.flooded&&inCar.vx>-1)inCar.vx=Math.min(inCar.vx+dt*14,62);
  W.mod.badge.textContent=`MOD${W.mod.fly?' · FLY':''}${W.mod.spd>1?' · '+W.mod.spd+'× SPEED':''}${W.mod.turbo?' · TURBO':''} · N menu`};
W.mod.places=()=>{const L=[['Hollowbrook',TOWNS[0].x+4,TOWNS[0].z+8],['Ashford',TOWNS[1].x+6,TOWNS[1].z+10],["Oren's Gym",W.yard.x,W.yard.z+5],['Ashford Motors',W.motors.x,W.motors.z+8],['Home garage',W.garage.x+4,W.garage.z],['Lake Mere shore',LAKE.x+LAKE.r+14,LAKE.z],['Whispering Woods',-120,260]];
  LOCS.forEach(o=>{if(o.id!=='gym')L.push([o.name,o.x+5,o.z+5])});if(myCar&&inCar!==myCar)L.push(['Your car',myCar.pos.x+3,myCar.pos.z]);if(MS&&wp&&wp.visible)L.unshift(['★ Current job target',wp.position.x+2,wp.position.z+2]);return L};
W.mod.menu=()=>{const P=W.mod.places();openPanel(`<h2>Mod tools</h2><p style="opacity:.75;margin:0">Only in the claude.ai copy. The website version doesn't have these.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button class="btn sm ${W.mod.fly?'':'ghost'}" data-m="fly">Fly (G): ${W.mod.fly?'ON':'OFF'}</button><button class="btn sm ${W.mod.spd>1?'':'ghost'}" data-m="spd">Run speed: ${W.mod.spd}×</button><button class="btn sm ${W.mod.turbo?'':'ghost'}" data-m="turbo">Car turbo: ${W.mod.turbo?'ON':'OFF'}</button><button class="btn sm ${W.mod.mapTp?'':'ghost'}" data-m="maptp">Click the map (M) to teleport: ${W.mod.mapTp?'ON':'OFF'}</button></div>
  <b style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffd27a">Time · now ${clockTxt()}</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px">${[6,9,12,17,20,23,2].map(t=>`<button class="btn ghost sm" data-time="${t}">${t}:00</button>`).join('')}</div>
  <b style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffd27a">Teleport</b><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;margin-top:6px">${P.map((p,i)=>`<button class="btn ghost sm" data-tp="${i}">${p[0]}</button>`).join('')}</div>
  <div style="text-align:right;margin-top:12px"><button class="btn ghost sm" data-close>Close (N)</button></div>`);W.mod.panel=true;
  ui.panel.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const k=b.dataset.m;if(k==='fly'){if(inCar){W.say('Get out of the car to fly.');return}W.mod.fly=!W.mod.fly}else if(k==='spd')W.mod.spd=W.mod.spd===1?2:W.mod.spd===2?4:1;else if(k==='turbo')W.mod.turbo=!W.mod.turbo;else W.mod.mapTp=!W.mod.mapTp;W.mod.menu()});
  ui.panel.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{W.time=+b.dataset.time;W.mod.menu()});
  ui.panel.querySelectorAll('[data-tp]').forEach(b=>b.onclick=()=>{const p=P[+b.dataset.tp];closePanel();W.mod.tp(p[1],p[2],true);W.say('Teleported to '+p[0]+'.')})};
W.modSetup=()=>{const b=document.createElement('div');b.style.cssText='position:absolute;left:50%;top:10px;transform:translateX(-50%);font:800 11px system-ui;letter-spacing:.12em;color:#9ff0c8;background:rgba(10,40,30,.7);border:1px solid rgba(159,240,200,.5);border-radius:99px;padding:4px 12px;pointer-events:none';ui.hud.appendChild(b);W.mod.badge=b;
  const cv=ui.map.querySelector('canvas');cv.style.cursor='crosshair';cv.addEventListener('click',e=>{if(!W.mod.mapTp)return;const r=cv.getBoundingClientRect(),s=Math.min(r.width,r.height),ox=r.left+(r.width-s)/2,oy=r.top+(r.height-s)/2,u=(e.clientX-ox)/s,v=(e.clientY-oy)/s;if(u<0||u>1||v<0||v>1)return;W.mod.tp(-HALF+u*HALF*2,-HALF+v*HALF*2,true);ui.map.style.display='none';W.say('Teleported.')})};
/*MOD:END*/
/* ---------------- main ---------------- */
function build(){if(built)return;built=true;scene=new T.Scene();camera=new T.PerspectiveCamera(58,innerWidth/innerHeight,.1,1600);buildSky();buildTerrain();buildRoads();trees();buildTowns();buildMapImage();buildUI();
  NPC_DEFS.forEach((D,i)=>mkNpc(D,i));parkedCars();spawnTraffic();buildNight();if(W.modSetup)W.modSetup();
  addEventListener('keydown',e=>{if(mode!=='roam')return;if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(!e.repeat)pressedK.add(e.code);keys.add(e.code)});
  addEventListener('keyup',e=>{if(mode!=='roam')return;keys.delete(e.code)});
  renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='roam')return;mdown=true;lastMX=e.clientX;lastMY=e.clientY});addEventListener('pointerup',()=>{mdown=false});
  addEventListener('pointermove',e=>{if(mode!=='roam'||!mdown)return;W.camYaw-=(e.clientX-lastMX)*.006;W.camPitch=clamp(W.camPitch+(e.clientY-lastMY)*.004,-.15,1.1);lastMX=e.clientX;lastMY=e.clientY});
  renderer.domElement.addEventListener('wheel',e=>{if(mode!=='roam')return;W.camDist=clamp(W.camDist+e.deltaY*.005,3,14)},{passive:true});
  addEventListener('resize',()=>{if(camera){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}})}
W.enter=()=>{const sv=umSV();if(!sv)return;lastGold=null;W.time=sv.time===undefined?8:sv.time;W.dayN=sv.dayN||0;audio();sv.cars=sv.cars||['hatch'];sv.carSel=sv.carSel||'hatch';umRegister(sv,!!portraits.hero);
  const wasBuilt=built;build();if(!wasBuilt||!W.hero||W.hero.def!==BYID.hero){if(W.hero)scene.remove(W.hero.rig.root);W.hero=mkFighter(BYID.hero,true,0);world.remove(W.hero.rig.root);scene.add(W.hero.rig.root);W.hero.foe=W.hero}
  const r=sv.roam;if(r&&r.x!==undefined){W.hero.pos.set(r.x,groundAt(r.x,r.z),r.z);W.hero.yaw=r.yaw||0}else{W.hero.pos.set(W.home.x+9,groundAt(W.home.x+9,W.home.z),W.home.z);W.hero.yaw=Math.PI/2}
  spawnMyCar(false);inCar=null;W.talk=null;W.panelOpen=false;mode='roam';resetFighters&&0;show(null);$('hud').hidden=true;$('touch').hidden=true;ui.hud.hidden=false;W.camYaw=W.hero.yaw;camPos.copy(W.hero.pos).add(V(0,4,-6));camLook.copy(W.hero.pos);curArea='';
  W.say(r?'':"This is Hollowbrook, your home. Master Oren's gym is on the north side of the village. Your car is in the garage next to your house.");if(!r)msgT=6;W.saveT=0};
W.go=a=>{save();engineAudio(false);inCar=null;ui.hud.hidden=true;closePanel();ui.talk.style.display='none';ui.map.style.display='none';W.talk=null;mode='select';umDo(a)};
W.exit=()=>{save();engineAudio(false);inCar=null;ui.hud.hidden=true;closePanel();ui.talk.style.display='none';ui.map.style.display='none';W.talk=null;goTitle()};
function save(){const sv=umSV();if(!sv||!W.hero)return;keepCarState();sv.time=W.time;sv.dayN=W.dayN;const h=inCar?inCar.pos:W.hero.pos;sv.roam={x:h.x,z:h.z,yaw:W.hero.yaw,car:myCar?{type:myCar.type,x:myCar.pos.x,z:myCar.pos.z,yaw:myCar.yaw}:null};umSave()}
let lastNear=0;
W.dbg=()=>({traffic:()=>cars.filter(c=>c.ai),TH:()=>TH,thiefTick,sleepTo,npcAwake,HOMES,BIZ,refuel,mechanic,ms:MS,MISSIONS,cars,myCar,inCar,NPCS,ROADS,TOWNS,roadAt,terrainH,spawnCar,setIn:c=>{inCar=c;c.eng=true}});
W.frame=dt=>{if(!built)return;dt=Math.min(dt,.05);
  if(pressedK.has('Escape')){if(W.panelOpen&&lookMode){W.restyle(curLook(umSV()));closeLook()}else if(W.panelOpen)closePanel();else if(ui.map.style.display==='block')ui.map.style.display='none';else{openPanel(`<h2>Paused</h2><p style="opacity:.75">Your progress in the open world is saved automatically.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" data-close>Resume</button><button class="btn ghost sm" id="rh-money">Your money</button>${MS?'<button class="btn ghost sm" id="rh-abandon">Abandon job</button>':''}<button class="btn ghost sm" id="rh-quit">Save and quit to title</button></div>`);ui.panel.querySelector('#rh-quit').onclick=()=>{closePanel();endMission(false,true);W.exit()};ui.panel.querySelector('#rh-money').onclick=wealth;const ab=ui.panel.querySelector('#rh-abandon');if(ab)ab.onclick=()=>{closePanel();endMission(false,true);W.say('Job abandoned.')}}}
  if(W.mod)W.mod.frame(dt);
  if(pressedK.has('KeyM')){const on=ui.map.style.display!=='block';ui.map.style.display=on?'block':'none';if(on){drawBigMap();if(myCar&&inCar!==myCar){const cv=ui.map.querySelector('canvas'),x=cv.getContext('2d'),S=cv.width,a=(myCar.pos.x+HALF)/(HALF*2)*S,b=(myCar.pos.z+HALF)/(HALF*2)*S;x.fillStyle='#4fe3d0';x.strokeStyle='#000';x.lineWidth=2;x.fillRect(a-7,b-7,14,14);x.strokeRect(a-7,b-7,14,14);x.font='bold 16px system-ui';x.fillStyle='#fff';x.textAlign='center';x.fillText('Your car',a,b-12)}}}
  const [pr,act,eAct]=interact();
  if(pressedK.has('KeyE')&&!W.panelOpen){if(eAct){if(eAct==='fuel')refuel();else mechanic()}else if(W.talk)talk(W.talk);else if(act&&act.startsWith('talk:'))talk(NPCS[+act.split(':')[1]]);else if(act&&act.startsWith('motors:'))motors();else if(act==='garage')garage();else if(act==='board')jobBoard();else if(act==='homemenu')homeMenu();else if(act&&act.startsWith('biz:'))bizPanel(BIZ.find(b=>b.id===act.slice(4)));else if(act&&act.startsWith('home:'))homePanel(HOMES.find(x=>x.id===act.slice(5)));else if(act&&act.startsWith('garage:'))garage(HOMES.find(x=>x.id===act.slice(7)).garage);else if(act==='cat'){MS.cat.following=true;W.sfx('chirp');bubble2('Mrrrow?');missionNext()}else if(act&&act.startsWith('shop:'))lookShop(act.slice(5));else if(act&&act.startsWith('loc:'))W.go(LOCS.find(L=>L.id===act.slice(4)).act)}
  if(W.talk&&Math.hypot(W.hero.pos.x-W.talk.pos.x,W.hero.pos.z-W.talk.pos.z)>4){W.talk=null;ui.talk.style.display='none'}
  if(pressedK.has('KeyF')&&!W.panelOpen){if(act==='exit')exitCar();else if(act==='enter'){const c=cars.find(c=>nearDoor(c)&&(c===myCar||!c.locked));if(c){if(c===myCar){W.sfx('chirp');c.flash=.5}enterCar(c)}}}
  if(act==='hotwire'&&keys.has('KeyF')&&hot&&!W.panelOpen){hotT+=dt;if(Math.random()<dt*6)W.sfx('click');
    if(!hot.seen&&!hot.police){for(const f of NPCS){if(Math.hypot(f.pos.x-hot.pos.x,f.pos.z-hot.pos.z)<20){hot.seen=true;bubble(f,NPC_DEFS.indexOf(f.npc)===hot.owner?'Hey! That\'s my car!':'Hey! What are you doing?!');if(NPC_DEFS.indexOf(f.npc)===hot.owner)f.npc.robbed=true;break}}}
    if(hotT>=3.5){hotT=0;const c=hot;c.locked=false;if(c.police){W.say('Hotwired. This one is police business.');enterCar(c);return}c.stolen=true;if(Math.random()<.45||c.seen){c.alarm=7;W.say('The alarm went off! Better drive.')}else W.say('Hotwired. Nobody noticed... this time.');const o=NPC_DEFS[c.owner];if(o)o.robbed=true;enterCar(c)}}else hotT=Math.max(0,hotT-dt*2);
  if(inCar&&pressedK.has('KeyR')&&inCar.flooded){const c=inCar;const rd=roadAt(c.pos.x,c.pos.z);let b=ROADS[0].S[0];let bd=1e9;for(const r of ROADS)for(const s of r.S){if(s.bridge)continue;const d=Math.hypot(s.x-c.pos.x,s.z-c.pos.z);if(d<bd){bd=d;b=s}}c.pos.set(b.x,b.h+.5,b.z);c.flooded=false;c.vx=c.vy=c.w=0;c.eng=true;W.say('The tow truck pulled you back onto the road. That cost you 10 gold.');const sv=umSV();sv.gold=Math.max(0,(sv.gold||0)-10);umSave();engineAudio(true)}
  if(inCar&&pressedK.has('KeyR')&&!inCar.flooded&&inCar.fuel<=0){const sv=umSV(),pay=Math.min(15,sv.gold||0);sv.gold=(sv.gold||0)-pay;inCar.fuel=.12;inCar.eng=true;engineAudio(true);W.sfx('start');umSave();W.say(pay?'A farmhand brings you a can of fuel. That cost 15 gold.':'A farmhand brings you a can of fuel. Free, this once.')}
  if(inCar&&pressedK.has('KeyH'))W.sfx('horn');if(inCar&&pressedK.has('KeyL')){inCar.lights=!inCar.lights;W.sfx('click')}
  // simulate
  if(inCar){const thr=(keys.has('KeyW')||keys.has('ArrowUp'))&&!W.panelOpen?1:0,brk=(keys.has('KeyS')||keys.has('ArrowDown'))&&!W.panelOpen?1:0,st=((keys.has('KeyA')||keys.has('ArrowLeft'))?1:0)-((keys.has('KeyD')||keys.has('ArrowRight'))?1:0);
    for(let i=0;i<2;i++)carStep(inCar,dt/2,{thr,brk,steer:st,hb:keys.has('Space')});engineTick(inCar,thr);W.hero.pos.copy(inCar.pos);W.hero.yaw=inCar.yaw;W.hero.rig.root.visible=false}
  else heroStep(dt);
  for(const c of cars){if(c===inCar)continue;if(c.ai){aiDrive(c,dt);continue}if(Math.abs(c.vx)>.05||Math.abs(c.vy)>.05||c.syncNeed){carStep(c,dt,{thr:0,brk:1,steer:0,hb:true});c.syncNeed=false}if(c.alarm>0){c.alarm-=dt;c.flash=.2;if(Math.floor(c.alarm*2.5)!==Math.floor((c.alarm+dt)*2.5))W.sfx('alarm');if(c.alarm<=0)c.flash=0;syncCar(c,0)}else if(c.flash>0)syncCar(c,dt)}
  // your car locks itself when you walk away
  if(myCar&&myCar.lockArm&&!inCar&&Math.hypot(W.hero.pos.x-myCar.pos.x,W.hero.pos.z-myCar.pos.z)>7){myCar.lockArm=false;myCar.locked=true;myCar.flash=.5;syncCar(myCar,0);W.sfx('chirp',.25)}
  const fp=W.focus();for(const f of NPCS){if(f.npc.thief)continue;const d=Math.hypot(f.pos.x-fp.x,f.pos.z-fp.z);f.rig.root.visible=d<140&&!f.hidden&&!f.indoors;if(d<160||f.commute)npcStep(f,dt,d<70);else npcFar(f)}thiefTick(dt);
  if(W.fires)W.fires.forEach((f,i)=>{f.scale.y=1+Math.sin(clock*13+i*2)*.18;f.scale.x=f.scale.z=1+Math.sin(clock*9+i)*.1});if(W.gems)W.gems.forEach(g=>{g.rotation.y+=dt*1.2;g.position.y=5+Math.sin(clock*2)*.2});
  {const sv=umSV();LOCS.forEach(L=>{if(!L.beam)return;const ok=!L.req||L.req(sv);L.beam.material.color.set(ok?L.col:'#777777');L.beam.material.opacity=ok?.16+Math.sin(clock*2)*.05:.06;L.ring.material.color.set(ok?L.col:'#777777');L.ring.rotation.z+=dt*.5})}
  moneyTick(dt);missionTick(dt);questMarks(dt);
  camStep(dt);skyTick(fp,dt);sun.target.position.set(fp.x,fp.y,fp.z);W.sky.position.copy(camera.position);
  // HUD
  ui.prompt.innerHTML=pr;ui.prompt.style.display=pr&&!W.panelOpen?'flex':'none';
  if(inCar){ui.speed.style.display='block';ui.speed.querySelector('b').textContent=Math.round(Math.abs(inCar.vx)*3.6);ui.speed.querySelector('small').textContent=(inCar.vx<-.5?'R':inCar.eng?'Gear '+inCar.gear:'Off')+' · km/h · '+inCar.name+' · '+(inCar.fuel<.15?'⚠ ':'')+'Fuel '+Math.round(inCar.fuel*100)+'%'}else ui.speed.style.display='none';
  const [an,ak]=areaName();if(an!==curArea){curArea=an;ui.area.querySelector('b').textContent=an;ui.area.querySelector('small').textContent=ak;ui.area.classList.add('on');areaT=3.5}if(areaT>0){areaT-=dt;if(areaT<=0)ui.area.classList.remove('on')}
  if(msgT>0){msgT-=dt;if(msgT<=0)ui.msg.classList.remove('on')}
  ui.gold.textContent='◉ '+(umSV().gold||0)+' gold  ·  '+clockTxt(true);drawMini();drawBubbles();
  W.saveT+=dt;if(W.saveT>15){W.saveT=0;save()}
  pressedK.clear();renderer.setRenderTarget(null);renderer.autoClear=true;camera.layers.enableAll();renderer.render(scene,camera)};
})();
