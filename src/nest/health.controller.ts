import { Controller, Get } from "@nestjs/common";
import { InjectDb, type DatabaseService } from "./database.module";

@Controller("api")
export class HealthController {
  constructor(@InjectDb() private readonly db: DatabaseService) {}

  @Get("health")
  async health(): Promise<{ ok: true }> {
    await this.db.ping();
    return { ok: true };
  }
}
