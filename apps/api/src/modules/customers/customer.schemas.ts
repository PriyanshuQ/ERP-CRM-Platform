import { z } from "zod";

const customerFields = {
  name: z.string().trim().min(2).max(160),
  company: z.string().trim().max(160).default(""),
  email: z.string().trim().email().or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  status: z.enum(["lead", "active", "inactive"]).default("lead")
};

export const createCustomerSchema = z.object(customerFields);
export const updateCustomerSchema = createCustomerSchema.partial();

export const customerListSchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["lead", "active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListInput = z.infer<typeof customerListSchema>;
