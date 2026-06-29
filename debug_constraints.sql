-- Create an RPC to debug what is blocking the deletion
CREATE OR REPLACE FUNCTION debug_expense_constraints()
RETURNS TABLE (
    constraint_name text,
    table_name text,
    delete_rule text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        con.conname::text AS constraint_name,
        cl.relname::text AS table_name,
        CASE con.confdeltype 
            WHEN 'a' THEN 'NO ACTION'
            WHEN 'r' THEN 'RESTRICT'
            WHEN 'c' THEN 'CASCADE'
            WHEN 'n' THEN 'SET NULL'
            WHEN 'd' THEN 'SET DEFAULT'
            ELSE con.confdeltype::text
        END AS delete_rule
    FROM pg_constraint con
    JOIN pg_class cl ON con.conrelid = cl.oid
    JOIN pg_class cl_ref ON con.confrelid = cl_ref.oid
    WHERE cl_ref.relname = 'expenses' AND con.contype = 'f';
$$;
