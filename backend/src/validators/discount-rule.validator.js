const { z } = require('zod');

const updateDiscountRuleSchema = z.object({
  body: z.object({
    threshold_amount: z.coerce.number().nonnegative().optional(),
    discount_amount: z.coerce.number().nonnegative().optional(),
    is_active: z.coerce.boolean().optional()
  }),
  params: z.object({
    module_code: z.enum(['sales_order', 'purchase_order'])
  }),
  query: z.object({}).optional()
});

module.exports = {
  updateDiscountRuleSchema
};
