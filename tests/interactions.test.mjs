import test from 'node:test';
import assert from 'node:assert/strict';
import { createInteractions, takeTrafficCar, roadRoute } from '../src/interactions.js';
import { createTrafficSimulation } from '../src/traffic-ai.js';
import { createState,isRoad,isLand } from '../src/physics.js';
test('commandeering stops AI, preserves its position and survives density changes',()=>{
 const t=createTrafficSimulation(),a=t.actors[0],x=a.agent.position.x;
 assert.equal(a.parked,true);t.step(.05,null);assert.equal(a.agent.position.x,x);
 const s=takeTrafficCar(a);
 assert.equal(s.x,x);assert.equal(s.type,a.type);assert.equal(s.speed,0);
 t.setDensity('high');t.step(.05,createState('foot'));
 assert.equal(a.agent.position.x,x);assert.equal(a.collider.enabled,false);assert.equal(a.enabled,false);
 assert.equal(takeTrafficCar(a),null);
});
test('crime cooldown prevents repeated collision charges and later crimes escalate',()=>{
 const c=createInteractions(),p=createState('sport');assert.ok(c.report());assert.equal(c.report(),false);
 for(let i=0;i<190;i++) c.step(1/60,p);
 assert.ok(c.report());assert.equal(c.level,2);
 for(let i=0;i<190;i++) c.step(1/60,p);c.report(3);assert.equal(c.level,3);
});
test('police stay on roads and land for a two minute pursuit',()=>{
 const c=createInteractions(),p={...createState('sport'),x:220,z:200,speed:10};c.report(2);
 for(let i=0;i<7200;i++) {c.step(1/60,p);for(const a of c.police)if(a.enabled){assert.ok(isRoad(a.x,a.z));assert.ok(isLand(a.x,a.z));}}
 assert.equal(c.level,2);
});
test('airborne escape clears wanted after a continuous search interval',()=>{
 const c=createInteractions(),p={...createState('plane'),y:100};c.report();let outcome;
 for(let i=0;i<1100;i++){const r=c.step(1/60,p);if(r)outcome=r;}
 assert.equal(outcome,'escaped');assert.equal(c.level,0);assert.ok(c.police.every(p=>!p.enabled));
});
test('nearby police intercept a stopped driver after three seconds',()=>{
 const c=createInteractions(),p={...createState('sport'),x:220,z:250,speed:0};c.report();
 const a=c.police[0];a.enabled=true;a.x=220;a.z=250;
 let outcome;for(let i=0;i<190;i++){const r=c.step(1/60,p);if(r)outcome=r;}
 assert.equal(outcome,'caught');assert.equal(c.level,0);
});
test('pursuit routes use axis aligned road segments',()=>{
 let p={x:120,z:117};for(const q of roadRoute(p,{x:-76,z:-123})){assert.ok(p.x===q.x||p.z===q.z);p=q;}
});
test('pedestrians move away from a nearby moving vehicle',()=>{
 const t=createTrafficSimulation(),a=t.actors.find(a=>a.kind==='person'),p={type:'sport',x:a.agent.position.x-1,y:1,z:a.agent.position.z,speed:12};
 t.step(.05,p);assert.equal(a.fleeing,true);assert.ok(a.agent.position.x>p.x+1);
});
