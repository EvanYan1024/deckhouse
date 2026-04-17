import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { ChevronsUpDown, LogOut, User } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";

export function NavUser() {
    const username = useAuthStore((s) => s.username);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();
    const { isMobile } = useSidebar();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton
                                size="lg"
                                className="data-[popup-open]:bg-sidebar-accent"
                            />
                        }
                    >
                        <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                            <User className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{username}</span>
                            <span className="truncate text-xs text-muted-foreground">Administrator</span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 size-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
