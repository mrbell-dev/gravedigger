import { useEffect, useState } from "react";

// The Android/Chrome install event (not in the standard lib types).
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "gd-install-dismissed";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this instead of display-mode.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as desktop Safari but has touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const ShareIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: "-3px", margin: "0 2px" }}
  >
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
  </svg>
);

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(
    () => isStandalone() || localStorage.getItem(DISMISS_KEY) === "1",
  );

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own entry point
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const nativeInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setHidden(true);
    setOpen(false);
  };

  return (
    <>
      <button className="install-banner" onClick={() => setOpen(true)}>
        <ShareIcon /> Add to Home Screen — play full-screen &amp; offline
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Install Gravedigger</h2>
            <p>
              Add it to your home screen for a full-screen experience that also works with no signal.
            </p>

            {deferred ? (
              <button className="btn" onClick={nativeInstall}>
                Install now
              </button>
            ) : isIOS() ? (
              <ol className="install-steps">
                <li>
                  Tap the <strong>Share</strong> button
                  <ShareIcon /> in Safari's bottom toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong>, then open Gravedigger from your home screen.
                </li>
              </ol>
            ) : (
              <ol className="install-steps">
                <li>
                  Open your browser menu (<strong>⋯</strong> or <strong>Share</strong>).
                </li>
                <li>
                  Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </li>
                <li>Confirm, then launch it from your home screen.</li>
              </ol>
            )}

            <div className="install-actions">
              <button className="btn ghost" onClick={() => setOpen(false)}>
                Later
              </button>
              <button className="btn ghost" onClick={dismiss}>
                Don't show again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
