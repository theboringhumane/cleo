import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import React from 'react';

const navigation = [
  { name: 'Queues', href: '/queues', icon: Icons.logo },
  { name: 'Groups', href: '/groups', icon: Icons.tasks },
  { name: 'Workers', href: '/workers', icon: Icons.monitor },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 border-r">
        <div className="flex items-center flex-shrink-0 px-4">
          <img
            className="w-auto h-8"
            src="https://github.com/theboringhumane/cleo/raw/master/docs/apps/web/public/logo.svg"
            alt="Cleo"
          />
          <span className="ml-2 text-xl font-semibold">Cleo</span>
        </div>
        <div className="flex flex-col flex-grow mt-5">
          <nav className="flex-1 px-2 pb-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}