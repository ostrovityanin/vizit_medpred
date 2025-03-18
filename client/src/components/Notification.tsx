import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export function Notification() {
  // The Notification component now simply renders the Toaster
  // We're not using any custom logic as the toast hooks already handle
  // displaying notifications properly
  
  return null; // We're using the Toaster component directly in App.tsx
}
