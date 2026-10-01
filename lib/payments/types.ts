import type { PlanId } from "@/lib/billing/plans";

export type PaymentProviderId = "chariow" | "saspay";

export type PaymentProviderCapabilities = {
  hostedCheckout: boolean;
  paymentLinks: boolean;
  cancelCheckout: boolean;
  signedWebhooks: boolean;
  recurringSubscriptions: boolean;
  softPay: boolean;
  connectedMerchants: boolean;
};

export type CreateCheckoutInput = {
  paymentId: string;
  userId: string;
  planId: PlanId;
  planName: string;
  amountMinor: number;
  currency: "XOF";
  customerEmail: string;
  customerName: string;
  returnUrl: string;
};

export type CreatedCheckout = {
  id: string;
  checkoutUrl: string;
  status: string;
  expiresAt: string | null;
};

export type CheckoutPaymentStatus = {
  checkoutId: string;
  status: string;
  transactionId: string | null;
  transactionStatus: string | null;
  transactionReference: string | null;
};

export type VerifiedPayment = {
  id: string;
  reference: string | null;
  merchantId: string | null;
  description: string;
  requestedAmount: string;
  currency: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PaymentProvider = {
  readonly id: PaymentProviderId;
  readonly capabilities: PaymentProviderCapabilities;
  createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout>;
  getCheckoutStatus(checkoutId: string): Promise<CheckoutPaymentStatus>;
  verifyPayment(paymentId: string): Promise<VerifiedPayment>;
  cancelCheckout(checkoutId: string): Promise<void>;
};
