import { createRootRoute, Outlet, HeadContent, Scripts } from '@tanstack/react-router'
import { Sidebar } from '~/components/Sidebar'
import '~/styles/globals.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cleo Dashboard</title>
        <HeadContent />
      </head>
      <body className="bg-background">
        <div className="flex h-screen bg-background text-foreground">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
