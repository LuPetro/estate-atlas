CREATE TABLE reminder_email_notifications (
  reminder_id uuid NOT NULL REFERENCES property_reminders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation uuid NOT NULL,
  days_before integer NOT NULL CHECK (days_before IN (0,1,3,7)),
  time_zone text NOT NULL CHECK (char_length(time_zone) BETWEEN 1 AND 80),
  send_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','unknown','expired','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  claimed_at timestamptz,
  sent_at timestamptz,
  PRIMARY KEY (reminder_id,user_id)
);
CREATE INDEX reminder_email_ready ON reminder_email_notifications(next_attempt_at,send_at) WHERE status='pending';
CREATE INDEX reminder_email_user ON reminder_email_notifications(user_id);

CREATE TABLE property_cashflow_entries (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  request_key varchar(80) NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  booked_on date NOT NULL CHECK (booked_on >= DATE '1900-01-01'),
  category text NOT NULL CHECK (category IN ('rent','other_income','operating','repair','loan','other_expense')),
  amount numeric(12,2) NOT NULL CHECK (amount>0 AND amount<=1000000000),
  currency text NOT NULL CHECK (currency IN ('EUR','USD','GBP','CHF','AED','CAD','AUD','JPY')),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes)<=1000),
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (currency<>'JPY' OR amount=trunc(amount)),
  UNIQUE(property_id,request_key)
);
CREATE INDEX property_cashflow_month ON property_cashflow_entries(property_id,booked_on,id);
