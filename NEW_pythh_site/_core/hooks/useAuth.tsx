import { trpc } from "@/lib/trpc";

export function useAuth() {
  const { data: user, isPending } = trpc.auth.me.useQuery(undefined, {
    retry: 2,
    retryDelay: 400,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Keep the user visible during background refetch (OAuth sync invalidates auth.me).
  const loading = isPending && user === undefined;

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  return {
    user: user ?? null,
    loading,
    isAuthenticated: !!user,
    logout: () => logout.mutate(),
  };
}
