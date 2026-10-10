"use client";
// The admin passcode lives in sessionStorage (cleared when the tab closes). Read through
// useSyncExternalStore so the server render ("" = no passcode) and hydration agree.
import { useSyncExternalStore } from "react";

const KEY = "kaagaz.adminPasscode";
const EVENT = "kaagaz-admin-passcode";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // storage blocked: the user simply types it again
  }
}

export function setStoredPasscode(value: string): void {
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
  } catch {
    // ignore: storage blocked
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useStoredPasscode(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
