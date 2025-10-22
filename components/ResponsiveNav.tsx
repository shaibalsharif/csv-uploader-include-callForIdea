"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Upload, History, XCircle, Users, Trophy, Copy, BarChart } from "lucide-react"; // Imported BarChart

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GIZ_LOGO_BASE64, GOODGRANTS_LOGO_BASE64, TILLER_LOGO_BASE64 } from "@/lib/logo-base64";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { href: "/", label: "Upload & Process", icon: Upload },
    { href: "/history", label: "Batch History", icon: History },
    { href: "/failed", label: "Failed Submissions", icon: XCircle },
    { href: "/manage", label: "Manage Applications", icon: Users },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/analysis", label: "Analysis", icon: BarChart }, // ADDED: Analysis Page
    { href: "/duplicates", label: "Find Duplicates", icon: Copy },
];

const DesktopNav = () => {
    const pathname = usePathname();

    return (
        <nav className="hidden md:flex items-center space-x-1.5 lg:space-x-4">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        "transition-colors text-sm font-medium p-2 rounded-lg",
                        pathname === item.href
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
};

const MobileNav = () => {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 pt-6">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-4 px-4 py-2 rounded-lg text-lg font-medium transition-colors",
                                pathname === item.href
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-foreground hover:bg-muted"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default function ResponsiveNav() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center space-x-2 pl-2">
                    {/* Logo/Brand */}
                    <a href="https://www.giz.de/en" ><img
                        src={GIZ_LOGO_BASE64}
                        alt="GIZ Logo"

                        className="h-8 w-auto mr-4"
                        onError={(e: any) => {
                            e.target.onerror = null;
                            e.target.src = "/placeholder-logo.png";
                        }}
                    /></a>
                    <a href="https://www.tiller.com.bd" > <img
                        src={TILLER_LOGO_BASE64}
                        alt="GIZ Logo"
                        className="h-8 w-auto mr-4"
                        onError={(e: any) => {
                            e.target.onerror = null;
                            e.target.src = "/placeholder-logo.png";
                        }}
                    /></a>
                    <a href="https://my.goodgrants.com/" > <img
                        src={GOODGRANTS_LOGO_BASE64}
                        alt="GIZ Logo"
                        className="h-8 w-auto mr-4"
                        onError={(e: any) => {
                            e.target.onerror = null;
                            e.target.src = "/placeholder-logo.png";
                        }}
                    /></a>
                    <h1 className="text-xl font-bold tracking-tight hidden sm:block">INCLUDE Portal</h1>
                </div>

                <DesktopNav />
                <MobileNav />
            </div>
        </header>
    );
}
