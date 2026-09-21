import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateCustomerInput, CustomerListInput, UpdateCustomerInput } from "./customer.schemas.js";

type CustomerClient = SupabaseClient;

const throwDatabaseError = (error: { message: string; code?: string }): never => {
  const databaseError = new Error(error.message) as Error & { statusCode?: number; code?: string };
  databaseError.statusCode = error.code === "23505" ? 409 : 400;
  databaseError.code = error.code;
  throw databaseError;
};

export async function listCustomers(client: CustomerClient, input: CustomerListInput) {
  const from = (input.page - 1) * input.pageSize;
  const safeSearch = input.search.replace(/[%,()]/g, "");
  let query = client.from("customers").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + input.pageSize - 1);
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,company.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  if (input.status) query = query.eq("status", input.status);

  const { data, count, error } = await query;
  if (error) throwDatabaseError(error);
  return { data: data ?? [], total: count ?? 0, page: input.page, pageSize: input.pageSize };
}

export async function createCustomer(client: CustomerClient, userId: string, organizationId: string, input: CreateCustomerInput) {
  const { data, error } = await client.from("customers").insert({ ...input, organization_id: organizationId, created_by: userId }).select().single();
  if (error) throwDatabaseError(error);
  return data;
}

export async function updateCustomer(client: CustomerClient, customerId: string, input: UpdateCustomerInput) {
  const { data, error } = await client.from("customers").update(input).eq("id", customerId).select().single();
  if (error) throwDatabaseError(error);
  return data;
}

export async function deleteCustomer(client: CustomerClient, customerId: string) {
  const { error } = await client.from("customers").delete().eq("id", customerId);
  if (error) throwDatabaseError(error);
}
