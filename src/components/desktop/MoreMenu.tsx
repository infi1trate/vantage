/**
 * MoreMenu
 * 
 * Dropdown menu for additional options including account info.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LogOut, 
  Settings, 
  HelpCircle, 
  User, 
  Video, 
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
import { AboutModal } from "./AboutModal";
import { 
  isElectronContext, 
  openExternal as bridgeOpenExternal,
  quit as bridgeQuit,
} from "@/lib/desktopBridge";

interface MoreMenuProps {
  trigger: React.ReactNode;
  username: string;
  email?: string;
  onSignOut: () => void;
  forceUploadError: boolean;
  onForceUploadErrorChange: (value: boolean) => void;
}

export function MoreMenu({
  trigger,
  username,
  email,
  onSignOut,
  forceUploadError,
  onForceUploadErrorChange,
}: MoreMenuProps) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Handle Settings click - open in system browser if Electron, otherwise navigate
  const handleSettingsClick = () => {
    setMenuOpen(false);
    if (isElectronContext()) {
      bridgeOpenExternal("https://getvantage.lovable.app/settings");
    } else {
      navigate("/settings");
    }
  };

  // Handle Help click - always open in system browser
  const handleHelpClick = () => {
    setMenuOpen(false);
    if (isElectronContext()) {
      bridgeOpenExternal("https://getvantage.lovable.app/help");
    } else {
      window.open("https://getvantage.lovable.app/help", "_blank", "noopener,noreferrer");
    }
  };

  // Handle About click
  const handleAboutClick = () => {
    setMenuOpen(false);
    setAboutOpen(true);
  };

  // Handle Quit - if Electron quit exists, call it; otherwise just close menu
  const handleQuitConfirm = async () => {
    setQuitOpen(false);
    const didQuit = await bridgeQuit();
    if (!didQuit) {
      // Not in Electron or quit not available - just close the menu
      setMenuOpen(false);
    }
  };

  // Display name: prefer username, fallback to email prefix
  const displayName = username || (email ? email.split("@")[0] : "User");

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
                  {displayName}
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
            onClick={handleSettingsClick}
            className="text-xs cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
            Settings
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* About */}
          <DropdownMenuItem 
            onClick={handleAboutClick}
            className="text-xs cursor-pointer"
          >
            <Info className="w-4 h-4 mr-2 text-muted-foreground" />
            About
          </DropdownMenuItem>
          
          {/* Help */}
          <DropdownMenuItem 
            onClick={handleHelpClick}
            className="text-xs cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
            Help
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* Quit */}
          <DropdownMenuItem 
            onClick={() => {
              setMenuOpen(false);
              setQuitOpen(true);
            }}
            className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Power className="w-4 h-4 mr-2" />
            Quit
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-white/10" />
          
          {/* Sign out */}
          <DropdownMenuItem 
            onClick={() => {
              setMenuOpen(false);
              onSignOut();
            }}
            className="text-xs cursor-pointer text-muted-foreground focus:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings Modal - kept for potential future local settings */}
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
        onConfirm={handleQuitConfirm}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </>
  );
}
