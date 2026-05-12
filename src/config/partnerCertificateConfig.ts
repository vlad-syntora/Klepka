import salesforcePartnerBadgeHorizontal from '../assets/Salesforce Partner Badge_Square.png';

export interface PartnerCertificate {
  id: PartnerCertificateKey;
  name: string;
  image: string;
}

export type PartnerCertificateKey = 'salesforceConsultingPartner';

export const partnerCertificateConfig: Record<PartnerCertificateKey, PartnerCertificate> = {
  salesforceConsultingPartner: {
    id: 'salesforceConsultingPartner',
    name: 'Salesforce Consulting Partner',
    image: salesforcePartnerBadgeHorizontal,
  },
};
