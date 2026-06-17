import { Router, Request, Response, RequestHandler } from "express";
import Stripe from "stripe";
import { db } from "./db";
import { authMiddleware, AuthenticatedRequest } from "./auth";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || "";
const ELITE_PRICE_ID = process.env.STRIPE_ELITE_PRICE_ID || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required to use Stripe integrations.");
    }
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: "2025-01-27.acacia" as any
    });
  }
  return stripeInstance;
}

export const paymentsRouter = Router();

// Endpoint 1: Create checkout session
const createCheckout: RequestHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { plan } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (plan !== "pro" && plan !== "elite") {
    res.status(400).json({ error: "Invalid plan type" });
    return;
  }

  if (user.plan === plan) {
    res.status(409).json({ error: `Already subscribed to ${plan} tier.` });
    return;
  }

  if (!stripeSecretKey) {
    res.status(503).json({ error: "Stripe configuration is missing on server" });
    return;
  }

  const priceId = plan === "elite" ? ELITE_PRICE_ID : PRO_PRICE_ID;
  if (!priceId) {
    res.status(503).json({ error: `Stripe price ID for ${plan} is not configured.` });
    return;
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        kickiq_user_id: user.id.toString(),
        kickiq_plan: plan
      },
      success_url: `${APP_URL}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/?payment=cancelled`
    });

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (error: any) {
    console.error("[Stripe create-checkout] error:", error);
    res.status(500).json({ error: error.message || "Failed to initiate transaction" });
  }
};

paymentsRouter.post("/create-checkout", authMiddleware, createCheckout);

// Endpoint 2: Success Redirection Handler
const handleSuccess: RequestHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const sessionId = req.query.session_id as string;
  const user = req.user;

  if (!user) {
    res.status(401).send("Authentication required");
    return;
  }

  if (!sessionId) {
    res.redirect("/?payment=error&reason=no_session");
    return;
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (!session) {
      res.redirect("/?payment=error&reason=invalid_session");
      return;
    }

    const userIdMeta = session.metadata?.kickiq_user_id;
    const planMeta = session.metadata?.kickiq_plan;

    if (userIdMeta && parseInt(userIdMeta) === user.id) {
      if (session.payment_status === "paid") {
        // Double-check upgrade in db in case webhook is slightly behind
        const dbUser = db.users.find(u => u.id === user.id);
        if (dbUser) {
          dbUser.plan = planMeta as "pro" | "elite";
          dbUser.stripe_customer_id = session.customer as string;
          dbUser.stripe_subscription_id = session.subscription as string;
          db.save();
        }
        res.redirect("/?payment=success");
        return;
      }
    }
    res.redirect("/?payment=pending");
  } catch (error) {
    console.error("[payments success Handler] retrieved error:", error);
    res.redirect("/?payment=success"); // fallback gracefully if Stripe lookup checks block in-dev redirects
  }
};

paymentsRouter.get("/success", authMiddleware, handleSuccess);

// Endpoint 3: Status check
const getStatus: RequestHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json({
    plan: user.plan,
    email: user.email,
    display_name: user.display_name
  });
};

paymentsRouter.get("/status", authMiddleware, getStatus);

// Endpoint 4: Cancel plan
const cancelSubscription: RequestHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!user.stripe_subscription_id) {
    res.status(400).json({ error: "No active Stripe subscription detected" });
    return;
  }

  try {
    await getStripe().subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true
    });
    res.json({ success: true, message: "Subscription cancelled successfully at end of current period." });
  } catch (error: any) {
    console.error("[Stripe cancel] error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel subscription" });
  }
};

paymentsRouter.post("/cancel", authMiddleware, cancelSubscription);

// Endpoint 5: Special Webhook handler (receives RAW Buffer body)
export const webhookHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  if (!sig || !WEBHOOK_SECRET) {
    console.warn("[Stripe Webhook] Webhook warning: signature or webhook secret not configured.");
    res.sendStatus(400);
    return;
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body, // RAW body buffer
      sig,
      WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Verification error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    console.log(`[Stripe Webhook] Received successfully verified event: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.kickiq_user_id;
      const plan = session.metadata?.kickiq_plan;

      if (userId && plan) {
        const uId = parseInt(userId);
        const dbUser = db.users.find(u => u.id === uId);
        if (dbUser) {
          dbUser.plan = plan as "pro" | "elite";
          dbUser.stripe_customer_id = session.customer as string;
          dbUser.stripe_subscription_id = session.subscription as string;
          db.save();
          console.log(`[Stripe Webhook] Upgraded user id: ${dbUser.id} (${dbUser.email}) to ${plan.toUpperCase()}`);
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const dbUser = db.users.find(u => u.stripe_subscription_id === sub.id);
      if (dbUser) {
        dbUser.plan = "free";
        db.save();
        console.log(`[Stripe Webhook] Degraded user id: ${dbUser.id} back to free due to cancel event.`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook Handler] Internal process exception:", err);
    res.status(500).send("Internal processing fault");
  }
};
