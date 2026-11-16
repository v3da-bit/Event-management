"use client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { Toaster } from "sonner";
import { api, type User } from "@/lib/api";
const AuthContext = createContext<{ user?: User; loading: boolean }>({
  loading: true,
});
function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    retry: false,
  });
  return (
    <AuthContext.Provider value={{ user: data, loading: isPending }}>
      {children}
    </AuthContext.Provider>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15000, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
export const useAuth = () => useContext(AuthContext);
