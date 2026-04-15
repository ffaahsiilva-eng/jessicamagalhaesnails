
-- Remove unique constraint on time_slot alone
ALTER TABLE available_times DROP CONSTRAINT available_times_time_slot_key;

-- Now the old check constraint was already dropped in the previous migration attempt
-- Check current state and drop if exists
ALTER TABLE available_times DROP CONSTRAINT IF EXISTS available_times_day_type_check;

-- Expand weekday into individual days
INSERT INTO available_times (time_slot, display_order, is_active, day_type)
SELECT time_slot, display_order, is_active, d.day
FROM available_times
CROSS JOIN (VALUES ('monday'),('tuesday'),('wednesday'),('thursday'),('friday')) AS d(day)
WHERE day_type = 'weekday';

-- Convert weekend to saturday
UPDATE available_times SET day_type = 'saturday' WHERE day_type = 'weekend';

-- Remove old weekday rows
DELETE FROM available_times WHERE day_type = 'weekday';

-- Add new unique constraint (time_slot + day_type)
ALTER TABLE available_times ADD CONSTRAINT available_times_time_day_unique UNIQUE (time_slot, day_type);

-- Add new check constraint
ALTER TABLE available_times ADD CONSTRAINT available_times_day_type_check 
CHECK (day_type IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'));
