---
name: omarchy
description: >
  REQUIRED for end-user customization of Linux desktop, window manager, or system config.
  Use when editing ~/.config/hypr/, ~/.config/waybar/, ~/.config/walker/,
  ~/.config/alacritty/, ~/.config/foot/, ~/.config/kitty/, ~/.config/ghostty/, ~/.config/mako/,
  or ~/.config/omarchy/. Triggers: Hyprland, window rules, animations, keybindings,
  monitors, gaps, borders, blur, opacity, waybar, walker, terminal config, themes,
  wallpaper, night light, idle, lock screen, screenshots, reminders, layer rules,
  workspace settings, display config, and user-facing omarchy commands. Excludes Omarchy
  source development in ~/.local/share/omarchy/ and `omarchy dev` workflows.
---

# Omarchy Skill

Manage [Omarchy](https://omarchy.org/) Linux systems - a beautiful, modern, opinionated Arch Linux distribution with Hyprland.

This skill is for end-user customization on installed systems.
It is not for contributing to Omarchy source code.

## When This Skill MUST Be Used

**ALWAYS invoke this skill for end-user requests involving ANY of these:**

- Editing ANY file in `~/.config/hypr/` (window rules, animations, keybindings, monitors, etc.)
- Editing ANY file in `~/.config/waybar/`, `~/.config/walker/`, `~/.config/mako/`
- Editing terminal configs (alacritty, foot, kitty, ghostty)
- Editing ANY file in `~/.config/omarchy/`
- Window behavior, animations, opacity, blur, gaps, borders
- Layer rules, workspace settings, display/monitor configuration
- Themes, wallpapers, fonts, appearance changes
- User-facing `omarchy` commands (`omarchy theme ...`, `omarchy refresh ...`, `omarchy restart ...`, etc.)
- Screenshots, screen recording, reminders, night light, idle behavior, lock screen

**If you're about to edit a config file in ~/.config/ on this system, STOP and use this skill first.**

**Do NOT use this skill for Omarchy development tasks** (editing files in `~/.local/share/omarchy/`, creating migrations, or running `omarchy dev ...` workflows).

## Critical Safety Rules

**For end-user customization tasks, NEVER modify anything in `~/.local/share/omarchy/`** - but READING is safe and encouraged.

That directory contains Omarchy's git-managed source (`bin/`, `config/`, `themes/`, `default/`, `migrations/`, `install/`). Any changes will be lost on next `omarchy update`, cause conflicts with upstream, and break the update mechanism.

**Reading `~/.local/share/omarchy/` is SAFE and useful** - do it freely to understand commands (`cat $(which omarchy-theme-set)`), see default configs before customizing (`cat ~/.local/share/omarchy/config/waybar/config.jsonc`), check stock themes, or reference defaults (`cat ~/.local/share/omarchy/default/hypr/*`).

**Always use these safe locations instead:**
- `~/.config/` - User configuration (safe to edit)
- `~/.config/omarchy/themes/<custom-name>/` - Custom themes (must be real directories)
- `~/.config/omarchy/hooks/` - Custom automation hooks

If the request is to develop Omarchy itself, this skill is out of scope. Follow repository development instructions instead of this skill.

## System Architecture

| Component | Purpose | Config Location |
|-----------|---------|-----------------|
| **Arch Linux** | Base OS | `/etc/`, `~/.config/` |
| **Hyprland** | Wayland compositor/WM | `~/.config/hypr/` |
| **Waybar** | Status bar | `~/.config/waybar/` |
| **Walker** | App launcher | `~/.config/walker/` |
| **Alacritty/Foot/Kitty/Ghostty** | Terminals | `~/.config/<terminal>/` |
| **Mako** | Notifications | `~/.config/mako/` |
| **SwayOSD** | On-screen display | `~/.config/swayosd/` |

## Reference Files (MANDATORY reads by topic)

Before acting, Read the reference file(s) matching the task. They contain the exact commands, file layouts, formats, and gotchas — do not work from memory.

| Task involves | Read |
|---|---|
| Hyprland: keybindings, monitors, window rules, gaps/borders/animations, idle, lock, night light, `~/.config/hypr/*` | `references/hyprland.md` |
| Waybar, walker, mako, terminals (alacritty/foot/kitty/ghostty), btop/fastfetch/lazygit/starship/git configs | `references/apps.md` |
| Themes, wallpapers, fonts, custom themes, hooks (`theme-set`, `font-set`, `post-update`) | `references/themes-hooks.md` |
| Discovering omarchy commands, command groups, system commands (update/debug/lock), reminders, troubleshooting, reset/refresh to defaults | `references/commands.md` |

## Core Workflow (Edit User Config Directly)

For simple changes, edit files in `~/.config/`:

1. Read current config (e.g. `cat ~/.config/hypr/bindings.conf`)
2. Backup: `cp <file> <file>.bak.$(date +%s)`
3. Make changes with Edit tool
4. Apply changes:
   - Hyprland: auto-reloads on save, but MUST validate with `hyprctl reload` and `hyprctl configerrors`
   - Waybar: MUST restart with `omarchy restart waybar`
   - Walker: MUST restart with `omarchy restart walker`
   - Terminals: MUST restart with `omarchy restart terminal`

## Decision Framework

When user requests system changes:

1. **Is it a stock omarchy command?** Use it directly (see `references/commands.md`)
2. **Is it a config edit?** Edit in `~/.config/`, never `~/.local/share/omarchy/`
3. **Is it a theme customization?** Create a NEW custom theme directory (see `references/themes-hooks.md`)
4. **Is it automation?** Use hooks in `~/.config/omarchy/hooks/` (see `references/themes-hooks.md`)
5. **Is it a package install?** Use `omarchy pkg add <pkgs...>` (or `omarchy pkg aur add <pkgs...>` for AUR-only packages)
6. **Unsure if command exists?** Run `omarchy commands` (or `omarchy <group> --help` for one group)

Resetting configs to defaults (`omarchy refresh ...`): ALWAYS seek user confirmation before running.

## Out of Scope

This skill intentionally does not cover Omarchy source development. Do not use this skill for:
- Editing files in `~/.local/share/omarchy/` (`bin/`, `config/`, `default/`, `themes/`, `migrations/`, etc.)
- Creating or editing migrations
- Running `omarchy dev ...` commands

## Example Requests

- "Change my theme to catppuccin" -> `omarchy theme set catppuccin`
- "Add a keybinding for Super+E" -> Read `references/hyprland.md`; check existing bindings, `unbind` if needed, then `bind` in `~/.config/hypr/bindings.conf`
- "Configure my external monitor" -> Read `references/hyprland.md`; edit `~/.config/hypr/monitors.conf`
- "Make the window gaps smaller" -> Edit `~/.config/hypr/looknfeel.conf`
- "Set up night light" -> `omarchy toggle nightlight` or edit `~/.config/hypr/hyprsunset.conf`
- "Set a reminder to pickup jack in 15 minutes" -> `omarchy reminder 15 "Pickup Jack"`
- "Customize the catppuccin theme colors" -> Read `references/themes-hooks.md`; copy stock to `~/.config/omarchy/themes/catppuccin-custom/`, edit
- "Run a script every time I change themes" -> Create `~/.config/omarchy/hooks/theme-set`
- "Reset waybar to defaults" -> `omarchy refresh waybar` (confirm with user first)
