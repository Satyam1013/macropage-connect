import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  DemoRequest,
  DemoRequestDocument,
} from "../schemas/demo-request.schema";
import { CreateDemoRequestDto } from "./dto/create-demo-request.dto";

@Injectable()
export class DemoRequestsService {
  constructor(
    @InjectModel(DemoRequest.name)
    private readonly demoRequestModel: Model<DemoRequestDocument>,
  ) {}

  create(
    tenantId: string,
    user: { id: string; name: string; email: string },
    dto: CreateDemoRequestDto,
  ) {
    return this.demoRequestModel.create({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      phone: dto.phone,
      message: dto.message,
    });
  }
}
