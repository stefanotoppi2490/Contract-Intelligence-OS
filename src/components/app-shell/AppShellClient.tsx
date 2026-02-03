"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/contracts", label: "Contracts", icon: "file" },
  { href: "/counterparties", label: "Counterparties", icon: "users" },
  { href: "/policies", label: "Policies", icon: "shield" },
  { href: "/exceptions", label: "Exceptions", icon: "alert" },
  { href: "/ledger", label: "Ledger", icon: "book" },
  { href: "/settings/members", label: "Settings", icon: "settings" },
] as const;

function Icon({ name }: { name: (typeof navItems)[number]["icon"] }) {
  const c = "w-5 h-5 shrink-0";
  switch (name) {
    case "file":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "users":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "shield":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "alert":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "book":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "settings":
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
        </svg>
      );
  }
}

export function AppShellClient({
  children,
  session,
}: {
  children: React.ReactNode;
  session: { email: string | null; user?: { name?: string | null; image?: string | null } };
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[var(--background)]">
      {/* Sidebar — Super Admin: #140751, text #dcd6f6, active primary + gradient */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out lg:static lg:z-auto ${sidebarOpen ? "w-64" : "w-0"} lg:w-64`}
        style={{ backgroundColor: "var(--sidebar-bg)", color: "var(--sidebar-text)" }}
      >
        <div
          className="flex h-14 shrink-0 items-center px-4 border-b"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <Link
            href="/contracts"
            className="flex items-center gap-2 text-[1.15625rem] font-medium"
            style={{ color: "#fff" }}
          >
            Contract Intelligence
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-0.5 px-3">
            {navItems.map(({ href, label, icon }) => {
              const active = pathname === href || (href !== "/contracts" && pathname.startsWith(href));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 text-[0.925rem] font-medium transition-colors rounded-[var(--rounded-5)] ${
                      active ? "text-white" : "hover:bg-white/15 hover:text-white"
                    }`}
                    style={
                      active
                        ? {
                            background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%), #1d8bf1",
                          }
                        : undefined
                    }
                  >
                    <Icon name={icon} />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Overlay when sidebar open on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
          role="presentation"
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — template: btn-transparent rounded-3, border #f3f5f9 */}
        <header
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4"
          style={{ backgroundColor: "var(--header-bg)", borderColor: "var(--header-border)" }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-[var(--rounded-3)] p-2 text-[#6e7985] hover:bg-[#f3f5f9] lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <nav className="hidden items-center gap-1.5 text-[0.925rem] text-[#6e7985] lg:flex">
            <Link href="/contracts" className="hover:text-[#131722]">
              Home
            </Link>
            <span className="text-[#9ea7b1]">/</span>
            <span className="font-medium text-[#131722]">
              {navItems.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))?.label ?? "Page"}
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[0.925rem] text-[#6e7985] sm:inline">{session.email}</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-[var(--rounded-5)] p-1 ring-1 ring-[#e2e5ec] hover:ring-[#ccd2da]"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--rounded-5)] text-sm font-medium text-white"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%), #1d8bf1",
                  }}
                >
                  {(session.user?.name ?? session.email ?? "U").slice(0, 1).toUpperCase()}
                </span>
              </button>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    className="absolute right-0 top-full z-20 mt-2 w-56 rounded-[var(--card-border-radius)] border border-[#f3f5f9] py-2 shadow-[0_0.5rem_1rem_rgba(17,20,24,0.15)]"
                    style={{ backgroundColor: "var(--dropdown-bg)", color: "var(--dropdown-text)" }}
                  >
                    <div className="border-b border-white/10 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-[#e2e5ec]">{session.user?.name ?? "User"}</p>
                      <p className="truncate text-xs text-[#9ea7b1]">{session.email}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 px-2 py-2">
                      <Link
                        href="/settings/members"
                        className="rounded-[var(--rounded-3)] px-2 py-1.5 text-sm text-[#e2e5ec] hover:bg-white/15"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut({ callbackUrl: "/signin" });
                        }}
                        className="rounded-[var(--rounded-3)] px-2 py-1.5 text-left text-sm text-[#e2e5ec] hover:bg-white/15"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page body — template: app-body, container-fluid, gray-100 bg */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
