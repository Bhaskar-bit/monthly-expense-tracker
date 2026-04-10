import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { InflowHistory } from "@/lib/types"

async function fetchInflowHistory(monthId: string): Promise<InflowHistory[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("inflow_history")
    .select("*")
    .eq("month_id", monthId)
    .order("recorded_at", { ascending: true })

  if (error) throw error
  return data ?? []
}

export function useInflowHistory(monthId: string | undefined) {
  return useSWR<InflowHistory[]>(
    monthId ? `inflow-history-${monthId}` : null,
    () => fetchInflowHistory(monthId!),
    { revalidateOnFocus: false },
  )
}
