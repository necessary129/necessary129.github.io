document.addEventListener("DOMContentLoaded", () => {
  const biosBoot = document.getElementById("bios-boot");
  const biosContent = document.getElementById("bios-content");

  // Only run boot sequence once per session
  if (sessionStorage.getItem("booted")) {
    biosBoot.style.display = "none";
    return;
  }

  const bootLogs = [
    "NOTENESS_OS v1.0.0 (c) 2026 Shamil KM",
    "Initializing hardware...",
    "CPU: Cyber-Processor 9000 @ 4.2THz",
    "RAM: 64TB Quantum Memory OK",
    "Loading kernel modules................ DONE",
    "Mounting file systems... /dev/sda1 mounted",
    "Checking network interfaces... eth0 UP",
    "Establishing secure connection to mainframe...",
    "Connection established. Handshake verified.",
    "Bypassing security protocols...",
    "Access Granted.",
    "Starting terminal interface..."
  ];

  let currentLine = 0;

  function printLog() {
    if (currentLine < bootLogs.length) {
      biosContent.innerHTML += bootLogs[currentLine] + "<br>";
      currentLine++;
      setTimeout(printLog, Math.random() * 150 + 50); // Random delay between 50-200ms
    } else {
      setTimeout(() => {
        biosBoot.style.display = "none";
        sessionStorage.setItem("booted", "true");
        // Dispatch event to start the typewriter effect on the homepage
        document.dispatchEvent(new Event("bootComplete"));
      }, 500);
    }
  }

  printLog();
});
