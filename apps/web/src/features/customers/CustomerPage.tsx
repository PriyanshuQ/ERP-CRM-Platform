import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "../../lib/supabase";
import { createCustomer, listCustomers } from "./customers.api";
import { customerFormSchema, type CustomerFormValues } from "./customer.validation";

const initialValues: CustomerFormValues = { name: "", company: "", email: "", phone: "", status: "lead" };

export function CustomerPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const form = useForm<CustomerFormValues>({ resolver: zodResolver(customerFormSchema), defaultValues: initialValues });
  const customersQuery = useQuery({ queryKey: ["customers", search], queryFn: () => listCustomers(search) });
  const mutation = useMutation({
    mutationFn: async (input: CustomerFormValues) => {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data, error } = await supabase.from("organizations").select("id").limit(1).single();
      if (error) throw error;
      return createCustomer(input, data.id);
    },
    onSuccess: async () => {
      form.reset(initialValues);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <main className="workspace shell">
      <div className="workspace-header">
        <div><p className="eyebrow">Phase 3 · Customer management</p><h1>Customers</h1></div>
        <span className="module-badge">Organization-scoped</span>
      </div>
      <section className="customer-grid">
        <form className="customer-form" onSubmit={submit}>
          <h2>Add customer</h2>
          <label>Name<input {...form.register("name")} />{form.formState.errors.name && <small>{form.formState.errors.name.message}</small>}</label>
          <label>Company<input {...form.register("company")} /></label>
          <label>Email<input type="email" {...form.register("email")} />{form.formState.errors.email && <small>{form.formState.errors.email.message}</small>}</label>
          <label>Phone<input {...form.register("phone")} /></label>
          <label>Status<select {...form.register("status")}><option value="lead">Lead</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save customer"}</button>
          {mutation.isError && <p className="form-message">{mutation.error.message}</p>}
        </form>
        <section className="customer-list">
          <div className="list-header"><h2>Customer directory</h2><input aria-label="Search customers" placeholder="Search…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {customersQuery.isPending && <p className="muted">Loading customers…</p>}
          {customersQuery.isError && <p className="form-message">{customersQuery.error.message}</p>}
          {customersQuery.data?.data.length === 0 && <p className="muted">No customers yet. Add your first customer.</p>}
          <div className="customer-items">{customersQuery.data?.data.map((customer) => <article className="customer-item" key={customer.id}><div><strong>{customer.name}</strong><p>{customer.company || "No company"} · {customer.email || "No email"}</p></div><span className={`customer-status ${customer.status}`}>{customer.status}</span></article>)}</div>
        </section>
      </section>
    </main>
  );
}
