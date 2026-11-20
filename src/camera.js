// Clip the follow-camera arm against world boxes instead of jumping above roofs.
export function resolveCamera(target, desired, colliders, padding = 0.65) {
  const delta = {x:desired.x-target.x,y:desired.y-target.y,z:desired.z-target.z};
  const distance=Math.hypot(delta.x,delta.y,delta.z);
  if(distance<.001) return {...desired};
  let fraction=1;
  for(const b of colliders) {
    if(b.enabled===false) continue;
    const clearance=Math.max(0,target.y-b.h,Math.abs(target.x-b.x)-b.w/2,Math.abs(target.z-b.z)-b.d/2);
    const margin=Math.min(padding,clearance*.5);
    const min={x:b.x-b.w/2-margin,y:-margin,z:b.z-b.d/2-margin};
    const max={x:b.x+b.w/2+margin,y:b.h+margin,z:b.z+b.d/2+margin};
    let enter=0,leave=1,hit=true;
    for(const axis of ['x','y','z']) {
      if(Math.abs(delta[axis])<1e-8) {
        if(target[axis]<min[axis]||target[axis]>max[axis]) {hit=false;break;}
      } else {
        let a=(min[axis]-target[axis])/delta[axis],c=(max[axis]-target[axis])/delta[axis];
        if(a>c) [a,c]=[c,a];enter=Math.max(enter,a);leave=Math.min(leave,c);
        if(enter>leave){hit=false;break;}
      }
    }
    // A target already inside a padded box needs an exit, not a zero-length arm.
    if(hit && enter>0 && enter<1) fraction=Math.min(fraction,Math.max(0,enter-.15/distance));
  }
  return {x:target.x+delta.x*fraction,y:Math.max(.6,target.y+delta.y*fraction),z:target.z+delta.z*fraction};
}
