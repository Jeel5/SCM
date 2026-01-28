import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormProps, FieldValues } from 'react-hook-form';
import type { ZodSchema } from 'zod';

/**
 * Custom hook for form validation using Zod schemas
 * Integrates Zod with React Hook Form for type-safe form validation
 * 
 * @param schema - Zod validation schema
 * @param options - React Hook Form options
 * @returns React Hook Form methods with Zod validation
 * 
 * @example
 * ```tsx
 * const form = useFormValidation(loginSchema, {
 *   defaultValues: { email: '', password: '' }
 * });
 * 
 * const onSubmit = form.handleSubmit((data) => {
 *   // data is typed according to schema
 *   console.log(data);
 * });
 * ```
 */
export function useFormValidation<TFieldValues extends FieldValues = FieldValues>(
  schema: ZodSchema,
  options?: Omit<UseFormProps<TFieldValues>, 'resolver'>
) {
  return useForm<TFieldValues>({
    ...options,
    resolver: zodResolver(schema),
    mode: options?.mode || 'onBlur', // Validate on blur by default
  });
}

/**
 * Validate data against a Zod schema synchronously
 * Useful for manual validation outside of forms
 * 
 * @param schema - Zod validation schema
 * @param data - Data to validate
 * @returns Validation result with success flag and data/errors
 */
export function validateData<T>(schema: ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true as const,
      data: result.data,
      errors: null,
    };
  }
  
  return {
    success: false as const,
    data: null,
    errors: result.error.flatten().fieldErrors,
  };
}

/**
 * Extract error messages from Zod errors for display
 * 
 * @param errors - Zod field errors
 * @returns Record of field names to error messages
 */
export function getErrorMessages(errors: Record<string, string[] | undefined>) {
  const messages: Record<string, string> = {};
  
  for (const [field, fieldErrors] of Object.entries(errors)) {
    if (fieldErrors && fieldErrors.length > 0) {
      messages[field] = fieldErrors[0]; // Take first error message
    }
  }
  
  return messages;
}

/**
 * React Hook Form error helper
 * Formats RHF errors for display in UI
 */
export function getFieldError(errors: any, fieldName: string): string | undefined {
  const error = errors[fieldName];
  return error?.message;
}
