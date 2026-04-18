import { Link, useLocation } from "react-router-dom";
import { useSocketStore } from "@/stores/socket-store";
import { Circle, Plus, Settings } from "lucide-react";
import { Logo } from "./logo";
import { NavUser } from "./nav-user";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const location = useLocation();
    const stackList = useSocketStore((s) => s.stackList);
    const stacks = Object.values(stackList);

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            {/* Header: Logo */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" render={<Link to="/" />}>
                            <div className="flex size-8 items-center justify-center">
                                {/* SidebarMenuButton forces `[&_svg]:size-4` on
                                    descendant svgs, which clobbers Logo's own
                                    width/height. Use `!` to restore 28px. */}
                                <Logo size={28} className="text-[#c96442] !size-7" />
                            </div>
                            <span className="truncate text-base font-semibold tracking-tight">
                                Deckhouse
                            </span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* Stack List */}
                <SidebarGroup>
                    <SidebarGroupLabel>Stacks</SidebarGroupLabel>
                    <SidebarGroupAction render={<Link to="/compose" title="New Stack" />}>
                        <Plus />
                    </SidebarGroupAction>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {stacks.length === 0 && (
                                <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                                    No stacks yet
                                </p>
                            )}
                            {stacks.map((stack) => {
                                const isActive = location.pathname === `/compose/${stack.name}`;
                                const isRunning = stack.status === 3;
                                return (
                                    <SidebarMenuItem key={stack.name}>
                                        <SidebarMenuButton isActive={isActive} render={<Link to={`/compose/${stack.name}`} />}>
                                            <Circle
                                                className={`size-2 fill-current ${
                                                    isRunning
                                                        ? "text-green-600"
                                                        : "text-muted-foreground/40"
                                                }`}
                                            />
                                            <span>{stack.name}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Bottom: Settings */}
                <SidebarGroup className="mt-auto">
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton render={<Link to="/settings/general" />}>
                                    <Settings />
                                    <span>Settings</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {/* Footer: User */}
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
