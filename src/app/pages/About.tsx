import React from 'react';
import { motion } from 'motion/react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { foundersConfig, teamsConfig } from '../../config/teamConfig';
import type { CertKey } from '../../config/certificatesConfig';
import { certificatesConfig } from '../../config/certificatesConfig';

export const About: React.FC = () => {
  const sliderRef = React.useRef(null);

  const computeSlidesToShow = (w: number) => {
    if (w <= 480) return 2;
    if (w <= 768) return 2;
    if (w <= 1024) return 3;
    return 5;
  };

  const baseSettings = {
    dots: false,
    infinite: true,
    speed: 600,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    cssEase: 'cubic-bezier(0.4, 0, 0.2, 1)',
    pauseOnHover: true,
  };

  const [sliderSettings, setSliderSettings] = React.useState(() => ({
    ...baseSettings,
    slidesToShow:
      typeof window !== 'undefined'
        ? computeSlidesToShow(window.innerWidth)
        : 5,
  }));

  React.useEffect(() => {
    const handleResize = () => {
      const next = computeSlidesToShow(window.innerWidth);
      setSliderSettings((prev) =>
        prev.slidesToShow === next ? prev : { ...prev, slidesToShow: next }
      );
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pt-14 lg:pt-32">
      {/* Hero Section */ }
      <section className="pb-0 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={ { opacity: 0, y: 20 } }
            animate={ { opacity: 1, y: 0 } }
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-3xl sm:text-4xl mb-6 text-violet">
              Our Team
            </h1>
            <p className="text-xl text-text-secondary leading-relaxed mb-8">
              Founded by two Salesforce experts with experience working on systems at different
              stages, from early implementations to complex, evolving environments.
              We bring that experience into every project, focusing on practical, structured
              solutions that make clients’ work easier over time.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission 
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl mb-6 text-violet">Our Mission</h2>
            <p className="text-xl text-text-secondary leading-relaxed">
              We believe that CRM systems should empower teams, not frustrate them. Our mission is to design and implement Salesforce solutions that match the way your business actually works—creating clarity, reducing friction, and driving measurable revenue growth.
            </p>
          </motion.div>
        </div>
      </section> */ }


      {/* Values */ }
      <section className="py-6 px-4 sm:px-6 lg:px-8 bg-violet text-off-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={ { opacity: 0, y: 20 } }
            whileInView={ { opacity: 1, y: 0 } }
            viewport={ { once: true } }
            className="text-center mb-6"
          >

          </motion.div>

          <div
            className="gap-8"
            style={ {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '32px'
            } }
          >
            { [
              {
                title: 'About Us',
                description: 'We build Salesforce CRM systems designed to scale with real business requirements.\nOur focus is full-cycle Salesforce delivery, from initial architecture and implementation to integrations and long-term system support.',
                isList: false,
              },
              {
                title: 'What we actually do',
                description: 'System architecture and design\nCustom CRM implementation\nIntegrations with external systems\nAutomation and ongoing support',
                isList: true,
              },
              {
                title: 'How we work',
                description: 'Structured delivery with clear responsibility.\nTechnical decisions based on long-term system behavior.\nFocus on scalability rather than short-term fixes.',
                isList: false,
              },
            ].map((value, index) => (
              <motion.div
                key={ index }
                initial={ { opacity: 0, y: 20 } }
                whileInView={ { opacity: 1, y: 0 } }
                viewport={ { once: true } }
                transition={ { delay: index * 0.1 } }
                className="text-center"
              >
                <h3 className="text-xl mb-3">{ value.title }</h3>
                { value.isList ? (
                  <ul className="space-y-2 ml-15 leading-relaxed text-left">
                    { value.description.split('\n').map((item, i) => (
                      <li key={ i }>• { item }</li>
                    )) }
                  </ul>
                ) : (
                  <p
                    className="leading-relaxed whitespace-pre-line text-left">{ value.description }</p>
                ) }
              </motion.div>
            )) }
          </div>
        </div>
      </section>

      {/* Team Structure Section */ }
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Left: Our Team Structure */ }
          <div>
            <motion.div
              initial={ { opacity: 0, y: 20 } }
              whileInView={ { opacity: 1, y: 0 } }
              viewport={ { once: true } }
              className="text-center max-w-3xl mx-auto mb-6"
            >
              <h2 className="text-3xl sm:text-4xl mb-4 text-violet">Our Team Structure</h2>
              <p className="text-text-secondary">Meet Our Founders</p>
            </motion.div>

            <div
              className="grid gap-6"
              style={ { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } }
            >
              { foundersConfig.map((person, idx) => (
                <TeamPersonCard key={ idx } person={ person } sliderSettings={ sliderSettings }
                                sliderRef={ sliderRef }/>
              )) }
            </div>
          </div>

          {/* Right: Company Team Structure */ }
          <div>
            <motion.div
              initial={ { opacity: 0, y: 20 } }
              whileInView={ { opacity: 1, y: 0 } }
              viewport={ { once: true } }
              className="mb-6"
            >
              <h3 className="text-2xl mb-2">Company Team Structure</h3>
              <p className="text-text-secondary mb-4">Explore teams and their members.</p>
            </motion.div>

            <div className="space-y-4">
              { teamsConfig.map((team, idx) => (
                <AccordionTeam key={ idx } title={ team.title }>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    { team.members.map((member, memberIdx) => (
                      <SimpleMemberCard
                        key={ memberIdx }
                        name={ member.name }
                        description={ member.description }
                        startDate={ member.startDate }
                        avatar={ member.avatar }
                        certs={ member.certs }
                        sliderSettings={ sliderSettings }
                        sliderRef={ sliderRef }
                      />
                    )) }
                  </div>
                </AccordionTeam>
              )) }
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};


/* Helper components used only in this file */

function TeamPersonCard({ person, sliderSettings, sliderRef }: {
  person: {
    name: string;
    title: string;
    description: string;
    startDate: string;
    certs: CertKey[];
    avatar?: string;
    contactInfo: { phone: string; email: string; linkedin: string }
  };
  sliderSettings: any;
  sliderRef: any
}) {
  const [isFlipped, setIsFlipped] = React.useState(false);

  const frontCardClasses = `bg-card border border-border-color rounded-lg p-6 shadow-sm transition-shadow h-full flex flex-col hover:shadow-lg`;
  const backCardClasses = `bg-violet border border-violet/40 rounded-lg p-6 shadow-sm h-full flex flex-col text-off-white`;

  const calculateYears = (start: string) => {
    const startDateObj = new Date(start);
    const now = new Date();
    const diffMs = now.getTime() - startDateObj.getTime();
    const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    return years;
  };

  const years = calculateYears(person.startDate);

  const downloadVCard = () => {
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${ person.name }`,
      `TITLE:${ person.title }`,
      `TEL;TYPE=WORK,VOICE:${ person.contactInfo.phone }`,
      `EMAIL;TYPE=INTERNET:${ person.contactInfo.email }`,
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ person.name.replace(/\s+/g, '_') }.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={ { perspective: '1200px' } }>
      <motion.div
        className="relative h-full [transform-style:preserve-3d]"
        animate={ { rotateY: isFlipped ? 180 : 0 } }
        transition={ { duration: 0.55, ease: [0.2, 0.8, 0.2, 1] } }
      >
        {/* Front */ }
        <div className="h-full [backface-visibility:hidden]">
          <div className={ frontCardClasses } data-package-card="true">
            <div className="flex flex-col items-center">
              <div
                className="w-28 h-28 rounded-full bg-card-foreground/10 mb-4 flex items-center justify-center overflow-hidden">
                <img src={ person.avatar || '/assets/avatar-placeholder.png' } alt={ person.name }
                     className="w-full h-full object-cover"/>
              </div>
              <h3 className="text-xl font-semibold mb-1">{ person.name }</h3>
              <p className="text-sm text-grey mb-3">{ person.title }</p>
              <p
                className="text-sm text-text-secondary mb-3 whitespace-pre-line">{ person.description }</p>
              <p
                className="text-sm text-violet font-medium mb-3">{ years } { years === 1 ? 'year' : 'years' } of
                experience</p>

              <div className="certification-slider w-full mb-4">
                <Slider ref={ sliderRef } { ...sliderSettings }>
                  { person.certs.map((certKey) => {
                    const cert = certificatesConfig[certKey];
                    return (
                      <div key={ certKey } className="px-2">
                        <div className="flex items-center justify-center h-20">
                          <img src={ cert.image } alt={ cert.name } title={ cert.name }
                               className="max-h-full w-auto object-contain"/>
                        </div>
                      </div>
                    );
                  }) }
                </Slider>
              </div>

              <button onClick={ () => setIsFlipped(true) }
                      className="mt-auto bg-violet text-white px-4 py-2 rounded-md">Contact
                Information
              </button>
            </div>
          </div>
        </div>

        {/* Back */ }
        <div
          className="absolute inset-0 h-full [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div className={ backCardClasses }>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-bold">{ person.name }</h3>
                <p className="text-white/80 text-sm">{ person.title }</p>
              </div>
              <button onClick={ () => setIsFlipped(false) }
                      className="text-white/80 hover:text-white text-sm underline underline-offset-4">Back
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-white/80">Phone</div>
                <div className="text-white">{ person.contactInfo.phone }</div>
              </div>
              <div>
                <div className="text-sm text-white/80">Email</div>
                <div className="text-white">{ person.contactInfo.email }</div>
              </div>
              <div>
                <div className="text-sm text-white/80">LinkedIn</div>
                <a className="text-white underline" href={ person.contactInfo.linkedin }
                   target="_blank" rel="noopener noreferrer">{ person.contactInfo.linkedin }</a>
              </div>
            </div>

            <div className="mt-auto">
              <button onClick={ downloadVCard }
                      className="bg-white text-violet px-3 py-2 rounded-md">Add Contact
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AccordionTeam({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-border-color rounded-lg p-4">
      <button onClick={ () => setOpen((s) => !s) }
              className="w-full text-left flex items-center justify-between">
        <span className="font-medium">{ title }</span>
        <span className="text-sm text-text-secondary">{ open ? 'Hide' : 'Show' }</span>
      </button>
      { open && <div className="mt-4">{ children }</div> }
    </div>
  );
}

function SimpleMemberCard({ name, description, startDate, avatar, certs, sliderSettings, sliderRef }: {
  name: string;
  description: string;
  startDate: string;
  avatar?: string;
  certs?: CertKey[];
  sliderSettings: any;
  sliderRef: any;
}) {
  const calculateYears = (start: string) => {
    const startDateObj = new Date(start);
    const now = new Date();
    const diffMs = now.getTime() - startDateObj.getTime();
    const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
    return years;
  };

  const years = calculateYears(startDate);

  return (
    <div className="bg-card border border-border-color rounded-lg p-4">
      <div className="flex flex-col items-center text-center">
        <div
          className="w-20 h-20 rounded-full bg-card-foreground/10 mb-3 flex items-center justify-center overflow-hidden">
          <img src={ avatar || '/assets/avatar-placeholder.png' } alt={ name }
               className="w-full h-full object-cover"/>
        </div>
        <div className="font-medium text-lg mb-2">{ name }</div>
        <div className="text-sm text-text-secondary mb-2 whitespace-pre-line">{ description }</div>
        <div
          className="text-sm text-violet font-medium mb-3">{ years } { years === 1 ? 'year' : 'years' } of
          experience
        </div>
        { certs && certs.length > 0 && (
          <div className="certification-slider w-full mt-1">
            <Slider ref={ sliderRef } { ...sliderSettings }>
              { certs.map((certKey) => {
                const cert = certificatesConfig[certKey];
                return (
                  <div key={ certKey } className="px-2">
                    <div className="flex items-center justify-center h-20">
                      <img src={ cert.image } alt={ cert.name } title={ cert.name }
                           className="max-h-full w-auto object-contain"/>
                    </div>
                  </div>
                );
              }) }
            </Slider>
          </div>
        ) }
      </div>
    </div>
  );
}
