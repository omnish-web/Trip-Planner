-- Function to swap participant roles under a parent-child relationship
-- This function handles swapping parent/dependent statuses, transferring paid expenses, 
-- and updating expense splits (recalculating equal splits and transferring custom splits).
CREATE OR REPLACE FUNCTION swap_participant_roles(
    new_parent_id UUID,
    old_parent_id UUID
) RETURNS VOID AS $$
DECLARE
    v_trip_id UUID;
    r_exp RECORD;
    v_distinct_shares INT;
    v_dependent_splits_count INT;
BEGIN
    -- 1. Get trip_id and validate relationship
    SELECT trip_id INTO v_trip_id 
    FROM trip_participants 
    WHERE id = new_parent_id AND parent_id = old_parent_id;

    IF v_trip_id IS NULL THEN
        RAISE EXCEPTION 'Participant % is not a dependent of %', new_parent_id, old_parent_id;
    END IF;

    -- 2. Process expense splits (Before swapping roles so we can use old family structure)
    FOR r_exp IN 
        SELECT id, amount FROM expenses WHERE trip_id = v_trip_id
    LOOP
        -- Count splits associated with dependent/child members (who should not have splits in equal split mode)
        SELECT COUNT(*)
        INTO v_dependent_splits_count
        FROM expense_splits es
        JOIN trip_participants tp ON es.participant_id = tp.id
        WHERE es.expense_id = r_exp.id 
          AND tp.parent_id IS NOT NULL;

        -- Count how many distinct unit shares exist among the split participants
        SELECT COUNT(DISTINCT ROUND(es.amount / (
            CASE 
                WHEN es.participant_id = old_parent_id THEN 
                    1 + (SELECT COUNT(*) FROM trip_participants WHERE parent_id = old_parent_id)
                ELSE 
                    1 + (SELECT COUNT(*) FROM trip_participants WHERE parent_id = es.participant_id)
            END
        ), 2))
        INTO v_distinct_shares
        FROM expense_splits es
        WHERE es.expense_id = r_exp.id;

        -- Check if it was split equally (no dependent splits, and exactly 1 distinct family unit share)
        IF v_dependent_splits_count = 0 AND v_distinct_shares = 1 THEN
            -- EQUAL SPLIT: Transfer old parent's consolidated split to the new parent
            IF EXISTS (SELECT 1 FROM expense_splits WHERE expense_id = r_exp.id AND participant_id = old_parent_id) THEN
                UPDATE expense_splits 
                SET participant_id = new_parent_id
                WHERE expense_id = r_exp.id AND participant_id = old_parent_id;
            END IF;
        ELSE
            -- CUSTOM/EXACT SPLIT: Transfer A's share to B, merging if B already has a split row
            IF EXISTS (SELECT 1 FROM expense_splits WHERE expense_id = r_exp.id AND participant_id = old_parent_id) THEN
                IF EXISTS (SELECT 1 FROM expense_splits WHERE expense_id = r_exp.id AND participant_id = new_parent_id) THEN
                    -- Merge splits
                    UPDATE expense_splits 
                    SET amount = amount + (SELECT amount FROM expense_splits WHERE expense_id = r_exp.id AND participant_id = old_parent_id)
                    WHERE expense_id = r_exp.id AND participant_id = new_parent_id;
                    
                    -- Delete old split for A
                    DELETE FROM expense_splits WHERE expense_id = r_exp.id AND participant_id = old_parent_id;
                ELSE
                    -- Just transfer A's split to B
                    UPDATE expense_splits 
                    SET participant_id = new_parent_id
                    WHERE expense_id = r_exp.id AND participant_id = old_parent_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    -- 3. Update multi-payers (expense_payers table)
    FOR r_exp IN 
        SELECT DISTINCT expense_id FROM expense_payers WHERE participant_id = old_parent_id
    LOOP
        IF EXISTS (SELECT 1 FROM expense_payers WHERE expense_id = r_exp.expense_id AND participant_id = new_parent_id) THEN
            -- Merge payer amounts
            UPDATE expense_payers 
            SET amount = amount + (SELECT amount FROM expense_payers WHERE expense_id = r_exp.expense_id AND participant_id = old_parent_id)
            WHERE expense_id = r_exp.expense_id AND participant_id = new_parent_id;
            
            -- Delete old payer record
            DELETE FROM expense_payers WHERE expense_id = r_exp.expense_id AND participant_id = old_parent_id;
        ELSE
            -- Transfer payer record
            UPDATE expense_payers 
            SET participant_id = new_parent_id
            WHERE expense_id = r_exp.expense_id AND participant_id = old_parent_id;
        END IF;
    END LOOP;

    -- 4. Update primary expense payer (paid_by in expenses table)
    UPDATE expenses 
    SET paid_by = new_parent_id 
    WHERE paid_by = old_parent_id AND trip_id = v_trip_id;

    -- 5. Swap participant roles in trip_participants
    -- Set other dependents of old parent to new parent
    UPDATE trip_participants 
    SET parent_id = new_parent_id
    WHERE parent_id = old_parent_id AND id != new_parent_id;

    -- Set old parent to dependent of new parent
    UPDATE trip_participants 
    SET parent_id = new_parent_id
    WHERE id = old_parent_id;

    -- Set new parent to independent (NULL parent_id)
    UPDATE trip_participants 
    SET parent_id = NULL
    WHERE id = new_parent_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
