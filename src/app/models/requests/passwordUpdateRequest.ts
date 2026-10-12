
export class PasswordUpdateRequest {
    ID?: number;
    Password?: string;
    password_last_changed?: string | Date;
    /** Validate policy + password history only; don't change anything. */
    check_only?: boolean;
}
