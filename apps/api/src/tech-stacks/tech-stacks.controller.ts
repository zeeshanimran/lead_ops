import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateTechStackDto } from './dto/create-tech-stack.dto';
import { UpdateTechStackDto } from './dto/update-tech-stack.dto';
import { TechStacksService } from './tech-stacks.service';

@ApiBearerAuth()
@ApiTags('tech stacks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tech-stacks')
export class TechStacksController {
  constructor(private readonly techStacks: TechStacksService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.BD)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.techStacks.findAll(user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTechStackDto) {
    return this.techStacks.create(user.sub, dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTechStackDto) {
    return this.techStacks.update(user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.techStacks.remove(user.sub, id);
  }
}
