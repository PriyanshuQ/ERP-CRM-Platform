import { Router } from "express";
import { requireAuth } from "../../auth.js";
import { createCustomerSchema, customerListSchema, updateCustomerSchema } from "./customer.schemas.js";
import { createCustomer, deleteCustomer, listCustomers, updateCustomer } from "./customer.service.js";

export const customerRouter = Router();
customerRouter.use(requireAuth);

customerRouter.get("/", async (request, response, next) => {
  try {
    const input = customerListSchema.parse(request.query);
    const result = await listCustomers(request.supabase!, input);
    response.json(result);
  } catch (error) { next(error); }
});

customerRouter.post("/", async (request, response, next) => {
  try {
    const organizationId = request.header("x-organization-id");
    if (!organizationId) {
      response.status(400).json({ error: { code: "ORGANIZATION_REQUIRED", message: "x-organization-id header is required" } });
      return;
    }
    const input = createCustomerSchema.parse(request.body);
    const customer = await createCustomer(request.supabase!, request.authUser!.id, organizationId, input);
    response.status(201).json({ data: customer });
  } catch (error) { next(error); }
});

customerRouter.patch("/:customerId", async (request, response, next) => {
  try {
    const input = updateCustomerSchema.parse(request.body);
    const customer = await updateCustomer(request.supabase!, request.params.customerId, input);
    response.json({ data: customer });
  } catch (error) { next(error); }
});

customerRouter.delete("/:customerId", async (request, response, next) => {
  try {
    await deleteCustomer(request.supabase!, request.params.customerId);
    response.status(204).send();
  } catch (error) { next(error); }
});
