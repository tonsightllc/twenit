"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  ShoppingCart,
  Zap,
  HeadphonesIcon,
  BookOpen,
  Bot,
  BarChart3,
  UserMinus,
  FileText,
  AlertTriangle,
  Mail,
  Inbox,
  Palette,
  Settings,
  ChevronUp,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const menuItems = [
  {
    group: "General",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    group: "Ciclo de Vida",
    items: [
      {
        title: "Nuevas Ventas",
        url: "/ventas",
        icon: ShoppingCart,
      },
      {
        title: "Activación",
        url: "/activacion",
        icon: Zap,
      },
    ],
  },
  {
    group: "Soporte",
    items: [
      {
        title: "Centro de Soporte",
        url: "/soporte",
        icon: HeadphonesIcon,
      },
      {
        title: "Wiki",
        url: "/soporte/wiki",
        icon: BookOpen,
      },
      {
        title: "Bot",
        url: "/soporte/bot",
        icon: Bot,
      },
      {
        title: "Estadísticas",
        url: "/soporte/estadisticas",
        icon: BarChart3,
      },
    ],
  },
  {
    group: "Retención",
    items: [
      {
        title: "Desuscripción",
        url: "/desuscripcion",
        icon: UserMinus,
      },
      {
        title: "Reglas",
        url: "/desuscripcion/reglas",
        icon: FileText,
      },
      {
        title: "Disputas",
        url: "/desuscripcion/disputas",
        icon: AlertTriangle,
      },
    ],
  },
  {
    group: "Comunicación",
    items: [
      {
        title: "Inbox",
        url: "/mails/inbox",
        icon: Inbox,
      },
      {
        title: "Templates",
        url: "/mails/templates",
        icon: Mail,
      },
      {
        title: "Configuración",
        url: "/mails/config",
        icon: Palette,
      },
    ],
  },
];

interface AppSidebarProps {
  user: {
    email: string;
    full_name: string | null;
  } | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-4">
          <Image
            src="/logo-text-white-bg.png"
            alt="Twenit"
            width={120}
            height={32}
            className="h-8 w-auto dark:hidden object-contain"
            priority
          />
          <Image
            src="/logo-text-black-bg.png"
            alt="Twenit"
            width={120}
            height={32}
            className="h-8 w-auto hidden dark:block object-contain"
            priority
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"}>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Configuración</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {getInitials(user?.full_name ?? null, user?.email ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{user?.full_name || user?.email}</span>
                  <ChevronUp className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
