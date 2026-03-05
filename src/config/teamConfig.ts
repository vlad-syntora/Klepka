import type { CertKey } from './certificatesConfig';
import sergiiAvatar from '../assets/team/sergii-romashov.png';
import dariaAvatar from '../assets/team/daria-ezerovych.png';
import marinaAvatar from '../assets/team/marina-penkova.png';

export interface Founder {
  name: string;
  slug: string;
  title: string;
  description: string;
  shortBio: string;
  startDate: string;
  company: string;
  certs: CertKey[];
  avatar?: string;
  contactInfo: {
    phone: string;
    email: string;
    linkedin: string;
  };
}

export interface TeamMember {
  name: string;
  description: string;
  startDate: string;
  certs?: CertKey[];
  avatar?: string;
}

export interface Team {
  title: string;
  members: TeamMember[];
}

export const foundersConfig: Founder[] = [
  {
    name: 'Sergii Romashov',
    slug: 'sergii-romashov',
    title: 'CEO',
    company: 'Klepka',
    shortBio: 'Salesforce Architect & Consultant\n\nDesigns scalable end-to-end Salesforce solutions across Sales, Service, and Experience Cloud.\n\nLeads teams, drives integrations, and ensures efficient, adoption-focused CRM delivery.',
    description: 'A Salesforce specialist with experience in analysis, architecture, and implementation, combining strong technical expertise with a deep functional understanding of business processes.\n\nExtensive experience designing and delivering scalable end-to-end Salesforce solutions, including complex integrations with third-party systems. Core expertise spans Sales Cloud, Service Cloud, and Experience Cloud, with a focus on building efficient, high-performing, and sustainable CRM environments.\n\nLeadership experience includes building and leading Salesforce Administrator teams, mentoring professionals, and conducting internal training initiatives to strengthen organizational expertise.\n\nKnown for an analytical mindset and clear communication style, with a consistent focus on operational efficiency, user adoption, and effective cross-functional collaboration to ensure long-term platform success.',
    startDate: '2018-01-08',
    certs: ['platformAdmin', 'salesCloud', 'pardotSpecialist'],
    avatar: sergiiAvatar,
    contactInfo: {
      phone: '+38 (093) 067-87-54',
      email: 'sergii.romashov@klepka.solutions',
      linkedin: 'https://www.linkedin.com/in/sergii-romashov-69b7871a3'
    }
  },
  {
    name: 'Daria Ezerovych',
    slug: 'daria-ezerovych',
    title: 'CTO',
    company: 'Klepka',
    shortBio: 'Senior Salesforce Consultant delivering complex multi-cloud solutions (Sales, Service, Experience, CRMA).\n\nLeads technical discovery, solution design, and pre-sales workshops, translating business needs into scalable Salesforce architectures that drive measurable results.',
    description: 'Senior Salesforce Consultant specializing in complex multi-cloud implementations across Sales Cloud, Service Cloud, Experience Cloud, and CRM Analytics.\n\nExperienced in leading technical discovery, solution architecture design, and effort estimation within enterprise sales cycles. Actively supports pre-sales engagements by facilitating workshops, defining scalable architectures, preparing detailed estimates, and presenting tailored solutions to executive stakeholders.\n\nSkilled at translating business objectives into structured, scalable Salesforce ecosystems that deliver measurable business value. Also experienced in conducting product demos and user training sessions to ensure smooth adoption and effective system usage.\n\nCombines strong technical expertise with clear communication to build client confidence and accelerate decision-making. Effectively collaborates with stakeholders across technical and business teams to ensure solutions align with strategic objectives.',
    startDate: '2020-01-20',
    certs: ['platformAdmin', 'salesCloud', 'experienceCloud', 'dataCloud', 'sharingVisibilityArchitect', 'platformDataArchitect'],
    avatar: dariaAvatar,
    contactInfo: {
      phone: '+38 (093) 645-36-13',
      email: 'daria.ezerovych@klepka.solutions',
      linkedin: 'https://www.linkedin.com/in/daria-ezerovych-a97a091a4/'
    }
  }
];

export const teamsConfig: Team[] = [
  {
    title: 'Salesforce Admin Team',
    members: [
      {
        name: 'Marina Penkova',
        description: 'Team Lead\n\nExperienced Salesforce Administrator with a strong background in user support, system maintenance, and process optimization. Leads the admin team in ensuring platform stability, user adoption, and continuous improvement.',
        startDate: '2021-01-07',
        certs: ['platformAdmin','platformAppBuilder','experienceCloud'],
        avatar: marinaAvatar
      }
    ]
  }
];
