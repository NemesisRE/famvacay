import { env } from '@/lib/env';

export interface LegalConfig {
  operationMode: 'private' | 'commercial';
  operatorName: string;
  operatorStreet: string;
  operatorPostalCity: string;
  operatorCountry: string;
  contactEmail: string;
  contactPhone?: string;
  vatId?: string;
  hostingProviderName: string;
  hostingProviderAddress: string;
  dpaConcluded: boolean;
}

/** Server-only: operator/hosting details for /imprint and /privacy, driven entirely by env vars. */
export function getLegalConfig(): LegalConfig {
  return {
    operationMode: env.LEGAL_OPERATION_MODE,
    operatorName: env.LEGAL_OPERATOR_NAME,
    operatorStreet: env.LEGAL_OPERATOR_STREET,
    operatorPostalCity: env.LEGAL_OPERATOR_POSTAL_CITY,
    operatorCountry: env.LEGAL_OPERATOR_COUNTRY,
    contactEmail: env.LEGAL_CONTACT_EMAIL,
    contactPhone: env.LEGAL_CONTACT_PHONE,
    vatId: env.LEGAL_VAT_ID,
    hostingProviderName: env.LEGAL_HOSTING_PROVIDER_NAME,
    hostingProviderAddress: env.LEGAL_HOSTING_PROVIDER_ADDRESS,
    dpaConcluded: env.LEGAL_DPA_CONCLUDED,
  };
}
