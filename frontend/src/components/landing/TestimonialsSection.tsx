'use client';

import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Marta, 34 lata',
    location: 'Warszawa',
    text: 'Po 2 latach korzystania z FiredUp spłaciłam 45 000 PLN długu. Pierwszy raz w życiu mam fundusz awaryjny.',
    avatar: 'M',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
  },
  {
    name: 'Piotr, 41 lat',
    location: 'Kraków',
    text: 'Myślałem, że oszczędzanie to nie dla mnie. FiredUp pokazał mi, że tracę 800 PLN miesięcznie na subskrypcje, o których zapomniałem.',
    avatar: 'P',
    color: 'bg-violet-100',
    textColor: 'text-violet-700',
  },
  {
    name: 'Anna i Tomek, 29 lat',
    location: 'Gdańsk',
    text: 'Kłótnie o pieniądze prawie zniszczyły nasz związek. Teraz mamy wspólny cel i widzimy postęp razem.',
    avatar: 'A',
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
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
                <div className={`w-12 h-12 ${testimonial.color} rounded-full flex items-center justify-center`}>
                  <span className={`${testimonial.textColor} font-semibold text-lg`}>
                    {testimonial.avatar}
                  </span>
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
