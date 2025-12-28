-- =============================================
-- Atomic Credit Deduction Function
-- Prevents race conditions on credit usage
-- =============================================

-- Function to atomically deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INT DEFAULT 1)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance INT;
    v_new_balance INT;
BEGIN
    -- Lock the row and get current balance
    SELECT credits_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    -- Check if user exists
    IF v_current_balance IS NULL THEN
        RETURN -2; -- User not found
    END IF;
    
    -- Check if sufficient credits
    IF v_current_balance < p_amount THEN
        RETURN -1; -- Insufficient credits
    END IF;
    
    -- Deduct credits
    v_new_balance := v_current_balance - p_amount;
    
    UPDATE profiles
    SET credits_balance = v_new_balance
    WHERE id = p_user_id;
    
    RETURN v_new_balance;
END;
$$;

-- Function to add credits (for payments)
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance INT;
BEGIN
    UPDATE profiles
    SET credits_balance = COALESCE(credits_balance, 0) + p_amount
    WHERE id = p_user_id
    RETURNING credits_balance INTO v_new_balance;
    
    IF v_new_balance IS NULL THEN
        RETURN -1; -- User not found
    END IF;
    
    RETURN v_new_balance;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO service_role;
