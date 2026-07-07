# Themes, Fonts, and Hooks

## Theme Commands

```bash
omarchy theme list              # Show available themes
omarchy theme current           # Show current theme
omarchy theme set <name>        # Apply theme (use "Tokyo Night" not "tokyo-night")
omarchy theme bg next           # Cycle wallpaper
omarchy theme install <url>     # Install from git repo
```

## Make a New Theme

1. Create a directory under `~/.config/omarchy/themes` (must be a real directory).
2. See how an existing theme is done via `~/.local/share/omarchy/themes/catppuccin`.
3. Download a matching background (or several) from the internet and put them in `~/.config/omarchy/themes/[name-of-new-theme]`
4. When done with the theme, run `omarchy theme set "Name of new theme"`

To customize a stock theme (e.g. catppuccin): create `~/.config/omarchy/themes/catppuccin-custom/` by copying from stock, then edit.

## Fonts

```bash
omarchy font list               # Available fonts
omarchy font current            # Current font
omarchy font set <name>         # Change font
```

## Hooks for Automation

Create scripts in `~/.config/omarchy/hooks/` to run automatically on events:

```bash
# Available hooks (see samples in ~/.config/omarchy/hooks/):
~/.config/omarchy/hooks/
├── theme-set        # Runs after theme change (receives theme name as $1)
├── font-set         # Runs after font change
└── post-update      # Runs after `omarchy update`
```

Example hook (`~/.config/omarchy/hooks/theme-set`):
```bash
#!/bin/bash
THEME_NAME=$1
echo "Theme changed to: $THEME_NAME"
# Add custom actions here
```
