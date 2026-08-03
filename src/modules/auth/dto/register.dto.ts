import { IsBoolean, IsDateString, IsEmail, IsIn, IsOptional, IsStrongPassword, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  })
  password: string;

  @IsString()
  @MinLength(2)
  full_name: string;

  @IsIn(['client', 'artisan', 'freelancer'])
  role: 'client' | 'artisan' | 'freelancer';

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  country_of_residence?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  referral_code?: string;

  @IsOptional()
  @IsString()
  preferred_contact_method?: string;

  @IsOptional()
  @IsBoolean()
  marketing_opt_in?: boolean;

  /** Gate, not data — the signup UI requires this box checked before submit is even reachable. */
  @IsIn([true])
  accepted_terms: true;
}
