import { trpc } from "@/lib/trpc";
import { HelmetProvider } from "react-helmet-async";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { bootstrapSupabase } from "./lib/supabase";
import { bootstrapOAuthFromHash, hasOAuthReturnInUrl } from "./lib/supabaseOAuth";
import "./index.css";

const BOOT_TIMEOUT_MS = 5000;

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  const path = window.location.pathname;
  // Avoid login ↔ account loops during OAuth handoff.
  if (path === "/login" || path === "/account") return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

function renderApp() {
  const root = document.getElementById("root");
  if (!root) return;
  createRoot(root).render(
    <HelmetProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    </HelmetProvider>,
  );
  // A successful mount proves the current deployment assets are coherent.
  sessionStorage.removeItem("pythh_asset_recovery");
}

async function mountApp() {
  const boot = Promise.all([
    bootstrapSupabase(),
    bootstrapOAuthFromHash(),
  ]);

  // Homepage must never wait on /api/public-config. Only OAuth returns need
  // session before first paint, and even that is capped.
  if (hasOAuthReturnInUrl()) {
    await Promise.race([
      boot,
      new Promise<void>((resolve) => setTimeout(resolve, BOOT_TIMEOUT_MS)),
    ]);
  } else {
    void boot;
  }

  renderApp();
}

void mountApp().catch((err) => {
  console.error("[boot] mount failed", err);
  try {
    renderApp();
  } catch {
    /* already failed */
  }
});
