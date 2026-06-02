import { Injectable, ConflictException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { SignupDto } from "../auth/dto/signup.dto";
import { UserPayload } from "../auth/dto/auth-response.interface";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  company?: string;
  role: string;
  emailVerified: boolean;
  whatsappSetupDone: boolean;
  plan: "FREE" | "PRO";
  trialEndsAt: string;
  marketingOptIn: boolean;
  createdAt: string;
}

@Injectable()
export class UsersService {
  // ⚠️  In-memory store — replace with TypeORM/Prisma DB in production
  private users: User[] = [];

  findByEmail(email: string): User | undefined {
    return this.users.find((u) => u.email === email);
  }

  findById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  async create(dto: SignupDto): Promise<User> {
    const exists = this.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException("Email already registered");
    }

    const hashed = await bcrypt.hash(dto.password, 12);

    const user: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: dto.name,
      email: dto.email,
      password: hashed,
      phone: dto.phone,
      company: dto.company,
      role: dto.role ?? "user",
      emailVerified: false,
      whatsappSetupDone: false,
      plan: "FREE",
      trialEndsAt: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      marketingOptIn: dto.marketingOptIn ?? false,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);
    return user;
  }

  async validatePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  toPublicProfile(user: User): UserPayload {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      whatsappSetupDone: user.whatsappSetupDone,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt,
      createdAt: user.createdAt,
    };
  }
}
