# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands
- **Start Dev Server**: `hugo server -D`
- **Build Static Site**: `hugo`
- **Create New Content**: `hugo new content blog/my-post.md`

## Architecture & Code Structure
The site uses a custom Hugo theme named `retro-terminal` that simulates an interactive retro-cyberpunk command-line interface.

### Layout Strategy
- **`themes/retro-terminal/layouts/baseof.html`**: The core shell. It unifies Hugo content and the CLI by rendering page content inside a `#cli-output` div. It handles the sequencing of the initial simulated command typewriter effect before revealing the actual page content.
- **Integrated Terminal**: The site content is NOT separate from the CLI output; it is the *first* block of the output history. Running the `clear` command wipes everything.

### Interactive Logic (`themes/retro-terminal/assets/js/`)
The terminal functionality is modularized for easy extension:
- **`cli.js`**: Contains the primary execution engine.
  - **`vfs` Object**: A configuration map for the virtual file system (mapping `cd`, `ls`, and `cat` to Hugo routes). Update this to add new searchable files or directories.
  - **`commands` Object**: A registry of executable terminal commands. Add new commands here by defining a function that returns a string or `null`.
  - **`startTypewriter`**: Generic HTML-aware typing effect.
  - **`sessionStorage`**: Persists command history across page navigations.
- **`boot.js`**: Handles the one-time-per-session fake BIOS boot sequence.
- **`grid.js`**: Managed the interactive background mouse-ripple dot grid via Canvas.

### Styling (`themes/retro-terminal/assets/css/terminal.css`)
- **Theme**: "Retro Amber" monochrome palette.
- **Effects**: CRT scanlines, phosphor glow (`text-shadow`), screen flicker, and glitch hover animations.
- **Layout**: Locked to `100vh` viewport; the terminal input is pinned to the bottom while the content area scrolls internally with a custom scrollbar.
