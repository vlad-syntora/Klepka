export type LinkedinPost = {
  id: string;
  urn: string; // LinkedIn post URN from the embed iframe (e.g., urn:li:share:7441812111338586112)
};

export const linkedinActivityConfig: LinkedinPost[] = [
  
  {
    id: "post-10",
    urn: "urn:li:share:7444324753974378496",
  },
    {
    id: "post-11",
    urn: "urn:li:share:7445035750770946048",
  },
  {
    id: "post-15",
    urn: "urn:li:share:7445756594690228224",
  },
  {
    id: "post-14",
    urn: "urn:li:share:7446848771428216832",
  },
  
  {
    id: "post-13",
    urn: "urn:li:share:7447945058882027520",
  },
  
  {
    id: "post-12",
    urn: "urn:li:share:7449382138975801344",
  },
  {
    id: "post-9",
    urn: "urn:li:share:7441812111338586112",
  },
  {
    id: "post-8",
    urn: "urn:li:share:7439269001228111872",
  },
  {
    id: "post-7",
    urn: "urn:li:share:7437532628469166081",
  },
    {
    id: "post-6",
    urn: "urn:li:share:7436718528788987904",
  },
  {
    id: "post-5",
    urn: "urn:li:share:7435295734679113728",
  },
  {
    id: "post-4",
    urn: "urn:li:share:7434177061860270080",
  },
  {
    id: "post-2",
    urn: "urn:li:share:7433106652628819968",
  },
  {
    id: "post-1",
    urn: "urn:li:share:7432361526117859329",
  }
];

export const getLinkedinEmbedUrl = (urn: string): string => {
  return `https://www.linkedin.com/embed/feed/update/${urn}`;
};
