import { Router, Response } from 'express';
import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../../utils/logger';
import { SubscriptionService } from '../../services/subscription.service';

const router = Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const PLAN_PRICING: Record<string, Record<string, number>> = {
  'Free': { NGN: 0, USD: 0, KES: 0, GHS: 0, ZAR: 0, UGX: 0, XOF: 0 },
  'Starter': { NGN: 15000, USD: 35, KES: 5500, GHS: 300, ZAR: 650, UGX: 130000, XOF: 21000 },
  'Professional': { NGN: 35000, USD: 75, KES: 13000, GHS: 650, ZAR: 1500, UGX: 290000, XOF: 46000 },
  'Enterprise': { NGN: 0, USD: 0, KES: 0, GHS: 0, ZAR: 0, UGX: 0, XOF: 0 }
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', KES: 'KSh', GHS: '₵', ZAR: 'R', UGX: 'USh', XOF: 'CFA'
};

// Simplified paths as they are mounted under /api/payment
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School not found' });
    }

    const school = await new Promise<any>((resolve, reject) => {
      db.getDB().get(
        `SELECT subscription_plan, subscription_status, subscription_start_date, 
                subscription_end_date, preferred_currency, name 
         FROM schools WHERE id = ?`,
        [schoolId],
        (err: any, row: any) => err ? reject(err) : resolve(row)
      );
    });

    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' });
    }

    const currency = school.preferred_currency || 'NGN';
    const currentPlan = school.subscription_plan || 'Free';
    
    const subscription = {
      plan: currentPlan,
      status: school.subscription_status || 'active',
      startDate: school.subscription_start_date,
      endDate: school.subscription_end_date,
      currency: currency,
      currencySymbol: CURRENCY_SYMBOLS[currency] || currency,
      price: PLAN_PRICING[currentPlan]?.[currency] || 0
    };

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error({ error }, 'Failed to get subscription status');
    res.status(500).json({ success: false, error: 'Failed to get subscription status' });
  }
});

router.post('/currency', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId;
    const { currency } = req.body;

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School not found' });
    }

    if (!CURRENCY_SYMBOLS[currency]) {
      return res.status(400).json({ success: false, error: 'Invalid currency' });
    }

    await new Promise<void>((resolve, reject) => {
      db.getDB().run(
        `UPDATE schools SET preferred_currency = ? WHERE id = ?`,
        [currency, schoolId],
        (err: any) => err ? reject(err) : resolve()
      );
    });

    res.json({ success: true, message: 'Currency updated', currency });
  } catch (error) {
    logger.error({ error }, 'Failed to update currency');
    res.status(500).json({ success: false, error: 'Failed to update currency' });
  }
});

router.get('/plans', async (req: AuthRequest, res: Response) => {
  try {
    const currency = req.query.currency as string || 'NGN';
    const validCurrency = CURRENCY_SYMBOLS[currency] ? currency : 'NGN';

    const plans = Object.entries(PLAN_PRICING).map(([name, prices]) => ({
      name,
      price: prices[validCurrency] || 0,
      currency: validCurrency,
      currencySymbol: CURRENCY_SYMBOLS[validCurrency],
      termMonths: name === 'Free' ? 0 : 3
    }));

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error({ error }, 'Failed to get plans');
    res.status(500).json({ success: false, error: 'Failed to get plans' });
  }
});

router.post('/initialize', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId;
    const { plan, currency } = req.body;

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School not found' });
    }

    if (!plan || !PLAN_PRICING[plan]) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    const validCurrency = CURRENCY_SYMBOLS[currency] ? currency : 'NGN';
    const amount = PLAN_PRICING[plan][validCurrency];

    if (amount === 0 || amount === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: plan === 'Free' ? 'Free plan does not require payment' : 'Invalid amount' 
      });
    }

    const school = await new Promise<any>((resolve, reject) => {
      db.getDB().get(
        `SELECT name, admin_phone FROM schools WHERE id = ?`,
        [schoolId],
        (err: any, row: any) => err ? reject(err) : resolve(row)
      );
    });

    const paymentId = uuidv4();
    const amountInKobo = Math.round(amount * 100);

    // Paystack Initialize
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: school.admin_phone + '@kumo.school',
        amount: amountInKobo,
        currency: validCurrency,
        callback_url: `${FRONTEND_URL}/recharge?status=success&payment_id=${paymentId}`,
        metadata: {
          school_id: schoolId,
          plan_name: plan,
          term_months: 3,
          payment_id: paymentId,
          school_name: school.name
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { authorization_url, reference } = paystackResponse.data.data;

    await new Promise<void>((resolve, reject) => {
      db.getDB().run(
        `INSERT INTO subscription_payments 
         (id, school_id, amount, currency, plan_name, term_months, transaction_ref, payment_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [paymentId, schoolId, amount, validCurrency, plan, 3, reference],
        (err: any) => err ? reject(err) : resolve()
      );
    });

    res.json({
      success: true,
      data: {
        paymentId,
        reference,
        authorizationUrl: authorization_url,
        amount,
        currency: validCurrency,
        currencySymbol: CURRENCY_SYMBOLS[validCurrency],
        plan,
        schoolName: school.name
      }
    });
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, 'Failed to initialize payment');
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || 'Failed to initialize payment' 
    });
  }
});

router.get('/verify/:reference', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { reference } = req.params;
    const schoolId = req.user?.schoolId;

    const payment = await new Promise<any>((resolve, reject) => {
      db.getDB().get(
        `SELECT * FROM subscription_payments WHERE transaction_ref = ? AND school_id = ?`,
        [reference, schoolId],
        (err: any, row: any) => err ? reject(err) : resolve(row)
      );
    });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (payment.payment_status === 'success') {
      return res.json({ success: true, data: { status: 'success', payment } });
    }

    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
      }
    );

    const { status, amount, currency } = paystackResponse.data.data;

    if (status === 'success') {
      const amountInMajor = amount / 100;
      
      await SubscriptionService.handlePaymentSuccess(
        reference,
        schoolId!,
        payment.plan_name,
        payment.term_months || 3
      );

      return res.json({ 
        success: true, 
        data: { 
          status: 'success', 
          plan: payment.plan_name,
          amount: amountInMajor,
          currency 
        } 
      });
    }

    res.json({ success: true, data: { status: payment.payment_status } });
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, 'Failed to verify payment');
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.user?.schoolId;

    const payments = await new Promise<any[]>((resolve, reject) => {
      db.getDB().all(
        `SELECT id, amount, currency, plan_name, payment_status, paid_at, created_at
         FROM subscription_payments 
         WHERE school_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
        [schoolId],
        (err: any, rows: any) => err ? reject(err) : resolve(rows || [])
      );
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    logger.error({ error }, 'Failed to get payment history');
    res.status(500).json({ success: false, error: 'Failed to get payment history' });
  }
});

export default router;
