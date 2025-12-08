export const TOKEN_HEADER = 'Authorization';
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_NOT_ALLOWED = 405;
export const CHROME = 'chrome';

/**********ROUTE CONSTANTS **************/
export const ROUTE_ACCOUNT_FORGOT_PASSWORD = '/account/forgot-password';
export const ROUTE_ACCOUNT_REGISTER = '/account/register';
export const ROUTE_ACCOUNT_LOGIN = '/account/login';
export const ROUTE_ACCOUNT_PROFILE = '/account/profile';
export const ROUTE_ACCOUNT_REGISTER_SUCCESS = '/account/register-success';
export const ROUTE_ACCOUNT_UNSUPPORTED_BROWSER = '/account/unsupported-browser';

export const ROUTE_ADMIN_DASHBOARD = '/user/admin-dashboard';
/*************END**************/

/**********PATTERN CONSTANTS **************/
export const EMAIL_PATTERN = '[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9\.]{1,253}$';
export const OTP_PATTERN = '^[0-9]{1,6}$';
export const YEAR_PATTERN = '^[0-9]{1,4}$';
export const NPI_PATTERN = '^[0-9]{10}$';
export const PASSWORD_MISMATCH_MESSAGE = 'Passwords are not matching.';
export const ONLY_NUMBERS_PATTERN = '^[0-9]*$';
export const LETTER_PATTERN_SPACE_HYPHEN = '^[a-zA-Z\- ]*$';
export const LETTER_WITH_SINGLE_QUOTE_PATTERN = '^[a-zA-Z\' ]*$';
export const LETTER_NUMBERS_SINGLE_QUOTE_UNDERSCORE_SPACE_PATTERN = '^[a-zA-Z0-9\'_ ]*$';
export const LETTER_NUMBERS_SINGLE_QUOTE_UNDERSCORE_PATTERN = '^[a-zA-Z0-9\'_]*$';
export const ONLY_LETTER_PATTERN = '^[a-zA-Z]+$';
export const ALPHA_NUM_PATTERN = '^[a-zA-Z0-9]*$';
export const DATE_PATTERN = '((0?[1-9]|1[012])[- /.](0?[1-9]|[12][0-9]|3[01])[- /.](19|20)?[0-9]{2})*$';
/*** END ******/

/****** CUSTOM VALIDATION MESSAGE************/
export const EMAIL_REQUIRED_MESSAGE = 'Email is required.';
export const PASSWORD_REQUIRED_MESSAGE = 'Password is required.';
export const EMAIL_PATTERN_MESSAGE = 'Enter valid email.';
export const OTP_PATTERN_MESSAGE = 'Enter 6 digit OTP.';
export const OTP_REQUIRED_MESSAGE = 'OTP is required.';
export const UNAUTHORIZED_LOGIN_MESSAGE = 'We are unable to find your email, please try to register.';
export const INCORRECT_PASSWORD_MESSAGE = 'Email or password is incorrect.';
export const USER_EXISTS_EXCEPTION_MESSAGE = 'A user with this email already exists.';
export const WRONG_PIN_ENTERED_MESSAGE = 'Wrong pin entered.';
export const PASSWORD_PATTERN_MESSAGE =
    `Password does not conform to policy minimum length 8 characters,
    should include numbers, special character, uppercase letters, lowercase letters.`;
export const CONFIRM_PASSWORD_REQUIRED_MESSAGE = 'Confirm password is required.';
export const PASSWORDS_NOT_MATCHED_MESSAGE = 'Passwords not matched.';
export const LIMIT_EXCEEDED_EXCEPTION_MESSAGE = 'OTP limit exceeded please try after sometime.';
export const PASSWORD_RESET_SUCCESSFULLY = 'Password changed successfully';
export const PASSWORD_MIN_LENGTH_MESSAGE = 'Password should be at least 8 characters.';
/************END*************/

/**** profile Personal validation messages***/
export const FIRST_NAME_REQUIRED_MESSAGE = 'First name is required.';
export const FIRST_NAME_PATTERN_MESSAGE = 'First name should only have alphabets,numbers, underscore, spaces and single quotes.';
export const FIRST_NAME_MIN_LENGTH_MESSAGE = 'First name should be at least 3 characters.';
export const FIRST_NAME_MAX_LENGTH_MESSAGE = 'First name should not be more than 30 characters.';
export const LAST_NAME_PATTERN_MESSAGE = 'Last name should only have alphabets,numbers, underscore and single quotes.';
export const LAST_NAME_MIN_LENGTH_MESSAGE = 'Last name should be at least 3 characters.';
export const LAST_NAME_MAX_LENGTH_MESSAGE = 'Last name should not be more than 30 characters.';
export const LAST_NAME_REQUIRED_MESSAGE = 'Last name is required.';
export const DOB_REQUIRED_MESSAGE = 'Date Of Birth is required.';
export const PHONE_REQUIRED_MESSAGE = 'Phone number is required.';
export const GENDER_REQUIRED_MESSAGE = 'Gender is required.';
export const DOB_PATTERN_MESSAGE = 'Enter valid date.';
export const PHONE_PATTERN_MESSAGE = 'Enter valid phone number.';
export const PROFILE_PICTURE_REQUIRED_MESSAGE = 'Profile picture is required';
export const PHONE_NUMBER_MIN_LENGTH_MESSAGE = 'Phone number should be 10 digit number.';
/********END **************/

/********Storage Key Constants */
export const USER_KEY = 'app_user';
export const USER_ID_KEY = 'USER_ID';
export const ORG_ID_KEY = 'ORG_ID';

export const USER_NAME_KEY = 'USER_NAME';
export const EMAIL_ID_KEY = 'EMAIL_ID';
export const USER_DATA = 'USER_DATA';
export const USER_DATA_KEY  = 'USER_DATA_KEY';
export const ORG_DATA_KEY  = 'ORG_DATA_KEY';

/*********Account Status Constants ************/

export const CONFIRMED = 'confirmed';
export const NOT_REGISTERED = 'not_registered';
export const UNCONFIRMED = 'unconfirmed';
export const UNKNOWN = 'unknown';
