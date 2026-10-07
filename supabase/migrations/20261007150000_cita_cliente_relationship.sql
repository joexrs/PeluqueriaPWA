-- Ensure PostgREST can resolve the Cita -> Cliente relationship on existing databases.
DO $$
DECLARE
    v_fk_name TEXT;
BEGIN
    SELECT c.conname
      INTO v_fk_name
      FROM pg_constraint AS c
      JOIN pg_attribute AS source_column
        ON source_column.attrelid = c.conrelid
       AND source_column.attnum = ANY (c.conkey)
      JOIN pg_attribute AS target_column
        ON target_column.attrelid = c.confrelid
       AND target_column.attnum = ANY (c.confkey)
     WHERE c.contype = 'f'
       AND c.conrelid = 'public."Cita"'::regclass
       AND c.confrelid = 'public."Cliente"'::regclass
       AND source_column.attname = 'cliente_id'
       AND target_column.attname = 'ID'
       AND c.conkey = ARRAY[source_column.attnum]::SMALLINT[]
       AND c.confkey = ARRAY[target_column.attnum]::SMALLINT[]
     LIMIT 1;

    IF v_fk_name IS NULL THEN
        ALTER TABLE public."Cita"
            ADD CONSTRAINT "FK_Cita_Cliente"
            FOREIGN KEY (cliente_id)
            REFERENCES public."Cliente" ("ID")
            ON DELETE RESTRICT;
    ELSIF v_fk_name <> 'FK_Cita_Cliente' THEN
        EXECUTE format(
            'ALTER TABLE public."Cita" RENAME CONSTRAINT %I TO %I',
            v_fk_name,
            'FK_Cita_Cliente'
        );
    END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
