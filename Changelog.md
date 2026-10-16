## v1.0.0

<details>
<summary><strong> 🐞 Fixes </strong></summary>

- Fix the proxy group navigator overlapping proxy group cards
- Fix long setting descriptions being cut off
- Fix the User-Agent entered for a new subscription not being saved

**🍎 macOS**

- Fix macOS reporting downloaded builds as damaged

</details>

<details>
<summary><strong> ✨ New Features </strong></summary>

- Add a redesigned interface built with shadcn/ui; the previous interface is kept as a fallback
- Add the "Send HWID" setting for subscription providers that limit devices, with an optional custom HWID
- Add a tray quick panel to switch the proxy mode and server without opening the main window, with a power button that turns the system proxy and TUN off and back on
- Add the Happ compatibility mode for subscriptions that send the full server list only to Happ, converting Xray configs to Mihomo
- Show subscription announcements, support links and titles sent by Remnawave panels
- Keep the last working servers and show a notice when a subscription reports that the device limit is reached

</details>

<details>
<summary><strong> 🚀 Improvements </strong></summary>

- Publish a "Moclash Nightly" build for every commit to `dev`
- Rebrand the app as Moclash with a new icon set and its own data directory
- Collapse the sidebar automatically on narrow windows

**🍎 macOS**

- Show Moclash under its own name in macOS Login Items

</details>
