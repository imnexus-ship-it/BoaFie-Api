import { IsEmail, IsIn, IsOptional, IsStrongPassword, IsString, MinLength } from 'class-validator';

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
}
