import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Recordings from "@/pages/recordings";
import TestTelegram from "@/pages/test-telegram";
import FileExplorer from "@/pages/file-explorer";
import AudioBrowser from "@/pages/audio-browser";
import { Notification } from "@/components/Notification";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/recordings" component={Recordings} />
      <Route path="/test-telegram" component={TestTelegram} />
      <Route path="/files" component={FileExplorer} />
      <Route path="/audio" component={AudioBrowser} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
      <Router />
      <Toaster />
      <Notification />
    </QueryClientProvider>
  );
}

export default App;
