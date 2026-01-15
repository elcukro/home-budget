'use client';

import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Marta, 34 lata',
    location: 'Warszawa',
    text: 'Po 2 latach korzystania z FiredUp spłaciłam 45 000 PLN długu. Pierwszy raz w życiu mam fundusz awaryjny.',
    avatar: 'M',
    color: 'bg-mint',
  },
  {
    name: 'Piotr, 41 lat',
    location: 'Kraków',
    text: 'Myślałem, że oszczędzanie to nie dla mnie. FiredUp pokazał mi, że tracę 800 PLN miesięcznie na subskrypcje, o których zapomniałem.',
    avatar: 'P',
    color: 'bg-lilac',
  },
  {
    name: 'Anna i Tomek, 29 lat',
    location: 'Gdańsk',
    text: 'Kłótnie o pieniądze prawie zniszczyły nasz związek. Teraz mamy wspólny cel i widzimy postęp razem.',
    avatar: 'A',
    color: 'bg-sand',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-primary text-center mb-4">
          Historie naszych użytkowników
        </h2>
        <p className="text-secondary text-center mb-12 max-w-2xl mx-auto">
          Prawdziwi ludzie, prawdziwe rezultaty. Zobacz, jak FiredUp zmienił ich życie finansowe.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-card border border-border rounded-2xl p-8 hover:shadow-lg transition-shadow"
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/10" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                ))}
              </div>

              {/* Text */}
              <p className="text-secondary mb-6 leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${testimonial.color} rounded-full flex items-center justify-center`}>
                  <span className="text-primary font-semibold text-lg">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-primary">{testimonial.name}</p>
                  <p className="text-sm text-secondary">{testimonial.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
