import { trpc } from "@/lib/trpc";

export function useAuth() {
  const { data: user, isLoading: loading } = trpc.auth.me.useQuery(undefined, {
    retry: 1,
    retryDelay: 400,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    // Anonymous activate/submit must not hang forever if auth.me is slow.
    placeholderData: null,
  });

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
