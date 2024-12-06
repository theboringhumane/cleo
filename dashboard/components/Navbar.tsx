import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';

export function Navbar() {
  return (
    <nav className="border-b px-4 py-2.5">
      <div className="flex flex-wrap justify-between items-center">
        <div className="flex items-center">
          <Button
            variant="ghost" 
            size="icon"
            className="mr-2 md:hidden"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative max-w-xs">
            <Input
              type="search"
              placeholder="Search tasks..."
              className="pl-8"
            />
            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex items-center lg:order-2">
          <Button variant="outline" size="default" className="mr-2">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </Button>
        </div>
      </div>
    </nav>
  );
}