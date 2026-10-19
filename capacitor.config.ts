import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.offlineblindchess.app",
  appName: "Offline Blind Chess",
  webDir: "dist/android",
  server: {
    androidScheme: "https"
  }
};

export default config;
