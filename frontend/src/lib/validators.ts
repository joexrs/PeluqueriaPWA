/**
 * Form validation utilities for the Peluqueria PWA
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FieldValidator {
  validate: (value: string) => ValidationResult;
}

// Common validation rules
export const validators = {
  required: (message = "Este campo es obligatorio"): FieldValidator => ({
    validate: (value: string) => ({
      valid: !!value.trim(),
      error: value.trim() ? undefined : message,
    }),
  }),

  email: (message = "Ingresa un correo electrónico válido"): FieldValidator => ({
    validate: (value: string) => {
      if (!value.trim()) return { valid: true }; // Let required handle empty
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        valid: emailRegex.test(value),
        error: emailRegex.test(value) ? undefined : message,
      };
    },
  }),

  phone: (message = "Ingresa un número de teléfono válido"): FieldValidator => ({
    validate: (value: string) => {
      if (!value.trim()) return { valid: true };
      // Allow formats: +52 123 456 7890, 123-456-7890, (123) 456-7890, 10+ digits
      const phoneRegex = /^[\d\s()+-]{10,}$/;
      const digitsOnly = value.replace(/\D/g, "");
      return {
        valid: digitsOnly.length >= 10 || phoneRegex.test(value),
        error: digitsOnly.length >= 10 || phoneRegex.test(value) ? undefined : message,
      };
    },
  }),

  minLength: (min: number, message?: string): FieldValidator => ({
    validate: (value: string) => ({
      valid: value.trim().length >= min,
      error: value.trim().length >= min ? undefined : message || `Mínimo ${min} caracteres`,
    }),
  }),

  maxLength: (max: number, message?: string): FieldValidator => ({
    validate: (value: string) => ({
      valid: value.trim().length <= max,
      error: value.trim().length <= max ? undefined : message || `Máximo ${max} caracteres`,
    }),
  }),

  minValue: (min: number, message?: string): FieldValidator => ({
    validate: (value: string) => {
      const num = Number(value);
      return {
        valid: !isNaN(num) && num >= min,
        error: !isNaN(num) && num >= min ? undefined : message || `El valor mínimo es ${min}`,
      };
    },
  }),

  positiveNumber: (message = "Ingresa un número positivo"): FieldValidator => ({
    validate: (value: string) => {
      if (!value.trim()) return { valid: true };
      const num = Number(value);
      return {
        valid: !isNaN(num) && num > 0,
        error: !isNaN(num) && num > 0 ? undefined : message,
      };
    },
  }),

  nonNegativeNumber: (message = "Ingresa un número válido"): FieldValidator => ({
    validate: (value: string) => {
      if (!value.trim()) return { valid: true };
      const num = Number(value);
      return {
        valid: !isNaN(num) && num >= 0,
        error: !isNaN(num) && num >= 0 ? undefined : message,
      };
    },
  }),

  futureDate: (message = "La fecha debe ser futura"): FieldValidator => ({
    validate: (value: string) => {
      if (!value) return { valid: true };
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        valid: date >= today,
        error: date >= today ? undefined : message,
      };
    },
  }),

  pastOrPresentDate: (message = "La fecha no puede ser futura"): FieldValidator => ({
    validate: (value: string) => {
      if (!value) return { valid: true };
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return {
        valid: date <= today,
        error: date <= today ? undefined : message,
      };
    },
  }),

  barcode: (message = "Código de barras inválido"): FieldValidator => ({
    validate: (value: string) => {
      if (!value.trim()) return { valid: true };
      // Allow alphanumeric, hyphens, and common barcode characters
      const barcodeRegex = /^[\w-]{3,30}$/;
      return {
        valid: barcodeRegex.test(value),
        error: barcodeRegex.test(value) ? undefined : message,
      };
    },
  }),

  lotNumber: (message = "Número de lote inválido"): FieldValidator => ({
    validate: (value: string) => {
      if (!value.trim()) return { valid: true };
      // Allow alphanumeric with hyphens, slashes
      const lotRegex = /^[\w/-]{2,30}$/;
      return {
        valid: lotRegex.test(value),
        error: lotRegex.test(value) ? undefined : message,
      };
    },
  }),

  // Compose multiple validators
  compose: (...fieldValidators: FieldValidator[]): FieldValidator => ({
    validate: (value: string) => {
      for (const validator of fieldValidators) {
        const result = validator.validate(value);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    },
  }),
};

/**
 * Validate an entire form object
 */
export function validateForm<T extends Record<string, string>>(
  data: T,
  rules: Partial<Record<keyof T, FieldValidator>>
): Record<keyof T, string | undefined> {
  const errors: Record<string, string | undefined> = {};

  for (const field in rules) {
    const validator = rules[field];
    if (validator) {
      const result = validator.validate(data[field] || "");
      errors[field] = result.error;
    }
  }

  return errors as Record<keyof T, string | undefined>;
}

/**
 * Check if a form has any validation errors
 */
export function hasErrors<T extends Record<string, string | undefined>>(errors: T): boolean {
  return Object.values(errors).some((error) => error !== undefined && error !== "");
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Validate time range (start must be before end)
 */
export function validateTimeRange(startTime: string, endTime: string): ValidationResult {
  if (!startTime || !endTime) {
    return { valid: true }; // Let required handle empty
  }
  
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return {
    valid: endMinutes > startMinutes,
    error: endMinutes > startMinutes ? undefined : "La hora de fin debe ser posterior a la de inicio",
  };
}