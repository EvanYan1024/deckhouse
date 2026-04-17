import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useSocketStore } from "@/stores/socket-store";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export function Layout() {
    const loggedIn = useAuthStore((s) => s.loggedIn);
    const connect = useSocketStore((s) => s.connect);
    const navigate = useNavigate();

    useEffect(() => {
        if (!loggedIn) {
            navigate("/login");
            return;
        }
        connect();
    }, [loggedIn, connect, navigate]);

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <main className="flex-1 overflow-auto px-8 py-6">
                    <div className="mx-auto max-w-5xl">
                        <Outlet />
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
