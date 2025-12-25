import { createClient } from "@/lib/supabase/client"

export interface AuditLogEntry {
  entity_type: "expense" | "month" | "savings_goal"
  entity_id: string
  action: "create" | "update" | "delete"
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
}

export const auditService = {
  async logAction(entry: AuditLogEntry, ipAddress?: string, userAgent?: string): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return

    const { error } = await supabase.from("audit_logs").insert({
      user_id: userData.user.id,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      old_values: entry.old_values || null,
      new_values: entry.new_values || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    })

    if (error) {
      console.error("[v0] Audit logging failed:", error)
    }
  },

  async getActionHistory(entityType: string, entityId: string, limit = 50) {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("action_date", { ascending: false })
      .limit(limit)

    return data || []
  },
}
