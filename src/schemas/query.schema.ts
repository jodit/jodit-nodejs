import { z } from 'zod';

// Base action query schema
export const BaseActionQuerySchema = z.object({
  action: z.string({ message: 'Action parameter is required' }).min(1, 'Action parameter is required')
});

export type BaseActionQueryParams = z.infer<typeof BaseActionQuerySchema>;

// Passthrough version that allows unknown keys
export const BaseActionQueryPassthroughSchema = BaseActionQuerySchema.loose();

// Files action query schema
export const FilesQuerySchema = z.object({
  action: z.literal('files'),
  source: z.string().optional(),
  path: z.string().optional(),
  mods: z.string().optional()
});

export type FilesQueryParams = z.infer<typeof FilesQuerySchema>;
