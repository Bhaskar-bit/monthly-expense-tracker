-- Migration: allocate_investment_by_priority
-- Wraps goal contribution inserts + goal amount updates in a single
-- atomic transaction so a mid-way failure cannot leave the DB in a
-- partial state.
--
-- Apply with: supabase db push  OR  supabase migration up

CREATE OR REPLACE FUNCTION allocate_investment_by_priority(
  p_user_id      UUID,
  p_expense_id   UUID,
  p_amount       NUMERIC,
  p_expense_date DATE
)
RETURNS TABLE (
  goal_id          UUID,
  goal_name        TEXT,
  allocated_amount NUMERIC,
  goal_completed   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goal            RECORD;
  v_remaining       NUMERIC := p_amount;
  v_amount_needed   NUMERIC;
  v_allocation      NUMERIC;
  v_new_current     NUMERIC;
  v_goal_completed  BOOLEAN;
BEGIN
  -- Lock the relevant goal rows so concurrent calls cannot double-allocate
  FOR v_goal IN
    SELECT id, name, target_amount, current_amount, priority
    FROM   savings_goals
    WHERE  user_id = p_user_id
      AND  status IN ('active', 'inactive')
    ORDER  BY priority ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_amount_needed := v_goal.target_amount - COALESCE(v_goal.current_amount, 0);
    CONTINUE WHEN v_amount_needed <= 0;

    v_allocation     := LEAST(v_remaining, v_amount_needed);
    v_new_current    := COALESCE(v_goal.current_amount, 0) + v_allocation;
    v_goal_completed := v_new_current >= v_goal.target_amount;

    -- Insert contribution record
    INSERT INTO goal_contributions (goal_id, user_id, expense_id, amount, contribution_date)
    VALUES (v_goal.id, p_user_id, p_expense_id, v_allocation, p_expense_date);

    -- Update goal
    UPDATE savings_goals
    SET    current_amount = v_new_current,
           status         = CASE WHEN v_goal_completed THEN 'completed' ELSE 'active' END,
           updated_at     = NOW()
    WHERE  id      = v_goal.id
      AND  user_id = p_user_id;

    v_remaining := v_remaining - v_allocation;

    -- Return one row per goal that received an allocation
    goal_id          := v_goal.id;
    goal_name        := v_goal.name;
    allocated_amount := v_allocation;
    goal_completed   := v_goal_completed;
    RETURN NEXT;
  END LOOP;
END;
$$;
