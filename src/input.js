import { composeControls, deadZone } from "./controls.js";
export function createInput(canvas, onAction, getType = () => "sport") {
  const keys = new Set(),
    holds = new Set(),
    holdPointers = new Map(),
    cameraPointers = new Map();
  let pinchDistance = null;
  let stick = { x: 0, y: 0 },
    stickId = null;
  const pad = document.querySelector("#stick"),
    knob = document.querySelector("#stick-knob");
  const reset = () => {
    keys.clear();
    holds.clear();
    for (const pointers of holdPointers.values()) pointers.clear();
    cameraPointers.clear();
    pinchDistance = null;
    stick = { x: 0, y: 0 };
    stickId = null;
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
    if (e.target.matches("input,select,textarea")) {
      if (e.code === "Escape" && !e.repeat) onAction("pause");
      return;
    }
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
    stick = deadZone(x, y);
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
    holdPointers.set(btn, pointers);
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
    e.preventDefault();
    cameraPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (cameraPointers.size === 2) {
      const [a, b] = [...cameraPointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const previous = cameraPointers.get(e.pointerId);
    if (!previous) return;
    cameraPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cameraPointers.size > 1) {
      const [a, b] = [...cameraPointers.values()],
        distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 10 && distance > 10)
        onAction("zoom", -Math.log(distance / pinchDistance) * 2);
      pinchDistance = distance;
    } else {
      onAction("orbit", (e.clientX - previous.x) * 0.007);
      onAction("look-pitch", (e.clientY - previous.y) * 0.005);
    }
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(event, (e) => {
      cameraPointers.delete(e.pointerId);
      pinchDistance = null;
    });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      onAction("zoom", e.deltaY * 0.002);
    },
    { passive: false },
  );
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  return {
    reset,
    read() {
      return composeControls(stick, keys, holds, getType());
    },
  };
}
