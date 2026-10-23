"use client";
import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** ลงทะเบียน service worker (เฉพาะ production — โหมดพัฒนาแคชจะบังโค้ดใหม่) */
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ใช้งานได้ตามปกติโดยไม่มี service worker */
    });
  }, []);
}

/**
 * ปุ่มติดตั้งแอป — เบราว์เซอร์ (Chrome/Edge) ส่งสัญญาณ beforeinstallprompt เมื่อติดตั้งได้
 * คืน null ถ้าติดตั้งอยู่แล้ว หรือเบราว์เซอร์ไม่รองรับ (เช่น Safari ใช้ "เพิ่มลงหน้าจอโฮม" เอง)
 */
export function useInstall() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEv(e as InstallEvent);
    };
    const onInstalled = () => setEv(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (!ev) return null;
  return async () => {
    await ev.prompt();
    await ev.userChoice;
    setEv(null);
  };
}
