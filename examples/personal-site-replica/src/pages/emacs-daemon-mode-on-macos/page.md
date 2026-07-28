---
title: "emacs-daemon-mode-on-macos"
description: "How to have Emacs launch quickly and always be available on macOS."
date: 2019-06-25T00:00:00.000Z
cover: "/site-assets/image_1661148998101_0.png"
wordCount: 262
tags:
  - "programming"
  - "emacs"
layout: article
---
A common complaint about Emacs is that it takes longer to launch than Vim. With [Spacemacs](https://www.spacemacs.org/) and many plugins, it takes 10-20 seconds to launch. With daemon mode, it launches in less than a second.

## How it works

Instead of launching a full Emacs instance every time, run Emacs as a daemon in headless mode when your computer starts. Then connect to it using the `emacsclient` command.

**Commands:**

- `emacsclient` - terminal client, launches as fast as Vim
- `emacsclient -c` - opens a separate GUI instance

## Setting up the daemon

Use macOS [Launch Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/Introduction.html) to start an Emacs daemon on login and restart it if it dies.

### Create the plist file

Create `~/Library/LaunchAgents/gnu.emacs.daemon.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
"http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>gnu.emacs.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/emacs</string>
    <string>--daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>ServiceDescription</key>
  <string>Gnu Emacs Daemon</string>
</dict>
</plist>
```

### Load the daemon

Start the daemon and ensure it starts on every login:

```bash
launchctl load -w ~/Library/LaunchAgents/gnu.emacs.daemon.plist
```

### Unload the daemon

Stop the daemon and prevent it from starting on next login:

```bash
launchctl unload -w ~/Library/LaunchAgents/gnu.emacs.daemon.plist
```

---

Now launch Emacs instantly with `emacsclient` or `emacsclient -c`. The daemon restarts automatically if killed.
