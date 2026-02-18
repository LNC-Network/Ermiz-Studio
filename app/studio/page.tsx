"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  WorkspaceCanvas,
} from "@/components/studio/WorkspaceCanvas";
import { AgentWorkspace } from "@/components/studio/AgentWorkspace";
import { DeployWorkspace } from "@/components/studio/DeployWorkspace";
import {
  HEADER_MENU_TEXT,
  STORAGE_KEYS,
  STATUS_TEXT_BY_TAB,
  WorkspaceTab,
  apiSections,
  databaseSections,
  functionSections,
  infraSections,
  tabLabel,
} from "@/components/studio/config";
import { supabaseClient } from "@/lib/supabase/client";
import { useStore } from "@/store/useStore";

export default function Home() {
  const router = useRouter();
  const setActiveWorkspaceTab = useStore((state) => state.setActiveTab);
  const loadGraphPreset = useStore((state) => state.loadGraphPreset);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("api");
  const [resetLayoutSignal, setResetLayoutSignal] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [commitStatus, setCommitStatus] = useState("Uncommitted changes");
  const [saveState, setSaveState] = useState("Unsaved");
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [user, setUser] = useState<{
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
  } | null>(null);
  const applyUser = (
    nextUser: {
      email?: string | null;
      user_metadata?: Record<string, unknown> | null;
      identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
    } | null,
  ) => {
    setAvatarFailed(false);
    if (!nextUser) {
      setIsProfileOpen(false);
    } else {
      setIsLoginOpen(false);
    }
    setUser(nextUser);
  };
  const creditLimit = 1200;
  const creditUsed = 744;
  const creditUsedPercent = Math.min(
    100,
    Math.round((creditUsed / creditLimit) * 100),
  );

  const statusText = STATUS_TEXT_BY_TAB[activeTab];

  useEffect(() => {
    // Load saved tab from localStorage after mount to avoid hydration mismatch
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem(STORAGE_KEYS.activeTab);
      if (
        savedTab === "api" ||
        savedTab === "infra" ||
        savedTab === "database" ||
        savedTab === "functions" ||
        savedTab === "agent" ||
        savedTab === "deploy"
      ) {
        const frame = window.requestAnimationFrame(() => {
          setActiveTab(savedTab);
        });
        return () => {
          window.cancelAnimationFrame(frame);
        };
      }
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileRef.current &&
        event.target instanceof Node &&
        !profileRef.current.contains(event.target)
      ) {
        setIsProfileOpen(false);
        setIsLoginOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      try {
        const { data, error } = await supabaseClient.auth.getUser();
        if (!isMounted) return;
        if (error) {
          applyUser(null);
          return;
        }
        applyUser(data.user ?? null);
      } catch {
        if (!isMounted) return;
        applyUser(null);
      }
    };

    loadUser();

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.activeTab, activeTab);
    } catch {
      // ignore storage errors
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    const updateViewport = (event?: MediaQueryListEvent) => {
      const isCompact = event ? event.matches : mediaQuery.matches;
      setIsCompactViewport(isCompact);
    };
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);

  useEffect(() => {
    setActiveWorkspaceTab(activeTab);
  }, [activeTab, setActiveWorkspaceTab]);

  const handleSaveChanges = () => {
    setSaveState("Saved");
  };

  const handleCommitChanges = () => {
    setCommitStatus("Committed");
  };

  const handleResetLayout = () => {
    setResetLayoutSignal((prev) => prev + 1);
  };

  const handleLogin = async () => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      "/studio",
    )}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      // keep the modal open so the user can retry
      // optional: surface error in UI later
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut();
    } catch {
      // ignore auth errors
    }
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors
    }
    setIsProfileOpen(false);
    applyUser(null);
    router.push("/");
    router.refresh();
  };

  const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const identityData =
    (user?.identities?.[0]?.identity_data ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name) ||
    (typeof userMetadata.name === "string" && userMetadata.name) ||
    (typeof identityData.full_name === "string" && identityData.full_name) ||
    (typeof identityData.name === "string" && identityData.name) ||
    user?.email ||
    "Profile";
  const displayEmail = user?.email ?? "";
  const avatarUrl =
    (typeof userMetadata.avatar_url === "string" && userMetadata.avatar_url) ||
    (typeof userMetadata.picture === "string" && userMetadata.picture) ||
    (typeof identityData.avatar_url === "string" && identityData.avatar_url) ||
    (typeof identityData.picture === "string" && identityData.picture) ||
    "";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        background: "var(--background)",
        color: "var(--foreground)",
        overflow: "hidden",
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          display: "flex",
          minHeight: 48,
          alignItems: isCompactViewport ? "stretch" : "center",
          justifyContent: "space-between",
          flexWrap: isCompactViewport ? "wrap" : "nowrap",
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--panel) 94%, #0c111a 6%)",
          padding: isCompactViewport ? "8px 10px" : "0 18px",
          flexShrink: 0,
          gap: isCompactViewport ? 8 : 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isCompactViewport ? 8 : 14,
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
          style={{
            fontFamily: "var(--font-poetic)",
            fontWeight: 700,
            fontSize: isCompactViewport ? 20 : 26,
            letterSpacing: "0.025em",
            lineHeight: 1,
            color: "color-mix(in srgb, var(--foreground) 94%, #ffffff 6%)",
            whiteSpace: "nowrap",
          }}
        >
          Ermiz Studio
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginLeft: isCompactViewport ? 0 : 80,
              borderRadius: 12,
              padding: 4,
              overflowX: "auto",
              minWidth: 0,
            }}
          >
            {(Object.keys(tabLabel) as WorkspaceTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  border: "none",
                  borderRadius: 9,
                  padding: "7px 11px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  background:
                    activeTab === tab
                      ? "color-mix(in srgb, var(--panel) 85%, #111826 15%)"
                      : "transparent",
                  color:
                    activeTab === tab ? "var(--foreground)" : "var(--muted)",
                  boxShadow:
                    activeTab === tab
                      ? "inset 0 0 0 1px var(--border)"
                      : "none",
                }}
              >
                {tabLabel[tab]}
              </button>
            ))}
          </div>
        </div>
        <div
          ref={profileRef}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: isCompactViewport ? 6 : 10,
            marginLeft: isCompactViewport ? "auto" : 0,
          }}
        >
          {!isCompactViewport && (
            <button
              type="button"
              onClick={handleSaveChanges}
              style={{
                border: "1px solid var(--border)",
                background: "var(--floating)",
                color: "var(--foreground)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {HEADER_MENU_TEXT.saveChanges}
            </button>
          )}
          {!isCompactViewport && (
            <button
              type="button"
              onClick={handleCommitChanges}
              style={{
                border: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--primary) 20%, var(--panel) 80%)",
                color: "var(--foreground)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {HEADER_MENU_TEXT.commit}
            </button>
          )}
          {!isCompactViewport && (
            <button
              type="button"
              onClick={handleResetLayout}
              title="Reset panel layout (Ctrl/Cmd+0)"
              style={{
                border: "1px solid var(--border)",
                background: "var(--floating)",
                color: "var(--foreground)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {HEADER_MENU_TEXT.resetLayout}
            </button>
          )}
          {user ? (
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              aria-label="Open profile menu"
              style={{
                width: 34,
                height: 34,
                border: "1px solid var(--border)",
                background: "var(--floating)",
                color: "var(--foreground)",
                borderRadius: "50%",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
              }}
            >
              {avatarUrl && !avatarFailed ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={34}
                  height={34}
                  unoptimized
                  onError={() => setAvatarFailed(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {initials}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginOpen((prev) => !prev)}
              style={{
                border: "1px solid var(--border)",
                background: "var(--floating)",
                color: "var(--foreground)",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {HEADER_MENU_TEXT.signIn}
            </button>
          )}

          {isProfileOpen && user && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 260,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "color-mix(in srgb, var(--panel) 95%, #0a1018 5%)",
                boxShadow: "var(--shadow-float)",
                padding: 10,
                zIndex: 20,
              }}
              >
                <div
                  style={{
                    padding: "4px 6px 10px 6px",
                    borderBottom: "1px solid var(--border)",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {displayName}
                  </div>
                  {displayEmail ? (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {displayEmail}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      Not signed in
                    </div>
                  )}
                </div>

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  loadGraphPreset("empty");
                  setSaveState("Unsaved");
                  setCommitStatus("Uncommitted changes");
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                  background: "var(--floating)",
                  color: "var(--foreground)",
                  padding: "8px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                {HEADER_MENU_TEXT.newProject}
              </button>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 8,
                  marginBottom: 8,
                  display: "grid",
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "1px solid var(--border)",
                    background: "var(--floating)",
                    color: "var(--foreground)",
                    padding: "7px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {HEADER_MENU_TEXT.saveChanges}
                </button>
                <button
                  type="button"
                  onClick={handleCommitChanges}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "1px solid var(--border)",
                    background:
                      "color-mix(in srgb, var(--primary) 18%, var(--panel) 82%)",
                    color: "var(--foreground)",
                    padding: "7px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {HEADER_MENU_TEXT.commitChanges}
                </button>
                <button
                  type="button"
                  onClick={handleResetLayout}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "1px solid var(--border)",
                    background: "var(--floating)",
                    color: "var(--foreground)",
                    padding: "7px 8px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {HEADER_MENU_TEXT.resetLayout}
                </button>
              </div>

              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Credit Limit View
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {creditUsed} / {creditLimit} credits used
                </div>
                <div
                  style={{
                    marginTop: 8,
                    width: "100%",
                    height: 6,
                    background: "var(--background)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${creditUsedPercent}%`,
                      height: "100%",
                      background: "var(--primary)",
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                  background: "var(--floating)",
                  color: "var(--foreground)",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                {HEADER_MENU_TEXT.logout}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  window.alert("Upgrade flow can be connected here.");
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                  background: "color-mix(in srgb, var(--primary) 22%, var(--panel) 78%)",
                  color: "var(--foreground)",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {HEADER_MENU_TEXT.buyPro}
              </button>
            </div>
          )}

          {isLoginOpen && !user && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 260,
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "color-mix(in srgb, var(--panel) 95%, #0a1018 5%)",
                boxShadow: "var(--shadow-float)",
                padding: 12,
                zIndex: 20,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                {HEADER_MENU_TEXT.signIn}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  marginBottom: 10,
                }}
              >
                {HEADER_MENU_TEXT.loginHint}
              </div>
              <button
                onClick={handleLogin}
                style={{
                  width: "100%",
                  border: "1px solid var(--border)",
                  background: "var(--foreground)",
                  color: "#0a0a0a",
                  borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {HEADER_MENU_TEXT.signInWithGoogle}
              </button>
            </div>
          )}
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
        {activeTab === "agent" ? (
          <AgentWorkspace />
        ) : activeTab === "deploy" ? (
          <DeployWorkspace />
        ) : (
          <WorkspaceCanvas
            key={`workspace-${activeTab}-${resetLayoutSignal}`}
            sections={
              activeTab === "api"
                ? apiSections
                : activeTab === "infra"
                  ? infraSections
                  : activeTab === "database"
                    ? databaseSections
                    : functionSections
            }
            flatList={activeTab === "api"}
            showSearch={activeTab === "api"}
            isDatabaseWorkspace={activeTab === "database"}
          />
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer
        style={{
          minHeight: isCompactViewport ? 30 : 28,
          flexShrink: 0,
          background: "color-mix(in srgb, var(--panel) 94%, #0c111a 6%)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: isCompactViewport ? "4px 10px" : "0 16px",
          fontSize: 11,
          color: "var(--muted)",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {statusText}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "2px 8px",
              color: "var(--secondary)",
            }}
          >
            Credits Used: {creditUsedPercent}%
          </span>
          {!isCompactViewport && (
            <span
              style={{
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "2px 8px",
                color: "var(--secondary)",
              }}
            >
              Save: {saveState}
            </span>
          )}
          {!isCompactViewport && (
            <span
              style={{
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "2px 8px",
                color: "var(--secondary)",
              }}
            >
              Commit: {commitStatus}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}


