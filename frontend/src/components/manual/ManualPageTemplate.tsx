'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import ManualScreenshot from './ManualScreenshot';
import { manualPages } from './manualPages';

export interface ManualSection {
  title: string;
  description: string;
  screenshots?: { src: string; alt: string; caption?: string }[];
  features?: string[];
}

interface ManualPageTemplateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  sections: ManualSection[];
}

export default function ManualPageTemplate({
  icon: Icon,
  title,
  description,
  sections,
}: ManualPageTemplateProps) {
  const pathname = usePathname();
  const currentSlug = pathname.split('/').pop() || '';
  const currentIndex = manualPages.findIndex((p) => p.slug === currentSlug);
  const prevPage = currentIndex > 0 ? manualPages[currentIndex - 1] : null;
  const nextPage = currentIndex < manualPages.length - 1 ? manualPages[currentIndex + 1] : null;

  return (
    <div className="max-w-4xl">
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Icon className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-emerald-900">{title}</h1>
          </div>
        </div>
        <p className="text-lg text-emerald-700/70 leading-relaxed max-w-3xl">
          {description}
        </p>
      </div>

      {/* Content sections */}
      <div className="space-y-16">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h2 className="text-2xl font-bold text-emerald-900 mb-4">{section.title}</h2>
            <p className="text-emerald-700/70 leading-relaxed mb-6">{section.description}</p>

            {section.features && section.features.length > 0 && (
              <ul className="space-y-2 mb-8">
                {section.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                    <span className="text-emerald-700/70">{feature}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Screenshots grid */}
            {section.screenshots && section.screenshots.length > 0 && (
              <div className={`grid gap-6 ${section.screenshots.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {section.screenshots.map((screenshot, i) => (
                  <ManualScreenshot
                    key={i}
                    src={screenshot.src}
                    alt={screenshot.alt}
                    caption={screenshot.caption}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Prev / Next navigation */}
      <div className="mt-16 pt-8 border-t border-emerald-100 flex items-center justify-between">
        {prevPage ? (
          <Link
            href={`/manual/${prevPage.slug}`}
            className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <div>
              <p className="text-xs text-emerald-600/60">Poprzedni</p>
              <p className="font-medium">{prevPage.title}</p>
            </div>
          </Link>
        ) : <div />}

        {nextPage ? (
          <Link
            href={`/manual/${nextPage.slug}`}
            className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 transition-colors group text-right"
          >
            <div>
              <p className="text-xs text-emerald-600/60">Następny</p>
              <p className="font-medium">{nextPage.title}</p>
            </div>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
