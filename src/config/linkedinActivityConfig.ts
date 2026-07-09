export type LinkedinPost = {
  id: string;
  urn: string; // LinkedIn post URN from the embed iframe (e.g., urn:li:share:7441812111338586112)
};

export const linkedinActivityConfig: LinkedinPost[] = [
  
  /*
  {
    id: "post-",
    urn: "urn:li:share:",
  },
  */
 {
    id: "post-24",
    urn: "urn:li:ugcPost:7480567985712193536",
  },
   {
    id: "post-23",
    urn: "urn:li:share:7479865971311198208",
  },
   {
    id: "post-22",
    urn: "urn:li:share:7477318589260300291",
  },
   {
    id: "post-21",
    urn: "urn:li:share:7478718754089250818",
  },
  {
    id: "post-20",
    urn: "urn:li:share:7478029336395128833",
  },
     {
    id: "post-27",
    urn: "urn:li:share:7476211728033230849",
  },
   {
    id: "post-26",
    urn: "urn:li:share:7475473094149636112",
  },
  {
    id: "post-25",
    urn: "urn:li:share:7474775018640560128",
  },
  {
    id: "post-17",
    urn: "urn:li:share:7459577928146878465",
  },
 {
    id: "post-16",
    urn: "urn:li:share:7457759904347631617",
  },
 
  {
    id: "post-18",
    urn: "urn:li:share:7457026089245323264",
  },
  {
    id: "post-19",
    urn: "urn:li:share:7455931446600388608",
  },
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
