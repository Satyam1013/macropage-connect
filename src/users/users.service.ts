import { Injectable, ConflictException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { SignupDto } from "../auth/dto/signup.dto";
import { UserPayload } from "../auth/dto/auth-response.interface";
import { User, UserDocument } from "./schemas/user.schema";

export type { UserDocument };

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(dto: SignupDto): Promise<UserDocument> {
    const exists = await this.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException("Email already registered");
    }

    const hashed = await bcrypt.hash(dto.password, 12);

    const user = new this.userModel({
      name: dto.name,
      email: dto.email,
      password: hashed,
      phone: dto.phone,
      company: dto.company,
      role: dto.role ?? "user",
      trialEndsAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      marketingOptIn: dto.marketingOptIn ?? false,
    });

    return user.save();
  }

  validatePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  toPublicProfile(user: UserDocument): UserPayload {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      whatsappSetupDone: user.whatsappSetupDone,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
