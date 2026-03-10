import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Phone, Mail, Linkedin, ArrowLeft, UserPlus } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { foundersConfig } from '../../config/teamConfig';
import { certFullNames } from '../../config/certificatesConfig';
import logoLight from '../../assets/d1e97a210363d7653bba220190650a54a2d2ee58.png';

export const FounderCardPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const person = foundersConfig.find((f) => f.slug === slug);

  if (!person) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-violet text-white gap-4">
        <p className="text-xl">Card not found</p>
        <Link to="/" className="underline text-accent-yellow">Go to homepage</Link>
      </div>
    );
  }

  const downloadVCard = async () => {
    const nameParts = person.name.trim().split(/\s+/);
    const firstName = nameParts.slice(0, -1).join(' ');
    const lastName = nameParts[nameParts.length - 1];

    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${lastName};${firstName};;;`,
      `FN:${person.name}`,
      `TITLE:${person.title}`,
      `ORG:${person.company}`,
      `TEL;TYPE=WORK,VOICE:${person.contactInfo.phone}`,
      `EMAIL;TYPE=INTERNET:${person.contactInfo.email}`,
      `URL;TYPE=LinkedIn:${person.contactInfo.linkedin}`,
    ];

    if (person.avatar) {
      try {
        const res = await fetch(person.avatar);
        const buf = await res.arrayBuffer();
        const ext = person.avatar.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        lines.push(`PHOTO;ENCODING=b;TYPE=${ext}:${btoa(binary)}`);
      } catch {}
    }

    lines.push('END:VCARD');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${person.name.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `https://klepka.solutions/card/${person.slug}#person`,
    "name": person.name,
    "jobTitle": person.title,
    "description": person.shortBio,
    "url": `https://klepka.solutions/card/${person.slug}`,
    "worksFor": { "@id": "https://klepka.solutions/#organization" },
    "email": person.contactInfo.email,
    "telephone": person.contactInfo.phone,
    "sameAs": [person.contactInfo.linkedin],
    "hasCredential": person.certs.map((certKey) => ({
      "@type": "EducationalOccupationalCredential",
      "name": certFullNames[certKey],
      "credentialCategory": "certification",
      "recognizedBy": { "@type": "Organization", "name": "Salesforce" },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet via-[#4a2a8a] to-[#1a0a3a] px-4 py-10">
      <SEOHead
        title={`${person.name} — ${person.title} at Klepka`}
        description={person.shortBio}
        canonicalPath={`/card/${person.slug}`}
        ogType="profile"
        jsonLd={personJsonLd}
      />
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* Photo */}
          <div className="relative w-full aspect-square bg-gray-100">
            <img
              src={person.avatar || '/assets/avatar-placeholder.png'}
              alt={person.name}
              className="w-full h-full object-cover object-top"
            />
            {/* Company badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-5 pt-8 pb-4">
              <img src={logoLight} alt="Klepka" className="h-6 w-auto" />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{person.name}</h1>
            <p className="text-violet font-medium mt-0.5">{person.title}</p>

            <p className="text-gray-500 text-sm mt-3 leading-relaxed">{person.shortBio}</p>

            {/* Divider */}
            <div className="my-4 border-t border-gray-100" />

            {/* Contact info */}
            <div className="space-y-3">
              <a
                href={`tel:${person.contactInfo.phone}`}
                className="flex items-center gap-3 text-gray-700 hover:text-violet transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-violet" />
                </div>
                <span className="text-sm">{person.contactInfo.phone}</span>
              </a>

              <a
                href={`mailto:${person.contactInfo.email}`}
                className="flex items-center gap-3 text-gray-700 hover:text-violet transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-violet" />
                </div>
                <span className="text-sm">{person.contactInfo.email}</span>
              </a>

              <a
                href={person.contactInfo.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-gray-700 hover:text-violet transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-violet/10 flex items-center justify-center flex-shrink-0">
                  <Linkedin className="w-4 h-4 text-violet" />
                </div>
                <span className="text-sm truncate">{person.contactInfo.linkedin.replace('https://', '')}</span>
              </a>
            </div>

            {/* Divider */}
            <div className="my-4 border-t border-gray-100" />

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={downloadVCard}
                className="flex-1 flex items-center justify-center gap-2 bg-violet text-white rounded-xl py-3 font-medium hover:bg-violet/90 active:scale-95 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Add Contact
              </button>
              <Link
                to="/"
                className="flex items-center justify-center w-12 h-12 rounded-xl border border-gray-200 text-gray-500 hover:border-violet hover:text-violet transition-colors"
                title="Visit website"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center text-white/50 text-xs mt-6">
          <Link to="/" className="hover:text-white transition-colors">klepka.solutions</Link>
        </p>
      </div>
    </div>
  );
};
