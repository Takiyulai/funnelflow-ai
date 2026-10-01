import type {
  PaymentProviderCapabilities,
  PaymentProviderId,
} from "@/lib/payments/types";

/**
 * Registre de capacités commun aux interfaces et au backend.
 *
 * Chariow conserve son parcours historique par lien + clé de licence. SasPay
 * ajoute un checkout hébergé piloté par le backend. Les capacités non
 * confirmées restent explicitement désactivées au lieu d'être simulées.
 */
export const PAYMENT_PROVIDER_CAPABILITIES: Record<
  PaymentProviderId,
  PaymentProviderCapabilities
> = {
  chariow: {
    hostedCheckout: false,
    paymentLinks: true,
    cancelCheckout: false,
    signedWebhooks: false,
    recurringSubscriptions: false,
    softPay: false,
    connectedMerchants: false,
  },
  saspay: {
    hostedCheckout: true,
    paymentLinks: true,
    cancelCheckout: true,
    signedWebhooks: true,
    recurringSubscriptions: false,
    // La documentation publique hésite entre /softpay/ et
    // /softpay/initialize/. Aucun appel n'est autorisé tant que SasPay n'a
    // pas confirmé le chemin canonique.
    softPay: false,
    connectedMerchants: false,
  },
};

export function providerSupports(
  provider: PaymentProviderId,
  capability: keyof PaymentProviderCapabilities,
): boolean {
  return PAYMENT_PROVIDER_CAPABILITIES[provider][capability];
}
