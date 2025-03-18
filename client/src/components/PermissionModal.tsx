import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface PermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onCancel: () => void;
}

export default function PermissionModal({ isOpen, onAllow, onCancel }: PermissionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <div className="w-16 h-16 bg-tgblue bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-8 w-8 text-tgblue" />
          </div>
          <DialogTitle className="text-center">Microphone Access</DialogTitle>
          <DialogDescription className="text-center">
            This app needs access to your microphone to record audio while the timer is running.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:justify-center">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            onClick={onAllow}
            className="flex-1 bg-tgblue hover:bg-tgbluedark"
          >
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
