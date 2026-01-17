'use client';

import Image from 'next/image';

const problems = [
  {
    image: '/images/problems/dokad-pieniadze.png',
    title: 'Nie wiesz, dokąd idą pieniądze',
    description: 'Koniec miesiąca, a konto puste. Znowu. Przeglądasz historię transakcji i nie rozumiesz, gdzie się podziała wypłata. Drobne wydatki sumują się w setki złotych, ale bez systemu nigdy tego nie zauważysz.',
  },
  {
    image: '/images/problems/kredyty-przytlaczaja.png',
    title: 'Kredyty cię przytłaczają',
    description: 'Rata za ratą, bez końca w zasięgu wzroku. Hipoteka, samochód, karta kredytowa – każdego miesiąca to samo. Czujesz, że pracujesz tylko po to, żeby spłacać długi, a nie budować przyszłość.',
  },
  {
    image: '/images/problems/jakie-oszczedzanie.png',
    title: 'Oszczędzanie? Jakie oszczędzanie?',
    description: 'Zawsze coś wyskakuje. Nigdy nic nie zostaje. Zepsuta pralka, wizyta u dentysty, naprawy samochodu – życie ciągle podrzuca niespodzianki. Bez poduszki finansowej każda taka sytuacja to kryzys.',
  },
  {
    image: '/images/problems/stres-zycie.png',
    title: 'Stres wpływa na całe życie',
    description: 'Kłótnie o pieniądze, nieprzespane noce, ciągła niepewność. Finanse to jedna z najczęstszych przyczyn konfliktów w związkach. Stres finansowy odbija się na zdrowiu, relacjach i codziennym samopoczuciu.',
  },
  {
    image: '/images/problems/brak-planu.png',
    title: 'Brak planu, brak kontroli',
    description: 'Nie wiesz, od czego zacząć ani co robić dalej. Setki porad w internecie, ale każda mówi co innego. Potrzebujesz prostego systemu, który krok po kroku pokaże Ci drogę do stabilności.',
  },
  {
    image: '/images/problems/zycie-od-wyplaty.png',
    title: 'Życie od wypłaty do wypłaty',
    description: 'Spirala, z której nie widać wyjścia. Odliczasz dni do przelewu, a potem wszystko zaczyna się od nowa. To nie musi tak wyglądać – wystarczy zmienić podejście i zacząć świadomie zarządzać pieniędzmi.',
  },
];

export default function ProblemsSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-emerald-50/30 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          Czy to brzmi znajomo?
        </h2>
        <p className="text-emerald-700/70 text-center mb-12 max-w-2xl mx-auto">
          Te problemy dotykają milionów ludzi. Nie musisz z nimi walczyć sam.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem, index) => {
            return (
              <div
                key={index}
                className="group bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className="w-full h-32 relative mb-4 flex items-center justify-center shrink-0">
                  <Image
                    src={problem.image}
                    alt={problem.title}
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <h3 className="text-lg font-semibold text-emerald-900 mb-3 min-h-[3.5rem] flex items-start">
                  {problem.title}
                </h3>
                <p className="text-emerald-700/70 text-sm leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
