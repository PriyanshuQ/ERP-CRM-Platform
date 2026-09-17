import { supabase } from "../../lib/supabase";
import type { CustomerFormValues, CustomerListResponse } from "./customer.validation";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function authenticatedRequest(path: string, options: RequestInit = {}) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("You must be signed in");

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`);
  }
  return response;
}

export async function listCustomers(search = "") {
  const query = new URLSearchParams({ page: "1", pageSize: "50" });
  if (search) query.set("search", search);
  const response = await authenticatedRequest(`/api/v1/customers?${query}`);
  return response.json() as Promise<CustomerListResponse>;
}

export async function createCustomer(input: CustomerFormValues, organizationId: string) {
  const response = await authenticatedRequest("/api/v1/customers", {
    method: "POST",
    headers: { "x-organization-id": organizationId },
    body: JSON.stringify(input)
  });
  return response.json();
}
