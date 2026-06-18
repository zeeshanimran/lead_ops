import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: [Role.BD, Role.CLOSER] })
  @IsIn([Role.BD, Role.CLOSER])
  role!: Extract<Role, 'BD' | 'CLOSER'>;
}
