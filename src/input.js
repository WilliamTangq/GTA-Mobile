import { clamp } from "./physics.js";
export function createInput(canvas, onAction) {
  const keys = new Set(),
    holds = new Set();
  let stick = { x: 0, y: 0 },
    stickId = null,
    drag = null;
  const pad = document.querySelector("#stick"),
    knob = document.querySelector("#stick-knob");
  const reset = () => {
    keys.clear();
    holds.clear();
    stick = { x: 0, y: 0 };
    stickId = null;
    drag = null;
    knob.style.transform = "translate(0px,0px)";
    document
      .querySelectorAll(".held")
      .forEach((e) => e.classList.remove("held"));
  };
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) reset();
  });
  const shortcuts = {
    KeyE: "enter",
    KeyV: "garage",
    KeyM: "map",
    KeyC: "camera",
    KeyR: "reset",
    Escape: "pause",
    KeyP: "pause",
  };
  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input,select,textarea")) return;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      )
    )
      e.preventDefault();
    keys.add(e.code);
    if (!e.repeat && shortcuts[e.code]) onAction(shortcuts[e.code]);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  function moveStick(e) {
    if (e.pointerId !== stickId) return;
    const r = pad.getBoundingClientRect(),
      radius = r.width * 0.32;
    let x = (e.clientX - r.left - r.width / 2) / radius,
      y = (e.clientY - r.top - r.height / 2) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    stick = { x, y };
    knob.style.transform = `translate(${x * radius}px,${y * radius}px)`;
  }
  pad.addEventListener("pointerdown", (e) => {
    if (stickId !== null) return;
    e.preventDefault();
    stickId = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  pad.addEventListener("pointermove", moveStick);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    pad.addEventListener(event, (e) => {
      if (stickId === e.pointerId) {
        stickId = null;
        stick = { x: 0, y: 0 };
        knob.style.transform = "translate(0px,0px)";
      }
    });
  for (const btn of document.querySelectorAll("[data-hold]")) {
    const pointers = new Set();
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pointers.add(e.pointerId);
      holds.add(btn.dataset.hold);
      btn.classList.add("held");
      btn.setPointerCapture(e.pointerId);
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      btn.addEventListener(event, (e) => {
        pointers.delete(e.pointerId);
        if (!pointers.size) {
          holds.delete(btn.dataset.hold);
          btn.classList.remove("held");
        }
      });
  }
  canvas.addEventListener("pointerdown", (e) => {
    drag = { id: e.pointerId, x: e.clientX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag?.id === e.pointerId) {
      onAction("orbit", (e.clientX - drag.x) * 0.007);
      drag.x = e.clientX;
    }
  });
  canvas.addEventListener("pointerup", () => (drag = null));
  canvas.addEventListener("pointercancel", () => (drag = null));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      onAction("zoom", e.deltaY * 0.02);
    },
    { passive: false },
  );
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  return {
    reset,
    read() {
      return {
        steer: clamp(
          stick.x +
            (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
          -1,
          1,
        ),
        throttle: clamp(
          -stick.y +
            (holds.has("gas") || keys.has("KeyW") || keys.has("ArrowUp")
              ? 1
              : 0) -
            (holds.has("brake") || keys.has("KeyS") || keys.has("ArrowDown")
              ? 1
              : 0),
          -1,
          1,
        ),
        climb:
          (holds.has("rise") || keys.has("KeyQ") ? 1 : 0) -
          (holds.has("sink") || keys.has("KeyZ") ? 1 : 0),
        boost:
          holds.has("boost") || keys.has("ShiftLeft") || keys.has("ShiftRight"),
        brake: keys.has("Space"),
      };
    },
  };
}
