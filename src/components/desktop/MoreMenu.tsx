/**
 * MoreMenu
 * 
 * Dropdown menu for additional options including account info.
 */

import { cn } from "@/lib/utils";
import { LogOut, Settings, HelpCircle, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface MoreMenuProps {
  trigger: React.ReactNode;
  username: string;
  onSignOut: () => void;
  onSettings?: () => void;
  onHelp?: () => void;
}

export function MoreMenu({
  trigger,
  username,
  onSignOut,
  onSettings,
  onHelp,
}: MoreMenuProps) {
  return (
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
        
        {/* Settings */}
        <DropdownMenuItem 
          onClick={onSettings}
          className="text-xs cursor-pointer"
        >
          <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
          Settings
        </DropdownMenuItem>
        
        {/* Help */}
        <DropdownMenuItem 
          onClick={onHelp}
          className="text-xs cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 mr-2 text-muted-foreground" />
          Help & Support
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-white/10" />
        
        {/* Sign out */}
        <DropdownMenuItem 
          onClick={onSignOut}
          className="text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
