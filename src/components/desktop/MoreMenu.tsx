/**
 * MoreMenu
 * 
 * Dropdown menu for additional options including account info.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  LogOut, 
  Settings, 
  HelpCircle, 
  User, 
  Video, 
  Bell, 
  Sparkles, 
  Rocket, 
  Info, 
  Power 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsModal } from "./SettingsModal";
import { QuitConfirmDialog } from "./QuitConfirmDialog";

interface MoreMenuProps {
  trigger: React.ReactNode;
  username: string;
  onSignOut: () => void;
  forceUploadError: boolean;
  onForceUploadErrorChange: (value: boolean) => void;
}

export function MoreMenu({
  trigger,
  username,
  onSignOut,
  forceUploadError,
  onForceUploadErrorChange,
}: MoreMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="center" 
          side="top"
          sideOffset={8}
          className="w-56 bg-background/95 backdrop-blur-xl border-white/10"
        >
          {/* Account section */}
          <DropdownMenuLabel className="font-normal">
            <div className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 rounded-full bg-vantage-green/20 flex items-center justify-center">
                <User className="w-4 h-4 text-vantage-green" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Connected as
                </p>
                <p className="text-sm font-medium text-foreground truncate">
                  {username}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* Meetings - disabled */}
          <DropdownMenuItem 
            disabled
            className="text-xs cursor-not-allowed opacity-50"
          >
            <Video className="w-4 h-4 mr-2 text-muted-foreground" />
            Meetings
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">
              Soon
            </span>
          </DropdownMenuItem>
          
          {/* Settings */}
          <DropdownMenuItem 
            onClick={() => setSettingsOpen(true)}
            className="text-xs cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
            Settings
          </DropdownMenuItem>
          
          {/* Notifications */}
          <DropdownMenuItem 
            onClick={() => console.log("Notifications - stub")}
            className="text-xs cursor-pointer"
          >
            <Bell className="w-4 h-4 mr-2 text-muted-foreground" />
            Notifications
          </DropdownMenuItem>
          
          {/* Updates */}
          <DropdownMenuItem 
            onClick={() => console.log("Updates - stub")}
            className="text-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 mr-2 text-muted-foreground" />
            Updates
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* Quick start */}
          <DropdownMenuItem 
            onClick={() => console.log("Quick start - stub")}
            className="text-xs cursor-pointer"
          >
            <Rocket className="w-4 h-4 mr-2 text-muted-foreground" />
            Quick start
          </DropdownMenuItem>
          
          {/* About */}
          <DropdownMenuItem 
            onClick={() => console.log("About - stub")}
            className="text-xs cursor-pointer"
          >
            <Info className="w-4 h-4 mr-2 text-muted-foreground" />
            About
          </DropdownMenuItem>
          
          {/* Help */}
          <DropdownMenuItem 
            onClick={() => console.log("Help - stub")}
            className="text-xs cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
            Help
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* Quit */}
          <DropdownMenuItem 
            onClick={() => setQuitOpen(true)}
            className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Power className="w-4 h-4 mr-2" />
            Quit
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* Sign out */}
          <DropdownMenuItem 
            onClick={onSignOut}
            className="text-xs cursor-pointer text-muted-foreground focus:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        forceUploadError={forceUploadError}
        onForceUploadErrorChange={onForceUploadErrorChange}
      />

      {/* Quit Confirmation Dialog */}
      <QuitConfirmDialog
        open={quitOpen}
        onOpenChange={setQuitOpen}
        onConfirm={() => {
          console.log("Quit confirmed - stub");
          setQuitOpen(false);
        }}
      />
    </>
  );
}
