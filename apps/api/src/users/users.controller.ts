import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BD, Role.CLOSER)
  findAll(@CurrentUser() actor: AuthenticatedUser, @Query('role') role?: Role) {
    if (!role) {
      throw new BadRequestException('A role filter is required. Use role=BD or role=CLOSER.');
    }
    if (role !== Role.BD && role !== Role.CLOSER) {
      throw new BadRequestException('Only BD and Closer user lists are available.');
    }
    if ((actor.role === Role.CLOSER || actor.role === Role.BD) && role !== Role.CLOSER) {
      throw new ForbiddenException('This role can only list closers');
    }
    return this.users.findAll(role);
  }

  @Get('me')
  @Roles(Role.SUPER_ADMIN, Role.BD, Role.CLOSER)
  findMe(@CurrentUser() actor: AuthenticatedUser) {
    return this.users.findMe(actor.sub);
  }

  @Patch('me')
  @Roles(Role.SUPER_ADMIN, Role.BD, Role.CLOSER)
  updateProfile(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(actor.sub, dto);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.users.create(actor.sub, dto);
  }

  @Post(':id/resend-invite')
  @Roles(Role.SUPER_ADMIN)
  resendInvite(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.users.resendInvite(actor.sub, id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(actor.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.users.remove(actor.sub, id);
  }
}
