import { z } from "zod";

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(160),
  company: z.string().trim().max(160),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  phone: z.string().trim().max(40),
  status: z.enum(["lead", "active", "inactive"])
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export type Customer = CustomerFormValues & {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

export type CustomerListResponse = {
  data: Customer[];
  total: number;
  page: number;
  pageSize: number;
};
