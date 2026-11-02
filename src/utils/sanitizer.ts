import validator from 'validator';
import { z } from 'zod';

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Trim leading/trailing whitespace, remove null bytes, escape HTML tags to prevent XSS
  const trimmed = input.trim().replace(/\0/g, '');
  return validator.escape(trimmed);
}

export function sanitizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const normalized = validator.normalizeEmail(trimmed);
  return typeof normalized === 'string' ? normalized : trimmed;
}

export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .transform(sanitizeString),
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254, 'Email cannot exceed 254 characters')
    .transform(sanitizeEmail),
  subject: z
    .string()
    .min(2, 'Subject must be at least 2 characters')
    .max(150, 'Subject cannot exceed 150 characters')
    .transform(sanitizeString),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message cannot exceed 5000 characters')
    .transform(sanitizeString),
  // Anti-bot honeypot field: must be empty
  website_url_hp: z.string().optional().default(''),
  // Anti-bot timing check: timestamp when form was rendered
  form_timestamp: z.coerce.number().optional().default(0),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
