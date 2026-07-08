// ============================================================
// Hero 3D — "The Crown": metallic noise-displaced orb
// Three.js (CDN ESM) · procedural · self-contained · graceful fallback
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const hero = document.getElementById('top');
const canvas = document.getElementById('hero-canvas');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fallback(){ if (hero) hero.classList.add('static-hero'); }
function hasWebGL(){
  try { const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch(e){ return false; }
}

// 3D simplex noise (Ashima / Stefan Gustavson) — inlined for vertex displacement
const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

function initHero(){
  const isMobile = window.matchMedia('(max-width:760px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x08080a, 0.14);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth/window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5.4);

  // procedural environment (dark→gold band) for metallic reflections — no external HDR
  const envMap = makeEnv(renderer);

  // ---- the orb ----
  const uniforms = { uTime:{value:0}, uAmp:{value:0} };
  const geo = new THREE.IcosahedronGeometry(1.5, isMobile ? 64 : 128);
  const mat = new THREE.MeshStandardMaterial({ color:0x0f0f12, metalness:0.92, roughness:0.34, envMap, envMapIntensity:1.15 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uAmp  = uniforms.uAmp;
    shader.vertexShader = `uniform float uTime; uniform float uAmp;\n${SNOISE}\n` + shader.vertexShader
      .replace('#include <begin_vertex>', `
        float n = snoise(normal * 1.4 + uTime * 0.16);
        float n2 = snoise(normal * 3.1 - uTime * 0.11) * 0.4;
        vec3 transformed = position + normal * ((n + n2) * (0.16 + uAmp));
      `);
  };
  const orb = new THREE.Mesh(geo, mat);
  scene.add(orb);

  // a faint gold wire shell for extra depth
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.85, 2),
    new THREE.MeshBasicMaterial({ color:0xC9A24B, wireframe:true, transparent:true, opacity:0.05 })
  );
  scene.add(shell);

  // ---- lighting: one warm gold rim + dim cool fill ----
  const key = new THREE.DirectionalLight(0xC9A24B, 3.0); key.position.set(4, 5, 3); scene.add(key);
  const fill = new THREE.DirectionalLight(0x2a3550, 1.1); fill.position.set(-5, -2, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(-3, 2, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x404048, 0.25));

  // ---- post: bloom only on capable devices ----
  const useBloom = !isMobile;
  let composer = null;
  if (useBloom){
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.85, 0.82);
    composer.addPass(bloom);
  }

  // position orb toward the right so hero copy (left) stays clean
  function place(){
    const w = window.innerWidth;
    orb.position.x = shell.position.x = w > 900 ? 1.9 : (w > 620 ? 1.0 : 0);
    orb.position.y = shell.position.y = w > 620 ? 0.15 : 0.6;
    const s = w > 900 ? 1 : (w > 620 ? 0.85 : 0.72);
    orb.scale.setScalar(s); shell.scale.setScalar(s);
  }
  place();

  // ---- interaction ----
  const mouse = { x:0, y:0, tx:0, ty:0, lastX:0, lastY:0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    const dv = Math.hypot(mouse.tx - mouse.lastX, mouse.ty - mouse.lastY);
    uniforms.uAmp.value = Math.min(uniforms.uAmp.value + dv * 0.5, 0.42);
    mouse.lastX = mouse.tx; mouse.lastY = mouse.ty;
  }, { passive:true });

  // ---- resize ----
  function onResize(){
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.setSize(w, h); if (composer) composer.setSize(w, h);
    place();
  }
  window.addEventListener('resize', onResize);

  // ---- render loop with offscreen + tab pause ----
  const clock = new THREE.Clock();
  let running = true, rafId = null;

  function renderOnce(){
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  function frame(){
    if (!running) return;
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uAmp.value *= 0.94;              // velocity ripple decays
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    camera.position.x = mouse.x * 0.5;
    camera.position.y = -mouse.y * 0.4;
    camera.lookAt(orb.position.x * 0.5, 0, 0);
    orb.rotation.y += 0.0016; orb.rotation.x += 0.0006;
    shell.rotation.y -= 0.0012; shell.rotation.z += 0.0007;
    renderOnce();
    rafId = requestAnimationFrame(frame);
  }

  if (reduce){ renderOnce(); }        // reduced-motion → a single static frame
  else { frame(); }

  // pause when hero scrolls offscreen / tab hidden — battery + CPU win
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (reduce) return;
      if (en.isIntersecting && !running){ running = true; clock.start(); frame(); }
      else if (!en.isIntersecting && running){ running = false; if (rafId) cancelAnimationFrame(rafId); }
    });
  }, { threshold: 0.02 });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden){ running = false; if (rafId) cancelAnimationFrame(rafId); }
    else if (!running){ running = true; frame(); }
  });
}

// dark→gold equirect gradient → PMREM env map (self-contained, no HDR fetch)
function makeEnv(renderer){
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#1a1206');
  grad.addColorStop(0.42, '#3a2c10');
  grad.addColorStop(0.52, '#C9A24B');   // warm metallic highlight band
  grad.addColorStop(0.60, '#6b551f');
  grad.addColorStop(1.00, '#050506');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose(); pmrem.dispose();
  return env;
}

// ---- boot (after all consts/functions defined — avoids SNOISE temporal-dead-zone) ----
if (!canvas || !hasWebGL()) { fallback(); }
else { try { initHero(); } catch (e) { console.warn('[hero3d] init failed → static fallback', e); fallback(); } }
