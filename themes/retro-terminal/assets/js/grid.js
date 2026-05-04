document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("grid-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width, height;
  let mouse = { x: -1000, y: -1000 };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const spacing = 40; // Distance between dots
  const baseRadius = 1;
  const maxRadius = 3;
  const maxDistance = 150; // Ripple effect radius

  function draw() {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255, 176, 0, 0.2)"; // Base amber color, dim

    for (let x = 0; x < width; x += spacing) {
      for (let y = 0; y < height; y += spacing) {
        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let radius = baseRadius;
        let alpha = 0.1;

        if (distance < maxDistance) {
          const factor = 1 - distance / maxDistance;
          radius = baseRadius + (maxRadius - baseRadius) * factor;
          alpha = 0.1 + 0.5 * factor; // Brighter when closer
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 176, 0, ${alpha})`;
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
});
