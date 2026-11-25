// Keyboard, mouse, and touch. snapshot() is once per frame; edges clear after.

export function createInput(canvas) {
  const keys = new Set();
  const edges = {
    pause: false,
    mute: false,
    start: false,
    restart: false,
    dashClick: null,
    slamClick: false,
  };

  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;
  let joyActive = false;
  let joyX = 0;
  let joyY = 0;
  let joyId = null;
  let dashHeld = false;
  let slamHeld = false;

  const joy = document.getElementById("joy");
  const knob = document.getElementById("knob");
  const btnDash = document.getElementById("btn-dash");
  const btnSlam = document.getElementById("btn-slam");

  function press(code) {
    if (code === "Escape" || code === "KeyP") edges.pause = true;
    if (code === "KeyM") edges.mute = true;
    if (code === "Enter" || code === "KeyR") edges.restart = true;
    if (code === "Enter" || code === "Space") edges.start = true;
  }

  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (
      e.code === "Space" ||
      e.code.startsWith("Arrow") ||
      e.code === "KeyW" ||
      e.code === "KeyA" ||
      e.code === "KeyS" ||
      e.code === "KeyD"
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    press(e.code);
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    pointerDown = false;
    dashHeld = false;
    slamHeld = false;
    joyActive = false;
    joyX = 0;
    joyY = 0;
    placeKnob(0, 0);
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 2) {
      edges.slamClick = true;
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    pointerDown = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
    edges.dashClick = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  });

  function endPointer(e) {
    if (canvas.hasPointerCapture?.(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    pointerDown = false;
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  function placeKnob(x, y) {
    if (!knob) return;
    const max = 36;
    knob.style.transform = `translate(calc(-50% + ${x * max}px), calc(-50% + ${y * max}px))`;
  }

  function moveJoy(e) {
    const rect = joy.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const mag = Math.hypot(dx, dy) || 1;
    const clamped = mag > 1 ? 1 / mag : 1;
    joyX = dx * clamped;
    joyY = -dy * clamped;
    joyActive = true;
    placeKnob(joyX, -joyY);
  }

  function hookHold(button, set) {
    if (!button) return;
    button.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      set(true);
      button.setPointerCapture?.(e.pointerId);
    });
    const release = (e) => {
      set(false);
      if (button.hasPointerCapture?.(e.pointerId)) button.releasePointerCapture(e.pointerId);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  hookHold(btnDash, (v) => {
    dashHeld = v;
  });
  hookHold(btnSlam, (v) => {
    slamHeld = v;
  });

  if (joy) {
    joy.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      joyId = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      moveJoy(e);
    });
    joy.addEventListener("pointermove", (e) => {
      if (e.pointerId !== joyId) return;
      moveJoy(e);
    });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      joyActive = false;
      joyX = 0;
      joyY = 0;
      placeKnob(0, 0);
    };
    joy.addEventListener("pointerup", endJoy);
    joy.addEventListener("pointercancel", endJoy);
  }

  window.addEventListener("touchstart", () => {
    document.body.classList.add("touch");
  }, { passive: true });

  const coarse = window.matchMedia("(pointer: coarse), (max-width: 820px)");
  const sync = () => document.body.classList.toggle("touch", coarse.matches || document.body.classList.contains("touch"));
  coarse.addEventListener?.("change", sync);
  sync();

  function down(...codes) {
    return codes.some((c) => keys.has(c));
  }

  return {
    snapshot() {
      const snap = {
        up: down("KeyW", "ArrowUp"),
        down: down("KeyS", "ArrowDown"),
        left: down("KeyA", "ArrowLeft"),
        right: down("KeyD", "ArrowRight"),
        joyActive,
        joyX,
        joyY,
        pointerDown,
        pointerX,
        pointerY,
        dashHeld: dashHeld || down("Space", "KeyK"),
        slamHeld: slamHeld || down("KeyF", "KeyJ", "ShiftLeft", "ShiftRight"),
        dashClick: edges.dashClick,
        slamClick: edges.slamClick,
        pause: edges.pause,
        mute: edges.mute,
        start: edges.start,
        restart: edges.restart,
        worldX: 0,
        worldZ: 0,
        worldAim: false,
      };
      edges.pause = false;
      edges.mute = false;
      edges.start = false;
      edges.restart = false;
      edges.dashClick = null;
      edges.slamClick = false;
      return snap;
    },
  };
}
