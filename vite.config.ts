import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Better Auth publishes several package re-exports. Keeping these packages
  // external in SSR prevents Rolldown/Nitro from turning those re-exports into
  // `void 0` in the production bundle. They are installed in the runtime image.
  ssr: {
    external: ["better-auth", "@better-auth/drizzle-adapter"],
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({ server: { entry: "server" } }),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
