// ============================================================
// world3d.js — PERSISTENT scroll-driven 3D world (behind whole page)
// Gold noise orb + drifting particle field + precision rings.
// Scroll progress (0..1) drives a continuous camera + object path — the
// "one continuous world" feel. Three.js CDN · procedural · mobile-tiered.
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const canvas = document.getElementById('world-canvas');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px)').matches;

function fail(){ document.documentElement.classList.add('no-3d'); }
function hasWebGL(){ try { const c = document.createElement('canvas');
  return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch(e){ return false; } }

const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;

// linear interpolate a keyframed channel: stops = [[p,val],...] sorted by p
function track(stops, p){
  if (p <= stops[0][0]) return stops[0][1];
  if (p >= stops[stops.length-1][0]) return stops[stops.length-1][1];
  for (let i=0;i<stops.length-1;i++){
    const [pa,va]=stops[i],[pb,vb]=stops[i+1];
    if (p>=pa && p<=pb){ const t=(p-pa)/(pb-pa); const e=t*t*(3-2*t); return va+(vb-va)*e; }
  }
  return stops[stops.length-1][1];
}

function initWorld(){
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:!isMobile, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x08080a, 0.12);
  const camera = new THREE.PerspectiveCamera(44, window.innerWidth/window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5.6);

  const envMap = makeEnv(renderer);

  // --- orb ---
  const uniforms = { uTime:{value:0}, uAmp:{value:0} };
  const orbGeo = new THREE.IcosahedronGeometry(1.5, isMobile ? 48 : 128);
  const orbMat = new THREE.MeshStandardMaterial({ color:0x0f0f12, metalness:0.92, roughness:0.34, envMap, envMapIntensity:1.15 });
  orbMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime; sh.uniforms.uAmp = uniforms.uAmp;
    sh.vertexShader = `uniform float uTime; uniform float uAmp;\n${SNOISE}\n` + sh.vertexShader.replace('#include <begin_vertex>', `
      float n = snoise(normal*1.4 + uTime*0.16);
      float n2 = snoise(normal*3.1 - uTime*0.11)*0.4;
      vec3 transformed = position + normal * ((n+n2)*(0.16+uAmp));`);
  };
  const orb = new THREE.Mesh(orbGeo, orbMat);
  scene.add(orb);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 2),
    new THREE.MeshBasicMaterial({ color:0xC9A24B, wireframe:true, transparent:true, opacity:0.05 }));
  scene.add(shell);

  // --- precision rings (watch/metrics motif) — appear mid-scroll ---
  const rings = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color:0xC9A24B, metalness:1, roughness:0.25, envMap, transparent:true, opacity:0 });
  const ringCount = isMobile ? 3 : 5;
  for (let i=0;i<ringCount;i++){
    const r = 2.4 + i*0.55;
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 12, isMobile?120:200), ringMat);
    m.rotation.set(Math.PI*0.5 + i*0.15, i*0.4, 0); m.userData.spd = 0.0016 + i*0.0011;
    rings.add(m);
  }
  scene.add(rings);

  // --- drifting particle field (depth, always present) ---
  const N = isMobile ? 1600 : 4200;
  const pos = new Float32Array(N*3);
  for (let i=0;i<N;i++){ pos[i*3]=(Math.random()-0.5)*16; pos[i*3+1]=(Math.random()-0.5)*11; pos[i*3+2]=(Math.random()-0.5)*8 - 2; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pMat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uTime:{value:0}, uSize:{value: isMobile?2.2:2.8} },
    vertexShader:`uniform float uTime;uniform float uSize;varying float vA;void main(){vec3 p=position;
      p.y+=sin(uTime*0.3+p.x*0.5)*0.12; p.x+=cos(uTime*0.2+p.z*0.4)*0.1;
      vec4 mv=modelViewMatrix*vec4(p,1.0); vA=smoothstep(-14.0,-2.0,mv.z);
      gl_PointSize=uSize*(300.0/-mv.z); gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vA;void main(){float d=length(gl_PointCoord-0.5); if(d>0.5)discard;
      float a=(1.0-d*2.0)*0.22*vA; gl_FragColor=vec4(0.788,0.635,0.294,a);}` });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // --- lighting ---
  const key = new THREE.DirectionalLight(0xC9A24B, 3.0); key.position.set(4,5,3); scene.add(key);
  const fill = new THREE.DirectionalLight(0x2a3550, 1.1); fill.position.set(-5,-2,-3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(-3,2,-4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x404048, 0.25));

  // --- bloom (desktop only) ---
  let composer = null;
  if (!isMobile){
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.85, 0.82));
  }

  // --- scroll-driven path keyframes (p = 0 hero .. 1 contact) ---
  // orb travels across screen & scales; camera dollies/pans; rings fade in mid.
  const orbX = [[0,1.9],[0.16,-1.8],[0.34,1.6],[0.52,-1.2],[0.7,1.4],[0.86,-0.6],[1,0.0]];
  const orbY = [[0,0.15],[0.3,-0.6],[0.6,0.5],[1,0.0]];
  const orbS = [[0,1.0],[0.34,0.78],[0.7,0.9],[1,1.25]];
  const camZ = [[0,5.6],[0.3,4.7],[0.6,5.2],[0.85,4.4],[1,5.0]];
  const camY = [[0,0],[0.5,0.5],[1,-0.3]];
  const ringO = [[0,0],[0.14,0.0],[0.3,0.5],[0.55,0.6],[0.75,0.2],[1,0]];
  const partR = [[0,0],[0.5,0.25],[1,0.5]]; // particle rotation amount

  const w = isMobile ? 0.55 : 1; // dampen horizontal travel on mobile (keeps behind text)
  const mouse = { x:0, y:0, tx:0, ty:0, lastX:0, lastY:0 };
  window.addEventListener('pointermove', (e)=>{
    mouse.tx=(e.clientX/window.innerWidth)*2-1; mouse.ty=(e.clientY/window.innerHeight)*2-1;
    uniforms.uAmp.value=Math.min(uniforms.uAmp.value+Math.hypot(mouse.tx-mouse.lastX,mouse.ty-mouse.lastY)*0.4,0.4);
    mouse.lastX=mouse.tx; mouse.lastY=mouse.ty;
  },{passive:true});

  // Single source of truth: prefer Lenis's already-smoothed scroll value
  // instead of raw window.scrollY — avoids a second independent lerp
  // fighting Lenis's own smoothing (the "not smooth" root cause).
  function progress(){
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (h<=0) return 0;
    const y = (window.lenis && typeof window.lenis.scroll === 'number') ? window.lenis.scroll : (window.scrollY||window.pageYOffset);
    return Math.min(Math.max(y/h,0),1);
  }

  function resize(){
    const W=window.innerWidth,H=window.innerHeight;
    camera.aspect=W/H; camera.updateProjectionMatrix();
    renderer.setSize(W,H); if(composer) composer.setSize(W,H);
  }
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let running = true, raf = null, p = 0;
  // Drive rendering off the SAME ticker as Lenis/GSAP (one RAF loop for the
  // whole page) instead of a competing independent requestAnimationFrame —
  // eliminates the 1-2 frame read-after-write desync between systems.
  const usingTicker = !!(window.gsap && window.gsap.ticker);

  function renderOnce(){ if(composer) composer.render(); else renderer.render(scene,camera); }
  function tick(){
    if(!running) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t; pMat.uniforms.uTime.value = t;
    uniforms.uAmp.value *= 0.94;
    // Lenis already smooths scroll; only add our own easing as a fallback
    // when Lenis isn't present (raw scrollY alone is jumpy).
    const target = progress();
    p = window.lenis ? target : p + (target-p)*0.08;
    orb.position.x = track(orbX,p)*w + mouse.x*0.35;
    orb.position.y = track(orbY,p) - mouse.y*0.3;
    orb.scale.setScalar(track(orbS,p));
    shell.position.copy(orb.position); shell.scale.setScalar(track(orbS,p));
    camera.position.x += ((mouse.x*0.4)-camera.position.x)*0.05;
    camera.position.y += ((track(camY,p)-mouse.y*0.3)-camera.position.y)*0.05;
    camera.position.z += (track(camZ,p)-camera.position.z)*0.05;
    camera.lookAt(0,0,0);
    orb.rotation.y+=0.0016; orb.rotation.x+=0.0006;
    shell.rotation.y-=0.0012; shell.rotation.z+=0.0007;
    ringMat.opacity = track(ringO,p);
    rings.rotation.z += 0.0009; rings.rotation.x = 0.4 + p*0.6;
    rings.children.forEach(m=>m.rotation.z += m.userData.spd);
    particles.rotation.y = track(partR,p) + t*0.01;
    renderOnce();
    if (!usingTicker) raf = requestAnimationFrame(tick);
  }
  function startLoop(){ if (usingTicker) window.gsap.ticker.add(tick); else tick(); }
  function stopLoop(){ if (usingTicker) window.gsap.ticker.remove(tick); else if (raf) cancelAnimationFrame(raf); }
  if (REDUCED){ p = progress(); renderOnce(); } else startLoop();

  // pause when tab hidden (canvas is always on-screen, so only visibility matters)
  document.addEventListener('visibilitychange', ()=>{
    if (REDUCED) return;
    if (document.hidden){ running=false; stopLoop(); }
    else if(!running){ running=true; clock.start(); startLoop(); }
  });
}

function makeEnv(renderer){
  const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d');
  const grad=g.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#1a1206'); grad.addColorStop(0.42,'#3a2c10'); grad.addColorStop(0.52,'#C9A24B');
  grad.addColorStop(0.6,'#6b551f'); grad.addColorStop(1,'#050506');
  g.fillStyle=grad; g.fillRect(0,0,512,256);
  const tex=new THREE.CanvasTexture(c); tex.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer); const env=pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose(); return env;
}

// ---- boot (after all consts/functions defined — avoids SNOISE TDZ) ----
if (!canvas || !hasWebGL()) { fail(); }
else { try { initWorld(); } catch (e) { console.warn('[world3d] failed → no-3d', e); fail(); } }
