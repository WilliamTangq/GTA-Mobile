import { clamp } from "./physics.js";
export function deadZone(x, y, threshold = 0.1) {
  const length = Math.hypot(x, y);
  if (length <= threshold) return { x: 0, y: 0 };
  const magnitude = clamp((length - threshold) / (1 - threshold), 0, 1);
  return { x: (x / length) * magnitude, y: (y / length) * magnitude };
}
export function composeControls(stick, keys, holds, type) {
  const foot = type === "foot",
    right = keys.has("KeyD") || keys.has("ArrowRight"),
    left = keys.has("KeyA") || keys.has("ArrowLeft");
  const forward = keys.has("KeyW") || keys.has("ArrowUp") || holds.has("gas"),
    back = keys.has("KeyS") || keys.has("ArrowDown") || holds.has("brake");
  const moveX = clamp(stick.x + (right ? 1 : 0) - (left ? 1 : 0), -1, 1),
    moveZ = clamp(-stick.y + (forward ? 1 : 0) - (back ? 1 : 0), -1, 1);
  return {
    steer: moveX,
    throttle: foot ? moveZ : back ? -1 : forward ? 1 : 0,
    moveX,
    moveZ,
    climb:
      (holds.has("rise") || keys.has("KeyQ") ? 1 : 0) -
      (holds.has("sink") || keys.has("KeyZ") ? 1 : 0),
    boost:
      holds.has("boost") || keys.has("ShiftLeft") || keys.has("ShiftRight"),
    brake: !foot && (keys.has("Space") || holds.has("handbrake")),
    jump: foot && (keys.has("Space") || holds.has("jump")),
  };
}
