import salesforcePartnerBadgeHorizontal from '../assets/Salesforce Partner Badge_Square.png';
import salesforceAgentExchangeBadgeHorizontal from '../assets/Available on AgentExchange_Square.png';


export interface PartnerCertificate {
  id: PartnerCertificateKey;
  name: string;
  image: string;
}

export type PartnerCertificateKey = 'salesforceConsultingPartner' | 'salesforceAgentExchangePartner';

export const partnerCertificateConfig: Record<PartnerCertificateKey, PartnerCertificate> = {
  salesforceConsultingPartner: {
    id: 'salesforceConsultingPartner',
    name: 'Salesforce Consulting Partner',
    image: salesforcePartnerBadgeHorizontal,
  },
  salesforceAgentExchangePartner: {
    id: 'salesforceAgentExchangePartner',
    name: 'Salesforce Agent Exchange Partner',
    image: salesforceAgentExchangeBadgeHorizontal,
  },

};
