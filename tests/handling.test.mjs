import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,simulate,wrapAngle} from '../src/physics.js';
import {resolveCamera} from '../src/camera.js';
function drive(s,input,time,dt=1/60){for(let t=0;t<time-1e-6;t+=dt) simulate(s,input,dt);return s;}
function road(speed=0){return {...createState('sport'),x:220,z:120,speed};}
test('throttle ramps in while service braking responds on its first frame',()=>{
 const s=road();simulate(s,{throttle:1},1/60);assert.ok(s.acceleration>0&&s.acceleration<3);
 s.speed=20;simulate(s,{throttle:-1},1/60);assert.ok(s.acceleration<-25);
});
test('braking pauses at standstill before entering reverse',()=>{
 const s=road(2);while(s.speed>0) simulate(s,{throttle:-1},1/60);
 drive(s,{throttle:-1},.2);assert.equal(s.speed,0);
 drive(s,{throttle:-1},.5);assert.ok(s.speed<-1);
});
test('handbrake holds still without alternating forward and reverse motion',()=>{
 const s=road(.08);for(let i=0;i<120;i++){simulate(s,{brake:true},1/60);assert.ok(s.speed>=0);}
 assert.equal(s.speed,0);
});
test('high-speed steering is gentler than low-speed steering',()=>{
 const slow=road(12),fast=road(45),h=slow.heading;
 drive(slow,{steer:1},.25);drive(fast,{steer:1},.25);
 assert.ok(Math.abs(wrapAngle(fast.heading-h))<Math.abs(wrapAngle(slow.heading-h))*.7);
});
test('small steering inputs allow finer corrections and release recentres',()=>{
 const small=road(15),full=road(15),h=small.heading;
 drive(small,{steer:.25},.3);drive(full,{steer:1},.3);
 assert.ok(Math.abs(small.heading-h)<Math.abs(full.heading-h)*.35);
 drive(full,{},.6);assert.ok(Math.abs(full.steering)<.002);
});
test('handling stays consistent between 60 and 120 Hz physics steps',()=>{
 const a=road(),b=road();drive(a,{throttle:1,steer:.3},1.2);drive(b,{throttle:1,steer:.3},1.2,1/120);
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.4);assert.ok(Math.abs(a.speed-b.speed)<.15);
});
const wall={x:0,z:-5,w:10,d:2,h:15};
test('follow camera stops before a wall without climbing above its roof',()=>{
 const p=resolveCamera({x:0,y:2,z:0},{x:0,y:4,z:-12},[wall]);
 assert.ok(p.z>-4&&p.z<-2);assert.ok(p.y<4);
});
test('camera leaves unobstructed and disabled-object paths alone',()=>{
 const target={x:20,y:2,z:0},end={x:20,y:4,z:-12};
 assert.deepEqual(resolveCamera(target,end,[wall]),end);
 assert.deepEqual(resolveCamera({x:0,y:2,z:0},end,[{...wall,enabled:false}]),end);
});
test('camera can pass above a low object, but clips diagonal building corners',()=>{
 const end={x:0,y:8,z:-12};assert.deepEqual(resolveCamera({x:0,y:6,z:0},end,[{...wall,h:2}]),end);
 const p=resolveCamera({x:10,y:2,z:0},{x:0,y:3,z:-10},[wall]);assert.ok(p.z>-5);
});
test('a camera target near a wall still clips instead of ignoring the padded box',()=>{
 const p=resolveCamera({x:0,y:2,z:-3.7},{x:0,y:3,z:-8},[wall]);assert.ok(p.z>-4);
});
