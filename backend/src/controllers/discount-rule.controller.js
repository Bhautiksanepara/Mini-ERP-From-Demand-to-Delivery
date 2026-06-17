const discountRuleModel = require('../models/discount-rule.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');

const listDiscountRules = asyncHandler(async (req, res) => {
  const rules = await discountRuleModel.list();

  res.json({
    success: true,
    data: {
      discount_rules: rules
    }
  });
});

const updateDiscountRule = asyncHandler(async (req, res) => {
  const isAdmin = (req.user.roles || []).includes('admin');

  if (!isAdmin) {
    throw new AppError('Only administrators can update discount rules', 403);
  }

  const rule = await discountRuleModel.update(req.params.module_code, req.body);

  res.json({
    success: true,
    message: 'Discount rule updated successfully',
    data: {
      discount_rule: rule
    }
  });
});

module.exports = {
  listDiscountRules,
  updateDiscountRule
};
