import { clamp, createState, wrapAngle } from './physics.js';
const XS = [-180, -80, 20, 120, 220], ZS = [-350, -250, -150, -50, 50, 150, 250, 350];
const nearest = (values, n) => values.reduce((a,b) => Math.abs(b-n)<Math.abs(a-n)?b:a);
export function roadRoute(from, target) {
  const x = nearest(XS, target.x), z = nearest(ZS, target.z);
  // Join the closest road axis first, then travel through road intersections.
  const fx = nearest(XS, from.x), fz = nearest(ZS, from.z);
  return Math.abs(from.x-fx)<Math.abs(from.z-fz)
    ? [{x:fx,z:from.z},{x:fx,z},{x,z}]
    : [{x:from.x,z:fz},{x,z:fz},{x,z}];
}
export function takeTrafficCar(actor) {
  if (!actor || actor.kind !== 'car' || !actor.enabled || actor.taken) return null;
  const state = Object.assign(createState(actor.type), {
    x:actor.agent.position.x,y:actor.agent.position.y,z:actor.agent.position.z,
    heading:actor.heading,travelHeading:actor.heading,
  });
  actor.taken = true;
  actor.enabled = actor.agent.active = actor.collider.enabled = false;
  actor.agent.velocity.set(0,0,0);
  return state;
}
export function createInteractions() {
  const police = [createState('police'),createState('police')];
  for (const p of police) {p.enabled=false;p.route=[];p.repath=0;}
  return {
    police, level:0, heat:0, unseen:0, arrest:0, cooldown:0, phase:'free',
    report(severity=1) {
      if (this.cooldown>0) return false;
      this.heat = clamp(this.heat+severity,1,3);
      this.level = Math.ceil(this.heat);
      this.unseen=0;this.cooldown=3;this.phase='chase';
      return true;
    },
    step(dt, player) {
      dt=clamp(dt,0,.05);this.cooldown=Math.max(0,this.cooldown-dt);
      if (!this.level) return null;
      let closest=Infinity;
      for (const [i,p] of police.entries()) {
        if (i>=this.level) {p.enabled=false;continue;}
        if (!p.enabled) {
          const nodes=XS.flatMap(x=>ZS.map(z=>({x,z,d:Math.hypot(x-player.x,z-player.z)})))
            .filter(n=>n.d>65).sort((a,b)=>a.d-b.d);
          const n=nodes[Math.min(i*2,nodes.length-1)];
          p.x=n.x;p.z=n.z;p.enabled=true;p.route=[];p.repath=0;
        }
        p.repath-=dt;
        if (!p.route.length || p.repath<=0) {p.route=roadRoute(p,player);p.repath=2;}
        while(p.route.length && Math.hypot(p.route[0].x-p.x,p.route[0].z-p.z)<.5) p.route.shift();
        const q=p.route[0];
        if(q) {
          const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz),step=Math.min(d,(17+this.level*3)*dt);
          p.x+=dx/d*step;p.z+=dz/d*step;p.distance+=step;
          p.heading=wrapAngle(p.heading+wrapAngle(Math.atan2(dx,dz)-p.heading)*Math.min(1,dt*8));
          p.speed=step/dt;
        } else p.speed=0;
        closest=Math.min(closest,Math.hypot(p.x-player.x,p.z-player.z));
      }
      const seen=closest<95 && player.y<8;
      this.unseen=seen?0:this.unseen+dt;
      this.phase=seen?'chase':'search';
      this.arrest=closest<6 && Math.abs(player.speed)<3 && player.y<3 ? this.arrest+dt:0;
      if(this.arrest>=3) {this.clear();return 'caught';}
      if(this.unseen>=18) {this.clear();return 'escaped';}
      return null;
    },
    clear() {this.level=this.heat=this.unseen=this.arrest=0;this.phase='free';for(const p of police)p.enabled=false;},
  };
}
