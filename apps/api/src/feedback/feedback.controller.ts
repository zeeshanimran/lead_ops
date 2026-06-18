import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiBearerAuth()
@ApiTags('feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.CLOSER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.feedback.findAll(user);
  }

  @Post()
  @Roles(Role.CLOSER)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(user, dto);
  }
}
