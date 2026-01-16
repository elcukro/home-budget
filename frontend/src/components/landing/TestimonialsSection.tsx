'use client';

import Image from 'next/image';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Marta, 34 lata',
    location: 'Warszawa',
    text: 'Po 2 latach korzystania z FiredUp spłaciłam 45 000 PLN długu. Pierwszy raz w życiu mam fundusz awaryjny.',
    avatar: 'M',
    image: '', // /images/testimonials/marta.jpg
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
  },
  {
    name: 'Piotr, 41 lat',
    location: 'Kraków',
    text: 'Myślałem, że oszczędzanie to nie dla mnie. FiredUp pokazał mi, że tracę 800 PLN miesięcznie na subskrypcje, o których zapomniałem.',
    avatar: 'P',
    image: '', // /images/testimonials/piotr.jpg
    color: 'bg-violet-100',
    textColor: 'text-violet-700',
  },
  {
    name: 'Anna i Tomek, 29 lat',
    location: 'Gdańsk',
    text: 'Kłótnie o pieniądze prawie zniszczyły nasz związek. Teraz mamy wspólny cel i widzimy postęp razem.',
    avatar: 'AT',
    image: '', // /images/testimonials/anna-tomek.jpg
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
  },
  {
    name: 'Karolina, 27 lat',
    location: 'Poznań',
    text: 'Zarabiałam 6000 zł i nie wiedziałam gdzie mi znika kasa. FiredUp pokazał, że 1200 zł szło na jedzenie na mieście. Teraz odkładam na mieszkanie.',
    avatar: 'K',
    image: '', // /images/testimonials/karolina.jpg
    color: 'bg-rose-100',
    textColor: 'text-rose-700',
  },
  {
    name: 'Michał, 52 lata',
    location: 'Wrocław',
    text: 'Przez 20 lat nie oszczędzałem na emeryturę. Dzięki FiredUp dowiedziałem się o IKZE i IKE. W 3 lata zbudowałem 80 000 zł poduszki.',
    avatar: 'M',
    image: '', // /images/testimonials/michal.jpg
    color: 'bg-sky-100',
    textColor: 'text-sky-700',
  },
  {
    name: 'Ewa, 38 lat',
    location: 'Łódź',
    text: 'Samotna mama z dwójką dzieci. Myślałam, że oszczędzanie to luksus. FiredUp pomógł mi znaleźć 400 zł miesięcznie na fundusz awaryjny.',
    avatar: 'E',
    image: '', // /images/testimonials/ewa.jpg
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
  },
  {
    name: 'Jakub, 31 lat',
    location: 'Katowice',
    text: 'Programista z dobrą pensją, ale zero oszczędności. Metoda kuli śnieżnej pomogła mi spłacić 3 kredyty w 14 miesięcy. Teraz jestem na kroku 4.',
    avatar: 'J',
    image: '', // /images/testimonials/jakub.jpg
    color: 'bg-violet-100',
    textColor: 'text-violet-700',
  },
  {
    name: 'Zofia, 45 lat',
    location: 'Szczecin',
    text: 'Prowadziłam własną firmę i mieszałam finanse prywatne z firmowymi. FiredUp nauczył mnie dyscypliny. Pierwszy urlop od 5 lat - opłacony z góry!',
    avatar: 'Z',
    image: '', // /images/testimonials/zofia.jpg
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
  },
  {
    name: 'Adam i Kasia, 35 lat',
    location: 'Lublin',
    text: 'Wzięliśmy kredyt hipoteczny i baliśmy się, że nigdy go nie spłacimy. FiredUp pokazuje nam, że nadpłacając 300 zł miesięcznie skrócimy go o 8 lat.',
    avatar: 'AK',
    image: '', // /images/testimonials/adam-kasia.jpg
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
              className="relative bg-white/80 backdrop-blur-sm border border-emerald-100 rounded-2xl p-8 hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300"
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-emerald-100" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-emerald-700/70 mb-6 leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${testimonial.color} rounded-full flex items-center justify-center overflow-hidden`}>
                  {testimonial.image ? (
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className={`${testimonial.textColor} font-semibold text-lg`}>
                      {testimonial.avatar}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-emerald-900">{testimonial.name}</p>
                  <p className="text-sm text-emerald-600/60">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
