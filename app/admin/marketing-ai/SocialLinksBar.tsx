"use client";

import Link from "next/link";
import AdminCard from "../components/AdminCard";
import type { SocialLinks } from "@/lib/social/normalizeSocialUrl";

const PLATFORMS = [
  {
    key: "instagram" as const,
    label: "Instagram",
    activeClass: "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] hover:opacity-90",
    inactiveClass: "bg-white/5 text-white/35 border border-white/10",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.3.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.3.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.3-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.3.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.3-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.3-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.3.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.3-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.4a5.6 5.6 0 110 11.2 5.6 5.6 0 010-11.2zm0 1.8a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zm5.9-3.7a1.3 1.3 0 110 2.6 1.3 1.3 0 010-2.6z" />
      </svg>
    ),
  },
  {
    key: "facebook" as const,
    label: "Facebook",
    activeClass: "bg-[#1877F2] hover:opacity-90",
    inactiveClass: "bg-white/5 text-white/35 border border-white/10",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
        <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.2-1.5 1.5-1.5H16.6V5c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H7.5v3h2.4v8h3.6z" />
      </svg>
    ),
  },
  {
    key: "tiktok" as const,
    label: "TikTok",
    activeClass: "bg-black border border-white/15 hover:opacity-90",
    inactiveClass: "bg-white/5 text-white/35 border border-white/10",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
        <path d="M16.5 5.2c.8 1 2 1.7 3.3 1.8v3c-1.2 0-2.3-.4-3.3-1v6.8a5.5 5.5 0 11-5.5-5.5c.3 0 .7 0 1 .1v3.2a2.3 2.3 0 102.3 2.3V2h3.2c.1 1.1.6 2.1 1.3 3.2z" />
      </svg>
    ),
  },
];

export default function SocialLinksBar({ links }: { links: SocialLinks }) {
  const configured = PLATFORMS.filter((p) => links[p.key]).length;

  return (
    <AdminCard className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">Conturile tale sociale</p>
        {configured < 3 && (
          <Link
            href="/admin/profile"
            className="text-xs text-white/50 hover:text-white underline"
          >
            Configurează în Profil
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PLATFORMS.map((platform) => {
          const href = links[platform.key];
          const className = `inline-flex flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-sm font-medium text-white transition ${
            href ? platform.activeClass : platform.inactiveClass
          }`;

          if (href) {
            return (
              <a
                key={platform.key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                title={`Deschide ${platform.label}`}
              >
                {platform.icon}
                <span>{platform.label}</span>
              </a>
            );
          }

          return (
            <Link
              key={platform.key}
              href="/admin/profile"
              className={className}
              title={`Adaugă link ${platform.label} în Profil`}
            >
              {platform.icon}
              <span>{platform.label}</span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-white/40">
        {configured === 0
          ? "Apasă pe o rețea pentru a adăuga linkul în Profil. După salvare, butonul deschide contul direct."
          : "Generează textul, copiază-l, apoi apasă rețeaua unde postezi."}
      </p>
    </AdminCard>
  );
}
