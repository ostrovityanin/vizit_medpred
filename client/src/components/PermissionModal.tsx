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
      <DialogContent className="sm:max-w-xs bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <div className="w-16 h-16 bg-red-600 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-8 w-8 text-red-500" />
          </div>
          <DialogTitle className="text-center text-white">ДОСТУП К МИКРОФОНУ</DialogTitle>
          <DialogDescription className="text-center text-gray-300">
            Приложению нужен доступ к микрофону для записи аудио во время визита.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:justify-center">
          <Button 
            variant="outline" 
            onClick={onCancel}
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            ОТМЕНА
          </Button>
          <Button 
            onClick={onAllow}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            РАЗРЕШИТЬ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
