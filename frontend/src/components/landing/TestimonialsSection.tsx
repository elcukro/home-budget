'use client';

import Image from 'next/image';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Marta, 34 lata',
    location: 'Warszawa',
    role: 'Specjalistka HR w korporacji',
    bio: 'Mieszka z mężem i kotem w Mokotowie. Uwielbia bieganie i podróże po Azji.',
    text: 'Po 2 latach korzystania z FiredUp spłaciłam 45 000 PLN długu. Pierwszy raz w życiu mam fundusz awaryjny.',
    avatar: 'M',
    image: '/images/testimonials/marta.jpg',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
  },
  {
    name: 'Piotr, 41 lat',
    location: 'Kraków',
    role: 'Manager w firmie logistycznej',
    bio: 'Ojciec dwóch synów, pasjonat górskich wędrówek. W weekendy gotuje dla całej rodziny.',
    text: 'Myślałem, że oszczędzanie to nie dla mnie. FiredUp pokazał mi, że tracę 800 PLN miesięcznie na subskrypcje, o których zapomniałem.',
    avatar: 'P',
    image: '/images/testimonials/piotr.jpg',
    color: 'bg-violet-100',
    textColor: 'text-violet-700',
  },
  {
    name: 'Anna i Tomek, 29 lat',
    location: 'Gdańsk',
    role: 'Nauczycielka i grafik',
    bio: 'Razem od 5 lat, planują ślub w przyszłym roku. Wspólnie odkryli, że finanse to temat, o którym warto rozmawiać.',
    text: 'Kłótnie o pieniądze prawie zniszczyły nasz związek. Teraz mamy wspólny cel i widzimy postęp razem.',
    avatar: 'AT',
    image: '/images/testimonials/anna-tomek.jpg',
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
  },
  {
    name: 'Karolina, 27 lat',
    location: 'Poznań',
    role: 'Junior Product Manager w startupie',
    bio: 'Single, mieszka w wynajmowanym mieszkaniu. Marzy o własnym M2 w centrum miasta.',
    text: 'Zarabiałam 6000 zł i nie wiedziałam gdzie mi znika kasa. FiredUp pokazał, że 1200 zł szło na jedzenie na mieście. Teraz odkładam na mieszkanie.',
    avatar: 'K',
    image: '/images/testimonials/karolina.jpg',
    color: 'bg-rose-100',
    textColor: 'text-rose-700',
  },
  {
    name: 'Michał, 52 lata',
    location: 'Wrocław',
    role: 'Inżynier budownictwa',
    bio: 'Żonaty od 25 lat, dwoje dorosłych dzieci. Zaczął myśleć o emeryturze i przeraził się, że nie ma oszczędności.',
    text: 'Przez 20 lat nie oszczędzałem na emeryturę. Dzięki FiredUp dowiedziałem się o IKZE i IKE. W 3 lata zbudowałem 80 000 zł poduszki.',
    avatar: 'M',
    image: '/images/testimonials/michal.jpg',
    color: 'bg-sky-100',
    textColor: 'text-sky-700',
  },
  {
    name: 'Ewa, 38 lat',
    location: 'Łódź',
    role: 'Pielęgniarka na oddziale kardiologii',
    bio: 'Samotnie wychowuje córkę (8 lat) i syna (5 lat). Pracuje na zmiany, ale zawsze znajduje czas dla dzieci.',
    text: 'Samotna mama z dwójką dzieci. Myślałam, że oszczędzanie to luksus. FiredUp pomógł mi znaleźć 400 zł miesięcznie na fundusz awaryjny.',
    avatar: 'E',
    image: '/images/testimonials/ewa.jpg',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
  },
  {
    name: 'Jakub, 31 lat',
    location: 'Katowice',
    role: 'Senior Frontend Developer',
    bio: 'Pracuje zdalnie dla niemieckiej firmy. Zarabia dobrze, ale długo żył ponad stan - leasing, gadżety, restauracje.',
    text: 'Programista z dobrą pensją, ale zero oszczędności. Metoda kuli śnieżnej pomogła mi spłacić 3 kredyty w 14 miesięcy. Teraz jestem na kroku 4.',
    avatar: 'J',
    image: '/images/testimonials/jakub.jpg',
    color: 'bg-violet-100',
    textColor: 'text-violet-700',
  },
  {
    name: 'Zofia, 45 lat',
    location: 'Szczecin',
    role: 'Właścicielka salonu kosmetycznego',
    bio: 'Prowadzi biznes od 12 lat, zatrudnia 4 osoby. Przez lata firma "zjadała" wszystkie jej prywatne pieniądze.',
    text: 'Prowadziłam własną firmę i mieszałam finanse prywatne z firmowymi. FiredUp nauczył mnie dyscypliny. Pierwszy urlop od 5 lat - opłacony z góry!',
    avatar: 'Z',
    image: '/images/testimonials/zofia.jpg',
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
  },
  {
    name: 'Adam i Kasia, 35 lat',
    location: 'Lublin',
    role: 'Księgowy i fizjoterapeutka',
    bio: 'Małżeństwo z 3-letnią córką. Kupili mieszkanie tuż przed podwyżką stóp procentowych i rata skoczyła o 40%.',
    text: 'Wzięliśmy kredyt hipoteczny i baliśmy się, że nigdy go nie spłacimy. FiredUp pokazuje nam, że nadpłacając 300 zł miesięcznie skrócimy go o 8 lat.',
    avatar: 'AK',
    image: '/images/testimonials/adam-kasia.jpg',
    color: 'bg-rose-100',
    textColor: 'text-rose-700',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-violet-50/30 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 text-center mb-4">
          Historie naszych użytkowników
        </h2>
        <p className="text-emerald-700/70 text-center mb-12 max-w-2xl mx-auto">
          Prawdziwi ludzie, prawdziwe rezultaty. Zobacz, jak FiredUp zmienił ich życie finansowe.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Author with photo */}
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-24 h-24 ${testimonial.color} rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0`}>
                  {testimonial.image ? (
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className={`${testimonial.textColor} font-semibold text-2xl`}>
                      {testimonial.avatar}
                    </span>
                  )}
                </div>
                <div className="min-w-0 pt-1">
                  <p className="font-semibold text-emerald-900">{testimonial.name}</p>
                  <p className="text-sm text-emerald-600 font-medium">{testimonial.role}</p>
                  <p className="text-xs text-emerald-600/50 mt-1">{testimonial.location}</p>
                </div>
              </div>

              {/* Bio */}
              <p className="text-xs text-emerald-600/60 mb-4 italic">{testimonial.bio}</p>

              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-emerald-700/70 leading-relaxed text-sm">
                "{testimonial.text}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
