export interface Founder {
  name: string;
  title: string;
  description: string;
  startDate: string;
  logos: string[];
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
  avatar?: string;
}

export interface Team {
  title: string;
  members: TeamMember[];
}

export const foundersConfig: Founder[] = [
  {
    name: 'Sergii Romashov',
    title: 'CEO',
    description: 'Having 7+ years of overall extensive experience in Salesforce analysis and implementation, with strong technical and functional aspects, and expertise in managing a team and leading it.\n\nProven track record in designing and delivering scalable end-to-end solutions as well as integrations with third-party systems.\n\nComprehensive background in designing highly efficient end-to-end solutions for Sales, Service, and Experience Cloud.\n\nStrong leadership background with experience building and leading Salesforce Administrator teams, mentoring professionals, and conducting educational programs.\n\nExcellent analytical and communication skills with a focus on driving efficiency, adoption, and cross-functional collaboration.',
    startDate: '2017-01-01',
    logos: [
      '/assets/82604211df267665aa3c66c85446c94b2ee6cd46.png',
      '/assets/aed582af24f5014b836a133be5f05bf36a841cd1.png',
      '/assets/pardot-specialist.png'
    ],
    avatar: '/assets/avatar-placeholder.png',
    contactInfo: {
      phone: '+380 00 000 0000',
      email: 'sergii.romashov@example.com',
      linkedin: 'https://linkedin.com/in/sergii-romashov'
    }
  },
  {
    name: 'Daria Ezerovych',
    title: 'CTO',
    description: 'Senior Salesforce Consultant with 6+ years of experience delivering complex multi-cloud solutions (Sales, Service, Experience, CRMA).\n\nStrong background in solution design, technical discovery, and effort estimation within enterprise sales cycles.\n\nActively supports pre-sales engagements by leading workshops, defining architecture, preparing estimates, and presenting solutions to stakeholders.\n\nProven ability to translate business requirements into scalable Salesforce ecosystems that drive measurable outcomes.\n\nCombines technical depth with strong communication skills to build client trust and accelerate deal closure.',
    startDate: '2018-01-01',
    logos: [
      '/assets/82604211df267665aa3c66c85446c94b2ee6cd46.png',
      '/assets/aed582af24f5014b836a133be5f05bf36a841cd1.png',
      '/assets/7366f5a4c28ad07c8d9e9f7ffadee0e142693189.png',
      '/assets/e2a3731ce5c28b0aaeabca19fd7e3c14965d21ca.png',
      '/assets/16a5ea898db9e45a4dda47b5fd950a3b1ec8a9b5.png',
      '/assets/3550a6afca687e342a05d1e6c391a8dbfbdb5561.png'
    ],
    avatar: '/assets/avatar-placeholder.png',
    contactInfo: {
      phone: '+380 00 000 0001',
      email: 'daria.ezerovych@example.com',
      linkedin: 'https://linkedin.com/in/daria-ezerovych'
    }
  }
];

export const teamsConfig: Team[] = [
  {
    title: 'Salesforce Admin Team',
    members: [
      {
        name: 'Kateryna S.',
        description: 'Experienced Salesforce Administrator specializing in:\n• User management\n• Data quality\n• Process automation',
        startDate: '2020-03-15',
        avatar: '/assets/avatar-placeholder.png'
      },
      {
        name: 'Ivan K.',
        description: 'Salesforce Admin focused on:\n• System configuration\n• Reporting\n• Workflow optimization',
        startDate: '2021-06-01',
        avatar: '/assets/avatar-placeholder.png'
      }
    ]
  },
  {
    title: 'Engineering Team',
    members: [
      {
        name: 'Dmytro P.',
        description: 'Software Engineer with expertise in:\n• Salesforce integrations\n• Custom development',
        startDate: '2019-09-10',
        avatar: '/assets/avatar-placeholder.png'
      }
    ]
  }
];
