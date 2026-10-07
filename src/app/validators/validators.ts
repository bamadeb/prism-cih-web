import { FormControl, FormGroup, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { ValidatorUtility } from '../services/validator.service';

/**
 * Allows alpha numeric characters and -, _ characters
 */
export function AlphaNumDashesValidator(control: FormControl): { nonAlphaNumDashes: boolean, error: boolean } | null {
    if (ValidatorUtility.isEmpty(control.value)) {
        return null;
    }
    return /^[\w\-]+$/.test(control.value)
        ? null : { nonAlphaNumDashes: true, error: true };
}

export function PasswordMatchValidator(formGroup: FormGroup): { passwordNotMatch: boolean } | null {
    const password  = formGroup.get('password')?.value;
    const confirmPassword  = formGroup.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordNotMatch: true };
}

export function FileExtensionValidator(extensions: string[]): ValidatorFn {
    return (formControl: AbstractControl): { pattern: boolean } | null => {
        if (formControl?.value) {
            const fileNameArray = formControl.value.split('.');
            const extension = fileNameArray[fileNameArray.length - 1];
            if (extensions.includes(extension.toLowerCase())) {
                return null;
            } else {
                return { pattern: true };
            }
        } else {
            return null;
        }
    };
}

export function CannotContainSpace(control: FormControl): { cannotContainSpace: boolean } | null {
    if (ValidatorUtility.hasSpaces(control.value)) {
        return { cannotContainSpace: true };
    }
    return null;
}

// Same rule as the server (prismCreateUser.js EMAIL_RE).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const NAME_MAX = 100;
export const EMAIL_MAX = 150;
// Letters (any language), spaces, hyphens and apostrophes; must start with a letter.
const NAME_RE = /^\p{L}[\p{L} '-]*$/u;

/**
 * Person name. Checks the trimmed value, so leading/trailing spaces are allowed
 * (trim on submit) but a whitespace-only name is rejected.
 */
export function NameValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '');
    if (!value) return null; // `required` reports empty
    const trimmed = value.trim();
    if (!trimmed) return { whitespace: true };
    return NAME_RE.test(trimmed) ? null : { namePattern: true };
}

/** US phone number: exactly 10 digits, whatever the formatting. */
export function PhoneDigitsValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '');
    if (!value) return null;
    return value.replace(/\D/g, '').length === 10 ? null : { phoneDigits: true };
}

/** Date must be today or earlier. */
export function NotFutureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const date = new Date(control.value);
    if (isNaN(date.getTime())) return { invalidDate: true };
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return date > endOfToday ? { futureDate: true } : null;
}

/** Rejects a value that is only whitespace (`required` alone lets "   " through). */
export function NotBlankValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    return value.trim() ? null : { whitespace: true };
}

/** US ZIP: 5 digits, or ZIP+4 (12345-6789). */
export function ZipValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value ?? '').trim();
    if (!value) return null;
    return /^\d{5}(-\d{4})?$/.test(value) ? null : { zip: true };
}
