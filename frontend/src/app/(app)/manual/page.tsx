import Image from 'next/image';
import Link from 'next/link';
import { manualPages } from '@/components/manual/manualPages';

export default function ManualIndexPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
          Podręcznik użytkownika
        </h1>
        <p className="text-lg text-emerald-700/70 leading-relaxed max-w-3xl">
          Poznaj wszystkie funkcje FiredUp. Każdy rozdział zawiera szczegółowy opis
          i zrzuty ekranu, które pokażą Ci jak w pełni wykorzystać aplikację.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {manualPages.map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.slug}
              href={`/manual/${page.slug}`}
              className="group bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
            >
              {page.thumbnail && (
                <div className="relative w-full h-36 bg-emerald-50 overflow-hidden">
                  <Image
                    src={page.thumbnail}
                    alt={page.title}
                    fill
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-emerald-900 mb-2 group-hover:text-emerald-700 transition-colors">
                  {page.title}
                </h2>
                <p className="text-sm text-emerald-600/60">
                  Kliknij, aby przeczytać szczegóły &rarr;
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
