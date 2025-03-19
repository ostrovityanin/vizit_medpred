import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Admin from "@/pages/admin";
import { useEffect } from "react";

function AdminApp() {
  useEffect(() => {
    // Initialize Telegram Mini App
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Admin />
      <Toaster />
    </QueryClientProvider>
  );
}

export default AdminApp;