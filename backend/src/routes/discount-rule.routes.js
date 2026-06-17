const express = require('express');

const discountRuleController = require('../controllers/discount-rule.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { updateDiscountRuleSchema } = require('../validators/discount-rule.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', discountRuleController.listDiscountRules);
router.patch(
  '/:module_code',
  validate(updateDiscountRuleSchema),
  discountRuleController.updateDiscountRule
);

module.exports = router;
