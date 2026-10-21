CREATE TABLE property_reminders (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  due_on date NOT NULL,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_reminders_due ON property_reminders(property_id, due_on, id);
