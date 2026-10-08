import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { checkCategoryMove, MAX_CATEGORY_NAME } from "../../categoryMove";
import { deleteCategory, getCategoryUsage, listExpenseCategories } from "../../db/categories";
import type { WebAppUser } from "../../telegramAuth";
import { TelegramAuthGuard, WebUser } from "./auth.guard";

@Controller("api/categories")
@UseGuards(TelegramAuthGuard)
export class CategoriesController {
  @Get()
  async list(@WebUser() user: WebAppUser) {
    return { categories: await listExpenseCategories(user.id) };
  }

  /** How much depends on a category — the UI uses it to decide whether a target must be asked for. */
  @Get("usage")
  async usage(@WebUser() user: WebAppUser, @Query("name") name?: string) {
    const category = (name ?? "").trim();
    if (!category || category.length > MAX_CATEGORY_NAME) throw new BadRequestException("invalid category");
    return getCategoryUsage(user.id, category);
  }

  /**
   * Deletes a category. If it has operations, `moveTo` (an existing OR a new category name) is
   * required and everything is moved there first; the server re-checks usage itself, so a stale
   * client can never delete a used category without a target.
   */
  @Post("delete")
  async remove(@WebUser() user: WebAppUser, @Body() body: Record<string, unknown>) {
    const category = typeof body.category === "string" ? body.category.trim() : "";
    if (!category || category.length > MAX_CATEGORY_NAME) throw new BadRequestException("invalid_from");
    const usage = await getCategoryUsage(user.id, category);
    const check = checkCategoryMove(category, body.moveTo, usage.transactions);
    if (!check.ok) throw new BadRequestException(check.reason);
    return deleteCategory(user.id, category, check.moveTo);
  }
}
