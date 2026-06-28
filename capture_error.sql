-- Create a diagnostic function to capture the EXACT PostgreSQL error during deletion

CREATE OR REPLACE FUNCTION capture_delete_error()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    err_msg text;
    err_detail text;
    err_hint text;
    err_context text;
    target_id uuid;
BEGIN
    -- Pick one random expense to test deletion
    SELECT id INTO target_id FROM expenses LIMIT 1;
    
    IF target_id IS NULL THEN
        RETURN 'No expenses found to test.';
    END IF;

    BEGIN
        -- Attempt to delete it
        DELETE FROM expenses WHERE id = target_id;
        -- If it succeeds, rollback so we don't actually delete data during our test
        RAISE EXCEPTION 'TEST_SUCCESS';
    EXCEPTION 
        WHEN P0001 THEN
            IF SQLERRM = 'TEST_SUCCESS' THEN
                RETURN 'Deletion succeeded with no database errors. If you get a 500, it is purely an RLS issue.';
            ELSE
                GET STACKED DIAGNOSTICS
                    err_msg = MESSAGE_TEXT,
                    err_detail = PG_EXCEPTION_DETAIL,
                    err_hint = PG_EXCEPTION_HINT,
                    err_context = PG_EXCEPTION_CONTEXT;
                RETURN 'Trigger/Custom Error: ' || err_msg;
            END IF;
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS
                err_msg = MESSAGE_TEXT,
                err_detail = PG_EXCEPTION_DETAIL,
                err_hint = PG_EXCEPTION_HINT,
                err_context = PG_EXCEPTION_CONTEXT;
                
            RETURN 'DB ERROR: ' || err_msg || ' | Detail: ' || COALESCE(err_detail, 'None') || ' | Context: ' || COALESCE(err_context, 'None');
    END;
END;
$$;
