"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, LogOut, Calendar, Target, TrendingUp, Settings, Download } from "lucide-react"
import Link from "next/link"
import { PrivacyToggle } from "@/components/privacy-toggle"
import { logoutAction } from "@/lib/actions/auth-actions"

interface MobileNavProps {
  userEmail: string
}

export function MobileNav({ userEmail }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className="h-10 w-10"
      >
        {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
      </Button>

      {/* Mobile Menu */}
      {isOpen && (
        <nav
          className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg md:hidden z-50"
          role="navigation"
          aria-label="Mobile navigation menu"
        >
          <div className="container mx-auto px-4 py-4 space-y-2">
            <div className="pb-4 border-b">
              <PrivacyToggle />
            </div>

            <Link href="/insights" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start" aria-label="View spending insights">
                <TrendingUp className="w-4 h-4 mr-2" aria-hidden="true" />
                Insights
              </Button>
            </Link>

            <Link href="/budgets" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start" aria-label="Manage budgets">
                <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
                Budgets
              </Button>
            </Link>

            <Link href="/export" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start" aria-label="Export reports">
                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                Export
              </Button>
            </Link>

            <Link href="/savings-goals" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start" aria-label="View savings goals">
                <Target className="w-4 h-4 mr-2" aria-hidden="true" />
                Goals
              </Button>
            </Link>

            <Link href="/yearly-summary" onClick={() => setIsOpen(false)}>
              <Button variant="ghost" className="w-full justify-start" aria-label="View yearly summary">
                <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
                Yearly
              </Button>
            </Link>

            <div className="pt-4 border-t">
              <form action={logoutAction}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  type="submit"
                >
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </nav>
      )}
    </>
  )
}
