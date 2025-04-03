import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Recordings from "@/pages/recordings";
import ClientBotTest from "@/pages/client-bot-test";
import Admin from "@/pages/admin";
import UserRecordings from "@/pages/user-recordings";
import Architecture from "@/pages/architecture";
import ZeppOSDocs from "@/pages/zepp-os-docs";
import ReplitGuide from "./pages/replit-guide";
import TranscriptionDemo from "@/pages/TranscriptionDemo";
import AffirmationDemo from "@/pages/AffirmationDemo";
import { Notification } from "@/components/Notification";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/recordings" component={Recordings} />
      <Route path="/client-bot-test" component={ClientBotTest} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin-panel" component={Admin} />
      <Route path="/user-recordings" component={UserRecordings} />
      <Route path="/architecture" component={Architecture} />
      <Route path="/zepp-os-docs" component={ZeppOSDocs} />
      <Route path="/replit-guide" component={ReplitGuide} />
      <Route path="/transcription-demo" component={TranscriptionDemo} />
      <Route path="/affirmation-demo" component={AffirmationDemo} />
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
