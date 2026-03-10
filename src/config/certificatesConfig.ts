import platformAdmin from '../assets/certificates/platform-admin.png';
import platformAppBuilder from '../assets/certificates/platform-app-builder.png';
import experienceCloud from '../assets/certificates/experience-cloud.png';
import salesCloud from '../assets/certificates/sales-cloud.png';
import pardotSpecialist from '../assets/certificates/pardot-specialist.png';
import dataCloud from '../assets/certificates/data-cloud.png';
import platformDataArchitect from '../assets/certificates/platform-data-architect.png';
import sharingVisibilityArchitect from '../assets/certificates/sharing-visibility-architect.png';

export interface Certificate {
  id: CertKey;
  name: string;
  image: string;
}

export type CertKey =
  | 'platformAdmin'
  | 'platformAppBuilder'
  | 'experienceCloud'
  | 'salesCloud'
  | 'pardotSpecialist'
  | 'dataCloud'
  | 'platformDataArchitect'
  | 'sharingVisibilityArchitect';

export const certFullNames: Record<CertKey, string> = {
  platformAdmin: 'Salesforce Certified Administrator',
  platformAppBuilder: 'Salesforce Certified Platform App Builder',
  experienceCloud: 'Salesforce Certified Experience Cloud Consultant',
  salesCloud: 'Salesforce Certified Sales Cloud Consultant',
  pardotSpecialist: 'Salesforce Certified Marketing Cloud Account Engagement Specialist',
  dataCloud: 'Salesforce Certified Data Cloud Consultant',
  platformDataArchitect: 'Salesforce Certified Platform Data Architect',
  sharingVisibilityArchitect: 'Salesforce Certified Sharing and Visibility Architect',
};

export const certificatesConfig: Record<CertKey, Certificate> = {
  platformAdmin: {
    id: 'platformAdmin',
    name: 'Platform Administrator',
    image: platformAdmin,
  },
  platformAppBuilder: {
    id: 'platformAppBuilder',
    name: 'Platform App Builder',
    image: platformAppBuilder,
  },
  experienceCloud: {
    id: 'experienceCloud',
    name: 'Experience Cloud Consultant',
    image: experienceCloud,
  },
  salesCloud: {
    id: 'salesCloud',
    name: 'Sales Cloud Consultant',
    image: salesCloud,
  },
  pardotSpecialist: {
    id: 'pardotSpecialist',
    name: 'Pardot Specialist',
    image: pardotSpecialist,
  },
  dataCloud: {
    id: 'dataCloud',
    name: 'Data Cloud Consultant',
    image: dataCloud,
  },
  platformDataArchitect: {
    id: 'platformDataArchitect',
    name: 'Platform Data Architect',
    image: platformDataArchitect,
  },
  sharingVisibilityArchitect: {
    id: 'sharingVisibilityArchitect',
    name: 'Sharing and Visibility Architect',
    image: sharingVisibilityArchitect,
  },
};
