document.addEventListener("DOMContentLoaded", () => {
  const ROLL_KEY = "glitchRolled";
  const ELIGIBLE_KEY = "glitchEligible";
  const PLAYED_KEY = "glitchPlayed";
  const GLITCH_CHANCE = 0.015;
  const RECOVERY_WATCHDOG_DELAY = 18000;
  const REDUCED_MOTION_WATCHDOG_DELAY = 25000;
  const SUCCESS_HOLD_DELAY = 800;
  const REDUCED_MOTION_SUCCESS_HOLD_DELAY = 700;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getSessionValue(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setSessionValue(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {}
  }

  function shouldPlayGlitch() {
    if (!getSessionValue(ROLL_KEY)) {
      setSessionValue(ROLL_KEY, "true");
      setSessionValue(ELIGIBLE_KEY, Math.random() < GLITCH_CHANCE ? "true" : "false");
    }

    return getSessionValue(ELIGIBLE_KEY) === "true" && getSessionValue(PLAYED_KEY) !== "true";
  }

  function makeLine(text, tone) {
    const line = document.createElement("div");
    line.textContent = text;
    if (tone) line.className = tone;
    return line;
  }

  function flashDenied() {
    document.body.classList.add("glitch-denied");
    setTimeout(() => {
      document.body.classList.remove("glitch-denied");
    }, 220);
  }

  function playGlitch() {
    setSessionValue(PLAYED_KEY, "true");

    const cliInput = document.getElementById("cli-input");
    const wasDisabled = cliInput ? cliInput.disabled : false;
    if (cliInput) {
      cliInput.disabled = true;
      cliInput.blur();
    }

    const overlay = document.createElement("div");
    overlay.id = "glitch-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const frame = document.createElement("div");
    frame.className = "glitch-frame";

    const title = document.createElement("div");
    title.className = "glitch-title";
    title.textContent = "KERNEL PANIC: TIMELINE DESYNC";

    const log = document.createElement("div");
    log.className = "glitch-log";

    const recoveryForm = document.createElement("form");
    recoveryForm.className = "glitch-recovery";
    recoveryForm.autocomplete = "off";

    const recoveryPrompt = document.createElement("span");
    recoveryPrompt.className = "glitch-recovery-prompt";
    recoveryPrompt.textContent = "recovery@timeline0:~$";

    const recoveryInput = document.createElement("input");
    recoveryInput.className = "glitch-recovery-input";
    recoveryInput.type = "text";
    recoveryInput.autocomplete = "off";
    recoveryInput.spellcheck = false;
    recoveryInput.disabled = true;

    const recoveryActions = document.createElement("div");
    recoveryActions.className = "glitch-actions";

    ["scan", "restore", "reboot"].forEach((command) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = command;
      button.disabled = true;
      button.addEventListener("click", () => {
        recoveryInput.value = command;
        recoveryForm.requestSubmit();
      });
      recoveryActions.appendChild(button);
    });

    recoveryForm.appendChild(recoveryPrompt);
    recoveryForm.appendChild(recoveryInput);

    frame.appendChild(title);
    frame.appendChild(log);
    frame.appendChild(recoveryForm);
    frame.appendChild(recoveryActions);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
    document.body.classList.add("glitch-active");

    const lines = [
      ["panic(cpu 0 caller 0x10TH): visitor index overflow", "glitch-error"],
      ["faulting process: noteness_os.shell", ""],
      ["clock source rejected: 2026-05-05T--:--:--+05:30", ""],
      ["leaked timestamp: 2096-11-18T03:14:07Z", "glitch-warning"],
      ["mounted /dev/timeline0 from incompatible future branch", ""],
      ["expected NOTENESS_OS v1.0.0, received v9.7.3-ghost", "glitch-warning"],
      ["register dump: AX=DEAD BX=BEEF CX=10TH DX=F00D", ""],
      ["checksum mismatch in /home/shamil/about.md", "glitch-error"],
      ["automatic rollback refused: causality window locked", "glitch-error"],
      ["manual recovery token required", "glitch-warning"],
      ["awaiting guest intervention", "glitch-ok"]
    ];

    const reducedLines = [
      lines[0],
      lines[3],
      lines[5],
      lines[9],
      lines[10]
    ];

    const activeLines = prefersReducedMotion ? reducedLines : lines;
    const lineDelay = prefersReducedMotion ? 140 : 260;
    let index = 0;
    let recoveryStarted = false;
    let recovered = false;
    let watchdogTimer;

    function scrollLog() {
      log.scrollTop = log.scrollHeight;
    }

    function restoreTerminal() {
      overlay.remove();
      document.body.classList.remove("glitch-active", "glitch-recovering", "glitch-denied");
      document.removeEventListener("keydown", handleRecoveryKeys);
      if (watchdogTimer) clearTimeout(watchdogTimer);

      if (cliInput) {
        cliInput.disabled = wasDisabled;
        cliInput.focus();
      }
    }

    function completeRecovery(message) {
      if (recovered) return;
      recovered = true;
      recoveryInput.disabled = true;
      recoveryActions.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
      });
      if (watchdogTimer) clearTimeout(watchdogTimer);

      log.appendChild(makeLine(message, "glitch-ok"));
      log.appendChild(makeLine("holding recovery shell for visual confirmation", "glitch-warning"));
      log.appendChild(makeLine("system restored", "glitch-ok"));
      scrollLog();

      setTimeout(() => {
        document.body.classList.add("glitch-recovering");
        setTimeout(restoreTerminal, prefersReducedMotion ? 450 : 900);
      }, prefersReducedMotion ? REDUCED_MOTION_SUCCESS_HOLD_DELAY : SUCCESS_HOLD_DELAY);
    }

    function handleRecoveryKeys(event) {
      if (event.key === "Escape") {
        completeRecovery("manual interrupt accepted");
      }
    }

    function runRecoveryCommand(command) {
      const normalized = command.trim().toLowerCase();
      if (!normalized) {
        log.appendChild(makeLine("input required", "glitch-warning"));
        scrollLog();
        return;
      }

      log.appendChild(makeLine(`${recoveryPrompt.textContent} ${normalized}`, ""));

      if (["restore", "fix", "reboot", "seal"].includes(normalized)) {
        completeRecovery("timeline seal restored by guest command");
      } else if (normalized === "scan") {
        log.appendChild(makeLine("sector 10: duplicate visitor signature detected", "glitch-warning"));
        log.appendChild(makeLine("sector 11: impossible future branch isolated", ""));
        log.appendChild(makeLine("suggested command: restore", "glitch-ok"));
      } else if (normalized === "help") {
        log.appendChild(makeLine("accepted commands: scan, restore, fix, reboot, seal", "glitch-ok"));
      } else if (normalized === "whoami") {
        log.appendChild(makeLine("guest session is holding the recovery token", "glitch-warning"));
      } else {
        log.appendChild(makeLine(`bad recovery verb: ${normalized}`, "glitch-error"));
        flashDenied();
      }

      scrollLog();
    }

    function startRecoveryShell() {
      if (recoveryStarted) return;
      recoveryStarted = true;

      log.appendChild(makeLine("manual recovery shell opened", "glitch-warning"));
      log.appendChild(makeLine("type scan, restore, or press ESC", "glitch-ok"));
      recoveryInput.disabled = false;
      recoveryActions.querySelectorAll("button").forEach((button) => {
        button.disabled = false;
      });
      recoveryInput.focus();
      scrollLog();

      document.addEventListener("keydown", handleRecoveryKeys);
      watchdogTimer = setTimeout(() => {
        completeRecovery("watchdog timeout reached; automatic rollback engaged");
      }, prefersReducedMotion ? REDUCED_MOTION_WATCHDOG_DELAY : RECOVERY_WATCHDOG_DELAY);
    }

    recoveryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (recovered || recoveryInput.disabled) return;
      const command = recoveryInput.value;
      recoveryInput.value = "";
      runRecoveryCommand(command);
    });

    function printNextLine() {
      if (index < activeLines.length) {
        const line = activeLines[index];
        log.appendChild(makeLine(line[0], line[1]));
        scrollLog();
        index++;
        setTimeout(printNextLine, lineDelay + Math.random() * 120);
        return;
      }

      setTimeout(startRecoveryShell, prefersReducedMotion ? 350 : 700);
    }

    printNextLine();
  }

  if (!shouldPlayGlitch()) return;

  let scheduled = false;
  document.addEventListener("terminalReady", () => {
    if (scheduled) return;
    scheduled = true;
    const delay = prefersReducedMotion ? 600 : 1200 + Math.random() * 1800;
    setTimeout(playGlitch, delay);
  });
});
