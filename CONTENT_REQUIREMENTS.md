# Baken.ca — Content & Visual Asset Requirements

Modeled on the clarity and proof bar of `osaurus.ai` / `osaurus.ai/ios`, adapted to what Baken actually ships (Android 8.0+, Windows x64, Linux x64, Iroh QR pairing, Letta/MemFS, Rive mascots).

## 1. Real product screenshots & clips (highest leverage)
Replace schematic cards with real captures once the brand PR (`#2621`) lands:
- **Hero / Desktop showcase (16:10, dark + light):** Live desktop window with the Baken top-left mark, full mascot rail, active chat thread with folded tool card + prose reply.
- **Android handheld capture (9:19, dark + light):** Same conversation hydrated on Pixel, showing live tool timeline + inline image/A2UI card.
- **QR Pairing capture (side-by-side):** Desktop/CLI QR invite next to Android scanner locking onto the peer (`connecting -> success`).
- **Voice call screen:** Active hands-free voice overlay on Android/Desktop showing live waveform + mascot listening/speaking state.
- **Rive live canvas embed:** Drop compiled `baken-mark.riv` and `mascot.riv` into `public/rive/` and mount via `@rive-app/canvas` so the website runs the exact same `.riv` binaries as Android and Desktop.

## 2. Pages & copy to add next
- **`/android` & `/desktop` dedicated platform pages:** Mirror the `osaurus.ai/ios` & Windows split with platform-specific requirements, install commands, and screenshots.
- **`/privacy` & `/terms`:** Short, plainspoken pages (no account, no cloud relay, self-hosted Umami analytics disclosure).
- **`/changelog`:** Auto-pulled or curated release notes matching GitHub Releases.
- **Community / Support link:** Decide where beta feedback goes (GitHub Discussions vs. Discord) and wire it into the nav, FAQ, and footer.

## 3. Copy rules (keep consistent across every page)
- Plain English first ("The power of your desktop, in your pocket", "No account", "Replies keep going") — save architecture terms (Iroh QUIC, MemFS, A2UI, MCP) for `/docs` and supporting bullets.
- Never claim unshipped platforms (today: Android 8.0+, Windows x64, Linux x64 AppImage + Linux host wrapper; add macOS/iOS only when builds actually ship).
- Always link downloads to `https://github.com/oculairmedia/letta-mobile/releases/latest` (survives both the `#2621` filename change and the eventual repo rename).
