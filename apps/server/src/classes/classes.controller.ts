import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Class HTTP endpoints.
 *
 * - GET /classes     — all classes (browse page dropdown).
 * - GET /classes/:id — single class.
 */
@Controller('classes')
@UseGuards(JwtAuthGuard)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  findAll() {
    return this.classes.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.classes.findOne(id);
  }
}
