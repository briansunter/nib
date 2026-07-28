<!-- generated-markdown-alternate -->
---
title: "emacs-daemon-mode-on-macos"
description: "How to have Emacs launch quickly and always be available on macOS."
url: "https://briansunter.com/emacs-daemon-mode-on-macos"
---

JUN 24, 2019 · 2 MIN READ

# emacs-daemon-mode-on-macos

How to have Emacs launch quickly and always be available on macOS.

![Cover image for emacs-daemon-mode-on-macos](/_astro/image_1661148998101_0.BCkbom08_4iag0.webp)

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

xml

```
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

bash

```
launchctl load -w ~/Library/LaunchAgents/gnu.emacs.daemon.plist
```

### Unload the daemon

Stop the daemon and prevent it from starting on next login:

bash

```
launchctl unload -w ~/Library/LaunchAgents/gnu.emacs.daemon.plist
```

***

Now launch Emacs instantly with `emacsclient` or `emacsclient -c`. The daemon restarts automatically if killed.

## Subscribe to newsletter

I send occasional emails about new blog posts, side projects, and things I'm learning.

By subscribing, you agree to our [Privacy Policy](/privacy).

[Older Why Clojure? ](/why-clojure)[Newer How to Take Smart Notes](/how-to-take-smart-notes)

## Related

- [Binary Search Algorithm Jan 4, 2023](/binary-search)
- [Heap, Heap Sort, Heapify, and Priority Queues Jan 4, 2023](/heap)
- [Recurrence Relation and Master's Theorem for Dividing Functions Jan 4, 2023](/recurrence-relation-masters-theorem-dividing)

## Share this article
