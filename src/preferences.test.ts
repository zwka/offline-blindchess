import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  subscribeToSystemTheme
} from "./preferences";

const values = new Map<string, string>();

describe("theme preference", () => {
  beforeEach(() => {
    values.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["light", "dark"] as const)("defaults to System and persists %s", (preference) => {
    expect(readThemePreference()).toBe("system");
    expect(saveThemePreference(preference)).toBe(true);
    expect(readThemePreference()).toBe(preference);
  });

  it("uses System when the saved preference is invalid", () => {
    values.set("offline-blind-chess.theme.v1", "sepia");

    expect(readThemePreference()).toBe("system");
  });

  it("continues with System when browser storage is unavailable", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("Storage access denied");
      }
    });

    expect(readThemePreference()).toBe("system");
    expect(saveThemePreference("light")).toBe(false);
  });

  it("resolves System from the current device appearance and honors explicit choices", () => {
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });

  it("reports device appearance changes to a System preference", () => {
    let listener: ((event: { matches: boolean }) => void) | undefined;
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", {
      matchMedia: () => ({
        addEventListener: (_type: string, callback: (event: { matches: boolean }) => void) => {
          listener = callback;
        },
        removeEventListener
      })
    });
    const resolvedThemes: string[] = [];
    const onChange = vi.fn((theme: "light" | "dark") => resolvedThemes.push(resolveTheme("system", theme)));

    const unsubscribe = subscribeToSystemTheme(onChange);
    listener?.({ matches: true });
    listener?.({ matches: false });
    unsubscribe();

    expect(onChange).toHaveBeenNthCalledWith(1, "dark");
    expect(onChange).toHaveBeenNthCalledWith(2, "light");
    expect(resolvedThemes).toEqual(["dark", "light"]);
    expect(removeEventListener).toHaveBeenCalledOnce();
  });
});
