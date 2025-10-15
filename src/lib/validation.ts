import { z } from 'zod';

// Day of week enum
export const DayOfWeekEnum = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

// UUID validation
export const UUIDSchema = z.string().uuid('Invalid UUID format');

// Allocation validation
export const AllocationSchema = z.object({
  student_id: UUIDSchema,
  activity_id: UUIDSchema,
  day_of_week: DayOfWeekEnum,
  slot_number: z.number().int().min(1).max(2, 'Slot must be 1 or 2'),
  preference_rank: z.number().int().min(1).max(5, 'Rank must be 1-5'),
  status: z.enum(['allocated', 'waitlisted']).optional()
});

export type AllocationInput = z.infer<typeof AllocationSchema>;

// Preferences validation (nullable UUIDs for each choice)
export const PreferencesSchema = z.object({
  student_id: UUIDSchema,
  monday_first_choice: UUIDSchema.nullable().optional(),
  monday_second_choice: UUIDSchema.nullable().optional(),
  monday_third_choice: UUIDSchema.nullable().optional(),
  monday_fourth_choice: UUIDSchema.nullable().optional(),
  monday_fifth_choice: UUIDSchema.nullable().optional(),
  tuesday_first_choice: UUIDSchema.nullable().optional(),
  tuesday_second_choice: UUIDSchema.nullable().optional(),
  tuesday_third_choice: UUIDSchema.nullable().optional(),
  tuesday_fourth_choice: UUIDSchema.nullable().optional(),
  tuesday_fifth_choice: UUIDSchema.nullable().optional(),
  wednesday_slot1_first_choice: UUIDSchema.nullable().optional(),
  wednesday_slot1_second_choice: UUIDSchema.nullable().optional(),
  wednesday_slot1_third_choice: UUIDSchema.nullable().optional(),
  wednesday_slot1_fourth_choice: UUIDSchema.nullable().optional(),
  wednesday_slot1_fifth_choice: UUIDSchema.nullable().optional(),
  wednesday_slot2_first_choice: UUIDSchema.nullable().optional(),
  wednesday_slot2_second_choice: UUIDSchema.nullable().optional(),
  wednesday_slot2_third_choice: UUIDSchema.nullable().optional(),
  wednesday_slot2_fourth_choice: UUIDSchema.nullable().optional(),
  wednesday_slot2_fifth_choice: UUIDSchema.nullable().optional(),
  thursday_first_choice: UUIDSchema.nullable().optional(),
  thursday_second_choice: UUIDSchema.nullable().optional(),
  thursday_third_choice: UUIDSchema.nullable().optional(),
  thursday_fourth_choice: UUIDSchema.nullable().optional(),
  thursday_fifth_choice: UUIDSchema.nullable().optional(),
  friday_first_choice: UUIDSchema.nullable().optional(),
  friday_second_choice: UUIDSchema.nullable().optional(),
  friday_third_choice: UUIDSchema.nullable().optional(),
  friday_fourth_choice: UUIDSchema.nullable().optional(),
  friday_fifth_choice: UUIDSchema.nullable().optional(),
});

export type PreferencesInput = z.infer<typeof PreferencesSchema>;

// Manual allocation input validation
export const ManualAllocationInputSchema = z.object({
  studentId: UUIDSchema,
  activityId: UUIDSchema,
  day: DayOfWeekEnum,
  slot: z.number().int().min(1).max(2)
});

export type ManualAllocationInput = z.infer<typeof ManualAllocationInputSchema>;
