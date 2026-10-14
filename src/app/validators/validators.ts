import { FormControl, FormGroup, ValidatorFn, AbstractControl, ValidationErrors, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
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

// Email format: local part of letters/digits/._%+- (no leading, trailing or
// double dots), domain labels that don't start/end with '-', and a final
// part of 2+ letters -- so 'name@gmail.c' or 'a@b' are rejected.
// Same rule in validators.ts, prismCreateUser.js and prismCreateCognitoUser.js.
export const EMAIL_RE = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
export const NAME_MAX = 100;
export const EMAIL_MAX = 150;
// Letters (any language), digits, spaces, periods, hyphens and apostrophes;
// must start with a letter or digit. Symbols like * ( ) / = ; are rejected.
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u;

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

/** Default max length for free-text notes / reasons / comments. */
export const NOTE_MAX = 500;

/** Same limit as the server (prismLogdetailsbymedicaid MAX_RANGE_DAYS). */
export const REPORT_MAX_RANGE_DAYS = 366;

/**
 * Group validator for report filters with start_date / end_date controls:
 * end >= start (dateRangeInvalid), span <= maxDays (dateRangeTooLong) and,
 * unless allowFuture, no date after today (futureDate).
 */
export function reportDateRangeValidator(
    options: { maxDays?: number; allowFuture?: boolean } = {}
): ValidatorFn {
    const maxDays = options.maxDays ?? REPORT_MAX_RANGE_DAYS;
    return (group: AbstractControl): ValidationErrors | null => {
        const start = group.get('start_date')?.value;
        const end = group.get('end_date')?.value;
        if (!start || !end) return null;

        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

        if (endDate < startDate) return { dateRangeInvalid: true };

        const days = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        if (days > maxDays) return { dateRangeTooLong: true };

        if (!options.allowFuture) {
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);
            if (startDate > endOfToday || endDate > endOfToday) return { futureDate: true };
        }
        return null;
    };
}

const DATE_RANGE_ERRORS = ['dateRangeInvalid', 'dateRangeTooLong', 'futureDate'];

/**
 * Put on the end_date input so reportDateRangeValidator's group-level errors
 * show as that field's mat-error (a mat-error only renders when its own
 * control is in an error state).
 */
export class DateRangeErrorMatcher implements ErrorStateMatcher {
    isErrorState(control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
        if (!control) return false;
        const group = control.parent;
        const groupError = !!group && DATE_RANGE_ERRORS.some(k => group.hasError(k));
        return groupError || (control.invalid && (control.touched || control.dirty));
    }
}

/** Same rule as the server's PASSWORD_POLICY_RE (prismCreateUser / prismUserPasswordUpdate). */
export const PASSWORD_POLICY_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{15,}$/;

/** 15+ characters with upper, lower, digit and special character. Empty = handled by `required`. */
export function PasswordPolicyValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;
    return PASSWORD_POLICY_RE.test(value) ? null : { passwordPolicy: true };
}
