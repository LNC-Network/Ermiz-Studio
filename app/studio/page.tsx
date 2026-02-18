"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioHeader, StudioUser } from "@/components/studio/StudioHeader";
import { StudioLayout } from "@/components/studio/StudioLayout";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import {
  STORAGE_KEYS,
  STATUS_TEXT_BY_TAB,
  WorkspaceTab,
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
  const [user, setUser] = useState<StudioUser | null>(null);
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

  return (
    <StudioLayout
      isCompactViewport={isCompactViewport}
      statusText={statusText}
      creditUsedPercent={creditUsedPercent}
      saveState={saveState}
      commitStatus={commitStatus}
    >
      {/* Top Bar */}
      <StudioHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCompactViewport={isCompactViewport}
        profileRef={profileRef}
        user={user}
        isProfileOpen={isProfileOpen}
        setIsProfileOpen={setIsProfileOpen}
        isLoginOpen={isLoginOpen}
        setIsLoginOpen={setIsLoginOpen}
        avatarFailed={avatarFailed}
        setAvatarFailed={setAvatarFailed}
        creditUsed={creditUsed}
        creditLimit={creditLimit}
        creditUsedPercent={creditUsedPercent}
        handleSaveChanges={handleSaveChanges}
        handleCommitChanges={handleCommitChanges}
        handleResetLayout={handleResetLayout}
        handleLogout={handleLogout}
        handleLogin={handleLogin}
        handleNewProject={() => {
          setIsProfileOpen(false);
          loadGraphPreset("empty");
          setSaveState("Unsaved");
          setCommitStatus("Uncommitted changes");
        }}
        handleBuyPro={() => {
          setIsProfileOpen(false);
          window.alert("Upgrade flow can be connected here.");
        }}
      />

      <StudioWorkspace activeTab={activeTab} resetLayoutSignal={resetLayoutSignal} />
    </StudioLayout>
  );
}


